import { ResetIcon } from "../ui";
import {
    getSearchNavItemConfig,
    getSearchNavSections,
    isSearchNavItemActive,
    type SearchNavActionMap,
    type SearchNavState,
} from "./SearchNavContent";

type SearchSidebarProps = {
    isSongSearch: boolean;
    isSongRanking: boolean;
    isMemberSearch: boolean;
    isKrn: boolean;
    isAbout: boolean;
    isArticles?: boolean;
    isReleases: boolean;
    announcementUnreadCount?: number;
    dbStatus?: "loading" | "coreReady" | "detailReady" | "ready" | "error";
    onOpenHome: () => void;
    onOpenSongSearch: () => void;
    onOpenSongRanking: () => void;
    onOpenMemberSearch: () => void;
    onOpenKrn: () => void;
    onOpenArticles: () => void;
    onOpenAbout: () => void;
    onOpenReleases: () => void;
    onRefreshDb?: () => void;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
};

export function SearchSidebar({
    isSongSearch,
    isSongRanking,
    isMemberSearch,
    isKrn,
    isAbout,
    isArticles = false,
    isReleases,
    announcementUnreadCount = 0,
    dbStatus = "ready",
    onOpenHome,
    onOpenSongSearch,
    onOpenSongRanking,
    onOpenMemberSearch,
    onOpenKrn,
    onOpenArticles,
    onOpenAbout,
    onOpenReleases,
    onRefreshDb,
    collapsed = false,
    onToggleCollapse,
}: SearchSidebarProps) {
    const isBusy = dbStatus === "loading" || dbStatus === "coreReady";
    const unreadBadgeText =
        announcementUnreadCount > 99 ? "99+" : String(announcementUnreadCount);
    const navSections = getSearchNavSections();
    const navState: SearchNavState = {
        isSongSearch,
        isSongRanking,
        isMemberSearch,
        isKrn,
        isAbout,
        isArticles,
        isReleases,
    };
    const navActions: SearchNavActionMap = {
        home: onOpenHome,
        song: onOpenSongSearch,
        ranking: onOpenSongRanking,
        member: onOpenMemberSearch,
        krn: onOpenKrn,
        articles: onOpenArticles,
        about: onOpenAbout,
        releases: onOpenReleases,
    };
    const navButtonBase = collapsed
        ? "mx-auto inline-flex h-10 w-10 items-center justify-center rounded-none border-2 border-gray-800 p-0 text-gray-700 transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]"
        : "w-full rounded-none border-2 border-gray-800 px-2.5 py-2 text-left transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]";
    const navButtonActive = "bg-gray-200 text-gray-800";
    const navButtonInactive =
        "bg-white text-gray-700 hover:-translate-y-0.5 hover:border-gray-900 hover:bg-gray-100 hover:text-gray-900 hover:shadow-[4px_4px_0px_0px_rgba(31,41,55,0.9)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(31,41,55,0.8)]";
    const sectionTitleClass =
        "px-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500";

    return (
        <aside
            className={`hidden border-r border-gray-200 bg-white p-4 pt-3 text-gray-800 z-30 md:fixed md:bottom-0 md:top-12 md:flex md:flex-col ${
                collapsed ? "md:w-20" : "md:w-64"
            }`}
        >
            <div className="flex h-full flex-col">
                {onToggleCollapse ? (
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            className="bg-transparent px-1 py-0 text-[11px] leading-none font-semibold text-gray-700"
                            title={collapsed ? "サイドバーを展開" : "サイドバーを最小化"}
                            aria-label={collapsed ? "サイドバーを展開" : "サイドバーを最小化"}
                        >
                            {collapsed ? ">>" : "<<"}
                        </button>
                    </div>
                ) : null}
                <div className="mt-1.5 space-y-2.5">
                    {navSections.map((section, sectionIndex) => (
                        <section
                            key={section.key}
                            className={
                                sectionIndex === 0
                                    ? "space-y-2"
                                    : "space-y-2 border-t border-gray-200 pt-3"
                            }
                        >
                            {!collapsed ? (
                                <p className={sectionTitleClass}>{section.title}</p>
                            ) : null}
                            <ul className="space-y-1.5">
                                {section.items.map((itemKey) => {
                                    const item = getSearchNavItemConfig(itemKey);
                                    const isActive = isSearchNavItemActive(
                                        item.key,
                                        navState,
                                    );

                                    return (
                                        <li key={item.key}>
                                            <button
                                                type="button"
                                                onClick={navActions[item.key]}
                                                className={`${navButtonBase} ${
                                                    isActive
                                                        ? navButtonActive
                                                        : navButtonInactive
                                                }`}
                                            >
                                                {collapsed ? (
                                                    <div className="relative flex h-full w-full items-center justify-center">
                                                        {item.renderIcon("h-4 w-4")}
                                                        {item.hasAnnouncementBadge &&
                                                        announcementUnreadCount > 0 ? (
                                                            <span
                                                                aria-label="未確認お知らせ件数"
                                                                className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-none bg-red-600 px-1 text-[9px] font-bold leading-none text-white"
                                                            >
                                                                {unreadBadgeText}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ) : item.hasAnnouncementBadge ? (
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center space-x-2.5">
                                                            {item.renderIcon(
                                                                "h-4 w-4",
                                                            )}
                                                            <div>
                                                                <div className="text-[13px] font-medium leading-4">
                                                                    {item.label}
                                                                </div>
                                                                {item.description ? (
                                                                    <div
                                                                        className={`text-[11px] leading-4 ${
                                                                            isActive
                                                                                ? "text-gray-600"
                                                                                : "text-gray-500"
                                                                        }`}
                                                                    >
                                                                        {item.description}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0">
                                                            {announcementUnreadCount >
                                                            0 ? (
                                                                <span
                                                                    aria-label="未確認お知らせ件数"
                                                                    className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-none bg-red-600 px-1.5 text-[10px] font-bold leading-none text-white"
                                                                >
                                                                    {unreadBadgeText}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center space-x-2.5">
                                                        {item.renderIcon("h-4 w-4")}
                                                        <div>
                                                            <div className="text-[13px] font-medium leading-4">
                                                                {item.label}
                                                            </div>
                                                            {item.description ? (
                                                                <div
                                                                    className={`text-[11px] leading-4 ${
                                                                        isActive
                                                                            ? "text-gray-600"
                                                                            : "text-gray-500"
                                                                    }`}
                                                                >
                                                                    {item.description}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
                <div className="mt-auto space-y-2">
                    {onRefreshDb ? (
                        <div className="border-t border-gray-200 pt-4">
                            <button
                                type="button"
                                onClick={onRefreshDb}
                                disabled={isBusy}
                                className={`${navButtonBase} ${navButtonInactive} disabled:pointer-events-none disabled:opacity-55`}
                                title={isBusy ? "DB更新中..." : "DB最新化（キャッシュ更新）"}
                                aria-label={isBusy ? "DB更新中..." : "DB最新化"}
                            >
                                <span className={collapsed ? "flex items-center justify-center" : "inline-flex items-center gap-2.5"}>
                                    <ResetIcon className="h-4 w-4" />
                                    {!collapsed ? <span className="text-[13px] font-medium leading-4">{isBusy ? "更新中..." : "DB最新化"}</span> : null}
                                </span>
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </aside>
    );
}
