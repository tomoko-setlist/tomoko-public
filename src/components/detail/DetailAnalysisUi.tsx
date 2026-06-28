import { DETAIL_ANALYSIS_COLORS } from "./DetailAnalysisPalette";

import type { ReactNode } from "react";

type DetailAnalysisPanelProps = {
    title?: string;
    eyebrow?: string;
    children: ReactNode;
    className?: string;
    right?: ReactNode;
};

export function DetailAnalysisPanel({
    title,
    eyebrow,
    children,
    className = "",
    right,
}: DetailAnalysisPanelProps) {
    return (
        <section
            className={`border border-gray-800 bg-white p-2.5 shadow-[2px_2px_0px_0px_rgba(31,41,55,0.55)] ${className}`.trim()}
        >
            {title || eyebrow || right ? (
                <div className="mb-2 flex items-start justify-between gap-3 border-b border-dashed border-slate-300 pb-1.5">
                    <div className="min-w-0">
                        {eyebrow ? (
                            <p className="text-[9px] font-bold tracking-[0.14em] text-slate-500">
                                {eyebrow}
                            </p>
                        ) : null}
                        {title ? (
                            <h3 className="text-sm font-bold leading-tight text-slate-950">{title}</h3>
                        ) : null}
                    </div>
                    {right ? <div className="shrink-0">{right}</div> : null}
                </div>
            ) : null}
            <div>{children}</div>
        </section>
    );
}

type DetailMetricGridProps = {
    children: ReactNode;
    className?: string;
};

export function DetailMetricGrid({ children, className = "" }: DetailMetricGridProps) {
    return (
        <div className={`grid grid-cols-2 border-l border-t border-slate-300 ${className}`.trim()}>
            {children}
        </div>
    );
}

type DetailMetricItemProps = {
    label: string;
    value: ReactNode;
    rankText?: ReactNode;
    rankClassName?: string;
    accentColor?: string;
};

export function DetailMetricItem({
    label,
    value,
    rankText,
    rankClassName = "text-[10px] font-semibold text-slate-500",
    accentColor = DETAIL_ANALYSIS_COLORS[0],
}: DetailMetricItemProps) {
    return (
        <div className="relative min-w-0 border-b border-r border-slate-300 bg-[radial-gradient(#e2e8f0_0.75px,transparent_0.75px)] bg-[length:6px_6px] px-2.5 py-2">
            <span
                className="mb-1 block h-1.5 w-5"
                style={{ backgroundColor: accentColor }}
                aria-hidden="true"
            />
            <p className="truncate text-[10px] font-bold text-slate-500">{label}</p>
            <p className="mt-0.5 text-lg font-black leading-none text-slate-950 tabular-nums">{value}</p>
            {rankText !== undefined ? <p className={`mt-1 ${rankClassName}`}>{rankText}</p> : null}
        </div>
    );
}

type DetailInlineBarListProps = {
    rows: Array<[string, number]>;
    maxItems?: number;
};

export function DetailInlineBarList({ rows, maxItems = 8 }: DetailInlineBarListProps) {
    if (rows.length === 0) {
        return <p className="text-xs text-slate-500">データがありません。</p>;
    }

    const visibleRows = rows.slice(0, maxItems);
    const maxCount = Math.max(...visibleRows.map(([, count]) => count), 1);

    return (
        <div className="space-y-1.5">
            {visibleRows.map(([label, count], index) => {
                const width = `${Math.max(4, Math.round((count / maxCount) * 100))}%`;
                const color = DETAIL_ANALYSIS_COLORS[index % DETAIL_ANALYSIS_COLORS.length];
                return (
                    <div key={label} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2 text-xs">
                        <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-1.5">
                                <span className="h-2 w-2 shrink-0" style={{ backgroundColor: color }} />
                                <span className="truncate font-semibold text-slate-700">{label}</span>
                            </div>
                            <div className="h-2 border border-slate-300 bg-white">
                                <div
                                    className="h-full"
                                    style={{ width, backgroundColor: color }}
                                    aria-hidden="true"
                                />
                            </div>
                        </div>
                        <span className="text-right text-sm font-black tabular-nums text-slate-950">
                            {count}
                        </span>
                    </div>
                );
            })}
            {rows.length > visibleRows.length ? (
                <p className="text-[10px] font-semibold text-slate-400">
                    ほか {rows.length - visibleRows.length} 件
                </p>
            ) : null}
        </div>
    );
}
