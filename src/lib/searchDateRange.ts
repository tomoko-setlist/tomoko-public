import type { SearchDateMode } from "./setlistSearchDb/types";

export const SEARCH_MIN_YEAR = 1997;
export const SEARCH_MIN_DATE = `${SEARCH_MIN_YEAR}-01-01`;

export type SearchDateRange = {
    dateFrom: string;
    dateTo: string;
};

export const pad2 = (value: number): string => String(value).padStart(2, "0");

export const formatYmd = (date: Date): string =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const getSearchMaxYear = (now = new Date()): number =>
    new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).getFullYear();

export const getSearchMaxDate = (now = new Date()): string =>
    `${getSearchMaxYear(now)}-12-31`;

export const getSearchYearOptions = (now = new Date()): number[] => {
    const maxYear = getSearchMaxYear(now);
    return Array.from({ length: maxYear - SEARCH_MIN_YEAR + 1 }, (_, index) => maxYear - index);
};

export const parseFlexibleYmd = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const match =
        trimmed.match(/^(\d{4})(\d{2})(\d{2})$/) ??
        trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const parsed = new Date(year, month - 1, day);
    if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day
    ) {
        return null;
    }
    return `${year}-${pad2(month)}-${pad2(day)}`;
};

export const clampYmd = (value: string, now = new Date()): string => {
    const maxDate = getSearchMaxDate(now);
    if (value < SEARCH_MIN_DATE) return SEARCH_MIN_DATE;
    if (value > maxDate) return maxDate;
    return value;
};

export const normalizeDateRange = (
    range: SearchDateRange,
    now = new Date(),
): SearchDateRange => {
    const parsedFrom = range.dateFrom ? parseFlexibleYmd(range.dateFrom) : "";
    const parsedTo = range.dateTo ? parseFlexibleYmd(range.dateTo) : "";
    let dateFrom = parsedFrom ? clampYmd(parsedFrom, now) : "";
    let dateTo = parsedTo ? clampYmd(parsedTo, now) : "";
    if (dateFrom && dateTo && dateFrom > dateTo) {
        [dateFrom, dateTo] = [dateTo, dateFrom];
    }
    return { dateFrom, dateTo };
};

export const normalizeDateRangeInputs = (
    rawFrom: string,
    rawTo: string,
    now = new Date(),
): { ok: true; range: SearchDateRange } | { ok: false } => {
    const parsedFrom = parseFlexibleYmd(rawFrom);
    const parsedTo = parseFlexibleYmd(rawTo);
    if (parsedFrom === null || parsedTo === null) return { ok: false };
    return {
        ok: true,
        range: normalizeDateRange(
            {
                dateFrom: parsedFrom,
                dateTo: parsedTo,
            },
            now,
        ),
    };
};

const getDateYear = (value: string): number | null => {
    const match = value.match(/^(\d{4})-\d{2}-\d{2}$/);
    if (!match) return null;
    const year = Number(match[1]);
    return Number.isInteger(year) ? year : null;
};

export const clampYear = (year: number, now = new Date()): number =>
    Math.max(SEARCH_MIN_YEAR, Math.min(getSearchMaxYear(now), year));

export const yearRangeToDateRange = (
    startYear: string,
    endYear: string,
    now = new Date(),
): SearchDateRange => {
    const rawStart = Number(startYear);
    const rawEnd = Number(endYear);
    const parsedStart = startYear && Number.isFinite(rawStart) ? clampYear(rawStart, now) : null;
    const parsedEnd = endYear && Number.isFinite(rawEnd) ? clampYear(rawEnd, now) : null;
    let fromYear = parsedStart;
    let toYear = parsedEnd;
    if (fromYear !== null && toYear !== null && fromYear > toYear) {
        [fromYear, toYear] = [toYear, fromYear];
    }
    return {
        dateFrom: fromYear !== null ? `${fromYear}-01-01` : "",
        dateTo: toYear !== null ? `${toYear}-12-31` : "",
    };
};

export const dateRangeToYearRange = (
    range: SearchDateRange,
    now = new Date(),
): { startYear: string; endYear: string } => {
    const normalized = normalizeDateRange(range, now);
    const fromYear = normalized.dateFrom ? getDateYear(normalized.dateFrom) : null;
    const toYear = normalized.dateTo ? getDateYear(normalized.dateTo) : null;
    return {
        startYear: fromYear !== null ? String(clampYear(fromYear, now)) : "",
        endYear: toYear !== null ? String(clampYear(toYear, now)) : "",
    };
};

export const coerceDateRangeForMode = (
    mode: SearchDateMode,
    range: SearchDateRange,
    now = new Date(),
): SearchDateRange => {
    if (mode === "date") return normalizeDateRange(range, now);
    const years = dateRangeToYearRange(range, now);
    return yearRangeToDateRange(years.startYear, years.endYear, now);
};

const addYearsClamped = (date: Date, delta: number): Date => {
    const year = date.getFullYear() + delta;
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(date.getDate(), lastDay));
};

export const getPresetDateRange = (
    preset: "thisYear" | "last1Year" | "last5Years" | "last10Years",
    now = new Date(),
): SearchDateRange => {
    if (preset === "thisYear") {
        const year = now.getFullYear();
        return normalizeDateRange({ dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` }, now);
    }
    const years = preset === "last1Year" ? 1 : preset === "last5Years" ? 5 : 10;
    return normalizeDateRange(
        {
            dateFrom: formatYmd(addYearsClamped(now, -years)),
            dateTo: formatYmd(now),
        },
        now,
    );
};

export const formatDateRangeLabel = ({ dateFrom, dateTo }: SearchDateRange): string => {
    if (dateFrom && dateTo) return dateFrom === dateTo ? dateFrom : `${dateFrom}〜${dateTo}`;
    if (dateFrom) return `${dateFrom}〜`;
    if (dateTo) return `〜${dateTo}`;
    return "";
};
