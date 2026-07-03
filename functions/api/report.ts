import {
    json,
    rejectDisallowedOrigin,
    rejectInvalidJsonRequest,
    toFiniteInt,
} from "../_shared/security";

type Env = {
    REPORTS_DB?: D1Database;
};

type ReportRequest = {
    message?: string;
    pageUrl?: string;
    pageTitle?: string;
    routeName?: string;
    routeId?: number | null;
    reportType?: string;
    contactName?: string;
    contactEmail?: string;
    sourceContext?: string;
};

const MAX_CONTENT_LENGTH = 32 * 1024;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_URL_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;
const MAX_ROUTE_NAME_LENGTH = 40;
const MAX_REPORT_TYPE_LENGTH = 40;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;
const MAX_SOURCE_CONTEXT_LENGTH = 80;
const MAX_REPORTS_PER_MINUTE = 5;
const MAX_REPORTS_PER_DAY = 80;
const ROUTE_NAME_PATTERN = /^[a-z0-9_-]+$/i;
const REPORT_TYPES = new Set(["correction", "missing_info", "request", "other"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPORT_SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS report_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at_ms INTEGER NOT NULL,
      route_name TEXT NOT NULL,
      route_id INTEGER,
      page_url TEXT NOT NULL,
      page_title TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      status_updated_at_ms INTEGER,
      handled_note TEXT,
      report_type TEXT NOT NULL DEFAULT 'correction',
      contact_name TEXT,
      contact_email TEXT,
      source_context TEXT,
      github_issue_url TEXT,
      ip TEXT,
      user_agent TEXT,
      referer TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_report_messages_created_at_ms
      ON report_messages(created_at_ms DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_report_messages_route
      ON report_messages(route_name, route_id, created_at_ms DESC)`,
] as const;
const REPORT_SCHEMA_COLUMN_STATEMENTS = [
    `ALTER TABLE report_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`,
    `ALTER TABLE report_messages ADD COLUMN status_updated_at_ms INTEGER`,
    `ALTER TABLE report_messages ADD COLUMN handled_note TEXT`,
    `ALTER TABLE report_messages ADD COLUMN report_type TEXT NOT NULL DEFAULT 'correction'`,
    `ALTER TABLE report_messages ADD COLUMN contact_name TEXT`,
    `ALTER TABLE report_messages ADD COLUMN contact_email TEXT`,
    `ALTER TABLE report_messages ADD COLUMN source_context TEXT`,
    `ALTER TABLE report_messages ADD COLUMN github_issue_url TEXT`,
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

    let body: ReportRequest;
    try {
        body = (await context.request.json()) as ReportRequest;
    } catch {
        return json({ error: "不正なリクエストです。" }, 400);
    }

    const message = String(body.message ?? "").trim();
    const pageUrl = clampText(body.pageUrl, MAX_URL_LENGTH);
    const pageTitle = clampText(body.pageTitle, MAX_TITLE_LENGTH);
    const routeName = clampText(body.routeName, MAX_ROUTE_NAME_LENGTH);
    const routeId =
        body.routeId === null || body.routeId === undefined
            ? null
            : toFiniteInt(body.routeId);
    const requestedReportType = clampText(body.reportType, MAX_REPORT_TYPE_LENGTH);
    const reportType = REPORT_TYPES.has(requestedReportType)
        ? requestedReportType
        : "correction";
    const contactName = String(body.contactName ?? "").trim();
    const contactEmail = String(body.contactEmail ?? "").trim();
    const sourceContext = clampText(body.sourceContext, MAX_SOURCE_CONTEXT_LENGTH);

    if (message.length < 3 || message.length > MAX_MESSAGE_LENGTH) {
        return json(
            { error: `メモは3文字以上${MAX_MESSAGE_LENGTH}文字以内で入力してください。` },
            400,
        );
    }
    if (!pageUrl || !routeName) {
        return json({ error: "ページ情報が不足しています。" }, 400);
    }
    if (!ROUTE_NAME_PATTERN.test(routeName)) {
        return json({ error: "routeName が不正です。" }, 400);
    }
    if (body.routeId !== null && body.routeId !== undefined && routeId === null) {
        return json({ error: "ページIDが不正です。" }, 400);
    }
    if (!isValidHttpUrl(pageUrl)) {
        return json({ error: "pageUrl が不正です。" }, 400);
    }
    if (contactName.length > MAX_NAME_LENGTH) {
        return json({ error: "お名前は80文字以内で入力してください。" }, 400);
    }
    if (
        contactEmail &&
        (contactEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(contactEmail))
    ) {
        return json({ error: "メールアドレスの形式が不正です。" }, 400);
    }

    const ip = context.request.headers.get("CF-Connecting-IP") ?? "";
    const userAgent = context.request.headers.get("User-Agent") ?? "";
    const referer = context.request.headers.get("Referer") ?? "";

    const persistReport = async () => {
        const nowMs = Date.now();
        const oneMinuteAgo = nowMs - 60_000;
        const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
        const recent = await db
            .prepare(
                `SELECT COUNT(*) AS c
                 FROM report_messages
                 WHERE ip = ?
                   AND created_at_ms >= ?`,
            )
            .bind(ip, oneMinuteAgo)
            .first<{ c: number }>();
        if ((recent?.c ?? 0) >= MAX_REPORTS_PER_MINUTE) {
            return json(
                { error: "送信が多すぎます。少し時間をおいてください。" },
                429,
            );
        }
        const daily = await db
            .prepare(
                `SELECT COUNT(*) AS c
                 FROM report_messages
                 WHERE ip = ?
                   AND created_at_ms >= ?`,
            )
            .bind(ip, oneDayAgo)
            .first<{ c: number }>();
        if ((daily?.c ?? 0) >= MAX_REPORTS_PER_DAY) {
            return json(
                { error: "本日の送信上限に達しました。時間をおいて再試行してください。" },
                429,
            );
        }

        const insert = await db
            .prepare(
                `INSERT INTO report_messages
                (created_at_ms, route_name, route_id, page_url, page_title, message,
                 report_type, contact_name, contact_email, source_context, ip, user_agent, referer)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                nowMs,
                routeName,
                routeId,
                pageUrl,
                pageTitle,
                message,
                reportType,
                contactName || null,
                contactEmail || null,
                sourceContext || null,
                ip,
                userAgent,
                referer,
            )
            .run();

        return { id: insert.meta.last_row_id };
    };

    try {
        const saved = await persistReport();
        if (saved instanceof Response) return saved;
        return json({ ok: true, id: saved.id }, 200);
    } catch (error) {
        if (isMissingTableError(error) || isMissingColumnError(error)) {
            try {
                await ensureReportSchema(db);
                const saved = await persistReport();
                if (saved instanceof Response) return saved;
                return json({ ok: true, id: saved.id }, 200);
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
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength);
};

const isValidHttpUrl = (value: string): boolean => {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
};

const isMissingTableError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    return /no such table/i.test(error.message);
};

const isMissingColumnError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    return /no column named|no such column/i.test(error.message);
};

const ensureReportSchema = async (db: D1Database): Promise<void> => {
    for (const statement of REPORT_SCHEMA_STATEMENTS) {
        await db.prepare(statement).run();
    }
    for (const statement of REPORT_SCHEMA_COLUMN_STATEMENTS) {
        try {
            await db.prepare(statement).run();
        } catch (error) {
            if (!isDuplicateColumnError(error)) throw error;
        }
    }
};

const isDuplicateColumnError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    return /duplicate column name/i.test(error.message);
};
