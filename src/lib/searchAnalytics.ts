import type { SearchMode } from "./searchUiState";
import type {
    AdvancedConditionField,
    SearchMethod,
    SearchRequest,
    SearchResponse,
    SearchSuggestField,
    SearchUnit,
} from "./setlistSearchDb/types";

type SearchAnalyticsTerm = {
    field: AdvancedConditionField | "query" | "prefectureIds";
    value: string;
    method?: SearchMethod;
};

type SearchAnalyticsPayload = {
    schemaVersion: 1;
    eventKind: "result" | "suggestion";
    searchUnit: SearchUnit;
    searchMode: SearchMode;
    resultCount: number;
    page: number;
    pageSize: number;
    zeroResults: boolean;
    terms: SearchAnalyticsTerm[];
    activeFields: string[];
    dateFrom: string | null;
    dateTo: string | null;
    path: string;
    sentAtMs: number;
};

const ENDPOINT = "/api/search-analytics";
const STORAGE_KEY = "tomoko-duc.search-analytics-queue.v1";
const LAST_SENT_KEY = "tomoko-duc.search-analytics-last-sent.v1";
const MAX_QUEUE_SIZE = 20;
const MAX_TERMS = 20;
const MAX_VALUE_LENGTH = 80;
const SEND_DEBOUNCE_MS = 1500;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const SUGGESTION_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const PII_PATTERNS = [
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,
    /https?:\/\/\S+|www\.\S+/giu,
    /(?:\+?\d[\d\s().-]{8,}\d)/gu,
];

const TEXT_FIELDS = [
    "personName",
    "songName",
    "artistName",
    "lyricistName",
    "composerName",
    "arrangerName",
    "eventName",
    "venueName",
    "eventTag",
    "sectionName",
] as const;

const sanitizeTermValue = (value: unknown): string | null => {
    if (
        value !== null &&
        value !== undefined &&
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
    ) {
        return null;
    }
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

const isEnabled = (): boolean => {
    if (typeof window === "undefined") return false;
    if (window.location.pathname.startsWith("/admin")) return false;
    const explicit = String(import.meta.env.VITE_SEARCH_ANALYTICS_ENABLED ?? "");
    if (explicit === "false" || explicit === "0") return false;
    if (explicit === "true" || explicit === "1") return true;
    return import.meta.env.PROD;
};

const readQueue = (): SearchAnalyticsPayload[] => {
    if (typeof window === "undefined") return [];
    try {
        const parsed: unknown = JSON.parse(
            window.localStorage.getItem(STORAGE_KEY) ?? "[]",
        );
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(isSearchAnalyticsPayload)
            .slice(0, MAX_QUEUE_SIZE);
    } catch {
        return [];
    }
};

const isSearchAnalyticsPayload = (value: unknown): value is SearchAnalyticsPayload =>
    Boolean(
        value &&
            typeof value === "object" &&
            (value as { schemaVersion?: unknown }).schemaVersion === 1 &&
            (((value as { eventKind?: unknown }).eventKind ?? "result") === "result" ||
                (value as { eventKind?: unknown }).eventKind === "suggestion") &&
            ((value as { searchUnit?: unknown }).searchUnit === "stage" ||
                (value as { searchUnit?: unknown }).searchUnit === "setlist"),
    );

const writeQueue = (queue: SearchAnalyticsPayload[]): void => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)),
    );
};

const enqueue = (payload: SearchAnalyticsPayload): void => {
    writeQueue([...readQueue(), payload]);
};

let pendingPayload: SearchAnalyticsPayload | null = null;
let pendingTimer: number | null = null;

const sendPayload = (payload: SearchAnalyticsPayload): boolean => {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(ENDPOINT, blob)) {
            return true;
        }
    }
    void fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
    }).catch(() => {
        enqueue(payload);
    });
    return true;
};

const stablePayloadSignature = (payload: SearchAnalyticsPayload): string =>
    JSON.stringify({
        eventKind: payload.eventKind,
        searchUnit: payload.searchUnit,
        searchMode: payload.searchMode,
        terms: payload.terms,
        activeFields: payload.activeFields,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        path: payload.path,
    });

const wasRecentlySent = (
    signature: string,
    nowMs: number,
    windowMs = DEDUPE_WINDOW_MS,
): boolean => {
    if (typeof window === "undefined") return false;
    try {
        const parsed: unknown = JSON.parse(
            window.localStorage.getItem(LAST_SENT_KEY) ?? "null",
        );
        if (!parsed || typeof parsed !== "object") return false;
        const record = parsed as { signature?: unknown; sentAtMs?: unknown };
        return (
            record.signature === signature &&
            typeof record.sentAtMs === "number" &&
            nowMs - record.sentAtMs < windowMs
        );
    } catch {
        return false;
    }
};

const rememberSent = (signature: string, sentAtMs: number): void => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
        LAST_SENT_KEY,
        JSON.stringify({ signature, sentAtMs }),
    );
};

const sendPendingPayload = (): void => {
    pendingTimer = null;
    const payload = pendingPayload;
    pendingPayload = null;
    if (!payload) return;

    const signature = stablePayloadSignature(payload);
    const nowMs = Date.now();
    if (wasRecentlySent(signature, nowMs)) return;
    rememberSent(signature, nowMs);
    flushSearchAnalyticsQueue();
    sendPayload({ ...payload, sentAtMs: nowMs });
};

export const flushSearchAnalyticsQueue = (): void => {
    if (!isEnabled()) return;
    const queued = readQueue();
    if (queued.length === 0) return;
    writeQueue([]);
    for (const payload of queued) {
        sendPayload(payload);
    }
};

const buildTerms = (request: SearchRequest): SearchAnalyticsTerm[] => {
    const terms: SearchAnalyticsTerm[] = [];
    const push = (
        field: SearchAnalyticsTerm["field"],
        value: unknown,
        method?: SearchMethod,
    ) => {
        const sanitized = sanitizeTermValue(value);
        if (!sanitized) return;
        terms.push({ field, value: sanitized, method });
    };

    push("query", request.term);
    for (const field of TEXT_FIELDS) {
        push(field, request[field], request.fieldSearchMethods[field]);
    }
    push("prefectureIds", request.prefectureIds, "exact");

    for (const group of request.conditionGroups ?? []) {
        for (const condition of group.values) {
            push(condition.field, condition.value, condition.method);
        }
    }

    return terms.slice(0, MAX_TERMS);
};

const buildActiveFields = (request: SearchRequest, terms: SearchAnalyticsTerm[]): string[] => {
    const fields = new Set<string>();
    for (const term of terms) {
        fields.add(term.field);
    }
    if (request.dateFrom || request.dateTo) fields.add("date");
    if (request.conditionGroups?.length) fields.add("conditionGroups");
    return Array.from(fields).sort();
};

export const recordSearchAnalytics = (
    request: SearchRequest,
    response: SearchResponse,
    searchMode: SearchMode,
): void => {
    if (!isEnabled()) return;
    const terms = buildTerms(request);
    const activeFields = buildActiveFields(request, terms);
    if (activeFields.length === 0) return;

    const payload: SearchAnalyticsPayload = {
        schemaVersion: 1,
        eventKind: "result",
        searchUnit: request.searchUnit,
        searchMode,
        resultCount: Math.max(0, Math.trunc(Number(response.total) || 0)),
        page: Math.max(1, Math.trunc(Number(response.page) || 1)),
        pageSize: Math.max(1, Math.trunc(Number(response.limit) || request.limit || 1)),
        zeroResults: Number(response.total) === 0,
        terms,
        activeFields,
        dateFrom: sanitizeTermValue(request.dateFrom),
        dateTo: sanitizeTermValue(request.dateTo),
        path: window.location.pathname,
        sentAtMs: Date.now(),
    };

    pendingPayload = payload;
    if (pendingTimer !== null) {
        window.clearTimeout(pendingTimer);
    }
    pendingTimer = window.setTimeout(() => {
        const idleCallback = window.requestIdleCallback;
        if (idleCallback) {
            idleCallback(sendPendingPayload, { timeout: 2000 });
            return;
        }
        sendPendingPayload();
    }, SEND_DEBOUNCE_MS);
};

const suggestionFieldToAnalyticsField = (
    field: SearchSuggestField,
): SearchAnalyticsTerm["field"] | null => {
    if (field === "query") return "query";
    if (
        field === "songName" ||
        field === "personName" ||
        field === "artistName" ||
        field === "lyricistName" ||
        field === "composerName" ||
        field === "arrangerName" ||
        field === "eventName" ||
        field === "venueName" ||
        field === "sectionName" ||
        field === "eventTag"
    ) {
        return field;
    }
    return null;
};

export const recordSuggestionAnalytics = (params: {
    field: SearchSuggestField;
    value: string;
    searchUnit: SearchUnit;
    searchMode?: SearchMode;
}): void => {
    if (!isEnabled()) return;
    const field = suggestionFieldToAnalyticsField(params.field);
    if (!field) return;
    const value = sanitizeTermValue(params.value);
    if (!value) return;

    const nowMs = Date.now();
    const payload: SearchAnalyticsPayload = {
        schemaVersion: 1,
        eventKind: "suggestion",
        searchUnit: params.searchUnit,
        searchMode: params.searchMode ?? "advanced",
        resultCount: 0,
        page: 1,
        pageSize: 1,
        zeroResults: false,
        terms: [{ field, value }],
        activeFields: [field, "suggestionSelection"],
        dateFrom: null,
        dateTo: null,
        path: window.location.pathname,
        sentAtMs: nowMs,
    };
    const signature = stablePayloadSignature(payload);
    if (wasRecentlySent(signature, nowMs, SUGGESTION_DEDUPE_WINDOW_MS)) return;
    rememberSent(signature, nowMs);
    flushSearchAnalyticsQueue();
    sendPayload(payload);
};
