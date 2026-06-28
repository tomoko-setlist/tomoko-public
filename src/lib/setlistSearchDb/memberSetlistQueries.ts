import { clampInt, toInt, toSafePositiveInt, toText } from "./queryUtils";
import { hasTableColumnAsync } from "./tableSchemaCache";

import type { RelatedEventRow, SetlistDetail, StageDetail } from "./types";
import type * as duckdb from "@duckdb/duckdb-wasm";

type PerformerKind = "person" | "group";
const LIMIT_MIN = 1;
const SETLIST_LIMIT_MAX = 200;

const toOptionalLimit = (limit?: number): number | null =>
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : null;

const hasColumn = hasTableColumnAsync;

// ============================================================
// Setlists
// ============================================================

const mapSetlistDetailRow = (row: Record<string, unknown>): SetlistDetail => ({
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
});

const getSetlistsByPerformer = async (
    conn: duckdb.AsyncDuckDBConnection,
    id: number,
    kind: PerformerKind,
    limit: number,
): Promise<SetlistDetail[]> => {
    const safeId = toSafePositiveInt(id);
    const safeLimit = clampInt(limit, LIMIT_MIN, SETLIST_LIMIT_MAX);
    const idField = kind === "person" ? "personId" : "groupId";
    const result = await conn.query(`
      SELECT
        CAST(sl.setlistId AS INTEGER) AS setlistId,
        CAST(sl.stageId AS INTEGER) AS stageId,
        CAST(sl.eventId AS INTEGER) AS eventId,
        CAST(sl.eventName AS TEXT) AS eventName,
        CAST(sl.venueId AS INTEGER) AS venueId,
        CAST(sl.venueName AS TEXT) AS venueName,
        CAST(sl.date AS TEXT) AS date,
        CAST(sl.startTime AS TEXT) AS startTime,
        CAST(sl.musicOrder AS INTEGER) AS musicOrder,
        CAST(sl.section AS TEXT) AS section,
        CAST(sl.displayPerformerName AS TEXT) AS displayPerformerName,
        CAST(sl.songId AS INTEGER) AS songId,
        CAST(sl.songName AS TEXT) AS songName,
        CAST(sl.artistId AS INTEGER) AS artistId,
        CAST(sl.artistName AS TEXT) AS artistName,
        CAST(sl.lyricistName AS TEXT) AS lyricistName,
        CAST(sl.composerName AS TEXT) AS composerName,
        CAST(sl.arrangerName AS TEXT) AS arrangerName,
        CAST(sl.creatorsText AS TEXT) AS creatorsText,
        CAST(sl.eventTagsJson AS TEXT) AS eventTagsJson
      FROM setlists sl
      JOIN setlist_entry_performers sep
        ON CAST(sep.setlistEntryId AS INTEGER) = CAST(sl.setlistId AS INTEGER)
      WHERE CAST(sep.${idField} AS INTEGER) = ${safeId}
      ORDER BY sl.date DESC, sl.stageId DESC, sl.musicOrder ASC, sl.setlistId ASC
      LIMIT ${safeLimit}
    `);
    return (result.toArray() as Array<Record<string, unknown>>).map(
        mapSetlistDetailRow,
    );
};

export const getMemberSetlists = (
    conn: duckdb.AsyncDuckDBConnection,
    personId: number,
    limit: number,
): Promise<SetlistDetail[]> =>
    getSetlistsByPerformer(conn, personId, "person", limit);

export const getGroupSetlists = (
    conn: duckdb.AsyncDuckDBConnection,
    groupId: number,
    limit: number,
): Promise<SetlistDetail[]> =>
    getSetlistsByPerformer(conn, groupId, "group", limit);

// ============================================================
// Events
// ============================================================

const mapRelatedEventRow = (row: Record<string, unknown>): RelatedEventRow => ({
    eventId: toInt(row.eventId),
    eventName: toText(row.eventName),
    eventTagsJson: row.eventTagsJson ? toText(row.eventTagsJson) : "[]",
    latestDate: row.latestDate ? toText(row.latestDate) : null,
    earliestDate: row.earliestDate ? toText(row.earliestDate) : null,
    stageCount: toInt(row.stageCount),
    setlistCount: toInt(row.setlistCount),
});

const buildEventStatsJoins = (
    kind: PerformerKind,
    safeId: number,
    hasStagePerformers: boolean,
    hasSetlistEntryPerformers: boolean,
    joinTarget: "ep" | "matched",
): string => {
    const idField = kind === "person" ? "personId" : "groupId";
    const stageJoin = hasStagePerformers
        ? `
        LEFT JOIN (
          SELECT
            CAST(sp.eventId AS INTEGER) AS eventId,
            CAST(sp.${idField} AS INTEGER) AS ${idField},
            COUNT(DISTINCT CAST(sp.stageId AS INTEGER)) AS stageCount
          FROM stage_performers sp
          WHERE CAST(sp.${idField} AS INTEGER) = ${safeId}
          GROUP BY CAST(sp.eventId AS INTEGER), CAST(sp.${idField} AS INTEGER)
        ) stage_stats
          ON stage_stats.eventId = CAST(${joinTarget}.eventId AS INTEGER)
         AND stage_stats.${idField} = CAST(${joinTarget}.${idField} AS INTEGER)
      `
        : "";
    const setlistJoin = hasSetlistEntryPerformers
        ? `
        LEFT JOIN (
          SELECT
            CAST(sep.eventId AS INTEGER) AS eventId,
            CAST(sep.${idField} AS INTEGER) AS ${idField},
            COUNT(DISTINCT CAST(sep.setlistEntryId AS INTEGER)) AS setlistCount
          FROM setlist_entry_performers sep
          WHERE CAST(sep.${idField} AS INTEGER) = ${safeId}
          GROUP BY CAST(sep.eventId AS INTEGER), CAST(sep.${idField} AS INTEGER)
        ) setlist_stats
          ON setlist_stats.eventId = CAST(${joinTarget}.eventId AS INTEGER)
         AND setlist_stats.${idField} = CAST(${joinTarget}.${idField} AS INTEGER)
      `
        : "";
    return stageJoin + setlistJoin;
};

const getEventsViaEventPerformers = async (
    conn: duckdb.AsyncDuckDBConnection,
    kind: PerformerKind,
    safeId: number,
    limitClause: string,
): Promise<RelatedEventRow[]> => {
    const idField = kind === "person" ? "personId" : "groupId";
    const hasStagePerformers = await hasColumn(conn, "stage_performers", "stageId");
    const hasSetlistEntryPerformers = await hasColumn(
        conn,
        "setlist_entry_performers",
        "setlistEntryId",
    );
    const statsJoins = buildEventStatsJoins(
        kind,
        safeId,
        hasStagePerformers,
        hasSetlistEntryPerformers,
        "matched",
    );
    const result = await conn.query(`
          WITH matched AS (
            SELECT DISTINCT
              CAST(ep.eventId AS INTEGER) AS eventId,
              CAST(ep.${idField} AS INTEGER) AS ${idField}
            FROM event_performers ep
            WHERE CAST(ep.${idField} AS INTEGER) = ${safeId}
          )
          SELECT
            matched.eventId AS eventId,
            CAST(e.eventName AS TEXT) AS eventName,
            CAST(COALESCE(e.eventTagsJson, '[]') AS TEXT) AS eventTagsJson,
            CAST(date_stats.latestDate AS TEXT) AS latestDate,
            CAST(date_stats.earliestDate AS TEXT) AS earliestDate,
            CAST(COALESCE(stage_stats.stageCount, 0) AS INTEGER) AS stageCount,
            CAST(COALESCE(setlist_stats.setlistCount, 0) AS INTEGER) AS setlistCount
          FROM matched
          JOIN events e
            ON CAST(e.eventId AS INTEGER) = matched.eventId
          LEFT JOIN (
            SELECT
              CAST(s.eventId AS INTEGER) AS eventId,
              MAX(CAST(s.date AS TEXT)) AS latestDate,
              MIN(CAST(s.date AS TEXT)) AS earliestDate
            FROM stages s
            GROUP BY CAST(s.eventId AS INTEGER)
          ) date_stats
            ON date_stats.eventId = matched.eventId
          ${statsJoins}
          ORDER BY COALESCE(date_stats.latestDate, '') DESC, matched.eventId DESC
          ${limitClause}
        `);
    return (result.toArray() as Array<Record<string, unknown>>).map(
        mapRelatedEventRow,
    );
};

const getEventsViaStagePerformers = async (
    conn: duckdb.AsyncDuckDBConnection,
    kind: PerformerKind,
    safeId: number,
    limitClause: string,
): Promise<RelatedEventRow[]> => {
    const idField = kind === "person" ? "personId" : "groupId";
    const result = await conn.query(`
          WITH matched AS (
            SELECT
              CAST(s.eventId AS INTEGER) AS eventId,
              CAST(s.eventName AS TEXT) AS eventName,
              CAST(sp.stageId AS INTEGER) AS stageId,
              CAST(s.date AS TEXT) AS date,
              CAST(s.eventTagsJson AS TEXT) AS eventTagsJson
            FROM stage_performers sp
            JOIN stages s
              ON CAST(s.stageId AS INTEGER) = CAST(sp.stageId AS INTEGER)
            WHERE CAST(sp.${idField} AS INTEGER) = ${safeId}
          )
          SELECT
            eventId,
            eventName,
            MAX(eventTagsJson) AS eventTagsJson,
            MAX(date) AS latestDate,
            MIN(date) AS earliestDate,
            COUNT(DISTINCT stageId) AS stageCount,
            0 AS setlistCount
          FROM matched
          GROUP BY eventId, eventName
          ORDER BY latestDate DESC, eventId DESC
          ${limitClause}
        `);
    return (result.toArray() as Array<Record<string, unknown>>).map(
        mapRelatedEventRow,
    );
};

const getEventsViaSetlistPerformers = async (
    conn: duckdb.AsyncDuckDBConnection,
    kind: PerformerKind,
    safeId: number,
    limitClause: string,
): Promise<RelatedEventRow[]> => {
    const idField = kind === "person" ? "personId" : "groupId";
    const result = await conn.query(`
      WITH matched AS (
        SELECT
          CAST(sl.eventId AS INTEGER) AS eventId,
          CAST(sl.eventName AS TEXT) AS eventName,
          CAST(sl.stageId AS INTEGER) AS stageId,
          CAST(sl.setlistId AS INTEGER) AS setlistId,
          CAST(sl.date AS TEXT) AS date,
          CAST(sl.eventTagsJson AS TEXT) AS eventTagsJson
        FROM setlists sl
        JOIN setlist_entry_performers sep
          ON CAST(sep.setlistEntryId AS INTEGER) = CAST(sl.setlistId AS INTEGER)
        WHERE CAST(sep.${idField} AS INTEGER) = ${safeId}
      )
      SELECT
        eventId,
        eventName,
        MAX(eventTagsJson) AS eventTagsJson,
        MAX(date) AS latestDate,
        MIN(date) AS earliestDate,
        COUNT(DISTINCT stageId) AS stageCount,
        COUNT(setlistId) AS setlistCount
      FROM matched
      GROUP BY eventId, eventName
      ORDER BY latestDate DESC, eventId DESC
      ${limitClause}
    `);
    return (result.toArray() as Array<Record<string, unknown>>).map(
        mapRelatedEventRow,
    );
};

export const getMemberEvents = async (
    conn: duckdb.AsyncDuckDBConnection,
    personId: number,
    limit?: number,
): Promise<RelatedEventRow[]> => {
    const safePersonId = toSafePositiveInt(personId);
    const safeLimit = toOptionalLimit(limit);
    const limitClause = safeLimit !== null ? `LIMIT ${safeLimit}` : "";

    const hasEventPerformerPersons = await hasColumn(
        conn,
        "event_performer_persons",
        "eventId",
    );
    if (hasEventPerformerPersons) {
        const hasStagePerformerPersons = await hasColumn(
            conn,
            "stage_performer_persons",
            "stageId",
        );
        const hasSetlistEntryPerformers = await hasColumn(
            conn,
            "setlist_entry_performers",
            "setlistEntryId",
        );
        const stageStatsJoin = hasStagePerformerPersons
            ? `
        LEFT JOIN (
          SELECT
            CAST(spp.eventId AS INTEGER) AS eventId,
            CAST(spp.personId AS INTEGER) AS personId,
            COUNT(DISTINCT CAST(spp.stageId AS INTEGER)) AS stageCount
          FROM stage_performer_persons spp
          WHERE CAST(spp.personId AS INTEGER) = ${safePersonId}
          GROUP BY CAST(spp.eventId AS INTEGER), CAST(spp.personId AS INTEGER)
        ) stage_stats
          ON stage_stats.eventId = matched.eventId
         AND stage_stats.personId = matched.personId
      `
            : "";
        const setlistStatsJoin = hasSetlistEntryPerformers
            ? `
        LEFT JOIN (
          SELECT
            CAST(sep.eventId AS INTEGER) AS eventId,
            CAST(sep.personId AS INTEGER) AS personId,
            COUNT(DISTINCT CAST(sep.setlistEntryId AS INTEGER)) AS setlistCount
          FROM setlist_entry_performers sep
          WHERE CAST(sep.personId AS INTEGER) = ${safePersonId}
          GROUP BY CAST(sep.eventId AS INTEGER), CAST(sep.personId AS INTEGER)
        ) setlist_stats
          ON setlist_stats.eventId = matched.eventId
         AND setlist_stats.personId = matched.personId
      `
            : "";
        const result = await conn.query(`
          WITH matched AS (
            SELECT DISTINCT
              CAST(epp.eventId AS INTEGER) AS eventId,
              CAST(epp.personId AS INTEGER) AS personId
            FROM event_performer_persons epp
            WHERE CAST(epp.personId AS INTEGER) = ${safePersonId}
          )
          SELECT
            matched.eventId AS eventId,
            CAST(e.eventName AS TEXT) AS eventName,
            CAST(COALESCE(e.eventTagsJson, '[]') AS TEXT) AS eventTagsJson,
            CAST(date_stats.latestDate AS TEXT) AS latestDate,
            CAST(date_stats.earliestDate AS TEXT) AS earliestDate,
            CAST(COALESCE(stage_stats.stageCount, 0) AS INTEGER) AS stageCount,
            CAST(COALESCE(setlist_stats.setlistCount, 0) AS INTEGER) AS setlistCount
          FROM matched
          JOIN events e
            ON CAST(e.eventId AS INTEGER) = matched.eventId
          LEFT JOIN (
            SELECT
              CAST(s.eventId AS INTEGER) AS eventId,
              MAX(CAST(s.date AS TEXT)) AS latestDate,
              MIN(CAST(s.date AS TEXT)) AS earliestDate
            FROM stages s
            GROUP BY CAST(s.eventId AS INTEGER)
          ) date_stats
            ON date_stats.eventId = matched.eventId
          ${stageStatsJoin}
          ${setlistStatsJoin}
          ORDER BY COALESCE(date_stats.latestDate, '') DESC, matched.eventId DESC
          ${limitClause}
        `);
        return (result.toArray() as Array<Record<string, unknown>>).map(
            mapRelatedEventRow,
        );
    }

    const hasEventPerformers = await hasColumn(conn, "event_performers", "eventId");
    if (hasEventPerformers) {
        return getEventsViaEventPerformers(conn, "person", safePersonId, limitClause);
    }
    const hasStagePerformers = await hasColumn(conn, "stage_performers", "stageId");
    if (hasStagePerformers) {
        return getEventsViaStagePerformers(conn, "person", safePersonId, limitClause);
    }
    return getEventsViaSetlistPerformers(conn, "person", safePersonId, limitClause);
};

export const getGroupEvents = async (
    conn: duckdb.AsyncDuckDBConnection,
    groupId: number,
    limit?: number,
): Promise<RelatedEventRow[]> => {
    const safeGroupId = toSafePositiveInt(groupId);
    const safeLimit = toOptionalLimit(limit);
    const limitClause = safeLimit !== null ? `LIMIT ${safeLimit}` : "";

    const hasEventPerformers = await hasColumn(conn, "event_performers", "eventId");
    if (hasEventPerformers) {
        return getEventsViaEventPerformers(conn, "group", safeGroupId, limitClause);
    }
    const hasStagePerformers = await hasColumn(conn, "stage_performers", "stageId");
    if (hasStagePerformers) {
        return getEventsViaStagePerformers(conn, "group", safeGroupId, limitClause);
    }
    return getEventsViaSetlistPerformers(conn, "group", safeGroupId, limitClause);
};

// ============================================================
// Event Stages
// ============================================================

const mapStageDetailRow = (row: Record<string, unknown>): StageDetail => ({
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
    eventTagsJson: row.eventTagsJson ? toText(row.eventTagsJson) : "[]",
});

const buildOrderedStagesCte = (safeEventId: number): string => `
  ordered_stages AS (
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
  )
`;

const getEventStagesViaTable = async (
    conn: duckdb.AsyncDuckDBConnection,
    table: string,
    idField: string,
    safeId: number,
    safeEventId: number,
): Promise<StageDetail[]> => {
    const result = await conn.query(`
          WITH matched_stage_ids AS (
            SELECT DISTINCT
              CAST(t.stageId AS INTEGER) AS stageId
            FROM ${table} t
            WHERE CAST(t.${idField} AS INTEGER) = ${safeId}
              AND CAST(t.eventId AS INTEGER) = ${safeEventId}
          ),
          ${buildOrderedStagesCte(safeEventId)}
          SELECT os.*
          FROM ordered_stages os
          JOIN matched_stage_ids ms ON ms.stageId = os.stageId
          ORDER BY
            os.date ASC,
            COALESCE(os.startTime, '99:99:99') ASC,
            os.stageId ASC
        `);
    return (result.toArray() as Array<Record<string, unknown>>).map(
        mapStageDetailRow,
    );
};

const getEventStagesViaSetlistPerformers = async (
    conn: duckdb.AsyncDuckDBConnection,
    idField: string,
    safeId: number,
    safeEventId: number,
): Promise<StageDetail[]> => {
    const result = await conn.query(`
      WITH matched_stage_ids AS (
        SELECT DISTINCT
          CAST(sl.stageId AS INTEGER) AS stageId
        FROM setlists sl
        JOIN setlist_entry_performers sep
          ON CAST(sep.setlistEntryId AS INTEGER) = CAST(sl.setlistId AS INTEGER)
        WHERE CAST(sep.${idField} AS INTEGER) = ${safeId}
          AND CAST(sl.eventId AS INTEGER) = ${safeEventId}
      ),
      ${buildOrderedStagesCte(safeEventId)}
      SELECT os.*
      FROM ordered_stages os
      JOIN matched_stage_ids ms ON ms.stageId = os.stageId
      ORDER BY
        os.date ASC,
        COALESCE(os.startTime, '99:99:99') ASC,
        os.stageId ASC
    `);
    return (result.toArray() as Array<Record<string, unknown>>).map(
        mapStageDetailRow,
    );
};

export const getMemberEventStages = async (
    conn: duckdb.AsyncDuckDBConnection,
    personId: number,
    eventId: number,
): Promise<StageDetail[]> => {
    const safePersonId = toSafePositiveInt(personId);
    const safeEventId = toSafePositiveInt(eventId);

    const hasStagePerformerPersons = await hasColumn(
        conn,
        "stage_performer_persons",
        "stageId",
    );
    if (hasStagePerformerPersons) {
        return getEventStagesViaTable(
            conn,
            "stage_performer_persons",
            "personId",
            safePersonId,
            safeEventId,
        );
    }
    const hasStagePerformers = await hasColumn(conn, "stage_performers", "stageId");
    if (hasStagePerformers) {
        return getEventStagesViaTable(
            conn,
            "stage_performers",
            "personId",
            safePersonId,
            safeEventId,
        );
    }
    return getEventStagesViaSetlistPerformers(
        conn,
        "personId",
        safePersonId,
        safeEventId,
    );
};

export const getGroupEventStages = async (
    conn: duckdb.AsyncDuckDBConnection,
    groupId: number,
    eventId: number,
): Promise<StageDetail[]> => {
    const safeGroupId = toSafePositiveInt(groupId);
    const safeEventId = toSafePositiveInt(eventId);

    const hasStagePerformers = await hasColumn(conn, "stage_performers", "stageId");
    if (hasStagePerformers) {
        return getEventStagesViaTable(
            conn,
            "stage_performers",
            "groupId",
            safeGroupId,
            safeEventId,
        );
    }
    return getEventStagesViaSetlistPerformers(
        conn,
        "groupId",
        safeGroupId,
        safeEventId,
    );
};
