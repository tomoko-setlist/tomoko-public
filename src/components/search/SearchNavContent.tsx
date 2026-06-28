import {
    BarChartHorizontalIcon,
    BellIcon,
    MusicIcon,
    SetlistIcon,
    SparklesIcon,
    UserIcon,
} from "../ui";

import type { JSX } from "react";

export type SearchNavKey =
    | "home"
    | "song"
    | "ranking"
    | "member"
    | "krn"
    | "releases"
    | "about";

export type SearchNavState = {
    isSongSearch: boolean;
    isSongRanking: boolean;
    isMemberSearch: boolean;
    isKrn: boolean;
    isAbout: boolean;
    isReleases: boolean;
};

export type SearchNavSection = {
    key: "search" | "ranking" | "krn" | "info";
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
    releases: {
        key: "releases",
        label: "お知らせ",
        description: "データの登録状況",
        renderIcon: (className) => <BellIcon className={className} />,
        hasAnnouncementBadge: true,
    },
    about: {
        key: "about",
        label: "About",
        description: "ToMoKoについて",
        renderIcon: (className) => (
            <span
                className={`${className} shrink-0 bg-current`}
                aria-hidden="true"
                style={ABOUT_ICON_STYLE}
            />
        ),
    },
};

const BASE_SEARCH_NAV_SECTIONS: SearchNavSection[] = [
    {
        key: "search",
        title: "検索サービス",
        items: ["home", "song", "member"],
    },
    {
        key: "ranking",
        title: "ランキング",
        items: ["ranking"],
    },
    {
        key: "krn",
        title: "便利サービス",
        items: ["krn"],
    },
    {
        key: "info",
        title: "About・データ",
        items: ["releases", "about"],
    },
];

export function getSearchNavSections(): SearchNavSection[] {
    return BASE_SEARCH_NAV_SECTIONS;
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
                !state.isAbout &&
                !state.isReleases
            );
        case "song":
            return state.isSongSearch && !state.isSongRanking && !state.isMemberSearch;
        case "ranking":
            return state.isSongRanking && !state.isMemberSearch;
        case "member":
            return state.isMemberSearch;
        case "krn":
            return state.isKrn;
        case "releases":
            return state.isReleases;
        case "about":
            return state.isAbout;
        default:
            return false;
    }
}
