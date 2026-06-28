import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDbSuggestions } from "./useDbSuggestions";
import { isDbStatusUsable } from "./useSetlistSearchDb";
import {
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    normalizePageSize,
} from "../lib/constants/searchDefaults";
import { DB_REFRESH_EVENT } from "../lib/dbRefreshEvent";
import { sortEventTagsByPriority } from "../lib/eventTagPriority";
import { recordSearchAnalytics } from "../lib/searchAnalytics";
import {
    coerceDateRangeForMode,
    formatDateRangeLabel,
} from "../lib/searchDateRange";
import {
    DEFAULT_STATE,
    STORAGE_KEY,
    buildUrl,
    loadPersistedState,
    loadStateFromUrl,
    type PersistedState,
    type SearchMode,
} from "../lib/searchUiState";
import {
    type AdvancedConditionField,
    type AdvancedConditionGroup,
    type AdvancedConditionValue,
    DEFAULT_FIELD_SEARCH_METHODS,
    type FieldSearchMethods,
    type SearchDateMode,
    type SearchMethod,
    type SearchRequest,
    type SearchSuggestVariant,
    type SearchResponse,
    type SearchUnit,
    type SetlistSearchDb,
    type SortBy,
    type SortOrder,
    type MasterOption,
} from "../lib/setlistSearchDb/types";


import type { DbState } from "./useSetlistSearchDb";

type SearchTag = {
    key: string;
    label: string;
    clear: () => void;
};

type NormalizedPerformerSelection = {
    key: string;
    label: string;
};

const parseNormalizedPerformerSelections = (
    raw: string,
    persisted?: Array<{ key: string; label: string }>,
): NormalizedPerformerSelection[] =>
    raw
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((key) => {
            const matched = persisted?.find((item) => item.key === key);
            return { key, label: matched?.label ?? key };
        });

const SEARCH_DEBOUNCE_MS = 120;
const SEARCH_RESULT_CACHE_LIMIT = 120;
const SEARCH_BOOTSTRAP_CACHE_KEY = "tomoko-duc.search-bootstrap-cache.v1";
const PARQUET_RELEASE_SIGNATURE_KEY = "tomoko-duc-parquet-release-signature-v1";
const SEARCH_BOOTSTRAP_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ADVANCED_CONDITION_FIELD_LABELS: Record<AdvancedConditionField, string> = {
    songName: "楽曲名",
    personName: "歌唱者",
    artistName: "アーティスト",
    lyricistName: "作詞",
    composerName: "作曲",
    arrangerName: "編曲",
    eventName: "イベント名",
    venueName: "会場名",
    sectionName: "セクション",
    eventTag: "イベントタグ",
    prefectureId: "都道府県",
};

const nextConditionGroupId = (): string =>
    `cg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const nextConditionRowId = (): string =>
    `cr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const isDropdownConditionField = (field: AdvancedConditionField): boolean =>
    field === "eventTag" || field === "prefectureId";
const normalizeConditionMethod = (
    field: AdvancedConditionField,
    method: SearchMethod,
): SearchMethod => {
    if (!isDropdownConditionField(field)) return method;
    return method === "notContains" || method === "notExact" ? "notExact" : "exact";
};

const toConditionGroupsFromLegacy = (params: {
    personName: string;
    songName: string;
    artistName: string;
    lyricistName: string;
    composerName: string;
    arrangerName: string;
    eventName: string;
    venueName: string;
    sectionName: string;
    eventTag: string;
    prefectureIds: string;
    fieldSearchMethods: FieldSearchMethods;
}): AdvancedConditionGroup[] => {
    const rows: Array<{ field: AdvancedConditionField; value: string }> = [
        { field: "songName", value: params.songName },
        { field: "personName", value: params.personName },
        { field: "artistName", value: params.artistName },
        { field: "lyricistName", value: params.lyricistName },
        { field: "composerName", value: params.composerName },
        { field: "arrangerName", value: params.arrangerName },
        { field: "eventName", value: params.eventName },
        { field: "venueName", value: params.venueName },
        { field: "sectionName", value: params.sectionName },
        { field: "eventTag", value: params.eventTag },
        { field: "prefectureId", value: params.prefectureIds },
    ];
    return rows.reduce<AdvancedConditionGroup[]>((acc, { field, value }) => {
        if (value.trim().length === 0) return acc;
        let method: SearchMethod = "contains";
        if (isDropdownConditionField(field)) {
            method = "exact";
        } else if (field in params.fieldSearchMethods) {
            method = params.fieldSearchMethods[field as keyof FieldSearchMethods];
        }
        acc.push({
            id: nextConditionGroupId(),
            field,
            joinWithPrev: "and",
            values: [{ id: nextConditionRowId(), field, value: value.trim(), method }],
        });
        return acc;
    }, []);
};

const normalizeConditionGroups = (
    groups: AdvancedConditionGroup[],
): AdvancedConditionGroup[] =>
    groups
        .map((group): AdvancedConditionGroup => ({
            ...group,
            conditionJoin: (group.conditionJoin === "or" ? "or" : "and"),
            joinWithPrev: (group.joinWithPrev === "or" ? "or" : "and"),
            values: group.values
                .map((value) => ({
                    id: value.id ?? nextConditionRowId(),
                    field: value.field ?? group.field,
                    value: value.value.trim(),
                    method: normalizeConditionMethod(value.field ?? group.field, value.method),
                }))
                .filter((value) => value.value.length > 0),
        }))
        .filter((group) => group.values.length > 0);

const SORT_OPTIONS: Record<SearchUnit, Array<{ value: SortBy; label: string }>> = {
    stage: [
        { value: "event", label: "イベント名" },
        { value: "date", label: "開催日" },
        { value: "venue", label: "会場名" },
    ],
    setlist: [
        { value: "title", label: "楽曲名" },
        { value: "performer", label: "歌唱者" },
        { value: "artist", label: "アーティスト" },
        { value: "event", label: "イベント名" },
        { value: "date", label: "開催日" },
        { value: "venue", label: "会場名" },
    ],
};

export type SearchResultTableHeader = {
    label: string;
    sortBy?: SortBy;
};

const TABLE_HEADERS_BY_UNIT: Record<SearchUnit, SearchResultTableHeader[]> = {
    stage: [
        { label: "イベント", sortBy: "event" },
        { label: "セトリ" },
        { label: "開催日", sortBy: "date" },
        { label: "開演時間" },
        { label: "会場", sortBy: "venue" },
        { label: "都道府県" },
        { label: "タグ" },
    ],
    setlist: [
        { label: "セトリ" },
        { label: "楽曲", sortBy: "title" },
        { label: "歌唱者", sortBy: "performer" },
        { label: "アーティスト", sortBy: "artist" },
        { label: "セクション" },
        { label: "イベント", sortBy: "event" },
        { label: "開催日", sortBy: "date" },
        { label: "会場", sortBy: "venue" },
    ],
};

export function getTableHeaders(searchUnit: SearchUnit): SearchResultTableHeader[] {
    return TABLE_HEADERS_BY_UNIT[searchUnit].map((header) => ({ ...header }));
}

const EMPTY_RESULT: SearchResponse = {
    rows: [],
    total: 0,
    page: DEFAULT_PAGE,
    limit: DEFAULT_PAGE_SIZE,
    totalPages: DEFAULT_PAGE,
};

type SearchBootstrapCache = {
    signature: string;
    requestKey: string;
    response: SearchResponse;
    savedAt: number;
};

const readStoredParquetSignature = (): string | null => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(PARQUET_RELEASE_SIGNATURE_KEY);
        if (!raw) return null;
        return raw.trim() || null;
    } catch {
        return null;
    }
};

const isSearchResponseLike = (value: unknown): value is SearchResponse => {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return (
        Array.isArray(record.rows) &&
        typeof record.total === "number" &&
        typeof record.page === "number" &&
        typeof record.limit === "number" &&
        typeof record.totalPages === "number"
    );
};

const readSearchBootstrapCache = (): SearchBootstrapCache | null => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(SEARCH_BOOTSTRAP_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return null;
        const record = parsed as Record<string, unknown>;
        if (
            typeof record.signature !== "string" ||
            typeof record.requestKey !== "string" ||
            typeof record.savedAt !== "number" ||
            !isSearchResponseLike(record.response)
        ) {
            return null;
        }
        if (Date.now() - record.savedAt > SEARCH_BOOTSTRAP_CACHE_MAX_AGE_MS) {
            return null;
        }
        return {
            signature: record.signature,
            requestKey: record.requestKey,
            response: record.response,
            savedAt: record.savedAt,
        };
    } catch {
        return null;
    }
};

const writeSearchBootstrapCache = (cache: SearchBootstrapCache): void => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(SEARCH_BOOTSTRAP_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // ignore storage errors
    }
};

const SUGGEST_AB_KEY = "tomoko-duc.suggest-ab-variant.v1";
const resolveSuggestVariant = (): SearchSuggestVariant => {
    if (typeof window === "undefined") return "A";
    const current = window.localStorage.getItem(SUGGEST_AB_KEY);
    if (current === "A" || current === "B") return current;
    const assigned: SearchSuggestVariant = Math.random() < 0.5 ? "A" : "B";
    window.localStorage.setItem(SUGGEST_AB_KEY, assigned);
    return assigned;
};

export function useSearchPageState({
    db,
    dbState,
    navigateHome,
    syncUrlWithSearchState,
}: {
    db: SetlistSearchDb | null;
    dbState: DbState;
    navigateHome: () => void;
    syncUrlWithSearchState: boolean;
}) {
    const initial = useMemo(() => {
        const merged = {
            ...loadPersistedState(),
            ...loadStateFromUrl(),
        };
        return {
            ...merged,
            searchUnit: merged.searchUnit,
        };
    }, []);

    const [searchMode, setSearchMode] = useState<SearchMode>(initial.searchMode);
    const [searchUnit, setSearchUnit] = useState<SearchUnit>(initial.searchUnit);
    const [groupByEvent, setGroupByEvent] = useState<boolean>(initial.groupByEvent);
    const [groupByEventSong, setGroupByEventSong] = useState<boolean>(
        initial.groupByEventSong,
    );
    const [query, setQuery] = useState<string>(initial.query);
    const [normalizedPerformerSelections, setNormalizedPerformerSelections] =
        useState<NormalizedPerformerSelection[]>(() =>
            parseNormalizedPerformerSelections(
                initial.normalizedPerformerKeys ?? "",
                initial.normalizedPerformerSelections,
            ),
        );
    const [personName, setPersonName] = useState<string>(initial.personName);
    const [songName, setSongName] = useState<string>(initial.songName);
    const [artistName, setArtistName] = useState<string>(initial.artistName);
    const [lyricistName, setLyricistName] = useState<string>(initial.lyricistName);
    const [composerName, setComposerName] = useState<string>(initial.composerName);
    const [arrangerName, setArrangerName] = useState<string>(initial.arrangerName);
    const [eventName, setEventName] = useState<string>(initial.eventName);
    const [venueName, setVenueName] = useState<string>(initial.venueName);
    const [eventTag, setEventTag] = useState<string>(initial.eventTag);
    const [sectionName, setSectionName] = useState<string>(initial.sectionName);
    const [conditionGroups, setConditionGroups] = useState<AdvancedConditionGroup[]>(() => {
        if (Array.isArray(initial.conditionGroups) && initial.conditionGroups.length > 0) {
            return normalizeConditionGroups(initial.conditionGroups);
        }
        return toConditionGroupsFromLegacy({
            personName: initial.personName,
            songName: initial.songName,
            artistName: initial.artistName,
            lyricistName: initial.lyricistName,
            composerName: initial.composerName,
            arrangerName: initial.arrangerName,
            eventName: initial.eventName,
            venueName: initial.venueName,
            sectionName: initial.sectionName,
            eventTag: initial.eventTag,
            prefectureIds: initial.prefectureIds,
            fieldSearchMethods:
                initial.fieldSearchMethods ?? DEFAULT_FIELD_SEARCH_METHODS,
        });
    });
    const [conditionTopLevelJoin, setConditionTopLevelJoin] = useState<"and" | "or">(
        initial.conditionTopLevelJoin === "or" ? "or" : "and",
    );
    const [prefectureIds, setPrefectureIds] = useState<string>(initial.prefectureIds);
    const [fieldSearchMethods, setFieldSearchMethods] = useState<FieldSearchMethods>(
        initial.fieldSearchMethods ?? DEFAULT_FIELD_SEARCH_METHODS,
    );
    const initialDateMode: SearchDateMode = initial.dateMode === "date" ? "date" : "year";
    const initialDateRange = coerceDateRangeForMode(initialDateMode, {
        dateFrom: initial.dateFrom,
        dateTo: initial.dateTo,
    });
    const [dateMode, setDateMode] = useState<SearchDateMode>(initialDateMode);
    const [dateFrom, setDateFrom] = useState<string>(initialDateRange.dateFrom);
    const [dateTo, setDateTo] = useState<string>(initialDateRange.dateTo);
    const [sortBy, setSortBy] = useState<SortBy>(initial.sortBy);
    const [sortOrder, setSortOrder] = useState<SortOrder>(initial.sortOrder);
    const [page, setPage] = useState<number>(initial.page);
    const [pageSize, setPageSize] = useState<number>(initial.pageSize ?? DEFAULT_PAGE_SIZE);
    const [pageInput, setPageInput] = useState<string>(String(initial.page));
    const [formCollapsed, setFormCollapsed] = useState<boolean>(initial.formCollapsed);
    const [result, setResult] = useState<SearchResponse>(EMPTY_RESULT);
    const [runningSearch, setRunningSearch] = useState<boolean>(false);
    const [hasSearched, setHasSearched] = useState<boolean>(true);
    const [eventTagOptions, setEventTagOptions] = useState<MasterOption[]>([]);
    const [prefectureOptions, setPrefectureOptions] = useState<MasterOption[]>([]);
    const dbRef = useRef<SetlistSearchDb | null>(db);
    const dbStatusRef = useRef<DbState["status"]>(dbState.status);
    const activeSearchRef = useRef(false);
    const queuedSearchRef = useRef<{ request: SearchRequest } | null>(null);
    const searchTimerRef = useRef<number | null>(null);
    const searchResultCacheRef = useRef<Map<string, SearchResponse>>(new Map());
    const [suggestVariant] = useState<SearchSuggestVariant>(() => resolveSuggestVariant());
    const hydratedBootstrapCacheRef = useRef(false);
    const normalizedPerformerKeys = "";

    useEffect(() => {
        dbRef.current = db;
    }, [db]);

    useEffect(() => {
        searchResultCacheRef.current.clear();
        queuedSearchRef.current = null;
    }, [db]);

    useEffect(() => {
        if (isDbStatusUsable(dbState.status)) {
            return;
        }
        searchResultCacheRef.current.clear();
        queuedSearchRef.current = null;
    }, [dbState.status]);

    useEffect(() => {
        dbStatusRef.current = dbState.status;
    }, [dbState.status]);

    useEffect(() => {
        if (!isDbStatusUsable(dbState.status) || !db) {
            return;
        }
        let cancelled = false;
        const loadMasters = async () => {
            const [tags, prefectures] = await Promise.all([
                db.listEventTags(),
                db.listPrefectures(),
            ]);
            if (!cancelled) {
                setEventTagOptions(sortEventTagsByPriority(tags));
                setPrefectureOptions(prefectures);
            }
        };
        void loadMasters();
        return () => {
            cancelled = true;
        };
    }, [dbState.status, db]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const next: PersistedState = {
            searchUnit,
            groupByEvent,
            groupByEventSong,
            searchMode,
            query,
            normalizedPerformerKeys,
            normalizedPerformerSelections,
            conditionGroups,
            conditionTopLevelJoin,
            personName,
            songName,
            artistName,
            lyricistName,
            composerName,
            arrangerName,
            eventName,
            venueName,
            eventTag,
            sectionName,
            prefectureIds,
            fieldSearchMethods,
            dateMode,
            dateFrom,
            dateTo,
            sortBy,
            sortOrder,
            page,
            pageSize,
            formCollapsed,
            hasSearched,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }, [
        searchUnit,
        groupByEvent,
        groupByEventSong,
        searchMode,
        query,
        normalizedPerformerKeys,
        normalizedPerformerSelections,
        conditionGroups,
        conditionTopLevelJoin,
        personName,
        songName,
        artistName,
        lyricistName,
        composerName,
        arrangerName,
        eventName,
        venueName,
        eventTag,
        sectionName,
        prefectureIds,
        fieldSearchMethods,
        dateMode,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
        page,
        pageSize,
        formCollapsed,
        hasSearched,
    ]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const nextUrl = syncUrlWithSearchState
            ? buildUrl({
                  searchUnit,
                  groupByEvent,
                  groupByEventSong,
                  searchMode,
                  query,
                  normalizedPerformerKeys,
                  conditionGroups,
                  conditionTopLevelJoin,
                  personName,
                  songName,
                  artistName,
                  lyricistName,
                  composerName,
                  arrangerName,
                  eventName,
                  venueName,
                  eventTag,
                  sectionName,
                  prefectureIds,
                  fieldSearchMethods,
                  dateMode,
                  dateFrom,
                  dateTo,
                  sortBy,
                  sortOrder,
                  page,
                  pageSize,
                  formCollapsed,
                  hasSearched,
              })
            : `${window.location.pathname}${window.location.search}`;

        if (nextUrl) {
            window.history.replaceState(null, "", nextUrl);
        }
    }, [
        searchUnit,
        groupByEvent,
        groupByEventSong,
        searchMode,
        query,
        normalizedPerformerKeys,
        conditionGroups,
        conditionTopLevelJoin,
        personName,
        songName,
        artistName,
        lyricistName,
        composerName,
        arrangerName,
        eventName,
        venueName,
        eventTag,
        sectionName,
        prefectureIds,
        fieldSearchMethods,
        dateMode,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
        page,
        pageSize,
        formCollapsed,
        hasSearched,
        syncUrlWithSearchState,
    ]);

    const searchRequest = useMemo<SearchRequest>(
        () => {
            const normalizedGroups = normalizeConditionGroups(conditionGroups);
            const hasBuilder = normalizedGroups.length > 0;
            return {
                searchUnit,
                groupByEvent: searchUnit === "stage",
                groupByEventSong: searchUnit === "setlist" && groupByEventSong,
                term: query,
                normalizedPerformerKeys,
                conditionGroups: hasBuilder ? normalizedGroups : undefined,
                conditionTopLevelJoin: hasBuilder ? conditionTopLevelJoin : "and",
                personName: hasBuilder ? "" : personName,
                songName: hasBuilder ? "" : songName,
                artistName: hasBuilder ? "" : artistName,
                lyricistName: hasBuilder ? "" : lyricistName,
                composerName: hasBuilder ? "" : composerName,
                arrangerName: hasBuilder ? "" : arrangerName,
                eventName: hasBuilder ? "" : eventName,
                venueName: hasBuilder ? "" : venueName,
                eventTag: hasBuilder ? "" : eventTag,
                sectionName: hasBuilder ? "" : sectionName,
                prefectureIds: hasBuilder ? "" : prefectureIds,
                fieldSearchMethods,
                dateFrom,
                dateTo,
                sortBy,
                sortOrder,
                page,
                limit: pageSize,
            };
        },
        [
            searchUnit,
            groupByEventSong,
            query,
            normalizedPerformerKeys,
            conditionGroups,
            conditionTopLevelJoin,
            personName,
            songName,
            artistName,
            lyricistName,
            composerName,
            arrangerName,
            eventName,
            venueName,
            eventTag,
            sectionName,
            prefectureIds,
            fieldSearchMethods,
            dateFrom,
            dateTo,
            sortBy,
            sortOrder,
            page,
            pageSize,
        ],
    );

    useEffect(() => {
        if (hydratedBootstrapCacheRef.current) {
            return;
        }
        if (dbState.status !== "loading" || db) {
            return;
        }
        const signature = readStoredParquetSignature();
        if (!signature) {
            return;
        }
        const cached = readSearchBootstrapCache();
        if (!cached) {
            return;
        }
        const requestKey = JSON.stringify(searchRequest);
        if (cached.signature !== signature || cached.requestKey !== requestKey) {
            return;
        }
        hydratedBootstrapCacheRef.current = true;
        setResult(cached.response);
        setPageInput(String(cached.response.page));
        setHasSearched(true);
    }, [dbState.status, db, searchRequest]);

    const drainSearchQueue = useCallback(async () => {
        if (activeSearchRef.current) {
            return;
        }
        if (!isDbStatusUsable(dbStatusRef.current) || !dbRef.current) {
            return;
        }
        const currentQueued = queuedSearchRef.current;
        if (!currentQueued) {
            return;
        }

        activeSearchRef.current = true;
        setRunningSearch(true);
        try {
            while (
                queuedSearchRef.current &&
                dbRef.current &&
                isDbStatusUsable(dbStatusRef.current)
            ) {
                const nextQueued = queuedSearchRef.current;
                queuedSearchRef.current = null;
                const requestKey = JSON.stringify(nextQueued.request);
                const cached = searchResultCacheRef.current.get(requestKey);
                if (cached) {
                    setResult(cached);
                    setPageInput(String(cached.page));
                    recordSearchAnalytics(nextQueued.request, cached, searchMode);
                    searchResultCacheRef.current.delete(requestKey);
                    searchResultCacheRef.current.set(requestKey, cached);
                    continue;
                }

                const next = await dbRef.current.query(nextQueued.request);
                setResult(next);
                setPageInput(String(next.page));
                recordSearchAnalytics(nextQueued.request, next, searchMode);
                searchResultCacheRef.current.set(requestKey, next);
                const signature = readStoredParquetSignature();
                if (signature) {
                    writeSearchBootstrapCache({
                        signature,
                        requestKey,
                        response: next,
                        savedAt: Date.now(),
                    });
                }
                if (searchResultCacheRef.current.size > SEARCH_RESULT_CACHE_LIMIT) {
                    const oldestKey = searchResultCacheRef.current.keys().next().value;
                    if (typeof oldestKey === "string") {
                        searchResultCacheRef.current.delete(oldestKey);
                    }
                }
            }
        } finally {
            activeSearchRef.current = false;
            setRunningSearch(false);
            if (queuedSearchRef.current) {
                void drainSearchQueue();
            }
        }
    }, [searchMode]);

    useEffect(() => {
        if (!isDbStatusUsable(dbState.status) || !db) {
            return;
        }
        if (searchTimerRef.current !== null) {
            clearTimeout(searchTimerRef.current);
        }
        searchTimerRef.current = window.setTimeout(() => {
            queuedSearchRef.current = {
                request: searchRequest,
            };
            void drainSearchQueue();
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            if (searchTimerRef.current !== null) {
                clearTimeout(searchTimerRef.current);
                searchTimerRef.current = null;
            }
        };
    }, [dbState.status, db, searchRequest, drainSearchQueue]);

    const sortOptions = useMemo(() => SORT_OPTIONS[searchUnit], [searchUnit]);

    const tableHeaders = useMemo(() => getTableHeaders(searchUnit), [searchUnit]);

    const goToPage = useCallback(
        (nextPage: number) => {
            const clamped = Math.max(1, Math.min(result.totalPages, nextPage));
            setPage(clamped);
            setPageInput(String(clamped));
        },
        [result.totalPages],
    );

    const handlePageSizeChange = useCallback(
        (nextPageSize: number) => {
            const normalized = normalizePageSize(nextPageSize);
            const currentOffset = (page - 1) * pageSize;
            const recalculatedPage = Math.floor(currentOffset / normalized) + 1;
            const nextTotalPages = Math.max(
                1,
                Math.ceil((result.total || 0) / normalized),
            );
            const clampedPage = Math.min(recalculatedPage, nextTotalPages);

            setPageSize(normalized);
            setPage(clampedPage);
            setPageInput(String(clampedPage));
        },
        [page, pageSize, result.total],
    );

    const handleSearchUnitChange = useCallback(
        (unit: SearchUnit) => {
            const nextSortOptions = SORT_OPTIONS[unit];
            const sortAllowed = nextSortOptions.some((option) => option.value === sortBy);

            setSearchUnit(unit);
            setPage(DEFAULT_PAGE);
            setPageInput(String(DEFAULT_PAGE));

            if (!sortAllowed) {
                setSortBy("date");
                setSortOrder("desc");
            }

            navigateHome();
        },
        [navigateHome, sortBy],
    );

    const resetFilters = useCallback(() => {
        setQuery("");
        setNormalizedPerformerSelections([]);
        setGroupByEventSong(false);
        setPersonName("");
        setSongName("");
        setArtistName("");
        setLyricistName("");
        setComposerName("");
        setArrangerName("");
        setEventName("");
        setVenueName("");
        setEventTag("");
        setSectionName("");
        setConditionGroups([]);
        setConditionTopLevelJoin("and");
        setPrefectureIds("");
        setFieldSearchMethods(DEFAULT_FIELD_SEARCH_METHODS);
        setDateMode(DEFAULT_STATE.dateMode);
        setDateFrom("");
        setDateTo("");
        setSortBy("date");
        setSortOrder("desc");
        setPage(DEFAULT_PAGE);
        setPageSize(DEFAULT_PAGE_SIZE);
        setPageInput(String(DEFAULT_PAGE));
        setHasSearched(true);
        setResult(EMPTY_RESULT);
    }, []);

    const clearSession = useCallback(() => {
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(STORAGE_KEY);
        }
        setSearchMode("advanced");
        setSearchUnit("setlist");
        setGroupByEvent(true);
        setGroupByEventSong(false);
        setFormCollapsed(false);
        setHasSearched(true);
        setResult(EMPTY_RESULT);
        setQuery("");
        setNormalizedPerformerSelections([]);
        setPersonName("");
        setSongName("");
        setArtistName("");
        setLyricistName("");
        setComposerName("");
        setArrangerName("");
        setEventName("");
        setVenueName("");
        setEventTag("");
        setSectionName("");
        setConditionGroups([]);
        setConditionTopLevelJoin("and");
        setPrefectureIds("");
        setFieldSearchMethods(DEFAULT_FIELD_SEARCH_METHODS);
        setDateFrom("");
        setDateTo("");
        setSortBy("date");
        setSortOrder("desc");
        setPage(DEFAULT_PAGE);
        setPageSize(DEFAULT_PAGE_SIZE);
        setPageInput(String(DEFAULT_PAGE));
        navigateHome();
    }, [navigateHome]);

    const resetAllSearchConditions = useCallback(() => {
        setSearchMode(DEFAULT_STATE.searchMode);
        setSearchUnit(DEFAULT_STATE.searchUnit);
        setGroupByEvent(DEFAULT_STATE.groupByEvent);
        setGroupByEventSong(DEFAULT_STATE.groupByEventSong);
        setFormCollapsed(DEFAULT_STATE.formCollapsed);
        setHasSearched(true);
        setResult(EMPTY_RESULT);
        setQuery(DEFAULT_STATE.query);
        setNormalizedPerformerSelections([]);
        setPersonName(DEFAULT_STATE.personName);
        setSongName(DEFAULT_STATE.songName);
        setArtistName(DEFAULT_STATE.artistName);
        setLyricistName(DEFAULT_STATE.lyricistName);
        setComposerName(DEFAULT_STATE.composerName);
        setArrangerName(DEFAULT_STATE.arrangerName);
        setEventName(DEFAULT_STATE.eventName);
        setVenueName(DEFAULT_STATE.venueName);
        setEventTag(DEFAULT_STATE.eventTag);
        setSectionName(DEFAULT_STATE.sectionName);
        setConditionGroups([]);
        setConditionTopLevelJoin("and");
        setPrefectureIds(DEFAULT_STATE.prefectureIds);
        setFieldSearchMethods(DEFAULT_STATE.fieldSearchMethods);
        setDateMode(DEFAULT_STATE.dateMode);
        setDateFrom(DEFAULT_STATE.dateFrom);
        setDateTo(DEFAULT_STATE.dateTo);
        setSortBy(DEFAULT_STATE.sortBy);
        setSortOrder(DEFAULT_STATE.sortOrder);
        setPage(DEFAULT_STATE.page);
        setPageSize(DEFAULT_STATE.pageSize);
        setPageInput(String(DEFAULT_STATE.page));
        searchResultCacheRef.current.clear();
        queuedSearchRef.current = null;
        navigateHome();
    }, [navigateHome]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleDbRefresh = () => {
            resetAllSearchConditions();
        };
        window.addEventListener(DB_REFRESH_EVENT, handleDbRefresh);
        return () => {
            window.removeEventListener(DB_REFRESH_EVENT, handleDbRefresh);
        };
    }, [resetAllSearchConditions]);

    const addConditionGroup = useCallback((field: AdvancedConditionField) => {
        setConditionGroups((prev) => [
            ...prev,
            {
                id: nextConditionGroupId(),
                field,
                joinWithPrev: "and",
                conditionJoin: "and",
                values: [
                    {
                        id: nextConditionRowId(),
                        field,
                        value: "",
                        method: isDropdownConditionField(field) ? "exact" : "contains",
                    },
                ],
            },
        ]);
    }, []);

    const removeConditionGroup = useCallback((groupId: string) => {
        setConditionGroups((prev) => prev.filter((group) => group.id !== groupId));
    }, []);

    const updateConditionGroupField = useCallback(
        (groupId: string, field: AdvancedConditionField, rowId?: string) => {
            setConditionGroups((prev) =>
                prev.map((group) =>
                    group.id === groupId
                        ? {
                              ...group,
                              field,
                              values: group.values.map((value) =>
                                  !rowId || value.id === rowId
                                      ? (() => {
                                            const typeChanged =
                                                isDropdownConditionField(value.field) !==
                                                isDropdownConditionField(field);
                                            if (!typeChanged) {
                                                return {
                                                    ...value,
                                                    field,
                                                    method: normalizeConditionMethod(field, value.method),
                                                };
                                            }
                                            return {
                                                ...value,
                                                field,
                                                value: "",
                                                method: isDropdownConditionField(field)
                                                    ? "exact"
                                                    : "contains",
                                            };
                                        })()
                                      : value,
                              ),
                          }
                        : group,
                ),
            );
        },
        [],
    );

    const addConditionValue = useCallback((groupId: string) => {
        setConditionGroups((prev) =>
            prev.map((group) =>
                group.id === groupId
                    ? {
                          ...group,
                          values: [
                              ...group.values,
                              {
                                  id: nextConditionRowId(),
                                  field: group.field,
                                  value: "",
                                  method: isDropdownConditionField(group.field)
                                      ? "exact"
                                      : "contains",
                              },
                          ],
                      }
                    : group,
            ),
        );
    }, []);

    const updateConditionValue = useCallback(
        (groupId: string, index: number, nextValue: Partial<AdvancedConditionValue>) => {
            setConditionGroups((prev) =>
                prev.map((group) => {
                    if (group.id !== groupId) return group;
                    const values = group.values.map((value, i) => {
                        if (i !== index) return value;
                        const merged = { ...value, ...nextValue };
                        return {
                            ...merged,
                            method: normalizeConditionMethod(merged.field, merged.method),
                        };
                    });
                    return { ...group, values };
                }),
            );
        },
        [],
    );

    const removeConditionValue = useCallback((groupId: string, index: number) => {
        setConditionGroups((prev) =>
            prev
                .map((group) => {
                    if (group.id !== groupId) return group;
                    const values = group.values.filter((_, i) => i !== index);
                    return { ...group, values };
                })
                .filter((group) => group.values.length > 0),
        );
    }, []);

    const groupBlockWithPrevious = useCallback((groupIndex: number) => {
        setConditionGroups((prev) => {
            if (groupIndex <= 0 || groupIndex >= prev.length) return prev;
            const current = prev[groupIndex];
            const previous = prev[groupIndex - 1];
            const merged: AdvancedConditionGroup = {
                ...previous,
                values: [...previous.values, ...current.values],
            };
            const next = [
                ...prev.slice(0, groupIndex - 1),
                merged,
                ...prev.slice(groupIndex + 1),
            ];
            return next.map((g, i) => ({
                ...g,
                joinWithPrev: (i === 0 ? "and" : g.joinWithPrev ?? "and"),
            }));
        });
    }, []);

    const ungroupCondition = useCallback((groupIndex: number, rowId: string) => {
        setConditionGroups((prev) => {
            const group = prev[groupIndex];
            if (!group || group.values.length <= 1) return prev;
            const row = group.values.find((v) => v.id === rowId);
            if (!row) return prev;
            const remain = group.values.filter((v) => v.id !== rowId);
            const splitGroup: AdvancedConditionGroup = {
                id: nextConditionGroupId(),
                field: row.field,
                joinWithPrev: "and",
                conditionJoin: "and",
                values: [row],
            };
            const next = [
                ...prev.slice(0, groupIndex),
                { ...group, values: remain },
                splitGroup,
                ...prev.slice(groupIndex + 1),
            ];
            return next.map((g, i) => ({
                ...g,
                joinWithPrev: (i === 0 ? "and" : g.joinWithPrev ?? "and"),
            }));
        });
    }, []);

    const updateConditionTopLevelJoin = useCallback((join: "and" | "or") => {
        setConditionTopLevelJoin(join);
    }, []);

    const updateGroupConditionJoin = useCallback((groupId: string, join: "and" | "or") => {
        setConditionGroups((prev) =>
            prev.map((group) =>
                group.id === groupId ? { ...group, conditionJoin: join } : group,
            ),
        );
    }, []);

    const tags = useMemo(() => {
        const nextTags: SearchTag[] = [];
        if (query) {
            nextTags.push({ key: "query", label: `キーワード: ${query}`, clear: () => setQuery("") });
        }
        const normalizedGroups = normalizeConditionGroups(conditionGroups);
        if (normalizedGroups.length > 0) {
            normalizedGroups.forEach((group) => {
                const valuesText = group.values
                    .map((value) => `${value.value}(${value.method})`)
                    .join(" OR ");
                nextTags.push({
                    key: `cg-${group.id}`,
                    label: `${ADVANCED_CONDITION_FIELD_LABELS[group.field]}: ${valuesText}`,
                    clear: () => removeConditionGroup(group.id),
                });
            });
        } else if (personName) {
            nextTags.push({ key: "personName", label: `歌唱者: ${personName}`, clear: () => setPersonName("") });
        }
        if (searchUnit !== "setlist" && songName) {
            nextTags.push({ key: "songName", label: `楽曲: ${songName}`, clear: () => setSongName("") });
        }
        if (searchUnit !== "setlist" && artistName) {
            nextTags.push({ key: "artistName", label: `アーティスト: ${artistName}`, clear: () => setArtistName("") });
        }
        if (searchUnit !== "setlist" && lyricistName) {
            nextTags.push({
                key: "lyricistName",
                label: `作詞: ${lyricistName}`,
                clear: () => setLyricistName(""),
            });
        }
        if (searchUnit !== "setlist" && composerName) {
            nextTags.push({
                key: "composerName",
                label: `作曲: ${composerName}`,
                clear: () => setComposerName(""),
            });
        }
        if (searchUnit !== "setlist" && arrangerName) {
            nextTags.push({
                key: "arrangerName",
                label: `編曲: ${arrangerName}`,
                clear: () => setArrangerName(""),
            });
        }
        if (searchUnit !== "setlist" && eventName) {
            nextTags.push({ key: "eventName", label: `イベント: ${eventName}`, clear: () => setEventName("") });
        }
        if (searchUnit !== "setlist" && venueName) {
            nextTags.push({ key: "venueName", label: `会場: ${venueName}`, clear: () => setVenueName("") });
        }
        if (eventTag) {
            nextTags.push({ key: "eventTag", label: `タグ: ${eventTag}`, clear: () => setEventTag("") });
        }
        if (searchUnit !== "setlist" && sectionName) {
            nextTags.push({ key: "sectionName", label: `セクション: ${sectionName}`, clear: () => setSectionName("") });
        }
        if (prefectureIds) {
            const names = prefectureIds
                .split(",")
                .map((id) => Number(id.trim()))
                .filter((id) => Number.isFinite(id) && id > 0)
                .map((id) => prefectureOptions.find((option) => option.id === id)?.name ?? `ID:${id}`);
            nextTags.push({
                key: "prefecture",
                label: `都道府県: ${names.length > 0 ? names.join(", ") : prefectureIds}`,
                clear: () => setPrefectureIds(""),
            });
        }
        if (dateFrom || dateTo) {
            nextTags.push({
                key: "date",
                label: `期間: ${formatDateRangeLabel({ dateFrom, dateTo })}`,
                clear: () => {
                    setDateFrom("");
                    setDateTo("");
                },
            });
        }
        return nextTags;
    }, [
        artistName,
        dateFrom,
        dateTo,
        lyricistName,
        composerName,
        conditionGroups,
        arrangerName,
        eventName,
        eventTag,
        personName,
        prefectureIds,
        query,
        removeConditionGroup,
        searchUnit,
        sectionName,
        songName,
        venueName,
        prefectureOptions,
    ]);

    const dbLoadProgressText =
        dbState.status === "loading" &&
        typeof dbState.progressLoadedFiles === "number" &&
        typeof dbState.progressTotalFiles === "number" &&
        dbState.progressTotalFiles > 0
            ? ` (${Math.max(0, dbState.progressLoadedFiles)}/${dbState.progressTotalFiles})`
            : "";
    const statusCoreText =
        dbState.status === "loading"
            ? `読み込み中...${dbLoadProgressText}`
            : dbState.status === "error"
              ? `初期化失敗: ${dbState.error}`
              : runningSearch
                ? "検索中..."
                : `${result.total}件 / ${result.page} / ${result.totalPages}ページ`;
    const statusText = statusCoreText;

    const suggest = useDbSuggestions({
        db,
        searchUnit,
        enabled: dbState.status === "ready",
        variant: suggestVariant,
    });

    return {
        searchMode,
        searchUnit,
        groupByEvent,
        groupByEventSong,
        query,
        normalizedPerformerSelections,
        conditionGroups,
        conditionTopLevelJoin,
        personName,
        songName,
        artistName,
        lyricistName,
        composerName,
        arrangerName,
        eventName,
        venueName,
        eventTag,
        sectionName,
        prefectureIds,
        fieldSearchMethods,
        dateMode,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
        page,
        pageSize,
        pageInput,
        formCollapsed,
        result,
        hasSearched,
        sortOptions,
        tableHeaders,
        tags,
        statusText,
        suggest,
        suggestVariant,
        eventTagOptions,
        prefectureOptions,
        setSearchMode,
        setGroupByEvent,
        setGroupByEventSong,
        setQuery,
        setNormalizedPerformerSelections,
        setConditionGroups,
        setConditionTopLevelJoin,
        updateConditionTopLevelJoin,
        updateGroupConditionJoin,
        addConditionGroup,
        removeConditionGroup,
        updateConditionGroupField,
        groupBlockWithPrevious,
        ungroupCondition,
        addConditionValue,
        updateConditionValue,
        removeConditionValue,
        setPersonName,
        setSongName,
        setArtistName,
        setLyricistName,
        setComposerName,
        setArrangerName,
        setEventName,
        setVenueName,
        setEventTag,
        setSectionName,
        setPrefectureIds,
        setFieldSearchMethods,
        setDateMode,
        setDateFrom,
        setDateTo,
        setSortBy,
        setSortOrder,
        setPage,
        setPageSize,
        setPageInput,
        setFormCollapsed,
        handleSearchUnitChange,
        goToPage,
        handlePageSizeChange,
        resetFilters,
        clearSession,
        setHasSearched,
        setResult,
    };
}

export type UseSearchPageState = ReturnType<typeof useSearchPageState>;

export const MODE_LABELS: Record<SearchUnit, string> = {
    stage: "ライブ検索",
    setlist: "歌唱履歴検索",
};

export function updateFieldSearchMethod(
    setFieldSearchMethods: (updater: (prev: FieldSearchMethods) => FieldSearchMethods) => void,
    field: keyof FieldSearchMethods,
    value: SearchMethod,
) {
    setFieldSearchMethods((prev) => ({
        ...prev,
        [field]: value,
    }));
}
