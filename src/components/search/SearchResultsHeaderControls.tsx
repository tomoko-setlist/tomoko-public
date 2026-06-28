import { SearchViewModeToggle } from "./SearchViewModeToggle";

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
}: SearchResultsHeaderControlsProps) {
    const shouldShowDesktopSort = showDesktopSortWhenCard ? viewMode === "card" : true;
    const hasStageEventCounts = Boolean(stageEventCounts);

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
                    {shouldShowDesktopSort ? (
                        <div className="flex items-center gap-1.5">
                            <select
                                value={sortBy}
                                onChange={(event) => onSortByChange(event.target.value)}
                                className="rounded-none border-2 border-gray-800 px-2 py-1 text-xs"
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
                                className="rounded-none border-2 border-gray-800 px-2 py-1 text-xs"
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
                        <select
                            value={sortBy}
                            onChange={(event) => onSortByChange(event.target.value)}
                            className="rounded-none border-2 border-gray-800 px-2 py-1 text-xs"
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
                            className="rounded-none border-2 border-gray-800 px-2 py-1 text-xs"
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
