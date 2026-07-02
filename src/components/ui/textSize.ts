export type TextSizeLevel =
    | "tiny"
    | "compact"
    | "small"
    | "standard"
    | "large"
    | "xlarge";

export const TEXT_SIZE_ORDER: TextSizeLevel[] = [
    "tiny",
    "compact",
    "small",
    "standard",
    "large",
    "xlarge",
];

export const TEXT_SIZE_LABELS: Record<TextSizeLevel, string> = {
    tiny: "極小",
    compact: "最小",
    small: "小",
    standard: "標準",
    large: "大",
    xlarge: "特大",
};

export const TEXT_SIZE_PREVIEW_CLASS: Record<TextSizeLevel, string> = {
    tiny: "text-[9px]",
    compact: "text-[10px]",
    small: "text-xs",
    standard: "text-sm",
    large: "text-base",
    xlarge: "text-lg",
};

export function normalizeTextSizeLevel(value: string | null | undefined): TextSizeLevel {
    return TEXT_SIZE_ORDER.includes(value as TextSizeLevel)
        ? (value as TextSizeLevel)
        : "standard";
}

export function getAdjacentTextSizeLevel(
    value: TextSizeLevel,
    direction: "smaller" | "larger",
): TextSizeLevel {
    const index = Math.max(0, TEXT_SIZE_ORDER.indexOf(value));
    const nextIndex =
        direction === "larger"
            ? Math.min(TEXT_SIZE_ORDER.length - 1, index + 1)
            : Math.max(0, index - 1);
    return TEXT_SIZE_ORDER[nextIndex];
}
