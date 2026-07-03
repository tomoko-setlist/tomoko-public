import { useEffect, useMemo, useRef, useState } from "react";

import {
    DetailErrorState,
    DetailLoadingState,
    DetailPanel,
} from "./DetailUi";
import { ReleaseDbChangeSummary } from "./ReleaseDbChangeSummary";
import { listLatestPublishedArticles, renderArticleTags } from "../../content/articles";
import { formatDateYmd } from "../../lib/uiFormat";
import { EVENT_TAG_CHIP_CLASS } from "../ui/eventTagClass";

import type { DashboardData, SetlistSearchDb } from "../../lib/setlistSearchDb/types";

type DashboardPageProps = {
    db: SetlistSearchDb;
    onResolveTitle?: (title: string) => void;
    onOpenRelease: (releaseId: number) => void;
    onOpenArticles: () => void;
    onOpenArticle: (slug: string) => void;
};

const STAT_CARD_CLASS =
    "border border-neutral-300 bg-white px-3 py-3";

const formatCount = (value: number): string => value.toLocaleString("ja-JP");

const CHART_ENTITIES = [
    { key: "setlists", label: "セトリ", color: "#ef3f35" },
] as const;

const COVERAGE_CHART = [
    { key: "events_with_setlists", totalKey: "events", label: "イベント登録率", color: "#404040" },
    { key: "stages_with_setlists", totalKey: "stages", label: "ステージ登録率", color: "#8a8a8a" },
] as const;

type DataPoint = { date: string; label: string; releaseId: number; values: Record<string, number> };

const buildChartData = (data: DashboardData): DataPoint[] => {
    const releasesAsc = [...data.releases].reverse();
    const points: DataPoint[] = [];
    const currentValues: Record<string, number> = {};

    for (const release of releasesAsc) {
        for (const change of release.changes) {
            if (change.afterCount !== null && change.afterCount !== undefined) {
                currentValues[change.entity] = change.afterCount;
            }
        }
        const values: Record<string, number> = { ...currentValues };
        points.push({
            date: release.releasedAt,
            label: release.title,
            releaseId: release.releaseId,
            values,
        });
    }

    return points;
};

const SVG_W = 600;
const SVG_H = 200;
const SVG_PAD = { top: 18, right: 62, bottom: 42, left: 70 };
const PLOT_W = SVG_W - SVG_PAD.left - SVG_PAD.right;
const PLOT_H = SVG_H - SVG_PAD.top - SVG_PAD.bottom;

export function DashboardPage({ db, onResolveTitle, onOpenRelease, onOpenArticles, onOpenArticle }: DashboardPageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [data, setData] = useState<DashboardData | null>(null);
    const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
    const chartRef = useRef<HTMLDivElement>(null);

    const handlePointerMove = (e: React.PointerEvent, text: string) => {
        const rect = chartRef.current?.getBoundingClientRect();
        if (!rect) return;
        setTip({ text, x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    useEffect(() => {
        onResolveTitle?.("更新情報");
    }, [onResolveTitle]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError("");
            try {
                if (!db.getDashboardData) {
                    throw new Error("ダッシュボード機能はこのデータ版に含まれていません。");
                }
                const result = await db.getDashboardData();
                if (!cancelled) {
                    setData(result);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db]);

    const chartPoints = useMemo(() => (data ? buildChartData(data) : []), [data]);

    if (loading) return <DetailLoadingState />;
    if (error) return <DetailErrorState message={error} />;
    if (!data) return <DetailErrorState message="データが取得できませんでした。" />;

    const { stats, releases } = data;
    const latestArticles = listLatestPublishedArticles(3);
    const latestPoint = chartPoints.at(-1);
    const eventSetlistRate = latestPoint?.values.events_with_setlists
        ? (latestPoint.values.events_with_setlists / Math.max(stats.totalEvents, 1)) * 100
        : null;
    const stageSetlistRate = latestPoint?.values.stages_with_setlists
        ? (latestPoint.values.stages_with_setlists / Math.max(stats.totalStages, 1)) * 100
        : null;
    const summaryStats = [
        { key: "events", shortLabel: "イベント", value: stats.totalEvents, subText: eventSetlistRate !== null ? `セトリ ${eventSetlistRate.toFixed(1)}%` : null },
        { key: "stages", shortLabel: "ステージ", value: stats.totalStages, subText: stageSetlistRate !== null ? `セトリ ${stageSetlistRate.toFixed(1)}%` : null },
        { key: "setlists", shortLabel: "セトリ", value: stats.totalSetlists, subText: null },
        { key: "songs", shortLabel: "楽曲", value: stats.totalSongs, subText: null },
        { key: "members", shortLabel: "メンバー", value: stats.totalMembers, subText: null },
    ];

    const yMin =
        chartPoints.length > 0
            ? Math.min(
                  ...chartPoints.map((p) =>
                      Math.min(...CHART_ENTITIES.map((e) => p.values[e.key])),
                  ),
              )
            : 0;

    const yMax =
        chartPoints.length > 0
            ? Math.max(
                  ...chartPoints.map((p) =>
                      Math.max(...CHART_ENTITIES.map((e) => p.values[e.key])),
                  ),
              )
            : 1;

    // Nice round step: pick a step that gives 4-6 ticks
    const yRange = yMax - yMin;
    const rawStep = yRange <= 0 ? 1 : yRange / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    const niceStep = norm >= 7 ? mag * 10 : norm >= 3 ? mag * 5 : norm >= 1.5 ? mag * 2 : mag;
    const niceYMin = Math.floor(yMin / niceStep) * niceStep;
    const niceYMax = Math.ceil(yMax / niceStep) * niceStep;

    const plotYMin = niceYMin;
    const plotYMax = niceYMax;

    const xScale = (index: number): number =>
        chartPoints.length <= 1
            ? SVG_PAD.left + PLOT_W / 2
            : SVG_PAD.left + (index / (chartPoints.length - 1)) * PLOT_W;

    const yScale = (value: number): number =>
        SVG_PAD.top + PLOT_H - ((value - plotYMin) / Math.max(plotYMax - plotYMin, 1)) * PLOT_H;

    const yTicks = (): number[] => {
        const ticks: number[] = [];
        for (let v = niceYMin; v <= niceYMax + niceStep * 0.5; v += niceStep) {
            ticks.push(v);
        }
        return ticks;
    };

    const xLabelIndexes = (): number[] => {
        if (chartPoints.length <= 1) return chartPoints.map((_, index) => index);
        const minGap = 96;
        const indexes: number[] = [];
        for (let i = 0; i < chartPoints.length; i += 1) {
            const currentX = xScale(i);
            const lastIndex = indexes[indexes.length - 1];
            const lastX = lastIndex === undefined ? -Infinity : xScale(lastIndex);
            if (i === chartPoints.length - 1 && currentX - lastX < minGap) {
                indexes.pop();
                indexes.push(i);
            } else if (indexes.length === 0 || currentX - lastX >= minGap) {
                indexes.push(i);
            }
        }
        return indexes;
    };

    const linePath = (points: Array<[number, number]>): string =>
        points
            .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
            .join(" ");

    const areaPath = (points: Array<[number, number]>, baseline: number): string => {
        if (points.length === 0) return "";
        const line = linePath(points);
        const last = points[points.length - 1];
        const first = points[0];
        return `${line} L ${last[0].toFixed(2)} ${baseline.toFixed(2)} L ${first[0].toFixed(2)} ${baseline.toFixed(2)} Z`;
    };

    const formatTipDate = (value: string): string => formatDateYmd(value);

    return (
        <div className="flex flex-col gap-3 md:gap-4">
            <DetailPanel className="order-1 p-3 md:p-4">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                            UPDATES
                        </p>
                        <h1 className="text-lg font-bold text-slate-900">更新情報</h1>
                        <p className="mt-1 hidden text-xs text-slate-600 sm:block">
                            登録データ、記事、お知らせ・更新履歴
                        </p>
                    </div>
                </div>
            </DetailPanel>

            <DetailPanel className="order-2 p-3 md:p-4">
                <div className="mb-2 flex items-end justify-between gap-2 md:mb-3">
                    <div>
                        <h2 className="text-base font-bold text-neutral-950">登録データ</h2>
                        <p className="mt-0.5 hidden text-xs text-neutral-500 sm:block">
                            現在公開中の主要データ件数
                        </p>
                    </div>
                    {latestPoint ? (
                        <p className="shrink-0 text-[11px] text-neutral-500 sm:text-xs">
                            最終更新: {formatDateYmd(latestPoint.date)}
                        </p>
                    ) : null}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:hidden">
                    {summaryStats.map((item) => (
                        <div key={item.key} className="min-w-0 border-b border-neutral-200 pb-1">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-[11px] font-semibold text-neutral-500">
                                    {item.shortLabel}
                                </span>
                                <span className="font-mono text-base font-bold leading-none text-neutral-950">
                                    {formatCount(item.value)}
                                </span>
                            </div>
                            {item.subText ? (
                                <p className="mt-0.5 text-right text-[10px] leading-none text-neutral-500">
                                    {item.subText}
                                </p>
                            ) : null}
                        </div>
                    ))}
                </div>
                <div className="hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-5">
                    <div className={STAT_CARD_CLASS}>
                        <span className="text-[11px] font-semibold tracking-wide text-neutral-500">EVENTS</span>
                        <span className="mt-1 block font-mono text-2xl font-bold leading-none text-neutral-950">
                            {formatCount(stats.totalEvents)}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-neutral-700">イベント</span>
                        {eventSetlistRate !== null ? (
                            <span className="mt-1 block text-[11px] text-neutral-500">
                                セトリ登録 {eventSetlistRate.toFixed(1)}%
                            </span>
                        ) : null}
                    </div>
                    <div className={STAT_CARD_CLASS}>
                        <span className="text-[11px] font-semibold tracking-wide text-neutral-500">STAGES</span>
                        <span className="mt-1 block font-mono text-2xl font-bold leading-none text-neutral-950">
                            {formatCount(stats.totalStages)}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-neutral-700">ステージ</span>
                        {stageSetlistRate !== null ? (
                            <span className="mt-1 block text-[11px] text-neutral-500">
                                セトリ登録 {stageSetlistRate.toFixed(1)}%
                            </span>
                        ) : null}
                    </div>
                    <div className={STAT_CARD_CLASS}>
                        <span className="text-[11px] font-semibold tracking-wide text-neutral-500">SETLISTS</span>
                        <span className="mt-1 block font-mono text-2xl font-bold leading-none text-neutral-950">
                            {formatCount(stats.totalSetlists)}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-neutral-700">セトリ</span>
                    </div>
                    <div className={STAT_CARD_CLASS}>
                        <span className="text-[11px] font-semibold tracking-wide text-neutral-500">SONGS</span>
                        <span className="mt-1 block font-mono text-2xl font-bold leading-none text-neutral-950">
                            {formatCount(stats.totalSongs)}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-neutral-700">楽曲</span>
                    </div>
                    <div className={STAT_CARD_CLASS}>
                        <span className="text-[11px] font-semibold tracking-wide text-neutral-500">MEMBERS</span>
                        <span className="mt-1 block font-mono text-2xl font-bold leading-none text-neutral-950">
                            {formatCount(stats.totalMembers)}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-neutral-700">メンバー</span>
                    </div>
                </div>
            </DetailPanel>

            {chartPoints.length >= 2 ? (() => {
                // Coverage % data points
                const covPoints = chartPoints.map((p) => ({
                    ...p,
                    covValues: Object.fromEntries(COVERAGE_CHART.map((e) => [
                        e.key,
                        p.values[e.totalKey] > 0 ? (p.values[e.key] / p.values[e.totalKey]) * 100 : 0,
                    ])),
                }));

                // Right Y-axis: coverage %
                const covMin = Math.min(...covPoints.map((p) => Math.min(...COVERAGE_CHART.map((e) => p.covValues[e.key]))));
                const covMax = Math.max(...covPoints.map((p) => Math.max(...COVERAGE_CHART.map((e) => p.covValues[e.key]))));
                const covRange = covMax - covMin;
                const covRawStep = covRange <= 0 ? 1 : covRange / 5;
                const covMag = Math.pow(10, Math.floor(Math.log10(covRawStep)));
                const covNorm = covRawStep / covMag;
                const covNiceStep = covNorm >= 7 ? covMag * 10 : covNorm >= 3 ? covMag * 5 : covNorm >= 1.5 ? covMag * 2 : covMag;
                const covYMinRaw = Math.floor(covMin / covNiceStep) * covNiceStep;
                const covYMin = Math.min(covYMinRaw, 30);
                const covYMax = Math.ceil(covMax / covNiceStep) * covNiceStep;
                const cyCov = (v: number) => SVG_PAD.top + PLOT_H - ((v - covYMin) / Math.max(covYMax - covYMin, 1)) * PLOT_H;

                // Right axis label
                const RIGHT_X = SVG_W - SVG_PAD.right;

                return (
                <DetailPanel className="order-3 hidden p-4 md:block">
                    <div ref={chartRef} className="relative">
                    <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h2 className="text-base font-bold text-neutral-950">データ推移</h2>
                            <p className="mt-0.5 text-xs text-neutral-500">
                                セトリ件数と、イベント/ステージのセトリ登録率
                            </p>
                        </div>
                    </div>
                    {tip ? (
                        <div className="absolute z-10 pointer-events-none bg-gray-800 text-white text-xs px-2 py-1 rounded shadow whitespace-nowrap" style={{ left: tip.x + 10, top: tip.y - 24 }}>
                            {tip.text}
                        </div>
                    ) : null}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                        {[...CHART_ENTITIES.map(e => ({ ...e, axis: "件数" })), ...COVERAGE_CHART.map(e => ({ label: e.label, color: e.color, axis: "%" }))].map((item) => (
                            <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                                <span className="inline-block h-2 w-2 shrink-0 rounded-full border-[1.5px]" style={{ borderColor: item.color }} />
                                {item.label} <span className="text-neutral-400">({item.axis})</span>
                            </span>
                        ))}
                    </div>
                    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" role="img" aria-label="データ推移グラフ">
                        {/* Left Y-axis (setlists count) */}
                        {yTicks().map((tick) => (
                            <g key={`yl-${tick}`}>
                                <line x1={SVG_PAD.left} y1={yScale(tick)} x2={RIGHT_X} y2={yScale(tick)} stroke="#e5e5e5" strokeWidth="0.35" />
                                <text x={SVG_PAD.left - 12} y={yScale(tick) + 4} textAnchor="end" className="text-[9px]" fill="#a3a3a3">{tick.toLocaleString("ja-JP")}</text>
                            </g>
                        ))}

                        {/* Right Y-axis (coverage %) */}
                        <defs>
                            <linearGradient id="setlistTrendFill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#ef3f35" stopOpacity="0.12" />
                                <stop offset="100%" stopColor="#ef3f35" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {(() => {
                            const ticks: number[] = [];
                            for (let v = covYMin; v <= covYMax + covNiceStep * 0.5; v += covNiceStep) ticks.push(v);
                            return ticks.map((t) => (
                                <g key={`yr-${t}`}>
                                    <line x1={SVG_PAD.left} y1={cyCov(t)} x2={RIGHT_X} y2={cyCov(t)} stroke="#eeeeee" strokeWidth="0.3" strokeDasharray="2,3" />
                                    <text x={RIGHT_X + 10} y={cyCov(t) + 4} textAnchor="start" className="text-[9px]" fill="#a3a3a3">{t.toFixed(0)}%</text>
                                </g>
                            ));
                        })()}

                        {/* X axis */}
                        <line x1={SVG_PAD.left} y1={yScale(plotYMin)} x2={RIGHT_X} y2={yScale(plotYMin)} stroke="#a3a3a3" strokeWidth="0.4" />

                        {/* Setlists line (left scale) */}
                        {CHART_ENTITIES.map((entity) => {
                            const points = chartPoints.map((p, i): [number, number] => [
                                xScale(i),
                                yScale(p.values[entity.key]),
                            ]);
                            return (
                                <g key={entity.key}>
                                    <path d={areaPath(points, yScale(plotYMin))} fill="url(#setlistTrendFill)" />
                                    <path d={linePath(points)} fill="none" stroke={entity.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
                                    {chartPoints.map((p, i) => (<circle key={i} cx={xScale(i)} cy={yScale(p.values[entity.key])} r="2.4" fill={entity.color} stroke="white" strokeWidth="1.2" style={{ cursor: "pointer" }} onPointerMove={(e) => handlePointerMove(e, `${formatTipDate(p.date)} / ${entity.label}: ${formatCount(p.values[entity.key])}`)} onPointerLeave={() => setTip(null)} />))}
                                </g>
                            );
                        })}

                        {/* Coverage lines (right scale) */}
                        {COVERAGE_CHART.map((e) => {
                            const points = covPoints.map((p, i): [number, number] => [
                                xScale(i),
                                cyCov(p.covValues[e.key]),
                            ]);
                            return (
                                <g key={e.key}>
                                    <path d={linePath(points)} fill="none" stroke={e.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5,4" />
                                    {covPoints.map((p, i) => (<circle key={i} cx={xScale(i)} cy={cyCov(p.covValues[e.key])} r="2.4" fill="white" stroke={e.color} strokeWidth="1.4" style={{ cursor: "pointer" }} onPointerMove={(ev) => handlePointerMove(ev, `${formatTipDate(p.date)} / ${e.label}: ${p.covValues[e.key].toFixed(1)}%`)} onPointerLeave={() => setTip(null)} />))}
                                </g>
                            );
                        })}

                        {/* X axis labels */}
                        {(() => {
                            const visibleIndexes = new Set(xLabelIndexes());
                            return chartPoints.map((p, i) => {
                                if (!visibleIndexes.has(i)) return null;
                                return (<text key={`xl-${i}`} x={xScale(i)} y={yScale(plotYMin) + 24} textAnchor={i === 0 ? "start" : i === chartPoints.length - 1 ? "end" : "middle"} className="text-[9px]" fill="#94a3b8">{p.date.slice(0, 7)}</text>);
                            });
                        })()}
                    </svg>
                    </div>
                </DetailPanel>
                );
            })() : null}

            {latestArticles.length > 0 ? (
                <DetailPanel className="order-5 p-4 md:order-4">
                    <div className="mb-3 flex items-end justify-between gap-2">
                        <div>
                            <h2 className="text-base font-bold text-neutral-950">最新記事</h2>
                        </div>
                        <button
                            type="button"
                            onClick={onOpenArticles}
                            className="shrink-0 text-xs font-semibold text-blue-700 hover:underline"
                        >
                            記事一覧
                        </button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3">
                        {latestArticles.map((article) => (
                            <article
                                key={article.slug}
                                className="border border-neutral-300 bg-white p-4 shadow-[2px_2px_0_rgba(23,23,23,0.16)]"
                            >
                                <p className="text-[11px] font-semibold tracking-wide text-neutral-500">
                                    {formatDateYmd(article.publishedAt)}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => onOpenArticle(article.slug)}
                                    className="mt-1 text-left text-base font-bold leading-snug text-blue-700 hover:underline"
                                >
                                    {article.title}
                                </button>
                                <p className="mt-2 text-sm leading-6 text-neutral-700 line-clamp-3">
                                    {article.summary}
                                </p>
                                {article.tags.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {renderArticleTags(article)}
                                    </div>
                                ) : null}
                            </article>
                        ))}
                    </div>
                </DetailPanel>
            ) : null}

            <DetailPanel className="order-4 p-4 md:order-5">
                <h2 className="mb-3 text-base font-bold text-neutral-950">お知らせ・更新履歴</h2>
                {releases.length === 0 ? (
                    <p className="text-sm text-slate-500">お知らせはまだありません。</p>
                ) : (
                    <div className="space-y-3">
                        {releases.map((release) => (
                            <div
                                key={release.releaseId}
                                className="border border-neutral-300 bg-white p-4 shadow-[2px_2px_0_rgba(23,23,23,0.16)]"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold tracking-wide text-neutral-500">
                                            {formatDateYmd(release.releasedAt)}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => onOpenRelease(release.releaseId)}
                                            className="mt-1 text-left text-base font-bold leading-snug text-blue-700 hover:underline"
                                        >
                                            {release.title}
                                        </button>
                                    </div>
                                    <span className="shrink-0 border border-neutral-400 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                                        {release.announcementKind === "release"
                                            ? "リリース"
                                            : "お知らせ"}
                                    </span>
                                </div>
                                {release.summary ? (
                                    <p className="mt-2 text-sm leading-6 text-neutral-700 line-clamp-2">
                                        {release.summary}
                                    </p>
                                ) : null}
                                {release.tags.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {release.tags.map((tag) => (
                                            <span
                                                key={`${release.releaseId}-${tag}`}
                                                className={EVENT_TAG_CHIP_CLASS}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                                <ReleaseDbChangeSummary
                                    changes={release.changes}
                                    variant="compact"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </DetailPanel>
        </div>
    );
}
