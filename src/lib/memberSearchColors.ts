type MemberSearchColor = {
    colorCode: string;
    colorName: string | null;
    startDate?: string | null;
    endDate?: string | null;
};

const parseStartMs = (value: string | null | undefined): number => {
    const text = (value ?? "").trim();
    if (!text) return 0;
    const parsed = Date.parse(text.includes("T") ? text : `${text.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const pickDisplayMemberColors = (colors: MemberSearchColor[]): MemberSearchColor[] => {
    const seen = new Set<string>();
    return [...colors]
        .sort((left, right) => parseStartMs(right.startDate) - parseStartMs(left.startDate))
        .filter((color) => {
            const key = `${color.colorCode}|${color.colorName ?? ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

export const normalizeHexColor = (value: string): string => {
    const color = value.trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : "#94a3b8";
};
