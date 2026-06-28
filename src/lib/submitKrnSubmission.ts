export type KrnSubmissionEntryPayload = {
    lineOrder: number;
    musicOrder: number | null;
    section: string;
    displayName: string;
    isMc: boolean;
    isMedley: boolean;
    isNewSong: boolean;
    note: string;
    songId: number | null;
    songVersionId: number | null;
    songArtistId?: number | null;
    artistName: string;
    performers: string[];
    performersNormalized?: Array<{
        performerName: string;
        personId: number | null;
        groupId: number | null;
    }>;
};

export type KrnSubmissionPayload = {
    routeName: "krn";
    routeId: null;
    eventName: string;
    stageDate: string;
    startTime: string;
    venueName: string;
    pattern: string;
    stageId: number | null;
    eventId: number | null;
    outputFormat: string;
    notifyTomoko: boolean;
    options: {
        includeEvent: boolean;
        includeArtist: boolean;
        includePerformer: boolean;
        performerDelimiter: string;
        artistDisplayMode?: "hidden" | "inline" | "newline";
        artistInlineStyle?: "slash" | "dot" | "square" | "round";
        artistPrefixCustom?: string;
        performerDisplayMode?: "hidden" | "inline" | "newline";
        performerInlineStyle?: "slash" | "dot" | "square" | "round";
        performerPrefixCustom?: string;
    };
    exportPreview: string;
    entries: KrnSubmissionEntryPayload[];
};

type KrnSubmissionResponse = {
    ok: true;
    id: number;
    lineCount: number;
    musicCount: number;
};

export async function submitKrnSubmission(
    payload: KrnSubmissionPayload,
): Promise<KrnSubmissionResponse> {
    const response = await fetch("/api/intake/krn-submissions", {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let message = `ToMoKo送信に失敗しました (${response.status})`;
        try {
            const raw = await response.text();
            if (raw) {
                try {
                    const json = JSON.parse(raw) as { error?: string };
                    if (json?.error) {
                        message = json.error;
                    } else {
                        message = `${message}: ${raw}`;
                    }
                } catch {
                    message = `${message}: ${raw}`;
                }
            }
        } catch {
            // ignore parse error
        }
        throw new Error(message);
    }

    return (await response.json()) as KrnSubmissionResponse;
}
