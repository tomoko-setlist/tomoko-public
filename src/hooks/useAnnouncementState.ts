import { useEffect, useState } from "react";

import {
    getUnreadRecentAnnouncementCount,
    listRecentAnnouncementIds,
    markAnnouncementsSeen,
} from "../lib/announcementNotifications";

import type { AppRoute } from "../lib/appRoute";
import type {
    ReleaseNoteSummary,
    SetlistSearchDb,
} from "../lib/setlistSearchDb/types";

const RELEASE_NOTES_FETCH_LIMIT = 200;

export function useAnnouncementState({
    db,
    route,
}: {
    db: SetlistSearchDb | null;
    route: AppRoute;
}) {
    const [announcementRows, setAnnouncementRows] = useState<ReleaseNoteSummary[]>([]);
    const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);

    const syncAnnouncementUnreadCount = (rows: ReleaseNoteSummary[]) => {
        setAnnouncementUnreadCount(getUnreadRecentAnnouncementCount(rows));
    };

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!db?.listReleaseNotes) {
                if (!cancelled) {
                    setAnnouncementRows([]);
                    setAnnouncementUnreadCount(0);
                }
                return;
            }
            try {
                const rows = await db.listReleaseNotes(RELEASE_NOTES_FETCH_LIMIT);
                if (cancelled) return;
                setAnnouncementRows(rows);
                syncAnnouncementUnreadCount(rows);
            } catch {
                if (!cancelled) {
                    setAnnouncementRows([]);
                    setAnnouncementUnreadCount(0);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [db]);

    useEffect(() => {
        if (announcementRows.length === 0) {
            return;
        }
        let cancelled = false;
        const run = async () => {
            if (route.name === "releases") {
                const ids = listRecentAnnouncementIds(announcementRows);
                if (ids.length === 0) return;
                markAnnouncementsSeen(ids);
            } else if (route.name === "release") {
                markAnnouncementsSeen([route.id]);
            } else {
                return;
            }

            await Promise.resolve();
            if (!cancelled) {
                syncAnnouncementUnreadCount(announcementRows);
            }
        };
        void run();

        return () => {
            cancelled = true;
        };
    }, [announcementRows, route]);

    return {
        announcementUnreadCount,
    };
}
