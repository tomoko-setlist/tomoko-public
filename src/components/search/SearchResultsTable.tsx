import { useLayoutEffect, useRef, useState } from "react";

import { SearchPagination } from "./SearchPagination";
import { SearchResultsHeaderControls } from "./SearchResultsHeaderControls";
import { SearchResultsCards, SearchResultsDesktopTable } from "./SearchResultsViews";

import type {
    SearchResponse,
    SearchUnit,
    SortBy,
    SortOrder,
} from "../../lib/setlistSearchDb/types";

type SearchResultsTableProps = {
    searchUnit: SearchUnit;
    result: SearchResponse;
    hasSearched: boolean;
    statusText: string;
    tableHeaders: Array<{
        label: string;
        sortBy?: SortBy;
    }>;
    sortBy: SortBy;
    sortOrder: SortOrder;
    onSort: (sortBy: SortBy, sortOrder: SortOrder) => void;
    onOpenEvent: (eventId: number) => void;
    onOpenStage: (stageId: number) => void;
    onOpenVenue: (venueId: number) => void;
    onOpenSong: (songId: number) => void;
    onOpenArtist?: (artistId: number) => void;
    getPrefectureNameById?: (id: number | null) => string;
    page: number;
    pageSize: number;
    pageInput: string;
    setPageInput: (value: string) => void;
    onGoToPage: (nextPage: number) => void;
    onPageSizeChange: (nextPageSize: number) => void;
};

export function SearchResultsTable({
    searchUnit,
    result,
    hasSearched,
    statusText,
    tableHeaders,
    sortBy,
    sortOrder,
    onSort,
    onOpenEvent,
    onOpenStage,
    onOpenVenue,
    onOpenSong,
    onOpenArtist,
    getPrefectureNameById,
    page,
    pageSize,
    pageInput,
    setPageInput,
    onGoToPage,
    onPageSizeChange,
}: SearchResultsTableProps) {
    const resultsBodyRef = useRef<HTMLDivElement | null>(null);
    const [lastNonEmptyBodyHeight, setLastNonEmptyBodyHeight] = useState(0);
    const [viewMode, setViewMode] = useState<"table" | "card">(() => {
        try {
            const saved = sessionStorage.getItem("tomoko-results-view");
            if (saved === "table" || saved === "card") {
                return saved;
            }
        } catch {
            // no-op
        }
        return "table";
    });

    const handleViewModeChange = (next: "table" | "card") => {
        if (searchUnit === "stage" && next === "card" && sortBy === "startTime") {
            onSort("event", "asc");
        }
        setViewMode(next);
        try {
            sessionStorage.setItem("tomoko-results-view", next);
        } catch {
            // no-op
        }
    };
    const groupByEvent = searchUnit === "stage";
    const stageCounts =
        searchUnit === "stage"
            ? (() => {
                  const eventRaw = result.eventTotal ?? result.total;
                  const stageRaw = result.stageTotal ?? result.total;
                  return {
                      eventTotal: eventRaw,
                      stageTotal: stageRaw,
                  };
              })()
            : null;

    const searchUnitLabel = searchUnit === "stage" ? "ライブ" : "歌唱履歴";

    useLayoutEffect(() => {
        if (result.rows.length === 0) return;
        const element = resultsBodyRef.current;
        if (!element) return;
        const nextHeight = Math.ceil(element.getBoundingClientRect().height);
        if (nextHeight > 0) {
            setLastNonEmptyBodyHeight((current) =>
                current === nextHeight ? current : nextHeight,
            );
        }
    }, [result.rows.length, searchUnit, viewMode]);

    if (!hasSearched) {
        return (
            <section className="mt-4 rounded-none border-2 border-gray-800 bg-white p-6 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]">
                <p className="text-center text-sm text-slate-500">{statusText}</p>
            </section>
        );
    }

    const handleHeaderSort = (column?: SortBy) => {
        if (!column) return;
        if (sortBy === column) {
            onSort(column, sortOrder === "asc" ? "desc" : "asc");
            return;
        }
        onSort(column, "asc");
    };

    const sortOptionsByUnit: Record<SearchUnit, Array<{ value: SortBy; label: string }>> = {
        stage: [
            { value: "event", label: "イベント名" },
            { value: "date", label: "開催日" },
            { value: "startTime", label: "開演時間" },
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
    const activeSortOptions =
        searchUnit === "stage" && viewMode === "card"
            ? sortOptionsByUnit.stage.filter((option) => option.value !== "startTime")
            : sortOptionsByUnit[searchUnit];

    return (
        <section className="mt-4 rounded-none border-2 border-gray-800 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] md:p-4">
            <SearchResultsHeaderControls
                total={result.total}
                unitLabel={searchUnitLabel}
                stageEventCounts={
                    searchUnit === "stage" && stageCounts
                        ? stageCounts
                        : undefined
                }
                sortBy={sortBy}
                sortOrder={sortOrder}
                sortOptions={activeSortOptions}
                viewMode={viewMode}
                onSortByChange={(nextSortBy) => onSort(nextSortBy as SortBy, sortOrder)}
                onSortOrderChange={(nextSortOrder) => onSort(sortBy, nextSortOrder)}
                onViewModeChange={handleViewModeChange}
                showDesktopSortWhenCard={true}
            />

            <div
                ref={resultsBodyRef}
                style={
                    result.rows.length === 0 && lastNonEmptyBodyHeight > 0
                        ? { minHeight: `${lastNonEmptyBodyHeight}px` }
                        : undefined
                }
            >
                {result.rows.length === 0 ? (
                    <div className="rounded-none border-2 border-gray-800 bg-slate-50 p-6 text-center text-sm text-slate-600">
                        検索結果が見つかりませんでした。条件を変更して再検索してください。
                    </div>
                ) : (
                    <>
                        <SearchResultsDesktopTable
                            searchUnit={searchUnit}
                            result={result}
                            tableHeaders={tableHeaders}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onHeaderSort={handleHeaderSort}
                            onOpenEvent={onOpenEvent}
                            onOpenStage={onOpenStage}
                            onOpenVenue={onOpenVenue}
                            onOpenSong={onOpenSong}
                            onOpenArtist={onOpenArtist}
                            getPrefectureNameById={getPrefectureNameById}
                            visible={viewMode === "table"}
                            groupByEvent={searchUnit === "stage" && groupByEvent}
                        />

                        <SearchResultsCards
                            searchUnit={searchUnit}
                            result={result}
                            onOpenEvent={onOpenEvent}
                            onOpenStage={onOpenStage}
                            onOpenVenue={onOpenVenue}
                            onOpenSong={onOpenSong}
                            onOpenArtist={onOpenArtist}
                            getPrefectureNameById={getPrefectureNameById}
                            visible={viewMode === "card"}
                            groupByEvent={searchUnit === "stage" && groupByEvent}
                        />
                    </>
                )}
            </div>

            <SearchPagination
                page={page}
                totalPages={result.totalPages}
                pageSize={pageSize}
                pageInput={pageInput}
                setPageInput={setPageInput}
                onGoToPage={onGoToPage}
                onPageSizeChange={onPageSizeChange}
                className="mt-4 overflow-x-auto"
            />
        </section>
    );
}
