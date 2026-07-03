export type SpotifyEnv = {
    SPOTIFY_CLIENT_ID?: string;
    SPOTIFY_CLIENT_SECRET?: string;
    SPOTIFY_REDIRECT_URI?: string;
};

export type SpotifyTokenStore = {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
};

export type SpotifyTrackSeed = {
    songName: string;
    artistName?: string | null;
};

const TOKEN_COOKIE_KEY = "tmk_sp_token";
const STATE_COOKIE_KEY = "tmk_sp_state";

export const SPOTIFY_SCOPES = [
    "playlist-modify-public",
    "playlist-modify-private",
];

export function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
        },
    });
}

export function getSpotifyConfig(env: SpotifyEnv): {
    clientId: string;
    clientSecret: string;
} | null {
    const clientId = String(env.SPOTIFY_CLIENT_ID ?? "").trim();
    const clientSecret = String(env.SPOTIFY_CLIENT_SECRET ?? "").trim();
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
}

export function buildRedirectUri(requestUrl: string, env: SpotifyEnv): string {
    const configured = String(env.SPOTIFY_REDIRECT_URI ?? "").trim();
    if (configured) return configured;
    const url = new URL(requestUrl);
    return `${url.origin}/api/spotify/callback`;
}

function parseCookies(header: string | null): Record<string, string> {
    if (!header) return {};
    const out: Record<string, string> = {};
    const parts = header.split(";");
    for (const part of parts) {
        const i = part.indexOf("=");
        if (i <= 0) continue;
        const key = part.slice(0, i).trim();
        const value = part.slice(i + 1).trim();
        if (!key) continue;
        out[key] = decodeURIComponent(value);
    }
    return out;
}

function serializeCookie(
    name: string,
    value: string,
    opts?: {
        maxAge?: number;
        path?: string;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "Lax" | "Strict" | "None";
    },
): string {
    const path = opts?.path ?? "/";
    const secure = opts?.secure ?? true;
    const sameSite = opts?.sameSite ?? "Lax";
    const chunks = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`];
    if (typeof opts?.maxAge === "number") chunks.push(`Max-Age=${opts.maxAge}`);
    if (opts?.httpOnly !== false) chunks.push("HttpOnly");
    if (secure) chunks.push("Secure");
    chunks.push(`SameSite=${sameSite}`);
    return chunks.join("; ");
}

export function readOAuthState(request: Request): {
    state: string;
    returnTo: string;
} | null {
    const cookies = parseCookies(request.headers.get("Cookie"));
    const raw = cookies[STATE_COOKIE_KEY];
    if (!raw) return null;
    try {
        const parsed = JSON.parse(atob(raw)) as {
            state?: string;
            returnTo?: string;
            returnHash?: string;
        };
        const state = String(parsed.state ?? "").trim();
        const returnToRaw =
            String(parsed.returnTo ?? "").trim() ||
            String(parsed.returnHash ?? "").trim() ||
            "/";
        const returnTo = returnToRaw.startsWith("/") ? returnToRaw : "/";
        if (!state) return null;
        return { state, returnTo };
    } catch {
        return null;
    }
}

export function setOAuthStateCookie(
    response: Response,
    state: string,
    returnTo: string,
): void {
    const payload = btoa(JSON.stringify({ state, returnTo }));
    response.headers.append(
        "Set-Cookie",
        serializeCookie(STATE_COOKIE_KEY, payload, {
            maxAge: 60 * 10,
            httpOnly: true,
            secure: true,
        }),
    );
}

export function clearOAuthStateCookie(response: Response): void {
    response.headers.append(
        "Set-Cookie",
        serializeCookie(STATE_COOKIE_KEY, "", {
            maxAge: 0,
            httpOnly: true,
            secure: true,
        }),
    );
}

export function readTokenStore(request: Request): SpotifyTokenStore | null {
    const cookies = parseCookies(request.headers.get("Cookie"));
    const raw = cookies[TOKEN_COOKIE_KEY];
    if (!raw) return null;
    try {
        const parsed = JSON.parse(atob(raw)) as SpotifyTokenStore;
        if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function setTokenCookie(response: Response, token: SpotifyTokenStore): void {
    const payload = btoa(JSON.stringify(token));
    response.headers.append(
        "Set-Cookie",
        serializeCookie(TOKEN_COOKIE_KEY, payload, {
            maxAge: 60 * 60 * 24 * 30,
            httpOnly: true,
            secure: true,
        }),
    );
}

export async function requestTokenByCode(args: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
}): Promise<SpotifyTokenStore> {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: args.redirectUri,
        client_id: args.clientId,
        client_secret: args.clientSecret,
    });
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Spotify token exchange failed: ${response.status} ${text}`);
    }
    const token = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
    };
    return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + Math.max(60, token.expires_in - 30) * 1000,
    };
}

export async function refreshToken(args: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
}): Promise<SpotifyTokenStore> {
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: args.refreshToken,
        client_id: args.clientId,
        client_secret: args.clientSecret,
    });
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Spotify token refresh failed: ${response.status} ${text}`);
    }
    const token = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
    };
    return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? args.refreshToken,
        expiresAt: Date.now() + Math.max(60, token.expires_in - 30) * 1000,
    };
}

export async function spotifyApi<T>(
    accessToken: string,
    path: string,
    init: RequestInit,
): Promise<T> {
    const response = await fetch(`https://api.spotify.com/v1${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...(init.headers ?? {}),
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Spotify API ${response.status}: ${text}`);
    }
    return (await response.json()) as T;
}

export async function searchTrackUri(
    accessToken: string,
    track: SpotifyTrackSeed,
): Promise<string | null> {
    const query = [track.songName.trim(), track.artistName?.trim() ?? ""]
        .filter(Boolean)
        .join(" ");
    if (!query) return null;
    const payload = await spotifyApi<{
        tracks?: {
            items?: Array<{
                uri?: string;
                name?: string;
                artists?: Array<{ name?: string }>;
            }>;
        };
    }>(accessToken, `/search?q=${encodeURIComponent(query)}&type=track&market=JP&limit=5`, {
        method: "GET",
    });

    const items = payload.tracks?.items ?? [];
    if (items.length === 0) return null;

    const songNameLower = track.songName.toLowerCase();
    const artistLower = (track.artistName ?? "").toLowerCase();
    const best =
        items.find((item) => {
            const itemSong = (item.name ?? "").toLowerCase();
            const itemArtists = (item.artists ?? [])
                .map((artist) => artist.name ?? "")
                .join(" ")
                .toLowerCase();
            return (
                itemSong.includes(songNameLower) &&
                (!artistLower || itemArtists.includes(artistLower))
            );
        }) ?? items[0];
    return best.uri ?? null;
}

export function randomString(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}
