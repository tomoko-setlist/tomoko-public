import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    BASE_TIMELINE_PLAYTHROUGH_MS,
    buildGroupTimelineModel,
    buildTimelineReleaseEvents,
    formatTimelineMsLabel,
    formatMembershipTenureYearsDays,
    getActiveMembersAt,
    getMemberBarBounds,
    getMemberBarStyle,
    getMemberColorAt,
    getMemberColorSpanStyle,
    getReleaseMarkerStyle,
    DEFAULT_MEMBER_COLOR,
    getReleaseMarkerTheme,
    isMemberActiveAt,
    isReleaseActiveAt,
    msToTimelineRatio,
    ratioToMs,
    TIMELINE_PLAYBACK_SPEEDS,
    type GroupTimelineContext,
    type GroupTimelineModel,
    type TimelineMember,
    type TimelinePlaybackSpeed,
    type TimelineReleaseEvent,
} from "./membershipTimelineModel";
import { categoryLabel } from "../../lib/uiFormat";
import { PauseIcon, PlayIcon } from "../ui";

import type { AlbumDetail, GroupMembershipRow } from "../../lib/setlistSearchDb/types";

const TIMELINE_ROW_GRID = "grid grid-cols-[88px_1fr] items-center gap-2";

type GroupMembershipTimelineProps = {
    members: GroupMembershipRow[];
    context: GroupTimelineContext;
    albums?: AlbumDetail[];
    onOpenMember: (personId: number) => void;
    onOpenAlbum?: (albumId: number) => void;
};

export function GroupMembershipTimeline({
    members,
    context,
    albums = [],
    onOpenMember,
    onOpenAlbum,
}: GroupMembershipTimelineProps) {
    const model = useMemo(
        () => buildGroupTimelineModel(members, context),
        [members, context],
    );
    const releaseEvents = useMemo(
        () => buildTimelineReleaseEvents(albums, model, categoryLabel),
        [albums, model],
    );
    if (!model) {
        return <p className="text-sm text-slate-500">在籍タイムラインを表示できません。</p>;
    }

    return (
        <GroupMembershipTimelineInner
            model={model}
            releaseEvents={releaseEvents}
            onOpenMember={onOpenMember}
            onOpenAlbum={onOpenAlbum}
        />
    );
}

function GroupMembershipTimelineInner({
    model,
    releaseEvents,
    onOpenMember,
    onOpenAlbum,
}: {
    model: GroupTimelineModel;
    releaseEvents: TimelineReleaseEvent[];
    onOpenMember: (personId: number) => void;
    onOpenAlbum?: (albumId: number) => void;
}) {
    const [currentMs, setCurrentMs] = useState(model.startMs);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState<TimelinePlaybackSpeed>(1);
    const playStartRef = useRef<number | null>(null);
    const playFromRef = useRef(model.startMs);
    const playthroughMs = BASE_TIMELINE_PLAYTHROUGH_MS / playbackSpeed;

    const activeMembers = useMemo(
        () => getActiveMembersAt(model, currentMs),
        [model, currentMs],
    );
    const activeReleases = useMemo(
        () => releaseEvents.filter((event) => isReleaseActiveAt(event, currentMs)),
        [releaseEvents, currentMs],
    );
    const playheadRatio = msToTimelineRatio(model, currentMs);
    const currentLabel = formatTimelineMsLabel(currentMs);

    useEffect(() => {
        if (!isPlaying) {
            playStartRef.current = null;
            return;
        }
        playStartRef.current = performance.now();
        let frameId = 0;

        const tick = (now: number) => {
            const startedAt = playStartRef.current;
            if (startedAt === null) return;
            const elapsed = now - startedAt;
            const progress = Math.min(elapsed / playthroughMs, 1);
            const nextMs =
                playFromRef.current +
                progress * (model.endMs - playFromRef.current);
            setCurrentMs(nextMs);
            if (progress >= 1) {
                setIsPlaying(false);
                return;
            }
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, [isPlaying, model.endMs, playthroughMs]);

    const handleTogglePlay = useCallback(() => {
        if (isPlaying) {
            setIsPlaying(false);
            return;
        }
        if (currentMs >= model.endMs - 1) {
            setCurrentMs(model.startMs);
            playFromRef.current = model.startMs;
        } else {
            playFromRef.current = currentMs;
        }
        setIsPlaying(true);
    }, [currentMs, isPlaying, model.endMs, model.startMs]);

    const handleScrub = useCallback(
        (ratio: number) => {
            setIsPlaying(false);
            const nextMs = ratioToMs(model, ratio);
            setCurrentMs(nextMs);
            playFromRef.current = nextMs;
        },
        [model],
    );

    const handleSeekToMs = useCallback(
        (ms: number) => {
            setIsPlaying(false);
            const clamped = Math.min(Math.max(ms, model.startMs), model.endMs);
            setCurrentMs(clamped);
            playFromRef.current = clamped;
        },
        [model.endMs, model.startMs],
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold tracking-[0.14em] text-slate-500">
                        MEMBERSHIP TIMELINE
                    </p>
                    <p className="text-sm font-semibold text-slate-900">在籍タイムライン</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div
                        className="inline-flex overflow-hidden rounded-none border-2 border-gray-800 bg-white"
                        role="group"
                        aria-label="再生速度"
                    >
                        {TIMELINE_PLAYBACK_SPEEDS.map((speed) => (
                            <button
                                key={speed}
                                type="button"
                                onClick={() => setPlaybackSpeed(speed)}
                                className={`px-2 py-1 text-[11px] font-bold tabular-nums ${
                                    playbackSpeed === speed
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-700 hover:bg-slate-100"
                                }`}
                            >
                                {speed}x
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={handleTogglePlay}
                        className="inline-flex h-9 items-center gap-1.5 rounded-none border-2 border-gray-800 bg-slate-900 px-3 text-xs font-bold text-white shadow-[2px_2px_0_0_rgba(15,23,42,0.85)] hover:bg-slate-800"
                        aria-label={isPlaying ? "再生を停止" : "在籍履歴を再生"}
                    >
                        {isPlaying ? (
                            <PauseIcon className="h-3.5 w-3.5" />
                        ) : (
                            <PlayIcon className="h-3.5 w-3.5" />
                        )}
                        {isPlaying ? "停止" : "再生"}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                    <div className={`${TIMELINE_ROW_GRID} mb-2`}>
                        <div aria-hidden="true" />
                        <div className="relative h-6 border-b-2 border-slate-800">
                            {model.yearTicks.map((tick) => (
                                <div
                                    key={tick.label}
                                    className="absolute top-0 h-full"
                                    style={{
                                        left: `${msToTimelineRatio(model, tick.ms) * 100}%`,
                                    }}
                                >
                                    <span className="absolute -translate-x-1/2 text-[10px] font-bold tabular-nums text-slate-600">
                                        {tick.label}
                                    </span>
                                    <span className="absolute bottom-0 h-2 w-px -translate-x-1/2 bg-slate-500" />
                                </div>
                            ))}
                            <div
                                className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-red-600 shadow-[0_0_0_1px_rgba(255,255,255,0.8)] transition-[left] duration-75"
                                style={{ left: `${playheadRatio * 100}%` }}
                                aria-hidden="true"
                            />
                        </div>
                    </div>

                    {releaseEvents.length > 0 ? (
                        <TimelineReleaseLane
                            releaseEvents={releaseEvents}
                            model={model}
                            currentMs={currentMs}
                            onSeekToMs={handleSeekToMs}
                        />
                    ) : null}

                    <ul className="space-y-1">
                        {model.members.map((member) => (
                            <TimelineMemberRow
                                key={member.personId}
                                member={member}
                                model={model}
                                currentMs={currentMs}
                                onOpenMember={onOpenMember}
                            />
                        ))}
                    </ul>
                </div>
            </div>

            <div className={TIMELINE_ROW_GRID}>
                <div aria-hidden="true" />
                <label className="block">
                    <span className="sr-only">タイムライン位置</span>
                    <input
                        type="range"
                        min={0}
                        max={1000}
                        value={Math.round(playheadRatio * 1000)}
                        onChange={(event) =>
                            handleScrub(Number(event.currentTarget.value) / 1000)
                        }
                        className="h-2 w-full cursor-pointer accent-red-600"
                    />
                </label>
            </div>

            <div className="border-2 border-slate-800 bg-[radial-gradient(#e2e8f0_0.75px,transparent_0.75px)] bg-[length:6px_6px] p-2.5">
                <p className="text-[11px] font-semibold text-slate-600">
                    <span className="mr-2 tabular-nums text-slate-900">{currentLabel}</span>
                    時点{" "}
                    <span className="font-black text-slate-950">{activeMembers.length}名</span>
                    {activeReleases.length > 0 ? (
                        <span className="ml-2 text-slate-500">
                            / リリース {activeReleases.length}件
                        </span>
                    ) : null}
                </p>
                <ActiveMemberChips
                    members={activeMembers}
                    currentMs={currentMs}
                    onOpenMember={onOpenMember}
                />
                {activeReleases.length > 0 ? (
                    <ReleaseChipList
                        releases={activeReleases.slice(-6)}
                        onOpenAlbum={onOpenAlbum}
                    />
                ) : null}
            </div>
        </div>
    );
}

function TimelineReleaseLane({
    releaseEvents,
    model,
    currentMs,
    onSeekToMs,
}: {
    releaseEvents: TimelineReleaseEvent[];
    model: GroupTimelineModel;
    currentMs: number;
    onSeekToMs: (ms: number) => void;
}) {
    const legendCategories = useMemo(() => {
        const seen = new Set<number>();
        const items: Array<{ category: number; label: string }> = [];
        for (const event of releaseEvents) {
            if (seen.has(event.category)) continue;
            seen.add(event.category);
            items.push({ category: event.category, label: event.categoryLabel });
        }
        return items.sort((left, right) => left.category - right.category);
    }, [releaseEvents]);

    return (
        <div className={`${TIMELINE_ROW_GRID} mb-2 items-stretch`}>
            <div className="flex flex-col justify-center gap-1.5">
                <p className="text-[10px] font-bold tracking-[0.08em] text-slate-500">
                    RELEASE
                </p>
                <ul className="space-y-0.5">
                    {legendCategories.map((item) => {
                        const theme = getReleaseMarkerTheme(item.category);
                        return (
                            <li
                                key={item.category}
                                className="flex items-center gap-1 text-[9px] font-bold text-slate-600"
                            >
                                <span
                                    className="inline-flex h-2.5 w-2.5 shrink-0 rotate-45 border border-slate-900"
                                    style={{ background: theme.fill }}
                                    aria-hidden="true"
                                />
                                <span>{item.label}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div className="relative h-9 overflow-hidden border-2 border-slate-800 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-2px_6px_rgba(15,23,42,0.06)]">
                <div
                    className="pointer-events-none absolute inset-0 opacity-40"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(90deg, rgba(15,23,42,0.05) 0 1px, transparent 1px 48px)",
                    }}
                    aria-hidden="true"
                />
                {releaseEvents.map((event) => (
                    <TimelineReleaseMarker
                        key={event.albumId}
                        event={event}
                        model={model}
                        currentMs={currentMs}
                        onSeekToMs={onSeekToMs}
                    />
                ))}
            </div>
        </div>
    );
}

function TimelineReleaseMarker({
    event,
    model,
    currentMs,
    onSeekToMs,
}: {
    event: TimelineReleaseEvent;
    model: GroupTimelineModel;
    currentMs: number;
    onSeekToMs: (ms: number) => void;
}) {
    const active = isReleaseActiveAt(event, currentMs);
    const markerStyle = getReleaseMarkerStyle(model, event);
    const theme = getReleaseMarkerTheme(event.category);
    const releaseLabel = formatTimelineMsLabel(event.releaseMs);
    const endLabel =
        event.releaseEndMs > event.releaseMs
            ? formatTimelineMsLabel(event.releaseEndMs)
            : null;
    const showLabel = markerStyle.widthRatio >= 0.05;
    const tooltip = `${event.categoryLabel}: ${event.albumName} (${releaseLabel}${endLabel ? ` 〜 ${endLabel}` : ""})`;

    return (
        <div
            className={`group/release pointer-events-none absolute inset-y-1.5 transition-all duration-200 ${
                active ? "z-20 opacity-100" : "z-10 opacity-40 saturate-[0.65]"
            }`}
            style={{
                left: markerStyle.left,
                width: markerStyle.width,
            }}
        >
            <button
                type="button"
                onClick={() => onSeekToMs(event.releaseMs)}
                className={`pointer-events-auto absolute left-0 top-1/2 z-30 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center transition-transform duration-200 ${
                    active ? "scale-110" : "scale-95"
                } hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-600`}
                title={`${tooltip} — クリックで ${releaseLabel} に移動`}
                aria-label={`${event.albumName} の発売日 ${releaseLabel} に移動`}
            >
                <span
                    className="h-2.5 w-2.5 rotate-45 border-2 border-slate-900"
                    style={{
                        backgroundColor: theme.accent,
                        boxShadow: active ? "0 0 0 1px rgba(255,255,255,0.85)" : undefined,
                    }}
                    aria-hidden="true"
                />
            </button>
            <span
                className={`absolute inset-0 overflow-hidden border-2 border-slate-900 transition-shadow duration-200 ${
                    active
                        ? "shadow-[2px_2px_0_0_rgba(15,23,42,0.75)]"
                        : "shadow-[1px_1px_0_0_rgba(15,23,42,0.35)]"
                }`}
                style={{
                    backgroundColor: theme.border,
                    backgroundImage: `${active ? theme.fill : theme.fillMuted}, ${theme.stripe}`,
                }}
                aria-hidden="true"
            >
                {showLabel ? (
                    <span className="absolute inset-0 flex items-center px-2 pl-2.5">
                        <span className="truncate text-[8px] font-black tracking-[0.12em] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]">
                            {theme.shortLabel}
                        </span>
                    </span>
                ) : null}
            </span>
        </div>
    );
}

function TimelineMemberRow({
    member,
    model,
    currentMs,
    onOpenMember,
}: {
    member: TimelineMember;
    model: GroupTimelineModel;
    currentMs: number;
    onOpenMember: (personId: number) => void;
}) {
    const active = isMemberActiveAt(member, currentMs);
    const barStyle = getMemberBarStyle(model, member);
    const { barStartMs, barEndMs } = getMemberBarBounds(model, member);
    const tenureLabel = formatMembershipTenureYearsDays(member.joinMs, member.leaveMs);
    const showTenureInBar = barStyle.widthRatio >= 0.07;
    const colorTooltip = member.colorSpans
        .map((span) => {
            const name = span.colorName?.trim() || span.colorCode;
            return `${name} (${formatTimelineMsLabel(span.startMs)}〜${formatTimelineMsLabel(span.endMs)})`;
        })
        .join(" / ");

    return (
        <li className={TIMELINE_ROW_GRID}>
            <button
                type="button"
                onClick={() => onOpenMember(member.personId)}
                className={`truncate text-left text-[11px] font-semibold hover:underline ${
                    active ? "text-blue-700" : "text-slate-500"
                }`}
                title={`${member.personName}（${tenureLabel}）`}
            >
                {member.personName}
            </button>
            <div
                className="relative h-5 border border-slate-300 bg-white/80"
                title={colorTooltip ? `${tenureLabel}\n${colorTooltip}` : tenureLabel}
            >
                <div
                    className={`absolute inset-y-0 overflow-hidden rounded-none border transition-all duration-200 ${
                        active
                            ? "border-slate-900 opacity-100 shadow-[0_0_0_1px_rgba(15,23,42,0.15)]"
                            : "border-transparent opacity-45"
                    }`}
                    style={{
                        left: barStyle.left,
                        width: barStyle.width,
                    }}
                >
                    {member.colorSpans.length > 0 ? (
                        member.colorSpans.map((span, index) => (
                            <span
                                key={`${span.colorCode}-${span.startMs}-${index}`}
                                className="absolute inset-y-0 border-r border-slate-900/25 last:border-r-0"
                                style={{
                                    ...getMemberColorSpanStyle(span, barStartMs, barEndMs),
                                    backgroundColor: span.colorCode,
                                }}
                            />
                        ))
                    ) : (
                        <span
                            className="absolute inset-0"
                            style={{ backgroundColor: DEFAULT_MEMBER_COLOR }}
                        />
                    )}
                    {showTenureInBar ? (
                        <span className="pointer-events-none relative z-10 flex h-full w-full items-center justify-center overflow-hidden px-1 text-center text-[9px] font-bold tabular-nums leading-none text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.85)]">
                            {tenureLabel}
                        </span>
                    ) : null}
                </div>
            </div>
        </li>
    );
}

function ActiveMemberChips({
    members,
    currentMs,
    onOpenMember,
}: {
    members: TimelineMember[];
    currentMs: number;
    onOpenMember: (personId: number) => void;
}) {
    if (members.length === 0) {
        return <p className="mt-2 text-xs text-slate-500">在籍メンバーなし</p>;
    }

    return (
        <ul className="mt-2 flex flex-wrap gap-1.5">
            {members.map((member) => {
                const chipColor = getMemberColorAt(member, currentMs);
                return (
                <li key={member.personId}>
                    <button
                        type="button"
                        onClick={() => onOpenMember(member.personId)}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-none border-2 border-slate-800 bg-white px-2 py-1 text-[11px] font-semibold text-slate-900 shadow-[2px_2px_0_0_rgba(51,65,85,0.55)] transition-transform duration-300 hover:-translate-y-px"
                        style={
                            chipColor
                                ? {
                                      boxShadow: `2px 2px 0 0 ${chipColor}55`,
                                      borderLeftWidth: "4px",
                                      borderLeftColor: chipColor,
                                  }
                                : undefined
                        }
                    >
                        <span className="truncate">{member.personName}</span>
                        {member.generation?.trim() ? (
                            <span className="shrink-0 text-[10px] font-bold text-slate-500">
                                {member.generation.trim()}
                            </span>
                        ) : null}
                    </button>
                </li>
                );
            })}
        </ul>
    );
}

function ReleaseChipList({
    releases,
    onOpenAlbum,
}: {
    releases: TimelineReleaseEvent[];
    onOpenAlbum?: (albumId: number) => void;
}) {
    return (
        <ul className="mt-2 flex flex-wrap gap-1.5">
            {releases.map((release) => {
                const theme = getReleaseMarkerTheme(release.category);
                return (
                    <li key={release.albumId}>
                        <button
                            type="button"
                            onClick={() => onOpenAlbum?.(release.albumId)}
                            disabled={!onOpenAlbum}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-none border-2 border-slate-800 bg-white py-0.5 pl-0.5 pr-2 text-[10px] font-semibold text-slate-900 shadow-[2px_2px_0_0_rgba(51,65,85,0.45)] transition-transform hover:-translate-y-px disabled:cursor-default"
                        >
                            <span
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center border border-slate-900 text-[8px] font-black tracking-[0.08em] text-white"
                                style={{
                                    backgroundImage: `${theme.fill}, ${theme.stripe}`,
                                }}
                            >
                                {theme.shortLabel}
                            </span>
                            <span className="truncate">{release.albumName}</span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
