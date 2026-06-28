import { resolveMembershipLeaveDate } from "../../lib/membershipActivity";

import type { GroupDetail, GroupMembershipRow } from "../../lib/setlistSearchDb/types";

export type TimelineColorSpan = {
    startMs: number;
    endMs: number;
    colorCode: string;
    colorName: string | null;
};

export type TimelineMember = {
    personId: number;
    personName: string;
    generation: string | null;
    joinMs: number;
    leaveMs: number | null;
    colorSpans: TimelineColorSpan[];
    birthdaySortMs: number;
    groupPersonId: number;
};

export type TimelineYearTick = {
    ms: number;
    label: string;
};

export type GroupTimelineModel = {
    startMs: number;
    endMs: number;
    members: TimelineMember[];
    yearTicks: TimelineYearTick[];
};

export type GroupTimelineContext = Pick<
    GroupDetail,
    "formationDate" | "debutDate" | "disbandDate" | "groupType"
>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** ローカル日付の終端（23:59:59.999）。タイムライン右端は常にここに揃える。 */
export const getTodayEndMs = (referenceMs: number = Date.now()): number => {
    const date = new Date(referenceMs);
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999,
    ).getTime();
};

export const isSameTimelineDay = (leftMs: number, rightMs: number): boolean => {
    const left = new Date(leftMs);
    const right = new Date(rightMs);
    return (
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate()
    );
};

export const parseMembershipMs = (value: string | null | undefined): number | null => {
    const text = String(value ?? "").trim();
    if (!text) return null;
    if (/^\d{10,13}$/.test(text)) {
        const n = Number(text);
        if (Number.isFinite(n)) return text.length <= 10 ? n * 1000 : n;
    }
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : parsed;
};

/** メンバー一覧のデフォルト（加入順 → 年齢順）と同じ比較。 */
export const toMembershipSortTime = (value: string | null | undefined): number =>
    parseMembershipMs(value) ?? Number.MAX_SAFE_INTEGER;

export const compareGroupMembershipByJoinAndBirthday = (
    left: Pick<GroupMembershipRow, "joinDate" | "birthday" | "groupPersonId">,
    right: Pick<GroupMembershipRow, "joinDate" | "birthday" | "groupPersonId">,
): number => {
    let diff = toMembershipSortTime(left.joinDate) - toMembershipSortTime(right.joinDate);
    if (diff === 0) {
        diff = toMembershipSortTime(left.birthday) - toMembershipSortTime(right.birthday);
    }
    if (diff === 0) {
        diff = left.groupPersonId - right.groupPersonId;
    }
    return diff;
};

export const compareTimelineMembersByJoinAndBirthday = (
    left: TimelineMember,
    right: TimelineMember,
): number => {
    let diff = left.joinMs - right.joinMs;
    if (diff === 0) {
        diff = left.birthdaySortMs - right.birthdaySortMs;
    }
    if (diff === 0) {
        diff = left.groupPersonId - right.groupPersonId;
    }
    return diff;
};

export const DEFAULT_MEMBER_COLOR = "#64748b";

export const buildTimelineColorSpans = (
    colors: GroupMembershipRow["memberColors"] | undefined,
    joinMs: number,
    leaveMs: number | null,
    timelineEndMs: number,
): TimelineColorSpan[] => {
    const membershipEndMs = leaveMs ?? timelineEndMs;
    if (membershipEndMs <= joinMs) return [];

    const rows = colors ?? [];
    if (rows.length === 0) return [];

    const spans: TimelineColorSpan[] = [];
    for (const color of rows) {
        const colorCode = color.colorCode?.trim() ?? "";
        if (!colorCode) continue;
        const spanStartMs = Math.max(
            parseMembershipMs(color.startDate) ?? joinMs,
            joinMs,
        );
        const colorEndMs = parseMembershipMs(color.endDate);
        const spanEndMs = Math.min(colorEndMs ?? membershipEndMs, membershipEndMs);
        if (spanEndMs <= spanStartMs) continue;
        spans.push({
            startMs: spanStartMs,
            endMs: spanEndMs,
            colorCode,
            colorName: color.colorName,
        });
    }

    return spans.sort(
        (left, right) =>
            left.startMs - right.startMs || left.endMs - right.endMs,
    );
};

export const getMemberColorAt = (
    member: TimelineMember,
    ms: number,
): string | null => {
    for (const span of member.colorSpans) {
        if (ms >= span.startMs && ms < span.endMs) {
            return span.colorCode;
        }
    }
    return null;
};

export const getMemberBarBounds = (
    model: GroupTimelineModel,
    member: TimelineMember,
): { barStartMs: number; barEndMs: number } => {
    const barStartMs = Math.max(member.joinMs, model.startMs);
    const barEndMs = Math.min(member.leaveMs ?? model.endMs, model.endMs);
    return { barStartMs, barEndMs };
};

export const getMemberColorSpanStyle = (
    span: TimelineColorSpan,
    barStartMs: number,
    barEndMs: number,
): { left: string; width: string } => {
    const barSpanMs = barEndMs - barStartMs;
    if (barSpanMs <= 0) {
        return { left: "0%", width: "0%" };
    }
    const spanStartMs = Math.max(span.startMs, barStartMs);
    const spanEndMs = Math.min(span.endMs, barEndMs);
    const leftRatio = (spanStartMs - barStartMs) / barSpanMs;
    const widthRatio = Math.max((spanEndMs - spanStartMs) / barSpanMs, 0);
    return {
        left: `${leftRatio * 100}%`,
        width: `${widthRatio * 100}%`,
    };
};


export const buildGroupTimelineModel = (
    members: GroupMembershipRow[],
    context: GroupTimelineContext,
): GroupTimelineModel | null => {
    const timelineMembers: TimelineMember[] = [];
    for (const row of members) {
        const joinMs = parseMembershipMs(row.joinDate);
        if (joinMs === null) continue;
        const resolvedLeave = resolveMembershipLeaveDate({
            leaveDate: row.leaveDate,
            groupType: context.groupType,
            groupDisbandDate: context.disbandDate,
        });
        const leaveMs = parseMembershipMs(resolvedLeave);
        timelineMembers.push({
            personId: row.personId,
            personName: row.personName,
            generation: row.generation,
            joinMs,
            leaveMs,
            colorSpans: [],
            birthdaySortMs: toMembershipSortTime(row.birthday),
            groupPersonId: row.groupPersonId,
        });
    }
    if (timelineMembers.length === 0) return null;

    timelineMembers.sort(compareTimelineMembersByJoinAndBirthday);

    const memberStart = Math.min(...timelineMembers.map((member) => member.joinMs));
    const formationMs = parseMembershipMs(context.formationDate);
    const debutMs = parseMembershipMs(context.debutDate);
    const disbandMs = parseMembershipMs(context.disbandDate);
    const startMs = resolveTimelineStartMs(formationMs, debutMs, memberStart);

    let endMs = resolveTimelineEndMs(disbandMs);
    if (endMs <= startMs) endMs = startMs + DAY_MS * 365;

    for (const member of timelineMembers) {
        const sourceRow = members.find((row) => row.personId === member.personId);
        member.colorSpans = buildTimelineColorSpans(
            sourceRow?.memberColors,
            member.joinMs,
            member.leaveMs,
            endMs,
        );
    }

    return {
        startMs,
        endMs,
        members: timelineMembers,
        yearTicks: buildYearTicks(startMs, endMs),
    };
};

const buildYearTicks = (startMs: number, endMs: number): TimelineYearTick[] => {
    const startYear = new Date(startMs).getFullYear();
    const endYear = new Date(endMs).getFullYear();
    const ticks: TimelineYearTick[] = [];
    for (let year = startYear; year <= endYear; year += 1) {
        const ms = Date.parse(`${year}-01-01T00:00:00Z`);
        if (ms < startMs || ms > endMs) continue;
        ticks.push({ ms, label: String(year) });
    }
    return ticks;
};

export const getTimelineSpanMs = (model: GroupTimelineModel): number =>
    Math.max(model.endMs - model.startMs, 1);

export const msToTimelineRatio = (model: GroupTimelineModel, ms: number): number => {
    const ratio = (ms - model.startMs) / getTimelineSpanMs(model);
    return Math.min(1, Math.max(0, ratio));
};

export const ratioToMs = (model: GroupTimelineModel, ratio: number): number => {
    const clamped = Math.min(1, Math.max(0, ratio));
    return model.startMs + clamped * getTimelineSpanMs(model);
};

export const isMemberActiveAt = (member: TimelineMember, ms: number): boolean =>
    member.joinMs <= ms && (member.leaveMs === null || member.leaveMs > ms);

export const getActiveMembersAt = (
    model: GroupTimelineModel,
    ms: number,
): TimelineMember[] =>
    model.members.filter((member) => isMemberActiveAt(member, ms));

export const getMemberBarStyle = (
    model: GroupTimelineModel,
    member: TimelineMember,
): { left: string; width: string; widthRatio: number } => {
    const span = getTimelineSpanMs(model);
    const barStart = Math.max(member.joinMs, model.startMs);
    const barEnd = Math.min(member.leaveMs ?? model.endMs, model.endMs);
    const leftRatio = (barStart - model.startMs) / span;
    const widthRatio = Math.max((barEnd - barStart) / span, 0.004);
    return {
        left: `${leftRatio * 100}%`,
        width: `${widthRatio * 100}%`,
        widthRatio,
    };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 加入日〜脱退日（現役は referenceMs）の在籍期間を「◯年◯日」形式で返す。 */
export const formatMembershipTenureYearsDays = (
    joinMs: number,
    leaveMs: number | null,
    referenceMs: number = Date.now(),
): string => {
    const endMs = Math.max(joinMs, leaveMs ?? referenceMs);
    if (endMs <= joinMs) return "0日";

    const start = new Date(joinMs);
    const end = new Date(endMs);
    let years = end.getUTCFullYear() - start.getUTCFullYear();
    const startMonthDay = start.getUTCMonth() * 100 + start.getUTCDate();
    const endMonthDay = end.getUTCMonth() * 100 + end.getUTCDate();
    if (endMonthDay < startMonthDay) {
        years -= 1;
    }

    const anchorMs = Date.UTC(
        start.getUTCFullYear() + years,
        start.getUTCMonth(),
        start.getUTCDate(),
    );
    const days = Math.max(0, Math.round((endMs - anchorMs) / MS_PER_DAY));

    if (years === 0) return `${days}日`;
    if (days === 0) return `${years}年`;
    return `${years}年${days}日`;
};

export const formatTimelineMsLabel = (ms: number): string => {
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return "-";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export type TimelineReleaseEvent = {
    albumId: number;
    albumName: string;
    category: number;
    categoryLabel: string;
    releaseMs: number;
    /** 発売日〜次作品/メンバー構成変更（排他的終端）またはタイムライン終端。 */
    releaseEndMs: number;
    artistName: string;
};

export const TIMELINE_SINGLE_CATEGORY = 10;
export const TIMELINE_RELEASE_CATEGORIES = new Set([10, 20, 40, 50]);

export const TIMELINE_PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;
export type TimelinePlaybackSpeed = (typeof TIMELINE_PLAYBACK_SPEEDS)[number];

export const BASE_TIMELINE_PLAYTHROUGH_MS = 45_000;

export const buildTimelineReleaseEvents = (
    albums: Array<{
        albumId: number;
        albumName: string;
        category: number;
        releaseDate: string;
        artistName: string;
    }>,
    model: GroupTimelineModel | null,
    categoryLabelFn: (category: number) => string,
): TimelineReleaseEvent[] => {
    if (!model) return [];
    const events: TimelineReleaseEvent[] = [];
    const seen = new Set<number>();
    for (const album of albums) {
        if (!TIMELINE_RELEASE_CATEGORIES.has(album.category)) continue;
        if (seen.has(album.albumId)) continue;
        const releaseMs = parseMembershipMs(album.releaseDate);
        if (releaseMs === null) continue;
        if (releaseMs < model.startMs || releaseMs > model.endMs) continue;
        seen.add(album.albumId);
        events.push({
            albumId: album.albumId,
            albumName: album.albumName,
            category: album.category,
            categoryLabel: categoryLabelFn(album.category),
            releaseMs,
            releaseEndMs: releaseMs,
            artistName: album.artistName,
        });
    }
    return assignReleaseEventSpans(
        events.sort((left, right) => left.releaseMs - right.releaseMs),
        model.endMs,
        collectMembershipChangeMs(model.members),
    );
};

export const collectMembershipChangeMs = (members: TimelineMember[]): number[] => {
    const changes = new Set<number>();
    for (const member of members) {
        changes.add(member.joinMs);
        if (member.leaveMs !== null) changes.add(member.leaveMs);
    }
    return [...changes].sort((left, right) => left - right);
};

export const resolveReleaseEndMs = (
    releaseMs: number,
    nextReleaseMs: number | null,
    membershipChanges: number[],
    timelineEndMs: number,
): number => {
    const nextMembershipChangeMs =
        membershipChanges.find((changeMs) => changeMs > releaseMs) ?? null;
    const candidates = [nextReleaseMs, nextMembershipChangeMs, timelineEndMs].filter(
        (value): value is number => value !== null,
    );
    const endMs = Math.min(...candidates);
    if (endMs === timelineEndMs) return timelineEndMs + 1;
    return endMs;
};

export const assignReleaseEventSpans = (
    events: TimelineReleaseEvent[],
    timelineEndMs: number,
    membershipChanges: number[],
): TimelineReleaseEvent[] =>
    events.map((event, index) => {
        const nextReleaseMs =
            events
                .slice(index + 1)
                .find((candidate) => candidate.releaseMs > event.releaseMs)?.releaseMs ?? null;
        return {
            ...event,
            releaseEndMs: resolveReleaseEndMs(
                event.releaseMs,
                nextReleaseMs,
                membershipChanges,
                timelineEndMs,
            ),
        };
    });

export const resolveTimelineStartMs = (
    formationMs: number | null,
    debutMs: number | null,
    memberStartMs: number,
): number => {
    if (formationMs !== null) return formationMs;
    if (debutMs !== null) return debutMs;
    return memberStartMs;
};

/** 解散日があればその日の終端、なければ今日の終端。 */
export const resolveTimelineEndMs = (
    disbandMs: number | null,
    referenceMs: number = Date.now(),
): number => {
    if (disbandMs !== null) return getTodayEndMs(disbandMs);
    return getTodayEndMs(referenceMs);
};

export const isTimelineSingleRelease = (category: number): boolean =>
    category === TIMELINE_SINGLE_CATEGORY;

/** 発売日〜表示終了日の期間内か（排他的終端）。 */
export const isReleaseActiveAt = (
    event: TimelineReleaseEvent,
    currentMs: number,
): boolean => currentMs >= event.releaseMs && currentMs < event.releaseEndMs;

export const getReleaseMarkerStyle = (
    model: GroupTimelineModel,
    event: TimelineReleaseEvent,
): { left: string; width: string; widthRatio: number } => {
    const span = getTimelineSpanMs(model);
    const barStart = Math.max(event.releaseMs, model.startMs);
    const barEnd = Math.min(event.releaseEndMs, model.endMs);
    const leftRatio = (barStart - model.startMs) / span;
    const widthRatio = Math.max((barEnd - barStart) / span, 0.004);
    return {
        left: `${leftRatio * 100}%`,
        width: `${widthRatio * 100}%`,
        widthRatio,
    };
};

export type ReleaseMarkerTheme = {
    shortLabel: string;
    accent: string;
    border: string;
    fill: string;
    fillMuted: string;
    stripe: string;
};

export const getReleaseMarkerTheme = (category: number): ReleaseMarkerTheme => {
    if (category === TIMELINE_SINGLE_CATEGORY) {
        return {
            shortLabel: "SG",
            accent: "#fcd34d",
            border: "#7c2d12",
            fill: "linear-gradient(135deg, #fde68a 0%, #f59e0b 42%, #ea580c 100%)",
            fillMuted: "linear-gradient(135deg, #fef3c7 0%, #fdba74 100%)",
            stripe:
                "repeating-linear-gradient(-45deg, rgba(255,255,255,0.14) 0 2px, transparent 2px 5px)",
        };
    }
    if (category === 20) {
        return {
            shortLabel: "AL",
            accent: "#c4b5fd",
            border: "#4c1d95",
            fill: "linear-gradient(90deg, #a78bfa 0%, #7c3aed 55%, #5b21b6 100%)",
            fillMuted: "linear-gradient(90deg, #ddd6fe 0%, #a78bfa 100%)",
            stripe:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 5px)",
        };
    }
    if (category === 40) {
        return {
            shortLabel: "MA",
            accent: "#67e8f9",
            border: "#155e75",
            fill: "linear-gradient(90deg, #67e8f9 0%, #0891b2 55%, #0e7490 100%)",
            fillMuted: "linear-gradient(90deg, #cffafe 0%, #67e8f9 100%)",
            stripe:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 6px)",
        };
    }
    if (category === 50) {
        return {
            shortLabel: "BA",
            accent: "#cbd5e1",
            border: "#1e293b",
            fill: "linear-gradient(90deg, #94a3b8 0%, #475569 55%, #334155 100%)",
            fillMuted: "linear-gradient(90deg, #e2e8f0 0%, #94a3b8 100%)",
            stripe:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0 3px, transparent 3px 7px)",
        };
    }
    return {
        shortLabel: "??",
        accent: "#cbd5e1",
        border: "#334155",
        fill: "linear-gradient(90deg, #94a3b8 0%, #64748b 100%)",
        fillMuted: "linear-gradient(90deg, #e2e8f0 0%, #94a3b8 100%)",
        stripe:
            "repeating-linear-gradient(-45deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 5px)",
    };
};

/** @deprecated use getReleaseMarkerTheme().accent */
export const releaseMarkerTone = (category: number): string =>
    getReleaseMarkerTheme(category).accent;
