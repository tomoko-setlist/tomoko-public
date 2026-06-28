import type { RelatedEventStats } from "./relatedEventStatsModel";

export function RelatedEventStatsLine({
    stats,
}: {
    stats: RelatedEventStats;
}) {
    return (
        <div className="flex shrink-0 flex-wrap items-stretch gap-2 text-xs">
            <span className="inline-flex min-w-20 flex-col border-l-4 border-neutral-900 bg-neutral-50 px-2.5 py-1">
                <span className="text-[10px] font-semibold leading-none tracking-wide text-neutral-500">
                    EVENTS
                </span>
                <span className="mt-0.5 flex items-baseline gap-1 font-semibold text-neutral-700">
                    <strong className="font-mono text-base font-bold leading-none text-neutral-950">
                        {formatCount(stats.eventCount)}
                    </strong>
                    件
                </span>
            </span>
            <span className="inline-flex min-w-20 flex-col border-l-4 border-neutral-400 bg-neutral-50 px-2.5 py-1">
                <span className="text-[10px] font-semibold leading-none tracking-wide text-neutral-500">
                    STAGES
                </span>
                <span className="mt-0.5 flex items-baseline gap-1 font-semibold text-neutral-700">
                    <strong className="font-mono text-base font-bold leading-none text-neutral-950">
                        {formatCount(stats.stageCount)}
                    </strong>
                    件
                </span>
            </span>
        </div>
    );
}

function formatCount(value: number): string {
    return value.toLocaleString("ja-JP");
}
