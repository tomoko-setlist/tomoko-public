import {
    BarChartHorizontalIcon,
    BellIcon,
    EditIcon,
    MailIcon,
    MusicIcon,
    SetlistIcon,
    SettingsIcon,
    SparklesIcon,
    UserIcon,
} from "../ui";

import type { JSX } from "react";

export type SearchNavKey =
    | "home"
    | "song"
    | "ranking"
    | "stats"
    | "member"
    | "krn"
    | "articles"
    | "releases"
    | "contact"
    | "about"
    | "admin";

export type SearchNavState = {
    isSongSearch: boolean;
    isSongRanking: boolean;
    isMemberSearch: boolean;
    isKrn: boolean;
    isAbout: boolean;
    isArticles?: boolean;
    isReleases: boolean;
    isContact: boolean;
    isAdmin: boolean;
    isStats?: boolean;
};

export type SearchNavSection = {
    key: "primary" | "tools" | "support" | "about-site" | "system";
    title: string;
    items: SearchNavKey[];
};

export type SearchNavItemConfig = {
    key: SearchNavKey;
    label: string;
    description: string;
    renderIcon: (className: string) => JSX.Element;
    hasAnnouncementBadge?: boolean;
};

export type SearchNavActionMap = Record<SearchNavKey, () => void>;

const ABOUT_ICON_STYLE = {
    WebkitMaskImage: "url('/icon.svg')",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    WebkitMaskSize: "contain",
    maskImage: "url('/icon.svg')",
    maskRepeat: "no-repeat",
    maskPosition: "center",
    maskSize: "contain",
} as const;

const SEARCH_NAV_ITEM_CONFIG: Record<SearchNavKey, SearchNavItemConfig> = {
    home: {
        key: "home",
        label: "セトリ検索",
        description: "",
        renderIcon: (className) => <SetlistIcon className={className} />,
    },
    song: {
        key: "song",
        label: "楽曲検索",
        description: "",
        renderIcon: (className) => <MusicIcon className={className} />,
    },
    ranking: {
        key: "ranking",
        label: "歌唱回数ランキング",
        description: "",
        renderIcon: (className) => <BarChartHorizontalIcon className={className} />,
    },
    stats: {
        key: "stats",
        label: "統計アシスタント",
        description: "自然言語でデータ分析",
        renderIcon: (className) => <SparklesIcon className={className} />,
    },
    member: {
        key: "member",
        label: "メンバー検索",
        description: "",
        renderIcon: (className) => <UserIcon className={className} />,
    },
    krn: {
        key: "krn",
        label: "KRN",
        description: "セトリ投稿お助けサービス",
        renderIcon: (className) => <SparklesIcon className={className} />,
    },
    articles: {
        key: "articles",
        label: "記事",
        description: "",
        renderIcon: (className) => <EditIcon className={className} />,
    },
    releases: {
        key: "releases",
        label: "更新情報",
        description: "お知らせ・データ登録状況",
        renderIcon: (className) => <BellIcon className={className} />,
        hasAnnouncementBadge: true,
    },
    contact: {
        key: "contact",
        label: "お問い合わせ",
        description: "ご意見・ご連絡",
        renderIcon: (className) => <MailIcon className={className} />,
    },
    about: {
        key: "about",
        label: "ToMoKoって？",
        description: "ToMoKoについて",
        renderIcon: (className) => (
            <span
                className={`${className} shrink-0 bg-current`}
                aria-hidden="true"
                style={ABOUT_ICON_STYLE}
            />
        ),
    },
    admin: {
        key: "admin",
        label: "管理画面",
        description: "",
        renderIcon: (className) => <SettingsIcon className={className} />,
    },
};

const BASE_SEARCH_NAV_SECTIONS: SearchNavSection[] = [
    {
        key: "primary",
        title: "検索",
        items: ["home", "song", "member", "ranking"],
    },
    {
        key: "tools",
        title: "ツール",
        items: ["krn"],
    },
    {
        key: "support",
        title: "情報",
        items: ["releases", "articles"],
    },
    {
        key: "about-site",
        title: "その他",
        items: ["about", "contact"],
    },
    {
        key: "system",
        title: "管理",
        items: ["admin"],
    },
];

export function getSearchNavSections(
    showAdmin: boolean,
    showStats = false,
): SearchNavSection[] {
    const sections = showStats
        ? [
              BASE_SEARCH_NAV_SECTIONS[0],
              {
                  key: "tools" as const,
                  title: "ツール",
                  items: ["stats" as const, "krn" as const],
              },
              ...BASE_SEARCH_NAV_SECTIONS.slice(2),
          ]
        : BASE_SEARCH_NAV_SECTIONS;
    return showAdmin
        ? sections
        : sections.filter((section) => section.key !== "system");
}

export function getSearchNavItemConfig(key: SearchNavKey): SearchNavItemConfig {
    return SEARCH_NAV_ITEM_CONFIG[key];
}

export function isSearchNavItemActive(
    key: SearchNavKey,
    state: SearchNavState,
): boolean {
    switch (key) {
        case "home":
            return (
                !state.isSongSearch &&
                !state.isSongRanking &&
                !state.isMemberSearch &&
                !state.isKrn &&
                !state.isAdmin &&
                !state.isAbout &&
                !state.isArticles &&
                !state.isContact &&
                !state.isReleases &&
                !state.isStats
            );
        case "song":
            return state.isSongSearch && !state.isSongRanking && !state.isMemberSearch && !state.isAdmin;
        case "ranking":
            return state.isSongRanking && !state.isMemberSearch && !state.isAdmin;
        case "stats":
            return Boolean(state.isStats);
        case "member":
            return state.isMemberSearch && !state.isAdmin;
        case "krn":
            return state.isKrn;
        case "articles":
            return Boolean(state.isArticles);
        case "releases":
            return state.isReleases;
        case "contact":
            return state.isContact;
        case "about":
            return state.isAbout;
        case "admin":
            return state.isAdmin;
        default:
            return false;
    }
}
