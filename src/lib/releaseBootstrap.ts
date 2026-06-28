const CLIENT_RELEASE_TOKEN_STORAGE_KEY = "tomoko-duc-client-release-token-v1";

const SEARCH_ROUTE_PATHS = new Set(["/", "/song-search", "/member-search", "/index.html"]);

const normalizePathname = (pathname: string): string => {
    if (!pathname) return "/";
    if (pathname === "/") return pathname;
    return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
};

const getCurrentReleaseToken = (): string => {
    const raw = (import.meta.env as Record<string, unknown>).VITE_APP_RELEASE_TOKEN;
    if (typeof raw !== "string") {
        return "unknown";
    }
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : "unknown";
};

export function consumeClientReleaseChange(): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    const currentToken = getCurrentReleaseToken();
    try {
        const previousToken = window.localStorage.getItem(
            CLIENT_RELEASE_TOKEN_STORAGE_KEY,
        );
        if (!previousToken) {
            window.localStorage.setItem(
                CLIENT_RELEASE_TOKEN_STORAGE_KEY,
                currentToken,
            );
            return false;
        }
        if (previousToken === currentToken) {
            return false;
        }
        window.localStorage.setItem(CLIENT_RELEASE_TOKEN_STORAGE_KEY, currentToken);
        return true;
    } catch {
        return false;
    }
}

export function clearSearchRouteQueryIfNeeded(): void {
    if (typeof window === "undefined") {
        return;
    }
    const normalizedPathname = normalizePathname(window.location.pathname);
    if (!SEARCH_ROUTE_PATHS.has(normalizedPathname)) {
        return;
    }
    if (!window.location.search) {
        return;
    }
    window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.hash}`,
    );
}
