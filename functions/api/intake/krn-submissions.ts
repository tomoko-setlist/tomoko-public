import {
    json,
    rejectDisallowedOrigin,
    rejectInvalidJsonRequest,
    toFiniteInt,
} from "../../_shared/security";

type Env = {
    REPORTS_DB?: D1Database;
};

type KrnSubmissionEntry = {
    lineOrder: number;
    musicOrder: number | null;
    section: string;
    displayName: string;
    isMc: boolean;
    isMedley: boolean;
    isNewSong: boolean;
    note: string;
    songId: number | null;
    songVersionId: number | null;
    songArtistId?: number | null;
    artistName: string;
    performers: string[];
    performersNormalized?: Array<{
        performerName: string;
        personId?: number | null;
        groupId?: number | null;
    }>;
};

type KrnSubmissionRequest = {
    routeName?: string;
    routeId?: number | null;
    eventName?: string;
    stageDate?: string;
    startTime?: string;
    venueName?: string;
    pattern?: string;
    stageId?: number | null;
    eventId?: number | null;
    outputFormat?: string;
    notifyTomoko?: boolean;
    options?: {
        includeEvent?: boolean;
        includeArtist?: boolean;
        includePerformer?: boolean;
        performerDelimiter?: string;
    };
    exportPreview?: string;
    entries?: KrnSubmissionEntry[];
};

const MAX_CONTENT_LENGTH = 512 * 1024;
const MAX_TEXT_SHORT = 120;
const MAX_TEXT_MEDIUM = 300;
const MAX_TEXT_PREVIEW = 120_000;
const MAX_PERFORMERS_PER_ROW = 40;
const MAX_PERFORMER_NAME = 120;
const MAX_ROWS = 400;
const MAX_SUBMISSIONS_PER_MINUTE = 10;
const MAX_SUBMISSIONS_PER_DAY = 120;
const ALLOWED_OUTPUT_FORMATS = new Set(["text", "csv", "image", "html", "twitter"]);
const KRN_SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS submission_headers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at_ms INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'krn',
      status TEXT NOT NULL DEFAULT 'pending',
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
    if (!db) {
        return json({ error: "REPORTS_DB が未設定です。" }, 500);
    }

    let rawBody: unknown;
    try {
        rawBody = await context.request.json();
    } catch {
        return json({ error: "不正なリクエストです。" }, 400);
    }
    const body = rawBody as KrnSubmissionRequest;

    const routeName = String(body.routeName ?? "krn").trim().toLowerCase() || "krn";
    if (routeName !== "krn") {
        return json({ error: "routeName が不正です。" }, 400);
    }
    const routeId =
        body.routeId === null || body.routeId === undefined ? null : toFiniteInt(body.routeId);
    if (
        body.routeId !== null &&
        body.routeId !== undefined &&
        (routeId === null || routeId <= 0)
    ) {
        return json({ error: "routeId が不正です。" }, 400);
    }

    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) {
        return json({ error: "entries が空です。" }, 400);
    }
    if (entries.length > MAX_ROWS) {
        return json({ error: `entries が多すぎます (上限${MAX_ROWS}行)。` }, 400);
    }

    const outputFormat = String(body.outputFormat ?? "").trim();
    if (!ALLOWED_OUTPUT_FORMATS.has(outputFormat)) {
        return json({ error: "outputFormat が不正です。" }, 400);
    }

    const eventName = clampText(body.eventName, MAX_TEXT_MEDIUM);
    const stageDate = clampText(body.stageDate, MAX_TEXT_SHORT);
    const startTime = clampText(body.startTime, MAX_TEXT_SHORT);
    const venueName = clampText(body.venueName, MAX_TEXT_MEDIUM);
    const pattern = clampText(body.pattern, MAX_TEXT_SHORT);
    const stageId = body.stageId === null || body.stageId === undefined ? null : toFiniteInt(body.stageId);
    const eventId = body.eventId === null || body.eventId === undefined ? null : toFiniteInt(body.eventId);
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

    const includeEvent = Boolean(body.options?.includeEvent);
    const includeArtist = Boolean(body.options?.includeArtist);
    const includePerformer = Boolean(body.options?.includePerformer);
    const performerDelimiter = clampText(body.options?.performerDelimiter, 16) || "・";
    const notifyTomoko = Boolean(body.notifyTomoko);
    const exportPreview = clampText(body.exportPreview, MAX_TEXT_PREVIEW);

    const normalizedEntries = normalizeEntries(entries);
    if (normalizedEntries.error) {
        return json({ error: normalizedEntries.error }, 400);
    }
    const safeEntries = normalizedEntries.value;

    const ip = context.request.headers.get("CF-Connecting-IP") ?? "";
    const userAgent = context.request.headers.get("User-Agent") ?? "";
    const referer = context.request.headers.get("Referer") ?? "";

    const persistSubmission = async () => {
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
            return json(
                { error: "送信が多すぎます。少し時間をおいてください。" },
                429,
            );
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

        const lineCount = safeEntries.length;
        const musicCount = safeEntries.filter((row) => !row.isMc).length;
        const payloadJson = JSON.stringify({
            routeName,
            routeId,
            eventName,
            stageDate,
            startTime,
            venueName,
            pattern,
            stageId,
            eventId,
            outputFormat,
            notifyTomoko,
            options: {
                includeEvent,
                includeArtist,
                includePerformer,
                performerDelimiter,
            },
            exportPreview,
            entries: safeEntries,
        });
        if (payloadJson.length > MAX_TEXT_PREVIEW) {
            return json({ error: "送信データが大きすぎます。" }, 413);
        }

        const insertHeader = await db
            .prepare(
                `INSERT INTO submission_headers
                (created_at_ms, source, status, event_name, stage_date, start_time, venue_name, pattern, stage_id, event_id,
                 output_format, notify_tomoko, include_event, include_artist, include_performer, performer_delimiter,
                 line_count, music_count, export_preview, payload_json, ip, user_agent, referer)
                VALUES (?, 'krn', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                nowMs,
                eventName,
                stageDate,
                startTime,
                venueName,
                pattern,
                stageId,
                eventId,
                outputFormat,
                notifyTomoko ? 1 : 0,
                includeEvent ? 1 : 0,
                includeArtist ? 1 : 0,
                includePerformer ? 1 : 0,
                performerDelimiter,
                lineCount,
                musicCount,
                exportPreview,
                payloadJson,
                ip,
                userAgent,
                referer,
            )
            .run();

        const submissionId = Number(insertHeader.meta.last_row_id);

        const entryStatements: D1PreparedStatement[] = [];
        for (const entry of safeEntries) {
            entryStatements.push(
                db
                .prepare(
                    `INSERT INTO submission_entries
                    (submission_id, line_order, music_order, section, display_name, is_mc, is_medley, is_new_song,
                     note, song_id, song_version_id, artist_name, performers)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .bind(
                    submissionId,
                    entry.lineOrder,
                    entry.musicOrder,
                    entry.section,
                    entry.displayName,
                    entry.isMc ? 1 : 0,
                    entry.isMedley ? 1 : 0,
                    entry.isNewSong ? 1 : 0,
                    entry.note,
                    entry.songId,
                    entry.songVersionId,
                    entry.artistName,
                    entry.performers.join("・"),
                ),
            );
        }
        try {
            if (entryStatements.length > 0) {
                await db.batch(entryStatements);
            }
        } catch (entryError) {
            await db
                .prepare(`DELETE FROM submission_headers WHERE id = ?`)
                .bind(submissionId)
                .run();
            throw entryError;
        }

        return { submissionId, lineCount, musicCount };
    };

    try {
        const saved = await persistSubmission();
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
        if (isMissingTableError(error)) {
            try {
                await ensureKrnSchema(db);
                const saved = await persistSubmission();
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

type NormalizedKrnSubmissionEntry = {
    lineOrder: number;
    musicOrder: number | null;
    section: string;
    displayName: string;
    isMc: boolean;
    isMedley: boolean;
    isNewSong: boolean;
    note: string;
    songId: number | null;
    songVersionId: number | null;
    artistName: string;
    performers: string[];
};

type NormalizeEntriesResult =
    | { value: NormalizedKrnSubmissionEntry[]; error?: undefined }
    | { value?: undefined; error: string };

const clampText = (value: unknown, maxLength: number): string => {
    const text = String(value ?? "").trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength);
};

const normalizeEntries = (entries: KrnSubmissionEntry[]): NormalizeEntriesResult => {
    const normalized: NormalizedKrnSubmissionEntry[] = [];
    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const rowNo = index + 1;
        const lineOrder = toFiniteInt(entry.lineOrder);
        if (lineOrder === null || lineOrder <= 0) {
            return { error: `entries[${rowNo}] の lineOrder が不正です。` };
        }
        const musicOrder =
            entry.musicOrder === null || entry.musicOrder === undefined
                ? null
                : toFiniteInt(entry.musicOrder);
        if (
            entry.musicOrder !== null &&
            entry.musicOrder !== undefined &&
            (musicOrder === null || musicOrder <= 0)
        ) {
            return { error: `entries[${rowNo}] の musicOrder が不正です。` };
        }
        const songId =
            entry.songId === null || entry.songId === undefined
                ? null
                : toFiniteInt(entry.songId);
        if (
            entry.songId !== null &&
            entry.songId !== undefined &&
            (songId === null || songId <= 0)
        ) {
            return { error: `entries[${rowNo}] の songId が不正です。` };
        }
        const songVersionId =
            entry.songVersionId === null || entry.songVersionId === undefined
                ? null
                : toFiniteInt(entry.songVersionId);
        if (
            entry.songVersionId !== null &&
            entry.songVersionId !== undefined &&
            (songVersionId === null || songVersionId <= 0)
        ) {
            return { error: `entries[${rowNo}] の songVersionId が不正です。` };
        }

        const performersRaw = Array.isArray(entry.performersNormalized)
            ? entry.performersNormalized
                  .map((row) => clampText(row.performerName, MAX_PERFORMER_NAME))
                  .filter((name) => name.length > 0)
            : Array.isArray(entry.performers)
              ? entry.performers
                    .map((name) => clampText(name, MAX_PERFORMER_NAME))
                    .filter((name) => name.length > 0)
              : [];
        const uniquePerformers = Array.from(new Set(performersRaw));
        if (uniquePerformers.length > MAX_PERFORMERS_PER_ROW) {
            return { error: `entries[${rowNo}] の歌唱者数が多すぎます。` };
        }

        const displayName = clampText(entry.displayName, MAX_TEXT_MEDIUM);
        if (displayName.length === 0) {
            return { error: `entries[${rowNo}] の displayName は必須です。` };
        }

        normalized.push({
            lineOrder,
            musicOrder,
            section: clampText(entry.section, MAX_TEXT_SHORT),
            displayName,
            isMc: Boolean(entry.isMc),
            isMedley: Boolean(entry.isMedley),
            isNewSong: Boolean(entry.isNewSong),
            note: clampText(entry.note, MAX_TEXT_MEDIUM),
            songId,
            songVersionId,
            artistName: clampText(entry.artistName, MAX_TEXT_SHORT),
            performers: uniquePerformers,
        });
    }
    return { value: normalized };
};

const isMissingTableError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    return /no such table/i.test(error.message);
};

const ensureKrnSchema = async (db: D1Database): Promise<void> => {
    for (const statement of KRN_SCHEMA_STATEMENTS) {
        await db.prepare(statement).run();
    }
};
