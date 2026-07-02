import { buildRouteKey } from "../../lib/appRoute";
import {
    routeLabel,
    type BreadcrumbRoute,
} from "../../lib/routeNavigation";

type SearchDesktopHeaderProps = {
    onOpenHome: () => void;
    title: string;
    breadcrumbs: BreadcrumbRoute[];
    routeTitles: Record<string, string>;
    onNavigateBreadcrumb: (item: BreadcrumbRoute) => void;
};

export function SearchDesktopHeader({
    onOpenHome,
    title,
    breadcrumbs,
    routeTitles,
    onNavigateBreadcrumb,
}: SearchDesktopHeaderProps) {
    return (
        <header className="fixed inset-x-0 top-0 z-40 hidden h-12 items-center overflow-hidden border-b border-slate-200 bg-white md:flex">
            <div className="flex h-full items-center gap-3 px-4">
                <button
                    type="button"
                    onClick={onOpenHome}
                    className="inline-flex items-center gap-2"
                    title="トップへ戻る"
                    aria-label="トップへ戻る"
                >
                    <img
                        src="/Tomoko_logo.png"
                        alt="ToMoKo"
                        className="h-20 w-auto"
                    />
                </button>
            </div>
            <div className="flex min-w-0 flex-1 items-center border-l border-slate-200 px-4">
                {breadcrumbs.length > 0 ? (
                    <HeaderBreadcrumbs
                        breadcrumbs={breadcrumbs}
                        routeTitles={routeTitles}
                        onNavigateBreadcrumb={onNavigateBreadcrumb}
                    />
                ) : (
                    <p className="truncate text-sm font-medium text-slate-700">{title}</p>
                )}
            </div>
            <div className="shrink-0 px-4 text-xs text-slate-400">
                ハロプロセトリ検索システム
            </div>
        </header>
    );
}

function HeaderBreadcrumbs({
    breadcrumbs,
    routeTitles,
    onNavigateBreadcrumb,
}: {
    breadcrumbs: BreadcrumbRoute[];
    routeTitles: Record<string, string>;
    onNavigateBreadcrumb: (item: BreadcrumbRoute) => void;
}) {
    return (
        <nav aria-label="遷移履歴" className="hidden min-w-0 text-sm lg:block">
            <ol className="flex min-w-0 items-center gap-1.5">
                {breadcrumbs.map((item, index) => {
                    const label = routeLabel(item.route, routeTitles);
                    const key = `${buildRouteKey(item.route)}-${index}`;
                    return (
                        <li key={key} className="flex min-w-0 items-center gap-1.5">
                            {item.current ? (
                                <span
                                    title={label}
                                    className="block max-w-[220px] truncate font-semibold text-slate-900 xl:max-w-[320px]"
                                >
                                    {label}
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onNavigateBreadcrumb(item)}
                                    title={label}
                                    className="block max-w-[160px] truncate text-slate-500 hover:text-slate-900 xl:max-w-[240px]"
                                >
                                    {label}
                                </button>
                            )}
                            {index < breadcrumbs.length - 1 ? (
                                <span className="shrink-0 text-slate-300">&gt;</span>
                            ) : null}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
