import { Component, Suspense, useEffect, useMemo } from "react";

import { DetailLoadingState, DetailPanel } from "./DetailUi";
import { InitialDetailSummaryPanel } from "./InitialDetailSummaryPanel";
import { lazyWithRetry } from "./lazyRoute";
import { getInitialDetailDataForRoute } from "../../lib/initialDetailData";
import { privateFeatureRegistry } from "../../lib/privateFeatureRegistry";
import { AboutPage } from "../app/AboutPage";
import { ContactPage } from "../app/ContactPage";

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
    onNavigateArticles: () => void;
    onNavigateArticle: (slug: string) => void;
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
const StatsPocPage = privateFeatureRegistry.stats.Page;
const AdminPage = privateFeatureRegistry.admin.Page;
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
const ArticlesPage = lazyWithRetry(() =>
    import("../articles/ArticlesPage").then((module) => ({
        default: module.ArticlesPage,
    })),
);
const ArticleDetailPage = lazyWithRetry(() =>
    import("../articles/ArticleDetailPage").then((module) => ({
        default: module.ArticleDetailPage,
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
    onNavigateArticles,
    onNavigateArticle,
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
    if (route.name === "contact") {
        return <ContactPage />;
    }

    if (route.name === "articles" || route.name === "article") {
        return (
            <LazyRouteErrorBoundary>
                <Suspense fallback={<DetailLoadingState />}>
                    {route.name === "articles" ? (
                        <ArticlesPage
                            onResolveTitle={onResolveTitle}
                            onOpenArticle={onNavigateArticle}
                        />
                    ) : (
                        <ArticleDetailPage
                            slug={route.slug}
                            onResolveTitle={onResolveTitle}
                        />
                    )}
                </Suspense>
            </LazyRouteErrorBoundary>
        );
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
            ) : route.name === "stats" && StatsPocPage ? (
                <StatsPocPage
                    db={db}
                    onOpenEvent={onNavigateEvent}
                    onOpenStage={onNavigateStage}
                    onOpenVenue={onNavigateVenue}
                    onOpenSong={onNavigateSong}
                    onOpenArtist={onNavigateArtist}
                    onOpenMember={onNavigateMember}
                    onOpenGroup={onNavigateGroup}
                    onOpenCreator={onNavigateCreator}
                />
            ) : route.name === "admin" && AdminPage ? (
                <AdminPage />
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
                    onOpenArticles={onNavigateArticles}
                    onOpenArticle={onNavigateArticle}
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
