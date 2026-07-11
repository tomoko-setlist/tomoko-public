import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDbSuggestions } from "../../hooks/useDbSuggestions";
import { useScrollVisibility } from "../../hooks/useScrollVisibility";
import {
    BIRTH_MONTH_OPTIONS,
    formatBirthMonthsLabel,
    parseBirthMonthsCsv,
} from "../../lib/birthMonthSearch";
import {
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    normalizePageSize,
} from "../../lib/constants/searchDefaults";
import { DB_REFRESH_EVENT } from "../../lib/dbRefreshEvent";
import { formatMemberColorNamesLabel } from "../../lib/memberColorFamilies";
import {
    normalizeHexColor,
    pickDisplayMemberColors,
} from "../../lib/memberSearchColors";
import {
    buildMemberSearchUrl,
    loadMemberStateFromStorage,
    loadMemberStateFromUrl,
    parseCsv,
    saveMemberStateToStorage,
} from "../../lib/memberSearchState";
import { getMemberStatusLabel } from "../../lib/memberStatus";
import { recordMemberSearchAnalytics } from "../../lib/searchAnalytics";
import { formatDateYmd } from "../../lib/uiFormat";
import { AutocompleteTextInput } from "../search/AutocompleteTextInput";
import { FloatingEditButton } from "../search/FloatingEditButton";
import { MemberColorMultiSelectDropdown } from "../search/MemberColorSelectDropdown";
import { MultiSelectDropdown } from "../search/MultiSelectDropdown";
import { PrefectureMultiSelectDropdown } from "../search/PrefectureSelectDropdowns";
import {
    SearchConditionSummary,
    type SearchConditionItem,
} from "../search/SearchConditionSummary";
import { SearchDateField } from "../search/SearchDateField";
import { SearchDetailActions } from "../search/SearchDetailActions";
import { SearchPagination } from "../search/SearchPagination";
import { SearchResultsHeaderControls } from "../search/SearchResultsHeaderControls";
import { SearchSortableHeader } from "../search/SearchSortableHeader";
import { ChevronUpIcon, normalizeTextSizeLevel, type TextSizeLevel } from "../ui";

import type {
    MemberSearchRequest,
    MemberSearchRow,
    MemberSearchResponse,
    MasterOption,
    SetlistSearchDb,
} from "../../lib/setlistSearchDb/types";

const EMPTY_RESULT: MemberSearchResponse = {
    rows: [],
    total: 0,
    page: DEFAULT_PAGE,
    limit: DEFAULT_PAGE_SIZE,
    totalPages: DEFAULT_PAGE,
};

type MemberSearchPageProps = {
    db: SetlistSearchDb | null;
    onOpenMember: (personId: number) => void;
    onOpenGroup: (groupId: number) => void;
};

type ViewMode = "table" | "card";
type SortBy = MemberSearchRequest["sortBy"];
type ActiveStatus = NonNullable<MemberSearchRequest["activeStatus"]>;

export function MemberSearchPage({ db, onOpenMember, onOpenGroup }: MemberSearchPageProps) {
    const formRef = useRef<HTMLElement>(null);

    const [term, setTerm] = useState("");
    const [personName, setPersonName] = useState("");
    const [groupName, setGroupName] = useState("");
    const [prefectureIds, setPrefectureIds] = useState("");
    const [birthdayFrom, setBirthdayFrom] = useState("");
    const [birthdayTo, setBirthdayTo] = useState("");
    const [birthMonths, setBirthMonths] = useState("");
    const [activeStatus, setActiveStatus] = useState<ActiveStatus>("all");
    const [generation, setGeneration] = useState("");
    const [roleName, setRoleName] = useState("");
    const [colorName, setColorName] = useState("");
    const [page, setPage] = useState(DEFAULT_PAGE);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [pageInput, setPageInput] = useState(String(DEFAULT_PAGE));
    const [sortBy, setSortBy] = useState<SortBy>("kana");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const [textSize, setTextSize] = useState<TextSizeLevel>(() => {
        try {
            return normalizeTextSizeLevel(
                sessionStorage.getItem("tomoko-member-search-text-size"),
            );
        } catch {
            return "standard";
        }
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<MemberSearchResponse>(EMPTY_RESULT);
    const [prefectureOptions, setPrefectureOptions] = useState<MasterOption[]>([]);
    const [memberColorOptions, setMemberColorOptions] = useState<string[]>([]);
    const [groupNameMap, setGroupNameMap] = useState<Map<string, number>>(new Map());
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const persisted = loadMemberStateFromStorage();
        const fromUrl = loadMemberStateFromUrl();
        const merged = { ...persisted, ...fromUrl };
        if (typeof merged.term === "string") setTerm(merged.term);
        if (typeof merged.personName === "string") setPersonName(merged.personName);
        if (typeof merged.groupName === "string") setGroupName(merged.groupName);
        if (typeof merged.prefectureIds === "string") setPrefectureIds(merged.prefectureIds);
        if (typeof merged.birthdayFrom === "string") setBirthdayFrom(merged.birthdayFrom);
        if (typeof merged.birthdayTo === "string") setBirthdayTo(merged.birthdayTo);
        if (typeof merged.birthMonths === "string") setBirthMonths(merged.birthMonths);
        if (
            merged.activeStatus === "all" ||
            merged.activeStatus === "activeHello" ||
            merged.activeStatus === "trainee" ||
            merged.activeStatus === "helloOg" ||
            merged.activeStatus === "formerTrainee"
        ) {
            setActiveStatus(merged.activeStatus);
        }
        if (typeof merged.generation === "string") setGeneration(merged.generation);
        if (typeof merged.roleName === "string") setRoleName(merged.roleName);
        if (typeof merged.colorName === "string") setColorName(merged.colorName);
        if (typeof merged.page === "number" && merged.page > 0) {
            setPage(Math.floor(merged.page));
            setPageInput(String(Math.floor(merged.page)));
        }
        if (
            typeof merged.pageSize === "number" &&
            Number.isFinite(merged.pageSize)
        ) {
            setPageSize(normalizePageSize(merged.pageSize));
        }
        if (
            merged.sortBy === "joinedAt" ||
            merged.sortBy === "name" ||
            merged.sortBy === "kana"
        ) {
            setSortBy(merged.sortBy);
        }
        if (merged.sortOrder === "asc" || merged.sortOrder === "desc") {
            setSortOrder(merged.sortOrder);
        }
        if (typeof merged.showAdvanced === "boolean") {
            setShowAdvanced(merged.showAdvanced);
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated || typeof window === "undefined") return;
        const payload = {
            term,
            personName,
            groupName,
            prefectureIds,
            birthdayFrom,
            birthdayTo,
            birthMonths,
            activeStatus,
            generation,
            roleName,
            colorName,
            page,
            pageSize,
            sortBy,
            sortOrder,
            showAdvanced,
        };
        saveMemberStateToStorage(payload);
    }, [
        hydrated,
        term,
        personName,
        groupName,
        prefectureIds,
        birthdayFrom,
        birthdayTo,
        birthMonths,
        activeStatus,
        generation,
        roleName,
        colorName,
        page,
        pageSize,
        sortBy,
        sortOrder,
        showAdvanced,
    ]);

    useEffect(() => {
        if (!hydrated || typeof window === "undefined") return;
        const nextUrl = buildMemberSearchUrl({
            term,
            personName,
            groupName,
            prefectureIds,
            birthdayFrom,
            birthdayTo,
            birthMonths,
            activeStatus,
            generation,
            roleName,
            colorName,
            page,
            pageSize,
            sortBy,
            sortOrder,
            showAdvanced,
        });
        window.history.replaceState(null, "", nextUrl);
    }, [
        hydrated,
        term,
        personName,
        groupName,
        prefectureIds,
        birthdayFrom,
        birthdayTo,
        birthMonths,
        activeStatus,
        generation,
        roleName,
        colorName,
        page,
        pageSize,
        sortBy,
        sortOrder,
        showAdvanced,
    ]);

    const fetchSuggestions = useDbSuggestions({
        db,
        searchUnit: "setlist",
        blocked: loading,
    });

    const request = useMemo<MemberSearchRequest>(
        () => ({
            term,
            personName,
            groupName,
            prefectureIds,
            prefectureName: "",
            birthdayFrom,
            birthdayTo,
            birthMonths,
            activeStatus,
            generation,
            roleName,
            colorName,
            page,
            limit: pageSize,
            sortBy,
            sortOrder,
        }),
        [
            term,
            personName,
            groupName,
            prefectureIds,
            birthdayFrom,
            birthdayTo,
            birthMonths,
            activeStatus,
            generation,
            roleName,
            colorName,
            page,
            pageSize,
            sortBy,
            sortOrder,
        ],
    );

    useEffect(() => {
        if (!db) return;
        let cancelled = false;
        const run = async () => {
            try {
                const options = await db.listPrefectures();
                if (!cancelled) setPrefectureOptions(options);
            } catch {
                if (!cancelled) setPrefectureOptions([]);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db]);

    useEffect(() => {
        if (!db || typeof db.listMemberColorNames !== "function") return;
        let cancelled = false;
        const run = async () => {
            try {
                const options = await db.listMemberColorNames();
                if (!cancelled) setMemberColorOptions(options);
            } catch {
                if (!cancelled) setMemberColorOptions([]);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db]);

    useEffect(() => {
        if (!db || typeof db.listGroups !== "function") return;
        let cancelled = false;
        const run = async () => {
            try {
                const options = await db.listGroups?.();
                if (cancelled || !options) return;
                const map = new Map<string, number>();
                for (const option of options) {
                    const key = option.name.trim();
                    if (!key || map.has(key)) continue;
                    map.set(key, option.id);
                }
                setGroupNameMap(map);
            } catch {
                if (!cancelled) setGroupNameMap(new Map());
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db]);

    useEffect(() => {
        if (!db || !hydrated) return;
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError("");
            try {
                const next = await db.searchMembers(request);
                if (!cancelled) {
                    setResult(next);
                    setPageInput(String(next.page));
                    recordMemberSearchAnalytics(request, next);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                    setResult(EMPTY_RESULT);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void run();

        return () => {
            cancelled = true;
        };
    }, [db, hydrated, request]);

    const resetPage = () => {
        setPage(DEFAULT_PAGE);
        setPageInput(String(DEFAULT_PAGE));
    };

    const clearAll = useCallback(() => {
        setTerm("");
        setPersonName("");
        setGroupName("");
        setPrefectureIds("");
        setBirthdayFrom("");
        setBirthdayTo("");
        setBirthMonths("");
        setActiveStatus("all");
        setGeneration("");
        setRoleName("");
        setColorName("");
        setPage(DEFAULT_PAGE);
        setPageInput(String(DEFAULT_PAGE));
        setPageSize(25);
        setSortBy("kana");
        setSortOrder("asc");
        setShowAdvanced(false);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleDbRefresh = () => {
            clearAll();
        };
        window.addEventListener(DB_REFRESH_EVENT, handleDbRefresh);
        return () => {
            window.removeEventListener(DB_REFRESH_EVENT, handleDbRefresh);
        };
    }, [clearAll]);

    const handleSort = (nextSortBy: SortBy, nextSortOrder: "asc" | "desc") => {
        setSortBy(nextSortBy);
        setSortOrder(nextSortOrder);
        resetPage();
    };

    const handleHeaderSort = (nextSortBy: SortBy) => {
        if (sortBy === nextSortBy) {
            handleSort(nextSortBy, sortOrder === "asc" ? "desc" : "asc");
            return;
        }
        handleSort(nextSortBy, "asc");
    };

    const selectedPrefectureLabels = useMemo(() => {
        const idSet = new Set(parseCsv(prefectureIds));
        if (idSet.size === 0) return [];
        return prefectureOptions
            .filter((option) => idSet.has(String(option.id)))
            .map((option) => option.name);
    }, [prefectureIds, prefectureOptions]);
    const activeStatusLabel = useMemo(() => {
        if (activeStatus === "activeHello") return "現役ハロメン";
        if (activeStatus === "trainee") return "研修生";
        if (activeStatus === "helloOg") return "ハロプロOG";
        if (activeStatus === "formerTrainee") return "元研";
        return null;
    }, [activeStatus]);
    const activeConditionItems = useMemo<SearchConditionItem[]>(
        () =>
            [
                term
                    ? {
                          key: "term",
                          label: `キーワード: ${term}`,
                          onClear: () => {
                              setTerm("");
                              resetPage();
                          },
                      }
                    : null,
                personName
                    ? {
                          key: "personName",
                          label: `メンバー名: ${personName}`,
                          onClear: () => {
                              setPersonName("");
                              resetPage();
                          },
                      }
                    : null,
                groupName
                    ? {
                          key: "groupName",
                          label: `グループ名: ${groupName}`,
                          onClear: () => {
                              setGroupName("");
                              resetPage();
                          },
                      }
                    : null,
                selectedPrefectureLabels.length > 0
                    ? {
                          key: "prefectureIds",
                          label: `都道府県: ${selectedPrefectureLabels.join(", ")}`,
                          onClear: () => {
                              setPrefectureIds("");
                              resetPage();
                          },
                      }
                    : null,
                activeStatusLabel
                    ? {
                          key: "activeStatus",
                          label: `所属状態: ${activeStatusLabel}`,
                          onClear: () => {
                              setActiveStatus("all");
                              resetPage();
                          },
                      }
                    : null,
                birthdayFrom
                    ? {
                          key: "birthdayFrom",
                          label: `誕生日From: ${formatDateYmd(birthdayFrom)}`,
                          onClear: () => {
                              setBirthdayFrom("");
                              resetPage();
                          },
                      }
                    : null,
                birthdayTo
                    ? {
                          key: "birthdayTo",
                          label: `誕生日To: ${formatDateYmd(birthdayTo)}`,
                          onClear: () => {
                              setBirthdayTo("");
                              resetPage();
                          },
                      }
                    : null,
                birthMonths
                    ? {
                          key: "birthMonths",
                          label: `誕生月: ${formatBirthMonthsLabel(birthMonths)}`,
                          onClear: () => {
                              setBirthMonths("");
                              resetPage();
                          },
                      }
                    : null,
                generation
                    ? {
                          key: "generation",
                          label: `加入期: ${generation}`,
                          onClear: () => {
                              setGeneration("");
                              resetPage();
                          },
                      }
                    : null,
                roleName
                    ? {
                          key: "roleName",
                          label: `役職: ${roleName}`,
                          onClear: () => {
                              setRoleName("");
                              resetPage();
                          },
                      }
                    : null,
                colorName
                    ? {
                          key: "colorName",
                          label: `メンバーカラー: ${formatMemberColorNamesLabel(colorName)}`,
                          onClear: () => {
                              setColorName("");
                              resetPage();
                          },
                      }
                    : null,
            ].filter((item): item is SearchConditionItem => item !== null),
        [
            activeStatusLabel,
            birthMonths,
            birthdayFrom,
            birthdayTo,
            colorName,
            generation,
            groupName,
            personName,
            roleName,
            selectedPrefectureLabels,
            term,
        ],
    );
    const sortOptions: Array<{ value: SortBy; label: string }> = [
        { value: "joinedAt", label: "誕生日" },
        { value: "name", label: "名前" },
        { value: "kana", label: "かな" },
    ];
    const handleTextSizeChange = (next: TextSizeLevel) => {
        setTextSize(next);
        try {
            sessionStorage.setItem("tomoko-member-search-text-size", next);
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
    const showEditFloating = useScrollVisibility(
        formRef,
        result.total > 0,
        showAdvanced,
        180,
    );
    const showCloseFloating = showAdvanced && !showEditFloating;
    const canClearConditions =
        term.trim().length > 0 ||
        personName.trim().length > 0 ||
        groupName.trim().length > 0 ||
        prefectureIds.trim().length > 0 ||
        birthdayFrom.trim().length > 0 ||
        birthdayTo.trim().length > 0 ||
        birthMonths.trim().length > 0 ||
        activeStatus !== "all" ||
        generation.trim().length > 0 ||
        roleName.trim().length > 0 ||
        colorName.trim().length > 0 ||
        page !== 1 ||
        pageSize !== 25 ||
        sortBy !== "kana" ||
        sortOrder !== "asc" ||
        showAdvanced;

    return (
        <div className="space-y-4">
            <section
                ref={formRef}
                className="rounded-none border-2 border-gray-800 bg-white p-4 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]"
            >
                <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-gray-900">メンバー検索</h2>
                    <SearchDetailActions
                        expanded={showAdvanced}
                        onToggle={() => setShowAdvanced((prev) => !prev)}
                        onClear={clearAll}
                        clearDisabled={!canClearConditions}
                    />
                </div>

                <div className="mt-3">
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">キーワード</span>
                        <AutocompleteTextInput
                            value={term}
                            onChange={(value) => {
                                setTerm(value);
                                resetPage();
                            }}
                            inputClassName="w-full rounded-none border-2 border-gray-800 px-3 py-2 pr-8 text-sm focus:outline-none"
                            onFetchSuggestions={(termValue) =>
                                fetchSuggestions("memberSearchQuery", termValue)
                            }
                            suggestField="memberSearchQuery"
                            suggestEnabled={Boolean(db)}
                            placeholder="メンバー名・グループ名・都道府県"
                        />
                    </label>
                </div>

                {showAdvanced ? (
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <label className="block">
                            <span className="mb-1 block text-xs text-slate-700">メンバー名</span>
                            <AutocompleteTextInput
                                value={personName}
                                onChange={(value) => {
                                    setPersonName(value);
                                    resetPage();
                                }}
                                inputClassName="w-full rounded-none border-2 border-gray-800 px-2 py-1.5 pr-8 text-sm"
                                onFetchSuggestions={(termValue) =>
                                    fetchSuggestions("memberSearchPersonName", termValue)
                                }
                                suggestField="memberSearchPersonName"
                                suggestEnabled={Boolean(db)}
                                placeholder="例: 佐藤"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs text-slate-700">グループ名</span>
                            <AutocompleteTextInput
                                value={groupName}
                                onChange={(value) => {
                                    setGroupName(value);
                                    resetPage();
                                }}
                                inputClassName="w-full rounded-none border-2 border-gray-800 px-2 py-1.5 pr-8 text-sm"
                                onFetchSuggestions={(termValue) =>
                                    fetchSuggestions("memberSearchGroupName", termValue)
                                }
                                suggestField="memberSearchGroupName"
                                suggestEnabled={Boolean(db)}
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs text-slate-700">都道府県</span>
                            <PrefectureMultiSelectDropdown
                                prefectureOptions={prefectureOptions}
                                selectedValues={parseCsv(prefectureIds)}
                                onChange={(values) => {
                                    setPrefectureIds(values.join(","));
                                    resetPage();
                                }}
                                placeholder="都道府県を選択"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs text-slate-700">所属状態</span>
                            <select
                                value={activeStatus}
                                onChange={(event) => {
                                    setActiveStatus(event.target.value as ActiveStatus);
                                    resetPage();
                                }}
                                className="w-full rounded-none border-2 border-gray-800 px-2 py-1.5 text-sm"
                            >
                                <option value="all">すべて</option>
                                <option value="activeHello">現役ハロメン</option>
                                <option value="trainee">研修生</option>
                                <option value="helloOg">ハロプロOG</option>
                                <option value="formerTrainee">元研</option>
                            </select>
                        </label>
                        <SearchDateField
                            label="誕生日 From"
                            value={birthdayFrom}
                            onChange={(value) => {
                                setBirthdayFrom(value);
                                resetPage();
                            }}
                        />
                        <SearchDateField
                            label="誕生日 To"
                            value={birthdayTo}
                            onChange={(value) => {
                                setBirthdayTo(value);
                                resetPage();
                            }}
                        />
                        <label className="block">
                            <span className="mb-1 block text-xs text-slate-700">誕生月（年は問わない）</span>
                            <MultiSelectDropdown
                                options={BIRTH_MONTH_OPTIONS}
                                selectedValues={parseBirthMonthsCsv(birthMonths).map(String)}
                                onChange={(values) => {
                                    setBirthMonths(parseBirthMonthsCsv(values.join(",")).join(","));
                                    resetPage();
                                }}
                                placeholder="月を選択"
                                optionColumns={2}
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs text-slate-700">加入期</span>
                            <AutocompleteTextInput
                                value={generation}
                                onChange={(value) => {
                                    setGeneration(value);
                                    resetPage();
                                }}
                                inputClassName="w-full rounded-none border-2 border-gray-800 px-2 py-1.5 pr-8 text-sm"
                                onFetchSuggestions={(termValue) =>
                                    fetchSuggestions("memberSearchGeneration", termValue)
                                }
                                suggestField="memberSearchGeneration"
                                suggestEnabled={Boolean(db)}
                                placeholder="例: 1期 / ひなーず"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs text-slate-700">役職</span>
                            <AutocompleteTextInput
                                value={roleName}
                                onChange={(value) => {
                                    setRoleName(value);
                                    resetPage();
                                }}
                                inputClassName="w-full rounded-none border-2 border-gray-800 px-2 py-1.5 pr-8 text-sm"
                                onFetchSuggestions={(termValue) =>
                                    fetchSuggestions("memberSearchRoleName", termValue)
                                }
                                suggestField="memberSearchRoleName"
                                suggestEnabled={Boolean(db)}
                                placeholder="例: リーダー"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs text-slate-700">メンバーカラー</span>
                            <MemberColorMultiSelectDropdown
                                colorNames={memberColorOptions}
                                selectedValues={parseCsv(colorName)}
                                onChange={(values) => {
                                    setColorName(values.join(","));
                                    resetPage();
                                }}
                                disabled={!db}
                                placeholder="色を選択（系統一括可）"
                            />
                        </label>
                    </div>
                ) : null}

                <SearchConditionSummary
                    items={activeConditionItems}
                    showCloseButton={false}
                    onClose={() => setShowAdvanced(false)}
                />
            </section>

            <section className="rounded-none border-2 border-gray-800 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] md:p-4">
                <SearchResultsHeaderControls
                    total={loading ? 0 : result.total}
                    unitLabel="メンバー"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    sortOptions={sortOptions}
                    viewMode={viewMode}
                    onSortByChange={(nextSortBy) =>
                        handleSort(nextSortBy as SortBy, sortOrder)
                    }
                    onSortOrderChange={(nextSortOrder) =>
                        handleSort(sortBy, nextSortOrder)
                    }
                    onViewModeChange={(mode) => setViewMode(mode)}
                    showDesktopSortWhenCard={true}
                    tableDensity={textSize}
                    onTableDensityChange={handleTextSizeChange}
                />

                {error ? (
                    <p className="text-sm text-red-600">{error}</p>
                ) : (
                    <>
                        <div
                            className={`${
                                viewMode === "table"
                                    ? "space-y-2.5 md:hidden"
                                    : "space-y-2.5 md:grid md:grid-cols-2 md:gap-3"
                            }`}
                        >
                            {result.rows.map((row) => (
                                <MemberSearchResultCard
                                    key={row.personId}
                                    row={row}
                                    groupNameMap={groupNameMap}
                                    onOpenMember={onOpenMember}
                                    onOpenGroup={onOpenGroup}
                                    textSize={textSize}
                                />
                            ))}
                        </div>

                        <div
                            className={`${
                                viewMode === "table"
                                    ? "hidden overflow-x-auto md:block"
                                    : "hidden"
                            }`}
                        >
                            <table className={`w-full ${textSizeClass[textSize]}`}>
                                <thead className="bg-red-600">
                                    <tr>
                                        <SearchSortableHeader
                                            label="メンバー"
                                            sortable
                                            active={sortBy === "name"}
                                            sortOrder={sortOrder}
                                            onSort={() => handleHeaderSort("name")}
                                            thClassName="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap hover:bg-red-700"
                                            buttonClassName="inline-flex items-center gap-1 whitespace-nowrap"
                                            activeIconClassName="text-white"
                                            inactiveIconClassName="text-white/70"
                                        />
                                        <SearchSortableHeader
                                            label="かな"
                                            sortable
                                            active={sortBy === "kana"}
                                            sortOrder={sortOrder}
                                            onSort={() => handleHeaderSort("kana")}
                                            thClassName="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap hover:bg-red-700"
                                            buttonClassName="inline-flex items-center gap-1 whitespace-nowrap"
                                            activeIconClassName="text-white"
                                            inactiveIconClassName="text-white/70"
                                        />
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap">
                                            出身
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap">
                                            メンバーカラー
                                        </th>
                                        <SearchSortableHeader
                                            label="誕生日"
                                            sortable
                                            active={sortBy === "joinedAt"}
                                            sortOrder={sortOrder}
                                            onSort={() => handleHeaderSort("joinedAt")}
                                            thClassName="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap hover:bg-red-700"
                                            buttonClassName="inline-flex items-center gap-1 whitespace-nowrap"
                                            activeIconClassName="text-white"
                                            inactiveIconClassName="text-white/70"
                                        />
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap">
                                            所属グループ
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap">
                                            ex
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {result.rows.map((row, index) => (
                                        <tr
                                            key={row.personId}
                                            className={`hover:bg-slate-50 ${
                                                index % 2 === 0 ? "bg-white" : "bg-slate-50"
                                            }`}
                                        >
                                            <td className="px-3 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenMember(row.personId)}
                                                    className="text-left text-blue-600 hover:underline"
                                                >
                                                    {row.personName}
                                                </button>
                                            </td>
                                            <td className="px-3 py-3">{row.nameKana || "-"}</td>
                                            <td className="px-3 py-3">{row.prefectureName || "-"}</td>
                                            <td className="px-3 py-3">
                                                <MemberSearchColorDisplay row={row} />
                                            </td>
                                            <td className="px-3 py-3">{formatDateYmd(row.birthday)}</td>
                                            <td className="px-3 py-3">
                                                {renderCategorizedGroupLinks(
                                                    row,
                                                    "active",
                                                    groupNameMap,
                                                    onOpenGroup,
                                                    "text-slate-700",
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                {renderCategorizedGroupLinks(
                                                    row,
                                                    "former",
                                                    groupNameMap,
                                                    onOpenGroup,
                                                    "text-slate-600",
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {!loading && !error && result.rows.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">検索結果がありません。</p>
                ) : null}

                <SearchPagination
                    page={page}
                    totalPages={result.totalPages}
                    pageSize={pageSize}
                    pageInput={pageInput}
                    setPageInput={setPageInput}
                    onGoToPage={(nextPage) => {
                        const clamped = Math.min(Math.max(1, nextPage), result.totalPages);
                        setPage(clamped);
                        setPageInput(String(clamped));
                        setShowAdvanced(false);
                    }}
                    onPageSizeChange={(nextPageSize) => {
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
                        setShowAdvanced(false);
                    }}
                    className="mt-4 overflow-x-auto"
                />
            </section>

            <FloatingEditButton
                targetRef={formRef}
                enabled={result.total > 0}
                isFormExpanded={showAdvanced}
                onClick={() => {
                    setShowAdvanced(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                label="検索条件を編集"
            />
            {showCloseFloating ? (
                <button
                    type="button"
                    onClick={() => setShowAdvanced(false)}
                    className="fixed bottom-5 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-none border-2 border-gray-800 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-[4px_4px_0px_0px_rgba(31,41,55,0.9)] active:translate-x-[-50%] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(31,41,55,0.8)] md:left-[calc(50%+8rem)]"
                    aria-label="結果を表示"
                    title="結果を表示"
                >
                    <ChevronUpIcon className="h-4 w-4 shrink-0" />
                    <span>結果を表示</span>
                </button>
            ) : null}
        </div>
    );
}

type MemberSearchResultCardProps = {
    row: MemberSearchRow;
    groupNameMap: Map<string, number>;
    onOpenMember: (personId: number) => void;
    onOpenGroup: (groupId: number) => void;
    textSize: TextSizeLevel;
};

function MemberSearchResultCard({
    row,
    groupNameMap,
    onOpenMember,
    onOpenGroup,
    textSize,
}: MemberSearchResultCardProps) {
    const hasActiveGroups = hasMemberGroupContent(row, "active");
    const hasFormerGroups = hasMemberGroupContent(row, "former");
    const memberStatusLabel = getMemberStatusLabel(row.memberStatus);
    const titleClass: Record<TextSizeLevel, string> = {
        tiny: "text-xs",
        compact: "text-sm",
        small: "text-[15px]",
        standard: "text-base md:text-sm",
        large: "text-lg md:text-base",
        xlarge: "text-xl md:text-lg",
    };
    const bodyClass: Record<TextSizeLevel, string> = {
        tiny: "text-[10px]",
        compact: "text-[11px]",
        small: "text-xs",
        standard: "text-xs",
        large: "text-sm",
        xlarge: "text-base",
    };

    return (
        <article className="border-2 border-slate-700 bg-white px-3 py-2 shadow-[3px_3px_0_0_#475569] md:!border-slate-300 md:shadow-none">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <button
                    type="button"
                    onClick={() => onOpenMember(row.personId)}
                    className={`inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 text-left font-semibold text-blue-700 hover:underline ${titleClass[textSize]}`}
                >
                    <span>{row.personName}</span>
                    {row.nameKana ? (
                        <span className="text-xs font-normal text-slate-500">（{row.nameKana}）</span>
                    ) : null}
                </button>
                {memberStatusLabel ? (
                    <span className="shrink-0 rounded-sm border border-slate-400 bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-700">
                        {memberStatusLabel}
                    </span>
                ) : null}
            </div>

            <p className={`mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-5 text-slate-600 ${bodyClass[textSize]}`}>
                <span className="inline-flex shrink-0 items-baseline whitespace-nowrap">
                    <span className="font-semibold text-slate-800">{formatDateYmd(row.birthday)}</span> 生
                </span>
                <span className="shrink-0 text-slate-300">·</span>
                <span className="inline-flex shrink-0 items-baseline whitespace-nowrap">
                    <span className="font-semibold text-slate-800">{formatMemberAge(row.birthday)}</span>歳
                </span>
                <span className="shrink-0 text-slate-300">·</span>
                <span className="inline-flex shrink-0 items-baseline whitespace-nowrap">
                    <span className="font-semibold text-slate-800">{row.prefectureName || "-"}</span> 出身
                </span>
                <MemberSearchColorInline row={row} />
            </p>

            {hasActiveGroups ? (
                <div className={`mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 leading-5 text-slate-700 ${bodyClass[textSize]}`}>
                    <span className="shrink-0 whitespace-nowrap font-semibold text-slate-600">所属:</span>
                    <div className="min-w-0 flex-1">
                        {renderCategorizedGroupLinks(
                            row,
                            "active",
                            groupNameMap,
                            onOpenGroup,
                            "text-slate-700",
                        )}
                    </div>
                </div>
            ) : null}

            {hasFormerGroups ? (
                <div className={`mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 leading-5 text-slate-500 ${bodyClass[textSize]}`}>
                    <span className="shrink-0 whitespace-nowrap font-semibold text-slate-500">ex:</span>
                    <div className="min-w-0 flex-1">
                        {renderCategorizedGroupLinks(
                            row,
                            "former",
                            groupNameMap,
                            onOpenGroup,
                            "text-slate-500",
                        )}
                    </div>
                </div>
            ) : null}
        </article>
    );
}

function MemberSearchColorInline({ row }: { row: MemberSearchRow }) {
    const colors = pickDisplayMemberColors(row.memberColors ?? []);
    const fallbackText = row.colorsText?.trim() ?? "";
    if (colors.length === 0 && !fallbackText) return null;

    return (
        <>
            <span className="shrink-0 text-slate-300">·</span>
            <span className="inline-flex shrink-0 flex-wrap items-center gap-x-1 gap-y-0.5 whitespace-nowrap text-slate-700">
                {colors.length > 0 ? (
                    colors.map((color, index) => (
                        <span
                            key={`${color.colorCode}-${index}`}
                            className="inline-flex items-center gap-1"
                        >
                            <span
                                className="inline-block h-3 w-3 shrink-0 border border-slate-500 align-middle"
                                style={{ backgroundColor: normalizeHexColor(color.colorCode) }}
                                title={color.colorCode}
                                aria-hidden="true"
                            />
                            <span>{color.colorName || color.colorCode}</span>
                        </span>
                    ))
                ) : (
                    <span>{fallbackText}</span>
                )}
            </span>
        </>
    );
}

function MemberSearchColorDisplay({
    row,
    className = "",
}: {
    row: MemberSearchRow;
    className?: string;
}) {
    const colors = pickDisplayMemberColors(row.memberColors ?? []);
    const fallbackText = row.colorsText?.trim() ?? "";
    if (colors.length === 0 && !fallbackText) return null;

    return (
        <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700 ${className}`}>
            {colors.length > 0 ? (
                colors.map((color, index) => (
                    <span
                        key={`${color.colorCode}-${index}`}
                        className="inline-flex items-center gap-1"
                    >
                        <span
                            className="h-3.5 w-3.5 shrink-0 border border-slate-500"
                            style={{ backgroundColor: normalizeHexColor(color.colorCode) }}
                            title={color.colorCode}
                            aria-hidden="true"
                        />
                        <span>{color.colorName || color.colorCode}</span>
                    </span>
                ))
            ) : (
                <span>{fallbackText}</span>
            )}
        </p>
    );
}

function formatMemberAge(birthday: string | null | undefined): string {
    const text = (birthday ?? "").trim();
    if (!text) return "-";
    const normalized = text.includes("T") ? text : `${text.slice(0, 10)}T00:00:00`;
    const birth = new Date(normalized);
    if (Number.isNaN(birth.getTime())) return "-";
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    const dayDiff = now.getDate() - birth.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
    return age >= 0 ? String(age) : "-";
}

function hasMemberGroupContent(row: MemberSearchRow, mode: "active" | "former"): boolean {
    const text = mode === "active" ? row.activeGroupsText : row.formerGroupsText;
    if (splitGroupNames(text).length > 0) return true;
    const fields =
        mode === "active"
            ? [
                  row.activeGroupType10Text,
                  row.activeGroupType70Text,
                  row.activeGroupType20Text,
                  row.activeGroupType30Text,
                  row.activeGroupType40Text,
                  row.activeGroupTypeOtherText,
              ]
            : [
                  row.formerGroupType10Text,
                  row.formerGroupType70Text,
                  row.formerGroupType20Text,
                  row.formerGroupType30Text,
                  row.formerGroupType40Text,
                  row.formerGroupTypeOtherText,
              ];
    return fields.some((value) => splitGroupNames(value).length > 0);
}

function splitGroupNames(value: string | null | undefined): string[] {
    const text = (value ?? "").trim();
    if (!text) return [];
    return text
        .split(/\s+\/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function renderCategorizedGroupLinks(
    row: MemberSearchRow,
    mode: "active" | "former",
    groupNameMap: Map<string, number>,
    onOpenGroup: (groupId: number) => void,
    plainClassName: string,
) {
    const bucket: Array<{ label: string; value: string | null | undefined; emphasize?: boolean }> =
        mode === "active"
            ? [
                  { label: "グループ", value: row.activeGroupType10Text, emphasize: true },
                  { label: "研修生", value: row.activeGroupType70Text },
                  { label: "ユニット", value: row.activeGroupType20Text },
                  { label: "SP", value: row.activeGroupType30Text },
                  { label: "シャッフル", value: row.activeGroupType40Text },
                  { label: "その他", value: row.activeGroupTypeOtherText },
              ]
            : [
                  { label: "グループ", value: row.formerGroupType10Text, emphasize: true },
                  { label: "研修生", value: row.formerGroupType70Text },
                  { label: "ユニット", value: row.formerGroupType20Text },
                  { label: "SP", value: row.formerGroupType30Text },
                  { label: "シャッフル", value: row.formerGroupType40Text },
                  { label: "その他", value: row.formerGroupTypeOtherText },
              ];
    const rows = bucket.filter((item) => splitGroupNames(item.value).length > 0);
    if (rows.length === 0) {
        return renderGroupLinks(
            mode === "active" ? row.activeGroupsText : row.formerGroupsText,
            groupNameMap,
            onOpenGroup,
            plainClassName,
        );
    }
    return (
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
            {rows.map((item) => (
                <span
                    key={item.label}
                    className={`inline-flex max-w-full shrink-0 flex-wrap items-baseline gap-x-1 gap-y-0.5 ${
                        item.emphasize
                            ? "rounded-sm border border-slate-400 bg-slate-50 px-1.5 py-0.5 shadow-[1px_1px_0_0_#94a3b8]"
                            : ""
                    }`}
                >
                    {item.emphasize ? null : (
                        <>
                            <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-slate-500">
                                {item.label}:
                            </span>{" "}
                        </>
                    )}
                    {renderGroupLinks(
                        item.value,
                        groupNameMap,
                        onOpenGroup,
                        item.emphasize ? "font-semibold text-slate-900" : plainClassName,
                        item.emphasize
                            ? "font-semibold text-blue-800 hover:underline"
                            : "text-blue-700 hover:underline",
                    )}
                </span>
            ))}
        </span>
    );
}

function renderGroupLinks(
    value: string | null | undefined,
    groupNameMap: Map<string, number>,
    onOpenGroup: (groupId: number) => void,
    plainClassName: string,
    linkClassName = "text-blue-700 hover:underline",
) {
    const names = splitGroupNames(value);
    if (names.length === 0) return <>-</>;
    return (
        <span className="inline-flex max-w-full flex-wrap items-baseline gap-y-0.5">
            {names.map((name, index) => {
                const groupId = groupNameMap.get(name);
                return (
                    <span
                        key={`${name}-${index}`}
                        className="inline-flex shrink-0 items-baseline whitespace-nowrap"
                    >
                        {index > 0 ? <span className="px-0.5 text-slate-400">/</span> : null}
                        {typeof groupId === "number" ? (
                            <button
                                type="button"
                                onClick={() => onOpenGroup(groupId)}
                                className={linkClassName}
                            >
                                {name}
                            </button>
                        ) : (
                            <span className={plainClassName}>{name}</span>
                        )}
                    </span>
                );
            })}
        </span>
    );
}
