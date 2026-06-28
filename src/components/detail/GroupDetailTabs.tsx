export type GroupDetailTabId = "members" | "timeline" | "artists" | "events";

export type GroupDetailTabItem = {
    id: GroupDetailTabId;
    label: string;
    count?: number;
};

type GroupDetailTabsProps = {
    tabs: GroupDetailTabItem[];
    activeTab: GroupDetailTabId;
    onChange: (tabId: GroupDetailTabId) => void;
};

export function GroupDetailTabs({ tabs, activeTab, onChange }: GroupDetailTabsProps) {
    if (tabs.length <= 1) return null;

    return (
        <nav
            aria-label="グループ詳細セクション"
            className="flex flex-wrap border-b-2 border-gray-800 bg-slate-50"
        >
            {tabs.map((tab) => {
                const active = tab.id === activeTab;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        aria-current={active ? "page" : undefined}
                        className={`min-w-0 flex-1 border-r border-gray-800 px-3 py-2.5 text-xs font-bold last:border-r-0 sm:flex-none sm:px-4 sm:text-sm ${
                            active
                                ? "bg-white text-slate-900 shadow-[inset_0_-2px_0_0_#dc2626]"
                                : "text-slate-600 hover:bg-white/70"
                        }`}
                    >
                        {tab.label}
                        {tab.count !== undefined ? (
                            <span className="ml-1 tabular-nums text-slate-500">({tab.count})</span>
                        ) : null}
                    </button>
                );
            })}
        </nav>
    );
}
