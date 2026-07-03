const ALLOWED_ORIGIN_HOSTS = new Set([
    "hp-setlist.com",
    "www.hp-setlist.com",
    "tomoko-duc.pages.dev",
    "localhost",
    "127.0.0.1",
]);

export const withSecurityHeaders = (
    response: Response,
    request?: Request,
): Response => {
    const next = new Response(response.body, response);
    const headers = next.headers;

    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (request) {
        const url = new URL(request.url);
        if (url.protocol === "https:") {
            headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }
    }

    return next;
};

export const rejectDisallowedOrigin = (request: Request): Response | null => {
    const origin = request.headers.get("Origin");
    if (!origin) {
        return null;
    }
    if (isAllowedOrigin(origin, request.url)) {
        return null;
    }
    return json({ error: "Origin が許可されていません。" }, 403);
};

export const rejectInvalidJsonRequest = (
    request: Request,
    maxContentLength: number,
): Response | null => {
    const contentType = String(request.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("application/json")) {
        return json({ error: "content-type は application/json を指定してください。" }, 415);
    }
    const contentLength = toFiniteInt(request.headers.get("content-length"));
    if (contentLength !== null && contentLength > maxContentLength) {
        return json({ error: "リクエストサイズが大きすぎます。" }, 413);
    }
    return null;
};

export const toFiniteInt = (value: unknown): number | null => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.trunc(num);
};

export function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
        },
    });
}

const isAllowedOrigin = (origin: string, requestUrl: string): boolean => {
    try {
        const originUrl = new URL(origin);
        const url = new URL(requestUrl);
        if (originUrl.origin === url.origin) {
            return true;
        }
        return ALLOWED_ORIGIN_HOSTS.has(originUrl.hostname.toLowerCase());
    } catch {
        return false;
    }
};
