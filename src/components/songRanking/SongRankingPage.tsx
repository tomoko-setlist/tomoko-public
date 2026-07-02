import { useEffect, useMemo, useRef, useState } from "react";

import {
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    normalizePageSize,
} from "../../lib/constants/searchDefaults";
import { DB_REFRESH_EVENT } from "../../lib/dbRefreshEvent";
import { sortEventTagsByPriority } from "../../lib/eventTagPriority";
import { formatDateYmd } from "../../lib/uiFormat";
import { AutocompleteTextInput } from "../search/AutocompleteTextInput";
import { ConditionExpressionPreview } from "../search/ConditionExpressionPreview";
import { SingleSelectDropdown } from "../search/MultiSelectDropdown";
import { SearchDateRangeControl } from "../search/SearchDateRangeControl";
import { SearchPagination } from "../search/SearchPagination";
import { SearchResultsHeaderControls } from "../search/SearchResultsHeaderControls";
import {
    IndentDecreaseIcon,
    IndentIncreaseIcon,
    MicrophoneIcon,
    MusicIcon,
    PlusIcon,
    ResetIcon,
    SelectField,
    UserIcon,
    XIcon,
    normalizeTextSizeLevel,
    type TextSizeLevel,
} from "../ui";

import type {
    MasterOption,
    SearchDateMode,
    SearchMethod,
    SearchSuggestField,
    SearchSuggestion,
    SetlistSearchDb,
    SongRankingConditionGroup,
    SongRankingConditionField,
    SongRankingResponse,
} from "../../lib/setlistSearchDb/types";

type SongRankingPageProps = {
    db: SetlistSearchDb;
    onOpenSong: (songId: number) => void;
    onOpenArtist: (artistId: number) => void;
};

type SortBy = "performances" | "stages" | "events";
type RankingBy = "song" | "artist" | "performer";

type ConditionDraft = {
    id: string;
    field: SongRankingConditionField;
    method: SearchMethod | "eq" | "not";
    value: string;
};
type ConditionGroupDraft = {
    id: string;
    joinWithPrev: "and" | "or";
    conditionJoin: "and" | "or";
    conditions: ConditionDraft[];
};

const STORAGE_KEY = "tomoko-song-ranking-state-v2";
const MAX_CONDITION_GROUPS = 20;

const EMPTY: SongRankingResponse = {
    rows: [],
    total: 0,
    page: DEFAULT_PAGE,
    limit: DEFAULT_PAGE_SIZE,
    totalPages: DEFAULT_PAGE,
};

const FIELD_OPTIONS: Array<{ value: SongRankingConditionField; label: string }> = [
    { value: "eventTag", label: "イベントタグ" },
    { value: "songName", label: "楽曲名" },
    { value: "performerName", label: "歌唱者" },
    { value: "artistName", label: "アーティスト名" },
    { value: "eventName", label: "イベント名" },
    { value: "lyricistName", label: "作詞" },
    { value: "composerName", label: "作曲" },
    { value: "arrangerName", label: "編曲" },
    { value: "venueName", label: "会場名" },
    { value: "prefectureId", label: "都道府県" },
    { value: "remarks", label: "備考" },
    { value: "section", label: "セクション" },
];

const TEXT_METHOD_OPTIONS: Array<{ value: SearchMethod; label: string }> = [
    { value: "contains", label: "含む" },
    { value: "startsWith", label: "で始まる" },
    { value: "endsWith", label: "で終わる" },
    { value: "exact", label: "である" },
    { value: "notContains", label: "含まない" },
    { value: "notExact", label: "でない" },
];

const TAG_METHOD_OPTIONS: Array<{ value: "eq" | "not"; label: string }> = [
    { value: "eq", label: "である" },
    { value: "not", label: "でない" },
];

const CONDITION_SUGGEST_FIELDS: Partial<Record<SongRankingConditionField, SearchSuggestField>> = {
    songName: "songName",
    artistName: "artistName",
    performerName: "personName",
    eventName: "eventName",
    venueName: "venueName",
    section: "sectionName",
    lyricistName: "lyricistName",
    composerName: "composerName",
    arrangerName: "arrangerName",
    eventTag: "eventTag",
    prefectureId: "prefectureName",
};
type JoinMode = "and" | "or";

type StoredRankingState = Partial<{
    groups: ConditionGroupDraft[];
    groupingEnabled: boolean;
    dateFrom: string;
    dateTo: string;
    sortBy: SortBy;
    sortOrder: "asc" | "desc";
    topLevelJoin: JoinMode;
    page: number;
    pageSize: number;
    rankingBy: RankingBy;
    dateMode: SearchDateMode;
}>;

const FIELD_QUERY_PAIRS: Array<readonly [SongRankingConditionField, string]> = [
    ["songName", "s"],
    ["artistName", "a"],
    ["performerName", "p"],
    ["eventName", "e"],
    ["venueName", "v"],
    ["section", "x"],
    ["remarks", "m"],
    ["lyricistName", "l"],
    ["composerName", "c"],
    ["arrangerName", "r"],
    ["eventTag", "t"],
    ["prefectureId", "pr"],
];
const FIELD_TO_QUERY = new Map<SongRankingConditionField, string>(FIELD_QUERY_PAIRS);
const QUERY_TO_FIELD = new Map<string, SongRankingConditionField>(
    FIELD_QUERY_PAIRS.map(([field, query]) => [query, field]),
);

const METHOD_QUERY_PAIRS: Array<readonly [ConditionDraft["method"], string]> = [
    ["contains", "c"],
    ["startsWith", "sw"],
    ["endsWith", "ew"],
    ["exact", "e"],
    ["notContains", "nc"],
    ["notExact", "ne"],
    ["eq", "eq"],
    ["not", "n"],
];
const METHOD_TO_QUERY = new Map<ConditionDraft["method"], string>(METHOD_QUERY_PAIRS);
const QUERY_TO_METHOD = new Map<string, ConditionDraft["method"]>(
    METHOD_QUERY_PAIRS.map(([method, query]) => [query, method]),
);

const SORT_QUERY_PAIRS: Array<readonly [SortBy, string]> = [
    ["performances", "pf"],
    ["stages", "st"],
    ["events", "ev"],
];
const SORT_TO_QUERY = new Map<SortBy, string>(SORT_QUERY_PAIRS);
const QUERY_TO_SORT = new Map<string, SortBy>(
    SORT_QUERY_PAIRS.map(([sort, query]) => [query, sort]),
);

const RANKING_QUERY_KEYS = [
    "q",
    "g",
    "df",
    "dt",
    "o",
    "j",
    "p",
    "ps",
    "r_cond",
    "r_grp",
    "r_df",
    "r_dt",
    "r_sb",
    "r_so",
    "r_tj",
    "r_p",
    "r_ps",
    "rb",
] as const;
const CURRENT_RANKING_QUERY_KEYS = ["q", "g", "df", "dt", "o", "j", "p", "ps", "rb"] as const;

function isUnknownArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

const createCondition = (seed = Date.now()): ConditionDraft => ({
    id: `c-${seed}-${Math.random().toString(36).slice(2, 7)}`,
    field: "eventTag",
    method: "eq",
    value: "",
});
const createGroup = (seed = Date.now()): ConditionGroupDraft => ({
    id: `g-${seed}-${Math.random().toString(36).slice(2, 7)}`,
    joinWithPrev: "and",
    conditionJoin: "and",
    conditions: [createCondition(seed)],
});

const sanitizeMethod = (
    field: SongRankingConditionField,
    method: ConditionDraft["method"],
): ConditionDraft["method"] => {
    if (field === "eventTag") {
        return method === "not" ? "not" : "eq";
    }
    if (field === "prefectureId") {
        return method === "not" ? "not" : "eq";
    }
    if (
        method === "contains" ||
        method === "startsWith" ||
        method === "endsWith" ||
        method === "exact" ||
        method === "notContains" ||
        method === "notExact"
    ) {
        return method;
    }
    return "contains";
};

const encodeJoin = (join: JoinMode) => (join === "or" ? "o" : "a");
const decodeJoin = (value: unknown): JoinMode => (value === "o" || value === "or" ? "or" : "and");

function normalizeGroups(groups: ConditionGroupDraft[]): ConditionGroupDraft[] {
    const normalized = [...groups];
    if (normalized[0]) normalized[0] = { ...normalized[0], joinWithPrev: "and" };
    return normalized;
}

function encodeConditionGroups(groups: ConditionGroupDraft[]) {
    const compact = groups
        .map((group) => {
            const rows = group.conditions
                .map((condition) => {
                    const value = condition.value.trim();
                    const field = FIELD_TO_QUERY.get(condition.field);
                    const method = METHOD_TO_QUERY.get(condition.method);
                    if (!value || !field || !method) return null;
                    return [field, method, value];
                })
                .filter((row): row is string[] => row !== null);
            if (rows.length === 0) return null;
            return [encodeJoin(group.conditionJoin), rows];
        })
        .filter((group): group is Array<string | string[][]> => group !== null);
    return compact.length > 0 ? JSON.stringify(compact) : "";
}

function decodeConditionGroups(raw: string | null): ConditionGroupDraft[] | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isUnknownArray(parsed)) return null;
        const groups = parsed
            .map((group, groupIndex): ConditionGroupDraft | null => {
                if (!isUnknownArray(group) || group.length < 2) return null;
                const rows = group[1];
                if (!isUnknownArray(rows)) return null;
                const conditions = rows
                    .map((row, rowIndex): ConditionDraft | null => {
                        if (!isUnknownArray(row) || row.length < 3) return null;
                        const field = QUERY_TO_FIELD.get(String(row[0]));
                        const method = QUERY_TO_METHOD.get(String(row[1]));
                        const value = typeof row[2] === "string" ? row[2] : "";
                        if (!field || !method || value.trim().length === 0) return null;
                        return {
                            id: `q-${groupIndex}-${rowIndex}`,
                            field,
                            method: sanitizeMethod(field, method),
                            value,
                        };
                    })
                    .filter((row): row is ConditionDraft => row !== null);
                if (conditions.length === 0) return null;
                return {
                    id: `qg-${groupIndex}`,
                    joinWithPrev: "and",
                    conditionJoin: decodeJoin(group[0]),
                    conditions,
                };
            })
            .filter((group): group is ConditionGroupDraft => group !== null);
        return groups.length > 0 ? normalizeGroups(groups) : null;
    } catch {
        return null;
    }
}

function readUrlState(): StoredRankingState | null {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const hasRankingParam = CURRENT_RANKING_QUERY_KEYS.some((key) => params.has(key));
    if (!hasRankingParam) return null;

    const state: StoredRankingState = {};
    state.groups = decodeConditionGroups(params.get("q")) ?? [];
    state.groupingEnabled = params.get("g") === "1" || state.groups.length > 1 || state.groups.some((group) => group.conditions.length > 1);
    if (params.has("df")) state.dateFrom = params.get("df") ?? "";
    if (params.has("dt")) state.dateTo = params.get("dt") ?? "";
    const sortParam = params.get("o");
    if (sortParam) {
        const [sortRaw, orderRaw] = sortParam.split(".");
        const sort = QUERY_TO_SORT.get(sortRaw ?? "");
        if (sort) state.sortBy = sort;
        if (orderRaw === "a" || orderRaw === "asc") state.sortOrder = "asc";
        if (orderRaw === "d" || orderRaw === "desc") state.sortOrder = "desc";
    }
    if (params.has("j")) state.topLevelJoin = decodeJoin(params.get("j"));
    const rankingByRaw = params.get("rb");
    if (rankingByRaw === "artist" || rankingByRaw === "performer" || rankingByRaw === "song") {
        state.rankingBy = rankingByRaw;
    }
    const pageRaw = Number(params.get("p"));
    if (Number.isFinite(pageRaw) && pageRaw > 0) state.page = Math.floor(pageRaw);
    const pageSizeRaw = Number(params.get("ps"));
    if (Number.isFinite(pageSizeRaw) && pageSizeRaw > 0) state.pageSize = normalizePageSize(pageSizeRaw);
    return state;
}

function applyStoredState(state: StoredRankingState) {
    return {
        groups: Array.isArray(state.groups) ? normalizeGroups(state.groups) : [],
        groupingEnabled: state.groupingEnabled,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        topLevelJoin: state.topLevelJoin,
        page: state.page,
        pageSize: state.pageSize,
        rankingBy: state.rankingBy,
        dateMode: state.dateMode,
    };
}

function JoinModeToggle({
    value,
    onChange,
    title,
}: {
    value: JoinMode;
    onChange: (value: JoinMode) => void;
    title: string;
}) {
    const next = value === "and" ? "or" : "and";
    const label = value.toUpperCase();
    return (
        <button
            type="button"
            onClick={() => onChange(next)}
            className={`inline-flex h-5 min-w-10 items-center justify-center rounded-none border border-gray-800 px-2 font-mono text-[10px] font-bold leading-none tracking-wide text-white shadow-[1px_1px_0px_0px_rgba(31,41,55,0.65)] hover:bg-red-700 ${
                value === "and" ? "bg-gray-900" : "bg-red-600"
            }`}
            title={`${title}: ${label}（クリックで${next.toUpperCase()}に切替）`}
            aria-label={`${title}: ${label}`}
        >
            {label}
        </button>
    );
}

export function SongRankingPage({ db, onOpenSong, onOpenArtist }: SongRankingPageProps) {
    const [groups, setGroups] = useState<ConditionGroupDraft[]>([]);
    const [groupingEnabled, setGroupingEnabled] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [sortBy, setSortBy] = useState<SortBy>("performances");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [topLevelJoin, setTopLevelJoin] = useState<"and" | "or">("and");
    const [rankingBy, setRankingBy] = useState<RankingBy>("song");
    const [dateMode, setDateMode] = useState<SearchDateMode>("date");
    const [page, setPage] = useState(DEFAULT_PAGE);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [pageInput, setPageInput] = useState(String(DEFAULT_PAGE));
    const [textSize, setTextSize] = useState<TextSizeLevel>(() => {
        try {
            return normalizeTextSizeLevel(
                sessionStorage.getItem("tomoko-song-ranking-text-size"),
            );
        } catch {
            return "standard";
        }
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<SongRankingResponse>(EMPTY);
    const [eventTagOptions, setEventTagOptions] = useState<MasterOption[]>([]);
    const [prefectureOptions, setPrefectureOptions] = useState<MasterOption[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const conditionButtonsRef = useRef<HTMLDivElement | null>(null);
    const [conditionButtonsOverflow, setConditionButtonsOverflow] = useState(false);

    useEffect(() => {
        const element = conditionButtonsRef.current;
        if (!element) return;

        const updateOverflow = () => {
            setConditionButtonsOverflow(element.scrollWidth > element.clientWidth + 1);
        };

        updateOverflow();
        const resizeObserver =
            typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateOverflow) : null;
        resizeObserver?.observe(element);
        window.addEventListener("resize", updateOverflow);
        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener("resize", updateOverflow);
        };
    }, []);

    useEffect(() => {
        const loadState = (state: StoredRankingState) => {
            const next = applyStoredState(state);
            setGroups(next.groups);
            if (typeof next.groupingEnabled === "boolean") {
                setGroupingEnabled(next.groupingEnabled);
            }
            if (typeof next.dateFrom === "string") setDateFrom(next.dateFrom);
            if (typeof next.dateTo === "string") setDateTo(next.dateTo);
            if (
                next.sortBy === "performances" ||
                next.sortBy === "stages" ||
                next.sortBy === "events"
            ) {
                setSortBy(next.sortBy);
            }
            if (next.sortOrder === "asc" || next.sortOrder === "desc") setSortOrder(next.sortOrder);
            if (next.topLevelJoin === "and" || next.topLevelJoin === "or") {
                setTopLevelJoin(next.topLevelJoin);
            }
            if (
                next.rankingBy === "song" ||
                next.rankingBy === "artist" ||
                next.rankingBy === "performer"
            ) {
                setRankingBy(next.rankingBy);
            }
            if (next.dateMode === "year" || next.dateMode === "date") {
                setDateMode(next.dateMode);
            }
            if (typeof next.page === "number" && next.page > 0) {
                setPage(Math.floor(next.page));
                setPageInput(String(Math.floor(next.page)));
            }
            if (typeof next.pageSize === "number") setPageSize(normalizePageSize(next.pageSize));
        };

        try {
            const urlState = readUrlState();
            if (urlState) {
                loadState(urlState);
                return;
            }
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Partial<{
                groups: ConditionGroupDraft[];
                groupingEnabled: boolean;
                dateFrom: string;
                dateTo: string;
                dateMode: SearchDateMode;
                sortBy: SortBy;
                sortOrder: "asc" | "desc";
                topLevelJoin: "and" | "or";
                page: number;
                pageSize: number;
                rankingBy: RankingBy;
            }>;
            if (Array.isArray(parsed.groups)) {
                setGroups(
                    normalizeGroups(parsed.groups.map((group) => ({
                        id: typeof group.id === "string" ? group.id : createGroup().id,
                        joinWithPrev: group.joinWithPrev === "or" ? "or" : "and",
                        conditionJoin: group.conditionJoin === "or" ? "or" : "and",
                        conditions:
                            Array.isArray(group.conditions) && group.conditions.length > 0
                                ? group.conditions.map((row) => ({
                                      id:
                                          typeof row.id === "string"
                                              ? row.id
                                              : createCondition().id,
                                      field: FIELD_OPTIONS.some((f) => f.value === row.field)
                                          ? row.field
                                          : "songName",
                                      method: sanitizeMethod(
                                          FIELD_OPTIONS.some((f) => f.value === row.field)
                                              ? row.field
                                              : "songName",
                                          row.method,
                                      ),
                                      value:
                                          typeof row.value === "string" ? row.value : "",
                                  }))
                                : [createCondition()],
                    }))),
                );
            }
            if (typeof parsed.groupingEnabled === "boolean") {
                setGroupingEnabled(parsed.groupingEnabled);
            }
            if (typeof parsed.dateFrom === "string") setDateFrom(parsed.dateFrom);
            if (typeof parsed.dateTo === "string") setDateTo(parsed.dateTo);
            if (parsed.dateMode === "year" || parsed.dateMode === "date") setDateMode(parsed.dateMode);
            if (
                parsed.sortBy === "performances" ||
                parsed.sortBy === "stages" ||
                parsed.sortBy === "events"
            ) {
                setSortBy(parsed.sortBy);
            }
            if (parsed.sortOrder === "asc" || parsed.sortOrder === "desc") setSortOrder(parsed.sortOrder);
            if (parsed.topLevelJoin === "and" || parsed.topLevelJoin === "or") {
                setTopLevelJoin(parsed.topLevelJoin);
            }
            if (
                parsed.rankingBy === "song" ||
                parsed.rankingBy === "artist" ||
                parsed.rankingBy === "performer"
            ) {
                setRankingBy(parsed.rankingBy);
            }
            if (typeof parsed.page === "number" && parsed.page > 0) {
                setPage(Math.floor(parsed.page));
                setPageInput(String(Math.floor(parsed.page)));
            }
            if (typeof parsed.pageSize === "number") setPageSize(normalizePageSize(parsed.pageSize));
        } catch {
            // no-op
        } finally {
            setHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                groups,
                groupingEnabled,
                dateFrom,
                dateTo,
                sortBy,
                sortOrder,
                topLevelJoin,
                page,
                pageSize,
                rankingBy,
                dateMode,
            }),
        );
    }, [hydrated, groups, groupingEnabled, dateFrom, dateTo, sortBy, sortOrder, topLevelJoin, page, pageSize, rankingBy, dateMode]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                const [tags, prefectures] = await Promise.all([
                    db.listEventTags(),
                    db.listPrefectures(),
                ]);
                if (cancelled) return;
                setEventTagOptions(sortEventTagsByPriority(tags));
                setPrefectureOptions(prefectures);
            } catch {
                if (cancelled) return;
                setEventTagOptions([]);
                setPrefectureOptions([]);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db]);

    useEffect(() => {
        if (!hydrated || typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        RANKING_QUERY_KEYS.forEach((key) => params.delete(key));

        const encodedGroups = encodeConditionGroups(groups);
        if (encodedGroups) params.set("q", encodedGroups);
        if (groupingEnabled) params.set("g", "1");
        if (dateFrom) params.set("df", dateFrom);
        if (dateTo) params.set("dt", dateTo);
        if (sortBy !== "performances" || sortOrder !== "desc") {
            params.set("o", `${SORT_TO_QUERY.get(sortBy) ?? "pf"}.${sortOrder === "asc" ? "a" : "d"}`);
        }
        if (topLevelJoin === "or") params.set("j", "o");
        if (rankingBy !== "song") params.set("rb", rankingBy);
        if (page !== DEFAULT_PAGE) params.set("p", String(page));
        if (pageSize !== DEFAULT_PAGE_SIZE) params.set("ps", String(pageSize));

        const query = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }, [hydrated, groups, groupingEnabled, dateFrom, dateTo, sortBy, sortOrder, topLevelJoin, rankingBy, page, pageSize]);

    const requestConditionGroups = useMemo<SongRankingConditionGroup[]>(
        () =>
            groups
                .map((group) => ({
                    joinWithPrev: topLevelJoin,
                    conditionJoin: group.conditionJoin,
                    conditions: group.conditions
                        .map((row) => ({
                            field: row.field,
                            method: row.method,
                            value: row.value.trim(),
                        }))
                        .filter((row) => row.value.length > 0),
                }))
                .filter((group) => group.conditions.length > 0),
        [groups, topLevelJoin],
    );

    const request = useMemo(
        () => ({
            conditionGroups: requestConditionGroups,
            dateFrom,
            dateTo,
            page,
            limit: pageSize,
            rankingBy,
            sortBy,
            sortOrder,
        }),
        [requestConditionGroups, dateFrom, dateTo, page, pageSize, rankingBy, sortBy, sortOrder],
    );

    useEffect(() => {
        if (!hydrated) return;
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError("");
            try {
                const next = await db.searchSongRanking(request);
                if (cancelled) return;
                setResult(next);
                setPageInput(String(next.page));
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : String(e));
                setResult(EMPTY);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db, request, hydrated]);

    useEffect(() => {
        const handleRefresh = () => {
            setResult(EMPTY);
            setPage(1);
            setPageInput("1");
        };
        window.addEventListener(DB_REFRESH_EVENT, handleRefresh);
        return () => window.removeEventListener(DB_REFRESH_EVENT, handleRefresh);
    }, []);

    const addStandaloneCondition = (field: SongRankingConditionField = "eventTag") => {
        if (groups.length >= MAX_CONDITION_GROUPS) return;
        setGroups((prev) => [
            ...prev,
            {
                id: createGroup().id,
                joinWithPrev: "and",
                conditionJoin: "and",
                conditions: [{ ...createCondition(), field, method: sanitizeMethod(field, "contains") }],
            },
        ]);
        setGroupingEnabled(true);
        setPage(1);
        setPageInput("1");
    };

    const fetchSuggestions = async (
        field: SearchSuggestField,
        term: string,
    ): Promise<SearchSuggestion[]> => {
        const nextTerm = term.trim();
        if (!nextTerm) return [];
        return db.suggest({
            field,
            term: nextTerm,
            searchUnit: "setlist",
            limit: 8,
            variant: "A",
        });
    };

    const removeConditionFromGroup = (groupId: string, conditionId: string) => {
        let nextGroupingEnabled = groupingEnabled;
        setGroups((prev) => {
            const updated = prev
                .map((group) => {
                    if (group.id !== groupId) return group;
                    return {
                        ...group,
                        conditions: group.conditions.filter(
                            (condition) => condition.id !== conditionId,
                        ),
                    };
                })
                .filter((group) => group.conditions.length > 0);

            const normalized = updated;

            nextGroupingEnabled = normalized.some((group) => group.conditions.length > 1) || normalized.length > 1;
            if (normalized[0]) {
                normalized[0] = { ...normalized[0], joinWithPrev: "and" };
            }
            return normalized;
        });
        setGroupingEnabled(nextGroupingEnabled);
        setPage(1);
        setPageInput("1");
    };

    const groupBlockWithPrevious = (groupIndex: number) => {
        setGroups((prev) => {
            if (groupIndex <= 0 || groupIndex >= prev.length) return prev;
            const target = prev[groupIndex];
            const previous = prev[groupIndex - 1];
            if (!target || !previous) return prev;
            if (target.conditions.length !== 1) return prev;

            const merged: ConditionGroupDraft = {
                ...previous,
                conditions: [...previous.conditions, ...target.conditions],
            };
            const next = [...prev];
            next[groupIndex - 1] = merged;
            next.splice(groupIndex, 1);
            if (next[0]) next[0] = { ...next[0], joinWithPrev: "and" };
            return next;
        });
        setGroupingEnabled(true);
        setPage(1);
        setPageInput("1");
        setError("");
    };

    const ungroupCondition = (groupIndex: number, rowIndex: number) => {
        setGroups((prev) => {
            const target = prev[groupIndex];
            if (!target) return prev;
            if (target.conditions.length <= 1) return prev;
            const extracted = target.conditions[rowIndex];
            if (!extracted) return prev;
            const remaining = target.conditions.filter((_, idx) => idx !== rowIndex);
            const next = [...prev];
            next[groupIndex] = { ...target, conditions: remaining };
            next.splice(groupIndex + 1, 0, {
                id: createGroup().id,
                joinWithPrev: "and",
                conditionJoin: "and",
                conditions: [extracted],
            });
            if (next[0]) next[0] = { ...next[0], joinWithPrev: "and" };
            return next;
        });
        setPage(1);
        setPageInput("1");
    };

    const updateTopLevelJoin = (join: "and" | "or") => {
        setTopLevelJoin(join);
        setPage(1);
        setPageInput("1");
    };

    const updateGroupConditionJoin = (groupId: string, join: "and" | "or") => {
        setGroups((prev) =>
            prev.map((group) =>
                group.id === groupId ? { ...group, conditionJoin: join } : group,
            ),
        );
        setPage(1);
        setPageInput("1");
    };

    const updateConditionInGroup = (
        groupId: string,
        conditionId: string,
        patch: Partial<ConditionDraft>,
    ) => {
        setGroups((prev) =>
            prev.map((group) => {
                if (group.id !== groupId) return group;
                return {
                    ...group,
                    conditions: group.conditions.map((condition) => {
                        if (condition.id !== conditionId) return condition;
                        const nextField = patch.field ?? condition.field;
                        const next = { ...condition, ...patch };
                        next.method = sanitizeMethod(nextField, next.method);
                        return next;
                    }),
                };
            }),
        );
        setPage(1);
        setPageInput("1");
    };

    const dateRangeError = dateFrom && dateTo && dateFrom > dateTo ? "日付範囲が不正です" : "";

    const sortOptions: Array<{ value: SortBy; label: string }> = [
        { value: "performances", label: "歌唱回数" },
        { value: "stages", label: "ステージ数" },
        { value: "events", label: "イベント数" },
    ];
    const handleTextSizeChange = (next: TextSizeLevel) => {
        setTextSize(next);
        try {
            sessionStorage.setItem("tomoko-song-ranking-text-size", next);
        } catch {
            // no-op
        }
    };
    const textSizeClass: Record<TextSizeLevel, string> = {
        tiny: "text-[10px]",
        compact: "text-[11px]",
        small: "text-xs",
        standard: "text-sm",
        large: "text-base",
        xlarge: "text-lg",
    };
    const mobileNameClass: Record<TextSizeLevel, string> = {
        tiny: "text-[10px]",
        compact: "text-[11px]",
        small: "text-xs",
        standard: "text-xs",
        large: "text-sm",
        xlarge: "text-base",
    };
    const mobileArtistClass: Record<TextSizeLevel, string> = {
        tiny: "text-[9px]",
        compact: "text-[10px]",
        small: "text-[11px]",
        standard: "text-[10px]",
        large: "text-xs",
        xlarge: "text-sm",
    };

    const canClearConditions =
        groups.some((group) =>
            group.conditions.some((condition) => condition.value.trim().length > 0),
        ) ||
        dateFrom.trim().length > 0 ||
        dateTo.trim().length > 0 ||
        sortBy !== "performances" ||
        sortOrder !== "desc" ||
        page !== 1 ||
        pageSize !== DEFAULT_PAGE_SIZE;

    const conditionPreviewMethodLabels: Record<SearchMethod, string> = {
        contains: "を含む",
        startsWith: "で始まる",
        endsWith: "で終わる",
        exact: "である",
        notContains: "を含まない",
        notExact: "でない",
    };
    const fieldLabelMap = new Map(FIELD_OPTIONS.map((option) => [option.value, option.label]));
    const mobileMetric =
        sortBy === "events"
            ? {
                  label: "イベント",
                  unit: "件",
                  getValue: (row: SongRankingResponse["rows"][number]) => row.totalEvents,
              }
            : sortBy === "stages"
              ? {
                    label: "公演",
                    unit: "公演",
                    getValue: (row: SongRankingResponse["rows"][number]) => row.totalStages,
                }
              : {
                    label: "歌唱",
                    unit: "回",
                    getValue: (row: SongRankingResponse["rows"][number]) => row.totalPerformances,
                };
    const unitLabel = rankingBy === "artist" ? "アーティスト" : rankingBy === "performer" ? "歌唱者" : "楽曲";
    const headerDescription =
        rankingBy === "artist"
            ? "歌唱回数をアーティスト単位で集計して表示します。"
            : rankingBy === "performer"
              ? "歌唱回数を歌唱者単位で集計して表示します。"
              : "歌唱回数を楽曲単位で集計して表示します。";

    return (
        <section className="space-y-3">
            <header className="rounded-none border-2 border-gray-800 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]">
                <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-slate-900">歌唱回数ランキング</h2>
                    <p className="mt-1 text-xs text-slate-600">{headerDescription}</p>
                    <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2">
                        <button
                            type="button"
                            className={`inline-flex h-8 w-full items-center justify-center gap-1 rounded-none border px-1 text-[9px] font-semibold leading-none transition-colors sm:h-8 sm:px-1.5 sm:text-[10px] ${
                                rankingBy === "song"
                                    ? "border-red-700 bg-red-600 text-white shadow-[2px_2px_0px_0px_rgba(185,28,28,0.65)]"
                                    : "border-gray-700 bg-white text-gray-800 shadow-[2px_2px_0px_0px_rgba(55,65,81,0.55)] hover:bg-gray-50"
                            }`}
                            onClick={() => {
                                setRankingBy("song");
                                setPage(1);
                                setPageInput("1");
                            }}
                            title="楽曲ランキング"
                            aria-label="楽曲ランキング"
                        >
                            <MusicIcon className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                            <span>楽曲</span>
                        </button>
                        <button
                            type="button"
                            className={`inline-flex h-8 w-full items-center justify-center gap-1 rounded-none border px-1 text-[9px] font-semibold leading-none transition-colors sm:h-8 sm:px-1.5 sm:text-[10px] ${
                                rankingBy === "artist"
                                    ? "border-red-700 bg-red-600 text-white shadow-[2px_2px_0px_0px_rgba(185,28,28,0.65)]"
                                    : "border-gray-700 bg-white text-gray-800 shadow-[2px_2px_0px_0px_rgba(55,65,81,0.55)] hover:bg-gray-50"
                            }`}
                            onClick={() => {
                                setRankingBy("artist");
                                setPage(1);
                                setPageInput("1");
                            }}
                            title="アーティストランキング"
                            aria-label="アーティストランキング"
                        >
                            <UserIcon className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                            <span>アーティスト</span>
                        </button>
                        <button
                            type="button"
                            className={`inline-flex h-8 w-full items-center justify-center gap-1 rounded-none border px-1 text-[9px] font-semibold leading-none transition-colors sm:h-8 sm:px-1.5 sm:text-[10px] ${
                                rankingBy === "performer"
                                    ? "border-red-700 bg-red-600 text-white shadow-[2px_2px_0px_0px_rgba(185,28,28,0.65)]"
                                    : "border-gray-700 bg-white text-gray-800 shadow-[2px_2px_0px_0px_rgba(55,65,81,0.55)] hover:bg-gray-50"
                            }`}
                            onClick={() => {
                                setRankingBy("performer");
                                setPage(1);
                                setPageInput("1");
                            }}
                            title="歌唱者ランキング"
                            aria-label="歌唱者ランキング"
                        >
                            <MicrophoneIcon className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                            <span>歌唱者</span>
                        </button>
                    </div>
                </div>
            </header>

            <section className="rounded-none border-2 border-gray-800 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] md:p-5">
                <div className="mt-1 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-semibold text-slate-700">条件を追加</h3>
                        <button
                            type="button"
                            onClick={() => {
                                setGroups([]);
                                setDateFrom("");
                                setDateTo("");
                                setSortBy("performances");
                                setSortOrder("desc");
                                setTopLevelJoin("and");
                                setRankingBy("song");
                                setPage(1);
                                setPageInput("1");
                            }}
                            disabled={!canClearConditions}
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-none border p-0 shadow-[1px_1px_0px_0px_rgba(31,41,55,0.35)] ${
                                canClearConditions
                                    ? "border-gray-700 bg-white text-gray-700 hover:bg-gray-100"
                                    : "border-gray-300 text-gray-400"
                            }`}
                            title="検索条件をクリア"
                            aria-label="検索条件をクリア"
                        >
                            <ResetIcon className="h-2.5 w-2.5" />
                        </button>
                    </div>
                    <div className="border-b border-dashed border-gray-300 pb-2">
                        <div className="flex min-w-0 items-center gap-1">
                            <div className="relative min-w-0 flex-1">
                                <div ref={conditionButtonsRef} className="flex min-w-0 gap-1 overflow-x-auto py-0.5 pr-5">
                                    {FIELD_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            className="inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-none border border-gray-300 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-[1px_1px_0px_0px_rgba(31,41,55,0.28)] hover:border-gray-800 hover:bg-gray-50 disabled:opacity-50"
                                            onClick={() => addStandaloneCondition(option.value)}
                                            disabled={groups.length >= MAX_CONDITION_GROUPS}
                                            title={`${option.label}条件を追加`}
                                        >
                                            <PlusIcon className="h-2.5 w-2.5" />
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                {conditionButtonsOverflow ? (
                                    <div
                                        aria-hidden="true"
                                        className="pointer-events-none absolute bottom-0 right-0 top-0 flex w-10 items-center justify-end bg-gradient-to-l from-white via-white/95 to-transparent pr-1 text-base font-black leading-none text-slate-700"
                                    >
                                        ›
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <SearchDateRangeControl
                        mode={dateMode}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        onModeChange={(mode) => {
                            setDateMode(mode);
                            setPage(1);
                            setPageInput("1");
                        }}
                        onDateRangeChange={({ dateFrom: nextDateFrom, dateTo: nextDateTo }) => {
                            setDateFrom(nextDateFrom);
                            setDateTo(nextDateTo);
                            setPage(1);
                            setPageInput("1");
                        }}
                    />
                    <div className="space-y-2">
                        {groups.length > 1 ? (
                            <div className="flex items-center">
                                <JoinModeToggle
                                    value={topLevelJoin}
                                    onChange={updateTopLevelJoin}
                                    title="条件間結合"
                                />
                            </div>
                        ) : null}
                    {groups.map((group, groupIndex) => {
                        const isGroupedBlock = group.conditions.length > 1;
                        return (
                            <div key={group.id} className="space-y-1">
                                <div
                                    className={
                                        isGroupedBlock
                                            ? "relative my-2 ml-1 rounded-none bg-gray-50/70 py-1.5 pl-3 pr-2"
                                            : "p-0"
                                    }
                                >
                                    {isGroupedBlock ? (
                                        <span
                                            aria-hidden="true"
                                            className="absolute bottom-1 left-0 top-1 w-2 border-y-2 border-l-2 border-gray-800"
                                        />
                                    ) : null}
                                    <div className="space-y-1.5">
                                        {isGroupedBlock ? (
                                            <div className="flex items-center pl-1">
                                                <JoinModeToggle
                                                    value={group.conditionJoin}
                                                    onChange={(join) => updateGroupConditionJoin(group.id, join)}
                                                    title="グループ内結合"
                                                />
                                            </div>
                                        ) : null}
                                        {group.conditions.map((row, index) => {
                                            const isTag = row.field === "eventTag";
                                            const isPrefecture = row.field === "prefectureId";
                                            const optionList = isTag
                                                ? eventTagOptions.map((option) => ({
                                                      value: option.name,
                                                      label: option.name,
                                                  }))
                                                : isPrefecture
                                                  ? prefectureOptions.map((option) => ({
                                                        value: String(option.id),
                                                        label: option.name,
                                                    }))
                                                  : [];
                                            return (
                                                <div key={row.id} className="space-y-1">
                                                    <div className="overflow-x-visible">
                                                        <div
                                                            className="grid w-full min-w-0 gap-0"
                                                        >
                                                            <div className="grid h-4 min-w-0 grid-cols-[22px_minmax(0,1fr)] items-center gap-0 md:h-5 md:grid-cols-[24px_minmax(0,1fr)]">
                                                                <span aria-hidden="true" />
                                                                <span className="min-w-0 truncate text-[11px] font-semibold leading-none text-slate-600 md:text-xs" title={FIELD_OPTIONS.find((option) => option.value === row.field)?.label ?? row.field}>
                                                                    {FIELD_OPTIONS.find((option) => option.value === row.field)?.label ?? row.field}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-[22px_minmax(0,1fr)_72px_26px] items-center gap-0 md:grid-cols-[24px_minmax(0,1fr)_96px_32px]">
                                                            <div className="flex h-7 items-center justify-center md:h-8">
                                                                {!isGroupedBlock && index === 0 && groupIndex > 0 ? (
                                                                    <button
                                                                        type="button"
                                                                        className="inline-flex h-7 w-5 shrink-0 items-center justify-center rounded-none text-gray-700 hover:bg-gray-100 hover:text-red-700 md:h-8 md:w-6"
                                                                        title="上の条件とグループ化"
                                                                        aria-label="上の条件とグループ化"
                                                                        onClick={() => groupBlockWithPrevious(groupIndex)}
                                                                    >
                                                                        <IndentIncreaseIcon className="h-3.5 w-3.5" />
                                                                    </button>
                                                                ) : null}
                                                                {group.conditions.length > 1 ? (
                                                                    <button
                                                                        type="button"
                                                                        className="inline-flex h-7 w-5 shrink-0 items-center justify-center rounded-none text-gray-700 hover:bg-gray-100 hover:text-red-700 md:h-8 md:w-6"
                                                                        title="この条件をグループ解除"
                                                                        aria-label="この条件をグループ解除"
                                                                        onClick={() => ungroupCondition(groupIndex, index)}
                                                                    >
                                                                        <IndentDecreaseIcon className="h-3.5 w-3.5" />
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                            {isTag || isPrefecture ? (
                                                                <SingleSelectDropdown
                                                                    options={optionList}
                                                                    value={row.value}
                                                                    onChange={(value) => updateConditionInGroup(group.id, row.id, { value })}
                                                                    placeholder={isTag ? "タグを選択" : "都道府県を選択"}
                                                                    optionColumns={2}
                                                                    compact
                                                                />
                                                            ) : (
                                                                <AutocompleteTextInput
                                                                    value={row.value}
                                                                    onChange={(value) => updateConditionInGroup(group.id, row.id, { value })}
                                                                    className="min-w-0"
                                                                    inputClassName="w-full rounded-none border border-gray-400 px-1.5 py-0 pr-14 text-[11px] h-7 focus:outline-none md:h-8 md:px-2 md:text-xs"
                                                                    reservedButtonPadding="1.35rem"
                                                                    iconDensity="compact"
                                                                    placeholder="キーワード"
                                                                    suggestionsPanelExtraWidthPx={98}
                                                                    onFetchSuggestions={
                                                                        CONDITION_SUGGEST_FIELDS[row.field]
                                                                            ? (termValue) =>
                                                                                  fetchSuggestions(
                                                                                      CONDITION_SUGGEST_FIELDS[row.field] as SearchSuggestField,
                                                                                      termValue,
                                                                                  )
                                                                            : undefined
                                                                    }
                                                                    suggestField={CONDITION_SUGGEST_FIELDS[row.field]}
                                                                    suggestVariant="A"
                                                                    suggestEnabled={Boolean(CONDITION_SUGGEST_FIELDS[row.field])}
                                                                />
                                                            )}
                                                            <SelectField
                                                                value={row.method}
                                                                onChange={(event) =>
                                                                    updateConditionInGroup(group.id, row.id, {
                                                                        method: event.target.value as ConditionDraft["method"],
                                                                    })
                                                                }
                                                                className="border-l-0 border-gray-400 px-1 py-0 text-[11px] md:h-8 md:text-xs"
                                                            >
                                                                {((isTag || isPrefecture) ? TAG_METHOD_OPTIONS : TEXT_METHOD_OPTIONS).map((option) => (
                                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                                ))}
                                                            </SelectField>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeConditionFromGroup(group.id, row.id)}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-none p-0 text-red-700 hover:bg-red-50 hover:text-red-800 md:h-8 md:w-8"
                                                                title="条件を削除"
                                                                aria-label="条件を削除"
                                                            >
                                                                <XIcon className="h-3 w-3" />
                                                            </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
                <ConditionExpressionPreview
                    groups={groups.map((group) => ({
                        conditionJoin: group.conditionJoin,
                        conditions: group.conditions.map((condition) => ({
                            field: condition.field,
                            value: condition.value,
                            method: condition.method,
                        })),
                    }))}
                    topLevelJoin={topLevelJoin}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    getFieldLabel={(field) =>
                        fieldLabelMap.get(field as SongRankingConditionField) ?? field
                    }
                    getDisplayValue={(item) =>
                        item.field === "prefectureId"
                            ? (prefectureOptions.find(
                                  (option) => String(option.id) === item.value.trim(),
                              )?.name ?? item.value.trim())
                            : item.value.trim()
                    }
                    getMethodLabel={(item) =>
                        item.field === "eventTag" || item.field === "prefectureId"
                            ? item.method === "not"
                                ? "でない"
                                : "である"
                            : conditionPreviewMethodLabels[
                                  (item.method === "eq" || item.method === "not"
                                      ? "exact"
                                      : item.method) as SearchMethod
                              ] ?? item.method
                    }
                    isNegativeMethod={(method) =>
                        method === "notContains" || method === "notExact" || method === "not"
                    }
                />
            </section>

            <section className="rounded-none border-2 border-gray-800 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]">
                <SearchResultsHeaderControls
                    total={result.total}
                    unitLabel={unitLabel}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    sortOptions={sortOptions}
                    viewMode="table"
                    onSortByChange={(value) => {
                        setSortBy(value as SortBy);
                        setPage(1);
                        setPageInput("1");
                    }}
                    onSortOrderChange={(value) => {
                        setSortOrder(value);
                        setPage(1);
                        setPageInput("1");
                    }}
                    onViewModeChange={() => {}}
                    showViewModeToggle={false}
                    tableDensity={textSize}
                    onTableDensityChange={handleTextSizeChange}
                />

                {dateRangeError ? <p className="mb-2 text-xs text-red-600">{dateRangeError}</p> : null}
                {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
                {loading ? <p className="mb-2 text-xs text-slate-600">検索中...</p> : null}

                <div className="hidden overflow-x-auto md:block">
                    <table className={`w-full ${textSizeClass[textSize]}`}>
                        <thead className="border-b border-slate-200 bg-red-600 text-xs text-white">
                            <tr>
                                <th className="px-2 py-2 text-left whitespace-nowrap">順位</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap">
                                    {rankingBy === "artist" ? "アーティスト" : rankingBy === "performer" ? "歌唱者" : "楽曲名"}
                                </th>
                                {rankingBy === "song" ? (
                                    <th className="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap">アーティスト</th>
                                ) : null}
                                <th className="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSortBy("performances");
                                            setPage(1);
                                            setPageInput("1");
                                        }}
                                        className="inline-flex items-center gap-1"
                                    >
                                        歌唱回数
                                        {sortBy === "performances" ? <span>{sortOrder === "asc" ? "▲" : "▼"}</span> : null}
                                    </button>
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSortBy("stages");
                                            setPage(1);
                                            setPageInput("1");
                                        }}
                                        className="inline-flex items-center gap-1"
                                    >
                                        ステージ数
                                        {sortBy === "stages" ? <span>{sortOrder === "asc" ? "▲" : "▼"}</span> : null}
                                    </button>
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSortBy("events");
                                            setPage(1);
                                            setPageInput("1");
                                        }}
                                        className="inline-flex items-center gap-1"
                                    >
                                        イベント数
                                        {sortBy === "events" ? <span>{sortOrder === "asc" ? "▲" : "▼"}</span> : null}
                                    </button>
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap">最終歌唱日</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.rows.map((row, index) => (
                                <tr
                                    key={`${row.entityType}-${row.entityId ?? row.entityName}-${row.rank}`}
                                    className={`border-b border-slate-100 ${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100`}
                                >
                                    <td className="px-2 py-2">{row.rank}</td>
                                    <td className="px-2 py-2">
                                        {rankingBy === "song" && row.songId ? (
                                            <button
                                                type="button"
                                                className="text-left text-blue-700 hover:underline"
                                                onClick={() => onOpenSong(row.songId!)}
                                            >
                                                {row.entityName}
                                            </button>
                                        ) : rankingBy === "artist" && row.entityId ? (
                                            <button
                                                type="button"
                                                className="text-left text-blue-700 hover:underline"
                                                onClick={() => onOpenArtist(row.entityId!)}
                                            >
                                                {row.entityName}
                                            </button>
                                        ) : (
                                            <span>{row.entityName}</span>
                                        )}
                                    </td>
                                    {rankingBy === "song" ? (
                                        <td className="px-2 py-2">
                                            {row.artistId ? (
                                                <button
                                                    type="button"
                                                    className="text-left text-blue-700 hover:underline"
                                                    onClick={() => onOpenArtist(row.artistId!)}
                                                >
                                                    {row.artistName ?? "-"}
                                                </button>
                                            ) : (
                                                <span>{row.artistName ?? "-"}</span>
                                            )}
                                        </td>
                                    ) : null}
                                    <td className="px-2 py-2">{row.totalPerformances.toLocaleString()}</td>
                                    <td className="px-2 py-2">{row.totalStages.toLocaleString()}</td>
                                    <td className="px-2 py-2">{row.totalEvents.toLocaleString()}</td>
                                    <td className="px-2 py-2">{formatDateYmd(row.lastPerformedDate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="border-y-2 border-gray-800 md:hidden">
                    <div className="grid grid-cols-[3rem_minmax(0,1fr)_3.75rem] bg-red-600 text-[10px] font-semibold tracking-wide text-white">
                        <div className="px-1.5 py-1.5 text-center">順位</div>
                        <div className="px-1.5 py-1.5">{rankingBy === "artist" ? "アーティスト" : rankingBy === "performer" ? "歌唱者" : "楽曲"}</div>
                        <div className="px-1.5 py-1.5 text-right">{mobileMetric.label}</div>
                    </div>
                    <div className="divide-y divide-gray-300">
                        {result.rows.map((row, index) => (
                                <div
                                    key={`ranking-mobile-row-${row.entityType}-${row.entityId ?? row.entityName}-${row.rank}`}
                                    className={`grid grid-cols-[3rem_minmax(0,1fr)_3.75rem] items-center ${
                                        index % 2 === 0 ? "bg-white" : "bg-slate-50"
                                    }`}
                                >
                                    <div className="px-1.5 py-1 text-center font-mono text-xs font-bold text-red-700">
                                        #{row.rank}
                                    </div>
                                    <div className="min-w-0 px-1.5 py-1">
                                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                            {rankingBy === "song" && row.songId ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={`min-w-0 max-w-full whitespace-normal break-words text-left font-semibold leading-snug text-blue-700 hover:underline ${mobileNameClass[textSize]}`}
                                                        onClick={() => onOpenSong(row.songId!)}
                                                        title={row.entityName}
                                                    >
                                                        {row.entityName}
                                                    </button>
                                                    <span className="shrink-0 text-[10px] text-slate-400">/</span>
                                                    <button
                                                        type="button"
                                                        className={`min-w-0 max-w-full whitespace-normal break-words text-left leading-snug text-slate-600 hover:text-blue-700 hover:underline ${mobileArtistClass[textSize]}`}
                                                        onClick={() => row.artistId && onOpenArtist(row.artistId)}
                                                        title={row.artistName ?? ""}
                                                    >
                                                        {row.artistName ?? "-"}
                                                    </button>
                                                </>
                                            ) : rankingBy === "artist" && row.entityId ? (
                                                <button
                                                    type="button"
                                                    className={`min-w-0 max-w-full whitespace-normal break-words text-left font-semibold leading-snug text-blue-700 hover:underline ${mobileNameClass[textSize]}`}
                                                    onClick={() => onOpenArtist(row.entityId!)}
                                                    title={row.entityName}
                                                >
                                                    {row.entityName}
                                                </button>
                                            ) : (
                                                <span
                                                    className={`min-w-0 max-w-full whitespace-normal break-words text-left font-semibold leading-snug text-slate-900 ${mobileNameClass[textSize]}`}
                                                    title={row.entityName}
                                                >
                                                    {row.entityName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="px-1.5 py-1 text-right">
                                        <div className={`font-mono font-bold text-slate-900 ${mobileNameClass[textSize]}`}>
                                            {mobileMetric.getValue(row).toLocaleString()}
                                        </div>
                                        <div className={`leading-none text-slate-500 ${mobileArtistClass[textSize]}`}>
                                            {mobileMetric.unit}
                                        </div>
                                    </div>
                                </div>
                        ))}
                    </div>
                </div>

                <SearchPagination
                    page={result.page}
                    totalPages={result.totalPages}
                    pageSize={pageSize}
                    pageInput={pageInput}
                    setPageInput={setPageInput}
                    onGoToPage={(nextPage) => setPage(Math.max(1, Math.min(nextPage, result.totalPages)))}
                    onPageSizeChange={(nextPageSize) => {
                        setPageSize(normalizePageSize(nextPageSize));
                        setPage(1);
                        setPageInput("1");
                    }}
                />
            </section>
        </section>
    );
}
