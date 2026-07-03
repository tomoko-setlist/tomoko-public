import { useState } from "react";

import { BellIcon, ResetIcon } from "../ui";
import {
    getSearchNavItemConfig,
    getSearchNavSections,
    isSearchNavItemActive,
    type SearchNavActionMap,
    type SearchNavKey,
    type SearchNavState,
} from "./SearchNavContent";

type SearchSidebarProps = {
    isSongSearch: boolean;
    isSongRanking: boolean;
    isMemberSearch: boolean;
    isKrn: boolean;
    isAbout: boolean;
    isArticles?: boolean;
    isContact: boolean;
    isReleases: boolean;
    isAdmin: boolean;
    isStats?: boolean;
    announcementUnreadCount?: number;
    showAdmin?: boolean;
    showStats?: boolean;
    dbStatus?: "loading" | "coreReady" | "detailReady" | "ready" | "error";
    onOpenHome: () => void;
    onOpenSongSearch: () => void;
    onOpenSongRanking: () => void;
    onOpenMemberSearch: () => void;
    onOpenKrn: () => void;
    onOpenArticles: () => void;
    onOpenAbout: () => void;
    onOpenContact: () => void;
    onOpenReleases: () => void;
    onOpenAdmin: () => void;
    onOpenStats: () => void;
    onRefreshDb?: () => void;
    onOpenBirthday?: () => void;
};

const isBirthdayNoticeVisible = (): boolean => {
    const env = (import.meta as unknown as { env: { VITE_BIRTHDAY_OVERRIDE?: string } }).env;
    if (env.VITE_BIRTHDAY_OVERRIDE === "true") return true;
    const now = new Date();
    const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    return jst.getMonth() === 6 && jst.getDate() === 2;
};

export function SearchSidebar({
    isSongSearch,
    isSongRanking,
    isMemberSearch,
    isKrn,
    isAbout,
    isArticles = false,
    isContact,
    isReleases,
    isAdmin,
    isStats = false,
    announcementUnreadCount = 0,
    showAdmin = true,
    showStats = false,
    dbStatus = "ready",
    onOpenHome,
    onOpenSongSearch,
    onOpenSongRanking,
    onOpenMemberSearch,
    onOpenKrn,
    onOpenArticles,
    onOpenAbout,
    onOpenContact,
    onOpenReleases,
    onOpenAdmin,
    onOpenStats,
    onRefreshDb,
    onOpenBirthday,
}: SearchSidebarProps) {
    const [expanded, setExpanded] = useState(false);
    const collapsed = !expanded;
    const showBirthday = isBirthdayNoticeVisible();
    const isBusy = dbStatus === "loading" || dbStatus === "coreReady";
    const unreadBadgeText =
        announcementUnreadCount > 99 ? "99+" : String(announcementUnreadCount);
    const navSections = getSearchNavSections(showAdmin, showStats);
    const navState: SearchNavState = {
        isSongSearch,
        isSongRanking,
        isMemberSearch,
        isKrn,
        isAbout,
        isArticles,
        isContact,
        isReleases,
        isAdmin,
        isStats,
    };
    const navActions: SearchNavActionMap = {
        home: onOpenHome,
        song: onOpenSongSearch,
        ranking: onOpenSongRanking,
        member: onOpenMemberSearch,
        krn: onOpenKrn,
        articles: onOpenArticles,
        about: onOpenAbout,
        contact: onOpenContact,
        releases: onOpenReleases,
        admin: onOpenAdmin,
        stats: onOpenStats,
    };

    return (
        <aside
            className={`z-30 hidden border-r-2 border-gray-800 bg-white text-slate-800 transition-[width,box-shadow] duration-300 ease-out md:fixed md:bottom-0 md:top-12 md:flex md:flex-col ${
                expanded
                    ? "md:w-[220px] shadow-[3px_0_0_0_rgba(31,41,55,0.8)]"
                    : "md:w-16 2xl:w-[220px] 2xl:shadow-[3px_0_0_0_rgba(31,41,55,0.8)]"
            }`}
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            onFocusCapture={() => setExpanded(true)}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setExpanded(false);
                }
            }}
        >
            <div className="flex min-h-0 flex-1 flex-col py-2">
                <nav className="min-h-0 flex-1 overflow-y-auto px-2" aria-label="メインメニュー">
                    <div className="space-y-4">
                        {navSections.map((section) => (
                            <section key={section.key}>
                                <p
                                    className={`mb-1 overflow-hidden px-2 text-[10px] font-bold text-slate-400 transition-opacity duration-200 ${
                                        collapsed
                                            ? "h-0 opacity-0 2xl:h-auto 2xl:opacity-100"
                                            : "h-auto opacity-100"
                                    }`}
                                >
                                    {section.title}
                                </p>
                                <div className="space-y-1">
                                    {section.items.map((itemKey) => (
                                        <SidebarNavButton
                                            key={itemKey}
                                            itemKey={itemKey}
                                            active={isSearchNavItemActive(itemKey, navState)}
                                            collapsed={collapsed}
                                            announcementUnreadCount={announcementUnreadCount}
                                            unreadBadgeText={unreadBadgeText}
                                            onClick={navActions[itemKey]}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </nav>

                {(showBirthday && onOpenBirthday) || onRefreshDb ? (
                    <div className="space-y-1 border-t-2 border-gray-800 px-2 pt-2">
                        {showBirthday && onOpenBirthday ? (
                            <BirthdaySidebarButton
                                collapsed={collapsed}
                                onClick={onOpenBirthday}
                            />
                        ) : null}
                        {onRefreshDb ? (
                            <button
                                type="button"
                                onClick={onRefreshDb}
                                disabled={isBusy}
                                className={`flex h-10 w-full items-center rounded-none text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50 ${
                                    collapsed ? "justify-center px-0" : "justify-start gap-3 px-2"
                                }`}
                                title={isBusy ? "DB更新中..." : "DB最新化"}
                                aria-label={isBusy ? "DB更新中..." : "DB最新化"}
                            >
                                <ResetIcon className="h-4 w-4 shrink-0" />
                                <span
                                    className={`overflow-hidden whitespace-nowrap transition-[opacity,width] duration-200 ${
                                        collapsed
                                            ? "w-0 opacity-0 2xl:w-auto 2xl:opacity-100"
                                            : "w-auto opacity-100"
                                    }`}
                                >
                                    {isBusy ? "更新中..." : "DB最新化"}
                                </span>
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </aside>
    );
}

function BirthdaySidebarButton({
    collapsed,
    onClick,
}: {
    collapsed: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex h-10 w-full items-center rounded-none text-sm font-bold text-red-700 transition-colors hover:bg-red-50 ${
                collapsed
                    ? "justify-center px-0 2xl:justify-start 2xl:gap-3 2xl:px-2"
                    : "justify-start gap-3 px-2"
            }`}
            title="大切なお知らせ"
            aria-label={collapsed ? "大切なお知らせ" : undefined}
        >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border-2 border-red-600 bg-red-600 text-white">
                <BellIcon className="h-4 w-4 shrink-0" />
            </span>
            <span
                className={`overflow-hidden whitespace-nowrap text-left transition-[opacity,width] duration-200 ${
                    collapsed
                        ? "w-0 opacity-0 2xl:w-auto 2xl:opacity-100"
                        : "w-auto opacity-100"
                }`}
            >
                大切なお知らせ
            </span>
        </button>
    );
}

function SidebarNavButton({
    itemKey,
    active,
    collapsed,
    announcementUnreadCount,
    unreadBadgeText,
    onClick,
}: {
    itemKey: SearchNavKey;
    active: boolean;
    collapsed: boolean;
    announcementUnreadCount: number;
    unreadBadgeText: string;
    onClick: () => void;
}) {
    const item = getSearchNavItemConfig(itemKey);
    const showBadge = item.hasAnnouncementBadge && announcementUnreadCount > 0;
    const buttonClass = active
        ? "text-red-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
    const iconClass = active
        ? "border-red-600 bg-red-600 text-white"
        : "border-transparent text-current";

    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative flex h-10 w-full items-center rounded-none text-sm font-medium transition-colors duration-150 ${buttonClass} ${
                collapsed
                    ? "justify-center px-0 2xl:justify-start 2xl:gap-3 2xl:px-2"
                    : "justify-start gap-3 px-2"
            }`}
            title={item.label}
            aria-label={collapsed ? item.label : undefined}
        >
            <span
                className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center border-2 transition-colors duration-150 ${iconClass}`}
            >
                {item.renderIcon("h-4 w-4 shrink-0")}
                {showBadge ? (
                    <span
                        aria-label="未確認お知らせ件数"
                        className="absolute -right-2 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center bg-red-600 px-1 text-[9px] font-bold leading-none text-white"
                    >
                        {unreadBadgeText}
                    </span>
                ) : null}
            </span>
            <span
                className={`overflow-hidden whitespace-nowrap text-left transition-[opacity,width] duration-200 ${
                    collapsed
                        ? "w-0 opacity-0 2xl:w-auto 2xl:opacity-100"
                        : "w-auto opacity-100"
                }`}
            >
                {item.label}
            </span>
        </button>
    );
}
