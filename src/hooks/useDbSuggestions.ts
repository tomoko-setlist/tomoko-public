import { useCallback, useEffect, useRef } from "react";

import { DEFAULT_SUGGEST_LIMIT } from "../lib/constants/searchDefaults";

import type {
    SearchSuggestField,
    SearchSuggestVariant,
    SearchSuggestion,
    SearchUnit,
    SetlistSearchDb,
} from "../lib/setlistSearchDb/types";

type UseDbSuggestionsOptions = {
    db: SetlistSearchDb | null;
    searchUnit: SearchUnit;
    blocked?: boolean;
    enabled?: boolean;
    variant?: SearchSuggestVariant;
};

export const useDbSuggestions = ({
    db,
    searchUnit,
    blocked = false,
    enabled = true,
    variant,
}: UseDbSuggestionsOptions) => {
    const cacheRef = useRef<Map<string, SearchSuggestion[]>>(new Map());

    useEffect(() => {
        cacheRef.current.clear();
    }, [db, enabled, searchUnit, variant]);

    return useCallback(
        async (
            field: SearchSuggestField,
            termValue: string,
        ): Promise<SearchSuggestion[]> => {
            const normalized = termValue.trim();
            if (!enabled || blocked || normalized.length < 1 || !db) {
                return [];
            }
            const cacheKey = `${variant ?? ""}|${searchUnit}|${field}|${normalized.toLowerCase()}`;
            const cached = cacheRef.current.get(cacheKey);
            if (cached) return cached;

            const rows = await db.suggest({
                field,
                term: normalized,
                searchUnit,
                limit: DEFAULT_SUGGEST_LIMIT,
                ...(variant ? { variant } : {}),
            });
            if (cacheRef.current.size > 400) {
                cacheRef.current.clear();
            }
            cacheRef.current.set(cacheKey, rows);
            return rows;
        },
        [blocked, db, enabled, searchUnit, variant],
    );
};
