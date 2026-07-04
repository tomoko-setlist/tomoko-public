import { useEffect, useMemo, useState } from "react";

import { DetailRouteContent, InitialSyncOverlay } from "./components/app";
import {
    SearchDesktopHeader,
    SearchMobileNav,
    SearchSidebar,
} from "./components/search";
import { SetlistSearchPage } from "./components/setlistSearch";
import { ExternalLinkIcon, GithubIcon, TwitterIcon } from "./components/ui";
import { useAnnouncementState } from "./hooks/useAnnouncementState";
import { useAppRoute } from "./hooks/useAppRoute";
import { usePageMeta } from "./hooks/usePageMeta";
import { isDbDetailUsable, isDbStatusUsable, useSetlistSearchDb } from "./hooks/useSetlistSearchDb";
import { STORAGE_FLAG_ON } from "./lib/constants/stateFlags";
import { privateFeatureRegistry } from "./lib/privateFeatureRegistry";
import {
    buildBreadcrumbRoutes,
    getLatestSearchRoute,
    routeLabel,
    type BreadcrumbRoute,
} from "./lib/routeNavigation";

import type { AppRoute } from "./lib/appRoute";

const INITIAL_OVERLAY_SEEN_KEY = "tomoko-duc-initial-overlay-seen-v1";
const GITHUB_URL = "https://github.com/tomoko-setlist/tomoko-public";
const TWITTER_URL = "https://x.com/hello_setlistDB";
let hasSeenInitialOverlayRuntime: boolean | null = null;

const readInitialOverlaySeen = (): boolean => {
    if (hasSeenInitialOverlayRuntime !== null) {
        return hasSeenInitialOverlayRuntime;
    }
    if (typeof window === "undefined") {
        hasSeenInitialOverlayRuntime = false;
        return false;
    }
    try {
        hasSeenInitialOverlayRuntime =
            window.localStorage.getItem(INITIAL_OVERLAY_SEEN_KEY) === STORAGE_FLAG_ON;
        return hasSeenInitialOverlayRuntime;
    } catch {
        hasSeenInitialOverlayRuntime = false;
        return false;
    }
};

function App() {
    const adminEnabled = privateFeatureRegistry.admin.isEnabled();
    const statsEnabled = privateFeatureRegistry.stats.isEnabled();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [routeTitles, setRouteTitles] = useState<Record<string, string>>({});
    const hasSeenInitialOverlay = readInitialOverlaySeen();
    const { route, history, navigate, navigateToHistoryRoute } = useAppRoute();
    const isAdminRoute = route.name === "admin";
    const isStatsRoute = route.name === "stats";
    const isArticleRoute = route.name === "articles" || route.name === "article";
    const { db, dbState, refreshDb } = useSetlistSearchDb({
        enabled: !isArticleRoute,
    });
    const effectiveRoute: AppRoute = useMemo(
        () =>
            (!adminEnabled && isAdminRoute) || (!statsEnabled && isStatsRoute)
                ? { name: "home" }
                : route,
        [adminEnabled, isAdminRoute, isStatsRoute, route, statsEnabled],
    );
    const effectiveIsAdmin = adminEnabled && isAdminRoute;
    const isKrnStandalone = effectiveRoute.name === "krn";
    const showInitialLoading =
        dbState.status === "loading" &&
        db === null &&
        !hasSeenInitialOverlay;
    const { announcementUnreadCount } = useAnnouncementState({
        db,
        route: effectiveRoute,
    });
    usePageMeta({ route: effectiveRoute, routeTitles });
    const headerTitle = routeLabel(effectiveRoute, routeTitles);
    const headerBreadcrumbs = buildBreadcrumbRoutes(history, effectiveRoute);
    const navActions = {
        onOpenHome: () => navigate({ name: "home" }),
        onOpenSongSearch: () => navigate({ name: "song-search" }),
        onOpenSongRanking: () => navigate({ name: "song-ranking" }),
        onOpenMemberSearch: () => navigate({ name: "member-search" }),
        onOpenKrn: () => navigate({ name: "krn" }),
        onOpenArticles: () => navigate({ name: "articles" }),
        onOpenAbout: () => navigate({ name: "about" }),
        onOpenContact: () => navigate({ name: "contact" }),
        onOpenReleases: () => navigate({ name: "releases" }),
        onOpenAdmin: () => navigate({ name: "admin" }),
        onOpenStats: () => navigate({ name: "stats" }),
        onRefreshDb: () => {
            void refreshDb();
        },
    };
    const handleNavigateBreadcrumb = (item: BreadcrumbRoute) => {
        const latestSearchRoute = getLatestSearchRoute(history);
        if (item.current) return;
        if (item.fromHistory) {
            navigateToHistoryRoute(item.route, { name: latestSearchRoute.name });
            return;
        }
        navigate(item.route);
    };

    useEffect(() => {
        if (!adminEnabled && isAdminRoute) {
            navigate({ name: "home" });
        }
    }, [adminEnabled, isAdminRoute, navigate]);

    useEffect(() => {
        if (!statsEnabled && isStatsRoute) {
            navigate({ name: "home" });
        }
    }, [isStatsRoute, navigate, statsEnabled]);


    useEffect(() => {
        if (!isDbStatusUsable(dbState.status) || hasSeenInitialOverlayRuntime) {
            return;
        }
        hasSeenInitialOverlayRuntime = true;
        if (typeof window === "undefined") {
            return;
        }
        try {
            window.localStorage.setItem(INITIAL_OVERLAY_SEEN_KEY, STORAGE_FLAG_ON);
        } catch {
            // ignore storage errors
        }
    }, [dbState.status]);

    return (
        <div className={isKrnStandalone ? "min-h-screen bg-violet-50" : "min-h-screen bg-slate-100 pt-12"}>
            {!isKrnStandalone ? (
                <>
                    <SearchMobileNav
                        open={mobileMenuOpen}
                        isSongSearch={effectiveRoute.name === "song-search"}
                        isSongRanking={effectiveRoute.name === "song-ranking"}
                        isMemberSearch={effectiveRoute.name === "member-search"}
                        isKrn={false}
                        isAbout={effectiveRoute.name === "about"}
                        isArticles={effectiveRoute.name === "articles" || effectiveRoute.name === "article"}
                        isContact={effectiveRoute.name === "contact"}
                        isReleases={effectiveRoute.name === "releases"}
                        isAdmin={effectiveIsAdmin}
                        isStats={effectiveRoute.name === "stats"}
                        announcementUnreadCount={announcementUnreadCount}
                        showAdmin={adminEnabled}
                        showStats={statsEnabled}
                        dbStatus={dbState.status}
                        onOpen={() => setMobileMenuOpen(true)}
                        onClose={() => setMobileMenuOpen(false)}
                        {...navActions}
                    />
                    <SearchDesktopHeader
                        onOpenHome={navActions.onOpenHome}
                        title={headerTitle}
                        breadcrumbs={headerBreadcrumbs}
                        routeTitles={routeTitles}
                        onNavigateBreadcrumb={handleNavigateBreadcrumb}
                    />

                    <SearchSidebar
                        isSongSearch={effectiveRoute.name === "song-search"}
                        isSongRanking={effectiveRoute.name === "song-ranking"}
                        isMemberSearch={effectiveRoute.name === "member-search"}
                        isKrn={false}
                        isAbout={effectiveRoute.name === "about"}
                        isArticles={effectiveRoute.name === "articles" || effectiveRoute.name === "article"}
                        isContact={effectiveRoute.name === "contact"}
                        isReleases={effectiveRoute.name === "releases"}
                        isAdmin={effectiveIsAdmin}
                        isStats={effectiveRoute.name === "stats"}
                        announcementUnreadCount={announcementUnreadCount}
                        showAdmin={adminEnabled}
                        showStats={statsEnabled}
                        dbStatus={dbState.status}
                        {...navActions}
                    />
                </>
            ) : null}

            <main
                className={
                    isKrnStandalone
                        ? "p-2 md:p-4"
                        : "px-4 pb-4 pt-2 md:ml-16 md:px-6 md:pb-6 md:pt-3 2xl:ml-[220px]"
                }
            >
                <div
                    className={
                        isKrnStandalone
                            ? "mx-auto max-w-[1280px]"
                            : "w-full max-w-none"
                    }
                >
                    {effectiveRoute.name === "home" ? (
                        <SetlistSearchPage
                            db={db}
                            dbState={dbState}
                            navigate={navigate}
                        />
                    ) : (
                        <DetailRouteContent
                            route={effectiveRoute}
                            history={history}
                            routeTitles={routeTitles}
                            setRouteTitles={setRouteTitles}
                            db={isDbDetailUsable(dbState.status) ? db : null}
                            navigate={navigate}
                            navigateToHistoryRoute={navigateToHistoryRoute}
                        />
                    )}
                </div>
            </main>
            {effectiveRoute.name === "contact" ||
            effectiveRoute.name === "articles" ||
            effectiveRoute.name === "article" ||
            effectiveRoute.name === "about" ||
            effectiveRoute.name === "releases" ? (
                <AppFooter />
            ) : null}
            <InitialSyncOverlay
                show={showInitialLoading}
                progressTotal={dbState.progressTotalFiles ?? 0}
                progressLoaded={dbState.progressLoadedFiles ?? 0}
                progressFileName={dbState.progressFileName ?? ""}
                progressTotalBytes={dbState.progressTotalBytes}
                progressLoadedBytes={dbState.progressLoadedBytes}
            />
        </div>
    );
}

function AppFooter() {
    return (
        <footer className="px-4 pb-4 md:ml-16 md:px-6 md:pb-6 2xl:ml-[220px]">
            <div className="grid gap-3 text-xs text-slate-600 md:grid-cols-2">
                <section className="border-2 border-gray-800 bg-white px-3 py-3 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]">
                    <a
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-w-0 items-start gap-2 text-slate-700 hover:text-slate-900"
                    >
                        <GithubIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0">
                            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-blue-700 group-hover:underline">
                                <span className="truncate">tomoko-setlist/tomoko-public</span>
                                <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                                リポジトリ・開発状況
                            </span>
                        </span>
                    </a>
                </section>
                <section className="border-2 border-gray-800 bg-white px-3 py-3 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]">
                    <a
                        href={TWITTER_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-w-0 items-start gap-2 text-slate-700 hover:text-slate-900"
                    >
                        <TwitterIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0">
                            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-blue-700 group-hover:underline">
                                <span className="truncate">Twitter @hello_setlistDB</span>
                                <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                                更新情報・お知らせ
                            </span>
                        </span>
                    </a>
                </section>
            </div>
        </footer>
    );
}

export default App;
