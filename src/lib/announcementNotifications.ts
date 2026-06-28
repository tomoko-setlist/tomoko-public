import type { ReleaseNoteSummary } from "./setlistSearchDb/types";

const ANNOUNCEMENT_SEEN_IDS_KEY = "tomoko-duc-announcement-seen-ids-v1";
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const RECENT_WINDOW_DAYS = 30;
const RECENT_WINDOW_MS =
    RECENT_WINDOW_DAYS *
    HOURS_PER_DAY *
    MINUTES_PER_HOUR *
    SECONDS_PER_MINUTE *
    MS_PER_SECOND;

const loadSeenAnnouncementIds = (): Set<number> => {
    if (typeof window === "undefined") return new Set<number>();
    try {
        const raw = window.localStorage.getItem(ANNOUNCEMENT_SEEN_IDS_KEY);
        if (!raw) return new Set<number>();
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return new Set<number>();
        return new Set(
            parsed
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value) && value > 0)
                .map((value) => Math.floor(value)),
        );
    } catch {
        return new Set<number>();
    }
};

const saveSeenAnnouncementIds = (ids: Set<number>): void => {
    if (typeof window === "undefined") return;
    try {
        const payload = Array.from(ids).sort((a, b) => a - b);
        window.localStorage.setItem(ANNOUNCEMENT_SEEN_IDS_KEY, JSON.stringify(payload));
    } catch {
        // ignore storage errors
    }
};

const isRecentAnnouncement = (
    releasedAt: string,
    nowMs: number,
): boolean => {
    const releasedMs = Date.parse(releasedAt);
    if (Number.isNaN(releasedMs)) return false;
    if (releasedMs > nowMs) return false;
    return nowMs - releasedMs <= RECENT_WINDOW_MS;
};

export const listRecentAnnouncementIds = (
    rows: ReleaseNoteSummary[],
    nowMs = Date.now(),
): number[] =>
    rows
        .filter((row) => isRecentAnnouncement(row.releasedAt, nowMs))
        .map((row) => row.releaseId);

export const getUnreadRecentAnnouncementCount = (
    rows: ReleaseNoteSummary[],
    nowMs = Date.now(),
): number => {
    const seenIds = loadSeenAnnouncementIds();
    return listRecentAnnouncementIds(rows, nowMs).filter(
        (releaseId) => !seenIds.has(releaseId),
    ).length;
};

export const markAnnouncementsSeen = (releaseIds: number[]): void => {
    const seenIds = loadSeenAnnouncementIds();
    for (const releaseId of releaseIds) {
        const safeId = Math.floor(Number(releaseId));
        if (!Number.isFinite(safeId) || safeId <= 0) continue;
        seenIds.add(safeId);
    }
    saveSeenAnnouncementIds(seenIds);
};
