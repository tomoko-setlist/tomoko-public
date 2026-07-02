import { useEffect, useState } from "react";

import { DetailRouteContent, InitialSyncOverlay } from "./components/app";
import {
    SearchDesktopHeader,
    SearchMobileNav,
    SearchSidebar,
} from "./components/search";
import { SetlistSearchPage } from "./components/setlistSearch";
import { useAnnouncementState } from "./hooks/useAnnouncementState";
import { useAppRoute } from "./hooks/useAppRoute";
import { usePageMeta } from "./hooks/usePageMeta";
import { isDbDetailUsable, isDbStatusUsable, useSetlistSearchDb } from "./hooks/useSetlistSearchDb";
import { STORAGE_FLAG_ON } from "./lib/constants/stateFlags";
import {
    buildBreadcrumbRoutes,
    getLatestSearchRoute,
    routeLabel,
    type BreadcrumbRoute,
} from "./lib/routeNavigation";

const INITIAL_OVERLAY_SEEN_KEY = "tomoko-duc-initial-overlay-seen-v1";
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [routeTitles, setRouteTitles] = useState<Record<string, string>>({});
    const hasSeenInitialOverlay = readInitialOverlaySeen();
    const { route, history, navigate, navigateToHistoryRoute } = useAppRoute();
    const isArticleRoute = route.name === "articles" || route.name === "article";
    const { db, dbState, refreshDb } = useSetlistSearchDb({
        enabled: !isArticleRoute,
    });
    const isKrnStandalone = route.name === "krn";
    const showInitialLoading =
        dbState.status === "loading" &&
        db === null &&
        !hasSeenInitialOverlay;
    const { announcementUnreadCount } = useAnnouncementState({
        db,
        route,
    });
    usePageMeta({ route, routeTitles });
    const headerTitle = routeLabel(route, routeTitles);
    const headerBreadcrumbs = buildBreadcrumbRoutes(history, route);
    const navActions = {
        onOpenHome: () => navigate({ name: "home" }),
        onOpenSongSearch: () => navigate({ name: "song-search" }),
        onOpenSongRanking: () => navigate({ name: "song-ranking" }),
        onOpenMemberSearch: () => navigate({ name: "member-search" }),
        onOpenKrn: () => navigate({ name: "krn" }),
        onOpenArticles: () => navigate({ name: "articles" }),
        onOpenAbout: () => navigate({ name: "about" }),
        onOpenReleases: () => navigate({ name: "releases" }),
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
        <div className={isKrnStandalone ? "min-h-screen bg-violet-50" : "min-h-screen bg-slate-100"}>
            {!isKrnStandalone ? (
                <>
                    <SearchMobileNav
                        open={mobileMenuOpen}
                        isSongSearch={route.name === "song-search"}
                        isSongRanking={route.name === "song-ranking"}
                        isMemberSearch={route.name === "member-search"}
                        isKrn={false}
                        isAbout={route.name === "about"}
                        isArticles={route.name === "articles" || route.name === "article"}
                        isReleases={route.name === "releases"}
                        announcementUnreadCount={announcementUnreadCount}
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
                        isSongSearch={route.name === "song-search"}
                        isSongRanking={route.name === "song-ranking"}
                        isMemberSearch={route.name === "member-search"}
                        isKrn={false}
                        isAbout={route.name === "about"}
                        isArticles={route.name === "articles" || route.name === "article"}
                        isReleases={route.name === "releases"}
                        announcementUnreadCount={announcementUnreadCount}
                        dbStatus={dbState.status}
                        {...navActions}
                        collapsed={sidebarCollapsed}
                        onToggleCollapse={() =>
                            setSidebarCollapsed((current) => !current)
                        }
                    />
                </>
            ) : null}

            <main
                className={
                    isKrnStandalone
                        ? "p-2 md:p-4"
                        : `px-4 pb-4 pt-2 ${sidebarCollapsed ? "md:ml-20" : "md:ml-64"} md:px-6 md:pb-6 md:pt-3`
                }
            >
                <div
                    className={
                        isKrnStandalone
                            ? "mx-auto max-w-[1280px]"
                            : route.name === "home" ||
                                route.name === "song-search" ||
                                route.name === "member-search"
                              ? "w-full max-w-none"
                              : "mx-auto max-w-[1120px]"
                    }
                >
                    {route.name === "home" ? (
                        <SetlistSearchPage
                            db={db}
                            dbState={dbState}
                            navigate={navigate}
                        />
                    ) : (
                        <DetailRouteContent
                            route={route}
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

export default App;
