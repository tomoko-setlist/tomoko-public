import { SearchViewModeToggle } from "./SearchViewModeToggle";
import { TextSizeControl, type TextSizeLevel } from "../ui";

type SortOptionGroup = {
    value: string;
    label: string;
};

type SearchResultsHeaderControlsProps = {
    total: number;
    unitLabel: string;
    stageEventCounts?: {
        eventTotal: number;
        stageTotal: number;
    };
    sortBy: string;
    sortOrder: "asc" | "desc";
    sortOptions: SortOptionGroup[];
    viewMode: "table" | "card";
    onSortByChange: (value: string) => void;
    onSortOrderChange: (value: "asc" | "desc") => void;
    onViewModeChange: (mode: "table" | "card") => void;
    showDesktopSortWhenCard?: boolean;
    showViewModeToggle?: boolean;
    tableDensity?: TextSizeLevel;
    onTableDensityChange?: (density: TextSizeLevel) => void;
};

export function SearchResultsHeaderControls({
    total,
    unitLabel,
    stageEventCounts,
    sortBy,
    sortOrder,
    sortOptions,
    viewMode,
    onSortByChange,
    onSortOrderChange,
    onViewModeChange,
    showDesktopSortWhenCard = true,
    showViewModeToggle = true,
    tableDensity = "standard",
    onTableDensityChange,
}: SearchResultsHeaderControlsProps) {
    const shouldShowDesktopSort = showDesktopSortWhenCard ? viewMode === "card" : true;
    const hasStageEventCounts = Boolean(stageEventCounts);
    const sortSelectClass =
        "h-9 min-w-[8.5rem] rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";
    const sortButtonClass =
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-xs font-black text-slate-700 shadow-sm transition hover:border-red-300 hover:text-red-700";

    return (
        <>
            <div className="mb-3 hidden items-baseline gap-2 md:flex">
                <h3 className="text-sm font-semibold text-slate-900">
                    {hasStageEventCounts && stageEventCounts ? (
                        <>
                            <span className="text-xl font-bold text-red-600">
                                {stageEventCounts.eventTotal.toLocaleString()}
                            </span>{" "}
                            イベント /{" "}
                            <span className="text-xl font-bold text-red-600">
                                {stageEventCounts.stageTotal.toLocaleString()}
                            </span>{" "}
                            ステージ
                        </>
                    ) : (
                        <>
                            <span className="text-xl font-bold text-red-600">
                                {total.toLocaleString()}
                            </span>{" "}
                            件の{unitLabel}
                        </>
                    )}
                </h3>
                <div className="ml-auto flex items-center gap-2">
                    {onTableDensityChange ? (
                        <TextSizeControl
                            value={tableDensity}
                            onChange={onTableDensityChange}
                            targetLabel="一覧の文字"
                        />
                    ) : null}
                    {shouldShowDesktopSort ? (
                        <div className="flex items-center gap-1.5">
                            <select
                                value={sortBy}
                                onChange={(event) => onSortByChange(event.target.value)}
                                className={sortSelectClass}
                                title="ソート項目"
                                aria-label="ソート項目"
                            >
                                {sortOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() =>
                                    onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")
                                }
                                className={sortButtonClass}
                                title="昇順/降順を切り替え"
                                aria-label="昇順/降順を切り替え"
                            >
                                {sortOrder === "asc" ? "▲" : "▼"}
                            </button>
                        </div>
                    ) : null}
                    {showViewModeToggle ? (
                        <SearchViewModeToggle
                            viewMode={viewMode}
                            onChange={onViewModeChange}
                            className="inline-flex items-center gap-1 rounded-none bg-white p-1"
                        />
                    ) : null}
                </div>
            </div>

            <div className="mb-3 md:hidden">
                <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                        {hasStageEventCounts && stageEventCounts ? (
                            <>
                                <span className="text-lg font-bold text-red-600">
                                    {stageEventCounts.eventTotal.toLocaleString()}
                                </span>{" "}
                                イベント /{" "}
                                <span className="text-lg font-bold text-red-600">
                                    {stageEventCounts.stageTotal.toLocaleString()}
                                </span>{" "}
                                ステージ
                            </>
                        ) : (
                            <>
                                <span className="text-lg font-bold text-red-600">
                                    {total.toLocaleString()}
                                </span>{" "}
                                件の{unitLabel}
                            </>
                        )}
                    </h3>
                    <div className="flex items-center gap-1.5">
                        {onTableDensityChange ? (
                            <TextSizeControl
                                value={tableDensity}
                                onChange={onTableDensityChange}
                                targetLabel="一覧の文字"
                                className="scale-90"
                            />
                        ) : null}
                        <select
                            value={sortBy}
                            onChange={(event) => onSortByChange(event.target.value)}
                            className="h-8 max-w-[9.5rem] rounded-sm border border-slate-300 bg-white px-2 text-[11px] font-bold text-slate-800 shadow-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                            title="ソート項目"
                            aria-label="ソート項目"
                        >
                            {sortOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() =>
                                onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-slate-300 bg-white text-[11px] font-black text-slate-700 shadow-sm"
                            title="昇順/降順を切り替え"
                            aria-label="昇順/降順を切り替え"
                        >
                            {sortOrder === "asc" ? "▲" : "▼"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
