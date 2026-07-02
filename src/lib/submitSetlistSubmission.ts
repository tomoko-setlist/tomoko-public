export type SetlistSubmissionEntryPayload = {
    lineOrder: number;
    musicOrder: number | null;
    section?: string;
    displayName?: string;
    isMc?: boolean;
    isMedley?: boolean;
    note?: string;
    songName: string;
    songId?: number | null;
    songVersionId?: number | null;
    artistName?: string;
    performers: string;
    performersNormalized?: Array<{
        performerName: string;
        personId: number | null;
        groupId: number | null;
    }>;
};

export type SetlistSubmissionPayload = {
    submitterName: string;
    eventName: string;
    stageDate: string;
    startTime: string;
    venueName: string;
    pattern: string;
    stageId: number | null;
    eventId: number | null;
    pageUrl: string;
    entries: SetlistSubmissionEntryPayload[];
};

type SetlistSubmissionResponse = {
    ok: true;
    id: number;
    lineCount: number;
    musicCount: number;
};

export async function submitSetlistSubmission(
    payload: SetlistSubmissionPayload,
): Promise<SetlistSubmissionResponse> {
    const response = await fetch("/api/intake/setlist-submissions", {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let message = `送信に失敗しました (${response.status})`;
        try {
            const raw = await response.text();
            if (raw) {
                const parsed = JSON.parse(raw) as { error?: string };
                message = parsed.error || `${message}: ${raw}`;
            }
        } catch {
            // ignore parse errors
        }
        throw new Error(message);
    }

    return (await response.json()) as SetlistSubmissionResponse;
}
