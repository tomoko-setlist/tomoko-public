import { toInt, toText } from "./queryUtils";
import { duckdbDateYmdExpr } from "../date/duckdbDateExpr";
import { parseYmd } from "../date/standards";

import type {
    HomeDailyDigest,
    HomeDigestAnniversaryStage,
    HomeDigestSong,
    HomeDigestStage,
} from "./types";
import type * as duckdb from "@duckdb/duckdb-wasm";

const HOME_STAGE_LIMIT = 6;
const HOME_SONG_LIMIT = 5;

const normalizeReferenceDate = (value: string): string => {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match && parseYmd(`${match[1]}-${match[2]}-${match[3]}`)) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }
    const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return nowJst.toISOString().slice(0, 10);
};

const mapHomeDigestStage = (row: Record<string, unknown>): HomeDigestStage => ({
    stageId: toInt(row.stageId),
    eventId: toInt(row.eventId),
    eventName: toText(row.eventName),
    venueId: toInt(row.venueId),
    venueName: toText(row.venueName),
    prefectureName: row.prefectureName ? toText(row.prefectureName) : null,
    date: toText(row.date),
    startTime: row.startTime ? toText(row.startTime) : null,
    pattern: row.pattern ? toText(row.pattern) : null,
    cancelled: Boolean(row.cancelled),
    totalPerformances: toInt(row.totalPerformances),
});

const homeStageSelectSql = `
  SELECT
    CAST(s.stageId AS INTEGER) AS stageId,
    CAST(s.eventId AS INTEGER) AS eventId,
    CAST(e.eventName AS TEXT) AS eventName,
    CAST(s.venueId AS INTEGER) AS venueId,
    CAST(v.venueName AS TEXT) AS venueName,
    CAST(v.prefectureName AS TEXT) AS prefectureName,
    CAST(s.date AS TEXT) AS date,
    CAST(s.startTime AS TEXT) AS startTime,
    CAST(s.pattern AS TEXT) AS pattern,
    CAST(s.cancelled AS BOOLEAN) AS cancelled,
    CAST(COALESCE(sl.totalPerformances, 0) AS INTEGER) AS totalPerformances
  FROM stages s
  JOIN events e ON CAST(e.eventId AS INTEGER) = CAST(s.eventId AS INTEGER)
  JOIN venues v ON CAST(v.venueId AS INTEGER) = CAST(s.venueId AS INTEGER)
  LEFT JOIN (
    SELECT CAST(stageId AS INTEGER) AS stageId, COUNT(*) AS totalPerformances
    FROM setlists
    GROUP BY CAST(stageId AS INTEGER)
  ) sl ON sl.stageId = CAST(s.stageId AS INTEGER)
`;

export const getHomeDailyDigest = async (
    conn: duckdb.AsyncDuckDBConnection,
    referenceDate: string,
): Promise<HomeDailyDigest> => {
    const safeReferenceDate = normalizeReferenceDate(referenceDate);
    const stageDateExpr = duckdbDateYmdExpr("s.date");
    const setlistDateExpr = duckdbDateYmdExpr("sl.date");
    const statsResult = await conn.query(`
      SELECT
        CAST((SELECT COUNT(*) FROM setlists) AS INTEGER) AS totalSetlists,
        CAST((SELECT COUNT(*) FROM stages) AS INTEGER) AS totalStages,
        CAST((SELECT COUNT(*) FROM events) AS INTEGER) AS totalEvents,
        CAST((SELECT COUNT(*) FROM songs) AS INTEGER) AS totalSongs,
        CAST((SELECT COUNT(*) FROM persons) AS INTEGER) AS totalMembers,
        CAST((SELECT title FROM release_notes ORDER BY CAST(releasedAt AS TEXT) DESC, CAST(releaseId AS INTEGER) DESC LIMIT 1) AS TEXT) AS latestReleaseTitle,
        CAST((SELECT releasedAt FROM release_notes ORDER BY CAST(releasedAt AS TEXT) DESC, CAST(releaseId AS INTEGER) DESC LIMIT 1) AS TEXT) AS latestReleaseDate
    `);
    const statsRow = statsResult.toArray()[0] as Record<string, unknown> | undefined;

    const upcomingResult = await conn.query(`
      ${homeStageSelectSql}
      WHERE CAST(${stageDateExpr} AS DATE) BETWEEN DATE '${safeReferenceDate}' AND DATE '${safeReferenceDate}' + INTERVAL 14 DAY
      ORDER BY
        CAST(${stageDateExpr} AS DATE) ASC,
        TRY_CAST(CAST(s.startTime AS TEXT) AS TIME) ASC NULLS LAST,
        CAST(s.stageId AS INTEGER) ASC
      LIMIT ${HOME_STAGE_LIMIT}
    `);

    const recentResult = await conn.query(`
      ${homeStageSelectSql}
      WHERE CAST(${stageDateExpr} AS DATE) < DATE '${safeReferenceDate}'
      ORDER BY
        CAST(${stageDateExpr} AS DATE) DESC,
        TRY_CAST(CAST(s.startTime AS TEXT) AS TIME) DESC NULLS LAST,
        CAST(s.stageId AS INTEGER) DESC
      LIMIT ${HOME_STAGE_LIMIT}
    `);

    const anniversaryResult = await conn.query(`
      ${homeStageSelectSql}
      WHERE
        CAST(${stageDateExpr} AS DATE) < DATE '${safeReferenceDate}'
        AND EXTRACT(month FROM CAST(${stageDateExpr} AS DATE)) = EXTRACT(month FROM DATE '${safeReferenceDate}')
        AND EXTRACT(day FROM CAST(${stageDateExpr} AS DATE)) = EXTRACT(day FROM DATE '${safeReferenceDate}')
      ORDER BY
        CAST(${stageDateExpr} AS DATE) DESC,
        TRY_CAST(CAST(s.startTime AS TEXT) AS TIME) ASC NULLS LAST,
        CAST(s.stageId AS INTEGER) ASC
      LIMIT ${HOME_STAGE_LIMIT}
    `);

    const hotSongsResult = await conn.query(`
      SELECT
        CAST(sl.songId AS INTEGER) AS songId,
        CAST(so.songName AS TEXT) AS songName,
        CAST(ar.artistId AS INTEGER) AS artistId,
        CAST(ar.artistName AS TEXT) AS artistName,
        CAST(COUNT(*) AS INTEGER) AS totalPerformances,
        CAST(COUNT(DISTINCT CAST(sl.stageId AS INTEGER)) AS INTEGER) AS totalStages,
        CAST(MAX(CAST(${setlistDateExpr} AS DATE)) AS TEXT) AS lastPerformedDate
      FROM setlists sl
      JOIN songs so ON CAST(so.songId AS INTEGER) = CAST(sl.songId AS INTEGER)
      LEFT JOIN artist_profiles ar ON CAST(ar.artistId AS INTEGER) = CAST(so.artistId AS INTEGER)
      WHERE CAST(${setlistDateExpr} AS DATE) BETWEEN DATE '${safeReferenceDate}' - INTERVAL 90 DAY AND DATE '${safeReferenceDate}'
      GROUP BY CAST(sl.songId AS INTEGER), so.songName, ar.artistId, ar.artistName
      ORDER BY COUNT(*) DESC, MAX(CAST(${setlistDateExpr} AS DATE)) DESC, so.songName ASC
      LIMIT ${HOME_SONG_LIMIT}
    `);

    const anniversaryRows = anniversaryResult.toArray() as Array<Record<string, unknown>>;
    const referenceYear = Number(safeReferenceDate.slice(0, 4));

    return {
        referenceDate: safeReferenceDate,
        stats: {
            totalSetlists: toInt(statsRow?.totalSetlists),
            totalStages: toInt(statsRow?.totalStages),
            totalEvents: toInt(statsRow?.totalEvents),
            totalSongs: toInt(statsRow?.totalSongs),
            totalMembers: toInt(statsRow?.totalMembers),
            latestReleaseTitle: statsRow?.latestReleaseTitle ? toText(statsRow.latestReleaseTitle) : null,
            latestReleaseDate: statsRow?.latestReleaseDate ? toText(statsRow.latestReleaseDate) : null,
        },
        upcomingStages: (upcomingResult.toArray() as Array<Record<string, unknown>>).map(mapHomeDigestStage),
        recentStages: (recentResult.toArray() as Array<Record<string, unknown>>).map(mapHomeDigestStage),
        anniversaryStages: anniversaryRows.map((row): HomeDigestAnniversaryStage => {
            const stage = mapHomeDigestStage(row);
            const stageYear = Number(stage.date.slice(0, 4));
            return {
                ...stage,
                yearsAgo:
                    Number.isFinite(referenceYear) && Number.isFinite(stageYear)
                        ? Math.max(1, referenceYear - stageYear)
                        : 0,
            };
        }),
        recentHotSongs: (hotSongsResult.toArray() as Array<Record<string, unknown>>).map((row): HomeDigestSong => ({
            songId: toInt(row.songId),
            songName: toText(row.songName),
            artistId: row.artistId === null || row.artistId === undefined ? null : toInt(row.artistId),
            artistName: row.artistName ? toText(row.artistName) : null,
            totalPerformances: toInt(row.totalPerformances),
            totalStages: toInt(row.totalStages),
            lastPerformedDate: row.lastPerformedDate ? toText(row.lastPerformedDate) : null,
        })),
    };
};
