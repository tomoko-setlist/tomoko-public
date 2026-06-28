import { Component, Suspense, lazy, useEffect, useMemo, type FC, type LazyExoticComponent } from "react";

import { DetailLoadingState, DetailPanel } from "./DetailUi";
import { InitialDetailSummaryPanel } from "./InitialDetailSummaryPanel";
import { getInitialDetailDataForRoute } from "../../lib/initialDetailData";
import { AboutPage } from "../app/AboutPage";

import type { AppRoute } from "../../lib/appRoute";
import type { SetlistSearchDb } from "../../lib/setlistSearchDb/types";
import type { ErrorInfo, ReactNode } from "react";

type DetailContentProps = {
    route: AppRoute;
    db: SetlistSearchDb | null;
    onResolveTitle: (title: string) => void;
    onNavigateEvent: (id: number) => void;
    onNavigateStage: (id: number) => void;
    onNavigateVenue: (id: number) => void;
    onNavigateSong: (id: number) => void;
    onNavigateArtist: (id: number) => void;
    onNavigateMember: (id: number) => void;
    onNavigateGroup: (id: number) => void;
    onNavigateCreator: (id: number) => void;
    onNavigateAlbum: (id: number) => void;
    onNavigateRelease: (id: number) => void;
};
const LAZY_RETRY_DELAY_MS = 220;

async function retryImport<T>(
    factory: () => Promise<T>,
    retries: number,
): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await factory();
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                await new Promise<void>((resolve) =>
                    window.setTimeout(resolve, LAZY_RETRY_DELAY_MS),
                );
            }
        }
    }
    throw lastError;
}

type PropsOf<C extends FC<never>> = Parameters<C> extends [infer P, ...unknown[]] ? P : object;

const lazyWithRetry = <C extends FC<never>>(
    factory: () => Promise<{ default: C }>,
    retries = 1,
): LazyExoticComponent<FC<PropsOf<C>>> => {
    const f = (): Promise<{ default: C }> => retryImport(factory, retries);
    return lazy(f as unknown as Parameters<typeof lazy>[0]) as unknown as LazyExoticComponent<FC<PropsOf<C>>>;
};

const EventDetailPage = lazyWithRetry(() =>
    import("./EventDetailPage").then((module) => ({
        default: module.EventDetailPage,
    })),
);
const StageDetailPage = lazyWithRetry(() =>
    import("./StageDetailPage").then((module) => ({
        default: module.StageDetailPage,
    })),
);
const VenueDetailPage = lazyWithRetry(() =>
    import("./VenueDetailPage").then((module) => ({
        default: module.VenueDetailPage,
    })),
);
const SongDetailPage = lazyWithRetry(() =>
    import("./SongDetailPage").then((module) => ({
        default: module.SongDetailPage,
    })),
);
const SongSearchPage = lazyWithRetry(() =>
    import("../songSearch/SongSearchPage").then((module) => ({
        default: module.SongSearchPage,
    })),
);
const SongRankingPage = lazyWithRetry(() =>
    import("../songRanking/SongRankingPage").then((module) => ({
        default: module.SongRankingPage,
    })),
);
const MemberSearchPage = lazyWithRetry(() =>
    import("../memberSearch").then((module) => ({
        default: module.MemberSearchPage,
    })),
);
const KrnPage = lazyWithRetry(() =>
    import("../krn").then((module) => ({
        default: module.KrnPage,
    })),
);
const ArtistDetailPage = lazyWithRetry(() =>
    import("./ArtistDetailPage").then((module) => ({
        default: module.ArtistDetailPage,
    })),
);
const AlbumDetailPage = lazyWithRetry(() =>
    import("./AlbumDetailPage").then((module) => ({
        default: module.AlbumDetailPage,
    })),
);
const MemberDetailPage = lazyWithRetry(() =>
    import("./MemberDetailPage").then((module) => ({
        default: module.MemberDetailPage,
    })),
);
const GroupDetailPage = lazyWithRetry(() =>
    import("./GroupDetailPage").then((module) => ({
        default: module.GroupDetailPage,
    })),
);
const CreatorDetailPage = lazyWithRetry(() =>
    import("./CreatorDetailPage").then((module) => ({
        default: module.CreatorDetailPage,
    })),
);
const ReleaseDetailPage = lazyWithRetry(() =>
    import("./ReleaseDetailPage").then((module) => ({
        default: module.ReleaseDetailPage,
    })),
);
const DashboardPage = lazyWithRetry(() =>
    import("./DashboardPage").then((module) => ({
        default: module.DashboardPage,
    })),
);

export function DetailContent({
    route,
    db,
    onResolveTitle,
    onNavigateEvent,
    onNavigateStage,
    onNavigateVenue,
    onNavigateSong,
    onNavigateArtist,
    onNavigateMember,
    onNavigateGroup,
    onNavigateCreator,
    onNavigateAlbum,
    onNavigateRelease,
}: DetailContentProps) {
    const initialDetailData = useMemo(
        () => getInitialDetailDataForRoute(route),
        [route],
    );

    useEffect(() => {
        if (!initialDetailData) return;
        onResolveTitle(initialDetailData.title);
    }, [initialDetailData, onResolveTitle]);

    if (route.name === "about") {
        return <AboutPage />;
    }

    if (!db) {
        if (initialDetailData) {
            return <InitialDetailSummaryPanel data={initialDetailData} />;
        }
        return <DetailPanel className="p-6">DB初期化中...</DetailPanel>;
    }

    return (
        <LazyRouteErrorBoundary>
            <Suspense fallback={<DetailLoadingState />}>
            {route.name === "event" ? (
                <EventDetailPage
                    db={db}
                    eventId={route.id}
                    onResolveTitle={onResolveTitle}
                    onOpenStage={onNavigateStage}
                    onOpenVenue={onNavigateVenue}
                    onOpenMember={onNavigateMember}
                    onOpenGroup={onNavigateGroup}
                />
            ) : route.name === "stage" ? (
                <StageDetailPage
                    db={db}
                    stageId={route.id}
                    onResolveTitle={onResolveTitle}
                    onOpenEvent={onNavigateEvent}
                    onOpenSong={onNavigateSong}
                    onOpenArtist={onNavigateArtist}
                    onOpenMember={onNavigateMember}
                    onOpenGroup={onNavigateGroup}
                />
            ) : route.name === "venue" ? (
                <VenueDetailPage
                    db={db}
                    venueId={route.id}
                    onResolveTitle={onResolveTitle}
                    onOpenEvent={onNavigateEvent}
                    onOpenStage={onNavigateStage}
                />
            ) : route.name === "song" ? (
                <SongDetailPage
                    db={db}
                    songId={route.id}
                    onResolveTitle={onResolveTitle}
                    onOpenEvent={onNavigateEvent}
                    onOpenArtist={onNavigateArtist}
                    onOpenCreator={onNavigateCreator}
                    onOpenAlbum={onNavigateAlbum}
                />
            ) : route.name === "creator" ? (
                <CreatorDetailPage
                    db={db}
                    creatorId={route.id}
                    onResolveTitle={onResolveTitle}
                    onOpenSong={onNavigateSong}
                    onOpenArtist={onNavigateArtist}
                />
            ) : route.name === "song-search" ? (
                <SongSearchPage
                    db={db}
                    onOpenSong={onNavigateSong}
                    onOpenArtist={onNavigateArtist}
                    onOpenAlbum={onNavigateAlbum}
                    onOpenCreator={onNavigateCreator}
                />
            ) : route.name === "song-ranking" ? (
                <SongRankingPage
                    db={db}
                    onOpenSong={onNavigateSong}
                    onOpenArtist={onNavigateArtist}
                />
            ) : route.name === "member-search" ? (
                <MemberSearchPage
                    db={db}
                    onOpenMember={onNavigateMember}
                    onOpenGroup={onNavigateGroup}
                />
            ) : route.name === "releases" ? (
                <DashboardPage
                    db={db}
                    onResolveTitle={onResolveTitle}
                    onOpenRelease={onNavigateRelease}
                />
            ) : route.name === "krn" ? (
                <KrnPage db={db} />
            ) : route.name === "release" ? (
                <ReleaseDetailPage
                    db={db}
                    releaseId={route.id}
                    onResolveTitle={onResolveTitle}
                />
            ) : route.name === "artist" ? (
                <ArtistDetailPage
                    db={db}
                    artistId={route.id}
                    onResolveTitle={onResolveTitle}
                    onOpenSong={onNavigateSong}
                    onOpenAlbum={onNavigateAlbum}
                    onOpenMember={onNavigateMember}
                    onOpenGroup={onNavigateGroup}
                />
            ) : route.name === "album" ? (
                <AlbumDetailPage
                    db={db}
                    albumId={route.id}
                    onResolveTitle={onResolveTitle}
                    onOpenSong={onNavigateSong}
                    onOpenArtist={onNavigateArtist}
                />
            ) : route.name === "member" ? (
                <MemberDetailPage
                    db={db}
                    personId={route.id}
                    onResolveTitle={onResolveTitle}
                    onOpenGroup={onNavigateGroup}
                    onOpenArtist={onNavigateArtist}
                    onOpenEvent={onNavigateEvent}
                />
            ) : route.name === "group" ? (
                <GroupDetailPage
                    db={db}
                    groupId={route.id}
                    onResolveTitle={onResolveTitle}
                    onOpenMember={onNavigateMember}
                    onOpenArtist={onNavigateArtist}
                    onOpenAlbum={onNavigateAlbum}
                    onOpenEvent={onNavigateEvent}
                />
            ) : null}
            </Suspense>
        </LazyRouteErrorBoundary>
    );
}

type LazyRouteErrorBoundaryState = {
    error: Error | null;
};

class LazyRouteErrorBoundary extends Component<
    { children: ReactNode },
    LazyRouteErrorBoundaryState
> {
    state: LazyRouteErrorBoundaryState = {
        error: null,
    };

    static getDerivedStateFromError(error: Error): LazyRouteErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        if (typeof console !== "undefined" && typeof console.error === "function") {
            console.error("[DetailContent] lazy route load failed", error, info);
        }
    }

    private handleRetry = () => {
        this.setState({ error: null });
        if (typeof window !== "undefined") {
            window.location.reload();
        }
    };

    render() {
        if (!this.state.error) {
            return this.props.children;
        }

        return (
            <DetailPanel className="p-6">
                <p className="text-sm font-semibold text-slate-900">
                    画面の読み込みに失敗しました。
                </p>
                <p className="mt-2 text-xs text-slate-600">
                    通信状態を確認して再試行してください。
                </p>
                <button
                    type="button"
                    onClick={this.handleRetry}
                    className="mt-3 inline-flex rounded-none border-2 border-gray-800 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-100"
                >
                    再試行
                </button>
            </DetailPanel>
        );
    }
}
