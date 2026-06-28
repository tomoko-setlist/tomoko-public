export type ReportIssuePayload = {
    message: string;
    pageUrl: string;
    pageTitle: string;
    routeName: string;
    routeId: number | null;
};

export async function submitIssueReport(payload: ReportIssuePayload): Promise<void> {
    const response = await fetch("/api/report", {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let message = `報告の送信に失敗しました (${response.status})`;
        try {
            const json = (await response.json()) as { error?: string };
            if (json?.error) {
                message = json.error;
            }
        } catch {
            // ignore response parse error
        }
        throw new Error(message);
    }
}

