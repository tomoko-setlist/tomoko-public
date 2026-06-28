import { useEffect, useState } from "react";

import type {
    EventDetail,
    PerformerSummaryRow,
    SetlistSearchDb,
    StageDetail,
} from "../../../lib/setlistSearchDb/types";

type EventDetailState = {
    loading: boolean;
    error: string;
    event: EventDetail | null;
    stages: StageDetail[];
    performers: PerformerSummaryRow[];
};

export function useEventDetail(db: SetlistSearchDb, eventId: number): EventDetailState {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [event, setEvent] = useState<EventDetail | null>(null);
    const [stages, setStages] = useState<StageDetail[]>([]);
    const [performers, setPerformers] = useState<PerformerSummaryRow[]>([]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError("");
            try {
                await db.whenDetailReady;
                const [eventResult, stageRows, performerRows] = await Promise.all([
                    db.getEventDetail(eventId),
                    db.getEventStages(eventId),
                    db.getEventPerformers(eventId),
                ]);
                if (!cancelled) {
                    setEvent(eventResult);
                    setStages(stageRows);
                    setPerformers(performerRows);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db, eventId]);

    return { loading, error, event, stages, performers };
}
