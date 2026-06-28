export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const DEFAULT_SUGGEST_LIMIT = 8;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(Math.floor(value) as (typeof PAGE_SIZE_OPTIONS)[number])
        ? Math.floor(value)
        : DEFAULT_PAGE_SIZE;
