import { parseDateTimeUtc, parseYmd } from "./date/standards";

const JST_TIME_ZONE = "Asia/Tokyo";

const jstYmdFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

const normalizeText = (value: string | null | undefined): string => {
    if (!value) return "";
    const text = value.trim();
    if (!text) return "";
    const lowered = text.toLowerCase();
    if (lowered === "null" || lowered === "undefined") return "";
    return text;
};

const parseJstYmdParts = (
    value: string | null | undefined,
): { year: number; month: number; day: number } | null => {
    const text = normalizeText(value);
    if (!text) return null;

    const strictDate = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (strictDate) {
        const ymd = `${strictDate[1]}-${strictDate[2].padStart(2, "0")}-${strictDate[3].padStart(2, "0")}`;
        return parseYmd(ymd);
    }

    const parsed = parseDateTimeUtc(text);
    if (parsed) {
        return parseYmd(jstYmdFormatter.format(parsed));
    }

    const matched = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (matched) {
        const ymd = `${matched[1]}-${matched[2].padStart(2, "0")}-${matched[3].padStart(2, "0")}`;
        return parseYmd(ymd);
    }

    return null;
};

const getTodayJstYmdParts = (): { year: number; month: number; day: number } => {
    const parts = parseYmd(jstYmdFormatter.format(new Date()));
    if (!parts) {
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
        };
    }
    return parts;
};

export const calculateAgeYears = (
    birthday: string | null | undefined,
    asOf: string | null | undefined = undefined,
): number | null => {
    const birth = parseJstYmdParts(birthday);
    if (!birth) return null;

    const reference = asOf ? parseJstYmdParts(asOf) : getTodayJstYmdParts();
    if (!reference) return null;

    let age = reference.year - birth.year;
    if (
        reference.month < birth.month ||
        (reference.month === birth.month && reference.day < birth.day)
    ) {
        age -= 1;
    }

    return age >= 0 ? age : null;
};

export const formatAgeYears = (
    birthday: string | null | undefined,
    asOf?: string | null  ,
): string => {
    const age = calculateAgeYears(birthday, asOf);
    return age === null ? "-" : String(age);
};

export const formatMemberAgeLabel = (
    birthday: string | null | undefined,
    deathday?: string | null  ,
): string => {
    if (deathday) {
        const age = calculateAgeYears(birthday, deathday);
        return age === null ? "-" : `享年${age}歳`;
    }
    const age = calculateAgeYears(birthday);
    return age === null ? "-" : `${age}歳`;
};
