import type { ReleaseDbChange } from "../../lib/setlistSearchDb/types";

const ENTITY_LABELS: Record<string, string> = {
    events: "イベント",
    stages: "ステージ",
    setlists: "セトリ",
    songs: "楽曲",
    persons: "メンバー",
    artists: "アーティスト",
    groups: "グループ",
    venues: "会場",
    albums: "アルバム",
    song_versions: "楽曲バージョン",
    event_performers: "出演者",
    stage_performers: "ステージ出演者",
    setlist_entry_performers: "セトリ出演者",
    creators: "クリエイター",
    group_memberships: "グループ所属",
    member_colors: "メンバーカラー",
    event_tags: "イベントタグ",
    prefectures: "都道府県",
    group_aliases: "グループ別名",
    search_aliases: "検索エイリアス",
    venue_name_histories: "会場名履歴",
    group_roles: "グループ役職",
    member_profiles: "メンバープロフィール",
    album_tracks: "アルバムトラック",
};

type ReleaseDbChangeSummaryProps = {
    changes: ReleaseDbChange[];
    variant?: "full" | "compact";
};

type CoverageMetric = {
    key: "events" | "stages";
    label: string;
    total: ReleaseDbChange;
    covered: ReleaseDbChange;
};

const COVERAGE_PAIRS = [
    {
        key: "events" as const,
        label: "イベント",
        coveredEntity: "events_with_setlists",
    },
    {
        key: "stages" as const,
        label: "ステージ",
        coveredEntity: "stages_with_setlists",
    },
];

const COVERAGE_ENTITIES = new Set(
    COVERAGE_PAIRS.map((pair) => pair.coveredEntity),
);

export function ReleaseDbChangeSummary({
    changes,
    variant = "full",
}: ReleaseDbChangeSummaryProps) {
    const metrics = buildCoverageMetrics(changes);
    const rows = buildChangeRows(changes);

    if (metrics.length === 0 && rows.length === 0) return null;

    if (variant === "compact") {
        return (
            <div className="mt-3 space-y-2">
                {metrics.length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-2">
                        {metrics.map((metric) => (
                            <CompactCoverageCard
                                key={metric.key}
                                metric={metric}
                            />
                        ))}
                    </div>
                ) : null}
                {rows.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {rows.map((row) => (
                            <span
                                key={row.entity}
                                className="inline-flex items-center gap-1 border border-neutral-300 bg-white px-2 py-1 text-[11px] text-neutral-700"
                            >
                                <span>{row.label}</span>
                                <span className="font-mono font-semibold text-neutral-950">
                                    {formatNullableCount(row.afterCount)}
                                </span>
                                <DeltaText value={row.delta} />
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {metrics.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                    {metrics.map((metric) => (
                        <CoverageCard key={metric.key} metric={metric} />
                    ))}
                </div>
            ) : null}
            {rows.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map((row) => (
                        <ChangeCard
                            key={row.entity}
                            label={row.label}
                            beforeCount={row.beforeCount}
                            afterCount={row.afterCount}
                            delta={row.delta}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function buildCoverageMetrics(changes: ReleaseDbChange[]): CoverageMetric[] {
    const byEntity = new Map(changes.map((change) => [change.entity, change]));
    return COVERAGE_PAIRS.flatMap((pair) => {
        const total = byEntity.get(pair.key);
        const covered = byEntity.get(pair.coveredEntity);
        if (!total || !covered) return [];
        return [{ key: pair.key, label: pair.label, total, covered }];
    });
}

function buildChangeRows(changes: ReleaseDbChange[]) {
    return changes
        .filter((change) => !COVERAGE_ENTITIES.has(change.entity))
        .map((change) => ({
            ...change,
            label: ENTITY_LABELS[change.entity] ?? change.entity,
        }));
}

function CoverageCard({ metric }: { metric: CoverageMetric }) {
    const beforePct = percent(metric.covered.beforeCount, metric.total.beforeCount);
    const afterPct = percent(metric.covered.afterCount, metric.total.afterCount);

    return (
        <section className="border border-neutral-300 bg-neutral-50 p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold tracking-wide text-neutral-500">
                        SETLIST RATE
                    </p>
                    <h3 className="text-sm font-bold text-neutral-950">
                        {metric.label}のセトリ登録率
                    </h3>
                </div>
                <div className="text-right">
                    <p className="font-mono text-2xl font-bold leading-none text-neutral-950">
                        {formatPercent(afterPct)}
                    </p>
                    <DeltaText value={metric.covered.delta} />
                </div>
            </div>
            <CoverageBar value={afterPct} />
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <CoveragePoint
                    label="更新前"
                    covered={metric.covered.beforeCount}
                    total={metric.total.beforeCount}
                    percentValue={beforePct}
                />
                <CoveragePoint
                    label="更新後"
                    covered={metric.covered.afterCount}
                    total={metric.total.afterCount}
                    percentValue={afterPct}
                />
            </div>
        </section>
    );
}

function CompactCoverageCard({ metric }: { metric: CoverageMetric }) {
    const afterPct = percent(metric.covered.afterCount, metric.total.afterCount);
    return (
        <div className="border-l-4 border-neutral-900 bg-neutral-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-neutral-600">
                    {metric.label}のセトリ登録率
                </span>
                <span className="font-mono text-sm font-bold text-neutral-950">
                    {formatPercent(afterPct)}
                </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-neutral-600">
                <span>
                    {formatNullableCount(metric.covered.afterCount)} /{" "}
                    {formatNullableCount(metric.total.afterCount)}
                </span>
                <DeltaText value={metric.covered.delta} />
            </div>
            <CoverageBar value={afterPct} compact />
        </div>
    );
}

function ChangeCard({
    label,
    beforeCount,
    afterCount,
    delta,
}: {
    label: string;
    beforeCount: number | null;
    afterCount: number | null;
    delta: number | null;
}) {
    return (
        <section className="border border-neutral-300 bg-white px-3 py-2">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-neutral-900">
                        {label}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                        更新前 {formatNullableCount(beforeCount)}
                    </p>
                </div>
                <DeltaText value={delta} />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold leading-none text-neutral-950">
                {formatNullableCount(afterCount)}
            </p>
        </section>
    );
}

function CoveragePoint({
    label,
    covered,
    total,
    percentValue,
}: {
    label: string;
    covered: number | null;
    total: number | null;
    percentValue: number | null;
}) {
    return (
        <div className="border border-neutral-200 bg-white px-2 py-1.5">
            <p className="text-[10px] font-semibold text-neutral-500">{label}</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-neutral-950">
                {formatPercent(percentValue)}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-600">
                {formatNullableCount(covered)} / {formatNullableCount(total)}
            </p>
        </div>
    );
}

function CoverageBar({
    value,
    compact = false,
}: {
    value: number | null;
    compact?: boolean;
}) {
    const width = value === null ? 0 : Math.max(0, Math.min(100, value));
    return (
        <div
            className={`${compact ? "mt-1 h-1" : "mt-3 h-1.5"} w-full bg-neutral-200`}
            aria-hidden="true"
        >
            <div
                className="h-full bg-neutral-950"
                style={{ width: `${width}%` }}
            />
        </div>
    );
}

function DeltaText({ value }: { value: number | null }) {
    const text = formatDelta(value);
    const color =
        value === null || value === 0
            ? "text-neutral-500"
            : value > 0
              ? "text-emerald-700"
              : "text-red-600";
    return (
        <span className={`font-mono text-xs font-bold ${color}`}>{text}</span>
    );
}

function percent(part: number | null, total: number | null): number | null {
    if (part === null || total === null || total <= 0) return null;
    return (part / total) * 100;
}

function formatPercent(value: number | null): string {
    if (value === null) return "-";
    return `${value.toFixed(1)}%`;
}

function formatNullableCount(value: number | null): string {
    return value === null ? "-" : value.toLocaleString("ja-JP");
}

function formatDelta(value: number | null): string {
    if (value === null) return "-";
    if (value > 0) return `+${value.toLocaleString("ja-JP")}`;
    if (value < 0) return value.toLocaleString("ja-JP");
    return "±0";
}
