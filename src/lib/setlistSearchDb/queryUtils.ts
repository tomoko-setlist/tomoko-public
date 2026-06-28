import type { AnnouncementKind } from "./types";

export const toInt = (value: unknown): number => Number(value ?? 0);

export const toText = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") {
        const normalized = value.trim();
        if (
            normalized.toLowerCase() === "null" ||
            normalized.toLowerCase() === "undefined"
        ) {
            return "";
        }
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return "";
};

export const toSafePositiveInt = (value: number): number => {
    const safe = Math.trunc(value);
    return Number.isFinite(safe) && safe > 0 ? safe : -1;
};

export const clampInt = (
    value: number,
    min: number,
    max: number,
): number => {
    const normalized = Math.floor(value);
    return Math.max(min, Math.min(max, normalized));
};

export const parseCsvTags = (value: string): string[] =>
    value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

export const parseAnnouncementKind = (value: unknown): AnnouncementKind => {
    const normalized = toText(value).toLowerCase();
    return normalized === "notice" ? "notice" : "release";
};

export const escapeSqlLiteral = (value: string): string =>
    value.replace(/'/g, "''");

export const escapePattern = (value: string): string =>
    `%${escapeSqlLiteral(value.trim())}%`;

export const splitTerms = (value: string): string[] =>
    value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

export const splitIntegerTerms = (value: string): number[] =>
    splitTerms(value)
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0);

export const hasText = (value: string): boolean => value.trim().length > 0;

export const splitNormalizedPerformerKeys = (
    value: string,
): Array<{ key: string; kind: "person" | "group"; id: number }> =>
    splitTerms(value)
        .map((item) => {
            const normalized = item.trim();
            const match = normalized.match(/^([pg]):(\d+)$/i);
            if (!match) return null;
            const kind = match[1]?.toLowerCase() === "g" ? "group" : "person";
            const id = Number(match[2]);
            if (!Number.isInteger(id) || id <= 0) return null;
            return {
                key: `${kind === "group" ? "g" : "p"}:${id}`,
                kind,
                id,
            };
        })
        .filter(
            (
                item,
            ): item is { key: string; kind: "person" | "group"; id: number } =>
                item !== null,
        );
