import { DETAIL_ANALYSIS_COLORS } from "./DetailAnalysisPalette";

type DetailTagBarChartProps = {
    rows: Array<[string, number]>;
    totalKinds: number;
    title?: string;
    className?: string;
    maxItems?: number;
};

export function DetailTagBarChart({
    rows,
    totalKinds,
    title = "イベントタグ別回数",
    className = "",
    maxItems = 5,
}: DetailTagBarChartProps) {
    if (rows.length === 0) {
        return <p className="text-xs text-slate-500">イベントタグ情報がありません。</p>;
    }

    const topRows = rows.slice(0, Math.max(1, maxItems));
    const otherRows = rows.slice(Math.max(1, maxItems));
    const maxCount = Math.max(...topRows.map(([, count]) => count), 1);

    return (
        <div
            className={`border border-gray-800 bg-white p-2.5 shadow-[2px_2px_0px_0px_rgba(31,41,55,0.55)] ${className}`.trim()}
        >
            <div className="mb-2 flex items-start justify-between gap-2 border-b border-dashed border-slate-300 pb-1.5">
                <div>
                    <p className="text-[9px] font-bold tracking-[0.14em] text-slate-500">TAG MIX</p>
                    <h3 className="text-sm font-bold leading-tight text-slate-950">{title}</h3>
                </div>
                <span className="shrink-0 border border-gray-800 bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {totalKinds}種類
                </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-1.5">
                    {topRows.map(([tag, count], index) => {
                        const width = `${Math.max(4, Math.round((count / maxCount) * 100))}%`;
                        const color = DETAIL_ANALYSIS_COLORS[index % DETAIL_ANALYSIS_COLORS.length];
                        return (
                            <div key={tag} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2 text-xs">
                                <div className="min-w-0">
                                    <div className="mb-1 flex items-center gap-2">
                                        <span
                                            className="h-2 w-2 shrink-0"
                                            style={{ backgroundColor: color }}
                                        />
                                        <span className="truncate font-semibold text-slate-700" title={tag}>
                                            {tag}
                                        </span>
                                    </div>
                                    <div className="h-2 border border-slate-300 bg-white">
                                        <div
                                            className="h-full"
                                            style={{ width, backgroundColor: color }}
                                            title={`${tag}: ${count}`}
                                        />
                                    </div>
                                </div>
                                <span className="text-right text-sm font-black tabular-nums text-slate-950">
                                    {count}
                                </span>
                            </div>
                        );
                    })}
                </div>
                <div className="border-t border-dashed border-slate-300 pt-2 md:border-l md:border-t-0 md:pl-3 md:pt-0">
                    <p className="mb-1.5 text-[10px] font-bold tracking-[0.12em] text-slate-500">OTHER</p>
                    {otherRows.length === 0 ? (
                        <p className="text-[10px] text-slate-500">なし</p>
                    ) : (
                        <div className="max-h-28 space-y-1 overflow-auto pr-1">
                            {otherRows.map(([tag, count], index) => (
                                <div key={`other-${tag}`} className="flex items-center justify-between gap-2 text-[10px]">
                                    <span className="truncate font-semibold text-slate-600" title={tag}>
                                        <span
                                            className="mr-1 inline-block h-1.5 w-1.5 align-middle"
                                            style={{
                                                backgroundColor:
                                                    DETAIL_ANALYSIS_COLORS[
                                                        (topRows.length + index) % DETAIL_ANALYSIS_COLORS.length
                                                    ],
                                            }}
                                        />
                                        {tag}
                                    </span>
                                    <span className="shrink-0 font-black tabular-nums text-slate-900">{count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
