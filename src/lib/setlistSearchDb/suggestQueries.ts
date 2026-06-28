import { escapeSqlLiteral } from "./queryUtils";
import {
    normalizeSearchKey,
    normalizeSearchKeyVariants,
    normalizeSearchKeyWithoutKanaFold,
} from "../searchTextNormalization";

import type {
    SearchSuggestField,
    SearchSuggestRequest,
    SearchSuggestion,
    SearchUnit,
} from "./types";
import type * as duckdb from "@duckdb/duckdb-wasm";

type CandidateSource = {
    sql: string;
    weight: number;
    labelSql?: string;
    searchKeySql?: string;
};

const normalizeLooseTerm = (value: string): string =>
    normalizeSearchKey(value);

const buildLooseSqlText = (expr: string): string => `
    lower(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(CAST(${expr} AS TEXT), '\u3000', ''),
                    ' ', ''),
                  '-', ''),
                'ー', ''),
              'ｰ', ''),
            '－', ''),
          '―', ''),
        '〜', ''),
      '～', '')
    )
`;

const buildSqlOrClause = (clauses: string[]): string =>
    clauses.length > 0 ? clauses.join(" OR ") : "FALSE";

const querySources = (searchUnit: SearchUnit): CandidateSource[] => {
    const commonSources: CandidateSource[] = [
        {
            sql: "SELECT CAST(songName AS TEXT) AS candidate, CAST(songNameSearchKey AS TEXT) AS searchKey FROM songs",
            weight: 7,
            searchKeySql: "searchKey",
        },
        {
            sql: "SELECT CAST(canonical.songName AS TEXT) AS candidate, CAST(canonical.songName AS TEXT) AS label, CAST(aliasSearchKey AS TEXT) AS searchKey FROM search_aliases sa JOIN songs canonical ON CAST(canonical.songId AS INTEGER) = CAST(sa.entityId AS INTEGER) WHERE sa.entityType = 'song' AND sa.fieldName = 'songName' AND sa.status = 'active'",
            weight: 8,
            labelSql: "label",
            searchKeySql: "searchKey",
        },
        { sql: "SELECT CAST(personName AS TEXT) AS candidate FROM persons", weight: 5 },
        {
            sql: "SELECT CAST(personName AS TEXT) AS candidate, CAST(nameKana AS TEXT) AS searchKey FROM persons WHERE nameKana IS NOT NULL AND trim(CAST(nameKana AS TEXT)) <> ''",
            weight: 3,
            searchKeySql: "searchKey",
        },
        {
            sql: "SELECT CAST(p.personName AS TEXT) AS candidate, CAST(mp.nickname AS TEXT) AS searchKey FROM member_profiles mp JOIN persons p ON CAST(p.personId AS INTEGER) = CAST(mp.personId AS INTEGER) WHERE mp.nickname IS NOT NULL AND trim(CAST(mp.nickname AS TEXT)) <> ''",
            weight: 4,
            searchKeySql: "searchKey",
        },
        {
            sql: "SELECT CAST(p.personName AS TEXT) AS candidate, CAST(mp.nicknameAlt AS TEXT) AS searchKey FROM member_profiles mp JOIN persons p ON CAST(p.personId AS INTEGER) = CAST(mp.personId AS INTEGER) WHERE mp.nicknameAlt IS NOT NULL AND trim(CAST(mp.nicknameAlt AS TEXT)) <> ''",
            weight: 4,
            searchKeySql: "searchKey",
        },
        { sql: "SELECT CAST(groupName AS TEXT) AS candidate FROM groups", weight: 4 },
        { sql: "SELECT CAST(aliasName AS TEXT) AS candidate FROM group_aliases", weight: 4 },
        { sql: "SELECT CAST(artistName AS TEXT) AS candidate FROM artist_profiles", weight: 4 },
        {
            sql: "SELECT CAST(historyName AS TEXT) AS candidate FROM venue_name_histories",
            weight: 3,
        },
    ];

    if (searchUnit === "stage") {
        return [
            { sql: "SELECT CAST(eventName AS TEXT) AS candidate FROM events", weight: 7 },
            { sql: "SELECT CAST(venueName AS TEXT) AS candidate FROM venues", weight: 6 },
            { sql: "SELECT CAST(tagName AS TEXT) AS candidate FROM event_tags", weight: 5 },
            ...commonSources,
        ];
    }

    return [
        ...commonSources,
        { sql: "SELECT CAST(eventName AS TEXT) AS candidate FROM events", weight: 3 },
        { sql: "SELECT CAST(venueName AS TEXT) AS candidate FROM venues", weight: 3 },
    ];
};

const fieldSources = (
    field: SearchSuggestField,
    searchUnit: SearchUnit,
): CandidateSource[] => {
    const rawSearchUnit = searchUnit as unknown as string;
    const effectiveUnit: SearchUnit =
        rawSearchUnit === "event" ? "stage" : searchUnit;

    if (field === "query") {
        return querySources(effectiveUnit);
    }
    if (field === "songSearchQuery") {
        return [
            {
                sql: "SELECT CAST(songName AS TEXT) AS candidate, CAST(songNameSearchKey AS TEXT) AS searchKey FROM songs",
                weight: 7,
                searchKeySql: "searchKey",
            },
            { sql: "SELECT CAST(artistName AS TEXT) AS candidate FROM songs", weight: 5 },
            { sql: "SELECT CAST(lyricistName AS TEXT) AS candidate FROM song_versions", weight: 4 },
            { sql: "SELECT CAST(composerName AS TEXT) AS candidate FROM song_versions", weight: 4 },
            { sql: "SELECT CAST(arrangerName AS TEXT) AS candidate FROM song_versions", weight: 4 },
            { sql: "SELECT CAST(albumName AS TEXT) AS candidate FROM albums", weight: 4 },
        ];
    }
    if (field === "songSearchSongName") {
        return [
            {
                sql: "SELECT CAST(songName AS TEXT) AS candidate, CAST(songNameSearchKey AS TEXT) AS searchKey FROM songs",
                weight: 6,
                searchKeySql: "searchKey",
            },
        ];
    }
    if (field === "songSearchArtistName") {
        return [{ sql: "SELECT CAST(artistName AS TEXT) AS candidate FROM songs", weight: 5 }];
    }
    if (field === "songSearchLyricistName") {
        return [{ sql: "SELECT CAST(lyricistName AS TEXT) AS candidate FROM song_versions", weight: 5 }];
    }
    if (field === "songSearchComposerName") {
        return [{ sql: "SELECT CAST(composerName AS TEXT) AS candidate FROM song_versions", weight: 5 }];
    }
    if (field === "songSearchArrangerName") {
        return [{ sql: "SELECT CAST(arrangerName AS TEXT) AS candidate FROM song_versions", weight: 5 }];
    }
    if (field === "songSearchAlbumName") {
        return [{ sql: "SELECT CAST(albumName AS TEXT) AS candidate FROM albums", weight: 5 }];
    }
    if (field === "memberSearchQuery") {
        return [
            { sql: "SELECT CAST(personName AS TEXT) AS candidate FROM member_search_index", weight: 7 },
            {
                sql: "SELECT CAST(personName AS TEXT) AS candidate, CAST(nameKana AS TEXT) AS searchKey FROM member_search_index WHERE nameKana IS NOT NULL AND trim(CAST(nameKana AS TEXT)) <> ''",
                weight: 5,
                searchKeySql: "searchKey",
            },
            { sql: "SELECT CAST(prefectureName AS TEXT) AS candidate FROM member_search_index", weight: 4 },
            { sql: "SELECT CAST(groupName AS TEXT) AS candidate FROM group_memberships", weight: 4 },
        ];
    }
    if (field === "memberSearchPersonName") {
        return [
            { sql: "SELECT CAST(personName AS TEXT) AS candidate FROM member_search_index", weight: 6 },
            {
                sql: "SELECT CAST(personName AS TEXT) AS candidate, CAST(nameKana AS TEXT) AS searchKey FROM member_search_index WHERE nameKana IS NOT NULL AND trim(CAST(nameKana AS TEXT)) <> ''",
                weight: 4,
                searchKeySql: "searchKey",
            },
        ];
    }
    if (field === "memberSearchGroupName") {
        return [
            { sql: "SELECT CAST(groupName AS TEXT) AS candidate FROM group_memberships", weight: 5 },
            { sql: "SELECT CAST(aliasName AS TEXT) AS candidate FROM group_aliases", weight: 4 },
        ];
    }
    if (field === "memberSearchGeneration") {
        return [{ sql: "SELECT CAST(generation AS TEXT) AS candidate FROM group_memberships", weight: 5 }];
    }
    if (field === "memberSearchRoleName") {
        return [{ sql: "SELECT CAST(roleName AS TEXT) AS candidate FROM group_roles", weight: 5 }];
    }
    if (field === "memberSearchColorName") {
        return [{ sql: "SELECT CAST(colorName AS TEXT) AS candidate FROM member_colors", weight: 5 }];
    }
    if (field === "songName") {
        return [
            {
                sql: "SELECT CAST(songName AS TEXT) AS candidate, CAST(songNameSearchKey AS TEXT) AS searchKey FROM setlists",
                weight: 5,
                searchKeySql: "searchKey",
            },
            {
                sql: "SELECT CAST(canonical.songName AS TEXT) AS candidate, CAST(canonical.songName AS TEXT) AS label, CAST(aliasSearchKey AS TEXT) AS searchKey FROM search_aliases sa JOIN songs canonical ON CAST(canonical.songId AS INTEGER) = CAST(sa.entityId AS INTEGER) WHERE sa.entityType = 'song' AND sa.fieldName = 'songName' AND sa.status = 'active'",
                weight: 6,
                labelSql: "label",
                searchKeySql: "searchKey",
            },
        ];
    }
    if (field === "normalizedPerformer") {
        return [
            {
                sql: "SELECT CAST('p:' || CAST(personId AS TEXT) AS TEXT) AS candidate, CAST(personName || ' / member' AS TEXT) AS label FROM persons WHERE personId IS NOT NULL AND personName IS NOT NULL",
                weight: 5,
                labelSql: "label",
            },
            {
                sql: "SELECT CAST('g:' || CAST(groupId AS TEXT) AS TEXT) AS candidate, CAST(groupName || ' / group' AS TEXT) AS label FROM groups WHERE groupId IS NOT NULL AND groupName IS NOT NULL",
                weight: 5,
                labelSql: "label",
            },
        ];
    }
    if (field === "personName") {
        return [
            { sql: "SELECT CAST(personName AS TEXT) AS candidate FROM persons", weight: 5 },
            {
                sql: "SELECT CAST(personName AS TEXT) AS candidate, CAST(nameKana AS TEXT) AS searchKey FROM persons WHERE nameKana IS NOT NULL AND trim(CAST(nameKana AS TEXT)) <> ''",
                weight: 2,
                searchKeySql: "searchKey",
            },
            {
                sql: "SELECT CAST(p.personName AS TEXT) AS candidate, CAST(mp.nickname AS TEXT) AS searchKey FROM member_profiles mp JOIN persons p ON CAST(p.personId AS INTEGER) = CAST(mp.personId AS INTEGER) WHERE mp.nickname IS NOT NULL AND trim(CAST(mp.nickname AS TEXT)) <> ''",
                weight: 3,
                searchKeySql: "searchKey",
            },
            {
                sql: "SELECT CAST(p.personName AS TEXT) AS candidate, CAST(mp.nicknameAlt AS TEXT) AS searchKey FROM member_profiles mp JOIN persons p ON CAST(p.personId AS INTEGER) = CAST(mp.personId AS INTEGER) WHERE mp.nicknameAlt IS NOT NULL AND trim(CAST(mp.nicknameAlt AS TEXT)) <> ''",
                weight: 3,
                searchKeySql: "searchKey",
            },
            { sql: "SELECT CAST(groupName AS TEXT) AS candidate FROM groups", weight: 5 },
            {
                sql: "SELECT CAST(g.groupName AS TEXT) AS candidate, CAST(ga.aliasName AS TEXT) AS searchKey FROM group_aliases ga JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(ga.groupId AS INTEGER) WHERE ga.aliasName IS NOT NULL AND trim(CAST(ga.aliasName AS TEXT)) <> ''",
                weight: 3,
                searchKeySql: "searchKey",
            },
        ];
    }
    if (field === "groupName") {
        return [
            { sql: "SELECT CAST(groupName AS TEXT) AS candidate FROM groups", weight: 5 },
            {
                sql: "SELECT CAST(groupName AS TEXT) AS candidate FROM group_memberships",
                weight: 3,
            },
            { sql: "SELECT CAST(aliasName AS TEXT) AS candidate FROM group_aliases", weight: 4 },
        ];
    }
    if (field === "prefectureName") {
        return [
            { sql: "SELECT CAST(prefectureName AS TEXT) AS candidate FROM prefectures", weight: 5 },
            { sql: "SELECT CAST(prefectureName AS TEXT) AS candidate FROM persons", weight: 2 },
            { sql: "SELECT CAST(prefectureName AS TEXT) AS candidate FROM venues", weight: 2 },
        ];
    }
    if (field === "artistName") {
        return [
            { sql: "SELECT CAST(artistName AS TEXT) AS candidate FROM artist_profiles", weight: 5 },
            { sql: "SELECT CAST(artistName AS TEXT) AS candidate FROM setlists", weight: 3 },
        ];
    }
    if (field === "lyricistName") {
        return [{ sql: "SELECT CAST(lyricistName AS TEXT) AS candidate FROM setlists", weight: 4 }];
    }
    if (field === "composerName") {
        return [{ sql: "SELECT CAST(composerName AS TEXT) AS candidate FROM setlists", weight: 4 }];
    }
    if (field === "arrangerName") {
        return [{ sql: "SELECT CAST(arrangerName AS TEXT) AS candidate FROM setlists", weight: 4 }];
    }
    if (field === "albumName") {
        return [{ sql: "SELECT CAST(albumName AS TEXT) AS candidate FROM albums", weight: 5 }];
    }
    if (field === "eventName") {
        return [
            { sql: "SELECT CAST(eventName AS TEXT) AS candidate FROM events", weight: 5 },
            { sql: "SELECT CAST(eventName AS TEXT) AS candidate FROM stages", weight: 3 },
        ];
    }
    if (field === "venueName") {
        return [
            { sql: "SELECT CAST(venueName AS TEXT) AS candidate FROM venues", weight: 5 },
            { sql: "SELECT CAST(venueName AS TEXT) AS candidate FROM stages", weight: 3 },
            {
                sql: "SELECT CAST(historyName AS TEXT) AS candidate FROM venue_name_histories",
                weight: 4,
            },
        ];
    }
    if (field === "sectionName") {
        return [{ sql: "SELECT CAST(section AS TEXT) AS candidate FROM setlists", weight: 5 }];
    }
    if (field === "eventTag") {
        return [{ sql: "SELECT CAST(tagName AS TEXT) AS candidate FROM event_tags", weight: 5 }];
    }

    if (effectiveUnit === "stage") {
        return [
            { sql: "SELECT CAST(eventName AS TEXT) AS candidate FROM stages", weight: 5 },
            { sql: "SELECT CAST(venueName AS TEXT) AS candidate FROM stages", weight: 5 },
            {
                sql: "SELECT CAST(historyName AS TEXT) AS candidate FROM venue_name_histories",
                weight: 3,
            },
            {
                sql: "SELECT CAST(songName AS TEXT) AS candidate, CAST(songNameSearchKey AS TEXT) AS searchKey FROM setlists",
                weight: 3,
                searchKeySql: "searchKey",
            },
            {
                sql: "SELECT CAST(canonical.songName AS TEXT) AS candidate, CAST(canonical.songName AS TEXT) AS label, CAST(aliasSearchKey AS TEXT) AS searchKey FROM search_aliases sa JOIN songs canonical ON CAST(canonical.songId AS INTEGER) = CAST(sa.entityId AS INTEGER) WHERE sa.entityType = 'song' AND sa.fieldName = 'songName' AND sa.status = 'active'",
                weight: 4,
                labelSql: "label",
                searchKeySql: "searchKey",
            },
            {
                sql: "SELECT CAST(displayPerformerName AS TEXT) AS candidate FROM setlists",
                weight: 3,
            },
        ];
    }
    return [
        {
            sql: "SELECT CAST(songName AS TEXT) AS candidate, CAST(songNameSearchKey AS TEXT) AS searchKey FROM setlists",
            weight: 6,
            searchKeySql: "searchKey",
        },
        {
            sql: "SELECT CAST(canonical.songName AS TEXT) AS candidate, CAST(canonical.songName AS TEXT) AS label, CAST(aliasSearchKey AS TEXT) AS searchKey FROM search_aliases sa JOIN songs canonical ON CAST(canonical.songId AS INTEGER) = CAST(sa.entityId AS INTEGER) WHERE sa.entityType = 'song' AND sa.fieldName = 'songName' AND sa.status = 'active'",
            weight: 7,
            labelSql: "label",
            searchKeySql: "searchKey",
        },
        { sql: "SELECT CAST(displayPerformerName AS TEXT) AS candidate FROM setlists", weight: 5 },
        { sql: "SELECT CAST(artistName AS TEXT) AS candidate FROM setlists", weight: 4 },
        { sql: "SELECT CAST(eventName AS TEXT) AS candidate FROM setlists", weight: 3 },
        { sql: "SELECT CAST(personName AS TEXT) AS candidate FROM persons", weight: 3 },
        {
            sql: "SELECT CAST(personName AS TEXT) AS candidate, CAST(nameKana AS TEXT) AS searchKey FROM persons WHERE nameKana IS NOT NULL AND trim(CAST(nameKana AS TEXT)) <> ''",
            weight: 2,
            searchKeySql: "searchKey",
        },
        { sql: "SELECT CAST(aliasName AS TEXT) AS candidate FROM group_aliases", weight: 2 },
        {
            sql: "SELECT CAST(historyName AS TEXT) AS candidate FROM venue_name_histories",
            weight: 2,
        },
    ];
};

export const suggestSearchCandidates = async (
    conn: duckdb.AsyncDuckDBConnection,
    request: SearchSuggestRequest,
): Promise<SearchSuggestion[]> => {
    const term = request.term.trim();
    if (!term) return [];

    const safeLimit = Math.max(1, Math.min(20, Math.floor(request.limit)));
    const escapedTerm = escapeSqlLiteral(term);
    const looseTerm = normalizeLooseTerm(term);
    const escapedLooseTerm = escapeSqlLiteral(looseTerm);
    const normalizedTerms = [
        ...new Set([
            ...normalizeSearchKeyVariants(term),
            normalizeSearchKeyWithoutKanaFold(term),
        ].filter((item) => item.length > 0)),
    ];
    const escapedNormalizedTerms = normalizedTerms.map((item) => escapeSqlLiteral(item));
    const sources = fieldSources(request.field, request.searchUnit);
    const candidatesSql = sources
        .map(
            (source) => `
          SELECT
            CAST(candidate AS TEXT) AS candidate,
            CAST(${source.labelSql ?? "candidate"} AS TEXT) AS label,
            CAST(COALESCE(${source.searchKeySql ?? "candidate"}, candidate) AS TEXT) AS searchKey,
            ${source.weight} AS weight
          FROM (${source.sql}) src`,
        )
        .join("\nUNION ALL\n");

    const looseMatchClause = escapedLooseTerm
        ? ` OR ${buildLooseSqlText("candidate")} LIKE lower('%${escapedLooseTerm}%')`
        : "";
    const prefixMatchClause = `lower(CAST(candidate AS TEXT)) LIKE lower('${escapedTerm}%')`;
    const exactMatchClause = `lower(CAST(candidate AS TEXT)) = lower('${escapedTerm}')`;
    const loosePrefixClause = escapedLooseTerm
        ? `${buildLooseSqlText("candidate")} LIKE lower('${escapedLooseTerm}%')`
        : "FALSE";
    const looseExactClause = escapedLooseTerm
        ? `${buildLooseSqlText("candidate")} = lower('${escapedLooseTerm}')`
        : "FALSE";
    const normalizedMatchCore = buildSqlOrClause(
        escapedNormalizedTerms.map(
            (escaped) => `lower(CAST(searchKey AS TEXT)) LIKE lower('%${escaped}%')`,
        ),
    );
    const normalizedMatchClause =
        escapedNormalizedTerms.length > 0 ? ` OR ${normalizedMatchCore}` : "";
    const normalizedPrefixClause = buildSqlOrClause(
        escapedNormalizedTerms.map(
            (escaped) => `lower(CAST(searchKey AS TEXT)) LIKE lower('${escaped}%')`,
        ),
    );
    const normalizedExactClause = buildSqlOrClause(
        escapedNormalizedTerms.map(
            (escaped) => `lower(CAST(searchKey AS TEXT)) = lower('${escaped}')`,
        ),
    );

    const result = await conn.query(`
      WITH candidates AS (
        ${candidatesSql}
      ),
      filtered AS (
        SELECT
          CAST(candidate AS TEXT) AS candidate,
          CAST(label AS TEXT) AS label,
          CAST(searchKey AS TEXT) AS searchKey,
          CAST(weight AS INTEGER) AS weight,
          CASE
            WHEN ${exactMatchClause} THEN 60
            WHEN ${normalizedExactClause} THEN 50
            WHEN ${prefixMatchClause} THEN 25
            WHEN ${looseExactClause} THEN 40
            WHEN ${normalizedPrefixClause} THEN 20
            WHEN ${loosePrefixClause} THEN 15
            ELSE 0
          END AS matchBonus
        FROM candidates
        WHERE candidate IS NOT NULL
          AND trim(CAST(candidate AS TEXT)) <> ''
          AND (
            lower(CAST(candidate AS TEXT)) LIKE lower('%${escapedTerm}%')
            ${looseMatchClause}
            ${normalizedMatchClause}
          )
      )
        SELECT
          CAST(candidate AS TEXT) AS value,
          CAST(MAX(label) AS TEXT) AS label,
          CAST(MAX(weight + matchBonus) AS INTEGER) AS weightedScore
        FROM filtered
      GROUP BY candidate
      ORDER BY weightedScore DESC, length(value) ASC, value ASC
      LIMIT ${safeLimit}
    `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        value:
            typeof row.value === "string" ||
            typeof row.value === "number" ||
            typeof row.value === "boolean"
                ? String(row.value)
                : "",
        label:
            typeof row.label === "string" ||
            typeof row.label === "number" ||
            typeof row.label === "boolean"
                ? String(row.label)
                : "",
    }));
};
