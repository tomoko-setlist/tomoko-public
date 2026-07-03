import {
    json,
    rejectDisallowedOrigin,
    rejectInvalidJsonRequest,
    toFiniteInt,
} from "../../_shared/security";

type Env = {
    REPORTS_DB?: D1Database;
};

type SetlistSubmissionEntry = {
    lineOrder?: number;
    musicOrder?: number | null;
    section?: string;
    displayName?: string;
    isMc?: boolean;
    isMedley?: boolean;
    note?: string;
    songName?: string;
    songId?: number | null;
    songVersionId?: number | null;
    artistName?: string;
    performers?: string;
    performersNormalized?: Array<{
        performerName?: string;
        personId?: number | null;
        groupId?: number | null;
    }>;
};

type SetlistSubmissionRequest = {
    submitterName?: string;
    eventName?: string;
    stageDate?: string;
    startTime?: string;
    venueName?: string;
    pattern?: string;
    stageId?: number | null;
    eventId?: number | null;
    pageUrl?: string;
    entries?: SetlistSubmissionEntry[];
};

const MAX_CONTENT_LENGTH = 256 * 1024;
const MAX_TEXT_SHORT = 120;
const MAX_TEXT_MEDIUM = 300;
const MAX_SUBMITTER_NAME = 80;
const MAX_ROWS = 120;
const MAX_SUBMISSIONS_PER_MINUTE = 5;
const MAX_SUBMISSIONS_PER_DAY = 80;

const SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS submission_headers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at_ms INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'krn',
      status TEXT NOT NULL DEFAULT 'pending',
      submitter_name TEXT,
      event_name TEXT,
      stage_date TEXT,
      start_time TEXT,
      venue_name TEXT,
      pattern TEXT,
      stage_id INTEGER,
      event_id INTEGER,
      output_format TEXT NOT NULL,
      notify_tomoko INTEGER NOT NULL DEFAULT 1,
      include_event INTEGER NOT NULL DEFAULT 1,
      include_artist INTEGER NOT NULL DEFAULT 1,
      include_performer INTEGER NOT NULL DEFAULT 1,
      performer_delimiter TEXT,
      line_count INTEGER NOT NULL DEFAULT 0,
      music_count INTEGER NOT NULL DEFAULT 0,
      export_preview TEXT,
      payload_json TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      referer TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS submission_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      line_order INTEGER NOT NULL,
      music_order INTEGER,
      section TEXT,
      display_name TEXT NOT NULL,
      is_mc INTEGER NOT NULL DEFAULT 0,
      is_medley INTEGER NOT NULL DEFAULT 0,
      is_new_song INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      song_id INTEGER,
      song_version_id INTEGER,
      artist_name TEXT,
      performers TEXT,
      FOREIGN KEY (submission_id) REFERENCES submission_headers(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_submission_headers_created_at_ms
      ON submission_headers(created_at_ms DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_submission_headers_status_created
      ON submission_headers(status, created_at_ms DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_submission_entries_submission_line
      ON submission_entries(submission_id, line_order ASC)`,
] as const;

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const rejectedOrigin = rejectDisallowedOrigin(context.request);
    if (rejectedOrigin) return rejectedOrigin;
    const invalidJson = rejectInvalidJsonRequest(context.request, MAX_CONTENT_LENGTH);
    if (invalidJson) return invalidJson;

    const db = context.env.REPORTS_DB;
    if (!db) return json({ error: "REPORTS_DB が未設定です。" }, 500);

    let body: SetlistSubmissionRequest;
    try {
        body = (await context.request.json()) as SetlistSubmissionRequest;
    } catch {
        return json({ error: "不正なリクエストです。" }, 400);
    }

    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) {
        return json({ error: "曲を1曲以上入力してください。" }, 400);
    }
    if (entries.length > MAX_ROWS) {
        return json({ error: `曲数が多すぎます (上限${MAX_ROWS}曲)。` }, 400);
    }

    const submitterName = clampText(body.submitterName, MAX_SUBMITTER_NAME);
    const eventName = clampText(body.eventName, MAX_TEXT_MEDIUM);
    const stageDate = clampText(body.stageDate, MAX_TEXT_SHORT);
    const startTime = clampText(body.startTime, MAX_TEXT_SHORT);
    const venueName = clampText(body.venueName, MAX_TEXT_MEDIUM);
    const pattern = clampText(body.pattern, MAX_TEXT_SHORT);
    const pageUrl = clampText(body.pageUrl, 500);
    const stageId =
        body.stageId === null || body.stageId === undefined
            ? null
            : toFiniteInt(body.stageId);
    const eventId =
        body.eventId === null || body.eventId === undefined
            ? null
            : toFiniteInt(body.eventId);
    if (
        (body.stageId !== null &&
            body.stageId !== undefined &&
            (stageId === null || stageId <= 0)) ||
        (body.eventId !== null &&
            body.eventId !== undefined &&
            (eventId === null || eventId <= 0))
    ) {
        return json({ error: "stageId/eventId が不正です。" }, 400);
    }

    const safeEntries = entries
        .map((entry, index) => {
            const performersNormalized = normalizePerformers(entry.performersNormalized);
            const isMc = Boolean(entry.isMc);
            const isMedley = Boolean(entry.isMedley);
            const displayName = clampText(
                entry.displayName || entry.songName || (isMc ? "MC" : ""),
                MAX_TEXT_MEDIUM,
            );
            return {
                lineOrder: toPositiveInt(entry.lineOrder) ?? index + 1,
                musicOrder: isMc
                    ? null
                    : toPositiveInt(entry.musicOrder) ?? index + 1,
                section: clampText(entry.section || "本編", MAX_TEXT_SHORT) || "本編",
                displayName,
                isMc,
                isMedley,
                note: clampText(entry.note, MAX_TEXT_MEDIUM),
                songName: displayName,
                songId: isMc ? null : toPositiveInt(entry.songId),
                songVersionId: isMc ? null : toPositiveInt(entry.songVersionId),
                artistName: isMc ? "" : clampText(entry.artistName, MAX_TEXT_MEDIUM),
                performers: isMc
                    ? ""
                    : clampText(
                          performersNormalized.length > 0
                              ? performersNormalized
                                    .map((performer) => performer.performerName)
                                    .join("・")
                              : entry.performers,
                          MAX_TEXT_MEDIUM,
                      ),
                performersNormalized: isMc ? [] : performersNormalized,
            };
        })
        .filter((entry) => entry.songName.length > 0);
    if (safeEntries.length === 0) {
        return json({ error: "曲名を1曲以上入力してください。" }, 400);
    }

    const ip = context.request.headers.get("CF-Connecting-IP") ?? "";
    const userAgent = context.request.headers.get("User-Agent") ?? "";
    const referer = context.request.headers.get("Referer") ?? "";

    const persist = async () => {
        const nowMs = Date.now();
        const oneMinuteAgo = nowMs - 60_000;
        const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
        const recent = await db
            .prepare(
                `SELECT COUNT(*) AS c
                 FROM submission_headers
                 WHERE ip = ?
                   AND created_at_ms >= ?`,
            )
            .bind(ip, oneMinuteAgo)
            .first<{ c: number }>();
        if ((recent?.c ?? 0) >= MAX_SUBMISSIONS_PER_MINUTE) {
            return json({ error: "送信が多すぎます。少し時間をおいてください。" }, 429);
        }
        const daily = await db
            .prepare(
                `SELECT COUNT(*) AS c
                 FROM submission_headers
                 WHERE ip = ?
                   AND created_at_ms >= ?`,
            )
            .bind(ip, oneDayAgo)
            .first<{ c: number }>();
        if ((daily?.c ?? 0) >= MAX_SUBMISSIONS_PER_DAY) {
            return json(
                { error: "本日の送信上限に達しました。時間をおいて再試行してください。" },
                429,
            );
        }

        const musicCount = safeEntries.filter((entry) => !entry.isMc).length;
        const exportPreview = safeEntries
            .map((entry, index) => {
                const performers = entry.performers ? ` / ${entry.performers}` : "";
                const section =
                    entry.section && entry.section !== "本編"
                        ? `【${entry.section}】 `
                        : "";
                const note = entry.note ? `（${entry.note}）` : "";
                return `${index + 1}. ${section}${entry.songName}${performers}${note}`;
            })
            .join("\n");
        const payloadJson = JSON.stringify({
            submitterName,
            eventName,
            stageDate,
            startTime,
            venueName,
            pattern,
            stageId,
            eventId,
            pageUrl,
            entries: safeEntries,
        });
        const insertHeader = await db
            .prepare(
                `INSERT INTO submission_headers
                (created_at_ms, source, status, submitter_name, event_name, stage_date, start_time, venue_name, pattern,
                 stage_id, event_id, output_format, notify_tomoko, include_event, include_artist, include_performer,
                 performer_delimiter, line_count, music_count, export_preview, payload_json, ip, user_agent, referer)
                VALUES (?, 'setlist_submission', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, 'setlist', 1, 1, 0, 1, '・', ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                nowMs,
                submitterName || null,
                eventName,
                stageDate,
                startTime,
                venueName,
                pattern,
                stageId,
                eventId,
                safeEntries.length,
                musicCount,
                exportPreview,
                payloadJson,
                ip,
                userAgent,
                referer,
            )
            .run();
        const submissionId = Number(insertHeader.meta.last_row_id);
        const statements = safeEntries.map((entry) =>
            db
                .prepare(
                    `INSERT INTO submission_entries
                    (submission_id, line_order, music_order, section, display_name, is_mc, is_medley, is_new_song,
                     note, song_id, song_version_id, artist_name, performers)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
                )
                .bind(
                    submissionId,
                    entry.lineOrder,
                    entry.musicOrder,
                    entry.section,
                    entry.songName,
                    entry.isMc ? 1 : 0,
                    entry.isMedley ? 1 : 0,
                    entry.note,
                    entry.songId,
                    entry.songVersionId,
                    entry.artistName || null,
                    entry.performers || null,
                ),
        );
        try {
            await db.batch(statements);
        } catch (error) {
            await db
                .prepare(`DELETE FROM submission_headers WHERE id = ?`)
                .bind(submissionId)
                .run();
            throw error;
        }
        return { submissionId, lineCount: safeEntries.length, musicCount };
    };

    try {
        const saved = await persist();
        if (saved instanceof Response) return saved;
        return json(
            {
                ok: true,
                id: saved.submissionId,
                lineCount: saved.lineCount,
                musicCount: saved.musicCount,
            },
            200,
        );
    } catch (error) {
        if (isMissingSchemaError(error)) {
            try {
                await ensureSchema(db);
                const saved = await persist();
                if (saved instanceof Response) return saved;
                return json(
                    {
                        ok: true,
                        id: saved.submissionId,
                        lineCount: saved.lineCount,
                        musicCount: saved.musicCount,
                    },
                    200,
                );
            } catch {
                return json({ error: "受付DBの初期化が必要です。" }, 503);
            }
        }
        return json({ error: "保存に失敗しました。" }, 500);
    }
};

export const onRequestGet: PagesFunction<Env> = async () =>
    json({ error: "Method Not Allowed" }, 405);

const clampText = (value: unknown, maxLength: number): string => {
    const text = String(value ?? "").trim();
    return text.length <= maxLength ? text : text.slice(0, maxLength);
};

const toPositiveInt = (value: unknown): number | null => {
    const parsed = toFiniteInt(value);
    return parsed !== null && parsed > 0 ? parsed : null;
};

const normalizePerformers = (
    value: SetlistSubmissionEntry["performersNormalized"],
): Array<{ performerName: string; personId: number | null; groupId: number | null }> => {
    if (!Array.isArray(value)) return [];
    return value
        .map((performer) => ({
            performerName: clampText(performer?.performerName, MAX_TEXT_MEDIUM),
            personId: toPositiveInt(performer?.personId),
            groupId: toPositiveInt(performer?.groupId),
        }))
        .filter((performer) => performer.performerName.length > 0)
        .slice(0, 40);
};

const isMissingSchemaError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    return /no such table|no such column|no column named/i.test(error.message);
};

const ensureSchema = async (db: D1Database): Promise<void> => {
    for (const statement of SCHEMA_STATEMENTS) {
        await db.prepare(statement).run();
    }
    try {
        await db.prepare(`ALTER TABLE submission_headers ADD COLUMN submitter_name TEXT`).run();
    } catch (error) {
        if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) {
            throw error;
        }
    }
};
