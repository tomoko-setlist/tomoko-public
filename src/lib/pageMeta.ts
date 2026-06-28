import { buildPathRoute, buildRouteKey, type AppRoute } from "./appRoute";

const DEFAULT_SITE_NAME = "ToMoKo";
const DEFAULT_HOME_TITLE = "ToMoKo - ハロプロセトリ検索システム";
const DEFAULT_DESCRIPTION =
    "統一され、網羅的で、高度な検索システム。ハロプロのセットリスト・楽曲・イベントを横断的に検索できます。";

const normalizeOrigin = (origin: string): string => origin.replace(/\/+$/, "");

const resolveRouteLabel = (
    route: AppRoute,
    routeTitles: Record<string, string>,
): string => {
    const dynamic = routeTitles[buildRouteKey(route)];
    if (dynamic) return dynamic;

    if (route.name === "home") return "セトリ検索";
    if (route.name === "song-search") return "楽曲検索";
    if (route.name === "song-ranking") return "歌唱回数ランキング";
    if (route.name === "member-search") return "メンバー検索";
    if (route.name === "about") return "About";
    if (route.name === "releases") return "お知らせ";
    if (route.name === "krn") return "KRN";
    if (route.name === "event") return `イベント #${route.id}`;
    if (route.name === "stage") return `ステージ #${route.id}`;
    if (route.name === "venue") return `会場 #${route.id}`;
    if (route.name === "artist") return `アーティスト #${route.id}`;
    if (route.name === "member") return `メンバー #${route.id}`;
    if (route.name === "group") return `グループ #${route.id}`;
    if (route.name === "creator") return `クリエイター #${route.id}`;
    if (route.name === "song") return `楽曲 #${route.id}`;
    if (route.name === "album") return `アルバム #${route.id}`;
    return `お知らせ #${route.id}`;
};

const resolveRouteDescription = (
    route: AppRoute,
    routeLabel: string,
): string => {
    if (route.name === "home") return DEFAULT_DESCRIPTION;
    if (route.name === "song-search") {
        return "ハロプロの楽曲をタイトル・アーティスト・クレジットで検索できます。";
    }
    if (route.name === "song-ranking") {
        return "ハロプロ楽曲の歌唱回数ランキングを確認できます。";
    }
    if (route.name === "member-search") {
        return "ハロプロのメンバーをかな・所属状態・プロフィール情報で検索できます。";
    }
    if (route.name === "about") return "ToMoKoについて、著作情報と免責事項をまとめています。";
    if (route.name === "releases") return "ToMoKoのデータ登録状況と更新履歴を確認できます。";
    if (route.name === "krn") return "セトリ投稿お助けサービス KRN の入力・確認ページです。";
    return `${routeLabel} の詳細ページです。`;
};

export type PageMeta = {
    title: string;
    description: string;
    canonicalUrl: string;
    robots: string;
    ogType: "website" | "article";
};

export const buildPageMeta = ({
    route,
    routeTitles,
    origin,
}: {
    route: AppRoute;
    routeTitles: Record<string, string>;
    origin: string;
}): PageMeta => {
    const safeOrigin = normalizeOrigin(origin);
    const routeLabel = resolveRouteLabel(route, routeTitles);
    const description = resolveRouteDescription(route, routeLabel);
    const canonicalUrl = `${safeOrigin}${buildPathRoute(route)}`;
    const title =
        route.name === "home"
            ? DEFAULT_HOME_TITLE
            : `${routeLabel} | ${DEFAULT_SITE_NAME}`;

    return {
        title,
        description,
        canonicalUrl,
        robots: "index,follow",
        ogType:
            route.name === "home" ||
            route.name === "song-search" ||
            route.name === "song-ranking" ||
            route.name === "member-search" ||
            route.name === "about" ||
            route.name === "releases" ||
            route.name === "krn"
                ? "website"
                : "article",
    };
};
