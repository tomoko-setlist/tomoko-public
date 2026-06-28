import type {
    SearchSuggestField,
    SearchSuggestVariant,
} from "./setlistSearchDb/types";

type SuggestionMetrics = {
    totalSelections: number;
    byField: Record<SearchSuggestField, number>;
    byVariant: Record<SearchSuggestVariant, number>;
    byVariantField: Record<SearchSuggestVariant, Record<SearchSuggestField, number>>;
    lastSelectedAt: string;
};

const STORAGE_KEY = "tomoko-duc.suggest-metrics.v1";

const emptyByField = (): Record<SearchSuggestField, number> => ({
    query: 0,
    songSearchQuery: 0,
    songSearchSongName: 0,
    songSearchArtistName: 0,
    songSearchLyricistName: 0,
    songSearchComposerName: 0,
    songSearchArrangerName: 0,
    songSearchAlbumName: 0,
    memberSearchQuery: 0,
    memberSearchPersonName: 0,
    memberSearchGroupName: 0,
    memberSearchGeneration: 0,
    memberSearchRoleName: 0,
    memberSearchColorName: 0,
    normalizedPerformer: 0,
    songName: 0,
    personName: 0,
    groupName: 0,
    prefectureName: 0,
    artistName: 0,
    lyricistName: 0,
    composerName: 0,
    arrangerName: 0,
    albumName: 0,
    eventName: 0,
    venueName: 0,
    sectionName: 0,
    eventTag: 0,
});

const emptyByVariant = (): Record<SearchSuggestVariant, number> => ({
    A: 0,
    B: 0,
});

const emptyByVariantField = (): Record<
    SearchSuggestVariant,
    Record<SearchSuggestField, number>
> => ({
    A: emptyByField(),
    B: emptyByField(),
});

export const recordSuggestionSelection = (
    field: SearchSuggestField,
    variant: SearchSuggestVariant = "A",
): void => {
    if (typeof window === "undefined") return;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const current = raw
            ? (JSON.parse(raw) as Partial<SuggestionMetrics>)
            : undefined;
        const byField = {
            ...emptyByField(),
            ...(current?.byField ?? {}),
        };
        const byVariant = {
            ...emptyByVariant(),
            ...(current?.byVariant ?? {}),
        };
        const byVariantField = {
            ...emptyByVariantField(),
            ...(current?.byVariantField ?? {}),
            A: {
                ...emptyByField(),
                ...(current?.byVariantField?.A ?? {}),
            },
            B: {
                ...emptyByField(),
                ...(current?.byVariantField?.B ?? {}),
            },
        };
        byField[field] = (byField[field] ?? 0) + 1;
        byVariant[variant] = (byVariant[variant] ?? 0) + 1;
        byVariantField[variant][field] =
            (byVariantField[variant][field] ?? 0) + 1;

        const next: SuggestionMetrics = {
            totalSelections: Math.max(0, Number(current?.totalSelections ?? 0)) + 1,
            byField,
            byVariant,
            byVariantField,
            lastSelectedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // metrics failure should never affect UI behavior
    }
};
