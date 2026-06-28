import {
    clampInt,
    parseAnnouncementKind,
    parseCsvTags,
    toInt,
    toSafePositiveInt,
    toText,
} from "./queryUtils";

import type {
    DashboardData,
    DashboardRelease,
    ReleaseDbChange,
    ReleaseNoteDetail,
    ReleaseNoteSummary,
} from "./types";
import type * as duckdb from "@duckdb/duckdb-wasm";

const LIMIT_MIN = 1;
const RELEASE_CHANGE_LIMIT_MAX = 500;
const RELEASE_NOTE_LIMIT_MAX = 2000;

export const listReleaseNotes = async (
    conn: duckdb.AsyncDuckDBConnection,
    limit = 120,
): Promise<ReleaseNoteSummary[]> => {
    const safeLimit = clampInt(limit, LIMIT_MIN, RELEASE_CHANGE_LIMIT_MAX);
    const result = await conn.query(`
    SELECT
      CAST(releaseId AS INTEGER) AS releaseId,
      CAST(slug AS TEXT) AS slug,
      CAST(title AS TEXT) AS title,
      CAST(summary AS TEXT) AS summary,
      CAST(releasedAt AS TEXT) AS releasedAt,
      CAST(announcementKind AS TEXT) AS announcementKind,
      CAST(relatedRelease AS TEXT) AS relatedRelease,
      CAST(tagsCsv AS TEXT) AS tagsCsv
    FROM release_notes
    ORDER BY CAST(releasedAt AS TEXT) DESC, CAST(releaseId AS INTEGER) DESC
    LIMIT ${safeLimit}
  `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        releaseId: toInt(row.releaseId),
        slug: toText(row.slug),
        title: toText(row.title),
        summary: toText(row.summary),
        releasedAt: toText(row.releasedAt),
        announcementKind: parseAnnouncementKind(row.announcementKind),
        relatedRelease: row.relatedRelease ? toText(row.relatedRelease) : null,
        tags: parseCsvTags(toText(row.tagsCsv)),
    }));
};

export const getReleaseNote = async (
    conn: duckdb.AsyncDuckDBConnection,
    releaseId: number,
): Promise<ReleaseNoteDetail | null> => {
    const safeReleaseId = toSafePositiveInt(releaseId);
    const result = await conn.query(`
    SELECT
      CAST(releaseId AS INTEGER) AS releaseId,
      CAST(slug AS TEXT) AS slug,
      CAST(title AS TEXT) AS title,
      CAST(summary AS TEXT) AS summary,
      CAST(releasedAt AS TEXT) AS releasedAt,
      CAST(announcementKind AS TEXT) AS announcementKind,
      CAST(relatedRelease AS TEXT) AS relatedRelease,
      CAST(tagsCsv AS TEXT) AS tagsCsv,
      CAST(bodyMarkdown AS TEXT) AS bodyMarkdown,
      CAST(parquetGeneratedAt AS TEXT) AS parquetGeneratedAt,
      CAST(parquetSignature AS TEXT) AS parquetSignature
    FROM release_notes
    WHERE CAST(releaseId AS INTEGER) = ${safeReleaseId}
    LIMIT 1
  `);
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
        releaseId: toInt(row.releaseId),
        slug: toText(row.slug),
        title: toText(row.title),
        summary: toText(row.summary),
        releasedAt: toText(row.releasedAt),
        announcementKind: parseAnnouncementKind(row.announcementKind),
        relatedRelease: row.relatedRelease ? toText(row.relatedRelease) : null,
        tags: parseCsvTags(toText(row.tagsCsv)),
        bodyMarkdown: toText(row.bodyMarkdown),
        parquetGeneratedAt: row.parquetGeneratedAt
            ? toText(row.parquetGeneratedAt)
            : null,
        parquetSignature: row.parquetSignature
            ? toText(row.parquetSignature)
            : null,
    };
};

export const getReleaseDbChanges = async (
    conn: duckdb.AsyncDuckDBConnection,
    releaseId: number,
    limit = 200,
): Promise<ReleaseDbChange[]> => {
    const safeReleaseId = toSafePositiveInt(releaseId);
    const safeLimit = clampInt(limit, LIMIT_MIN, RELEASE_NOTE_LIMIT_MAX);
    const result = await conn.query(`
    SELECT
      CAST(releaseId AS INTEGER) AS releaseId,
      CAST(changeOrder AS INTEGER) AS changeOrder,
      CAST(entity AS TEXT) AS entity,
      CAST(beforeCount AS INTEGER) AS beforeCount,
      CAST(afterCount AS INTEGER) AS afterCount,
      CAST(delta AS INTEGER) AS delta,
      CAST(note AS TEXT) AS note,
      CAST(source AS TEXT) AS source
    FROM release_db_changes
    WHERE CAST(releaseId AS INTEGER) = ${safeReleaseId}
    ORDER BY CAST(changeOrder AS INTEGER) ASC
    LIMIT ${safeLimit}
  `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        releaseId: toInt(row.releaseId),
        changeOrder: toInt(row.changeOrder),
        entity: toText(row.entity),
        beforeCount:
            row.beforeCount === null || row.beforeCount === undefined
                ? null
                : toInt(row.beforeCount),
        afterCount:
            row.afterCount === null || row.afterCount === undefined
                ? null
                : toInt(row.afterCount),
        delta:
            row.delta === null || row.delta === undefined
                ? null
                : toInt(row.delta),
        note: row.note ? toText(row.note) : null,
        source: row.source ? toText(row.source) : null,
    }));
};

export const getDashboardData = async (
    conn: duckdb.AsyncDuckDBConnection,
): Promise<DashboardData> => {
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

    const joinedResult = await conn.query(`
      SELECT
        CAST(rn.releaseId AS INTEGER) AS releaseId,
        CAST(rn.slug AS TEXT) AS slug,
        CAST(rn.title AS TEXT) AS title,
        CAST(rn.summary AS TEXT) AS summary,
        CAST(rn.releasedAt AS TEXT) AS releasedAt,
        CAST(rn.announcementKind AS TEXT) AS announcementKind,
        CAST(rn.relatedRelease AS TEXT) AS relatedRelease,
        CAST(rn.tagsCsv AS TEXT) AS tagsCsv,
        CAST(rc.changeOrder AS INTEGER) AS changeOrder,
        CAST(rc.entity AS TEXT) AS entity,
        CAST(rc.beforeCount AS INTEGER) AS beforeCount,
        CAST(rc.afterCount AS INTEGER) AS afterCount,
        CAST(rc.delta AS INTEGER) AS delta,
        CAST(rc.note AS TEXT) AS note,
        CAST(rc.source AS TEXT) AS source
      FROM release_notes rn
      LEFT JOIN release_db_changes rc ON CAST(rc.releaseId AS INTEGER) = CAST(rn.releaseId AS INTEGER)
      ORDER BY
        CAST(rn.releasedAt AS TEXT) DESC,
        CAST(rn.releaseId AS INTEGER) DESC,
        CAST(rc.changeOrder AS INTEGER) ASC
    `);

    const rows = joinedResult.toArray() as Array<Record<string, unknown>>;
    const releaseMap = new Map<number, DashboardRelease>();

    for (const row of rows) {
        const releaseId = toInt(row.releaseId);
        if (!releaseMap.has(releaseId)) {
            releaseMap.set(releaseId, {
                releaseId,
                slug: toText(row.slug),
                title: toText(row.title),
                summary: toText(row.summary),
                releasedAt: toText(row.releasedAt),
                announcementKind: parseAnnouncementKind(row.announcementKind),
                relatedRelease: row.relatedRelease ? toText(row.relatedRelease) : null,
                tags: parseCsvTags(toText(row.tagsCsv)),
                changes: [],
            });
        }
        const release = releaseMap.get(releaseId)!;
        if (row.entity !== null && row.entity !== undefined) {
            release.changes.push({
                releaseId,
                changeOrder: toInt(row.changeOrder),
                entity: toText(row.entity),
                beforeCount:
                    row.beforeCount === null || row.beforeCount === undefined
                        ? null
                        : toInt(row.beforeCount),
                afterCount:
                    row.afterCount === null || row.afterCount === undefined
                        ? null
                        : toInt(row.afterCount),
                delta:
                    row.delta === null || row.delta === undefined
                        ? null
                        : toInt(row.delta),
                note: row.note ? toText(row.note) : null,
                source: row.source ? toText(row.source) : null,
            });
        }
    }

    return {
        stats: {
            totalSetlists: toInt(statsRow?.totalSetlists),
            totalStages: toInt(statsRow?.totalStages),
            totalEvents: toInt(statsRow?.totalEvents),
            totalSongs: toInt(statsRow?.totalSongs),
            totalMembers: toInt(statsRow?.totalMembers),
            latestReleaseTitle: statsRow?.latestReleaseTitle ? toText(statsRow.latestReleaseTitle) : null,
            latestReleaseDate: statsRow?.latestReleaseDate ? toText(statsRow.latestReleaseDate) : null,
        },
        releases: Array.from(releaseMap.values()),
    };
};
