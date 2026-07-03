import {
    buildRedirectUri,
    clearOAuthStateCookie,
    getSpotifyConfig,
    json,
    readOAuthState,
    requestTokenByCode,
    setTokenCookie,
} from "./_utils";

import type { SpotifyEnv } from "./_utils";

export const onRequestGet: PagesFunction<SpotifyEnv> = async (context) => {
    const config = getSpotifyConfig(context.env);
    if (!config) {
        return json(
            { error: "Spotify連携のサーバー設定が未完了です。" },
            503,
        );
    }

    const requestUrl = new URL(context.request.url);
    const code = String(requestUrl.searchParams.get("code") ?? "").trim();
    const state = String(requestUrl.searchParams.get("state") ?? "").trim();

    if (!code || !state) {
        return json({ error: "Spotify認証パラメータが不足しています。" }, 400);
    }

    const storedState = readOAuthState(context.request);
    if (!storedState || storedState.state !== state) {
        return json({ error: "Spotify認証のstate検証に失敗しました。" }, 400);
    }

    try {
        const token = await requestTokenByCode({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            code,
            redirectUri: buildRedirectUri(context.request.url, context.env),
        });
        const origin = requestUrl.origin;
        const returnTo = storedState.returnTo || "/";
        const redirectTo = `${origin}${returnTo.startsWith("/") ? returnTo : "/"}`;
        const response = Response.redirect(redirectTo, 302);
        setTokenCookie(response, token);
        clearOAuthStateCookie(response);
        return response;
    } catch {
        return json(
            {
                error: "Spotify認証に失敗しました。",
            },
            500,
        );
    }
};

export const onRequestPost: PagesFunction<SpotifyEnv> = async () =>
    json({ error: "Method Not Allowed" }, 405);
