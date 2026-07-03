import {
    BellIcon,
    MenuIcon,
    ResetIcon,
    XIcon,
} from "../ui";
import {
    getSearchNavItemConfig,
    getSearchNavSections,
    isSearchNavItemActive,
    type SearchNavActionMap,
    type SearchNavKey,
    type SearchNavState,
} from "./SearchNavContent";

type SearchMobileNavProps = {
    open: boolean;
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
    onOpen: () => void;
    onClose: () => void;
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

export function SearchMobileNav({
    open,
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
    onOpen,
    onClose,
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
}: SearchMobileNavProps) {
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
        <>
            <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white md:hidden">
                <div className="flex h-12 items-center justify-between px-3">
                    <button
                        type="button"
                        onClick={onOpen}
                        className="inline-flex h-9 w-9 items-center justify-center text-slate-700 hover:bg-slate-100"
                        aria-label="メニューを開く"
                        title="メニューを開く"
                    >
                        <MenuIcon className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onOpenHome();
                            onClose();
                        }}
                        className="inline-flex items-center gap-2"
                        title="トップへ戻る"
                        aria-label="トップへ戻る"
                    >
                        <img
                            src="/Tomoko_logo.png"
                            alt="ToMoKo"
                            className="h-16 w-auto"
                        />
                    </button>
                    <span className="w-9" />
                </div>
            </header>

            <div
                className={`fixed inset-0 z-50 bg-black/30 transition-opacity md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
                onClick={onClose}
            />

            <aside
                className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[calc(100vw-24px)] transform border-r border-slate-200 bg-white transition-transform md:hidden ${
                    open ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="flex h-full min-h-0 flex-col">
                    <div className="flex h-12 items-center justify-between border-b border-slate-200 px-3">
                        <span className="text-sm font-bold text-slate-800">メニュー</span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-9 w-9 items-center justify-center text-slate-700 hover:bg-slate-100"
                            aria-label="メニューを閉じる"
                            title="メニューを閉じる"
                        >
                            <XIcon className="h-5 w-5" />
                        </button>
                    </div>

                    <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="メインメニュー">
                        <div className="space-y-4">
                            {navSections.map((section) => (
                                <section key={section.key}>
                                    <p className="mb-1 px-2 text-[10px] font-bold text-slate-400">
                                        {section.title}
                                    </p>
                                    <div className="space-y-1">
                                        {section.items.map((itemKey) => (
                                            <MobileNavButton
                                                key={itemKey}
                                                itemKey={itemKey}
                                                active={isSearchNavItemActive(
                                                    itemKey,
                                                    navState,
                                                )}
                                                announcementUnreadCount={
                                                    announcementUnreadCount
                                                }
                                                unreadBadgeText={unreadBadgeText}
                                                onClick={() => {
                                                    navActions[itemKey]();
                                                    onClose();
                                                }}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </nav>

                    <div className="space-y-1 border-t border-slate-200 px-3 py-2">
                        {showBirthday && onOpenBirthday ? (
                            <button
                                type="button"
                                onClick={() => {
                                    onOpenBirthday();
                                    onClose();
                                }}
                                className="flex h-10 w-full items-center gap-3 bg-red-600 px-2 text-sm font-bold text-white hover:bg-red-700"
                                aria-label="大切なお知らせ"
                                title="大切なお知らせ"
                            >
                                <BellIcon className="h-4 w-4" />
                                <span>大切なお知らせ</span>
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => {
                                onRefreshDb?.();
                                onClose();
                            }}
                            disabled={!onRefreshDb || isBusy}
                            className="flex h-10 w-full items-center gap-3 px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={isBusy ? "DB更新中..." : "DB最新化"}
                            title={isBusy ? "DB更新中..." : "DB最新化"}
                        >
                            <ResetIcon className="h-4 w-4" />
                            <span>{isBusy ? "更新中..." : "DB最新化"}</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

function MobileNavButton({
    itemKey,
    active,
    announcementUnreadCount,
    unreadBadgeText,
    onClick,
}: {
    itemKey: SearchNavKey;
    active: boolean;
    announcementUnreadCount: number;
    unreadBadgeText: string;
    onClick: () => void;
}) {
    const item = getSearchNavItemConfig(itemKey);
    const showBadge = item.hasAnnouncementBadge && announcementUnreadCount > 0;
    const buttonClass = active
        ? "-mx-3 w-[calc(100%+1.5rem)] bg-slate-100 pl-5 pr-2 text-slate-900 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-red-600"
        : "w-full px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900";
    const iconClass = active
        ? "h-4 w-4 shrink-0 text-red-600"
        : "h-4 w-4 shrink-0";

    return (
        <button
            type="button"
            className={`relative flex h-10 items-center gap-3 text-sm font-medium ${buttonClass}`}
            onClick={onClick}
        >
            <span className="relative inline-flex">
                {item.renderIcon(iconClass)}
                {showBadge ? (
                    <span
                        aria-label="未確認お知らせ件数"
                        className="absolute -right-2 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center bg-red-600 px-1 text-[9px] font-bold leading-none text-white"
                    >
                        {unreadBadgeText}
                    </span>
                ) : null}
            </span>
            <span>{item.label}</span>
        </button>
    );
}
