import {
    getSpotifyConfig,
    json,
    readTokenStore,
    refreshToken,
    searchTrackUri,
    setTokenCookie,
    spotifyApi,
} from "./_utils";
import {
    rejectDisallowedOrigin,
    rejectInvalidJsonRequest,
} from "../../_shared/security";

import type { SpotifyEnv, SpotifyTrackSeed, SpotifyTokenStore } from "./_utils";

type CreatePlaylistRequest = {
    playlistName?: string;
    description?: string;
    tracks?: SpotifyTrackSeed[];
    isPublic?: boolean;
};

const MAX_CONTENT_LENGTH = 64 * 1024;
const MAX_PLAYLIST_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_TRACKS = 200;
const MAX_TRACK_TEXT_LENGTH = 120;

export const onRequestPost: PagesFunction<SpotifyEnv> = async (context) => {
    const rejectedOrigin = rejectDisallowedOrigin(context.request);
    if (rejectedOrigin) return rejectedOrigin;
    const invalidJson = rejectInvalidJsonRequest(context.request, MAX_CONTENT_LENGTH);
    if (invalidJson) return invalidJson;

    const config = getSpotifyConfig(context.env);
    if (!config) {
        return json(
            { error: "Spotify連携のサーバー設定が未完了です。" },
            503,
        );
    }

    let body: CreatePlaylistRequest;
    try {
        body = (await context.request.json()) as CreatePlaylistRequest;
    } catch {
        return json({ error: "不正なリクエストです。" }, 400);
    }

    const playlistName = String(body.playlistName ?? "").trim();
    const description = String(body.description ?? "").trim();
    const tracks = Array.isArray(body.tracks) ? normalizeTracks(body.tracks) : [];

    if (!playlistName) {
        return json({ error: "playlistName が必要です。" }, 400);
    }
    if (playlistName.length > MAX_PLAYLIST_NAME_LENGTH) {
        return json({ error: `playlistName は${MAX_PLAYLIST_NAME_LENGTH}文字以内で指定してください。` }, 400);
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        return json({ error: `description は${MAX_DESCRIPTION_LENGTH}文字以内で指定してください。` }, 400);
    }
    if (tracks.length === 0) {
        return json({ error: "tracks が空です。" }, 400);
    }
    if (tracks.length > MAX_TRACKS) {
        return json({ error: `tracks が多すぎます (上限${MAX_TRACKS}件)。` }, 400);
    }

    let token = readTokenStore(context.request);
    if (!token) {
        return json({ error: "spotify_auth_required" }, 401);
    }

    try {
        token = await ensureToken(config.clientId, config.clientSecret, token);

        const me = await spotifyApi<{ id: string }>(
            token.accessToken,
            "/me",
            { method: "GET" },
        );

        const playlist = await spotifyApi<{
            id: string;
            external_urls?: { spotify?: string };
        }>(token.accessToken, `/users/${encodeURIComponent(me.id)}/playlists`, {
            method: "POST",
            body: JSON.stringify({
                name: playlistName,
                description,
                public: Boolean(body.isPublic),
            }),
        });

        const unresolvedTracks: SpotifyTrackSeed[] = [];
        const uris: string[] = [];
        const dedupe = new Set<string>();

        for (const track of tracks) {
            const uri = await searchTrackUri(token.accessToken, track);
            if (!uri) {
                unresolvedTracks.push(track);
                continue;
            }
            if (!dedupe.has(uri)) {
                dedupe.add(uri);
                uris.push(uri);
            }
        }

        for (let index = 0; index < uris.length; index += 100) {
            const chunk = uris.slice(index, index + 100);
            await spotifyApi(
                token.accessToken,
                `/playlists/${encodeURIComponent(playlist.id)}/tracks`,
                {
                    method: "POST",
                    body: JSON.stringify({ uris: chunk }),
                },
            );
        }

        const response = json({
            playlistId: playlist.id,
            playlistUrl: playlist.external_urls?.spotify ?? null,
            addedCount: uris.length,
            unresolvedTracks,
        });
        setTokenCookie(response, token);
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("401")) {
            return json({ error: "spotify_auth_required" }, 401);
        }
        return json({ error: "Spotifyプレイリストの作成に失敗しました。" }, 500);
    }
};

export const onRequestGet: PagesFunction<SpotifyEnv> = async () =>
    json({ error: "Method Not Allowed" }, 405);

async function ensureToken(
    clientId: string,
    clientSecret: string,
    token: SpotifyTokenStore,
): Promise<SpotifyTokenStore> {
    if (token.expiresAt > Date.now() + 5000) return token;
    return refreshToken({
        clientId,
        clientSecret,
        refreshToken: token.refreshToken,
    });
}

function normalizeTracks(tracks: SpotifyTrackSeed[]): SpotifyTrackSeed[] {
    return tracks
        .map((track) => ({
            songName: String(track.songName ?? "").trim().slice(0, MAX_TRACK_TEXT_LENGTH),
            artistName: String(track.artistName ?? "").trim().slice(0, MAX_TRACK_TEXT_LENGTH),
        }))
        .filter((track) => track.songName.length > 0);
}
