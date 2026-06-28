export const DB_REFRESH_EVENT = "tomoko:db-refreshed";

export function dispatchDbRefreshedEvent(): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(DB_REFRESH_EVENT));
}

