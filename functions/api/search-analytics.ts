import {
    json,
    rejectDisallowedOrigin,
    rejectInvalidJsonRequest,
    toFiniteInt,
} from "../_shared/security";

type Env = {
    REPORTS_DB?: D1Database;
};

type RawSearchAnalyticsTerm = {
    field?: unknown;
    value?: unknown;
    method?: unknown;
};

type RawSearchAnalyticsRequest = {
    schemaVersion?: unknown;
    eventKind?: unknown;
    searchUnit?: unknown;
    searchMode?: unknown;
    resultCount?: unknown;
    page?: unknown;
    pageSize?: unknown;
    zeroResults?: unknown;
    terms?: unknown;
    activeFields?: unknown;
    dateFrom?: unknown;
    dateTo?: unknown;
    path?: unknown;
    sentAtMs?: unknown;
};

type SearchAnalyticsTerm = {
    field: string;
    value: string;
    method: string | null;
};

type SearchAnalyticsRecord = {
    schemaVersion: number;
    eventKind: "result" | "suggestion";
    searchUnit: "stage" | "setlist";
    searchMode: "simple" | "advanced";
    resultCount: number;
    page: number;
    pageSize: number;
    zeroResults: boolean;
    terms: SearchAnalyticsTerm[];
    activeFields: string[];
    dateFrom: string | null;
    dateTo: string | null;
    path: string;
    sentAtMs: number | null;
};

const MAX_CONTENT_LENGTH = 8 * 1024;
const MAX_TERMS = 20;
const MAX_VALUE_LENGTH = 80;
const MAX_FIELD_LENGTH = 32;
const MAX_PATH_LENGTH = 120;
const ALLOWED_FIELDS = new Set([
    "query",
    "songName",
    "personName",
    "artistName",
    "lyricistName",
    "composerName",
    "arrangerName",
    "eventName",
    "venueName",
    "eventTag",
    "sectionName",
    "prefectureId",
    "prefectureIds",
]);
const ALLOWED_METHODS = new Set([
    "contains",
    "notContains",
    "exact",
    "notExact",
    "startsWith",
    "endsWith",
]);
const PII_PATTERNS = [
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,
    /https?:\/\/\S+|www\.\S+/giu,
    /(?:\+?\d[\d\s().-]{8,}\d)/gu,
];
const SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS search_usage_events (
	      id INTEGER PRIMARY KEY AUTOINCREMENT,
	      created_at_ms INTEGER NOT NULL,
	      schema_version INTEGER NOT NULL,
	      search_unit TEXT NOT NULL,
      search_mode TEXT NOT NULL,
      result_count INTEGER NOT NULL,
      zero_results INTEGER NOT NULL,
      page INTEGER NOT NULL,
      page_size INTEGER NOT NULL,
      terms_json TEXT NOT NULL,
      active_fields_csv TEXT NOT NULL,
      date_from TEXT,
      date_to TEXT,
      path TEXT NOT NULL,
      client_sent_at_ms INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_search_usage_events_created_at_ms
      ON search_usage_events(created_at_ms DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_search_usage_events_zero_results
      ON search_usage_events(zero_results, created_at_ms DESC)`,
	    `CREATE INDEX IF NOT EXISTS idx_search_usage_events_unit_mode
	      ON search_usage_events(search_unit, search_mode, created_at_ms DESC)`,
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

    let body: RawSearchAnalyticsRequest;
    try {
        body = (await context.request.json()) as RawSearchAnalyticsRequest;
    } catch {
        return json({ error: "不正なリクエストです。" }, 400);
    }

    const record = buildSearchAnalyticsRecord(body);
    if (!record) {
        return json({ ok: true, accepted: false }, 202);
    }

    context.waitUntil(persistSearchAnalytics(db, record));
    return json({ ok: true, accepted: true }, 202);
};

export const onRequestGet: PagesFunction<Env> = async () =>
    json({ error: "Method Not Allowed" }, 405);

export const sanitizeSearchAnalyticsText = (value: unknown): string | null => {
    let text = String(value ?? "").trim();
    if (!text) return null;
    for (const pattern of PII_PATTERNS) {
        text = text.replace(pattern, " ");
    }
    text = text.replace(/\s+/gu, " ").trim();
    if (!text || text.length > MAX_VALUE_LENGTH) return null;
    const digitCount = Array.from(text.matchAll(/\d/gu)).length;
    if (digitCount > 8 || digitCount > Math.max(4, text.length / 2)) return null;
    return text;
};

export const buildSearchAnalyticsRecord = (
    body: RawSearchAnalyticsRequest,
): SearchAnalyticsRecord | null => {
    const searchUnit = body.searchUnit === "stage" ? "stage" : "setlist";
    const searchMode = body.searchMode === "simple" ? "simple" : "advanced";
    const eventKind = body.eventKind === "suggestion" ? "suggestion" : "result";
    const resultCount = Math.max(0, toFiniteInt(body.resultCount) ?? 0);
    const page = Math.max(1, toFiniteInt(body.page) ?? 1);
    const pageSize = Math.max(1, Math.min(500, toFiniteInt(body.pageSize) ?? 50));
    const rawTerms = Array.isArray(body.terms) ? body.terms : [];
    const terms: SearchAnalyticsTerm[] = [];
    for (const raw of rawTerms.slice(0, MAX_TERMS)) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as RawSearchAnalyticsTerm;
        const field = clampToken(item.field, MAX_FIELD_LENGTH);
        if (!field || !ALLOWED_FIELDS.has(field)) continue;
        const value = sanitizeSearchAnalyticsText(item.value);
        if (!value) continue;
        const method = clampToken(item.method, MAX_FIELD_LENGTH);
        terms.push({
            field,
            value,
            method: method && ALLOWED_METHODS.has(method) ? method : null,
        });
    }

    const activeFields = Array.isArray(body.activeFields)
        ? Array.from(
              new Set(
                  body.activeFields
                      .map((field) => clampToken(field, MAX_FIELD_LENGTH))
                      .filter((field): field is string => Boolean(field)),
              ),
          ).slice(0, MAX_TERMS)
        : [];
    for (const term of terms) {
        if (!activeFields.includes(term.field)) {
            activeFields.push(term.field);
        }
    }
    if (activeFields.length === 0) return null;

    return {
        schemaVersion: 1,
        eventKind,
        searchUnit,
        searchMode,
        resultCount,
        page,
        pageSize,
        zeroResults: body.zeroResults === true || resultCount === 0,
        terms,
        activeFields: activeFields.sort(),
        dateFrom: sanitizeDate(body.dateFrom),
        dateTo: sanitizeDate(body.dateTo),
        path: sanitizePath(body.path),
        sentAtMs: toFiniteInt(body.sentAtMs),
    };
};

const persistSearchAnalytics = async (
    db: D1Database,
    record: SearchAnalyticsRecord,
): Promise<void> => {
    try {
        await ensureSearchAnalyticsSchema(db);
        await insertSearchAnalytics(db, record);
    } catch (error) {
        if (!isMissingStorageError(error)) throw error;
        await ensureSearchAnalyticsSchema(db);
        await insertSearchAnalytics(db, record);
    }
};

const insertSearchAnalytics = async (
    db: D1Database,
    record: SearchAnalyticsRecord,
): Promise<void> => {
    await db
        .prepare(
            `INSERT INTO search_usage_events
            (created_at_ms, schema_version, search_unit, search_mode, result_count,
             zero_results, page, page_size, terms_json, active_fields_csv, date_from,
             date_to, path, client_sent_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
            Date.now(),
            record.schemaVersion,
            record.searchUnit,
            record.searchMode,
            record.resultCount,
            record.zeroResults ? 1 : 0,
            record.page,
            record.pageSize,
            JSON.stringify(record.terms),
            record.activeFields.join(","),
            record.dateFrom,
            record.dateTo,
            record.path,
            record.sentAtMs,
        )
        .run();
};

const ensureSearchAnalyticsSchema = async (db: D1Database): Promise<void> => {
    for (const statement of SCHEMA_STATEMENTS) {
        await db.prepare(statement).run();
    }
};

const clampToken = (value: unknown, maxLength: number): string | null => {
    const text = String(value ?? "").trim();
    if (!text || text.length > maxLength) return null;
    return /^[a-zA-Z0-9_-]+$/u.test(text) ? text : null;
};

const sanitizeDate = (value: unknown): string | null => {
    const text = String(value ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : null;
};

const sanitizePath = (value: unknown): string => {
    const text = String(value ?? "").trim();
    if (!text.startsWith("/")) return "/";
    const path = text.split(/[?#]/u)[0] ?? "/";
    return path.slice(0, MAX_PATH_LENGTH);
};

const isMissingStorageError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    return /no such table/i.test(error.message);
};
