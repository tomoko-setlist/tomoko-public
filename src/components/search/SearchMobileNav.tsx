import {
    MenuIcon,
    ResetIcon,
    XIcon,
} from "../ui";
import {
    getSearchNavItemConfig,
    getSearchNavSections,
    isSearchNavItemActive,
    type SearchNavActionMap,
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
    isReleases: boolean;
    announcementUnreadCount?: number;
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
    onOpenReleases: () => void;
    onRefreshDb?: () => void;
};

export function SearchMobileNav({
    open,
    isSongSearch,
    isSongRanking,
    isMemberSearch,
    isKrn,
    isAbout,
    isArticles = false,
    isReleases,
    announcementUnreadCount = 0,
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
    onOpenReleases,
    onRefreshDb,
}: SearchMobileNavProps) {
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
    const navButtonBase =
        "w-full rounded-none border-2 px-3 py-3 text-left text-sm shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]";
    const navLabelClass = "inline-flex items-center gap-2";
    const navIconClass = "h-4 w-4 shrink-0";

    return (
        <>
            <header className="sticky top-0 z-40 border-b border-gray-200 bg-white md:hidden">
                <div className="flex h-12 items-center justify-between px-3">
                    <button
                        type="button"
                        onClick={onOpen}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-none text-red-600"
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
                        title="トップへ戻る"
                        aria-label="トップへ戻る"
                    >
                        <img
                            src="/Tomoko_logo.png"
                            alt="Tomoko"
                            className="pl-1 h-16 w-auto"
                        />
                    </button>
                    <span className="w-9" />
                </div>
            </header>

            <div
                className={`fixed inset-0 z-50 bg-black/45 transition-opacity md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
                onClick={onClose}
            />

            <aside
                className={`fixed inset-y-0 left-0 z-50 w-[84%] max-w-[320px] transform border-r border-gray-200 bg-white p-4 transition-transform md:hidden ${
                    open ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="mb-4 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            onOpenHome();
                            onClose();
                        }}
                        title="トップへ戻る"
                        aria-label="トップへ戻る"
                    >
                        <img
                            src="/Tomoko_logo.png"
                            alt="Tomoko"
                            className="pl-12 h-20 w-auto"
                        />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-none text-gray-700"
                        aria-label="メニューを閉じる"
                        title="メニューを閉じる"
                    >
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>

                {navSections.map((section, sectionIndex) => (
                    <ul
                        key={section.key}
                        className={
                            sectionIndex === 0
                                ? "space-y-2"
                                : "mt-3 space-y-2 border-t border-gray-200 pt-3"
                        }
                    >
                        {section.items.map((itemKey) => {
                            const item = getSearchNavItemConfig(itemKey);
                            const isActive = isSearchNavItemActive(item.key, navState);
                            const buttonClass = `${navButtonBase} ${
                                isActive
                                    ? "border-gray-800 bg-gray-200 text-gray-800"
                                    : "border-gray-800 bg-white text-gray-700"
                            }`;

                            return (
                                <li key={item.key}>
                                    <button
                                        type="button"
                                        className={buttonClass}
                                        onClick={() => {
                                            navActions[item.key]();
                                            onClose();
                                        }}
                                    >
                                        {item.hasAnnouncementBadge ? (
                                            <span className="flex items-center justify-between gap-2">
                                                <span className={navLabelClass}>
                                                    {item.renderIcon(navIconClass)}
                                                    <span>{item.label}</span>
                                                </span>
                                                {announcementUnreadCount > 0 ? (
                                                    <span
                                                        aria-label="未確認お知らせ件数"
                                                        className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-none bg-red-600 px-1.5 text-[10px] font-bold leading-none text-white"
                                                    >
                                                        {unreadBadgeText}
                                                    </span>
                                                ) : null}
                                            </span>
                                        ) : (
                                            <span className={navLabelClass}>
                                                {item.renderIcon(navIconClass)}
                                                <span>{item.label}</span>
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ))}
                <div className="mt-4 border-t border-gray-200 pt-4">
                    <button
                        type="button"
                        onClick={() => {
                            onRefreshDb?.();
                            onClose();
                        }}
                        disabled={!onRefreshDb || isBusy}
                        className={`${navButtonBase} border-gray-800 bg-white text-gray-700 disabled:cursor-not-allowed disabled:opacity-55`}
                        aria-label={isBusy ? "DB更新中..." : "DB最新化"}
                        title={
                            isBusy
                                ? "DB更新中..."
                                : "DB最新化（キャッシュ更新）"
                        }
                    >
                        <span className={navLabelClass}>
                            <ResetIcon className={navIconClass} />
                            <span>{isBusy ? "更新中..." : "DB最新化"}</span>
                        </span>
                    </button>
                </div>
            </aside>
        </>
    );
}
