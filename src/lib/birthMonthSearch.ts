export const BIRTH_MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: `${index + 1}月`,
}));

export const parseBirthMonthsCsv = (value: string | null | undefined): number[] => {
    const seen = new Set<number>();
    const months: number[] = [];
    for (const part of String(value ?? "").split(",")) {
        const month = Number.parseInt(part.trim(), 10);
        if (!Number.isInteger(month) || month < 1 || month > 12 || seen.has(month)) continue;
        seen.add(month);
        months.push(month);
    }
    return months.sort((left, right) => left - right);
};

export const formatBirthMonthsLabel = (value: string): string => {
    const months = parseBirthMonthsCsv(value);
    if (months.length === 0) return "";
    return months.map((month) => `${month}月`).join(", ");
};
