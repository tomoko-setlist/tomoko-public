const SEEN_KEY = "tomoko_seen_features_v1";

const loadSeen = (): Set<string> => {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = window.localStorage.getItem(SEEN_KEY);
        if (!raw) return new Set();
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
    } catch {
        return new Set();
    }
};

export const isFeatureNew = (feature: string): boolean => !loadSeen().has(feature);

export const markFeatureSeen = (feature: string): void => {
    const seen = loadSeen();
    seen.add(feature);
    try {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {
        // storage full or unavailable — ignore
    }
};
