import type { SearchMode } from "./searchUiState";
import type {
    MemberSearchRequest,
    MemberSearchResponse,
    SearchMethod,
    SearchRequest,
    SearchResponse,
    SearchSuggestField,
    SearchUnit,
    SongRankingRequest,
    SongRankingResponse,
    SongSearchRequest,
    SongSearchResponse,
} from "./setlistSearchDb/types";

type SearchAnalyticsEnvironment = "production" | "staging" | "local" | "unknown";
type SearchAnalyticsSurface = SearchUnit | "song" | "member" | "ranking";
type SearchAnalyticsTerm = {
    field: string;
    value: string;
    method?: SearchMethod;
};

type SearchAnalyticsPayload = {
    schemaVersion: 1;
    eventKind: "result" | "suggestion";
    appEnvironment: SearchAnalyticsEnvironment;
    searchUnit: SearchAnalyticsSurface;
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
const SEND_DEBOUNCE_MS = 5000;
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

const normalizeAppEnvironment = (value: unknown): SearchAnalyticsEnvironment => {
    const text =
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
            ? String(value).trim().toLowerCase()
            : "";
    if (text === "production" || text === "prod") return "production";
    if (text === "staging" || text === "stg") return "staging";
    if (text === "local" || text === "development" || text === "dev") return "local";
    return "unknown";
};

const currentAppEnvironment = (): SearchAnalyticsEnvironment =>
    normalizeAppEnvironment(import.meta.env.VITE_APP_ENV);

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
            isSearchAnalyticsSurface((value as { searchUnit?: unknown }).searchUnit),
    );

const isSearchAnalyticsSurface = (
    value: unknown,
): value is SearchAnalyticsSurface =>
    value === "stage" ||
    value === "setlist" ||
    value === "song" ||
    value === "member" ||
    value === "ranking";

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
        appEnvironment: payload.appEnvironment,
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

const pushAnalyticsTerm = (
    terms: SearchAnalyticsTerm[],
    field: string,
    value: unknown,
    method?: SearchMethod,
): void => {
    const sanitized = sanitizeTermValue(value);
    if (!sanitized) return;
    terms.push({ field, value: sanitized, method });
};

const buildActiveFieldsFromTerms = (
    terms: SearchAnalyticsTerm[],
    extraFields: string[] = [],
): string[] =>
    Array.from(
        new Set([
            ...terms.map((term) => term.field),
            ...extraFields.filter((field) => field.trim().length > 0),
        ]),
    ).sort();

const scheduleResultPayload = (payload: SearchAnalyticsPayload): void => {
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

export const recordGenericSearchAnalytics = (params: {
    searchUnit: SearchAnalyticsSurface;
    searchMode?: SearchMode;
    resultCount: number;
    page: number;
    pageSize: number;
    terms: SearchAnalyticsTerm[];
    activeFields?: string[];
    dateFrom?: string | null;
    dateTo?: string | null;
}): void => {
    if (!isEnabled()) return;
    const terms = params.terms.slice(0, MAX_TERMS);
    const activeFields = buildActiveFieldsFromTerms(terms, params.activeFields).slice(
        0,
        MAX_TERMS,
    );
    if (activeFields.length === 0) return;

    scheduleResultPayload({
        schemaVersion: 1,
        eventKind: "result",
        appEnvironment: currentAppEnvironment(),
        searchUnit: params.searchUnit,
        searchMode: params.searchMode ?? "advanced",
        resultCount: Math.max(0, Math.trunc(Number(params.resultCount) || 0)),
        page: Math.max(1, Math.trunc(Number(params.page) || 1)),
        pageSize: Math.max(1, Math.trunc(Number(params.pageSize) || 1)),
        zeroResults: Number(params.resultCount) === 0,
        terms,
        activeFields,
        dateFrom: sanitizeTermValue(params.dateFrom),
        dateTo: sanitizeTermValue(params.dateTo),
        path: window.location.pathname,
        sentAtMs: Date.now(),
    });
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
        appEnvironment: currentAppEnvironment(),
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

    scheduleResultPayload(payload);
};

export const recordSongSearchAnalytics = (
    request: SongSearchRequest,
    response: SongSearchResponse,
): void => {
    const terms: SearchAnalyticsTerm[] = [];
    pushAnalyticsTerm(terms, "query", request.term);
    pushAnalyticsTerm(terms, "songName", request.songName, request.fieldSearchMethods.songName);
    pushAnalyticsTerm(
        terms,
        "artistName",
        request.artistName,
        request.fieldSearchMethods.artistName,
    );
    pushAnalyticsTerm(
        terms,
        "lyricistName",
        request.lyricistName,
        request.fieldSearchMethods.lyricistName,
    );
    pushAnalyticsTerm(
        terms,
        "composerName",
        request.composerName,
        request.fieldSearchMethods.composerName,
    );
    pushAnalyticsTerm(
        terms,
        "arrangerName",
        request.arrangerName,
        request.fieldSearchMethods.arrangerName,
    );
    pushAnalyticsTerm(
        terms,
        "albumName",
        request.albumName,
        request.fieldSearchMethods.albumName,
    );
    const categories = request.songCategories ?? [];
    const isDefaultCategory =
        categories.length === 1 && Number(categories[0]) === 10;
    if (categories.length > 0 && !isDefaultCategory) {
        pushAnalyticsTerm(terms, "songCategory", categories.join(","), "exact");
    }
    const activeFields = [];
    if (request.releaseDateFrom || request.releaseDateTo) activeFields.push("releaseDate");
    recordGenericSearchAnalytics({
        searchUnit: "song",
        resultCount: response.total,
        page: response.page,
        pageSize: response.limit,
        terms,
        activeFields,
        dateFrom: request.releaseDateFrom,
        dateTo: request.releaseDateTo,
    });
};

export const recordMemberSearchAnalytics = (
    request: MemberSearchRequest,
    response: MemberSearchResponse,
): void => {
    const terms: SearchAnalyticsTerm[] = [];
    pushAnalyticsTerm(terms, "query", request.term);
    pushAnalyticsTerm(terms, "personName", request.personName);
    pushAnalyticsTerm(terms, "groupName", request.groupName);
    pushAnalyticsTerm(terms, "prefectureIds", request.prefectureIds, "exact");
    pushAnalyticsTerm(terms, "prefectureName", request.prefectureName);
    pushAnalyticsTerm(terms, "birthMonth", request.birthMonths, "exact");
    if (request.activeStatus && request.activeStatus !== "all") {
        pushAnalyticsTerm(terms, "activeStatus", request.activeStatus, "exact");
    }
    pushAnalyticsTerm(terms, "bloodType", request.bloodType, "exact");
    pushAnalyticsTerm(terms, "generation", request.generation);
    pushAnalyticsTerm(terms, "roleName", request.roleName);
    pushAnalyticsTerm(terms, "colorName", request.colorName);
    const activeFields = [];
    if (request.birthdayFrom || request.birthdayTo) activeFields.push("birthday");
    if (request.joinedFrom || request.joinedTo) activeFields.push("joinedDate");
    recordGenericSearchAnalytics({
        searchUnit: "member",
        resultCount: response.total,
        page: response.page,
        pageSize: response.limit,
        terms,
        activeFields,
        dateFrom: request.birthdayFrom ?? request.joinedFrom,
        dateTo: request.birthdayTo ?? request.joinedTo,
    });
};

export const recordSongRankingAnalytics = (
    request: SongRankingRequest,
    response: SongRankingResponse,
): void => {
    const terms: SearchAnalyticsTerm[] = [];
    pushAnalyticsTerm(terms, "rankingBy", request.rankingBy ?? "song", "exact");
    for (const group of request.conditionGroups) {
        for (const condition of group.conditions) {
            pushAnalyticsTerm(
                terms,
                condition.field,
                condition.value,
                condition.method === "eq" || condition.method === "not"
                    ? condition.method === "not"
                        ? "notExact"
                        : "exact"
                    : condition.method,
            );
        }
    }
    const activeFields = ["rankingBy"];
    if (request.conditionGroups.length > 0) activeFields.push("conditionGroups");
    if (request.dateFrom || request.dateTo) activeFields.push("date");
    recordGenericSearchAnalytics({
        searchUnit: "ranking",
        resultCount: response.total,
        page: response.page,
        pageSize: response.limit,
        terms,
        activeFields,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
    });
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
        appEnvironment: currentAppEnvironment(),
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
