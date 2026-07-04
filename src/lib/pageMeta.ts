import { buildPathRoute, buildRouteKey, type AppRoute } from "./appRoute";
import { getArticleBySlug } from "../content/articles";

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
    if (route.name === "stats") return "統計アシスタント";
    if (route.name === "member-search") return "メンバー検索";
    if (route.name === "articles") return "記事";
    if (route.name === "article") {
        return getArticleBySlug(route.slug)?.title ?? "記事";
    }
    if (route.name === "about") return "ToMoKoって？";
    if (route.name === "contact") return "お問い合わせ";
    if (route.name === "releases") return "更新情報";
    if (route.name === "release") return `更新情報 #${route.id}`;
    if (route.name === "krn") return "KRN";
    if (route.name === "admin") return "管理画面";
    if (route.name === "event") return `イベント #${route.id}`;
    if (route.name === "stage") return `ステージ #${route.id}`;
    if (route.name === "venue") return `会場 #${route.id}`;
    if (route.name === "artist") return `アーティスト #${route.id}`;
    if (route.name === "member") return `メンバー #${route.id}`;
    if (route.name === "group") return `グループ #${route.id}`;
    if (route.name === "creator") return `クリエイター #${route.id}`;
    if (route.name === "song") return `楽曲 #${route.id}`;
    if (route.name === "album") return `アルバム #${route.id}`;
    return DEFAULT_SITE_NAME;
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
    if (route.name === "stats") {
        return "自然言語でハロプロのセットリスト統計を集計する実験ページです。";
    }
    if (route.name === "member-search") {
        return "ハロプロのメンバーをかな・所属状態・プロフィール情報で検索できます。";
    }
    if (route.name === "articles") return "ToMoKoからのお知らせ、運営の話、読み物をまとめています。";
    if (route.name === "article") {
        return getArticleBySlug(route.slug)?.summary ?? `${routeLabel} の記事ページです。`;
    }
    if (route.name === "about") return "ToMoKoについて、著作情報と免責事項をまとめています。";
    if (route.name === "contact") return "ToMoKoへのお問い合わせ、データ誤り、不足情報、要望をお送りいただけます。";
    if (route.name === "releases") return "ToMoKoの登録データ、お知らせ、更新履歴を確認できます。";
    if (route.name === "krn") return "セトリ投稿お助けサービス KRN の入力・確認ページです。";
    if (route.name === "admin") return "管理者向け編集ページです。";
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
    const isAdmin = route.name === "admin";
    const isHiddenPoc = route.name === "stats";
    const title =
        route.name === "home"
            ? DEFAULT_HOME_TITLE
            : `${routeLabel} | ${DEFAULT_SITE_NAME}`;

    return {
        title,
        description,
        canonicalUrl,
        robots: isAdmin || isHiddenPoc ? "noindex,nofollow,noarchive" : "index,follow",
        ogType:
            route.name === "home" ||
            route.name === "song-search" ||
            route.name === "song-ranking" ||
            route.name === "stats" ||
            route.name === "member-search" ||
            route.name === "articles" ||
            route.name === "about" ||
            route.name === "contact" ||
            route.name === "releases" ||
            route.name === "krn"
                ? "website"
                : "article",
    };
};
