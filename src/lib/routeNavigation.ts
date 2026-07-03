import { buildRouteKey, type AppRoute } from "./appRoute";

export type SearchRoute = Extract<
    AppRoute,
    | { name: "home" }
    | { name: "krn" }
    | { name: "song-search" }
    | { name: "song-ranking" }
    | { name: "stats" }
    | { name: "member-search" }
    | { name: "articles" }
    | { name: "contact" }
    | { name: "releases" }
>;

export type DetailRoute = Exclude<
    AppRoute,
    | { name: "home" }
    | { name: "krn" }
    | { name: "about" }
    | { name: "contact" }
    | { name: "articles" }
    | { name: "releases" }
    | { name: "song-search" }
    | { name: "song-ranking" }
    | { name: "stats" }
    | { name: "member-search" }
    | { name: "admin" }
>;

export function isDetailRoute(route: AppRoute): route is DetailRoute {
    return (
        route.name !== "home" &&
        route.name !== "krn" &&
        route.name !== "about" &&
        route.name !== "contact" &&
        route.name !== "articles" &&
        route.name !== "releases" &&
        route.name !== "song-search" &&
        route.name !== "song-ranking" &&
        route.name !== "stats" &&
        route.name !== "member-search" &&
        route.name !== "admin"
    );
}

export function isSearchRoute(route: AppRoute): route is SearchRoute {
    return (
        route.name === "home" ||
        route.name === "krn" ||
        route.name === "song-search" ||
        route.name === "song-ranking" ||
        route.name === "stats" ||
        route.name === "member-search" ||
        route.name === "articles" ||
        route.name === "contact" ||
        route.name === "releases"
    );
}

export function getLatestSearchRoute(
    history: AppRoute[],
    fallback: SearchRoute = { name: "home" },
): SearchRoute {
    for (let index = history.length - 1; index >= 0; index -= 1) {
        const route = history[index];
        if (isSearchRoute(route)) {
            return route;
        }
    }
    return fallback;
}

export type BreadcrumbRoute = {
    route: AppRoute;
    current: boolean;
    fromHistory: boolean;
};

export function buildBreadcrumbRoutes(
    history: AppRoute[],
    current: AppRoute,
): BreadcrumbRoute[] {
    if (!isDetailRoute(current)) {
        return [];
    }
    const detailTrail = buildRouteTrail(history, current);
    const breadcrumbItems = detailTrail.filter((item) => !item.current);
    const currentBreadcrumbItem =
        detailTrail.find((item) => item.current) ?? null;
    const latestSearchRoute =
        current.name === "article" ? { name: "releases" as const } : getLatestSearchRoute(history);
    return [
        { route: latestSearchRoute, current: false, fromHistory: false },
        ...breadcrumbItems.map((item) => ({
            route: item.route,
            current: false,
            fromHistory: true,
        })),
        ...(currentBreadcrumbItem
            ? [
                  {
                      route: currentBreadcrumbItem.route,
                      current: true,
                      fromHistory: false,
                  },
              ]
            : []),
    ];
}

export function routeLabel(
    route: AppRoute,
    routeTitles: Record<string, string>,
): string {
    const resolved = routeTitles[buildRouteKey(route)];
    if (resolved) {
        return resolved;
    }
    if (route.name === "home") return "セトリ検索";
    if (route.name === "krn") return "KRN";
    if (route.name === "about") return "サポート";
    if (route.name === "contact") return "サポート";
    if (route.name === "articles") return "記事一覧";
    if (route.name === "song-search") return "楽曲検索";
    if (route.name === "song-ranking") return "歌唱回数ランキング";
    if (route.name === "releases") return "更新情報";
    if (route.name === "stats") return "統計アシスタント";
    if (route.name === "admin") return "管理画面";
    if (route.name === "member-search") return "メンバー検索";
    if (route.name === "release") return `更新情報 #${route.id}`;
    if (route.name === "article") return "記事";
    if (route.name === "event") return `イベント #${route.id}`;
    if (route.name === "stage") return `ステージ #${route.id}`;
    if (route.name === "venue") return `会場 #${route.id}`;
    if (route.name === "artist") return `アーティスト #${route.id}`;
    if (route.name === "member") return `メンバー #${route.id}`;
    if (route.name === "group") return `グループ #${route.id}`;
    if (route.name === "creator") return `クリエイター #${route.id}`;
    if (route.name === "song") return `楽曲 #${route.id}`;
    return `アルバム #${route.id}`;
}

export function buildRouteTrail(
    history: AppRoute[],
    current: AppRoute,
): Array<{ route: AppRoute; current: boolean }> {
    if (!isDetailRoute(current)) {
        return [];
    }
    const routeSequence = [...history, current];
    const contiguousDetailTrail: AppRoute[] = [];
    for (let index = routeSequence.length - 1; index >= 0; index -= 1) {
        const route = routeSequence[index];
        if (!isDetailRoute(route)) {
            break;
        }
        contiguousDetailTrail.push(route);
    }
    contiguousDetailTrail.reverse();
    const uniqueFromTail: AppRoute[] = [];
    const seen = new Set<string>();
    for (let index = contiguousDetailTrail.length - 1; index >= 0; index -= 1) {
        const route = contiguousDetailTrail[index];
        const key = buildRouteKey(route);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        uniqueFromTail.push(route);
    }
    const ordered = uniqueFromTail.reverse().slice(-3);
    return ordered.map((route, index) => ({
        route,
        current: index === ordered.length - 1,
    }));
}
