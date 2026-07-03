import { useCallback, useMemo, type ReactNode } from "react";

import { buildRouteKey, type AppRoute } from "../../lib/appRoute";
import {
    buildBreadcrumbRoutes,
    buildRouteTrail,
    getLatestSearchRoute,
    isDetailRoute,
    routeLabel,
} from "../../lib/routeNavigation";
import { DetailContent } from "../detail";
import {
    AlbumIcon,
    EditIcon,
    EventIcon,
    MicrophoneIcon,
    MusicIcon,
    SetlistIcon,
    UserIcon,
    UsersIcon,
    VenueIcon,
} from "../ui";

import type { SetlistSearchDb } from "../../lib/setlistSearchDb/types";

type DetailRouteContentProps = {
    route: AppRoute;
    history: AppRoute[];
    routeTitles: Record<string, string>;
    setRouteTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    db: SetlistSearchDb | null;
    navigate: (route: AppRoute) => void;
    navigateToHistoryRoute: (
        route: AppRoute,
        fallback: AppRoute,
    ) => void;
};

export function DetailRouteContent({
    route,
    history,
    routeTitles,
    setRouteTitles,
    db,
    navigate,
    navigateToHistoryRoute,
}: DetailRouteContentProps) {
    const routeKey = useMemo(() => buildRouteKey(route), [route]);
    const handleResolveTitle = useCallback(
        (title: string) => {
            setRouteTitles((prev) => {
                if (prev[routeKey] === title) return prev;
                return {
                    ...prev,
                    [routeKey]: title,
                };
            });
        },
        [routeKey, setRouteTitles],
    );

    const isDetail = isDetailRoute(route);
    const detailTrail = isDetail ? buildRouteTrail(history, route) : [];
    const breadcrumbItems = detailTrail.filter((item) => !item.current);
    const latestSearchRoute =
        route.name === "article" ? { name: "releases" as const } : getLatestSearchRoute(history);
    const breadcrumbRoutes = buildBreadcrumbRoutes(history, route);
    const previousBreadcrumbRoute =
        breadcrumbItems.length > 0
            ? breadcrumbItems[breadcrumbItems.length - 1].route
            : null;
    const previousHistoryRoute = history.length > 0 ? history[history.length - 1] : null;

    if (!isDetail) {
        return (
            <DetailContent
                route={route}
                db={db}
                onResolveTitle={() => {}}
                onNavigateEvent={(id) => navigate({ name: "event", id })}
                onNavigateStage={(id) => navigate({ name: "stage", id })}
                onNavigateVenue={(id) => navigate({ name: "venue", id })}
                onNavigateSong={(id) => navigate({ name: "song", id })}
                onNavigateArtist={(id) => navigate({ name: "artist", id })}
                onNavigateMember={(id) => navigate({ name: "member", id })}
                onNavigateGroup={(id) => navigate({ name: "group", id })}
                onNavigateCreator={(id) => navigate({ name: "creator", id })}
                onNavigateAlbum={(id) => navigate({ name: "album", id })}
                onNavigateRelease={(id) => navigate({ name: "release", id })}
                onNavigateArticles={() => navigate({ name: "articles" })}
                onNavigateArticle={(slug) => navigate({ name: "article", slug })}
            />
        );
    }

    const handleBottomBack = () => {
        if (previousHistoryRoute) {
            navigateToHistoryRoute(previousHistoryRoute, latestSearchRoute);
            return;
        }
        if (previousBreadcrumbRoute) {
            navigateToHistoryRoute(previousBreadcrumbRoute, latestSearchRoute);
            return;
        }
        navigate(latestSearchRoute);
    };

    return (
        <>
            <nav
                aria-label="遷移履歴"
                className="mb-1 px-1 py-0.5 text-xs md:hidden"
            >
                <div className="flex flex-wrap items-center gap-1.5">
                    {breadcrumbRoutes.map((item, index) => (
                        <div
                            key={`${buildRouteKey(item.route)}-${index}-${item.current ? "current" : "link"}`}
                            className="flex items-center gap-1"
                        >
                            {item.current ? (
                                <span
                                    title={routeLabel(item.route, routeTitles)}
                                    className="px-1.5 py-0.5 font-semibold text-gray-900"
                                >
                                    <span className="inline-flex items-center gap-1">
                                        {routeTypeIcon(item.route)}
                                        <span className="inline-block max-w-[220px] truncate align-bottom">
                                            {routeLabel(item.route, routeTitles)}
                                        </span>
                                    </span>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() =>
                                        item.fromHistory
                                            ? navigateToHistoryRoute(item.route, {
                                                  name: latestSearchRoute.name,
                                              })
                                            : navigate(item.route)
                                    }
                                    title={routeLabel(item.route, routeTitles)}
                                    className="px-1.5 py-0.5 text-slate-700 hover:text-slate-900"
                                >
                                    <span className="inline-flex items-center gap-1">
                                        {item.fromHistory
                                            ? routeTypeIcon(item.route)
                                            : null}
                                        <span className="inline-block max-w-[220px] truncate align-bottom">
                                            {routeLabel(item.route, routeTitles)}
                                        </span>
                                    </span>
                                </button>
                            )}
                            {index < breadcrumbRoutes.length - 1 ? (
                                <span className="text-gray-600">&gt;</span>
                            ) : null}
                        </div>
                    ))}
                </div>
            </nav>

            <DetailContent
                route={route}
                db={db}
                onResolveTitle={handleResolveTitle}
                onNavigateEvent={(id) => navigate({ name: "event", id })}
                onNavigateStage={(id) => navigate({ name: "stage", id })}
                onNavigateVenue={(id) => navigate({ name: "venue", id })}
                onNavigateSong={(id) => navigate({ name: "song", id })}
                onNavigateArtist={(id) => navigate({ name: "artist", id })}
                onNavigateMember={(id) => navigate({ name: "member", id })}
                onNavigateGroup={(id) => navigate({ name: "group", id })}
                onNavigateCreator={(id) => navigate({ name: "creator", id })}
                onNavigateAlbum={(id) => navigate({ name: "album", id })}
                onNavigateRelease={(id) => navigate({ name: "release", id })}
                onNavigateArticles={() => navigate({ name: "articles" })}
                onNavigateArticle={(slug) => navigate({ name: "article", slug })}
            />

            <footer className="mt-4 border-t-2 border-gray-800 bg-white">
                <div className="flex w-full justify-center px-4 py-3 md:px-6">
                    <button
                        type="button"
                        onClick={handleBottomBack}
                        className="inline-flex items-center gap-1.5 rounded-none border-2 border-gray-800 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-[4px_4px_0px_0px_rgba(31,41,55,0.9)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(31,41,55,0.8)]"
                        aria-label="戻る"
                        title="戻る"
                    >
                        戻る
                    </button>
                </div>
            </footer>
        </>
    );
}

function routeTypeIcon(route: AppRoute): ReactNode {
    if (route.name === "event") return <EventIcon className="h-4 w-4 shrink-0" />;
    if (route.name === "stage") return <SetlistIcon className="h-4 w-4 shrink-0" />;
    if (route.name === "venue") return <VenueIcon className="h-4 w-4 shrink-0" />;
    if (route.name === "song") return <MusicIcon className="h-4 w-4 shrink-0" />;
    if (route.name === "artist") return <MicrophoneIcon className="h-4 w-4 shrink-0" />;
    if (route.name === "member") return <UserIcon className="h-4 w-4 shrink-0" />;
    if (route.name === "group") return <UsersIcon className="h-4 w-4 shrink-0" />;
    if (route.name === "creator") return <EditIcon className="h-4 w-4 shrink-0" />;
    if (route.name === "album") return <AlbumIcon className="h-4 w-4 shrink-0" />;
    if (route.name === "release") return null;
    if (route.name === "article") return <EditIcon className="h-4 w-4 shrink-0" />;
    return null;
}
