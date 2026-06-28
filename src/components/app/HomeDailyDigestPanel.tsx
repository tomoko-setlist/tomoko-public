import { formatDateYmd, formatTimeHm } from "../../lib/uiFormat";

import type {
    HomeDailyDigest,
    HomeDigestAnniversaryStage,
    HomeDigestSong,
    HomeDigestStage,
} from "../../lib/setlistSearchDb/types";

export type HomeDailyDigestPanelProps = {
    digest: HomeDailyDigest | null;
    status: "idle" | "loading" | "ready" | "error";
    error: string;
    onOpenEvent: (eventId: number) => void;
    onOpenStage: (stageId: number) => void;
    onOpenSong: (songId: number) => void;
};

/** Reserved for a future dedicated Daily route; not mounted on home search. */
export function HomeDailyDigestPanel({
    digest,
    status,
    error,
    onOpenEvent,
    onOpenStage,
    onOpenSong,
}: HomeDailyDigestPanelProps) {
    const stats = digest?.stats;
    return (
        <section className="mb-4 rounded-none border-2 border-gray-800 bg-white shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]">
            <div className="border-b-2 border-gray-800 bg-slate-950 px-4 py-3 text-white md:px-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-semibold text-emerald-200">
                            {digest ? formatDateYmd(digest.referenceDate) : "今日"} の動き
                        </p>
                        <h1 className="mt-1 text-xl font-bold md:text-2xl">
                            ToMoKo Daily
                        </h1>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <StatPill label="セトリ" value={stats?.totalSetlists} />
                        <StatPill label="公演" value={stats?.totalStages} />
                        <StatPill label="イベント" value={stats?.totalEvents} />
                        <StatPill label="楽曲" value={stats?.totalSongs} />
                    </div>
                </div>
            </div>

            {status === "error" ? (
                <div className="border-b-2 border-gray-800 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    今日の動きを読み込めませんでした: {error}
                </div>
            ) : null}

            <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
                <div className="border-b-2 border-gray-800 p-4 md:border-b-0 md:border-r-2 md:p-5">
                    <SectionHeader
                        title="近日の公演"
                        note="今日から14日以内"
                    />
                    <StageList
                        rows={digest?.upcomingStages ?? []}
                        status={status}
                        emptyText="近日の公演データはありません。"
                        onOpenEvent={onOpenEvent}
                        onOpenStage={onOpenStage}
                    />
                </div>

                <div className="p-4 md:p-5">
                    <SectionHeader title="最近の更新感" note="直近の公演とデータ規模" />
                    <div className="space-y-3">
                        <div className="rounded border border-slate-300 bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500">
                                データの厚み
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatCount(stats?.totalSetlists)}件の歌唱履歴 /{" "}
                                {formatCount(stats?.totalMembers)}人の人物データ
                            </p>
                        </div>
                        {stats?.latestReleaseTitle ? (
                            <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
                                <p className="text-xs font-semibold text-emerald-700">
                                    最新のお知らせ
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {stats.latestReleaseTitle}
                                </p>
                                {stats.latestReleaseDate ? (
                                    <p className="mt-1 text-xs text-slate-600">
                                        {formatDateYmd(stats.latestReleaseDate)}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="grid gap-0 border-t-2 border-gray-800 md:grid-cols-3">
                <div className="border-b-2 border-gray-800 p-4 md:border-b-0 md:border-r-2 md:p-5">
                    <SectionHeader title="直近の公演" note="最近開催" />
                    <StageList
                        rows={digest?.recentStages ?? []}
                        status={status}
                        emptyText="直近の公演データはありません。"
                        onOpenEvent={onOpenEvent}
                        onOpenStage={onOpenStage}
                    />
                </div>
                <div className="border-b-2 border-gray-800 p-4 md:border-b-0 md:border-r-2 md:p-5">
                    <SectionHeader title="今日の過去公演" note="同じ月日" />
                    <AnniversaryStageList
                        rows={digest?.anniversaryStages ?? []}
                        status={status}
                        onOpenEvent={onOpenEvent}
                        onOpenStage={onOpenStage}
                    />
                </div>
                <div className="p-4 md:p-5">
                    <SectionHeader title="最近よく歌われた曲" note="直近90日" />
                    <SongList
                        rows={digest?.recentHotSongs ?? []}
                        status={status}
                        onOpenSong={onOpenSong}
                    />
                </div>
            </div>
        </section>
    );
}

function SectionHeader({ title, note }: { title: string; note: string }) {
    return (
        <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-950">{title}</h2>
            <p className="shrink-0 text-xs text-slate-500">{note}</p>
        </div>
    );
}

function StatPill({
    label,
    value,
}: {
    label: string;
    value: number | null | undefined;
}) {
    return (
        <div className="border border-white/20 bg-white/10 px-2 py-1.5">
            <p className="text-[11px] text-slate-300">{label}</p>
            <p className="text-sm font-bold text-white">{formatCount(value)}</p>
        </div>
    );
}

function StageList({
    rows,
    status,
    emptyText,
    onOpenEvent,
    onOpenStage,
}: {
    rows: HomeDigestStage[];
    status: "idle" | "loading" | "ready" | "error";
    emptyText: string;
    onOpenEvent: (eventId: number) => void;
    onOpenStage: (stageId: number) => void;
}) {
    if (status === "loading" || status === "idle") {
        return <LoadingRows count={3} />;
    }
    if (rows.length === 0) {
        return <p className="text-sm text-slate-500">{emptyText}</p>;
    }
    return (
        <div className="space-y-2">
            {rows.map((row) => (
                <StageRow
                    key={row.stageId}
                    row={row}
                    onOpenEvent={onOpenEvent}
                    onOpenStage={onOpenStage}
                />
            ))}
        </div>
    );
}

function AnniversaryStageList({
    rows,
    status,
    onOpenEvent,
    onOpenStage,
}: {
    rows: HomeDigestAnniversaryStage[];
    status: "idle" | "loading" | "ready" | "error";
    onOpenEvent: (eventId: number) => void;
    onOpenStage: (stageId: number) => void;
}) {
    if (status === "loading" || status === "idle") {
        return <LoadingRows count={3} />;
    }
    if (rows.length === 0) {
        return <p className="text-sm text-slate-500">同日の過去公演はありません。</p>;
    }
    return (
        <div className="space-y-2">
            {rows.map((row) => (
                <div key={row.stageId} className="rounded border border-amber-200 bg-amber-50">
                    <div className="border-b border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800">
                        {row.yearsAgo}年前
                    </div>
                    <StageRow
                        row={row}
                        onOpenEvent={onOpenEvent}
                        onOpenStage={onOpenStage}
                    />
                </div>
            ))}
        </div>
    );
}

function StageRow({
    row,
    onOpenEvent,
    onOpenStage,
}: {
    row: HomeDigestStage;
    onOpenEvent: (eventId: number) => void;
    onOpenStage: (stageId: number) => void;
}) {
    return (
        <div className="rounded border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                    {formatDateYmd(row.date)}
                </span>
                <span>{formatTimeHm(row.startTime)}</span>
                {row.prefectureName ? <span>{row.prefectureName}</span> : null}
                {row.cancelled ? (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">
                        中止
                    </span>
                ) : null}
            </div>
            <button
                className="mt-1 text-left text-sm font-semibold text-slate-950 underline-offset-2 hover:underline"
                type="button"
                onClick={() => onOpenEvent(row.eventId)}
            >
                {row.eventName}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                <button
                    className="font-medium text-slate-700 underline-offset-2 hover:underline"
                    type="button"
                    onClick={() => onOpenStage(row.stageId)}
                >
                    {row.venueName}
                </button>
                <span>{formatCount(row.totalPerformances)}曲</span>
            </div>
        </div>
    );
}

function SongList({
    rows,
    status,
    onOpenSong,
}: {
    rows: HomeDigestSong[];
    status: "idle" | "loading" | "ready" | "error";
    onOpenSong: (songId: number) => void;
}) {
    if (status === "loading" || status === "idle") {
        return <LoadingRows count={3} />;
    }
    if (rows.length === 0) {
        return <p className="text-sm text-slate-500">直近の歌唱データはありません。</p>;
    }
    return (
        <div className="space-y-2">
            {rows.map((row, index) => (
                <div
                    key={row.songId}
                    className="rounded border border-slate-200 bg-white p-3"
                >
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5 min-w-6 rounded bg-slate-900 px-1.5 py-0.5 text-center text-xs font-bold text-white">
                            {index + 1}
                        </span>
                        <div className="min-w-0">
                            <button
                                className="text-left text-sm font-semibold text-slate-950 underline-offset-2 hover:underline"
                                type="button"
                                onClick={() => onOpenSong(row.songId)}
                            >
                                {row.songName}
                            </button>
                            <p className="mt-1 text-xs text-slate-500">
                                {row.artistName ?? "アーティスト未設定"} /{" "}
                                {formatCount(row.totalPerformances)}回
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function LoadingRows({ count }: { count: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="h-16 animate-pulse rounded border border-slate-200 bg-slate-100"
                />
            ))}
        </div>
    );
}

function formatCount(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return "-";
    }
    return new Intl.NumberFormat("ja-JP").format(value);
}
