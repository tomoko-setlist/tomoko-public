import type { RelatedEventRow } from "../../lib/setlistSearchDb/types";

export type RelatedEventStats = {
    eventCount: number;
    stageCount: number;
};

export function summarizeRelatedEvents(
    rows: RelatedEventRow[],
): RelatedEventStats {
    const eventIds = new Set<number>();
    let stageCount = 0;

    rows.forEach((row) => {
        eventIds.add(row.eventId);
        stageCount += Math.max(0, row.stageCount);
    });

    return {
        eventCount: eventIds.size,
        stageCount,
    };
}
