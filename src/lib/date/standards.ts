const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NAIVE_DATETIME_PATTERN =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/;

const JST_UTC_OFFSET_HOURS = 9;
const JST_DATE_ANCHOR_UTC_HOUR = 3; // 12:00 JST

const isValidDateParts = (year: number, month: number, day: number): boolean => {
    if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        !Number.isFinite(day) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
    ) {
        return false;
    }
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
};

const parseEpochLike = (value: string): Date | null => {
    if (!/^\d{10,16}(?:\.\d+)?$/.test(value)) return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const integer = value.split(".")[0] ?? value;
    const ms = integer.length === 10 ? Math.trunc(num * 1000) : Math.trunc(num);
    const parsed = new Date(ms);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const parseDateTimeUtc = (value: unknown): Date | null => {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) return null;
        const ms = value < 1_000_000_000_000 ? Math.trunc(value * 1000) : Math.trunc(value);
        const parsed = new Date(ms);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (!text) return null;

    const epochParsed = parseEpochLike(text);
    if (epochParsed) return epochParsed;

    // timezone なし日時文字列は UTC として解釈する
    const naive = text.match(NAIVE_DATETIME_PATTERN);
    if (naive) {
        const withUtc = `${naive[1]}T${naive[2]}Z`;
        const parsedNaive = new Date(withUtc);
        if (!Number.isNaN(parsedNaive.getTime())) return parsedNaive;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const parseYmd = (value: unknown): { year: number; month: number; day: number } | null => {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const text = String(value).trim();
    const match = text.match(YMD_PATTERN);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!isValidDateParts(year, month, day)) return null;
    return { year, month, day };
};

export const ymdToJstNoonUtc = (value: unknown): Date | null => {
    const ymd = parseYmd(value);
    if (!ymd) return null;
    return new Date(
        Date.UTC(ymd.year, ymd.month - 1, ymd.day, JST_DATE_ANCHOR_UTC_HOUR, 0, 0, 0),
    );
};

export const parseJstTimeTextToUtc = (
    stageDateUtc: Date,
    timeText: string | null | undefined,
): Date | null => {
    const text = String(timeText ?? "").trim();
    if (!text) return null;
    const m = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
        const hour = Number(m[1]);
        const minute = Number(m[2]);
        const second = Number(m[3] ?? 0);
        if (
            Number.isFinite(hour) &&
            Number.isFinite(minute) &&
            Number.isFinite(second) &&
            hour >= 0 &&
            hour <= 23 &&
            minute >= 0 &&
            minute <= 59 &&
            second >= 0 &&
            second <= 59
        ) {
            return new Date(
                Date.UTC(
                    stageDateUtc.getUTCFullYear(),
                    stageDateUtc.getUTCMonth(),
                    stageDateUtc.getUTCDate(),
                    hour - JST_UTC_OFFSET_HOURS,
                    minute,
                    second,
                    0,
                ),
            );
        }
    }
    return parseDateTimeUtc(text);
};

export const toIsoUtc = (value: Date): string => value.toISOString();
