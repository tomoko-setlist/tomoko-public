export type SpotifyTrackSeed = {
    songName: string;
    artistName?: string | null;
};

export type SpotifyCreatePlaylistInput = {
    playlistName: string;
    description?: string;
    tracks: SpotifyTrackSeed[];
    isPublic?: boolean;
};

export type SpotifyCreatePlaylistResult = {
    playlistId: string;
    playlistUrl: string | null;
    addedCount: number;
    unresolvedTracks: SpotifyTrackSeed[];
};

type SpotifyApiError = {
    error?: string;
};

export const isSpotifyPremiumRequiredError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes("active premium subscription required");
};

export const isSpotifyPlaylistAvailable = (): boolean => true;

export const beginSpotifyAuth = (): Promise<void> => {
    if (typeof window === "undefined") return Promise.resolve();
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const url = `/api/spotify/auth?return=${encodeURIComponent(returnTo || "/")}`;
    window.location.assign(url);
    return Promise.resolve();
};

export const tryHandleSpotifyAuthCallback = (): Promise<boolean> =>
    Promise.resolve(false);

export const createSpotifyPlaylistFromTracks = async (
    input: SpotifyCreatePlaylistInput,
): Promise<SpotifyCreatePlaylistResult> => {
    const response = await fetch("/api/spotify/create-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    if (!response.ok) {
        let error = `Spotify API ${response.status}`;
        try {
            const payload = (await response.json()) as SpotifyApiError;
            if (typeof payload.error === "string" && payload.error.trim()) {
                error = payload.error;
            }
        } catch {
            // ignore
        }
        throw new Error(error);
    }

    return (await response.json()) as SpotifyCreatePlaylistResult;
};
