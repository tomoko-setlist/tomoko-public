import type { AppRoute } from "./appRoute";

export const INITIAL_DETAIL_DATA_SCRIPT_ID = "tomoko-initial-detail";

export type InitialDetailRouteName = "song" | "event" | "member" | "group";

export type InitialDetailDataItem = {
    label: string;
    value: string;
};

export type InitialDetailDataLink = {
    href: string;
    label: string;
};

export type InitialDetailData = {
    route: {
        name: InitialDetailRouteName;
        id: number;
    };
    title: string;
    description: string;
    summary: InitialDetailDataItem[];
    stats: InitialDetailDataItem[];
    links: InitialDetailDataLink[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const asString = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value : null;

const asItems = (value: unknown): InitialDetailDataItem[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!isRecord(item)) return [];
        const label = asString(item.label);
        const itemValue = asString(item.value);
        if (!label || !itemValue) return [];
        return [{ label, value: itemValue }];
    });
};

const asLinks = (value: unknown): InitialDetailDataLink[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!isRecord(item)) return [];
        const href = asString(item.href);
        const label = asString(item.label);
        if (!href || !label) return [];
        if (!href.startsWith("/") || href.startsWith("//")) return [];
        return [{ href, label }];
    });
};

export function parseInitialDetailData(value: unknown): InitialDetailData | null {
    if (!isRecord(value) || !isRecord(value.route)) return null;
    const routeName = value.route.name;
    if (
        routeName !== "song" &&
        routeName !== "event" &&
        routeName !== "member" &&
        routeName !== "group"
    ) {
        return null;
    }
    const id = Number(value.route.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    const title = asString(value.title);
    const description = asString(value.description);
    if (!title || !description) return null;
    return {
        route: {
            name: routeName,
            id: Math.floor(id),
        },
        title,
        description,
        summary: asItems(value.summary),
        stats: asItems(value.stats),
        links: asLinks(value.links),
    };
}

export function getInitialDetailDataForRoute(route: AppRoute): InitialDetailData | null {
    if (!("id" in route)) return null;
    if (
        route.name !== "song" &&
        route.name !== "event" &&
        route.name !== "member" &&
        route.name !== "group"
    ) {
        return null;
    }
    if (typeof document === "undefined") return null;
    const node = document.getElementById(INITIAL_DETAIL_DATA_SCRIPT_ID);
    const text = node?.textContent;
    if (!text) return null;
    try {
        const data = parseInitialDetailData(JSON.parse(text));
        if (!data) return null;
        if (data.route.name !== route.name || data.route.id !== route.id) {
            return null;
        }
        return data;
    } catch {
        return null;
    }
}
