import { useEffect } from "react";

import {
    DetailErrorState,
    DetailLoadingState,
    DetailNotFoundState,
    DetailPanel,
    DetailResponsiveTable,
    DetailShareLinkButton,
} from "./DetailUi";
import { useCreatorDetail } from "./hooks/useCreatorDetail";
import { formatDateYmd } from "../../lib/uiFormat";
import { LinkTextButton } from "../ui";

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
                <h2 className="mb-3 text-base font-semibold text-slate-900">
                    {title}
                </h2>
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
