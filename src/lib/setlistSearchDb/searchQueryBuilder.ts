import {
    escapeSqlLiteral,
    escapePattern,
    hasText,
    splitIntegerTerms,
    splitNormalizedPerformerKeys,
    splitTerms,
} from "./queryUtils";
import { duckdbDateYmdExpr } from "../date/duckdbDateExpr";

import type {
    AdvancedConditionField,
    AdvancedConditionGroup,
    SearchMethod,
    SearchRequest,
    SearchUnit,
} from "./types";

export const isUnfilteredSetlistRequest = (request: SearchRequest): boolean =>
    request.searchUnit === "setlist" &&
    (request.conditionGroups?.length ?? 0) === 0 &&
    !request.groupByEventSong &&
    !hasText(request.term) &&
    !hasText(request.normalizedPerformerKeys ?? "") &&
    !hasText(request.personName) &&
    !hasText(request.songName) &&
    !hasText(request.artistName) &&
    !hasText(request.lyricistName) &&
    !hasText(request.composerName) &&
    !hasText(request.arrangerName) &&
    !hasText(request.eventName) &&
    !hasText(request.venueName) &&
    !hasText(request.eventTag) &&
    !hasText(request.sectionName) &&
    !hasText(request.prefectureIds) &&
    !hasText(request.dateFrom) &&
    !hasText(request.dateTo);

const buildMatch = (
    columnExpr: string,
    term: string,
    method: SearchMethod,
): string => {
    const escaped = escapeSqlLiteral(term.trim());
    if (method === "exact") {
        return `lower(${columnExpr}) = lower('${escaped}')`;
    }
    if (method === "notContains") {
        return `lower(${columnExpr}) NOT LIKE lower('${escapePattern(term)}')`;
    }
    if (method === "notExact") {
        return `lower(${columnExpr}) <> lower('${escaped}')`;
    }
    if (method === "startsWith") {
        return `lower(${columnExpr}) LIKE lower('${escaped}%')`;
    }
    if (method === "endsWith") {
        return `lower(${columnExpr}) LIKE lower('%${escaped}')`;
    }
    return `lower(${columnExpr}) LIKE lower('${escapePattern(term)}')`;
};

const buildAdvancedConditionMatch = (
    field: AdvancedConditionField,
    columnExpr: string,
    term: string,
    method: SearchMethod,
): string => {
    if (field === "eventTag") {
        const tagMatch = `${columnExpr} LIKE '%"${escapeSqlLiteral(term.trim())}"%'`;
        return method === "notContains" || method === "notExact"
            ? `NOT (${tagMatch})`
            : tagMatch;
    }
    if (field === "prefectureId") {
        const numericId = Number.parseInt(term, 10);
        if (!Number.isFinite(numericId) || numericId <= 0) return "";
        const prefMatch = `CAST(prefecture_id AS INTEGER) = ${Math.trunc(numericId)}`;
        return method === "notContains" || method === "notExact"
            ? `NOT (${prefMatch})`
            : prefMatch;
    }
    return buildMatch(columnExpr, term, method);
};

export const buildLikeAny = (
    columnExpr: string,
    raw: string,
    method: SearchMethod = "contains",
): string => {
    const terms = splitTerms(raw);
    if (terms.length === 0) {
        return "";
    }
    const joiner =
        method === "notExact" || method === "notContains" ? " AND " : " OR ";
    return `(${terms.map((term) => buildMatch(columnExpr, term, method)).join(joiner)})`;
};

const joinKeywordColumnConditions = (
    columnExprs: string[],
    raw: string,
    method: SearchMethod,
): string => {
    const conditions = columnExprs
        .map((columnExpr) => buildLikeAny(columnExpr, raw, method))
        .filter((condition) => condition.length > 0);
    if (conditions.length === 0) return "";
    const joiner =
        method === "notContains" || method === "notExact" ? " AND " : " OR ";
    return `(${conditions.join(joiner)})`;
};

export const normalizeDateSql = (fieldRef: string): string => duckdbDateYmdExpr(fieldRef);

export const buildSourceSql = (
    searchUnit: SearchUnit,
    rawTerm: string,
): string => {
    const stageDate = normalizeDateSql("date");
    const termIsBlank = !hasText(rawTerm) || rawTerm === "%%";

    if (searchUnit !== "setlist") {
        const stageTextCondition = joinKeywordColumnConditions(
            [
                "CAST(st.eventName AS TEXT)",
                "CAST(st.venueName AS TEXT)",
                "COALESCE(CAST(st.pattern AS TEXT), '')",
                "CAST(st.eventTagsJson AS TEXT)",
            ],
            rawTerm,
            "contains",
        );
        const stageSetlistCondition = joinKeywordColumnConditions(
            [
                "CAST(sl.songName AS TEXT)",
                "COALESCE(CAST(sl.displayPerformerName AS TEXT), '')",
                "COALESCE(CAST(sl.artistName AS TEXT), '')",
                "COALESCE(CAST(sl.creatorsText AS TEXT), '')",
                "COALESCE(CAST(sl.section AS TEXT), '')",
            ],
            rawTerm,
            "contains",
        );
        const stageSetlistExists = stageSetlistCondition
            ? `
          EXISTS (
            SELECT 1
            FROM setlists sl
            WHERE CAST(sl.stageId AS INTEGER) = CAST(st.stageId AS INTEGER)
              AND ${stageSetlistCondition}
          )
        `
            : "";
        const stageTermConditions = [stageTextCondition, stageSetlistExists].filter(
            (condition) => condition.trim().length > 0,
        );
        const termClause = termIsBlank
            ? "1=1"
            : `(${stageTermConditions.join(" OR ") || "1=1"})`;

        return `
      SELECT
        CAST(st.stageId AS INTEGER) AS row_id,
        CAST(st.stageId AS INTEGER) AS stage_id,
        CAST(st.eventId AS INTEGER) AS event_id,
        0 AS song_id,
        CAST(NULL AS INTEGER) AS artist_id,
        CAST(st.venueId AS INTEGER) AS venue_id,
        CAST(st.eventName AS TEXT) AS primary_text,
        CAST(st.venueName AS TEXT) AS secondary_text,
        '' AS artist_text,
        CAST(st.startTime AS TEXT) AS start_time,
        COALESCE(CAST(st.pattern AS TEXT), '') AS pattern,
        CAST(st.cancelled AS BOOLEAN) AS cancelled,
        CAST(st.eventName AS TEXT) AS event_name,
        ${stageDate} AS date_label,
        CAST(st.venueName AS TEXT) AS venue_name,
        ${stageDate} AS sort_date,
        CAST(st.eventTagsJson AS TEXT) AS eventTagsJson,
        '' AS section_text,
        '' AS base_performer,
        '' AS base_artist,
        '' AS base_lyricist,
        '' AS base_composer,
        '' AS base_arranger,
        '' AS base_song_search_key,
        CAST(st.prefectureId AS INTEGER) AS prefecture_id,
        0 AS total_stages,
        CAST(st.totalPerformances AS INTEGER) AS total_performances
      FROM stages st
      WHERE ${termClause}
    `;
    }

    const setlistKeywordCondition = joinKeywordColumnConditions(
        [
            "CAST(sl.songName AS TEXT)",
            "COALESCE(CAST(sl.displayPerformerName AS TEXT), '')",
            "COALESCE(CAST(sl.artistName AS TEXT), '')",
            "COALESCE(CAST(sl.creatorsText AS TEXT), '')",
            "CAST(sl.eventName AS TEXT)",
            "CAST(sl.venueName AS TEXT)",
            "COALESCE(CAST(sl.section AS TEXT), '')",
        ],
        rawTerm,
        "contains",
    );
    const termClause = termIsBlank ? "1=1" : setlistKeywordCondition;

    return `
    SELECT
      CAST(sl.setlistId AS INTEGER) AS row_id,
      CAST(sl.stageId AS INTEGER) AS stage_id,
      CAST(sl.eventId AS INTEGER) AS event_id,
      CAST(sl.songId AS INTEGER) AS song_id,
      CAST(sl.artistId AS INTEGER) AS artist_id,
      CAST(sl.venueId AS INTEGER) AS venue_id,
      CAST(sl.songName AS TEXT) AS primary_text,
      COALESCE(CAST(sl.displayPerformerName AS TEXT), '') AS secondary_text,
      COALESCE(CAST(sl.artistName AS TEXT), '') AS artist_text,
      CAST(sl.startTime AS TEXT) AS start_time,
      CAST(NULL AS TEXT) AS pattern,
      CAST(COALESCE((
        SELECT st.cancelled
        FROM stages st
        WHERE CAST(st.stageId AS INTEGER) = CAST(sl.stageId AS INTEGER)
        LIMIT 1
      ), FALSE) AS BOOLEAN) AS cancelled,
      CAST(sl.eventName AS TEXT) AS event_name,
      ${stageDate} AS date_label,
      CAST(sl.venueName AS TEXT) AS venue_name,
      ${stageDate} AS sort_date,
      CAST(sl.eventTagsJson AS TEXT) AS eventTagsJson,
      COALESCE(CAST(sl.section AS TEXT), '') AS section_text,
      COALESCE(CAST(sl.displayPerformerName AS TEXT), '') AS base_performer,
      COALESCE(CAST(sl.artistName AS TEXT), '') AS base_artist,
      COALESCE(CAST(sl.lyricistName AS TEXT), '') AS base_lyricist,
      COALESCE(CAST(sl.composerName AS TEXT), '') AS base_composer,
      COALESCE(CAST(sl.arrangerName AS TEXT), '') AS base_arranger,
      COALESCE(CAST(sl.songNameSearchKey AS TEXT), '') AS base_song_search_key,
      CAST(sl.prefectureId AS INTEGER) AS prefecture_id,
      0 AS total_stages,
      0 AS total_performances
    FROM setlists sl
    WHERE ${termClause}
  `;
};

export const buildFilterSql = (request: SearchRequest): string => {
    const filters: string[] = [];
    // NOTE:
    // キーワード(term) は buildSourceSql 側ですでに適用済み。
    // ここで同条件を再評価すると event/stage 検索時に EXISTS が二重化し、体感速度が落ちる。

    const setlistColumnByField: Record<AdvancedConditionField, string> = {
        songName: "primary_text",
        personName: "COALESCE(CAST(base_performer AS TEXT), '')",
        artistName: "base_artist",
        lyricistName: "base_lyricist",
        composerName: "base_composer",
        arrangerName: "base_arranger",
        eventName: "event_name",
        venueName: "venue_name",
        sectionName: "section_text",
        eventTag: "event_tags_json",
        prefectureId: "CAST(prefecture_id AS TEXT)",
    };

    const buildAdvancedConditionForField = (
        field: AdvancedConditionField,
        value: string,
        method: SearchMethod,
    ): string => {
        const term = value.trim();
        if (!term) return "";
        if (request.searchUnit !== "stage") {
            return buildAdvancedConditionMatch(
                field,
                setlistColumnByField[field],
                term,
                method,
            );
        }

        if (field === "songName") {
            const match = buildLikeAny("CAST(sl.songName AS TEXT)", term, method);
            return match
                ? `EXISTS (SELECT 1 FROM setlists sl WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER) AND ${match})`
                : "";
        }
        if (field === "personName") {
            const match = buildLikeAny("COALESCE(CAST(sl.displayPerformerName AS TEXT), '')", term, method);
            return match
                ? `EXISTS (SELECT 1 FROM setlists sl WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER) AND ${match})`
                : "";
        }
        if (field === "artistName") {
            const match = buildLikeAny("COALESCE(CAST(sl.artistName AS TEXT), '')", term, method);
            return match
                ? `EXISTS (SELECT 1 FROM setlists sl WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER) AND ${match})`
                : "";
        }
        if (field === "lyricistName") {
            const match = buildLikeAny("COALESCE(CAST(sl.lyricistName AS TEXT), '')", term, method);
            return match
                ? `EXISTS (SELECT 1 FROM setlists sl WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER) AND ${match})`
                : "";
        }
        if (field === "composerName") {
            const match = buildLikeAny("COALESCE(CAST(sl.composerName AS TEXT), '')", term, method);
            return match
                ? `EXISTS (SELECT 1 FROM setlists sl WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER) AND ${match})`
                : "";
        }
        if (field === "arrangerName") {
            const match = buildLikeAny("COALESCE(CAST(sl.arrangerName AS TEXT), '')", term, method);
            return match
                ? `EXISTS (SELECT 1 FROM setlists sl WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER) AND ${match})`
                : "";
        }
        if (field === "sectionName") {
            const match = buildLikeAny("COALESCE(CAST(sl.section AS TEXT), '')", term, method);
            return match
                ? `EXISTS (SELECT 1 FROM setlists sl WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER) AND ${match})`
                : "";
        }

        return buildAdvancedConditionMatch(field, setlistColumnByField[field], term, method);
    };

    const buildGroupCondition = (group: AdvancedConditionGroup): string => {
        const normalizedValues = group.values
            .map((value) => ({ ...value, value: value.value.trim() }))
            .filter((value) => value.value.length > 0);
        if (normalizedValues.length === 0) return "";
        const positives = normalizedValues.filter(
            (value) => value.method !== "notContains" && value.method !== "notExact",
        );
        const negatives = normalizedValues.filter(
            (value) => value.method === "notContains" || value.method === "notExact",
        );
        const parts: string[] = [];
        const groupJoin = group.conditionJoin === "and" ? " AND " : " OR ";
        if (positives.length > 0) {
            const positiveConditions = positives
                .map((value) =>
                    buildAdvancedConditionForField(
                        value.field,
                        value.value,
                        value.method,
                    ),
                )
                .filter((condition) => condition.length > 0);
            if (positiveConditions.length > 0) {
                parts.push(`(${positiveConditions.join(groupJoin)})`);
            }
        }
        if (negatives.length > 0) {
            const negativeConditions = negatives
                .map((value) =>
                    buildAdvancedConditionForField(
                        value.field,
                        value.value,
                        value.method,
                    ),
                )
                .filter((condition) => condition.length > 0);
            if (negativeConditions.length > 0) {
                parts.push(`(${negativeConditions.join(groupJoin)})`);
            }
        }
        return parts.length === 0 ? "" : `(${parts.join(" AND ")})`;
    };

    const conditionGroups = (request.conditionGroups ?? [])
        .map((group) => ({
            ...group,
            values: group.values.filter((value) => value.value.trim().length > 0),
        }))
        .filter((group) => group.values.length > 0);
    if (conditionGroups.length > 0) {
        const groupConditions: string[] = [];
        conditionGroups.forEach((group) => {
            const condition = buildGroupCondition(group);
            if (condition) {
                groupConditions.push(condition);
            }
        });
        if (groupConditions.length > 0) {
            const topJoin = request.conditionTopLevelJoin === "or" ? " OR " : " AND ";
            const joined = groupConditions.reduce((acc, condition, index) => {
                if (index === 0) return condition;
                const relation = conditionGroups[index]?.joinWithPrev === "or" ? " OR " : topJoin;
                return `${acc}${relation}${condition}`;
            }, "");
            filters.push(`(${joined})`);
        }
    }

    const normalizedPerformers = splitNormalizedPerformerKeys(
        request.normalizedPerformerKeys ?? "",
    );
    if (request.searchUnit === "setlist" && normalizedPerformers.length > 0) {
        const keyCases = normalizedPerformers
            .map((performer) =>
                performer.kind === "person"
                    ? `WHEN CAST(sep.personId AS INTEGER) = ${performer.id} THEN '${performer.key}'`
                    : `WHEN CAST(sep.groupId AS INTEGER) = ${performer.id} THEN '${performer.key}'`,
            )
            .join(" ");
        filters.push(`CAST(row_id AS INTEGER) IN (
          SELECT CAST(sep.setlistEntryId AS INTEGER)
          FROM setlist_entry_performers sep
          WHERE ${
              normalizedPerformers
                  .map((performer) =>
                      performer.kind === "person"
                          ? `CAST(sep.personId AS INTEGER) = ${performer.id}`
                          : `CAST(sep.groupId AS INTEGER) = ${performer.id}`,
                  )
                  .join(" OR ")
          }
          GROUP BY CAST(sep.setlistEntryId AS INTEGER)
          HAVING COUNT(DISTINCT CASE ${keyCases} ELSE NULL END) = ${normalizedPerformers.length}
        )`);
    }

    const songCondition = buildLikeAny(
        "primary_text",
        request.songName,
        request.fieldSearchMethods.songName,
    );
    if (songCondition) {
        if (request.searchUnit === "setlist") {
            filters.push(songCondition);
        } else {
            const stageSongCondition = buildLikeAny(
                "CAST(sl.songName AS TEXT)",
                request.songName,
                request.fieldSearchMethods.songName,
            );
            filters.push(
                `EXISTS (
          SELECT 1
          FROM setlists sl
          WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER)
            AND ${stageSongCondition}
        )`,
            );
        }
    }

    const personCondition = buildLikeAny(
        "secondary_text",
        request.personName,
        request.fieldSearchMethods.personName,
    );
    if (personCondition) {
        if (request.searchUnit === "setlist") {
            const setlistPersonCondition = buildLikeAny(
                `COALESCE(CAST(base_performer AS TEXT), '')`,
                request.personName,
                request.fieldSearchMethods.personName,
            );
            filters.push(setlistPersonCondition);
        } else {
            const stagePersonCondition = buildLikeAny(
                `COALESCE(CAST(sl.displayPerformerName AS TEXT), '')`,
                request.personName,
                request.fieldSearchMethods.personName,
            );
            filters.push(
                `EXISTS (
          SELECT 1
          FROM setlists sl
          WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER)
            AND ${stagePersonCondition}
        )`,
            );
        }
    }

    const artistCondition = buildLikeAny(
        "base_artist",
        request.artistName,
        request.fieldSearchMethods.artistName,
    );
    if (artistCondition) {
        if (request.searchUnit === "setlist") {
            filters.push(artistCondition);
        } else {
            const stageArtistCondition = buildLikeAny(
                `COALESCE(CAST(sl.artistName AS TEXT), '')`,
                request.artistName,
                request.fieldSearchMethods.artistName,
            );
            filters.push(
                `EXISTS (
          SELECT 1
          FROM setlists sl
          WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER)
            AND ${stageArtistCondition}
        )`,
            );
        }
    }

    const lyricistCondition = buildLikeAny(
        "base_lyricist",
        request.lyricistName,
        request.fieldSearchMethods.lyricistName,
    );
    if (lyricistCondition) {
        if (request.searchUnit === "setlist") {
            filters.push(lyricistCondition);
        } else {
            const stageLyricistCondition = buildLikeAny(
                `COALESCE(CAST(sl.lyricistName AS TEXT), '')`,
                request.lyricistName,
                request.fieldSearchMethods.lyricistName,
            );
            filters.push(
                `EXISTS (
          SELECT 1
          FROM setlists sl
          WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER)
            AND ${stageLyricistCondition}
        )`,
            );
        }
    }

    const composerCondition = buildLikeAny(
        "base_composer",
        request.composerName,
        request.fieldSearchMethods.composerName,
    );
    if (composerCondition) {
        if (request.searchUnit === "setlist") {
            filters.push(composerCondition);
        } else {
            const stageComposerCondition = buildLikeAny(
                `COALESCE(CAST(sl.composerName AS TEXT), '')`,
                request.composerName,
                request.fieldSearchMethods.composerName,
            );
            filters.push(
                `EXISTS (
          SELECT 1
          FROM setlists sl
          WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER)
            AND ${stageComposerCondition}
        )`,
            );
        }
    }

    const arrangerCondition = buildLikeAny(
        "base_arranger",
        request.arrangerName,
        request.fieldSearchMethods.arrangerName,
    );
    if (arrangerCondition) {
        if (request.searchUnit === "setlist") {
            filters.push(arrangerCondition);
        } else {
            const stageArrangerCondition = buildLikeAny(
                `COALESCE(CAST(sl.arrangerName AS TEXT), '')`,
                request.arrangerName,
                request.fieldSearchMethods.arrangerName,
            );
            filters.push(
                `EXISTS (
          SELECT 1
          FROM setlists sl
          WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER)
            AND ${stageArrangerCondition}
        )`,
            );
        }
    }

    const eventNameCondition = buildLikeAny(
        "event_name",
        request.eventName,
        request.fieldSearchMethods.eventName,
    );
    if (eventNameCondition) {
        filters.push(eventNameCondition);
    }

    const venueCondition = buildLikeAny(
        "venue_name",
        request.venueName,
        request.fieldSearchMethods.venueName,
    );
    if (venueCondition) {
        filters.push(venueCondition);
    }

    const eventTagCondition = buildLikeAny(
        "event_tags_json",
        request.eventTag,
        request.fieldSearchMethods.eventTag,
    );
    if (eventTagCondition) {
        filters.push(eventTagCondition);
    }

    const sectionCondition = buildLikeAny(
        "section_text",
        request.sectionName,
        request.fieldSearchMethods.sectionName,
    );
    if (sectionCondition) {
        if (request.searchUnit === "setlist") {
            filters.push(sectionCondition);
        } else {
            const stageSectionCondition = buildLikeAny(
                "COALESCE(CAST(sl.section AS TEXT), '')",
                request.sectionName,
                request.fieldSearchMethods.sectionName,
            );
            if (stageSectionCondition) {
                filters.push(
                    `EXISTS (
            SELECT 1
            FROM setlists sl
            WHERE CAST(sl.stageId AS INTEGER) = CAST(row_id AS INTEGER)
              AND ${stageSectionCondition}
          )`,
                );
            }
        }
    }

    const prefectures = splitIntegerTerms(request.prefectureIds);
    if (prefectures.length > 0) {
        const values = prefectures.join(", ");
        filters.push(`CAST(prefecture_id AS INTEGER) IN (${values})`);
    }

    if (request.dateFrom) {
        const fromDate = escapeSqlLiteral(request.dateFrom);
        filters.push(`sort_date >= '${fromDate}'`);
    }

    if (request.dateTo) {
        const toDate = escapeSqlLiteral(request.dateTo);
        filters.push(`sort_date <= '${toDate}'`);
    }

    if (filters.length === 0) {
        return "";
    }

    return `WHERE ${filters.join(" AND ")}`;
};

export const buildOrderBySql = (request: SearchRequest): string => {
    const direction = request.sortOrder.toUpperCase();
    if (request.sortBy === "event") {
        return `event_name ${direction}, sort_date DESC, row_id DESC`;
    }
    if (request.sortBy === "venue") {
        return `venue_name ${direction}, sort_date DESC, row_id DESC`;
    }
    if (request.sortBy === "title") {
        return `primary_text ${direction}, sort_date DESC, row_id DESC`;
    }
    if (request.sortBy === "performer") {
        return `secondary_text ${direction}, sort_date DESC, row_id DESC`;
    }
    if (request.sortBy === "artist") {
        return `base_artist ${direction}, sort_date DESC, row_id DESC`;
    }
    if (request.sortBy === "startTime") {
        return `start_time ${direction}, sort_date DESC, row_id DESC`;
    }
    return `sort_date ${direction}, row_id DESC`;
};

export const buildGroupedEventOrderBySql = (request: SearchRequest): string => {
    const direction = request.sortOrder.toUpperCase();
    if (request.sortBy === "event") {
        return `event_name ${direction}, sort_date DESC, event_id DESC`;
    }
    if (request.sortBy === "date" || request.sortBy === "startTime") {
        return `sort_date ${direction}, event_name ASC, event_id DESC`;
    }
    if (request.sortBy === "venue") {
        return `venue_name ${direction}, sort_date DESC, event_id DESC`;
    }
    return `sort_date ${direction}, event_name ASC, event_id DESC`;
};
