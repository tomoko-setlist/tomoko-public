export const MIN_VALID_HEIGHT_CM = 120;
export const MAX_VALID_HEIGHT_CM = 230;

export const normalizeHeightCm = (
    value: number | null | undefined,
): number | null => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return null;
    }
    const rounded = Math.round(value);
    if (rounded < MIN_VALID_HEIGHT_CM || rounded > MAX_VALID_HEIGHT_CM) {
        return null;
    }
    return rounded;
};

export const formatHeightCmDisplay = (
    value: number | null | undefined,
): string | null => {
    const normalized = normalizeHeightCm(value);
    return normalized === null ? null : `${normalized} cm`;
};
