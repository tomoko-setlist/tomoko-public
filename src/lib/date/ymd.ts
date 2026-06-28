const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isValidLocalDateParts = (year: number, month: number, day: number): boolean => {
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
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
};

export const parseYmdLocalStart = (value: unknown): Date | null => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string" && typeof value !== "number") return null;
    const text = String(value).trim();
    if (!text) return null;
    const match = text.match(YMD_PATTERN);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!isValidLocalDateParts(year, month, day)) return null;
    return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const parseYmdLocalEnd = (value: unknown): Date | null => {
    const start = parseYmdLocalStart(value);
    if (!start) return null;
    return new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        23,
        59,
        59,
        999,
    );
};
