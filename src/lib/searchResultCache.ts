const SEARCH_BOOTSTRAP_CACHE_KEY = "tomoko-duc.search-bootstrap-cache.v1";
const SONG_SEARCH_CACHE_KEY = "tomoko-song-search-cache-v1";
const SETLIST_SEARCH_STATE_KEY = "tomoko-duc.search-ui.v2";
const SONG_SEARCH_STATE_KEY = "tomoko-song-search-state-v4";
const MEMBER_SEARCH_STATE_KEY = "tomoko-member-search-state-v1";

export function clearSearchResultCaches(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.removeItem(SEARCH_BOOTSTRAP_CACHE_KEY);
    } catch {
        // ignore storage errors
    }
    try {
        window.sessionStorage.removeItem(SONG_SEARCH_CACHE_KEY);
    } catch {
        // ignore storage errors
    }
}

export function clearPersistedSearchStates(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.removeItem(SETLIST_SEARCH_STATE_KEY);
        window.localStorage.removeItem(SONG_SEARCH_STATE_KEY);
        window.localStorage.removeItem(MEMBER_SEARCH_STATE_KEY);
    } catch {
        // ignore storage errors
    }
}
