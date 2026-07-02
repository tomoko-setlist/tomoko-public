import { useState } from "react";

import { normalizePageSize } from "../../lib/constants/searchDefaults";
import { formatDateYmd } from "../../lib/uiFormat";
import { SearchPagination } from "../search/SearchPagination";
import { SearchResultsHeaderControls } from "../search/SearchResultsHeaderControls";
import { SearchSortableHeader } from "../search/SearchSortableHeader";
import { normalizeTextSizeLevel, type TextSizeLevel } from "../ui";

import type { SongSearchResponse } from "../../lib/setlistSearchDb/types";

type SongSortBy =
    | "song"
    | "artist"
    | "lyricist"
    | "composer"
    | "arranger"
    | "releaseDate"
    | "date";

type SongResultViewMode = "table" | "card";

type SongSearchResultsSectionProps = {
    result: SongSearchResponse;
    sortBy: SongSortBy;
    sortOrder: "asc" | "desc";
    viewMode: SongResultViewMode;
    setViewMode: (mode: SongResultViewMode) => void;
    handleSort: (sortBy: SongSortBy, sortOrder: "asc" | "desc") => void;
    handleSortChange: (sortBy: SongSortBy) => void;
    loading: boolean;
    error: string;
    dateRangeError: string;
    onOpenSong: (songId: number) => void;
    onOpenArtist: (artistId: number) => void;
    onOpenAlbum: (albumId: number) => void;
    onOpenCreator?: (creatorId: number) => void;
    page: number;
    pageSize: number;
    pageInput: string;
    setPageInput: (value: string) => void;
    setPage: (value: number) => void;
    setPageSize: (value: number) => void;
    setShowAdvanced: (value: boolean) => void;
};

export function SongSearchResultsSection({
    result,
    sortBy,
    sortOrder,
    viewMode,
    setViewMode,
    handleSort,
    handleSortChange,
    loading,
    error,
    dateRangeError,
    onOpenSong,
    onOpenArtist,
    onOpenAlbum,
    onOpenCreator,
    page,
    pageSize,
    pageInput,
    setPageInput,
    setPage,
    setPageSize,
    setShowAdvanced,
}: SongSearchResultsSectionProps) {
    const [textSize, setTextSize] = useState<TextSizeLevel>(() => {
        try {
            return normalizeTextSizeLevel(
                sessionStorage.getItem("tomoko-song-search-text-size"),
            );
        } catch {
            return "standard";
        }
    });
    const sortOptions: Array<{ value: SongSortBy; label: string }> = [
        { value: "song", label: "楽曲名" },
        { value: "artist", label: "アーティスト" },
        { value: "lyricist", label: "作詞" },
        { value: "composer", label: "作曲" },
        { value: "arranger", label: "編曲" },
        { value: "releaseDate", label: "発売日" },
        { value: "date", label: "最終歌唱日" },
    ];

    const renderAlbumLinks = (row: SongSearchResponse["rows"][number]) => {
        const entries = Array.isArray(row.albumEntries) ? row.albumEntries : [];
        if (entries.length > 0) {
            return entries.map((entry, index) => (
                <span key={`${row.songId}-album-${entry.albumId}-${index}`}>
                    {index > 0 ? " / " : ""}
                    <button
                        type="button"
                        className="text-left text-blue-700 hover:underline"
                        onClick={() => onOpenAlbum(entry.albumId)}
                    >
                        {entry.albumName}
                    </button>
                </span>
            ));
        }
        if (row.albumNames && row.firstAlbumId) {
            return (
                <button
                    type="button"
                    className="text-left text-blue-700 hover:underline"
                    onClick={() => onOpenAlbum(row.firstAlbumId!)}
                >
                    {row.albumNames}
                </button>
            );
        }
        return row.albumNames || "-";
    };

    const renderCreatorValue = (
        name: string | null,
        id: number | null | undefined,
    ) => {
        if (id !== null && id !== undefined && name && onOpenCreator) {
            return (
                <button
                    type="button"
                    className="text-left text-blue-700 hover:underline"
                    onClick={() => onOpenCreator(id)}
                >
                    {name}
                </button>
            );
        }
        return name || "-";
    };
    const handleTextSizeChange = (next: TextSizeLevel) => {
        setTextSize(next);
        try {
            sessionStorage.setItem("tomoko-song-search-text-size", next);
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
    const songTitleClass: Record<TextSizeLevel, string> = {
        tiny: "text-xs",
        compact: "text-sm",
        small: "text-[15px]",
        standard: "text-[17px]",
        large: "text-lg",
        xlarge: "text-xl",
    };
    const artistTextClass: Record<TextSizeLevel, string> = {
        tiny: "text-[10px]",
        compact: "text-[11px]",
        small: "text-xs",
        standard: "text-[12px]",
        large: "text-sm",
        xlarge: "text-base",
    };

    return (
        <section className="rounded-none border-2 border-gray-800 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] md:p-4">
            <SearchResultsHeaderControls
                total={result.total}
                unitLabel="楽曲"
                sortBy={sortBy}
                sortOrder={sortOrder}
                sortOptions={sortOptions}
                viewMode={viewMode}
                onSortByChange={(nextSortBy) =>
                    handleSort(nextSortBy as SongSortBy, sortOrder)
                }
                onSortOrderChange={(nextSortOrder) =>
                    handleSort(sortBy, nextSortOrder)
                }
                onViewModeChange={setViewMode}
                showDesktopSortWhenCard={true}
                tableDensity={textSize}
                onTableDensityChange={handleTextSizeChange}
            />

            {dateRangeError ? (
                <p className="mb-3 text-sm text-red-600">{dateRangeError}</p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            {!error ? (
                <div>
                    <div
                        className={`${
                            viewMode === "table"
                                ? "divide-y divide-slate-300 border-y border-slate-300 md:hidden"
                                : "divide-y divide-slate-300 border-y border-slate-300 md:grid md:grid-cols-2 md:gap-3 md:divide-y-0 md:border-y-0"
                        } ${textSizeClass[textSize]}`}
                    >
                        {result.rows.map((row) => (
                            <article
                                key={row.songId}
                                className="space-y-1.5 rounded-none bg-white px-0 py-2 md:rounded-none md:!border-2 md:!border-gray-800 md:bg-white md:px-4 md:py-3"
                            >
                                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                    <button
                                        type="button"
                                        onClick={() => onOpenSong(row.songId)}
                                        className={`text-left font-bold leading-tight text-blue-700 hover:underline ${songTitleClass[textSize]}`}
                                    >
                                        {row.songName}
                                    </button>
                                    <span className="text-xs text-slate-600">/</span>
                                    <button
                                        type="button"
                                        onClick={() => onOpenArtist(row.artistId)}
                                        className={`text-left font-semibold text-blue-700 hover:underline ${artistTextClass[textSize]}`}
                                    >
                                        {row.artistName}
                                    </button>
                                </div>

                                <div className="space-y-1 leading-4 text-slate-800">
                                    <div className="flex flex-wrap items-start gap-x-3 gap-y-0.5">
                                        <span className="inline-flex items-center gap-1">
                                            <span className="font-semibold text-slate-700">作詞</span>
                                            {renderCreatorValue(row.lyricistName, row.lyricistId)}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="font-semibold text-slate-700">作曲</span>
                                            {renderCreatorValue(row.composerName, row.composerId)}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="font-semibold text-slate-700">編曲</span>
                                            {renderCreatorValue(row.arrangerName, row.arrangerId)}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-start gap-x-4 gap-y-1 border-t border-dashed border-slate-300 bg-slate-50 px-2 py-1">
                                            <span className="whitespace-nowrap">
                                            <span className="mr-1 font-semibold text-slate-700">発売日</span>
                                            {formatDateYmd(row.releaseDate)}
                                        </span>
                                        <span className="whitespace-nowrap">
                                            <span className="mr-1 font-semibold text-slate-700">最終歌唱日</span>
                                            {formatDateYmd(row.lastPerformedDate)}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="mr-1 font-semibold text-slate-700">アルバム</span>
                                            {renderAlbumLinks(row)}
                                        </span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>

                    <div
                        className={`${viewMode === "table" ? "hidden overflow-x-auto md:block" : "hidden"}`}
                    >
                        <table className={`w-full ${textSizeClass[textSize]}`}>
                            <thead className="border-b border-slate-200 bg-red-600 text-xs text-white">
                                <tr>
                                    <SearchSortableHeader
                                        label="楽曲名"
                                        sortable
                                        active={sortBy === "song"}
                                        sortOrder={sortOrder}
                                        onSort={() => handleSortChange("song")}
                                        thClassName="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap"
                                        buttonClassName="inline-flex items-center gap-1"
                                        activeIconClassName="text-white"
                                        inactiveIconClassName="text-white/70"
                                    />
                                    <SearchSortableHeader
                                        label="アーティスト"
                                        sortable
                                        active={sortBy === "artist"}
                                        sortOrder={sortOrder}
                                        onSort={() => handleSortChange("artist")}
                                        thClassName="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap"
                                        buttonClassName="inline-flex items-center gap-1"
                                        activeIconClassName="text-white"
                                        inactiveIconClassName="text-white/70"
                                    />
                                    <SearchSortableHeader
                                        label="作詞"
                                        sortable
                                        active={sortBy === "lyricist"}
                                        sortOrder={sortOrder}
                                        onSort={() => handleSortChange("lyricist")}
                                        thClassName="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap"
                                        buttonClassName="inline-flex items-center gap-1"
                                        activeIconClassName="text-white"
                                        inactiveIconClassName="text-white/70"
                                    />
                                    <SearchSortableHeader
                                        label="作曲"
                                        sortable
                                        active={sortBy === "composer"}
                                        sortOrder={sortOrder}
                                        onSort={() => handleSortChange("composer")}
                                        thClassName="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap"
                                        buttonClassName="inline-flex items-center gap-1"
                                        activeIconClassName="text-white"
                                        inactiveIconClassName="text-white/70"
                                    />
                                    <SearchSortableHeader
                                        label="編曲"
                                        sortable
                                        active={sortBy === "arranger"}
                                        sortOrder={sortOrder}
                                        onSort={() => handleSortChange("arranger")}
                                        thClassName="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap"
                                        buttonClassName="inline-flex items-center gap-1"
                                        activeIconClassName="text-white"
                                        inactiveIconClassName="text-white/70"
                                    />
                                    <th className="px-2 py-2 text-left whitespace-nowrap">アルバム</th>
                                    <SearchSortableHeader
                                        label="発売日"
                                        sortable
                                        active={sortBy === "releaseDate"}
                                        sortOrder={sortOrder}
                                        onSort={() => handleSortChange("releaseDate")}
                                        thClassName="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap"
                                        buttonClassName="inline-flex items-center gap-1"
                                        activeIconClassName="text-white"
                                        inactiveIconClassName="text-white/70"
                                    />
                                    <SearchSortableHeader
                                        label="最終歌唱日"
                                        sortable
                                        active={sortBy === "date"}
                                        sortOrder={sortOrder}
                                        onSort={() => handleSortChange("date")}
                                        thClassName="px-2 py-2 text-left text-xs font-semibold tracking-wider text-white whitespace-nowrap"
                                        buttonClassName="inline-flex items-center gap-1"
                                        activeIconClassName="text-white"
                                        inactiveIconClassName="text-white/70"
                                    />
                                </tr>
                            </thead>
                            <tbody>
                                {result.rows.map((row, index) => (
                                    <tr
                                        key={row.songId}
                                        className={`border-b border-slate-100 ${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100`}
                                    >
                                        <td className="px-2 py-2.5">
                                            <button
                                                type="button"
                                                onClick={() => onOpenSong(row.songId)}
                                                className="text-left text-blue-600 hover:underline"
                                            >
                                                {row.songName}
                                            </button>
                                        </td>
                                        <td className="px-2 py-2.5">
                                            <button
                                                type="button"
                                                onClick={() => onOpenArtist(row.artistId)}
                                                className="text-left text-blue-600 hover:underline"
                                            >
                                                {row.artistName}
                                            </button>
                                        </td>
                                        <td className="px-2 py-2.5">
                                            {row.lyricistId !== null &&
                                            row.lyricistId !== undefined &&
                                            row.lyricistName &&
                                            onOpenCreator ? (
                                                <button
                                                    type="button"
                                                    className="text-left text-blue-700 hover:underline"
                                                    onClick={() => {
                                                        if (
                                                            row.lyricistId === null ||
                                                            row.lyricistId === undefined
                                                        ) {
                                                            return;
                                                        }
                                                        onOpenCreator(row.lyricistId);
                                                    }}
                                                >
                                                    {row.lyricistName}
                                                </button>
                                            ) : (
                                                row.lyricistName || "-"
                                            )}
                                        </td>
                                        <td className="px-2 py-2.5">
                                            {row.composerId !== null &&
                                            row.composerId !== undefined &&
                                            row.composerName &&
                                            onOpenCreator ? (
                                                <button
                                                    type="button"
                                                    className="text-left text-blue-700 hover:underline"
                                                    onClick={() => {
                                                        if (
                                                            row.composerId === null ||
                                                            row.composerId === undefined
                                                        ) {
                                                            return;
                                                        }
                                                        onOpenCreator(row.composerId);
                                                    }}
                                                >
                                                    {row.composerName}
                                                </button>
                                            ) : (
                                                row.composerName || "-"
                                            )}
                                        </td>
                                        <td className="px-2 py-2.5">
                                            {row.arrangerId !== null &&
                                            row.arrangerId !== undefined &&
                                            row.arrangerName &&
                                            onOpenCreator ? (
                                                <button
                                                    type="button"
                                                    className="text-left text-blue-700 hover:underline"
                                                    onClick={() => {
                                                        if (
                                                            row.arrangerId === null ||
                                                            row.arrangerId === undefined
                                                        ) {
                                                            return;
                                                        }
                                                        onOpenCreator(row.arrangerId);
                                                    }}
                                                >
                                                    {row.arrangerName}
                                                </button>
                                            ) : (
                                                row.arrangerName || "-"
                                            )}
                                        </td>
                                        <td className="px-2 py-2.5">
                                            {renderAlbumLinks(row)}
                                        </td>
                                        <td className="px-2 py-2.5">
                                            {formatDateYmd(row.releaseDate)}
                                        </td>
                                        <td className="px-2 py-2.5">
                                            {formatDateYmd(row.lastPerformedDate)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

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
    );
}
