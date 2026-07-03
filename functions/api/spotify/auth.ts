import {
    SPOTIFY_SCOPES,
    buildRedirectUri,
    getSpotifyConfig,
    json,
    randomString,
    setOAuthStateCookie,
} from "./_utils";

import type { SpotifyEnv } from "./_utils";

export const onRequestGet: PagesFunction<SpotifyEnv> = async (context) => {
    const config = getSpotifyConfig(context.env);
    if (!config) {
        return json(
            {
                error: "Spotify連携のサーバー設定が未完了です。",
            },
            503,
        );
    }

    const url = new URL(context.request.url);
    const returnRaw = String(url.searchParams.get("return") ?? "/").trim();
    const normalizedReturn = returnRaw.startsWith("#/")
        ? returnRaw.slice(1)
        : returnRaw;
    const returnTo = normalizedReturn.startsWith("/")
        ? normalizedReturn
        : "/";
    const state = randomString(32);
    const redirectUri = buildRedirectUri(context.request.url, context.env);

    const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", SPOTIFY_SCOPES.join(" "));
    authorizeUrl.searchParams.set("state", state);

    const response = Response.redirect(authorizeUrl.toString(), 302);
    setOAuthStateCookie(response, state, returnTo);
    return response;
};

export const onRequestPost: PagesFunction<SpotifyEnv> = async () =>
    json({ error: "Method Not Allowed" }, 405);
