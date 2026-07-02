import {
    clampInt,
    escapeSqlLiteral,
    toInt,
    toSafePositiveInt,
    toText,
} from "./queryUtils";
import { hasTableColumnAsync } from "./tableSchemaCache";
export { getHomeDailyDigest } from "./homeDigestQueries";
export {
    getDashboardData,
    getReleaseDbChanges,
    getReleaseNote,
    listReleaseNotes,
} from "./releaseQueries";
export {
    listEventTags,
    listGroups,
    listMemberColorNames,
    listPrefectures,
} from "./masterQueries";

import type {
    AlbumDetail,
    AlbumTrack,
    ArtistDetail,
    CreatorDetail,
    CreatorRole,
    CreatorSongRow,
    EventDetail,
    SongSearchRequest,
    SongSearchResponse,
    StatsAttributeRankingRequest,
    SongRankingRequest,
    SongRankingResponse,
    StatsSetlistDetailRequest,
    StatsSetlistDetailResponse,
    SongDetail,
    SongTopPercentiles,
    SongVersionDetail,
    PerformerSummaryRow,
    SetlistDetail,
    StageDetail,
    VenueDetail,
    VenueTopPercentiles,
} from "./types";
import type * as duckdb from "@duckdb/duckdb-wasm";

const SQL_ORDER_FALLBACK = 2147483647;
const LIMIT_MIN = 1;
const SONG_SETLIST_LIMIT_MAX = 400;
const RELATED_EVENT_LIMIT_MAX = 200;
const escapeSqlLikeLiteral = (value: string): string =>
    escapeSqlLiteral(value).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

const hasColumn = hasTableColumnAsync;

const TIMESTAMP_COLUMN_CANDIDATES = [
    "updatedAt",
    "updated_at",
    "createdAt",
    "created_at",
    "date",
    "releaseDate",
    "firstDate",
    "lastDate",
] as const;

const getTableLatestTimestamp = async (
    conn: duckdb.AsyncDuckDBConnection,
    tableName: string,
    whereSql: string,
): Promise<string | null> => {
    for (const columnName of TIMESTAMP_COLUMN_CANDIDATES) {
        if (!(await hasColumn(conn, tableName, columnName))) continue;
        const result = await conn.query(`
          SELECT CAST(MAX(TRY_CAST(CAST(${columnName} AS TEXT) AS TIMESTAMP)) AS TEXT) AS ts
          FROM ${tableName}
          ${whereSql}
        `);
        const row = result.toArray()[0] as Record<string, unknown> | undefined;
        const timestamp = toText(row?.ts);
        if (timestamp) return timestamp;
    }
    return null;
};

const pickLatestTimestamp = (candidates: Array<string | null>): string | null => {
    let bestMs = Number.NEGATIVE_INFINITY;
    let best: string | null = null;
    for (const candidate of candidates) {
        if (!candidate) continue;
        const parsedMs = Date.parse(candidate);
        if (Number.isNaN(parsedMs)) continue;
        if (parsedMs > bestMs) {
            bestMs = parsedMs;
            best = candidate;
        }
    }
    if (best) return best;
    const fallback = candidates.filter((value): value is string => Boolean(value)).sort();
    return fallback.length > 0 ? fallback[fallback.length - 1] : null;
};

export const getDetailLastUpdatedAt = async (
    conn: duckdb.AsyncDuckDBConnection,
    detailType:
        | "event"
        | "stage"
        | "venue"
        | "song"
        | "artist"
        | "album"
        | "member"
        | "group"
        | "creator",
    id: number,
): Promise<string | null> => {
    const safeId = Math.trunc(id);
    if (!Number.isFinite(safeId) || safeId <= 0) return null;

    const specsByType: Record<
        typeof detailType,
        Array<{ tableName: string; whereSql: string }>
    > = {
        event: [
            { tableName: "events", whereSql: `WHERE CAST(eventId AS INTEGER) = ${safeId}` },
            { tableName: "stages", whereSql: `WHERE CAST(eventId AS INTEGER) = ${safeId}` },
            { tableName: "setlists", whereSql: `WHERE CAST(eventId AS INTEGER) = ${safeId}` },
        ],
        stage: [
            { tableName: "stages", whereSql: `WHERE CAST(stageId AS INTEGER) = ${safeId}` },
            { tableName: "setlists", whereSql: `WHERE CAST(stageId AS INTEGER) = ${safeId}` },
            {
                tableName: "events",
                whereSql: `WHERE CAST(eventId AS INTEGER) IN (
                  SELECT CAST(eventId AS INTEGER)
                  FROM stages
                  WHERE CAST(stageId AS INTEGER) = ${safeId}
                )`,
            },
        ],
        venue: [
            { tableName: "venues", whereSql: `WHERE CAST(venueId AS INTEGER) = ${safeId}` },
            { tableName: "stages", whereSql: `WHERE CAST(venueId AS INTEGER) = ${safeId}` },
            { tableName: "setlists", whereSql: `WHERE CAST(venueId AS INTEGER) = ${safeId}` },
        ],
        song: [
            { tableName: "songs", whereSql: `WHERE CAST(songId AS INTEGER) = ${safeId}` },
            { tableName: "setlists", whereSql: `WHERE CAST(songId AS INTEGER) = ${safeId}` },
            { tableName: "song_versions", whereSql: `WHERE CAST(songId AS INTEGER) = ${safeId}` },
            { tableName: "album_tracks", whereSql: `WHERE CAST(songId AS INTEGER) = ${safeId}` },
        ],
        artist: [
            { tableName: "artist_profiles", whereSql: `WHERE CAST(artistId AS INTEGER) = ${safeId}` },
            { tableName: "songs", whereSql: `WHERE CAST(artistId AS INTEGER) = ${safeId}` },
            { tableName: "song_versions", whereSql: `WHERE CAST(artistId AS INTEGER) = ${safeId}` },
            { tableName: "albums", whereSql: `WHERE CAST(artistId AS INTEGER) = ${safeId}` },
            { tableName: "setlists", whereSql: `WHERE CAST(artistId AS INTEGER) = ${safeId}` },
        ],
        album: [
            { tableName: "albums", whereSql: `WHERE CAST(albumId AS INTEGER) = ${safeId}` },
            { tableName: "album_tracks", whereSql: `WHERE CAST(albumId AS INTEGER) = ${safeId}` },
        ],
        member: [
            { tableName: "persons", whereSql: `WHERE CAST(personId AS INTEGER) = ${safeId}` },
            { tableName: "member_profiles", whereSql: `WHERE CAST(personId AS INTEGER) = ${safeId}` },
            { tableName: "group_memberships", whereSql: `WHERE CAST(personId AS INTEGER) = ${safeId}` },
            { tableName: "member_colors", whereSql: `WHERE CAST(personId AS INTEGER) = ${safeId}` },
        ],
        group: [
            { tableName: "groups", whereSql: `WHERE CAST(groupId AS INTEGER) = ${safeId}` },
            { tableName: "group_aliases", whereSql: `WHERE CAST(groupId AS INTEGER) = ${safeId}` },
            { tableName: "group_memberships", whereSql: `WHERE CAST(groupId AS INTEGER) = ${safeId}` },
            { tableName: "group_roles", whereSql: `WHERE CAST(groupId AS INTEGER) = ${safeId}` },
        ],
        creator: [
            {
                tableName: "creator_profiles",
                whereSql: `WHERE CAST(creatorId AS INTEGER) = ${safeId}`,
            },
        ],
    };

    const specs = specsByType[detailType];
    const candidates: Array<string | null> = [];
    for (const spec of specs) {
        candidates.push(
            await getTableLatestTimestamp(conn, spec.tableName, spec.whereSql),
        );
    }
    return pickLatestTimestamp(candidates);
};

export const getEventDetail = async (
    conn: duckdb.AsyncDuckDBConnection,
    eventId: number,
): Promise<EventDetail | null> => {
    const safeEventId = toSafePositiveInt(eventId);
    const result = await conn.query(`
    SELECT
      CAST(eventId AS INTEGER) AS eventId,
      CAST(eventName AS TEXT) AS eventName,
      CAST(firstDate AS TEXT) AS firstDate,
      CAST(lastDate AS TEXT) AS lastDate,
      CAST(totalStages AS INTEGER) AS totalStages,
      CAST(totalPerformances AS INTEGER) AS totalPerformances,
      CAST(eventTagsJson AS TEXT) AS eventTagsJson
    FROM events
    WHERE eventId = ${safeEventId}
    LIMIT 1
  `);
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) {
        return null;
    }
    return {
        eventId: toInt(row.eventId),
        eventName: toText(row.eventName),
        firstDate: toText(row.firstDate),
        lastDate: toText(row.lastDate),
        totalStages: toInt(row.totalStages),
        totalPerformances: toInt(row.totalPerformances),
        eventTagsJson: toText(row.eventTagsJson || "[]"),
    };
};

export const getEventStages = async (
    conn: duckdb.AsyncDuckDBConnection,
    eventId: number,
): Promise<StageDetail[]> => {
    const safeEventId = toSafePositiveInt(eventId);
    const result = await conn.query(`
    SELECT
      CAST(s.stageId AS INTEGER) AS stageId,
      CAST(s.eventId AS INTEGER) AS eventId,
      CAST(
        ROW_NUMBER() OVER (
          PARTITION BY CAST(s.eventId AS INTEGER)
          ORDER BY
            CAST(s.date AS TEXT) ASC,
            COALESCE(CAST(s.startTime AS TEXT), '99:99:99') ASC,
            CAST(s.stageId AS INTEGER) ASC
        ) AS INTEGER
      ) AS eventStageNumber,
      CAST(s.eventName AS TEXT) AS eventName,
      CAST(s.venueId AS INTEGER) AS venueId,
      CAST(s.venueName AS TEXT) AS venueName,
      CAST(v.prefectureName AS TEXT) AS prefectureName,
      CAST(s.date AS TEXT) AS date,
      CAST(s.startTime AS TEXT) AS startTime,
      CAST(s.pattern AS TEXT) AS pattern,
      CAST(s.cancelled AS BOOLEAN) AS cancelled,
      CAST(s.totalPerformances AS INTEGER) AS totalPerformances,
      CAST(s.eventTagsJson AS TEXT) AS eventTagsJson
    FROM stages s
    LEFT JOIN venues v ON CAST(v.venueId AS INTEGER) = CAST(s.venueId AS INTEGER)
    WHERE CAST(s.eventId AS INTEGER) = ${safeEventId}
    ORDER BY
      CAST(s.date AS TEXT) ASC,
      COALESCE(CAST(s.startTime AS TEXT), '99:99:99') ASC,
      CAST(s.stageId AS INTEGER) ASC
  `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        stageId: toInt(row.stageId),
        eventId: toInt(row.eventId),
        eventStageNumber:
            row.eventStageNumber === null || row.eventStageNumber === undefined
                ? null
                : toInt(row.eventStageNumber),
        eventName: toText(row.eventName),
        venueId: toInt(row.venueId),
        venueName: toText(row.venueName),
        prefectureName: row.prefectureName ? toText(row.prefectureName) : null,
        date: toText(row.date),
        startTime: row.startTime ? toText(row.startTime) : null,
        pattern: row.pattern ? toText(row.pattern) : null,
        cancelled: Boolean(row.cancelled),
        totalPerformances: toInt(row.totalPerformances),
        eventTagsJson: toText(row.eventTagsJson || "[]"),
    }));
};

export const getStageDetail = async (
    conn: duckdb.AsyncDuckDBConnection,
    stageId: number,
): Promise<StageDetail | null> => {
    const safeStageId = toSafePositiveInt(stageId);
    const result = await conn.query(`
    WITH ranked_stages AS (
      SELECT
        CAST(s.stageId AS INTEGER) AS stageId,
        CAST(s.eventId AS INTEGER) AS eventId,
        CAST(
          ROW_NUMBER() OVER (
            PARTITION BY CAST(s.eventId AS INTEGER)
            ORDER BY
              CAST(s.date AS TEXT) ASC,
              COALESCE(CAST(s.startTime AS TEXT), '99:99:99') ASC,
              CAST(s.stageId AS INTEGER) ASC
          ) AS INTEGER
        ) AS eventStageNumber,
        CAST(s.eventName AS TEXT) AS eventName,
        CAST(s.venueId AS INTEGER) AS venueId,
        CAST(s.venueName AS TEXT) AS venueName,
        CAST(s.date AS TEXT) AS date,
        CAST(s.startTime AS TEXT) AS startTime,
        CAST(s.pattern AS TEXT) AS pattern,
        CAST(s.cancelled AS BOOLEAN) AS cancelled,
        CAST(s.totalPerformances AS INTEGER) AS totalPerformances,
        CAST(s.eventTagsJson AS TEXT) AS eventTagsJson
      FROM stages s
    )
    SELECT
      rs.stageId AS stageId,
      rs.eventId AS eventId,
      rs.eventStageNumber AS eventStageNumber,
      rs.eventName AS eventName,
      rs.venueId AS venueId,
      rs.venueName AS venueName,
      CAST(v.prefectureName AS TEXT) AS prefectureName,
      rs.date AS date,
      rs.startTime AS startTime,
      rs.pattern AS pattern,
      rs.cancelled AS cancelled,
      rs.totalPerformances AS totalPerformances,
      rs.eventTagsJson AS eventTagsJson
    FROM ranked_stages rs
    LEFT JOIN venues v ON CAST(v.venueId AS INTEGER) = rs.venueId
    WHERE rs.stageId = ${safeStageId}
    LIMIT 1
  `);
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) {
        return null;
    }
    return {
        stageId: toInt(row.stageId),
        eventId: toInt(row.eventId),
        eventStageNumber:
            row.eventStageNumber === null || row.eventStageNumber === undefined
                ? null
                : toInt(row.eventStageNumber),
        eventName: toText(row.eventName),
        venueId: toInt(row.venueId),
        venueName: toText(row.venueName),
        prefectureName: row.prefectureName ? toText(row.prefectureName) : null,
        date: toText(row.date),
        startTime: row.startTime ? toText(row.startTime) : null,
        pattern: row.pattern ? toText(row.pattern) : null,
        cancelled: Boolean(row.cancelled),
        totalPerformances: toInt(row.totalPerformances),
        eventTagsJson: toText(row.eventTagsJson || "[]"),
    };
};

const mapPerformerSummaryRows = (
    rows: Array<Record<string, unknown>>,
): PerformerSummaryRow[] =>
    rows.map((row) => ({
        performerName: toText(row.performerName),
        memberPersonIdsJson: row.memberPersonIdsJson
            ? toText(row.memberPersonIdsJson)
            : null,
        absencePersonNamesJson: row.absencePersonNamesJson
            ? toText(row.absencePersonNamesJson)
            : null,
        performerRole: row.performerRole ? toText(row.performerRole) : null,
        note: row.note ? toText(row.note) : null,
        personId:
            row.personId === null || row.personId === undefined
                ? null
                : toInt(row.personId),
        personName: row.personName ? toText(row.personName) : null,
        groupId:
            row.groupId === null || row.groupId === undefined
                ? null
                : toInt(row.groupId),
        groupName: row.groupName ? toText(row.groupName) : null,
        stageCount: toInt(row.stageCount),
        setlistCount: toInt(row.setlistCount),
    }));

const parseMemberPersonIds = (value: string | null | undefined): number[] => {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item) => Number(item))
            .filter((item) => Number.isFinite(item));
    } catch {
        return [];
    }
};

const GROUP_MEMBER_SOURCE_TYPE = "group_member";

const extractPerformerGroupBaseName = (label: string): string => {
    const text = label.trim();
    if (!text) return "";
    const stripped = text.replace(/[（(][^（）()]*[）)]?$/, "").trim();
    return stripped || text;
};

const enrichPerformerMemberExpansions = async (
    conn: duckdb.AsyncDuckDBConnection,
    rows: PerformerSummaryRow[],
    scope: { kind: "event"; eventId: number } | { kind: "stage"; stageId: number },
): Promise<PerformerSummaryRow[]> => {
    const needsEnrichment = rows.some(
        (row) =>
            row.groupId !== null &&
            parseMemberPersonIds(row.memberPersonIdsJson).length === 0,
    );
    if (!needsEnrichment) return rows;

    const tableName =
        scope.kind === "event" ? "event_performer_persons" : "stage_performer_persons";
    const hasExpansionTable = await hasColumn(conn, tableName, "personId");
    if (!hasExpansionTable) return rows;

    const scopeClause =
        scope.kind === "event"
            ? `CAST(eventId AS INTEGER) = ${toSafePositiveInt(scope.eventId)}`
            : `CAST(stageId AS INTEGER) = ${toSafePositiveInt(scope.stageId)}`;

    const result = await conn.query(`
      SELECT
        CAST(groupId AS INTEGER) AS groupId,
        CAST(personId AS INTEGER) AS personId,
        CAST(personName AS TEXT) AS personName
      FROM ${tableName}
      WHERE ${scopeClause}
        AND CAST(sourceType AS TEXT) = '${GROUP_MEMBER_SOURCE_TYPE}'
        AND CAST(groupId AS INTEGER) IS NOT NULL
      ORDER BY CAST(groupId AS INTEGER) ASC, CAST(personId AS INTEGER) ASC
    `);

    const membersByGroupId = new Map<
        number,
        Array<{ personId: number; personName: string }>
    >();
    for (const row of result.toArray() as Array<Record<string, unknown>>) {
        const groupId = toInt(row.groupId);
        const personId = toInt(row.personId);
        const personName = toText(row.personName);
        const list = membersByGroupId.get(groupId) ?? [];
        if (!membersByGroupId.has(groupId)) {
            membersByGroupId.set(groupId, list);
        }
        if (!list.some((member) => member.personId === personId)) {
            list.push({ personId, personName });
        }
    }
    if (membersByGroupId.size === 0) return rows;

    return rows.map((row) => {
        if (
            row.groupId === null ||
            parseMemberPersonIds(row.memberPersonIdsJson).length > 0
        ) {
            return row;
        }
        const members = membersByGroupId.get(row.groupId) ?? [];
        if (members.length === 0) return row;
        const baseName =
            extractPerformerGroupBaseName(row.performerName || row.groupName || "") ||
            row.groupName ||
            row.performerName;
        const names = members.map((member) => member.personName).filter(Boolean);
        return {
            ...row,
            memberPersonIdsJson: JSON.stringify(members.map((member) => member.personId)),
            performerName:
                names.length > 0
                    ? `${baseName}（${names.join("・")}）`
                    : row.performerName,
        };
    });
};

const reorderGroupMemberIdsForRows = async (
    conn: duckdb.AsyncDuckDBConnection,
    rows: PerformerSummaryRow[],
): Promise<PerformerSummaryRow[]> => {
    const groupIds = Array.from(
        new Set(
            rows
                .map((row) => row.groupId)
                .filter((groupId): groupId is number => groupId !== null),
        ),
    );
    if (groupIds.length === 0) return rows;

    const result = await conn.query(`
      SELECT
        CAST(groupId AS INTEGER) AS groupId,
        CAST(personId AS INTEGER) AS personId
      FROM group_memberships
      WHERE CAST(groupId AS INTEGER) IN (${groupIds.join(",")})
      ORDER BY
        CAST(groupId AS INTEGER) ASC,
        CAST(joinDate AS TEXT) ASC,
        CAST(birthday AS TEXT) ASC
    `);
    const orderByGroup = new Map<number, Map<number, number>>();
    for (const row of result.toArray() as Array<Record<string, unknown>>) {
        const groupId = toInt(row.groupId);
        const personId = toInt(row.personId);
        const groupMap = orderByGroup.get(groupId) ?? new Map<number, number>();
        if (!orderByGroup.has(groupId)) {
            orderByGroup.set(groupId, groupMap);
        }
        if (!groupMap.has(personId)) {
            groupMap.set(personId, groupMap.size);
        }
    }

    return rows.map((row) => {
        if (row.groupId === null || !row.memberPersonIdsJson) return row;
        const ids = parseMemberPersonIds(row.memberPersonIdsJson);
        if (ids.length <= 1) return row;

        const orderMap = orderByGroup.get(row.groupId);
        if (!orderMap || orderMap.size === 0) return row;

        const idsWithIndex = ids.map((personId, index) => ({ personId, index }));
        idsWithIndex.sort((left, right) => {
            const leftRank = orderMap.get(left.personId) ?? Number.MAX_SAFE_INTEGER;
            const rightRank = orderMap.get(right.personId) ?? Number.MAX_SAFE_INTEGER;
            if (leftRank !== rightRank) return leftRank - rightRank;
            return left.index - right.index;
        });

        return {
            ...row,
            memberPersonIdsJson: JSON.stringify(
                idsWithIndex.map((item) => item.personId),
            ),
        };
    });
};

export const getEventPerformers = async (
    conn: duckdb.AsyncDuckDBConnection,
    eventId: number,
): Promise<PerformerSummaryRow[]> => {
    const safeEventId = toSafePositiveInt(eventId);
    const hasEventPerformers = await hasColumn(conn, "event_performers", "eventId");
    const hasEventPerformerOrder = hasEventPerformers
        ? await hasColumn(conn, "event_performers", "order")
        : false;
    if (hasEventPerformers) {
        const result = await conn.query(`
        SELECT
          CAST(ep.performerName AS TEXT) AS performerName,
          CAST(ep.memberPersonIdsJson AS TEXT) AS memberPersonIdsJson,
          CAST(ep.absencePersonNamesJson AS TEXT) AS absencePersonNamesJson,
          CAST(ep.performerRole AS TEXT) AS performerRole,
          CAST(ep.note AS TEXT) AS note,
          CAST(ep.personId AS INTEGER) AS personId,
          CAST(ep.personName AS TEXT) AS personName,
          CAST(ep.groupId AS INTEGER) AS groupId,
          CAST(ep.groupName AS TEXT) AS groupName,
          CAST(COALESCE(sp_stats.stageCount, 0) AS INTEGER) AS stageCount,
          CAST(COALESCE(sep_stats.setlistCount, 0) AS INTEGER) AS setlistCount
        FROM event_performers ep
        LEFT JOIN (
          SELECT
            CAST(sp.eventId AS INTEGER) AS eventId,
            CAST(sp.personId AS INTEGER) AS personId,
            CAST(sp.groupId AS INTEGER) AS groupId,
            CAST(sp.performerName AS TEXT) AS performerName,
            COUNT(DISTINCT CAST(sp.stageId AS INTEGER)) AS stageCount
          FROM stage_performers sp
          GROUP BY
            CAST(sp.eventId AS INTEGER),
            CAST(sp.personId AS INTEGER),
            CAST(sp.groupId AS INTEGER),
            CAST(sp.performerName AS TEXT)
        ) sp_stats
          ON sp_stats.eventId = CAST(ep.eventId AS INTEGER)
         AND (
           (sp_stats.personId IS NOT NULL AND sp_stats.personId = CAST(ep.personId AS INTEGER))
           OR (sp_stats.groupId IS NOT NULL AND sp_stats.groupId = CAST(ep.groupId AS INTEGER))
           OR (
             sp_stats.personId IS NULL
             AND sp_stats.groupId IS NULL
             AND CAST(ep.personId AS INTEGER) IS NULL
             AND CAST(ep.groupId AS INTEGER) IS NULL
             AND sp_stats.performerName = CAST(ep.performerName AS TEXT)
           )
         )
        LEFT JOIN (
          SELECT
            CAST(sep.eventId AS INTEGER) AS eventId,
            CAST(sep.personId AS INTEGER) AS personId,
            CAST(sep.groupId AS INTEGER) AS groupId,
            CAST(sep.performerName AS TEXT) AS performerName,
            COUNT(DISTINCT CAST(sep.setlistEntryId AS INTEGER)) AS setlistCount
          FROM setlist_entry_performers sep
          GROUP BY
            CAST(sep.eventId AS INTEGER),
            CAST(sep.personId AS INTEGER),
            CAST(sep.groupId AS INTEGER),
            CAST(sep.performerName AS TEXT)
        ) sep_stats
          ON sep_stats.eventId = CAST(ep.eventId AS INTEGER)
         AND (
           (sep_stats.personId IS NOT NULL AND sep_stats.personId = CAST(ep.personId AS INTEGER))
           OR (sep_stats.groupId IS NOT NULL AND sep_stats.groupId = CAST(ep.groupId AS INTEGER))
           OR (
             sep_stats.personId IS NULL
             AND sep_stats.groupId IS NULL
             AND CAST(ep.personId AS INTEGER) IS NULL
             AND CAST(ep.groupId AS INTEGER) IS NULL
             AND sep_stats.performerName = CAST(ep.performerName AS TEXT)
           )
         )
        WHERE CAST(ep.eventId AS INTEGER) = ${safeEventId}
        ORDER BY
          CAST(COALESCE(ep.${hasEventPerformerOrder ? '"order"' : "sortOrder"}, ep.sortOrder, ${SQL_ORDER_FALLBACK}) AS INTEGER) ASC,
          CASE WHEN CAST(ep.personId AS INTEGER) IS NULL AND CAST(ep.groupId AS INTEGER) IS NULL THEN 1 ELSE 0 END ASC,
          COALESCE(CAST(ep.personName AS TEXT), CAST(ep.groupName AS TEXT), CAST(ep.performerName AS TEXT)) ASC
      `);
        const rows = mapPerformerSummaryRows(
            result.toArray() as Array<Record<string, unknown>>,
        );
        const enriched = await enrichPerformerMemberExpansions(conn, rows, {
            kind: "event",
            eventId: safeEventId,
        });
        return reorderGroupMemberIdsForRows(conn, enriched);
    }
    const result = await conn.query(`
    SELECT
      CAST(sep.performerName AS TEXT) AS performerName,
      CAST(NULL AS TEXT) AS memberPersonIdsJson,
      CAST(NULL AS TEXT) AS absencePersonNamesJson,
      CAST(NULL AS TEXT) AS performerRole,
      CAST(NULL AS TEXT) AS note,
      CAST(sep.personId AS INTEGER) AS personId,
      CAST(p.personName AS TEXT) AS personName,
      CAST(sep.groupId AS INTEGER) AS groupId,
      CAST(g.groupName AS TEXT) AS groupName,
      COUNT(DISTINCT CAST(sl.stageId AS INTEGER)) AS stageCount,
      COUNT(DISTINCT CAST(sl.setlistId AS INTEGER)) AS setlistCount
    FROM setlist_entry_performers sep
    JOIN setlists sl
      ON CAST(sl.setlistId AS INTEGER) = CAST(sep.setlistEntryId AS INTEGER)
    LEFT JOIN persons p ON CAST(p.personId AS INTEGER) = CAST(sep.personId AS INTEGER)
    LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(sep.groupId AS INTEGER)
    WHERE CAST(sl.eventId AS INTEGER) = ${safeEventId}
    GROUP BY
      CAST(sep.performerName AS TEXT),
      CAST(sep.personId AS INTEGER),
      CAST(p.personName AS TEXT),
      CAST(sep.groupId AS INTEGER),
      CAST(g.groupName AS TEXT)
    ORDER BY
      CASE WHEN CAST(sep.personId AS INTEGER) IS NULL AND CAST(sep.groupId AS INTEGER) IS NULL THEN 1 ELSE 0 END ASC,
      COALESCE(CAST(p.personName AS TEXT), CAST(g.groupName AS TEXT), CAST(sep.performerName AS TEXT)) ASC
  `);
    return mapPerformerSummaryRows(
        result.toArray() as Array<Record<string, unknown>>,
    );
};

export const getStagePerformers = async (
    conn: duckdb.AsyncDuckDBConnection,
    stageId: number,
): Promise<PerformerSummaryRow[]> => {
    const safeStageId = toSafePositiveInt(stageId);
    const hasStagePerformers = await hasColumn(conn, "stage_performers", "stageId");
    const hasStagePerformerOrder = hasStagePerformers
        ? await hasColumn(conn, "stage_performers", "order")
        : false;
    if (hasStagePerformers) {
        const result = await conn.query(`
        SELECT
          CAST(sp.performerName AS TEXT) AS performerName,
          CAST(sp.memberPersonIdsJson AS TEXT) AS memberPersonIdsJson,
          CAST(sp.absencePersonNamesJson AS TEXT) AS absencePersonNamesJson,
          CAST(sp.performerRole AS TEXT) AS performerRole,
          CAST(sp.note AS TEXT) AS note,
          CAST(sp.personId AS INTEGER) AS personId,
          CAST(sp.personName AS TEXT) AS personName,
          CAST(sp.groupId AS INTEGER) AS groupId,
          CAST(sp.groupName AS TEXT) AS groupName,
          1 AS stageCount,
          CAST(COALESCE(sep_stats.setlistCount, 0) AS INTEGER) AS setlistCount
        FROM stage_performers sp
        LEFT JOIN (
          SELECT
            CAST(sep.stageId AS INTEGER) AS stageId,
            CAST(sep.personId AS INTEGER) AS personId,
            CAST(sep.groupId AS INTEGER) AS groupId,
            CAST(sep.performerName AS TEXT) AS performerName,
            COUNT(DISTINCT CAST(sep.setlistEntryId AS INTEGER)) AS setlistCount
          FROM setlist_entry_performers sep
          GROUP BY
            CAST(sep.stageId AS INTEGER),
            CAST(sep.personId AS INTEGER),
            CAST(sep.groupId AS INTEGER),
            CAST(sep.performerName AS TEXT)
        ) sep_stats
          ON sep_stats.stageId = CAST(sp.stageId AS INTEGER)
         AND (
           (sep_stats.personId IS NOT NULL AND sep_stats.personId = CAST(sp.personId AS INTEGER))
           OR (sep_stats.groupId IS NOT NULL AND sep_stats.groupId = CAST(sp.groupId AS INTEGER))
           OR (
             sep_stats.personId IS NULL
             AND sep_stats.groupId IS NULL
             AND CAST(sp.personId AS INTEGER) IS NULL
             AND CAST(sp.groupId AS INTEGER) IS NULL
             AND sep_stats.performerName = CAST(sp.performerName AS TEXT)
           )
         )
        WHERE CAST(sp.stageId AS INTEGER) = ${safeStageId}
        ORDER BY
          CAST(COALESCE(sp.${hasStagePerformerOrder ? '"order"' : "sortOrder"}, sp.sortOrder, ${SQL_ORDER_FALLBACK}) AS INTEGER) ASC,
          CASE WHEN CAST(sp.personId AS INTEGER) IS NULL AND CAST(sp.groupId AS INTEGER) IS NULL THEN 1 ELSE 0 END ASC,
          COALESCE(CAST(sp.personName AS TEXT), CAST(sp.groupName AS TEXT), CAST(sp.performerName AS TEXT)) ASC
      `);
        const rows = mapPerformerSummaryRows(
            result.toArray() as Array<Record<string, unknown>>,
        );
        const enriched = await enrichPerformerMemberExpansions(conn, rows, {
            kind: "stage",
            stageId: safeStageId,
        });
        return reorderGroupMemberIdsForRows(conn, enriched);
    }
    const result = await conn.query(`
    SELECT
      CAST(sep.performerName AS TEXT) AS performerName,
      CAST(NULL AS TEXT) AS memberPersonIdsJson,
      CAST(NULL AS TEXT) AS absencePersonNamesJson,
      CAST(NULL AS TEXT) AS performerRole,
      CAST(NULL AS TEXT) AS note,
      CAST(sep.personId AS INTEGER) AS personId,
      CAST(p.personName AS TEXT) AS personName,
      CAST(sep.groupId AS INTEGER) AS groupId,
      CAST(g.groupName AS TEXT) AS groupName,
      COUNT(DISTINCT CAST(sl.stageId AS INTEGER)) AS stageCount,
      COUNT(DISTINCT CAST(sl.setlistId AS INTEGER)) AS setlistCount
    FROM setlist_entry_performers sep
    JOIN setlists sl
      ON CAST(sl.setlistId AS INTEGER) = CAST(sep.setlistEntryId AS INTEGER)
    LEFT JOIN persons p ON CAST(p.personId AS INTEGER) = CAST(sep.personId AS INTEGER)
    LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(sep.groupId AS INTEGER)
    WHERE CAST(sl.stageId AS INTEGER) = ${safeStageId}
    GROUP BY
      CAST(sep.performerName AS TEXT),
      CAST(sep.personId AS INTEGER),
      CAST(p.personName AS TEXT),
      CAST(sep.groupId AS INTEGER),
      CAST(g.groupName AS TEXT)
    ORDER BY
      CASE WHEN CAST(sep.personId AS INTEGER) IS NULL AND CAST(sep.groupId AS INTEGER) IS NULL THEN 1 ELSE 0 END ASC,
      COALESCE(CAST(p.personName AS TEXT), CAST(g.groupName AS TEXT), CAST(sep.performerName AS TEXT)) ASC
  `);
    return mapPerformerSummaryRows(
        result.toArray() as Array<Record<string, unknown>>,
    );
};

export const getStageSetlists = async (
    conn: duckdb.AsyncDuckDBConnection,
    stageId: number,
): Promise<SetlistDetail[]> => {
    const safeStageId = toSafePositiveInt(stageId);
    const hasRemarksColumn = await hasColumn(conn, "setlists", "remarks");
    const result = await conn.query(`
    SELECT
      CAST(setlistId AS INTEGER) AS setlistId,
      CAST(stageId AS INTEGER) AS stageId,
      CAST(eventId AS INTEGER) AS eventId,
      CAST(eventName AS TEXT) AS eventName,
      CAST(venueId AS INTEGER) AS venueId,
      CAST(venueName AS TEXT) AS venueName,
      CAST(date AS TEXT) AS date,
      CAST(startTime AS TEXT) AS startTime,
      CAST(musicOrder AS INTEGER) AS musicOrder,
      CAST(section AS TEXT) AS section,
      ${
          hasRemarksColumn
              ? "CAST(remarks AS TEXT) AS remarks,"
              : "CAST(NULL AS TEXT) AS remarks,"
      }
      CAST(displayPerformerName AS TEXT) AS displayPerformerName,
      CAST(songId AS INTEGER) AS songId,
      CAST(songName AS TEXT) AS songName,
      CAST(artistId AS INTEGER) AS artistId,
      CAST(artistName AS TEXT) AS artistName,
      CAST(lyricistName AS TEXT) AS lyricistName,
      CAST(composerName AS TEXT) AS composerName,
      CAST(arrangerName AS TEXT) AS arrangerName,
      CAST(creatorsText AS TEXT) AS creatorsText,
      CAST(eventTagsJson AS TEXT) AS eventTagsJson
    FROM setlists
    WHERE stageId = ${safeStageId}
    ORDER BY musicOrder ASC, setlistId ASC
  `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        setlistId: toInt(row.setlistId),
        stageId: toInt(row.stageId),
        eventId: toInt(row.eventId),
        eventName: toText(row.eventName),
        venueId: toInt(row.venueId),
        venueName: toText(row.venueName),
        date: toText(row.date),
        startTime: row.startTime ? toText(row.startTime) : null,
        musicOrder: toInt(row.musicOrder),
        section: toText(row.section),
        remarks: row.remarks ? toText(row.remarks) : null,
        displayPerformerName: row.displayPerformerName
            ? toText(row.displayPerformerName)
            : null,
        songId: toInt(row.songId),
        songName: toText(row.songName),
        artistId:
            row.artistId === null || row.artistId === undefined
                ? null
                : toInt(row.artistId),
        artistName: row.artistName ? toText(row.artistName) : null,
        lyricistName: row.lyricistName ? toText(row.lyricistName) : null,
        composerName: row.composerName ? toText(row.composerName) : null,
        arrangerName: row.arrangerName ? toText(row.arrangerName) : null,
        creatorsText: row.creatorsText ? toText(row.creatorsText) : null,
        eventTagsJson: toText(row.eventTagsJson || "[]"),
    }));
};

export const getSetlistDetail = async (
    conn: duckdb.AsyncDuckDBConnection,
    setlistId: number,
): Promise<SetlistDetail | null> => {
    const safeSetlistId = toSafePositiveInt(setlistId);
    const result = await conn.query(`
    SELECT
      CAST(setlistId AS INTEGER) AS setlistId,
      CAST(stageId AS INTEGER) AS stageId,
      CAST(eventId AS INTEGER) AS eventId,
      CAST(eventName AS TEXT) AS eventName,
      CAST(venueId AS INTEGER) AS venueId,
      CAST(venueName AS TEXT) AS venueName,
      CAST(date AS TEXT) AS date,
      CAST(startTime AS TEXT) AS startTime,
      CAST(musicOrder AS INTEGER) AS musicOrder,
      CAST(section AS TEXT) AS section,
      CAST(displayPerformerName AS TEXT) AS displayPerformerName,
      CAST(songId AS INTEGER) AS songId,
      CAST(songName AS TEXT) AS songName,
      CAST(artistId AS INTEGER) AS artistId,
      CAST(artistName AS TEXT) AS artistName,
      CAST(lyricistName AS TEXT) AS lyricistName,
      CAST(composerName AS TEXT) AS composerName,
      CAST(arrangerName AS TEXT) AS arrangerName,
      CAST(creatorsText AS TEXT) AS creatorsText,
      CAST(eventTagsJson AS TEXT) AS eventTagsJson
    FROM setlists
    WHERE setlistId = ${safeSetlistId}
    LIMIT 1
  `);
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) {
        return null;
    }
    return {
        setlistId: toInt(row.setlistId),
        stageId: toInt(row.stageId),
        eventId: toInt(row.eventId),
        eventName: toText(row.eventName),
        venueId: toInt(row.venueId),
        venueName: toText(row.venueName),
        date: toText(row.date),
        startTime: row.startTime ? toText(row.startTime) : null,
        musicOrder: toInt(row.musicOrder),
        section: toText(row.section),
        displayPerformerName: row.displayPerformerName
            ? toText(row.displayPerformerName)
            : null,
        songId: toInt(row.songId),
        songName: toText(row.songName),
        artistId:
            row.artistId === null || row.artistId === undefined
                ? null
                : toInt(row.artistId),
        artistName: row.artistName ? toText(row.artistName) : null,
        lyricistName: row.lyricistName ? toText(row.lyricistName) : null,
        composerName: row.composerName ? toText(row.composerName) : null,
        arrangerName: row.arrangerName ? toText(row.arrangerName) : null,
        creatorsText: row.creatorsText ? toText(row.creatorsText) : null,
        eventTagsJson: toText(row.eventTagsJson || "[]"),
    };
};

export const getRelatedSetlistsBySong = async (
    conn: duckdb.AsyncDuckDBConnection,
    songId: number,
    limit?: number,
): Promise<SetlistDetail[]> => {
    const safeSongId = toSafePositiveInt(songId);
    const safeLimit =
        typeof limit === "number" && Number.isFinite(limit) && limit > 0
            ? Math.floor(limit)
            : null;
    const limitClause = safeLimit ? `LIMIT ${safeLimit}` : "";
    const result = await conn.query(`
    SELECT
      CAST(setlistId AS INTEGER) AS setlistId,
      CAST(stageId AS INTEGER) AS stageId,
      CAST(eventId AS INTEGER) AS eventId,
      CAST(eventName AS TEXT) AS eventName,
      CAST(venueId AS INTEGER) AS venueId,
      CAST(venueName AS TEXT) AS venueName,
      CAST(date AS TEXT) AS date,
      CAST(startTime AS TEXT) AS startTime,
      CAST(musicOrder AS INTEGER) AS musicOrder,
      CAST(section AS TEXT) AS section,
      CAST(displayPerformerName AS TEXT) AS displayPerformerName,
      CAST(songId AS INTEGER) AS songId,
      CAST(songName AS TEXT) AS songName,
      CAST(artistId AS INTEGER) AS artistId,
      CAST(artistName AS TEXT) AS artistName,
      CAST(lyricistName AS TEXT) AS lyricistName,
      CAST(composerName AS TEXT) AS composerName,
      CAST(arrangerName AS TEXT) AS arrangerName,
      CAST(creatorsText AS TEXT) AS creatorsText,
      CAST(eventTagsJson AS TEXT) AS eventTagsJson
    FROM setlists
    WHERE songId = ${safeSongId}
    ORDER BY date DESC, setlistId DESC
    ${limitClause}
  `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        setlistId: toInt(row.setlistId),
        stageId: toInt(row.stageId),
        eventId: toInt(row.eventId),
        eventName: toText(row.eventName),
        venueId: toInt(row.venueId),
        venueName: toText(row.venueName),
        date: toText(row.date),
        startTime: row.startTime ? toText(row.startTime) : null,
        musicOrder: toInt(row.musicOrder),
        section: toText(row.section),
        displayPerformerName: row.displayPerformerName
            ? toText(row.displayPerformerName)
            : null,
        songId: toInt(row.songId),
        songName: toText(row.songName),
        artistId:
            row.artistId === null || row.artistId === undefined
                ? null
                : toInt(row.artistId),
        artistName: row.artistName ? toText(row.artistName) : null,
        lyricistName: row.lyricistName ? toText(row.lyricistName) : null,
        composerName: row.composerName ? toText(row.composerName) : null,
        arrangerName: row.arrangerName ? toText(row.arrangerName) : null,
        creatorsText: row.creatorsText ? toText(row.creatorsText) : null,
        eventTagsJson: toText(row.eventTagsJson || "[]"),
    }));
};

export const getSongDetail = async (
    conn: duckdb.AsyncDuckDBConnection,
    songId: number,
): Promise<SongDetail | null> => {
    const safeSongId = toSafePositiveInt(songId);
    const hasDefaultStreamingSongVersionId = await hasColumn(
        conn,
        "songs",
        "defaultStreamingSongVersionId",
    );
    const defaultStreamingSongVersionIdSelect = hasDefaultStreamingSongVersionId
        ? "CAST(defaultStreamingSongVersionId AS INTEGER) AS defaultStreamingSongVersionId,"
        : "CAST(NULL AS INTEGER) AS defaultStreamingSongVersionId,";
    const result = await conn.query(`
    SELECT
      CAST(songId AS INTEGER) AS songId,
      CAST(songName AS TEXT) AS songName,
      CAST(artistId AS INTEGER) AS artistId,
      CAST(artistName AS TEXT) AS artistName,
      ${defaultStreamingSongVersionIdSelect}
      CAST(totalPerformances AS INTEGER) AS totalPerformances,
      CAST(totalStages AS INTEGER) AS totalStages,
      CAST(totalEvents AS INTEGER) AS totalEvents,
      CAST(lastPerformedDate AS TEXT) AS lastPerformedDate
    FROM songs
    WHERE songId = ${safeSongId}
    LIMIT 1
  `);
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) {
        return null;
    }
    return {
        songId: toInt(row.songId),
        songName: toText(row.songName),
        artistId: toInt(row.artistId),
        artistName: toText(row.artistName),
        defaultStreamingSongVersionId:
            row.defaultStreamingSongVersionId === null ||
            row.defaultStreamingSongVersionId === undefined
                ? null
                : toInt(row.defaultStreamingSongVersionId),
        totalPerformances: toInt(row.totalPerformances),
        totalStages: toInt(row.totalStages),
        totalEvents: toInt(row.totalEvents),
        lastPerformedDate: row.lastPerformedDate
            ? toText(row.lastPerformedDate)
            : null,
    };
};

export const getSongSetlists = async (
    conn: duckdb.AsyncDuckDBConnection,
    songId: number,
    limit: number = SONG_SETLIST_LIMIT_MAX,
): Promise<SetlistDetail[]> => {
    return getRelatedSetlistsBySong(conn, songId, limit);
};

export const getSongTopPercentiles = async (
    conn: duckdb.AsyncDuckDBConnection,
    songId: number,
): Promise<SongTopPercentiles | null> => {
    const safeSongId = toSafePositiveInt(songId);
    const fetchByCachedMetrics = async () =>
        conn.query(`
      WITH target AS (
        SELECT
          songId,
          totalPerformances,
          totalEvents,
          totalVenues,
          totalTagKinds
        FROM song_metrics
        WHERE songId = ${safeSongId}
        LIMIT 1
      ),
      summary AS (
        SELECT COUNT(*) AS totalSongs
        FROM song_metrics
      )
      SELECT
        CAST(summary.totalSongs AS INTEGER) AS totalSongs,
        CAST((
          SELECT COUNT(*)
          FROM song_metrics p, target t
          WHERE p.totalPerformances >= t.totalPerformances
        ) AS INTEGER) AS performanceRank,
        CAST((
          SELECT COUNT(*)
          FROM song_metrics p, target t
          WHERE p.totalEvents >= t.totalEvents
        ) AS INTEGER) AS eventRank,
        CAST((
          SELECT COUNT(*)
          FROM song_metrics p, target t
          WHERE p.totalVenues >= t.totalVenues
        ) AS INTEGER) AS venueRank,
        CAST((
          SELECT COUNT(*)
          FROM song_metrics p, target t
          WHERE p.totalTagKinds >= t.totalTagKinds
        ) AS INTEGER) AS tagKindsRank
      FROM summary
      JOIN target ON TRUE
      LIMIT 1
    `);
    const fetchByLegacyScan = async () =>
        conn.query(`
      WITH target_song AS (
        SELECT
          CAST(songId AS INTEGER) AS songId,
          CAST(totalPerformances AS INTEGER) AS totalPerformances,
          CAST(totalEvents AS INTEGER) AS totalEvents
        FROM songs
        WHERE CAST(songId AS INTEGER) = ${safeSongId}
        LIMIT 1
      ),
      venue_counts AS (
        SELECT
          CAST(songId AS INTEGER) AS songId,
          COUNT(DISTINCT CAST(venueId AS INTEGER)) AS totalVenues
        FROM setlists
        GROUP BY CAST(songId AS INTEGER)
      ),
      tag_kinds AS (
        SELECT
          tag_rows.songId AS songId,
          COUNT(DISTINCT tag_rows.tagName) AS totalTagKinds
        FROM (
          SELECT
            CAST(sl.songId AS INTEGER) AS songId,
            trim(BOTH '"' FROM CAST(j.value AS TEXT)) AS tagName
          FROM setlists sl
          CROSS JOIN json_each(TRY_CAST(sl.eventTagsJson AS JSON)) AS j
        ) tag_rows
        WHERE tag_rows.tagName <> ''
          AND lower(tag_rows.tagName) <> 'null'
        GROUP BY tag_rows.songId
      ),
      target AS (
        SELECT
          t.songId AS songId,
          t.totalPerformances AS totalPerformances,
          t.totalEvents AS totalEvents,
          CAST(COALESCE(v.totalVenues, 0) AS INTEGER) AS totalVenues,
          CAST(COALESCE(k.totalTagKinds, 0) AS INTEGER) AS totalTagKinds
        FROM target_song t
        LEFT JOIN venue_counts v ON CAST(v.songId AS INTEGER) = CAST(t.songId AS INTEGER)
        LEFT JOIN tag_kinds k ON CAST(k.songId AS INTEGER) = CAST(t.songId AS INTEGER)
      ),
      population AS (
        SELECT
          CAST(s.songId AS INTEGER) AS songId,
          CAST(s.totalPerformances AS INTEGER) AS totalPerformances,
          CAST(s.totalEvents AS INTEGER) AS totalEvents,
          CAST(COALESCE(v.totalVenues, 0) AS INTEGER) AS totalVenues,
          CAST(COALESCE(k.totalTagKinds, 0) AS INTEGER) AS totalTagKinds
        FROM songs s
        LEFT JOIN venue_counts v ON CAST(v.songId AS INTEGER) = CAST(s.songId AS INTEGER)
        LEFT JOIN tag_kinds k ON CAST(k.songId AS INTEGER) = CAST(s.songId AS INTEGER)
      ),
      summary AS (
        SELECT COUNT(*) AS totalSongs
        FROM population
      )
      SELECT
        CAST(summary.totalSongs AS INTEGER) AS totalSongs,
        CAST((
          SELECT COUNT(*)
          FROM population p, target t
          WHERE p.totalPerformances >= t.totalPerformances
        ) AS INTEGER) AS performanceRank,
        CAST((
          SELECT COUNT(*)
          FROM population p, target t
          WHERE p.totalEvents >= t.totalEvents
        ) AS INTEGER) AS eventRank,
        CAST((
          SELECT COUNT(*)
          FROM population p, target t
          WHERE p.totalVenues >= t.totalVenues
        ) AS INTEGER) AS venueRank,
        CAST((
          SELECT COUNT(*)
          FROM population p, target t
          WHERE p.totalTagKinds >= t.totalTagKinds
        ) AS INTEGER) AS tagKindsRank
      FROM summary
      JOIN target ON TRUE
      LIMIT 1
    `);
    let result: Awaited<ReturnType<typeof fetchByCachedMetrics>>;
    try {
        result = await fetchByCachedMetrics();
    } catch {
        result = await fetchByLegacyScan();
    }
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) {
        return null;
    }
    const totalSongs = Math.max(1, toInt(row.totalSongs));
    const toTopPercent = (rankValue: unknown): number => {
        const safeRank = Math.max(1, toInt(rankValue));
        return (safeRank / totalSongs) * 100;
    };
    return {
        totalSongs,
        performanceRank: Math.max(1, toInt(row.performanceRank)),
        eventRank: Math.max(1, toInt(row.eventRank)),
        venueRank: Math.max(1, toInt(row.venueRank)),
        tagKindsRank: Math.max(1, toInt(row.tagKindsRank)),
        performanceTopPercent: toTopPercent(row.performanceRank),
        eventTopPercent: toTopPercent(row.eventRank),
        venueTopPercent: toTopPercent(row.venueRank),
        tagKindsTopPercent: toTopPercent(row.tagKindsRank),
    };
};

export const getSongVersions = async (
    conn: duckdb.AsyncDuckDBConnection,
    songId: number,
): Promise<SongVersionDetail[]> => {
    const safeSongId = toSafePositiveInt(songId);
    const hasYoutubeId = await hasColumn(conn, "song_versions", "youtubeId");
    const hasYoutubeIdsJson = await hasColumn(
        conn,
        "song_versions",
        "youtubeIdsJson",
    );
    const hasNodeeUrl = await hasColumn(conn, "song_versions", "nodeeUrl");
    const hasLyricistId = await hasColumn(conn, "song_versions", "lyricistId");
    const hasComposerId = await hasColumn(conn, "song_versions", "composerId");
    const hasArrangerId = await hasColumn(conn, "song_versions", "arrangerId");
    const youtubeSelect = hasYoutubeId
        ? "CAST(sv.youtubeId AS TEXT) AS youtubeId,"
        : "CAST(NULL AS TEXT) AS youtubeId,";
    const youtubeIdsJsonSelect = hasYoutubeIdsJson
        ? "CAST(sv.youtubeIdsJson AS TEXT) AS youtubeIdsJson,"
        : "CAST(NULL AS TEXT) AS youtubeIdsJson,";
    const nodeeUrlSelect = hasNodeeUrl
        ? "CAST(sv.nodeeUrl AS TEXT) AS nodeeUrl,"
        : "CAST(NULL AS TEXT) AS nodeeUrl,";
    const lyricistIdSelect = hasLyricistId
        ? "CAST(sv.lyricistId AS INTEGER) AS lyricistId,"
        : "CAST(NULL AS INTEGER) AS lyricistId,";
    const composerIdSelect = hasComposerId
        ? "CAST(sv.composerId AS INTEGER) AS composerId,"
        : "CAST(NULL AS INTEGER) AS composerId,";
    const arrangerIdSelect = hasArrangerId
        ? "CAST(sv.arrangerId AS INTEGER) AS arrangerId,"
        : "CAST(NULL AS INTEGER) AS arrangerId,";

    const result = await conn.query(`
    WITH setlist_counts AS (
      SELECT
        CAST(songName AS TEXT) AS versionName,
        COUNT(*) AS performanceCount
      FROM setlists
      WHERE songId = ${safeSongId}
      GROUP BY CAST(songName AS TEXT)
    ),
    album_counts AS (
      SELECT
        CAST(songVersionId AS INTEGER) AS songVersionId,
        COUNT(*) AS albumTrackCount
      FROM album_tracks
      WHERE songId = ${safeSongId}
        AND songVersionId IS NOT NULL
      GROUP BY CAST(songVersionId AS INTEGER)
    )
    SELECT
      CAST(sv.songVersionId AS INTEGER) AS songVersionId,
      CAST(sv.versionName AS TEXT) AS versionName,
      CAST(sv.artistId AS INTEGER) AS artistId,
      CAST(sv.artistName AS TEXT) AS artistName,
      ${nodeeUrlSelect}
      ${youtubeSelect}
      ${youtubeIdsJsonSelect}
      ${lyricistIdSelect}
      CAST(sv.lyricistName AS TEXT) AS lyricistName,
      ${composerIdSelect}
      CAST(sv.composerName AS TEXT) AS composerName,
      ${arrangerIdSelect}
      CAST(sv.arrangerName AS TEXT) AS arrangerName,
      CAST(COALESCE(sc.performanceCount, 0) AS INTEGER) AS performanceCount,
      CAST(COALESCE(ac.albumTrackCount, 0) AS INTEGER) AS albumTrackCount
    FROM song_versions sv
    LEFT JOIN setlist_counts sc
      ON lower(CAST(sc.versionName AS TEXT)) = lower(CAST(sv.versionName AS TEXT))
    LEFT JOIN album_counts ac
      ON CAST(ac.songVersionId AS INTEGER) = CAST(sv.songVersionId AS INTEGER)
    WHERE sv.songId = ${safeSongId}
    ORDER BY performanceCount DESC, albumTrackCount DESC, sv.songVersionId ASC
  `);

    const mappedRows = (result.toArray() as Array<Record<string, unknown>>).map((row) => {
        const youtubeId = row.youtubeId ? toText(row.youtubeId) : null;
        const youtubeIdsFromJson: string[] = (() => {
            const raw = row.youtubeIdsJson ? toText(row.youtubeIdsJson) : "";
            if (!raw) return [];
            try {
                const parsed = JSON.parse(raw) as unknown;
                if (!Array.isArray(parsed)) return [];
                return parsed
                    .map((item) => String(item ?? "").trim())
                    .filter((item) => item.length > 0);
            } catch {
                return [];
            }
        })();
        const youtubeIds = Array.from(
            new Set(
                [...youtubeIdsFromJson, youtubeId ?? ""].filter(
                    (item) => item.length > 0,
                ),
            ),
        );

        return {
            songVersionId:
                row.songVersionId === null || row.songVersionId === undefined
                    ? null
                    : toInt(row.songVersionId),
            versionName: toText(row.versionName),
            artistId:
                row.artistId === null || row.artistId === undefined
                    ? null
                    : toInt(row.artistId),
            artistName: row.artistName ? toText(row.artistName) : null,
            nodeeUrl: row.nodeeUrl ? toText(row.nodeeUrl) : null,
            youtubeId,
            youtubeIds,
            lyricistId:
                row.lyricistId === null || row.lyricistId === undefined
                    ? null
                    : toInt(row.lyricistId),
            lyricistName: row.lyricistName ? toText(row.lyricistName) : null,
            composerId:
                row.composerId === null || row.composerId === undefined
                    ? null
                    : toInt(row.composerId),
            composerName: row.composerName ? toText(row.composerName) : null,
            arrangerId:
                row.arrangerId === null || row.arrangerId === undefined
                    ? null
                    : toInt(row.arrangerId),
            arrangerName: row.arrangerName ? toText(row.arrangerName) : null,
            performanceCount: toInt(row.performanceCount),
            albumTrackCount: toInt(row.albumTrackCount),
        };
    });

    const deduped = new Map<string, SongVersionDetail>();
    for (const row of mappedRows) {
        const key =
            row.songVersionId !== null
                ? `id:${row.songVersionId}`
                : `name:${row.versionName.toLowerCase()}`;
        const existing = deduped.get(key);
        if (!existing) {
            deduped.set(key, {
                ...row,
                youtubeIds: Array.from(new Set(row.youtubeIds)),
            });
            continue;
        }

        if (!existing.nodeeUrl && row.nodeeUrl) existing.nodeeUrl = row.nodeeUrl;
        if (!existing.youtubeId && row.youtubeId) existing.youtubeId = row.youtubeId;
        if (!existing.artistId && row.artistId) existing.artistId = row.artistId;
        if (!existing.artistName && row.artistName) existing.artistName = row.artistName;
        if (!existing.lyricistId && row.lyricistId) existing.lyricistId = row.lyricistId;
        if (!existing.lyricistName && row.lyricistName) existing.lyricistName = row.lyricistName;
        if (!existing.composerId && row.composerId) existing.composerId = row.composerId;
        if (!existing.composerName && row.composerName) existing.composerName = row.composerName;
        if (!existing.arrangerId && row.arrangerId) existing.arrangerId = row.arrangerId;
        if (!existing.arrangerName && row.arrangerName) existing.arrangerName = row.arrangerName;

        existing.youtubeIds = Array.from(
            new Set([...existing.youtubeIds, ...row.youtubeIds]),
        );
        existing.performanceCount = Math.max(
            existing.performanceCount,
            row.performanceCount,
        );
        existing.albumTrackCount = Math.max(
            existing.albumTrackCount,
            row.albumTrackCount,
        );
    }

    return Array.from(deduped.values());
};

export const getCreatorDetail = async (
    conn: duckdb.AsyncDuckDBConnection,
    creatorId: number,
): Promise<CreatorDetail | null> => {
    const safeCreatorId = toSafePositiveInt(creatorId);
    const result = await conn.query(`
    SELECT
      CAST(creatorId AS INTEGER) AS creatorId,
      CAST(creatorName AS TEXT) AS creatorName,
      CAST(subjectType AS INTEGER) AS subjectType,
      CAST(personId AS INTEGER) AS personId,
      CAST(personName AS TEXT) AS personName,
      CAST(groupId AS INTEGER) AS groupId,
      CAST(groupName AS TEXT) AS groupName
    FROM creator_profiles
    WHERE CAST(creatorId AS INTEGER) = ${safeCreatorId}
    LIMIT 1
  `);
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) {
        return null;
    }
    return {
        creatorId: toInt(row.creatorId),
        creatorName: toText(row.creatorName),
        subjectType: toInt(row.subjectType),
        personId:
            row.personId === null || row.personId === undefined
                ? null
                : toInt(row.personId),
        personName: row.personName ? toText(row.personName) : null,
        groupId:
            row.groupId === null || row.groupId === undefined
                ? null
                : toInt(row.groupId),
        groupName: row.groupName ? toText(row.groupName) : null,
    };
};

export const getCreatorSongsByRole = async (
    conn: duckdb.AsyncDuckDBConnection,
    creatorId: number,
    role: CreatorRole,
    limit: number,
): Promise<CreatorSongRow[]> => {
    const safeCreatorId = toSafePositiveInt(creatorId);
    const safeLimit = clampInt(limit, LIMIT_MIN, SONG_SETLIST_LIMIT_MAX);
    const roleColumn =
        role === "lyricist"
            ? "lyricistId"
            : role === "composer"
              ? "composerId"
              : "arrangerId";
    const hasRoleColumn = await hasColumn(conn, "song_versions", roleColumn);
    if (!hasRoleColumn) {
        return [];
    }
    const result = await conn.query(`
    WITH target_song_ids AS (
      SELECT DISTINCT CAST(songId AS INTEGER) AS songId
      FROM song_versions
      WHERE CAST(${roleColumn} AS INTEGER) = ${safeCreatorId}
    )
    SELECT
      CAST(s.songId AS INTEGER) AS songId,
      CAST(s.songName AS TEXT) AS songName,
      CAST(s.artistId AS INTEGER) AS artistId,
      CAST(s.artistName AS TEXT) AS artistName,
      CAST(s.totalPerformances AS INTEGER) AS totalPerformances,
      CAST(s.lastPerformedDate AS TEXT) AS lastPerformedDate
    FROM songs s
    JOIN target_song_ids t ON t.songId = CAST(s.songId AS INTEGER)
    ORDER BY
      CAST(s.lastPerformedDate AS TEXT) DESC NULLS LAST,
      CAST(s.totalPerformances AS INTEGER) DESC,
      CAST(s.songName AS TEXT) ASC
    LIMIT ${safeLimit}
  `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        songId: toInt(row.songId),
        songName: toText(row.songName),
        artistId: toInt(row.artistId),
        artistName: toText(row.artistName),
        totalPerformances: toInt(row.totalPerformances),
        lastPerformedDate: row.lastPerformedDate
            ? toText(row.lastPerformedDate)
            : null,
    }));
};

export const getArtistDetail = async (
    conn: duckdb.AsyncDuckDBConnection,
    artistId: number,
): Promise<ArtistDetail | null> => {
    const safeArtistId = toSafePositiveInt(artistId);
    const result = await conn.query(`
    SELECT
      CAST(ap.artistId AS INTEGER) AS artistId,
      CAST(ap.artistName AS TEXT) AS artistName,
      CAST(ap.subjectType AS INTEGER) AS subjectType,
      CAST(ap.personId AS INTEGER) AS personId,
      CAST(ap.personName AS TEXT) AS personName,
      CAST(ap.groupId AS INTEGER) AS groupId,
      CAST(ap.groupName AS TEXT) AS groupName,
      COUNT(DISTINCT CAST(s.songId AS INTEGER)) AS totalSongs,
      COALESCE(SUM(CAST(s.totalPerformances AS INTEGER)), 0) AS totalPerformances,
      COALESCE(SUM(CAST(s.totalStages AS INTEGER)), 0) AS totalStages,
      COALESCE(SUM(CAST(s.totalEvents AS INTEGER)), 0) AS totalEvents,
      MAX(CAST(s.lastPerformedDate AS TEXT)) AS lastPerformedDate,
      (
        SELECT COUNT(*)
        FROM albums a
        WHERE a.artistId = ${safeArtistId}
      ) AS totalAlbums
    FROM artist_profiles ap
    LEFT JOIN songs s ON CAST(s.artistId AS INTEGER) = CAST(ap.artistId AS INTEGER)
    WHERE CAST(ap.artistId AS INTEGER) = ${safeArtistId}
    GROUP BY
      CAST(ap.artistId AS INTEGER),
      CAST(ap.artistName AS TEXT),
      CAST(ap.subjectType AS INTEGER),
      CAST(ap.personId AS INTEGER),
      CAST(ap.personName AS TEXT),
      CAST(ap.groupId AS INTEGER),
      CAST(ap.groupName AS TEXT)
    LIMIT 1
  `);

    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) {
        return null;
    }

    return {
        artistId: toInt(row.artistId),
        artistName: toText(row.artistName),
        subjectType: toInt(row.subjectType),
        personId:
            row.personId === null || row.personId === undefined
                ? null
                : toInt(row.personId),
        personName: row.personName ? toText(row.personName) : null,
        groupId:
            row.groupId === null || row.groupId === undefined
                ? null
                : toInt(row.groupId),
        groupName: row.groupName ? toText(row.groupName) : null,
        totalSongs: toInt(row.totalSongs),
        totalAlbums: toInt(row.totalAlbums),
        totalPerformances: toInt(row.totalPerformances),
        totalStages: toInt(row.totalStages),
        totalEvents: toInt(row.totalEvents),
        lastPerformedDate: row.lastPerformedDate ? toText(row.lastPerformedDate) : null,
    };
};

export const getArtistSongs = async (
    conn: duckdb.AsyncDuckDBConnection,
    artistId: number,
    limit: number,
): Promise<SongSearchResponse["rows"]> => {
    const safeArtistId = toSafePositiveInt(artistId);
    const safeLimit = clampInt(limit, LIMIT_MIN, RELATED_EVENT_LIMIT_MAX);
    const result = await conn.query(`
      WITH target_songs AS (
        SELECT songId, songName, artistId, artistName, totalPerformances, totalStages, totalEvents, lastPerformedDate
        FROM songs
        WHERE artistId = ${safeArtistId}
      ),
      target_song_ids AS (
        SELECT songId FROM target_songs
      ),
      creator_agg AS (
        SELECT
          sl.songId AS songId,
          string_agg(DISTINCT CAST(sl.lyricistName AS TEXT), ' / ')
            FILTER (WHERE sl.lyricistName IS NOT NULL AND trim(CAST(sl.lyricistName AS TEXT)) <> '')
            AS lyricistName,
          string_agg(DISTINCT CAST(sl.composerName AS TEXT), ' / ')
            FILTER (WHERE sl.composerName IS NOT NULL AND trim(CAST(sl.composerName AS TEXT)) <> '')
            AS composerName,
          string_agg(DISTINCT CAST(sl.arrangerName AS TEXT), ' / ')
            FILTER (WHERE sl.arrangerName IS NOT NULL AND trim(CAST(sl.arrangerName AS TEXT)) <> '')
            AS arrangerName
        FROM setlists sl
        WHERE sl.songId IN (SELECT songId FROM target_song_ids)
        GROUP BY sl.songId
      ),
      album_agg AS (
        SELECT
          t.songId AS songId,
          MIN(a.albumId) AS firstAlbumId,
          string_agg(DISTINCT CAST(a.albumName AS TEXT), ' / ')
            FILTER (WHERE a.albumName IS NOT NULL AND trim(CAST(a.albumName AS TEXT)) <> '')
            AS albumNames,
          MIN(CAST(a.releaseDate AS TEXT)) AS releaseDate
        FROM album_tracks t
        JOIN albums a ON a.albumId = t.albumId
        WHERE t.songId IN (SELECT songId FROM target_song_ids)
          AND t.songId IS NOT NULL
        GROUP BY t.songId
      )
      SELECT
        CAST(s.songId AS INTEGER) AS songId,
        CAST(s.songName AS TEXT) AS songName,
        CAST(s.artistId AS INTEGER) AS artistId,
        CAST(s.artistName AS TEXT) AS artistName,
        CAST(c.lyricistName AS TEXT) AS lyricistName,
        CAST(c.composerName AS TEXT) AS composerName,
        CAST(c.arrangerName AS TEXT) AS arrangerName,
        CAST(alb.albumNames AS TEXT) AS albumNames,
        CAST(alb.firstAlbumId AS INTEGER) AS firstAlbumId,
        CAST(alb.releaseDate AS TEXT) AS releaseDate,
        CAST(s.totalPerformances AS INTEGER) AS totalPerformances,
        CAST(s.totalStages AS INTEGER) AS totalStages,
        CAST(s.totalEvents AS INTEGER) AS totalEvents,
        CAST(s.lastPerformedDate AS TEXT) AS lastPerformedDate
      FROM target_songs s
      LEFT JOIN creator_agg c ON c.songId = s.songId
      LEFT JOIN album_agg alb ON alb.songId = s.songId
      ORDER BY s.totalPerformances DESC, s.songName ASC
      LIMIT ${safeLimit}
    `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        songId: toInt(row.songId),
        songName: toText(row.songName),
        artistId: toInt(row.artistId),
        artistName: toText(row.artistName),
        lyricistName: row.lyricistName ? toText(row.lyricistName) : null,
        composerName: row.composerName ? toText(row.composerName) : null,
        arrangerName: row.arrangerName ? toText(row.arrangerName) : null,
        albumNames: row.albumNames ? toText(row.albumNames) : null,
        firstAlbumId: row.firstAlbumId ? toInt(row.firstAlbumId) : null,
        releaseDate: row.releaseDate ? toText(row.releaseDate) : null,
        totalPerformances: toInt(row.totalPerformances),
        totalStages: toInt(row.totalStages),
        totalEvents: toInt(row.totalEvents),
        lastPerformedDate: row.lastPerformedDate ? toText(row.lastPerformedDate) : null,
    }));
};

export const getArtistAlbums = async (
    conn: duckdb.AsyncDuckDBConnection,
    artistId: number,
    limit: number,
): Promise<AlbumDetail[]> => {
    const safeArtistId = toSafePositiveInt(artistId);
    const safeLimit = clampInt(limit, LIMIT_MIN, RELATED_EVENT_LIMIT_MAX);
    const result = await conn.query(`
    SELECT
      CAST(albumId AS INTEGER) AS albumId,
      CAST(albumName AS TEXT) AS albumName,
      CAST(category AS INTEGER) AS category,
      CAST(releaseDate AS TEXT) AS releaseDate,
      CAST(artistId AS INTEGER) AS artistId,
      CAST(artistName AS TEXT) AS artistName,
      CAST(trackCount AS INTEGER) AS trackCount
    FROM albums
    WHERE artistId = ${safeArtistId}
    ORDER BY releaseDate DESC, albumId DESC
    LIMIT ${safeLimit}
  `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        albumId: toInt(row.albumId),
        albumName: toText(row.albumName),
        category: toInt(row.category),
        releaseDate: toText(row.releaseDate),
        artistId: toInt(row.artistId),
        artistName: toText(row.artistName),
        trackCount: toInt(row.trackCount),
    }));
};

export const getAlbumDetail = async (
    conn: duckdb.AsyncDuckDBConnection,
    albumId: number,
): Promise<AlbumDetail | null> => {
    const safeAlbumId = toSafePositiveInt(albumId);
    const hasLinkColumn = await hasColumn(conn, "albums", "link");
    const hasPrimaryStreamingSongVersionIdColumn = await hasColumn(
        conn,
        "albums",
        "primaryStreamingSongVersionId",
    );
    const linkSelect = hasLinkColumn
        ? "CAST(link AS TEXT) AS link,"
        : "CAST(NULL AS TEXT) AS link,";
    const primaryStreamingSongVersionIdSelect =
        hasPrimaryStreamingSongVersionIdColumn
            ? "CAST(primaryStreamingSongVersionId AS INTEGER) AS primaryStreamingSongVersionId,"
            : "CAST(NULL AS INTEGER) AS primaryStreamingSongVersionId,";
    const result = await conn.query(`
    SELECT
      CAST(albumId AS INTEGER) AS albumId,
      CAST(albumName AS TEXT) AS albumName,
      CAST(category AS INTEGER) AS category,
      CAST(releaseDate AS TEXT) AS releaseDate,
      CAST(artistId AS INTEGER) AS artistId,
      CAST(artistName AS TEXT) AS artistName,
      ${linkSelect}
      CAST(nodeeUrl AS TEXT) AS nodeeUrl,
      ${primaryStreamingSongVersionIdSelect}
      CAST(trackCount AS INTEGER) AS trackCount
    FROM albums
    WHERE albumId = ${safeAlbumId}
    LIMIT 1
  `);

    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) {
        return null;
    }
    return {
        albumId: toInt(row.albumId),
        albumName: toText(row.albumName),
        category: toInt(row.category),
        releaseDate: toText(row.releaseDate),
        artistId: toInt(row.artistId),
        artistName: toText(row.artistName),
        link: row.link ? toText(row.link) : null,
        nodeeUrl: row.nodeeUrl ? toText(row.nodeeUrl) : null,
        primaryStreamingSongVersionId:
            row.primaryStreamingSongVersionId === null ||
            row.primaryStreamingSongVersionId === undefined
                ? null
                : toInt(row.primaryStreamingSongVersionId),
        trackCount: toInt(row.trackCount),
    };
};

export const getAlbumTracks = async (
    conn: duckdb.AsyncDuckDBConnection,
    albumId: number,
): Promise<AlbumTrack[]> => {
    const safeAlbumId = toSafePositiveInt(albumId);
    const result = await conn.query(`
    SELECT
      CAST(albumTrackId AS INTEGER) AS albumTrackId,
      CAST(albumId AS INTEGER) AS albumId,
      CAST(trackNumber AS INTEGER) AS trackNumber,
      CAST(songVersionId AS INTEGER) AS songVersionId,
      CAST(songId AS INTEGER) AS songId,
      CAST(versionName AS TEXT) AS versionName,
      CAST(songName AS TEXT) AS songName,
      CAST(artistId AS INTEGER) AS artistId,
      CAST(artistName AS TEXT) AS artistName
    FROM album_tracks
    WHERE albumId = ${safeAlbumId}
    ORDER BY trackNumber ASC, albumTrackId ASC, songVersionId ASC
  `);
    const grouped = new Map<number, AlbumTrack>();
    for (const row of result.toArray() as Array<Record<string, unknown>>) {
        const albumTrackId = toInt(row.albumTrackId);
        const songVersionId =
            row.songVersionId === null || row.songVersionId === undefined
                ? null
                : toInt(row.songVersionId);
        const songId =
            row.songId === null || row.songId === undefined
                ? null
                : toInt(row.songId);
        const versionName = row.versionName ? toText(row.versionName) : null;
        const songName = row.songName ? toText(row.songName) : null;
        const artistId =
            row.artistId === null || row.artistId === undefined
                ? null
                : toInt(row.artistId);
        const artistName = row.artistName ? toText(row.artistName) : null;
        const versionEntry = {
            songVersionId,
            songId,
            versionName,
            songName,
            artistId,
            artistName,
        };

        const existing = grouped.get(albumTrackId);
        if (!existing) {
            grouped.set(albumTrackId, {
                albumTrackId,
                albumId: toInt(row.albumId),
                trackNumber: toInt(row.trackNumber),
                songVersionId,
                songId,
                versionName,
                songName,
                artistId,
                artistName,
                songVersions: [versionEntry],
            });
            continue;
        }

        const alreadyExists = existing.songVersions.some(
            (entry) =>
                entry.songVersionId === versionEntry.songVersionId &&
                entry.songId === versionEntry.songId &&
                entry.versionName === versionEntry.versionName &&
                entry.songName === versionEntry.songName &&
                entry.artistId === versionEntry.artistId &&
                entry.artistName === versionEntry.artistName,
        );
        if (!alreadyExists) {
            existing.songVersions.push(versionEntry);
        }
    }
    return Array.from(grouped.values());
};

export const getAlbumsBySong = async (
    conn: duckdb.AsyncDuckDBConnection,
    songId: number,
): Promise<AlbumDetail[]> => {
    const safeSongId = toSafePositiveInt(songId);
    const hasPrimaryStreamingSongVersionIdColumn = await hasColumn(
        conn,
        "albums",
        "primaryStreamingSongVersionId",
    );
    const primaryStreamingSongVersionIdSelect =
        hasPrimaryStreamingSongVersionIdColumn
            ? "CAST(a.primaryStreamingSongVersionId AS INTEGER) AS primaryStreamingSongVersionId,"
            : "CAST(NULL AS INTEGER) AS primaryStreamingSongVersionId,";
    const result = await conn.query(`
    SELECT
      CAST(a.albumId AS INTEGER) AS albumId,
      CAST(a.albumName AS TEXT) AS albumName,
      CAST(a.category AS INTEGER) AS category,
      CAST(a.releaseDate AS TEXT) AS releaseDate,
      CAST(a.artistId AS INTEGER) AS artistId,
      CAST(a.artistName AS TEXT) AS artistName,
      CAST(a.nodeeUrl AS TEXT) AS nodeeUrl,
      ${primaryStreamingSongVersionIdSelect}
      CAST(a.trackCount AS INTEGER) AS trackCount
    FROM albums a
    JOIN album_tracks t ON t.albumId = a.albumId
    WHERE t.songId = ${safeSongId}
    GROUP BY
      a.albumId,
      a.albumName,
      a.category,
      a.releaseDate,
      a.artistId,
      a.artistName,
      a.nodeeUrl,
      a.primaryStreamingSongVersionId,
      a.trackCount
    ORDER BY a.releaseDate DESC, a.albumId DESC
  `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        albumId: toInt(row.albumId),
        albumName: toText(row.albumName),
        category: toInt(row.category),
        releaseDate: toText(row.releaseDate),
        artistId: toInt(row.artistId),
        artistName: toText(row.artistName),
        nodeeUrl: row.nodeeUrl ? toText(row.nodeeUrl) : null,
        primaryStreamingSongVersionId:
            row.primaryStreamingSongVersionId === null ||
            row.primaryStreamingSongVersionId === undefined
                ? null
                : toInt(row.primaryStreamingSongVersionId),
        trackCount: toInt(row.trackCount),
    }));
};

export const getVenueDetail = async (
    conn: duckdb.AsyncDuckDBConnection,
    venueId: number,
): Promise<VenueDetail | null> => {
    const safeVenueId = toSafePositiveInt(venueId);
    const result = await conn.query(`
    SELECT
      CAST(v.venueId AS INTEGER) AS venueId,
      CAST(v.venueName AS TEXT) AS venueName,
      CAST(v.prefectureName AS TEXT) AS prefectureName,
      CAST(v.sittingCapacity AS INTEGER) AS sittingCapacity,
      CAST(v.standingCapacity AS INTEGER) AS standingCapacity,
      COUNT(*) AS totalStages,
      MIN(CAST(s.date AS TEXT)) AS firstDate,
      MAX(CAST(s.date AS TEXT)) AS lastDate
    FROM stages s
    JOIN venues v ON v.venueId = s.venueId
    WHERE s.venueId = ${safeVenueId}
    GROUP BY v.venueId, v.venueName, v.prefectureName, v.sittingCapacity, v.standingCapacity
    LIMIT 1
  `);
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
        venueId: toInt(row.venueId),
        venueName: toText(row.venueName),
        prefectureName: row.prefectureName ? toText(row.prefectureName) : null,
        sittingCapacity:
            row.sittingCapacity === null || row.sittingCapacity === undefined
                ? null
                : toInt(row.sittingCapacity),
        standingCapacity:
            row.standingCapacity === null || row.standingCapacity === undefined
                ? null
                : toInt(row.standingCapacity),
        totalStages: toInt(row.totalStages),
        firstDate: row.firstDate ? toText(row.firstDate) : null,
        lastDate: row.lastDate ? toText(row.lastDate) : null,
    };
};

export const getVenueTopPercentiles = async (
    conn: duckdb.AsyncDuckDBConnection,
    venueId: number,
): Promise<VenueTopPercentiles | null> => {
    const safeVenueId = toSafePositiveInt(venueId);
    const result = await conn.query(`
      WITH venue_stats AS (
        SELECT
          CAST(venueId AS INTEGER) AS venueId,
          COUNT(*) AS totalStages,
          COUNT(DISTINCT CAST(eventId AS INTEGER)) AS totalEvents,
          COALESCE(SUM(CAST(totalPerformances AS INTEGER)), 0) AS totalPerformances
        FROM stages
        GROUP BY CAST(venueId AS INTEGER)
      ),
      target AS (
        SELECT
          CAST(venueId AS INTEGER) AS venueId,
          totalStages,
          totalEvents,
          totalPerformances
        FROM venue_stats
        WHERE CAST(venueId AS INTEGER) = ${safeVenueId}
        LIMIT 1
      ),
      summary AS (
        SELECT COUNT(*) AS totalVenues
        FROM venue_stats
      )
      SELECT
        CAST(summary.totalVenues AS INTEGER) AS totalVenues,
        CAST((
          SELECT COUNT(*)
          FROM venue_stats p, target t
          WHERE p.totalStages >= t.totalStages
        ) AS INTEGER) AS stageRank,
        CAST((
          SELECT COUNT(*)
          FROM venue_stats p, target t
          WHERE p.totalEvents >= t.totalEvents
        ) AS INTEGER) AS eventRank,
        CAST((
          SELECT COUNT(*)
          FROM venue_stats p, target t
          WHERE p.totalPerformances >= t.totalPerformances
        ) AS INTEGER) AS performanceRank
      FROM summary
      JOIN target ON TRUE
      LIMIT 1
    `);

    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) {
        return null;
    }
    const totalVenues = Math.max(1, toInt(row.totalVenues));
    const toTopPercent = (rankValue: unknown): number => {
        const safeRank = Math.max(1, toInt(rankValue));
        return (safeRank / totalVenues) * 100;
    };
    return {
        totalVenues,
        stageRank: Math.max(1, toInt(row.stageRank)),
        eventRank: Math.max(1, toInt(row.eventRank)),
        performanceRank: Math.max(1, toInt(row.performanceRank)),
        stageTopPercent: toTopPercent(row.stageRank),
        eventTopPercent: toTopPercent(row.eventRank),
        performanceTopPercent: toTopPercent(row.performanceRank),
    };
};

export const getVenueStages = async (
    conn: duckdb.AsyncDuckDBConnection,
    venueId: number,
): Promise<StageDetail[]> => {
    const safeVenueId = toSafePositiveInt(venueId);
    const result = await conn.query(`
    WITH ranked_stages AS (
      SELECT
        CAST(s.stageId AS INTEGER) AS stageId,
        CAST(s.eventId AS INTEGER) AS eventId,
        CAST(
          ROW_NUMBER() OVER (
            PARTITION BY CAST(s.eventId AS INTEGER)
            ORDER BY
              CAST(s.date AS TEXT) ASC,
              COALESCE(CAST(s.startTime AS TEXT), '99:99:99') ASC,
              CAST(s.stageId AS INTEGER) ASC
          ) AS INTEGER
        ) AS eventStageNumber,
        CAST(s.eventName AS TEXT) AS eventName,
        CAST(s.venueId AS INTEGER) AS venueId,
        CAST(s.venueName AS TEXT) AS venueName,
        CAST(s.date AS TEXT) AS date,
        CAST(s.startTime AS TEXT) AS startTime,
        CAST(s.pattern AS TEXT) AS pattern,
        CAST(s.cancelled AS BOOLEAN) AS cancelled,
        CAST(s.totalPerformances AS INTEGER) AS totalPerformances,
        CAST(s.eventTagsJson AS TEXT) AS eventTagsJson
      FROM stages s
    )
    SELECT
      rs.stageId AS stageId,
      rs.eventId AS eventId,
      rs.eventStageNumber AS eventStageNumber,
      rs.eventName AS eventName,
      rs.venueId AS venueId,
      rs.venueName AS venueName,
      CAST(v.prefectureName AS TEXT) AS prefectureName,
      rs.date AS date,
      rs.startTime AS startTime,
      rs.pattern AS pattern,
      rs.cancelled AS cancelled,
      rs.totalPerformances AS totalPerformances,
      rs.eventTagsJson AS eventTagsJson
    FROM ranked_stages rs
    LEFT JOIN venues v ON CAST(v.venueId AS INTEGER) = rs.venueId
    WHERE rs.venueId = ${safeVenueId}
    ORDER BY rs.date DESC, rs.stageId DESC
  `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        stageId: toInt(row.stageId),
        eventId: toInt(row.eventId),
        eventStageNumber:
            row.eventStageNumber === null || row.eventStageNumber === undefined
                ? null
                : toInt(row.eventStageNumber),
        eventName: toText(row.eventName),
        venueId: toInt(row.venueId),
        venueName: toText(row.venueName),
        prefectureName: row.prefectureName ? toText(row.prefectureName) : null,
        date: toText(row.date),
        startTime: row.startTime ? toText(row.startTime) : null,
        pattern: row.pattern ? toText(row.pattern) : null,
        cancelled: Boolean(row.cancelled),
        totalPerformances: toInt(row.totalPerformances),
        eventTagsJson: toText(row.eventTagsJson || "[]"),
    }));
};

const escapePattern = (value: string): string => `%${escapeSqlLiteral(value.trim())}%`;
const buildSongMatch = (
    columnExpr: string,
    value: string,
    method: "contains" | "notContains" | "exact" | "notExact" | "startsWith" | "endsWith",
): string => {
    const escaped = escapeSqlLiteral(value.trim());
    if (!escaped) {
        return "";
    }
    if (method === "notContains") {
        return `lower(${columnExpr}) NOT LIKE lower('${escapePattern(value)}')`;
    }
    if (method === "exact") {
        return `lower(${columnExpr}) = lower('${escaped}')`;
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
    return `lower(${columnExpr}) LIKE lower('${escapePattern(value)}')`;
};

const buildSongNameMatch = (
    columnExpr: string,
    value: string,
    method: "contains" | "notContains" | "exact" | "notExact" | "startsWith" | "endsWith",
): string => {
    const compactValue = value.replace(/\s+/gu, "");
    const compactColumn = `regexp_replace(${columnExpr}, '\\s+', '', 'g')`;
    return buildSongMatch(compactColumn, compactValue, method);
};

const buildStatsSetlistWhereClause = (request: Pick<
    SongRankingRequest | StatsSetlistDetailRequest,
    "conditionGroups" | "dateFrom" | "dateTo" | "months" | "monthDays"
>, options?: { artistNameColumn?: string; strictPerformerGroup?: boolean }): string => {
    const conditionGroups = Array.isArray(request.conditionGroups)
        ? request.conditionGroups
        : [];
    const filters: string[] = [
        "s.songId IS NOT NULL",
        "CAST(s.songId AS INTEGER) > 0",
    ];
    const groupExprs: string[] = [];

    for (const group of conditionGroups) {
        const conditions = Array.isArray(group.conditions) ? group.conditions : [];
        const conditionExprs: string[] = [];
        for (const condition of conditions) {
            const value = String(condition.value ?? "").trim();
            if (!value) continue;
            let expr = "";
            if (condition.field === "eventTag") {
                const tagExpr = `COALESCE(CAST(s.eventTagsJson AS TEXT), '') LIKE '%"${escapeSqlLikeLiteral(value)}"%' ESCAPE '\\'`;
                expr = condition.method === "not" ? `NOT (${tagExpr})` : tagExpr;
            } else if (condition.field === "prefectureId") {
                const numericId = Number.parseInt(value, 10);
                if (!Number.isFinite(numericId) || numericId <= 0) continue;
                const prefExpr = `CAST(COALESCE(s.prefectureId, 0) AS INTEGER) = ${Math.trunc(numericId)}`;
                expr = condition.method === "not" ? `NOT (${prefExpr})` : prefExpr;
            } else if (condition.field === "performerAge") {
                const age = Number.parseInt(value, 10);
                if (!Number.isFinite(age) || age < 0 || age > 120) continue;
                const ageExpr = `EXISTS (
                  SELECT 1
                  FROM setlist_entry_performers sep
                  JOIN persons p
                    ON CAST(p.personId AS INTEGER) = CAST(sep.personId AS INTEGER)
                  WHERE CAST(sep.setlistEntryId AS INTEGER) = CAST(s.setlistId AS INTEGER)
                    AND COALESCE(CAST(p.birthday AS TEXT), '') <> ''
                    AND (
                      date_diff('year', CAST(p.birthday AS DATE), CAST(s.date AS DATE))
                      - CASE
                          WHEN strftime(CAST(s.date AS DATE), '%m-%d') < strftime(CAST(p.birthday AS DATE), '%m-%d')
                          THEN 1
                          ELSE 0
                        END
                    ) = ${Math.trunc(age)}
                )`;
                expr = condition.method === "not" ? `NOT (${ageExpr})` : ageExpr;
            } else if (condition.field === "performerGroupName") {
                const method =
                    condition.method === "contains" ||
                    condition.method === "startsWith" ||
                    condition.method === "endsWith" ||
                    condition.method === "exact" ||
                    condition.method === "notContains" ||
                    condition.method === "notExact"
                        ? condition.method
                        : "contains";
                const sepGroupExpr = buildSongMatch("COALESCE(CAST(sep.groupName AS TEXT), '')", value, method);
                const membershipGroupExpr = buildSongMatch("COALESCE(CAST(gm.groupName AS TEXT), '')", value, method);
                const directGroupExpr = `EXISTS (
                  SELECT 1
                  FROM setlist_entry_performers sep
                  WHERE CAST(sep.setlistEntryId AS INTEGER) = CAST(s.setlistId AS INTEGER)
                    AND (${sepGroupExpr})
                )`;
                const groupExpr = options?.strictPerformerGroup ? directGroupExpr : `(${directGroupExpr} OR EXISTS (
                  SELECT 1
                  FROM setlist_entry_performers sep
                  JOIN group_memberships gm
                    ON CAST(gm.personId AS INTEGER) = CAST(sep.personId AS INTEGER)
                  WHERE CAST(sep.setlistEntryId AS INTEGER) = CAST(s.setlistId AS INTEGER)
                    AND (${membershipGroupExpr})
                    AND (
                      CAST(COALESCE(gm.joinDate, '') AS TEXT) = ''
                      OR CAST(gm.joinDate AS TEXT) <= CAST(s.date AS TEXT)
                    )
                    AND (
                      CAST(COALESCE(gm.leaveDate, '') AS TEXT) = ''
                      OR CAST(gm.leaveDate AS TEXT) >= CAST(s.date AS TEXT)
                    )
                ))`;
                expr = condition.method === "not" ? `NOT (${groupExpr})` : groupExpr;
            } else {
                const method =
                    condition.method === "contains" ||
                    condition.method === "startsWith" ||
                    condition.method === "endsWith" ||
                    condition.method === "exact" ||
                    condition.method === "notContains" ||
                    condition.method === "notExact"
                        ? condition.method
                        : "contains";
                const columnExpr = (() => {
                    if (condition.field === "songName") return "COALESCE(CAST(s.songName AS TEXT), '')";
                    if (condition.field === "artistName") {
                        return options?.artistNameColumn ?? "COALESCE(CAST(s.artistName AS TEXT), '')";
                    }
                    if (condition.field === "performerName") return "COALESCE(CAST(s.displayPerformerName AS TEXT), '')";
                    if (condition.field === "eventName") return "COALESCE(CAST(s.eventName AS TEXT), '')";
                    if (condition.field === "venueName") return "COALESCE(CAST(s.venueName AS TEXT), '')";
                    if (condition.field === "section") return "COALESCE(CAST(s.section AS TEXT), '')";
                    if (condition.field === "remarks") return "COALESCE(CAST(s.remarks AS TEXT), '')";
                    if (condition.field === "lyricistName") return "COALESCE(CAST(s.lyricistName AS TEXT), '')";
                    if (condition.field === "composerName") return "COALESCE(CAST(s.composerName AS TEXT), '')";
                    if (condition.field === "arrangerName") return "COALESCE(CAST(s.arrangerName AS TEXT), '')";
                    return "";
                })();
                if (!columnExpr) continue;
                expr = condition.field === "songName"
                    ? buildSongNameMatch(columnExpr, value, method)
                    : buildSongMatch(columnExpr, value, method);
            }
            if (!expr) continue;
            conditionExprs.push(`(${expr})`);
        }
        if (conditionExprs.length === 0) continue;
        const groupJoiner = group.conditionJoin === "or" ? " OR " : " AND ";
        const groupExpr = `(${conditionExprs.join(groupJoiner)})`;
        if (groupExprs.length === 0) {
            groupExprs.push(groupExpr);
        } else {
            const joiner = group.joinWithPrev === "or" ? "OR" : "AND";
            groupExprs.push(`${joiner} ${groupExpr}`);
        }
    }
    if (groupExprs.length > 0) {
        filters.push(`(${groupExprs.join(" ")})`);
    }

    const dateFrom = request.dateFrom.trim();
    const dateTo = request.dateTo.trim();
    if (dateFrom) {
        filters.push(`CAST(s.date AS TEXT) >= '${escapeSqlLiteral(dateFrom)}'`);
    }
    if (dateTo) {
        filters.push(`CAST(s.date AS TEXT) <= '${escapeSqlLiteral(dateTo)}'`);
    }
    const months = Array.isArray(request.months)
        ? [...new Set(request.months.map((month) => Math.trunc(Number(month))).filter((month) => month >= 1 && month <= 12))]
        : [];
    if (months.length > 0) {
        filters.push(`CAST(strftime(CAST(s.date AS DATE), '%m') AS INTEGER) IN (${months.join(",")})`);
    }
    const monthDays = Array.isArray(request.monthDays)
        ? [...new Set(request.monthDays
              .map((monthDay) => String(monthDay ?? "").trim())
              .filter((monthDay) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(monthDay)))]
        : [];
    if (monthDays.length > 0) {
        filters.push(`strftime(CAST(s.date AS DATE), '%m-%d') IN (${monthDays.map((monthDay) => `'${escapeSqlLiteral(monthDay)}'`).join(",")})`);
    }
    return filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
};

export const searchSongs = async (
    conn: duckdb.AsyncDuckDBConnection,
    request: SongSearchRequest,
): Promise<SongSearchResponse> => {
    const hasLyricistId = await hasColumn(conn, "song_versions", "lyricistId");
    const hasComposerId = await hasColumn(conn, "song_versions", "composerId");
    const hasArrangerId = await hasColumn(conn, "song_versions", "arrangerId");
    const lyricistIdSelect = hasLyricistId
        ? "CAST(sv.lyricistId AS INTEGER) AS lyricistId,"
        : "CAST(NULL AS INTEGER) AS lyricistId,";
    const composerIdSelect = hasComposerId
        ? "CAST(sv.composerId AS INTEGER) AS composerId,"
        : "CAST(NULL AS INTEGER) AS composerId,";
    const arrangerIdSelect = hasArrangerId
        ? "CAST(sv.arrangerId AS INTEGER) AS arrangerId,"
        : "CAST(NULL AS INTEGER) AS arrangerId,";

    const page = Math.max(1, request.page);
    const limit = Math.max(1, Math.min(100, request.limit));
    const offset = (page - 1) * limit;
    const term = request.term?.trim() ?? "";
    const songName = request.songName?.trim() ?? "";
    const artistName = request.artistName?.trim() ?? "";
    const lyricistName = request.lyricistName?.trim() ?? "";
    const composerName = request.composerName?.trim() ?? "";
    const arrangerName = request.arrangerName?.trim() ?? "";
    const albumName = request.albumName?.trim() ?? "";
    const songCategories = Array.isArray(request.songCategories)
        ? Array.from(
              new Set(
                  request.songCategories
                      .map((value) => Number(value))
                      .filter((value) => Number.isFinite(value) && value > 0)
                      .map((value) => Math.floor(value)),
              ),
          )
        : [];
    const releaseDateFrom = request.releaseDateFrom?.trim() ?? "";
    const releaseDateTo = request.releaseDateTo?.trim() ?? "";
    const fieldMethods = request.fieldSearchMethods ?? {
        songName: "contains",
        artistName: "contains",
        lyricistName: "contains",
        composerName: "contains",
        arrangerName: "contains",
        albumName: "contains",
    };

    const filters: string[] = [];
    if (term) {
        const termFilter = buildSongMatch(
            `COALESCE(CAST(base.songName AS TEXT), '') || ' ' ||
             COALESCE(CAST(base.artistName AS TEXT), '') || ' ' ||
             COALESCE(CAST(base.lyricistName AS TEXT), '') || ' ' ||
             COALESCE(CAST(base.composerName AS TEXT), '') || ' ' ||
             COALESCE(CAST(base.arrangerName AS TEXT), '') || ' ' ||
             COALESCE(CAST(base.albumNames AS TEXT), '')`,
            term,
            "contains",
        );
        if (termFilter) {
            filters.push(termFilter);
        }
    }

    const songNameFilter = buildSongNameMatch(
        "CAST(base.songName AS TEXT)",
        songName,
        fieldMethods.songName,
    );
    if (songNameFilter) {
        filters.push(songNameFilter);
    }

    const artistFilter = buildSongMatch(
        "CAST(base.artistName AS TEXT)",
        artistName,
        fieldMethods.artistName,
    );
    if (artistFilter) {
        filters.push(artistFilter);
    }

    const lyricistFilter = buildSongMatch(
        "COALESCE(CAST(base.lyricistName AS TEXT), '')",
        lyricistName,
        fieldMethods.lyricistName,
    );
    if (lyricistFilter) {
        filters.push(lyricistFilter);
    }

    const composerFilter = buildSongMatch(
        "COALESCE(CAST(base.composerName AS TEXT), '')",
        composerName,
        fieldMethods.composerName,
    );
    if (composerFilter) {
        filters.push(composerFilter);
    }

    const arrangerFilter = buildSongMatch(
        "COALESCE(CAST(base.arrangerName AS TEXT), '')",
        arrangerName,
        fieldMethods.arrangerName,
    );
    if (arrangerFilter) {
        filters.push(arrangerFilter);
    }

    const albumFilter = buildSongMatch(
        "COALESCE(CAST(base.albumNames AS TEXT), '')",
        albumName,
        fieldMethods.albumName,
    );
    if (albumFilter) {
        filters.push(albumFilter);
    }

    if (songCategories.length > 0) {
        filters.push(
            `CAST(base.songCategory AS INTEGER) IN (${songCategories.join(", ")})`,
        );
    }

    if (releaseDateFrom) {
        filters.push(
            `COALESCE(CAST(base.releaseDate AS TEXT), '') >= '${escapeSqlLiteral(releaseDateFrom)}'`,
        );
    }
    if (releaseDateTo) {
        filters.push(
            `COALESCE(CAST(base.releaseDate AS TEXT), '') <= '${escapeSqlLiteral(releaseDateTo)}'`,
        );
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const orderDirection = request.sortOrder.toUpperCase();
    const orderBy =
        request.sortBy === "artist"
            ? `base.artistName ${orderDirection}, base.songName ASC`
            : request.sortBy === "lyricist"
              ? `base.lyricistName ${orderDirection} NULLS LAST, base.songName ASC`
              : request.sortBy === "composer"
                ? `base.composerName ${orderDirection} NULLS LAST, base.songName ASC`
                : request.sortBy === "arranger"
                  ? `base.arrangerName ${orderDirection} NULLS LAST, base.songName ASC`
              : request.sortBy === "releaseDate"
                    ? `base.releaseDate ${orderDirection} NULLS LAST, base.songName ASC`
            : request.sortBy === "date"
              ? `base.lastPerformedDate ${orderDirection} NULLS LAST, base.songName ASC`
                : `base.songName ${orderDirection}, base.artistName ASC`;

    const baseQuery = `
      SELECT
        CAST(s.songId AS INTEGER) AS songId,
        CAST(s.songName AS TEXT) AS songName,
        CAST(s.songNameSearchKey AS TEXT) AS songNameSearchKey,
        CAST(s.artistId AS INTEGER) AS artistId,
        CAST(s.artistName AS TEXT) AS artistName,
        CAST(c.lyricistId AS INTEGER) AS lyricistId,
        CAST(c.lyricistName AS TEXT) AS lyricistName,
        CAST(c.composerId AS INTEGER) AS composerId,
        CAST(c.composerName AS TEXT) AS composerName,
        CAST(c.arrangerId AS INTEGER) AS arrangerId,
        CAST(c.arrangerName AS TEXT) AS arrangerName,
        CAST(alb.albumNames AS TEXT) AS albumNames,
        CAST(alb.firstAlbumId AS INTEGER) AS firstAlbumId,
        CAST(alb.releaseDate AS TEXT) AS releaseDate,
        CAST(s.songCategory AS INTEGER) AS songCategory,
        CAST(s.totalPerformances AS INTEGER) AS totalPerformances,
        CAST(s.totalStages AS INTEGER) AS totalStages,
        CAST(s.totalEvents AS INTEGER) AS totalEvents,
        CAST(s.lastPerformedDate AS TEXT) AS lastPerformedDate
      FROM songs s
      LEFT JOIN (
        WITH version_release AS (
          SELECT
            CAST(t.songVersionId AS INTEGER) AS songVersionId,
            MIN(CAST(a.releaseDate AS TEXT)) AS releaseDate
          FROM album_tracks t
          JOIN albums a ON CAST(a.albumId AS INTEGER) = CAST(t.albumId AS INTEGER)
          WHERE t.songVersionId IS NOT NULL
          GROUP BY CAST(t.songVersionId AS INTEGER)
        ),
        arranger_stats AS (
          SELECT
            CAST(sv.songId AS INTEGER) AS songId,
            COUNT(DISTINCT NULLIF(trim(CAST(sv.arrangerName AS TEXT)), '')) AS arrangerNameDistinctCount
          FROM song_versions sv
          GROUP BY CAST(sv.songId AS INTEGER)
        ),
        ranked_versions AS (
          SELECT
            CAST(sv.songId AS INTEGER) AS songId,
            CAST(sv.songVersionId AS INTEGER) AS songVersionId,
            ${lyricistIdSelect}
            NULLIF(trim(CAST(sv.lyricistName AS TEXT)), '') AS lyricistName,
            ${composerIdSelect}
            NULLIF(trim(CAST(sv.composerName AS TEXT)), '') AS composerName,
            ${arrangerIdSelect}
            NULLIF(trim(CAST(sv.arrangerName AS TEXT)), '') AS arrangerName,
            CAST(COALESCE(ast.arrangerNameDistinctCount, 0) AS INTEGER) AS arrangerNameDistinctCount,
            ROW_NUMBER() OVER (
              PARTITION BY CAST(sv.songId AS INTEGER)
              ORDER BY
                CASE
                  WHEN vr.releaseDate IS NULL OR trim(CAST(vr.releaseDate AS TEXT)) = ''
                    THEN 1
                  ELSE 0
                END ASC,
                CAST(vr.releaseDate AS TEXT) ASC,
                CAST(sv.songVersionId AS INTEGER) ASC
            ) AS rowNum
          FROM song_versions sv
          LEFT JOIN version_release vr
            ON CAST(vr.songVersionId AS INTEGER) = CAST(sv.songVersionId AS INTEGER)
          LEFT JOIN arranger_stats ast
            ON CAST(ast.songId AS INTEGER) = CAST(sv.songId AS INTEGER)
        )
        SELECT
          songId,
          lyricistId,
          lyricistName,
          composerId,
          composerName,
          arrangerId,
          CASE
            WHEN arrangerNameDistinctCount > 1 AND arrangerName IS NOT NULL THEN arrangerName || '（他）'
            ELSE arrangerName
          END AS arrangerName
        FROM ranked_versions
        WHERE rowNum = 1
      ) c ON CAST(c.songId AS INTEGER) = CAST(s.songId AS INTEGER)
      LEFT JOIN (
        SELECT
          CAST(t.songId AS INTEGER) AS songId,
          MIN(CAST(a.albumId AS INTEGER)) AS firstAlbumId,
          string_agg(DISTINCT CAST(a.albumName AS TEXT), ' / ') FILTER (WHERE a.albumName IS NOT NULL AND trim(CAST(a.albumName AS TEXT)) <> '') AS albumNames,
          MIN(CAST(a.releaseDate AS TEXT)) AS releaseDate
        FROM album_tracks t
        JOIN albums a ON CAST(a.albumId AS INTEGER) = CAST(t.albumId AS INTEGER)
        WHERE t.songId IS NOT NULL
        GROUP BY CAST(t.songId AS INTEGER)
      ) alb ON CAST(alb.songId AS INTEGER) = CAST(s.songId AS INTEGER)
    `;

    const countResult = await conn.query(`
    SELECT COUNT(*) AS total
    FROM (${baseQuery}) base
    ${where}
  `);
    const total = Number((countResult.toArray()[0] as Record<string, unknown>)?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const rowsResult = await conn.query(`
    SELECT
      CAST(songId AS INTEGER) AS songId,
      CAST(songName AS TEXT) AS songName,
      CAST(artistId AS INTEGER) AS artistId,
      CAST(artistName AS TEXT) AS artistName,
      CAST(lyricistId AS INTEGER) AS lyricistId,
      CAST(lyricistName AS TEXT) AS lyricistName,
      CAST(composerId AS INTEGER) AS composerId,
      CAST(composerName AS TEXT) AS composerName,
      CAST(arrangerId AS INTEGER) AS arrangerId,
      CAST(arrangerName AS TEXT) AS arrangerName,
      CAST(albumNames AS TEXT) AS albumNames,
      CAST(firstAlbumId AS INTEGER) AS firstAlbumId,
      CAST(releaseDate AS TEXT) AS releaseDate,
      CAST(totalPerformances AS INTEGER) AS totalPerformances,
      CAST(totalStages AS INTEGER) AS totalStages,
      CAST(totalEvents AS INTEGER) AS totalEvents,
      CAST(lastPerformedDate AS TEXT) AS lastPerformedDate
    FROM (${baseQuery}) base
    ${where}
    ORDER BY ${orderBy}
    LIMIT ${limit}
    OFFSET ${offset}
  `);

    const baseRows = (rowsResult.toArray() as Array<Record<string, unknown>>).map((row) => ({
            songId: toInt(row.songId),
            songName: toText(row.songName),
            artistId: toInt(row.artistId),
            artistName: toText(row.artistName),
            lyricistId:
                row.lyricistId === null || row.lyricistId === undefined
                    ? null
                    : toInt(row.lyricistId),
            lyricistName: row.lyricistName ? toText(row.lyricistName) : null,
            composerId:
                row.composerId === null || row.composerId === undefined
                    ? null
                    : toInt(row.composerId),
            composerName: row.composerName ? toText(row.composerName) : null,
            arrangerId:
                row.arrangerId === null || row.arrangerId === undefined
                    ? null
                    : toInt(row.arrangerId),
            arrangerName: row.arrangerName ? toText(row.arrangerName) : null,
            albumNames: row.albumNames ? toText(row.albumNames) : null,
            firstAlbumId: row.firstAlbumId ? toInt(row.firstAlbumId) : null,
            albumEntries: [],
            releaseDate: row.releaseDate ? toText(row.releaseDate) : null,
            totalPerformances: toInt(row.totalPerformances),
            totalStages: toInt(row.totalStages),
            totalEvents: toInt(row.totalEvents),
            lastPerformedDate: row.lastPerformedDate
                ? toText(row.lastPerformedDate)
                : null,
        }));

    const songIds = baseRows.map((row) => row.songId).filter((id) => Number.isFinite(id) && id > 0);
    const albumEntriesBySongId = new Map<number, Array<{ albumId: number; albumName: string }>>();
    if (songIds.length > 0) {
        const albumEntryResult = await conn.query(`
          SELECT
            CAST(t.songId AS INTEGER) AS songId,
            CAST(a.albumId AS INTEGER) AS albumId,
            CAST(a.albumName AS TEXT) AS albumName,
            MIN(CAST(a.releaseDate AS TEXT)) AS albumReleaseDate
          FROM album_tracks t
          JOIN albums a ON CAST(a.albumId AS INTEGER) = CAST(t.albumId AS INTEGER)
          WHERE t.songId IS NOT NULL
            AND CAST(t.songId AS INTEGER) IN (${songIds.join(",")})
            AND a.albumName IS NOT NULL
            AND trim(CAST(a.albumName AS TEXT)) <> ''
          GROUP BY CAST(t.songId AS INTEGER), CAST(a.albumId AS INTEGER), CAST(a.albumName AS TEXT)
          ORDER BY CAST(t.songId AS INTEGER) ASC, MIN(CAST(a.releaseDate AS TEXT)) ASC, CAST(a.albumId AS INTEGER) ASC
        `);
        for (const row of albumEntryResult.toArray() as Array<Record<string, unknown>>) {
            const songId = toInt(row.songId);
            const albumId = toInt(row.albumId);
            const albumName = toText(row.albumName);
            if (!songId || !albumId || !albumName) continue;
            if (!albumEntriesBySongId.has(songId)) albumEntriesBySongId.set(songId, []);
            albumEntriesBySongId.get(songId)!.push({ albumId, albumName });
        }
    }

    return {
        rows: baseRows.map((row) => ({
            ...row,
            albumEntries: albumEntriesBySongId.get(row.songId) ?? [],
        })),
        total,
        page,
        limit,
        totalPages,
    };
};

export const searchSongVersions = async (
    conn: duckdb.AsyncDuckDBConnection,
    term: string,
    limitInput = 20,
): Promise<import("./types").SongVersionSearchResponse> => {
    const trimmed = term.trim();
    const limit = Math.max(1, Math.min(100, Math.trunc(limitInput)));
    if (!trimmed) {
        return { rows: [], total: 0, page: 1, limit, totalPages: 1 };
    }
    const escaped = escapeSqlLiteral(trimmed);
    const normalized = escapeSqlLiteral(trimmed.normalize("NFKC").toLowerCase());
    const where = `
      WHERE
        CAST(sv.versionName AS TEXT) ILIKE '%' || '${escaped}' || '%'
        OR lower(CAST(sv.versionName AS TEXT)) = '${normalized}'
    `;
    const baseQuery = `
      SELECT
        CAST(sv.songVersionId AS INTEGER) AS songVersionId,
        CAST(sv.versionName AS TEXT) AS versionName,
        CAST(sv.songId AS INTEGER) AS songId,
        CAST(s.songName AS TEXT) AS songName,
        CAST(s.artistId AS INTEGER) AS songArtistId,
        CAST(song_artist.artistName AS TEXT) AS songArtistName,
        CAST(sv.artistId AS INTEGER) AS artistId,
        CAST(version_artist.artistName AS TEXT) AS artistName
      FROM song_versions sv
      LEFT JOIN songs s
        ON CAST(s.songId AS INTEGER) = CAST(sv.songId AS INTEGER)
      LEFT JOIN artist_profiles song_artist
        ON CAST(song_artist.artistId AS INTEGER) = CAST(s.artistId AS INTEGER)
      LEFT JOIN artist_profiles version_artist
        ON CAST(version_artist.artistId AS INTEGER) = CAST(sv.artistId AS INTEGER)
      ${where}
    `;
    const countResult = await conn.query(`
      SELECT COUNT(*) AS total
      FROM (${baseQuery}) base
    `);
    const total = Number((countResult.toArray()[0] as Record<string, unknown>)?.total ?? 0);
    const rowsResult = await conn.query(`
      SELECT *
      FROM (${baseQuery}) base
      ORDER BY
        CASE
          WHEN lower(CAST(versionName AS TEXT)) = '${normalized}' THEN 0
          ELSE 1
        END ASC,
        length(CAST(versionName AS TEXT)) ASC,
        songVersionId ASC
      LIMIT ${limit}
    `);
    const rows = (rowsResult.toArray() as Array<Record<string, unknown>>).map((row) => ({
        songVersionId: toInt(row.songVersionId),
        versionName: toText(row.versionName),
        songId:
            row.songId === null || row.songId === undefined
                ? null
                : toInt(row.songId),
        songName: toText(row.songName),
        songArtistId:
            row.songArtistId === null || row.songArtistId === undefined
                ? null
                : toInt(row.songArtistId),
        songArtistName: toText(row.songArtistName),
        artistId:
            row.artistId === null || row.artistId === undefined
                ? null
                : toInt(row.artistId),
        artistName: toText(row.artistName),
    }));
    return {
        rows,
        total,
        page: 1,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
    };
};

export const searchSongRanking = async (
    conn: duckdb.AsyncDuckDBConnection,
    request: SongRankingRequest,
): Promise<SongRankingResponse> => {
    const page = Math.max(1, request.page);
    const limit = Math.max(1, Math.min(100, request.limit));
    const offset = (page - 1) * limit;
    const conditionGroups = Array.isArray(request.conditionGroups)
        ? request.conditionGroups
        : [];
    const dateFrom = request.dateFrom.trim();
    const dateTo = request.dateTo.trim();
    const sortBy = request.sortBy;
    const sortOrder = request.sortOrder === "asc" ? "ASC" : "DESC";
    const rankingBy:
        | "artist"
        | "song"
        | "performer"
        | "venue"
        | "prefecture"
        | "lyricist"
        | "composer"
        | "arranger" =
        request.rankingBy === "artist" ||
        request.rankingBy === "performer" ||
        request.rankingBy === "venue" ||
        request.rankingBy === "prefecture" ||
        request.rankingBy === "lyricist" ||
        request.rankingBy === "composer" ||
        request.rankingBy === "arranger"
            ? request.rankingBy
            : "song";

    const filters: string[] = [
        "s.songId IS NOT NULL",
        "CAST(s.songId AS INTEGER) > 0",
    ];
    if (rankingBy === "venue") {
        filters.push("s.venueId IS NOT NULL", "CAST(COALESCE(s.venueId, 0) AS INTEGER) > 0");
    }
    if (rankingBy === "prefecture") {
        filters.push("s.prefectureId IS NOT NULL", "CAST(COALESCE(s.prefectureId, 0) AS INTEGER) > 0");
    }
    if (rankingBy === "lyricist") {
        filters.push("TRIM(COALESCE(CAST(s.lyricistName AS TEXT), '')) <> ''");
    }
    if (rankingBy === "composer") {
        filters.push("TRIM(COALESCE(CAST(s.composerName AS TEXT), '')) <> ''");
    }
    if (rankingBy === "arranger") {
        filters.push("TRIM(COALESCE(CAST(s.arrangerName AS TEXT), '')) <> ''");
    }
    const groupExprs: string[] = [];
    for (const group of conditionGroups) {
        const conditions = Array.isArray(group.conditions) ? group.conditions : [];
        const conditionExprs: string[] = [];
        for (const condition of conditions) {
            const value = String(condition.value ?? "").trim();
            if (!value) continue;
            let expr = "";
            if (condition.field === "eventTag") {
                const tagExpr = `COALESCE(CAST(s.eventTagsJson AS TEXT), '') LIKE '%"${escapeSqlLikeLiteral(value)}"%' ESCAPE '\\'`;
                expr = condition.method === "not" ? `NOT (${tagExpr})` : tagExpr;
            } else if (condition.field === "prefectureId") {
                const numericId = Number.parseInt(value, 10);
                if (!Number.isFinite(numericId) || numericId <= 0) continue;
                const prefExpr = `CAST(COALESCE(s.prefectureId, 0) AS INTEGER) = ${Math.trunc(numericId)}`;
                expr = condition.method === "not" ? `NOT (${prefExpr})` : prefExpr;
            } else if (condition.field === "performerGroupName") {
                const method =
                    condition.method === "contains" ||
                    condition.method === "startsWith" ||
                    condition.method === "endsWith" ||
                    condition.method === "exact" ||
                    condition.method === "notContains" ||
                    condition.method === "notExact"
                        ? condition.method
                        : "contains";
                const sepGroupExpr = buildSongMatch("COALESCE(CAST(sep.groupName AS TEXT), '')", value, method);
                const membershipGroupExpr = buildSongMatch("COALESCE(CAST(gm.groupName AS TEXT), '')", value, method);
                const groupExpr = `(EXISTS (
                  SELECT 1
                  FROM setlist_entry_performers sep
                  WHERE CAST(sep.setlistEntryId AS INTEGER) = CAST(s.setlistId AS INTEGER)
                    AND (${sepGroupExpr})
                ) OR EXISTS (
                  SELECT 1
                  FROM setlist_entry_performers sep
                  JOIN group_memberships gm
                    ON CAST(gm.personId AS INTEGER) = CAST(sep.personId AS INTEGER)
                  WHERE CAST(sep.setlistEntryId AS INTEGER) = CAST(s.setlistId AS INTEGER)
                    AND (${membershipGroupExpr})
                    AND (
                      CAST(COALESCE(gm.joinDate, '') AS TEXT) = ''
                      OR CAST(gm.joinDate AS TEXT) <= CAST(s.date AS TEXT)
                    )
                    AND (
                      CAST(COALESCE(gm.leaveDate, '') AS TEXT) = ''
                      OR CAST(gm.leaveDate AS TEXT) >= CAST(s.date AS TEXT)
                    )
                ))`;
                expr = condition.method === "not" ? `NOT (${groupExpr})` : groupExpr;
            } else {
                const method =
                    condition.method === "contains" ||
                    condition.method === "startsWith" ||
                    condition.method === "endsWith" ||
                    condition.method === "exact" ||
                    condition.method === "notContains" ||
                    condition.method === "notExact"
                        ? condition.method
                        : "contains";
                const columnExpr = (() => {
                    if (condition.field === "songName") return "COALESCE(CAST(s.songName AS TEXT), '')";
                    if (condition.field === "artistName") {
                        return rankingBy === "song"
                            ? "COALESCE(CAST(ar_song.artistName AS TEXT), '')"
                            : "COALESCE(CAST(s.artistName AS TEXT), '')";
                    }
                    if (condition.field === "performerName") return "COALESCE(CAST(s.displayPerformerName AS TEXT), '')";
                    if (condition.field === "eventName") return "COALESCE(CAST(s.eventName AS TEXT), '')";
                    if (condition.field === "venueName") return "COALESCE(CAST(s.venueName AS TEXT), '')";
                    if (condition.field === "section") return "COALESCE(CAST(s.section AS TEXT), '')";
                    if (condition.field === "remarks") return "COALESCE(CAST(s.remarks AS TEXT), '')";
                    if (condition.field === "lyricistName") return "COALESCE(CAST(s.lyricistName AS TEXT), '')";
                    if (condition.field === "composerName") return "COALESCE(CAST(s.composerName AS TEXT), '')";
                    if (condition.field === "arrangerName") return "COALESCE(CAST(s.arrangerName AS TEXT), '')";
                    return "";
                })();
                if (!columnExpr) continue;
                expr = condition.field === "songName"
                    ? buildSongNameMatch(columnExpr, value, method)
                    : buildSongMatch(columnExpr, value, method);
            }
            if (!expr) continue;
            conditionExprs.push(`(${expr})`);
        }
        if (conditionExprs.length === 0) continue;
        const groupJoiner = group.conditionJoin === "or" ? " OR " : " AND ";
        const groupExpr = `(${conditionExprs.join(groupJoiner)})`;
        if (groupExprs.length === 0) {
            groupExprs.push(groupExpr);
        } else {
            const joiner = group.joinWithPrev === "or" ? "OR" : "AND";
            groupExprs.push(`${joiner} ${groupExpr}`);
        }
    }
    if (groupExprs.length > 0) {
        filters.push(`(${groupExprs.join(" ")})`);
    }
    if (dateFrom) {
        filters.push(`CAST(s.date AS TEXT) >= '${escapeSqlLiteral(dateFrom)}'`);
    }
    if (dateTo) {
        filters.push(`CAST(s.date AS TEXT) <= '${escapeSqlLiteral(dateTo)}'`);
    }
    const months = Array.isArray(request.months)
        ? [...new Set(request.months.map((month) => Math.trunc(Number(month))).filter((month) => month >= 1 && month <= 12))]
        : [];
    if (months.length > 0) {
        filters.push(`CAST(strftime(CAST(s.date AS DATE), '%m') AS INTEGER) IN (${months.join(",")})`);
    }
    const monthDays = Array.isArray(request.monthDays)
        ? [...new Set(request.monthDays
              .map((monthDay) => String(monthDay ?? "").trim())
              .filter((monthDay) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(monthDay)))]
        : [];
    if (monthDays.length > 0) {
        filters.push(`strftime(CAST(s.date AS DATE), '%m-%d') IN (${monthDays.map((monthDay) => `'${escapeSqlLiteral(monthDay)}'`).join(",")})`);
    }
    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const havingExprs: string[] = [];
    if (Number.isFinite(request.minPerformances) && Number(request.minPerformances) > 0) {
        havingExprs.push(`COUNT(*) >= ${Math.trunc(Number(request.minPerformances))}`);
    }
    if (Number.isFinite(request.minStages) && Number(request.minStages) > 0) {
        havingExprs.push(`COUNT(DISTINCT CAST(s.stageId AS INTEGER)) >= ${Math.trunc(Number(request.minStages))}`);
    }
    if (Number.isFinite(request.minEvents) && Number(request.minEvents) > 0) {
        havingExprs.push(`COUNT(DISTINCT CAST(s.eventId AS INTEGER)) >= ${Math.trunc(Number(request.minEvents))}`);
    }
    const havingClause = havingExprs.length > 0 ? `HAVING ${havingExprs.join(" AND ")}` : "";

    const hasSetlistSongVersionId = await hasColumn(conn, "setlists", "songVersionId");
    const joinSongVersionSql = hasSetlistSongVersionId
        ? "LEFT JOIN song_versions sv ON CAST(sv.songVersionId AS INTEGER) = CAST(s.songVersionId AS INTEGER)"
        : "";
    const joinVersionArtistSql = hasSetlistSongVersionId
        ? "LEFT JOIN artist_profiles ar_ver ON CAST(ar_ver.artistId AS INTEGER) = CAST(sv.artistId AS INTEGER)"
        : "";

    const resolvedArtistIdExpr =
        hasSetlistSongVersionId
            ? "CAST(COALESCE(CAST(ar_set.artistId AS INTEGER), CAST(s.artistId AS INTEGER), CAST(ar_ver.artistId AS INTEGER), CAST(sv.artistId AS INTEGER), CAST(ar_song.artistId AS INTEGER), CAST(so.artistId AS INTEGER), 0) AS INTEGER)"
            : "CAST(COALESCE(CAST(ar_set.artistId AS INTEGER), CAST(s.artistId AS INTEGER), CAST(ar_song.artistId AS INTEGER), CAST(so.artistId AS INTEGER), 0) AS INTEGER)";
    const resolvedArtistNameExpr =
        hasSetlistSongVersionId
            ? "CAST(COALESCE(CAST(ar_set.artistName AS TEXT), CAST(s.artistName AS TEXT), CAST(ar_ver.artistName AS TEXT), CAST(ar_song.artistName AS TEXT), '') AS TEXT)"
            : "CAST(COALESCE(CAST(ar_set.artistName AS TEXT), CAST(s.artistName AS TEXT), CAST(ar_song.artistName AS TEXT), '') AS TEXT)";
    const songArtistIdExpr =
        "CAST(COALESCE(CAST(ar_song.artistId AS INTEGER), CAST(so.artistId AS INTEGER), 0) AS INTEGER)";
    const songArtistNameExpr =
        "CAST(COALESCE(CAST(ar_song.artistName AS TEXT), '') AS TEXT)";
    const rowArtistIdExpr = rankingBy === "song" ? songArtistIdExpr : resolvedArtistIdExpr;
    const rowArtistNameExpr =
        rankingBy === "song" ? songArtistNameExpr : resolvedArtistNameExpr;
    const joinSetlistArtistForGroupedRankingSql =
        rankingBy === "song"
            ? ""
            : "LEFT JOIN artist_profiles ar_set ON CAST(ar_set.artistId AS INTEGER) = CAST(s.artistId AS INTEGER)";
    const joinVersionArtistForGroupedRankingSql =
        rankingBy === "song" ? "" : joinVersionArtistSql;
    const joinPrefectureForGroupedRankingSql =
        rankingBy === "prefecture"
            ? "LEFT JOIN prefectures pr ON CAST(pr.prefectureId AS INTEGER) = CAST(s.prefectureId AS INTEGER)"
            : "";
    const versionFallbackKeyExpr =
        "CAST(COALESCE(CAST(s.artistName AS TEXT), '') AS TEXT) || '|' || CAST(COALESCE(CAST(s.songId AS INTEGER), 0) AS TEXT) || '|' || CAST(COALESCE(CAST(s.songName AS TEXT), '') AS TEXT)";
    const versionUnitKeyExpr = hasSetlistSongVersionId
        ? `CAST(COALESCE('sv:' || CAST(CAST(sv.songVersionId AS INTEGER) AS TEXT), 'sl:' || ${versionFallbackKeyExpr}) AS TEXT)`
        : `CAST('sl:' || ${versionFallbackKeyExpr} AS TEXT)`;

    const groupKeyExpr =
        rankingBy === "artist"
            ? resolvedArtistIdExpr
            : rankingBy === "performer"
              ? "COALESCE(CAST(s.displayPerformerName AS TEXT), '')"
              : rankingBy === "venue"
                ? "CAST(COALESCE(CAST(s.venueId AS INTEGER), 0) AS INTEGER)"
                : rankingBy === "prefecture"
                  ? "CAST(COALESCE(CAST(s.prefectureId AS INTEGER), 0) AS INTEGER)"
                : rankingBy === "lyricist"
                  ? "COALESCE(CAST(s.lyricistName AS TEXT), '')"
                  : rankingBy === "composer"
                    ? "COALESCE(CAST(s.composerName AS TEXT), '')"
                    : rankingBy === "arranger"
                      ? "COALESCE(CAST(s.arrangerName AS TEXT), '')"
              : "CAST(s.songId AS INTEGER)";
    const entityNameExpr =
        rankingBy === "artist"
            ? `CAST(COALESCE(MAX(${resolvedArtistNameExpr}), '') AS TEXT)`
            : rankingBy === "performer"
              ? "CAST(COALESCE(CAST(s.displayPerformerName AS TEXT), '') AS TEXT)"
              : rankingBy === "venue"
                ? "CAST(COALESCE(MAX(CAST(s.venueName AS TEXT)), '') AS TEXT)"
                : rankingBy === "prefecture"
                  ? "CAST(COALESCE(MAX(CAST(pr.prefectureName AS TEXT)), '') AS TEXT)"
                : rankingBy === "lyricist"
                  ? "CAST(COALESCE(CAST(s.lyricistName AS TEXT), '') AS TEXT)"
                  : rankingBy === "composer"
                    ? "CAST(COALESCE(CAST(s.composerName AS TEXT), '') AS TEXT)"
                    : rankingBy === "arranger"
                      ? "CAST(COALESCE(CAST(s.arrangerName AS TEXT), '') AS TEXT)"
              : "CAST(COALESCE(MAX(CAST(so.songName AS TEXT)), MAX(CAST(s.songName AS TEXT))) AS TEXT)";
    const entityIdExpr =
        rankingBy === "artist"
            ? `CAST(COALESCE(MAX(${resolvedArtistIdExpr}), 0) AS INTEGER)`
            : rankingBy === "performer" ||
                rankingBy === "lyricist" ||
                rankingBy === "composer" ||
                rankingBy === "arranger"
              ? "NULL"
              : rankingBy === "venue"
                ? "CAST(COALESCE(MAX(CAST(s.venueId AS INTEGER)), 0) AS INTEGER)"
                : rankingBy === "prefecture"
                  ? "CAST(COALESCE(MAX(CAST(s.prefectureId AS INTEGER)), 0) AS INTEGER)"
              : "CAST(COALESCE(MAX(CAST(so.songId AS INTEGER)), MAX(CAST(s.songId AS INTEGER))) AS INTEGER)";
    const representativeSongIdExpr =
        rankingBy === "song"
            ? "CAST(COALESCE(MAX(CAST(so.songId AS INTEGER)), MAX(CAST(s.songId AS INTEGER))) AS INTEGER)"
            : "CAST(NULL AS INTEGER)";
    const representativeSongNameExpr =
        rankingBy === "song"
            ? "CAST(COALESCE(MAX(CAST(so.songName AS TEXT)), MAX(CAST(s.songName AS TEXT))) AS TEXT)"
            : "CAST(NULL AS TEXT)";
    const representativeArtistIdExpr =
        rankingBy === "song"
            ? `CAST(COALESCE(MAX(${rowArtistIdExpr}), 0) AS INTEGER)`
            : "CAST(NULL AS INTEGER)";
    const representativeArtistNameExpr =
        rankingBy === "song"
            ? `CAST(COALESCE(MAX(${rowArtistNameExpr}), '') AS TEXT)`
            : "CAST(NULL AS TEXT)";

    const orderBy = (() => {
        const nameCol = "entityName";
        const idCol = "entityId";
        if (sortBy === "song") {
            return `${nameCol} ${sortOrder}, totalPerformances DESC, ${idCol} ASC`;
        }
        if (sortBy === "artist") {
            if (rankingBy === "song") {
                return `artistName ${sortOrder}, ${nameCol} ASC, totalPerformances DESC, ${idCol} ASC`;
            }
            return `${nameCol} ${sortOrder}, totalPerformances DESC, ${idCol} ASC`;
        }
        if (sortBy === "stages") {
            return `totalStages ${sortOrder}, totalPerformances DESC, ${nameCol} ASC, ${idCol} ASC`;
        }
        if (sortBy === "events") {
            return `totalEvents ${sortOrder}, totalPerformances DESC, ${nameCol} ASC, ${idCol} ASC`;
        }
        if (sortBy === "lastDate") {
            return `lastPerformedDate ${sortOrder}, totalPerformances DESC, ${nameCol} ASC, ${idCol} ASC`;
        }
        return `totalPerformances ${sortOrder}, totalStages DESC, ${nameCol} ASC, ${idCol} ASC`;
    })();

    if (rankingBy === "artist") {
        const artistCountResult = await conn.query(`
          WITH ranked_source AS (
            SELECT
              ${resolvedArtistIdExpr} AS resolvedArtistId,
              ${resolvedArtistNameExpr} AS resolvedArtistName,
              ${versionUnitKeyExpr} AS versionUnitKey,
              CAST(s.stageId AS INTEGER) AS stageId,
              CAST(s.eventId AS INTEGER) AS eventId,
              CAST(s.date AS TEXT) AS playedDate
            FROM setlists s
            ${joinSongVersionSql}
            LEFT JOIN songs so ON CAST(so.songId AS INTEGER) = CAST(s.songId AS INTEGER)
            LEFT JOIN artist_profiles ar_set ON CAST(ar_set.artistId AS INTEGER) = CAST(s.artistId AS INTEGER)
            ${joinVersionArtistSql}
            LEFT JOIN artist_profiles ar_song ON CAST(ar_song.artistId AS INTEGER) = CAST(so.artistId AS INTEGER)
            ${whereClause}
          )
          SELECT COUNT(*) AS total
          FROM (
            SELECT resolvedArtistId
            FROM ranked_source
            GROUP BY resolvedArtistId
            ${havingExprs.length > 0
                ? `HAVING ${havingExprs
                      .map((expr) =>
                          expr
                              .replaceAll("s.stageId", "stageId")
                              .replaceAll("s.eventId", "eventId"),
                      )
                      .join(" AND ")}`
                : ""}
          ) t
        `);
        const total = toInt((artistCountResult.toArray()[0] as Record<string, unknown> | undefined)?.total);
        const totalPages = Math.max(1, Math.ceil(total / limit));

        const artistResult = await conn.query(`
          WITH ranked_source AS (
            SELECT
              ${resolvedArtistIdExpr} AS resolvedArtistId,
              ${resolvedArtistNameExpr} AS resolvedArtistName,
              ${versionUnitKeyExpr} AS versionUnitKey,
              CAST(s.stageId AS INTEGER) AS stageId,
              CAST(s.eventId AS INTEGER) AS eventId,
              CAST(s.date AS TEXT) AS playedDate
            FROM setlists s
            ${joinSongVersionSql}
            LEFT JOIN songs so ON CAST(so.songId AS INTEGER) = CAST(s.songId AS INTEGER)
            LEFT JOIN artist_profiles ar_set ON CAST(ar_set.artistId AS INTEGER) = CAST(s.artistId AS INTEGER)
            ${joinVersionArtistSql}
            LEFT JOIN artist_profiles ar_song ON CAST(ar_song.artistId AS INTEGER) = CAST(so.artistId AS INTEGER)
            ${whereClause}
          )
          SELECT
            CAST(resolvedArtistId AS INTEGER) AS entityId,
            CAST(MAX(resolvedArtistName) AS TEXT) AS entityName,
            CAST(NULL AS INTEGER) AS songId,
            CAST(NULL AS TEXT) AS songName,
            CAST(resolvedArtistId AS INTEGER) AS artistId,
            CAST(MAX(resolvedArtistName) AS TEXT) AS artistName,
            CAST(COUNT(*) AS INTEGER) AS totalPerformances,
            CAST(COUNT(DISTINCT eventId) AS INTEGER) AS totalEvents,
            CAST(COUNT(DISTINCT stageId) AS INTEGER) AS totalStages,
            CAST(MAX(playedDate) AS TEXT) AS lastPerformedDate
          FROM ranked_source
          GROUP BY resolvedArtistId
          ${havingExprs.length > 0
              ? `HAVING ${havingExprs
                    .map((expr) =>
                        expr
                            .replaceAll("s.stageId", "stageId")
                            .replaceAll("s.eventId", "eventId"),
                    )
                    .join(" AND ")}`
              : ""}
          ORDER BY ${orderBy}
          LIMIT ${limit}
          OFFSET ${offset}
        `);

        const rows = (artistResult.toArray() as Array<Record<string, unknown>>).map((row, index) => ({
            rank: offset + index + 1,
            entityType: rankingBy,
            entityId:
                row.entityId === null || row.entityId === undefined
                    ? null
                    : toInt(row.entityId),
            entityName: toText(row.entityName),
            songId: row.songId === null || row.songId === undefined ? null : toInt(row.songId),
            songName: row.songName === null || row.songName === undefined ? null : toText(row.songName),
            artistId:
                row.artistId === null || row.artistId === undefined ? null : toInt(row.artistId),
            artistName:
                row.artistName === null || row.artistName === undefined
                    ? null
                    : toText(row.artistName),
            totalPerformances: toInt(row.totalPerformances),
            totalStages: toInt(row.totalStages),
            totalEvents: toInt(row.totalEvents),
            lastPerformedDate: row.lastPerformedDate ? toText(row.lastPerformedDate) : null,
        }));

        return {
            rows,
            total,
            page,
            limit,
            totalPages,
        };
    }

    const countResult = await conn.query(`
      SELECT COUNT(*) AS total
      FROM (
        SELECT ${groupKeyExpr} AS groupKey
        FROM setlists s
        ${joinSongVersionSql}
        LEFT JOIN songs so ON CAST(so.songId AS INTEGER) = CAST(s.songId AS INTEGER)
        ${joinSetlistArtistForGroupedRankingSql}
        ${joinVersionArtistForGroupedRankingSql}
        ${joinPrefectureForGroupedRankingSql}
        LEFT JOIN artist_profiles ar_song ON CAST(ar_song.artistId AS INTEGER) = CAST(so.artistId AS INTEGER)
        ${whereClause}
        GROUP BY ${groupKeyExpr}
        ${havingClause}
      ) t
    `);
    const total = toInt((countResult.toArray()[0] as Record<string, unknown> | undefined)?.total);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const result = await conn.query(`
      SELECT
        ${entityIdExpr} AS entityId,
        ${entityNameExpr} AS entityName,
        ${representativeSongIdExpr} AS songId,
        ${representativeSongNameExpr} AS songName,
        ${representativeArtistIdExpr} AS artistId,
        ${representativeArtistNameExpr} AS artistName,
        CAST(COUNT(*) AS INTEGER) AS totalPerformances,
        CAST(COUNT(DISTINCT CAST(s.stageId AS INTEGER)) AS INTEGER) AS totalStages,
        CAST(COUNT(DISTINCT CAST(s.eventId AS INTEGER)) AS INTEGER) AS totalEvents,
        CAST(MAX(CAST(s.date AS TEXT)) AS TEXT) AS lastPerformedDate
      FROM setlists s
      ${joinSongVersionSql}
      LEFT JOIN songs so ON CAST(so.songId AS INTEGER) = CAST(s.songId AS INTEGER)
      ${joinSetlistArtistForGroupedRankingSql}
      ${joinVersionArtistForGroupedRankingSql}
      ${joinPrefectureForGroupedRankingSql}
      LEFT JOIN artist_profiles ar_song ON CAST(ar_song.artistId AS INTEGER) = CAST(so.artistId AS INTEGER)
      ${whereClause}
      GROUP BY ${groupKeyExpr}
      ${havingClause}
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const rows = (result.toArray() as Array<Record<string, unknown>>).map((row, index) => ({
        rank: offset + index + 1,
        entityType: rankingBy,
        entityId:
            row.entityId === null || row.entityId === undefined
                ? null
                : toInt(row.entityId),
        entityName: toText(row.entityName),
        songId: row.songId === null || row.songId === undefined ? null : toInt(row.songId),
        songName: row.songName === null || row.songName === undefined ? null : toText(row.songName),
        artistId:
            row.artistId === null || row.artistId === undefined ? null : toInt(row.artistId),
        artistName:
            row.artistName === null || row.artistName === undefined
                ? null
                : toText(row.artistName),
        totalPerformances: toInt(row.totalPerformances),
        totalStages: toInt(row.totalStages),
        totalEvents: toInt(row.totalEvents),
        lastPerformedDate: row.lastPerformedDate ? toText(row.lastPerformedDate) : null,
    }));

    return {
        rows,
        total,
        page,
        limit,
        totalPages,
    };
};

export const searchStatsSetlistDetails = async (
    conn: duckdb.AsyncDuckDBConnection,
    request: StatsSetlistDetailRequest,
): Promise<StatsSetlistDetailResponse> => {
    const page = Math.max(1, request.page);
    const limit = Math.max(1, Math.min(100, request.limit));
    const offset = (page - 1) * limit;
    const sortOrder = request.sortOrder === "asc" ? "ASC" : "DESC";
    const hasSetlistSongVersionId = await hasColumn(conn, "setlists", "songVersionId");
    const joinSongVersionSql = hasSetlistSongVersionId
        ? "LEFT JOIN song_versions sv ON CAST(sv.songVersionId AS INTEGER) = CAST(s.songVersionId AS INTEGER)"
        : "";
    const joinVersionArtistSql = hasSetlistSongVersionId
        ? "LEFT JOIN artist_profiles ar_ver ON CAST(ar_ver.artistId AS INTEGER) = CAST(sv.artistId AS INTEGER)"
        : "";
    const resolvedArtistIdExpr =
        hasSetlistSongVersionId
            ? "CAST(COALESCE(CAST(ar_set.artistId AS INTEGER), CAST(s.artistId AS INTEGER), CAST(ar_ver.artistId AS INTEGER), CAST(sv.artistId AS INTEGER), CAST(ar_song.artistId AS INTEGER), CAST(so.artistId AS INTEGER), 0) AS INTEGER)"
            : "CAST(COALESCE(CAST(ar_set.artistId AS INTEGER), CAST(s.artistId AS INTEGER), CAST(ar_song.artistId AS INTEGER), CAST(so.artistId AS INTEGER), 0) AS INTEGER)";
    const resolvedArtistNameExpr =
        hasSetlistSongVersionId
            ? "CAST(COALESCE(CAST(ar_set.artistName AS TEXT), CAST(s.artistName AS TEXT), CAST(ar_ver.artistName AS TEXT), CAST(ar_song.artistName AS TEXT), '') AS TEXT)"
            : "CAST(COALESCE(CAST(ar_set.artistName AS TEXT), CAST(s.artistName AS TEXT), CAST(ar_song.artistName AS TEXT), '') AS TEXT)";
    const whereClause = buildStatsSetlistWhereClause(request, {
        artistNameColumn: resolvedArtistNameExpr,
        strictPerformerGroup: request.distinctBy === "song",
    });

    const fromSql = `
      FROM setlists s
      ${joinSongVersionSql}
      LEFT JOIN songs so ON CAST(so.songId AS INTEGER) = CAST(s.songId AS INTEGER)
      LEFT JOIN artist_profiles ar_set ON CAST(ar_set.artistId AS INTEGER) = CAST(s.artistId AS INTEGER)
      ${joinVersionArtistSql}
      LEFT JOIN artist_profiles ar_song ON CAST(ar_song.artistId AS INTEGER) = CAST(so.artistId AS INTEGER)
      ${whereClause}
    `;

    if (request.distinctBy === "member") {
        const ageCondition = request.conditionGroups.flatMap((group) => group.conditions)
            .find((condition) => condition.field === "performerAge");
        const age = Number.parseInt(ageCondition?.value ?? "", 10);
        const memberAgeSql = Number.isFinite(age)
            ? `AND (
                date_diff('year', TRY_CAST(CAST(p.birthday AS TEXT) AS DATE), TRY_CAST(CAST(s.date AS TEXT) AS DATE))
                - CASE WHEN strftime(TRY_CAST(CAST(s.date AS TEXT) AS DATE), '%m-%d') < strftime(TRY_CAST(CAST(p.birthday AS TEXT) AS DATE), '%m-%d') THEN 1 ELSE 0 END
              ) = ${Math.trunc(age)}`
            : "";
        const helloMemberAtPerformanceSql = `AND (
          EXISTS (
            SELECT 1 FROM artist_profiles ap_person
            WHERE CAST(ap_person.personId AS INTEGER) = CAST(p.personId AS INTEGER)
              AND COALESCE(CAST(ap_person.isHello AS BOOLEAN), FALSE)
          )
          OR EXISTS (
            SELECT 1
            FROM group_memberships gm_hello
            JOIN artist_profiles ap_group
              ON CAST(ap_group.groupId AS INTEGER) = CAST(gm_hello.groupId AS INTEGER)
             AND COALESCE(CAST(ap_group.isHello AS BOOLEAN), FALSE)
            WHERE CAST(gm_hello.personId AS INTEGER) = CAST(p.personId AS INTEGER)
              AND (COALESCE(CAST(gm_hello.joinDate AS TEXT), '') = '' OR CAST(gm_hello.joinDate AS TEXT) <= CAST(s.date AS TEXT))
              AND (COALESCE(CAST(gm_hello.leaveDate AS TEXT), '') = '' OR CAST(gm_hello.leaveDate AS TEXT) >= CAST(s.date AS TEXT))
          )
        )`;
        const memberStatusSql = request.memberScope === "currentHello"
            ? `${helloMemberAtPerformanceSql} AND COALESCE(CAST(p.memberStatus AS TEXT), '') = 'activeHello'`
            : request.memberScope === "currentHelloAndTrainees"
              ? `${helloMemberAtPerformanceSql} AND COALESCE(CAST(p.memberStatus AS TEXT), '') IN ('activeHello', 'trainee')`
              : request.memberScope === "helloOg"
                ? `${helloMemberAtPerformanceSql} AND COALESCE(CAST(p.memberStatus AS TEXT), '') = 'helloOg'`
                : request.memberScope === "all"
                  ? ""
                  : helloMemberAtPerformanceSql;
        const memberRequest = {
            ...request,
            conditionGroups: request.conditionGroups.map((group) => ({
                ...group,
                conditions: group.conditions.filter((condition) => condition.field !== "performerAge"),
            })),
        };
        const memberWhereClause = buildStatsSetlistWhereClause(memberRequest, {
            artistNameColumn: resolvedArtistNameExpr,
        });
        const memberCteSql = `WITH display_performer_tokens AS (
            SELECT
              CAST(s_display.setlistId AS INTEGER) AS setlistEntryId,
              CAST(s_display.date AS TEXT) AS performanceDate,
              regexp_replace(TRIM(token), '[（(][0-9]+人[）)]', '', 'g') AS performerToken
            FROM setlists s_display
            CROSS JOIN UNNEST(regexp_split_to_array(
              COALESCE(CAST(s_display.displayPerformerName AS TEXT), ''),
              '[・、,＆&/／\u3000×xX]+'
            )) AS split_tokens(token)
            WHERE COALESCE(TRIM(CAST(s_display.displayPerformerName AS TEXT)), '') <> ''
              AND NOT EXISTS (
                SELECT 1 FROM setlist_entry_performers sep_present
                WHERE CAST(sep_present.setlistEntryId AS INTEGER) = CAST(s_display.setlistId AS INTEGER)
              )
          ), resolved_setlist_members AS (
            SELECT DISTINCT
              CAST(sep_direct.setlistEntryId AS INTEGER) AS setlistEntryId,
              CAST(sep_direct.personId AS INTEGER) AS personId
            FROM setlist_entry_performers sep_direct
            WHERE sep_direct.personId IS NOT NULL

            UNION

            SELECT DISTINCT
              CAST(sep_group.setlistEntryId AS INTEGER) AS setlistEntryId,
              CAST(gm.personId AS INTEGER) AS personId
            FROM setlist_entry_performers sep_group
            JOIN setlists s_group
              ON CAST(s_group.setlistId AS INTEGER) = CAST(sep_group.setlistEntryId AS INTEGER)
            JOIN group_memberships gm
              ON (
                (sep_group.groupId IS NOT NULL AND CAST(gm.groupId AS INTEGER) = CAST(sep_group.groupId AS INTEGER))
                OR (
                  sep_group.groupId IS NULL
                  AND COALESCE(CAST(sep_group.groupName AS TEXT), '') <> ''
                  AND CAST(gm.groupName AS TEXT) = CAST(sep_group.groupName AS TEXT)
                )
              )
             AND (COALESCE(CAST(gm.joinDate AS TEXT), '') = '' OR CAST(gm.joinDate AS TEXT) <= CAST(s_group.date AS TEXT))
             AND (COALESCE(CAST(gm.leaveDate AS TEXT), '') = '' OR CAST(gm.leaveDate AS TEXT) >= CAST(s_group.date AS TEXT))
            WHERE sep_group.personId IS NULL

            UNION

            SELECT DISTINCT
              dpt.setlistEntryId,
              CAST(p_display.personId AS INTEGER) AS personId
            FROM display_performer_tokens dpt
            JOIN persons p_display
              ON replace(CAST(p_display.personName AS TEXT), '﨑', '崎')
               = replace(dpt.performerToken, '﨑', '崎')

            UNION

            SELECT DISTINCT
              dpt.setlistEntryId,
              CAST(gm_display.personId AS INTEGER) AS personId
            FROM display_performer_tokens dpt
            JOIN groups g_display
              ON CAST(g_display.groupName AS TEXT) = dpt.performerToken
            JOIN group_memberships gm_display
              ON CAST(gm_display.groupId AS INTEGER) = CAST(g_display.groupId AS INTEGER)
             AND (COALESCE(CAST(gm_display.joinDate AS TEXT), '') = '' OR CAST(gm_display.joinDate AS TEXT) <= dpt.performanceDate)
             AND (COALESCE(CAST(gm_display.leaveDate AS TEXT), '') = '' OR CAST(gm_display.leaveDate AS TEXT) >= dpt.performanceDate)

            UNION

            SELECT DISTINCT
              dpt.setlistEntryId,
              CAST(gm_alias.personId AS INTEGER) AS personId
            FROM display_performer_tokens dpt
            JOIN group_aliases ga_display
              ON CAST(ga_display.aliasName AS TEXT) = dpt.performerToken
             AND (COALESCE(CAST(ga_display.startDate AS TEXT), '') = '' OR CAST(ga_display.startDate AS TEXT) <= dpt.performanceDate)
             AND (COALESCE(CAST(ga_display.endDate AS TEXT), '') = '' OR CAST(ga_display.endDate AS TEXT) >= dpt.performanceDate)
            JOIN group_memberships gm_alias
              ON CAST(gm_alias.groupId AS INTEGER) = CAST(ga_display.groupId AS INTEGER)
             AND (COALESCE(CAST(gm_alias.joinDate AS TEXT), '') = '' OR CAST(gm_alias.joinDate AS TEXT) <= dpt.performanceDate)
             AND (COALESCE(CAST(gm_alias.leaveDate AS TEXT), '') = '' OR CAST(gm_alias.leaveDate AS TEXT) >= dpt.performanceDate)
          )`;
        const memberFromSql = `
          FROM setlists s
          ${joinSongVersionSql}
          LEFT JOIN songs so ON CAST(so.songId AS INTEGER) = CAST(s.songId AS INTEGER)
          LEFT JOIN artist_profiles ar_set ON CAST(ar_set.artistId AS INTEGER) = CAST(s.artistId AS INTEGER)
          ${joinVersionArtistSql}
          LEFT JOIN artist_profiles ar_song ON CAST(ar_song.artistId AS INTEGER) = CAST(so.artistId AS INTEGER)
          JOIN resolved_setlist_members rsm ON CAST(rsm.setlistEntryId AS INTEGER) = CAST(s.setlistId AS INTEGER)
          JOIN persons p ON CAST(p.personId AS INTEGER) = CAST(rsm.personId AS INTEGER)
          ${memberWhereClause}
          ${memberAgeSql}
          ${memberStatusSql}
        `;
        const countResult = await conn.query(`${memberCteSql} SELECT COUNT(DISTINCT CAST(p.personId AS INTEGER)) AS total ${memberFromSql}`);
        const total = toInt((countResult.toArray()[0] as Record<string, unknown> | undefined)?.total);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const result = await conn.query(`${memberCteSql}
          SELECT
            CAST(s.setlistId AS INTEGER) AS setlistId, CAST(s.stageId AS INTEGER) AS stageId,
            CAST(s.eventId AS INTEGER) AS eventId, CAST(COALESCE(s.eventName, '') AS TEXT) AS eventName,
            CAST(COALESCE(s.venueId, 0) AS INTEGER) AS venueId, CAST(COALESCE(s.venueName, '') AS TEXT) AS venueName,
            CAST(s.date AS TEXT) AS date, CAST(COALESCE(s.section, '') AS TEXT) AS sectionName,
            CAST(p.personName AS TEXT) AS performerName,
            CAST(COALESCE(so.songId, s.songId, 0) AS INTEGER) AS songId,
            CAST(COALESCE(so.songName, s.songName, '') AS TEXT) AS songName,
            ${resolvedArtistIdExpr} AS artistId, ${resolvedArtistNameExpr} AS artistName,
            CAST(p.personId AS INTEGER) AS memberId, CAST(p.personName AS TEXT) AS memberName
          ${memberFromSql}
          QUALIFY ROW_NUMBER() OVER (PARTITION BY CAST(p.personId AS INTEGER) ORDER BY CAST(s.date AS TEXT) ASC, CAST(s.setlistId AS INTEGER) ASC) = 1
          ORDER BY memberName ASC
          LIMIT ${limit} OFFSET ${offset}
        `);
        const rows = (result.toArray() as Array<Record<string, unknown>>).map((row, index) => ({
            rank: offset + index + 1, setlistId: toInt(row.setlistId), stageId: toInt(row.stageId), eventId: toInt(row.eventId),
            eventName: toText(row.eventName), venueId: toInt(row.venueId) || null, venueName: toText(row.venueName) || null,
            date: toText(row.date) || null, sectionName: toText(row.sectionName) || null, performerName: toText(row.performerName) || null,
            songId: toInt(row.songId) || null, songName: toText(row.songName) || null, artistId: toInt(row.artistId) || null,
            artistName: toText(row.artistName) || null, memberId: toInt(row.memberId) || null, memberName: toText(row.memberName) || null,
        }));
        return { rows, total, page, limit, totalPages };
    }

    if (request.distinctBy === "song") {
        const countResult = await conn.query(`SELECT COUNT(DISTINCT CAST(COALESCE(so.songId, s.songId) AS INTEGER)) AS total ${fromSql}`);
        const total = toInt((countResult.toArray()[0] as Record<string, unknown> | undefined)?.total);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const result = await conn.query(`
          SELECT CAST(s.setlistId AS INTEGER) AS setlistId, CAST(s.stageId AS INTEGER) AS stageId,
            CAST(s.eventId AS INTEGER) AS eventId, CAST(COALESCE(s.eventName, '') AS TEXT) AS eventName,
            CAST(COALESCE(s.venueId, 0) AS INTEGER) AS venueId, CAST(COALESCE(s.venueName, '') AS TEXT) AS venueName,
            CAST(s.date AS TEXT) AS date, CAST(COALESCE(s.section, '') AS TEXT) AS sectionName,
            CAST(COALESCE(s.displayPerformerName, '') AS TEXT) AS performerName,
            CAST(COALESCE(so.songId, s.songId, 0) AS INTEGER) AS songId,
            CAST(COALESCE(so.songName, s.songName, '') AS TEXT) AS songName,
            ${resolvedArtistIdExpr} AS artistId, ${resolvedArtistNameExpr} AS artistName
          ${fromSql}
          QUALIFY ROW_NUMBER() OVER (PARTITION BY CAST(COALESCE(so.songId, s.songId) AS INTEGER) ORDER BY CAST(s.date AS TEXT) ASC, CAST(s.setlistId AS INTEGER) ASC) = 1
          ORDER BY songName ASC LIMIT ${limit} OFFSET ${offset}
        `);
        const rows = (result.toArray() as Array<Record<string, unknown>>).map((row, index) => ({
            rank: offset + index + 1, setlistId: toInt(row.setlistId), stageId: toInt(row.stageId), eventId: toInt(row.eventId), eventName: toText(row.eventName),
            venueId: toInt(row.venueId) || null, venueName: toText(row.venueName) || null, date: toText(row.date) || null,
            sectionName: toText(row.sectionName) || null, performerName: toText(row.performerName) || null, songId: toInt(row.songId) || null,
            songName: toText(row.songName) || null, artistId: toInt(row.artistId) || null, artistName: toText(row.artistName) || null,
        }));
        return { rows, total, page, limit, totalPages };
    }

    const countResult = await conn.query(`
      SELECT COUNT(*) AS total
      ${fromSql}
    `);
    const total = toInt((countResult.toArray()[0] as Record<string, unknown> | undefined)?.total);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const result = await conn.query(`
      SELECT
        CAST(s.setlistId AS INTEGER) AS setlistId,
        CAST(s.stageId AS INTEGER) AS stageId,
        CAST(s.eventId AS INTEGER) AS eventId,
        CAST(COALESCE(CAST(s.eventName AS TEXT), '') AS TEXT) AS eventName,
        CAST(COALESCE(CAST(s.venueId AS INTEGER), 0) AS INTEGER) AS venueId,
        CAST(COALESCE(CAST(s.venueName AS TEXT), '') AS TEXT) AS venueName,
        CAST(COALESCE(CAST(s.date AS TEXT), '') AS TEXT) AS date,
        CAST(COALESCE(CAST(s.section AS TEXT), '') AS TEXT) AS sectionName,
        CAST(COALESCE(CAST(s.displayPerformerName AS TEXT), '') AS TEXT) AS performerName,
        CAST(COALESCE(CAST(so.songId AS INTEGER), CAST(s.songId AS INTEGER), 0) AS INTEGER) AS songId,
        CAST(COALESCE(CAST(so.songName AS TEXT), CAST(s.songName AS TEXT), '') AS TEXT) AS songName,
        ${resolvedArtistIdExpr} AS artistId,
        ${resolvedArtistNameExpr} AS artistName
      ${fromSql}
      ORDER BY CAST(s.date AS TEXT) ${sortOrder}, CAST(s.eventId AS INTEGER) ${sortOrder}, CAST(s.stageId AS INTEGER) ${sortOrder}, CAST(s.musicOrder AS INTEGER) ASC, CAST(s.setlistId AS INTEGER) ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const rows = (result.toArray() as Array<Record<string, unknown>>).map((row, index) => ({
        rank: offset + index + 1,
        setlistId: toInt(row.setlistId),
        stageId: toInt(row.stageId),
        eventId: toInt(row.eventId),
        eventName: toText(row.eventName),
        venueId: row.venueId === null || row.venueId === undefined ? null : toInt(row.venueId),
        venueName: row.venueName ? toText(row.venueName) : null,
        date: row.date ? toText(row.date) : null,
        sectionName: row.sectionName ? toText(row.sectionName) : null,
        performerName: row.performerName ? toText(row.performerName) : null,
        songId: row.songId === null || row.songId === undefined ? null : toInt(row.songId),
        songName: row.songName ? toText(row.songName) : null,
        artistId: row.artistId === null || row.artistId === undefined ? null : toInt(row.artistId),
        artistName: row.artistName ? toText(row.artistName) : null,
    }));

    return {
        rows,
        total,
        page,
        limit,
        totalPages,
    };
};

const memberStatusFilterForScope = (scope: StatsAttributeRankingRequest["memberScope"]): string | null => {
    if (!scope || scope === "currentHello") {
        return "COALESCE(CAST(p.memberStatus AS TEXT), '') = 'activeHello'";
    }
    if (scope === "currentHelloAndTrainees") {
        return "COALESCE(CAST(p.memberStatus AS TEXT), '') IN ('activeHello', 'trainee')";
    }
    if (scope === "helloHistory") {
        return "COALESCE(CAST(p.memberStatus AS TEXT), '') IN ('activeHello', 'trainee', 'helloOg')";
    }
    if (scope === "helloOg") {
        return "COALESCE(CAST(p.memberStatus AS TEXT), '') = 'helloOg'";
    }
    return null;
};

const buildStatsAttributeMemberCondition = (
    field: string,
    method: string,
    value: string,
    memberBirthplaceExpr: string,
): string => {
    if (!value.trim()) return "";
    const textMethod =
        method === "exact" ||
        method === "notContains" ||
        method === "notExact" ||
        method === "startsWith" ||
        method === "endsWith"
            ? method
            : "contains";
    if (field === "memberStatus") {
        const status = escapeSqlLiteral(value.trim());
        return `COALESCE(CAST(p.memberStatus AS TEXT), '') = '${status}'`;
    }
    if (field === "performerName") {
        return buildSongMatch("COALESCE(CAST(p.personName AS TEXT), '')", value, textMethod);
    }
    if (field === "performerGroupName") {
        return `EXISTS (
          SELECT 1
          FROM group_memberships gm_filter
          WHERE CAST(gm_filter.personId AS INTEGER) = CAST(p.personId AS INTEGER)
            AND ${buildSongMatch("COALESCE(CAST(gm_filter.groupName AS TEXT), '')", value, textMethod)}
        )`;
    }
    if (field === "prefectureId") {
        const ids = value.split(",").map((item) => Number(item.trim())).filter((id) => Number.isInteger(id) && id > 0);
        if (ids.length === 0) return "";
        return `${memberBirthplaceExpr} IN (
          SELECT CAST(prefectureName AS TEXT)
          FROM prefectures
          WHERE CAST(prefectureId AS INTEGER) IN (${ids.join(",")})
        )`;
    }
    if (field === "prefectureName") {
        return buildSongMatch(`COALESCE(${memberBirthplaceExpr}, '')`, value, textMethod);
    }
    if (field === "bloodType") {
        return buildSongMatch("COALESCE(CAST(msi.bloodType AS TEXT), '')", value, textMethod);
    }
    if (field === "generation") {
        return buildSongMatch("COALESCE(CAST(msi.generationsText AS TEXT), '')", value, textMethod);
    }
    if (field === "roleName") {
        return buildSongMatch("COALESCE(CAST(msi.rolesText AS TEXT), '')", value, textMethod);
    }
    if (field === "colorName") {
        return `EXISTS (
          SELECT 1
          FROM member_colors mc_filter
          WHERE CAST(mc_filter.personId AS INTEGER) = CAST(p.personId AS INTEGER)
            AND ${buildSongMatch("COALESCE(CAST(mc_filter.colorName AS TEXT), '')", value, textMethod)}
        )`;
    }
    return "";
};

const buildStatsAttributeMemberFilters = (
    request: StatsAttributeRankingRequest,
    memberBirthplaceExpr: string,
): string[] => {
    const filters: string[] = [];
    const scopeFilter = memberStatusFilterForScope(request.memberScope);
    if (scopeFilter) filters.push(scopeFilter);

    const birthdayExpr = "CAST(p.birthday AS TEXT)";
    if (request.memberBirthdayFrom?.trim()) {
        filters.push(`COALESCE(${birthdayExpr}, '') >= '${escapeSqlLiteral(request.memberBirthdayFrom.trim())}'`);
    }
    if (request.memberBirthdayTo?.trim()) {
        filters.push(`COALESCE(${birthdayExpr}, '') <= '${escapeSqlLiteral(request.memberBirthdayTo.trim())}'`);
    }
    const birthMonths = Array.isArray(request.memberBirthMonths)
        ? [...new Set(request.memberBirthMonths.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))]
        : [];
    if (birthMonths.length > 0) {
        filters.push("COALESCE(TRIM(CAST(p.birthday AS TEXT)), '') <> ''");
        filters.push(`CAST(substr(${birthdayExpr}, 6, 2) AS INTEGER) IN (${birthMonths.join(",")})`);
    }

    const groups = Array.isArray(request.conditionGroups) ? request.conditionGroups : [];
    for (const group of groups) {
        const conditions = Array.isArray(group.conditions)
            ? group.conditions
                  .map((condition) =>
                      buildStatsAttributeMemberCondition(
                          condition.field,
                          condition.method,
                          condition.value,
                          memberBirthplaceExpr,
                      ),
                  )
                  .filter(Boolean)
            : [];
        if (conditions.length === 0) continue;
        const join = group.conditionJoin === "or" ? " OR " : " AND ";
        filters.push(`(${conditions.join(join)})`);
    }
    return filters;
};

export const searchStatsAttributeRanking = async (
    conn: duckdb.AsyncDuckDBConnection,
    request: StatsAttributeRankingRequest,
): Promise<SongRankingResponse> => {
    const page = Math.max(1, request.page);
    const limit = Math.max(1, Math.min(100, request.limit));
    const offset = (page - 1) * limit;
    const sortOrder = request.sortOrder === "asc" ? "ASC" : "DESC";
    const dateFrom = request.dateFrom.trim();
    const dateTo = request.dateTo.trim();
    const dateFilters: string[] = [];
    if (dateFrom) dateFilters.push(`CAST(s.date AS TEXT) >= '${escapeSqlLiteral(dateFrom)}'`);
    if (dateTo) dateFilters.push(`CAST(s.date AS TEXT) <= '${escapeSqlLiteral(dateTo)}'`);
    const stageDateWhere = dateFilters.length > 0 ? `WHERE ${dateFilters.join(" AND ")}` : "";

    const memberBirthplaceExpr = `COALESCE(
      NULLIF(CAST(p.prefectureName AS TEXT), ''),
      NULLIF(
        regexp_extract(
          regexp_replace(COALESCE(CAST(p.birthPlaceText AS TEXT), ''), '^.*/', ''),
          '(北海道|東京都|京都府|大阪府|[^\\\\s]+県)',
          1
        ),
        ''
      )
    )`;
    const memberFilters = buildStatsAttributeMemberFilters(request, memberBirthplaceExpr);
    const memberWhere = memberFilters.length > 0 ? `WHERE ${memberFilters.join(" AND ")}` : "";
    const currentColorOnly = !request.memberScope || request.memberScope === "currentHello";
    const colorActivityFilters = currentColorOnly
        ? [
              "(gm.groupPersonId IS NULL OR gm.leaveDate IS NULL OR CAST(gm.leaveDate AS TEXT) = '')",
              "(mc.endDate IS NULL OR CAST(mc.endDate AS TEXT) = '')",
          ]
        : [];
    const colorActivitySql = colorActivityFilters.length > 0
        ? `${memberWhere ? "AND" : "WHERE"} ${colorActivityFilters.join(" AND ")}`
        : "";
    const colorNameSql = `${memberWhere || colorActivitySql ? "AND" : "WHERE"} COALESCE(TRIM(CAST(mc.colorName AS TEXT)), '') <> ''`;
    const colorFamilyExpr = `CASE
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'グリーン|緑|ミント|エメラルド|ライム|メロン') THEN 'グリーン系'
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'レッド|赤|ワイン|ルビー|りんご') THEN 'レッド系'
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'ブルー|青|水色|シアン|ネイビー|ターコイズ|紺') THEN 'ブルー系'
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'ピンク|桃|ローズ|サーモン|ピーチ') THEN 'ピンク系'
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'イエロー|黄|ゴールド|デイジー|ハニー|マスタード|レモン') THEN 'イエロー系'
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'オレンジ|橙') THEN 'オレンジ系'
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'パープル|紫|ラベンダー|バイオレット') THEN 'パープル系'
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'ホワイト|白|アイボリー') THEN 'ホワイト系'
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'ブラック|黒') THEN 'ブラック系'
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'ブラウン|茶|ベージュ|チョコレート|ミルクティー') THEN 'ブラウン系'
      WHEN regexp_matches(COALESCE(CAST(mc.colorName AS TEXT), ''), 'グレー|灰|シルバー') THEN 'グレー系'
      ELSE CAST(mc.colorName AS TEXT) || '系'
    END`;

    const sourceSql = (() => {
        if (request.rankingBy === "memberBirthplace") {
            return `
              SELECT
                CAST(NULL AS INTEGER) AS entityId,
                CAST(${memberBirthplaceExpr} AS TEXT) AS entityName,
                COUNT(DISTINCT CAST(p.personId AS INTEGER)) AS totalPerformances,
                COUNT(DISTINCT CAST(p.personId AS INTEGER)) AS totalStages,
                COUNT(DISTINCT CAST(p.personId AS INTEGER)) AS totalEvents,
                CAST(NULL AS TEXT) AS lastPerformedDate
              FROM persons p
              LEFT JOIN member_search_index msi
                ON CAST(msi.personId AS INTEGER) = CAST(p.personId AS INTEGER)
              ${memberWhere}
              ${memberWhere ? "AND" : "WHERE"} COALESCE(${memberBirthplaceExpr}, '') <> ''
              GROUP BY ${memberBirthplaceExpr}
            `;
        }
        if (request.rankingBy === "memberJoinAge") {
            return `
              SELECT
                CAST(p.personId AS INTEGER) AS entityId,
                CAST(p.personName AS TEXT) AS entityName,
                CAST(date_diff('day', TRY_CAST(CAST(p.birthday AS TEXT) AS DATE), TRY_CAST(CAST(p.hpJoinDate AS TEXT) AS DATE)) AS INTEGER) AS totalPerformances,
                CAST(date_diff('year', TRY_CAST(CAST(p.birthday AS TEXT) AS DATE), TRY_CAST(CAST(p.hpJoinDate AS TEXT) AS DATE))
                  - CASE WHEN strftime(TRY_CAST(CAST(p.hpJoinDate AS TEXT) AS DATE), '%m-%d') < strftime(TRY_CAST(CAST(p.birthday AS TEXT) AS DATE), '%m-%d') THEN 1 ELSE 0 END AS INTEGER) AS joinAgeYears,
                CAST(date_diff('day',
                  TRY_CAST(CAST(p.birthday AS TEXT) AS DATE) + INTERVAL (
                    date_diff('year', TRY_CAST(CAST(p.birthday AS TEXT) AS DATE), TRY_CAST(CAST(p.hpJoinDate AS TEXT) AS DATE))
                    - CASE WHEN strftime(TRY_CAST(CAST(p.hpJoinDate AS TEXT) AS DATE), '%m-%d') < strftime(TRY_CAST(CAST(p.birthday AS TEXT) AS DATE), '%m-%d') THEN 1 ELSE 0 END
                  ) YEAR,
                  TRY_CAST(CAST(p.hpJoinDate AS TEXT) AS DATE)
                ) AS INTEGER) AS joinAgeDays,
                CAST(0 AS INTEGER) AS totalStages,
                CAST(0 AS INTEGER) AS totalEvents,
                CAST(p.hpJoinDate AS TEXT) AS lastPerformedDate
              FROM persons p
              LEFT JOIN member_search_index msi ON CAST(msi.personId AS INTEGER) = CAST(p.personId AS INTEGER)
              ${memberWhere}
              ${memberWhere ? "AND" : "WHERE"} TRY_CAST(CAST(p.birthday AS TEXT) AS DATE) IS NOT NULL
                AND TRY_CAST(CAST(p.hpJoinDate AS TEXT) AS DATE) IS NOT NULL
            `;
        }
        if (request.rankingBy === "venuePrefecture") {
            return `
              WITH stage_scope AS (
                SELECT DISTINCT
                  CAST(s.venueId AS INTEGER) AS venueId,
                  CAST(s.stageId AS INTEGER) AS stageId,
                  CAST(s.eventId AS INTEGER) AS eventId,
                  CAST(s.date AS TEXT) AS date,
                  COALESCE(CAST(s.prefectureId AS INTEGER), 0) AS prefectureId,
                  COALESCE(CAST(pr.prefectureName AS TEXT), CAST(v.prefectureName AS TEXT), '') AS prefectureName
                FROM stages s
                LEFT JOIN venues v ON CAST(v.venueId AS INTEGER) = CAST(s.venueId AS INTEGER)
                LEFT JOIN prefectures pr
                  ON CAST(pr.prefectureId AS INTEGER) = COALESCE(CAST(s.prefectureId AS INTEGER), 0)
                ${stageDateWhere}
              )
              SELECT
                CAST(prefectureId AS INTEGER) AS entityId,
                CAST(prefectureName AS TEXT) AS entityName,
                COUNT(DISTINCT venueId) AS totalPerformances,
                COUNT(DISTINCT stageId) AS totalStages,
                COUNT(DISTINCT eventId) AS totalEvents,
                CAST(MAX(date) AS TEXT) AS lastPerformedDate
              FROM stage_scope
              WHERE COALESCE(prefectureName, '') <> ''
                AND venueId IS NOT NULL
                AND venueId > 0
              GROUP BY prefectureId, prefectureName
            `;
        }
        const colorEntityExpr = request.rankingBy === "memberColorFamily" ? colorFamilyExpr : "CAST(mc.colorName AS TEXT)";
        return `
          SELECT
            CAST(NULL AS INTEGER) AS entityId,
            CAST(${colorEntityExpr} AS TEXT) AS entityName,
            COUNT(DISTINCT CAST(p.personId AS INTEGER)) AS totalPerformances,
            COUNT(DISTINCT CAST(p.personId AS INTEGER)) AS totalStages,
            COUNT(DISTINCT CAST(p.personId AS INTEGER)) AS totalEvents,
            CAST(NULL AS TEXT) AS lastPerformedDate
          FROM member_colors mc
          JOIN persons p
            ON CAST(p.personId AS INTEGER) = CAST(mc.personId AS INTEGER)
          LEFT JOIN group_memberships gm
            ON CAST(gm.groupPersonId AS INTEGER) = CAST(mc.groupPersonId AS INTEGER)
          LEFT JOIN member_search_index msi
            ON CAST(msi.personId AS INTEGER) = CAST(p.personId AS INTEGER)
          ${memberWhere}
          ${colorActivitySql}
          ${colorNameSql}
          GROUP BY ${colorEntityExpr}
        `;
    })();

    const countResult = await conn.query(`
      SELECT COUNT(*) AS total
      FROM (${sourceSql}) source_rows
    `);
    const total = toInt((countResult.toArray()[0] as Record<string, unknown> | undefined)?.total);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const result = await conn.query(`
      SELECT *
      FROM (${sourceSql}) source_rows
      ORDER BY totalPerformances ${sortOrder}, entityName ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);
    const rows = (result.toArray() as Array<Record<string, unknown>>).map((row, index) => ({
        rank: offset + index + 1,
        entityType: request.rankingBy,
        entityId: row.entityId === null || row.entityId === undefined ? null : toInt(row.entityId),
        entityName: toText(row.entityName),
        songId: null,
        songName: null,
        artistId: null,
        artistName: null,
        totalPerformances: toInt(row.totalPerformances),
        totalStages: toInt(row.totalStages),
        totalEvents: toInt(row.totalEvents),
        lastPerformedDate: row.lastPerformedDate ? toText(row.lastPerformedDate) : null,
        joinAgeYears: row.joinAgeYears === null || row.joinAgeYears === undefined ? null : toInt(row.joinAgeYears),
        joinAgeDays: row.joinAgeDays === null || row.joinAgeDays === undefined ? null : toInt(row.joinAgeDays),
    }));

    return {
        rows,
        total,
        page,
        limit,
        totalPages,
    };
};

export {
    getGroupEventStages,
    getGroupArtists,
    getGroupAlbums,
    getGroupDetail,
    getGroupEvents,
    getGroupMembers,
    getGroupSetlists,
    getMemberEventStages,
    getMemberArtists,
    getMemberColors,
    getMemberDetail,
    getMemberEvents,
    getMemberGroupRoles,
    getMemberGroups,
    getMemberProfile,
    getMemberSetlists,
    searchMembers,
} from "./memberQueries";
