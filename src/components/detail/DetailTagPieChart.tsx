type DetailTagPieChartProps = {
    rows: Array<[string, number]>;
    totalKinds: number;
    title?: string;
    className?: string;
};

const TAG_PIE_COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#F43F5E",
    "#8B5CF6",
    "#06B6D4",
    "#84CC16",
    "#D946EF",
    "#F97316",
    "#14B8A6",
];

export function DetailTagPieChart({
    rows,
    totalKinds,
    title = "イベントタグ別回数",
    className = "",
}: DetailTagPieChartProps) {
    if (rows.length === 0) {
        return <p className="text-xs text-slate-500">イベントタグ情報がありません。</p>;
    }

    const total = rows.reduce((sum, [, count]) => sum + count, 0);
    const radius = 62;
    const center = 70;
    const viewBoxSize = 140;
    const donutRadius = 37;
    const toPoint = (angle: number) => {
        const rad = (angle * Math.PI) / 180;
        return {
            x: center + radius * Math.cos(rad),
            y: center + radius * Math.sin(rad),
        };
    };
    const slices = rows
        .reduce(
            (acc, [tag, count], index) => {
                const sweep = total > 0 ? (count / total) * 360 : 0;
                const startAngle = acc.currentAngle;
                const endAngle = startAngle + sweep;
                const start = toPoint(startAngle);
                const end = toPoint(endAngle);
                const largeArcFlag = sweep > 180 ? 1 : 0;
                const path = `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
                return {
                    currentAngle: endAngle,
                    items: [
                        ...acc.items,
                        {
                            key: tag,
                            fill: TAG_PIE_COLORS[index % TAG_PIE_COLORS.length],
                            path,
                        },
                    ],
                };
            },
            {
                currentAngle: -90,
                items: [] as Array<{ key: string; fill: string; path: string }>,
            },
        )
        .items;

    return (
        <div className={`border-2 border-gray-800 bg-slate-50 p-2 ${className}`.trim()}>
            <h3 className="mb-1 text-xs font-semibold text-slate-900">{title}</h3>
            <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-2">
                <div className="ml-1 w-[140px]">
                    <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="h-auto w-full">
                        {slices.map((slice) => (
                            <path
                                key={slice.key}
                                d={slice.path}
                                fill={slice.fill}
                                stroke="white"
                                strokeWidth={1}
                            />
                        ))}
                        <circle cx={center} cy={center} r={donutRadius} fill="white" />
                        <text
                            x={center}
                            y={center - 6}
                            textAnchor="middle"
                            className="fill-slate-500 text-[9px]"
                        >
                            タグ種類
                        </text>
                        <text
                            x={center}
                            y={center + 8}
                            textAnchor="middle"
                            className="fill-slate-900 text-[13px] font-semibold"
                        >
                            {totalKinds}
                        </text>
                    </svg>
                </div>
                <div className="ml-1 space-y-0.5">
                    {rows.map(([tag, count], index) => (
                        <div
                            key={tag}
                            className="grid grid-cols-[auto_minmax(0,1fr)_max-content] items-center gap-1 text-xs"
                        >
                            <span
                                className="inline-block h-2 w-2"
                                style={{
                                    backgroundColor:
                                        TAG_PIE_COLORS[index % TAG_PIE_COLORS.length],
                                }}
                            />
                            <span className="truncate">{tag}</span>
                            <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
                                <span className="text-slate-600">
                                    {total > 0 ? `${Math.round((count / total) * 100)}%` : "0%"}
                                </span>
                                <span className="font-semibold">{count}</span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
