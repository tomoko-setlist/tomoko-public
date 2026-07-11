import { useEffect, useState } from "react";

import { formatDateYmd } from "../../lib/uiFormat";
import { LinkTextButton } from "../ui";
import {
    DetailErrorState,
    DetailLoadingState,
    DetailNotFoundState,
    DetailPanel,
    DetailResponsiveTable,
    DetailShareLinkButton,
} from "./DetailUi";
import { useCreatorDetail } from "./hooks/useCreatorDetail";

import type {
    CreatorSongRow,
    SetlistSearchDb,
} from "../../lib/setlistSearchDb/types";

type CreatorDetailPageProps = {
    db: SetlistSearchDb;
    creatorId: number;
    onResolveTitle?: (title: string) => void;
    onOpenSong: (songId: number) => void;
    onOpenArtist: (artistId: number) => void;
};

export function CreatorDetailPage({
    db,
    creatorId,
    onResolveTitle,
    onOpenSong,
    onOpenArtist,
}: CreatorDetailPageProps) {
    const {
        loading,
        error,
        detail,
        lyricistSongs,
        composerSongs,
        arrangerSongs,
    } = useCreatorDetail(db, creatorId);
    const isMobileList = useDetailMobileViewport();

    useEffect(() => {
        if (detail?.creatorName) {
            onResolveTitle?.(detail.creatorName);
        }
    }, [detail?.creatorName, onResolveTitle]);

    if (loading) return <DetailLoadingState />;
    if (error) return <DetailErrorState message={error} />;
    if (!detail) {
        return (
            <DetailNotFoundState message="クリエイターが見つかりませんでした。" />
        );
    }

    const renderSongTable = (title: string, rows: CreatorSongRow[]) => {
        if (rows.length === 0) return null;
        return (
            <DetailPanel className="p-4">
                <DetailListHeader title={title} count={rows.length} />
                {isMobileList ? (
                    <CreatorSongMobileList
                        rows={rows}
                        onOpenSong={onOpenSong}
                        onOpenArtist={onOpenArtist}
                    />
                ) : (
                    <DetailResponsiveTable
                        rows={rows}
                        rowKey={(row) => row.songId}
                        pageSizeOptions={[10, 20, 50, 100]}
                        initialPageSize={20}
                        columns={[
                            {
                                key: "songName",
                                header: "楽曲名",
                                render: (row) => (
                                    <LinkTextButton
                                        onClick={() => onOpenSong(row.songId)}
                                    >
                                        {row.songName}
                                    </LinkTextButton>
                                ),
                            },
                            {
                                key: "artistName",
                                header: "アーティスト",
                                render: (row) => (
                                    <LinkTextButton
                                        onClick={() => onOpenArtist(row.artistId)}
                                    >
                                        {row.artistName}
                                    </LinkTextButton>
                                ),
                            },
                            {
                                key: "totalPerformances",
                                header: "演奏回数",
                                render: (row) => row.totalPerformances,
                            },
                            {
                                key: "lastPerformedDate",
                                header: "最終歌唱日",
                                render: (row) =>
                                    formatDateYmd(row.lastPerformedDate),
                            },
                        ]}
                    />
                )}
            </DetailPanel>
        );
    };

    return (
        <div className="space-y-4">
            <DetailPanel className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                            CREATOR
                        </p>
                        <h1 className="min-w-0 break-words text-lg font-bold text-slate-900">
                            {detail.creatorName}
                        </h1>
                    </div>
                    <DetailShareLinkButton />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                    作詞 {lyricistSongs.length} 曲 / 作曲 {composerSongs.length}{" "}
                    曲 / 編曲 {arrangerSongs.length} 曲
                </p>
            </DetailPanel>

            {renderSongTable("作詞した作品", lyricistSongs)}
            {renderSongTable("作曲した作品", composerSongs)}
            {renderSongTable("編曲した作品", arrangerSongs)}
        </div>
    );
}

function detectDetailMobileViewport(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 767px)").matches
    );
}

function useDetailMobileViewport(): boolean {
    const [isMobile, setIsMobile] = useState<boolean>(() =>
        detectDetailMobileViewport(),
    );

    useEffect(() => {
        if (
            typeof window === "undefined" ||
            typeof window.matchMedia !== "function"
        ) {
            return;
        }

        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const update = () => setIsMobile(mediaQuery.matches);
        update();

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", update);
            return () => mediaQuery.removeEventListener("change", update);
        }

        mediaQuery.addListener(update);
        return () => mediaQuery.removeListener(update);
    }, []);

    return isMobile;
}

type DetailListHeaderProps = {
    title: string;
    count: number;
};

function DetailListHeader({ title, count }: DetailListHeaderProps) {
    return (
        <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <span className="shrink-0 border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                全{count}件
            </span>
        </div>
    );
}

type CreatorSongMobileListProps = {
    rows: CreatorSongRow[];
    onOpenSong: (songId: number) => void;
    onOpenArtist: (artistId: number) => void;
};

function CreatorSongMobileList({
    rows,
    onOpenSong,
    onOpenArtist,
}: CreatorSongMobileListProps) {
    return (
        <ul className="divide-y divide-slate-200 border-y border-slate-300">
            {rows.map((row) => (
                <li key={row.songId} className="px-1 py-2.5">
                    <div className="min-w-0">
                        <LinkTextButton
                            onClick={() => onOpenSong(row.songId)}
                            className="block min-w-0 truncate text-left text-sm font-semibold leading-5 tracking-tight text-blue-700"
                        >
                            {row.songName}
                        </LinkTextButton>
                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-slate-500">
                            <LinkTextButton
                                onClick={() => onOpenArtist(row.artistId)}
                                className="min-w-0 truncate text-left font-semibold text-blue-700"
                            >
                                {row.artistName}
                            </LinkTextButton>
                            <span className="shrink-0 border-l border-slate-300 pl-1.5">
                                演奏 {row.totalPerformances}
                            </span>
                            <span className="shrink-0">
                                最終 {formatDateYmd(row.lastPerformedDate)}
                            </span>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}
