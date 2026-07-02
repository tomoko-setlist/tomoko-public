import { normalizeSearchKeyVariants } from "./searchTextNormalization";

import type {
    MemberSearchRequest,
    MemberSearchRow,
    SearchSuggestion,
    SetlistSearchDb,
    SongSearchRequest,
    SongSearchRow,
    SongVersionSearchRow,
} from "./setlistSearchDb/types";

const LOOKUP_LIMIT = 20;
const SUGGEST_FALLBACK_LIMIT = 5;

const normalizeSongKey = (value: string): string =>
    value
        .normalize("NFKC")
        .toLowerCase()
        .replace(
            /[\s\u3000!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~、。，．・･：；！？（）［］｛｝「」『』【】〈〉《》〔〕“”‘’｀´〜～ｰー－―‐]/g,
            "",
        )
        .trim();

const buildSongFallbackTerms = (value: string): string[] => {
    const trimmed = value.trim();
    const withoutDecorations = trimmed
        .replace(/[\[【（(].*?[\]】）)]/g, "")
        .trim();
    return [...new Set([withoutDecorations].filter((term) => term && term !== trimmed))];
};

export type ResolvedPerformerCandidate = {
    performerName: string;
    personId: number | null;
    groupId: number | null;
};

export type SongLookupCandidate = {
    source: "song" | "version";
    songId: number | null;
    songName: string;
    songVersionId: number | null;
    versionName: string;
    artistId: number | null;
    artistName: string;
};

export type PerformerLookupCandidate = {
    label: string;
    value: string;
    personId: number | null;
    groupId: number | null;
};

export type ResolvedSetlistCandidateRow = {
    songCandidates: SongLookupCandidate[];
    selectedSong: SongLookupCandidate | null;
    performerCandidates: Record<string, PerformerLookupCandidate[]>;
    performerResolved: ResolvedPerformerCandidate[];
    hasUnresolvedPerformer: boolean;
};

export type SetlistCandidateResolverCache = {
    songs?: Map<
        string,
        Promise<{
            candidates: SongLookupCandidate[];
            autoResolved: SongLookupCandidate | null;
        }>
    >;
    performers?: Map<string, Promise<PerformerLookupCandidate[]>>;
};

const createSongSearchRequest = (term: string): SongSearchRequest => ({
    term,
    songName: term,
    artistName: "",
    lyricistName: "",
    composerName: "",
    arrangerName: "",
    albumName: "",
    releaseDateFrom: "",
    releaseDateTo: "",
    fieldSearchMethods: {
        songName: "contains",
        artistName: "contains",
        lyricistName: "contains",
        composerName: "contains",
        arrangerName: "contains",
        albumName: "contains",
    },
    page: 1,
    limit: LOOKUP_LIMIT,
    sortBy: "song",
    sortOrder: "asc",
});

const createMemberSearchRequest = (term: string): MemberSearchRequest => ({
    term: "",
    personName: term,
    groupName: "",
    prefectureName: "",
    page: 1,
    limit: LOOKUP_LIMIT,
    sortBy: "name",
    sortOrder: "asc",
});

const mapSongRowToCandidate = (row: SongSearchRow): SongLookupCandidate => ({
    source: "song",
    songId: row.songId,
    songName: row.songName,
    songVersionId: null,
    versionName: "",
    artistId: row.artistId ?? null,
    artistName: row.artistName ?? "",
});

const mapVersionRowToCandidate = (
    row: SongVersionSearchRow,
): SongLookupCandidate => ({
    source: "version",
    songId: row.songId,
    songName: row.songName || row.versionName,
    songVersionId: row.songVersionId,
    versionName: row.versionName,
    artistId: row.artistId ?? row.songArtistId ?? null,
    artistName: row.artistName || row.songArtistName || "",
});

const getCandidateLabel = (candidate: SongLookupCandidate): string =>
    candidate.source === "version" && candidate.versionName
        ? candidate.versionName
        : candidate.songName;

const getCandidateLabelWeight = (label: string): number => {
    const normalized = normalizeSongKey(label);
    if (normalized.length > 0) return normalized.length;
    const trimmed = label.trim();
    return trimmed.length > 0 ? trimmed.length : Number.MAX_SAFE_INTEGER;
};

export const compareSongLookupCandidate = (
    a: SongLookupCandidate,
    b: SongLookupCandidate,
    key: string,
): number => {
    const aLabel = getCandidateLabel(a);
    const bLabel = getCandidateLabel(b);
    const aExact = key.length > 0 && normalizeSongKey(aLabel) === key;
    const bExact = key.length > 0 && normalizeSongKey(bLabel) === key;
    if (aExact !== bExact) return aExact ? -1 : 1;
    const labelDiff =
        getCandidateLabelWeight(aLabel) - getCandidateLabelWeight(bLabel);
    if (labelDiff !== 0) return labelDiff;
    const aId = a.source === "version" ? a.songVersionId ?? 0 : a.songId ?? 0;
    const bId = b.source === "version" ? b.songVersionId ?? 0 : b.songId ?? 0;
    if (aId !== bId) return aId - bId;
    return aLabel.localeCompare(bLabel, "ja");
};

const dedupeSongCandidates = (
    candidates: SongLookupCandidate[],
): SongLookupCandidate[] => {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
        const key =
            candidate.source === "version"
                ? `version:${candidate.songVersionId ?? ""}`
                : `song:${candidate.songId ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

export const searchSongLookupCandidates = async (
    db: SetlistSearchDb,
    term: string,
): Promise<{
    candidates: SongLookupCandidate[];
    autoResolved: SongLookupCandidate | null;
}> => {
    const trimmed = term.trim();
    const key = normalizeSongKey(trimmed);
    if (!key) return { candidates: [], autoResolved: null };
    const termVariants = new Set(normalizeSearchKeyVariants(trimmed));
    const ranked = new Map<string, { candidate: SongLookupCandidate; tier: 1 | 2 | 3 | 4 }>();

    const upsert = (candidate: SongLookupCandidate, tier: 1 | 2 | 3 | 4) => {
        const idKey =
            candidate.source === "version"
                ? `version:${candidate.songVersionId ?? ""}`
                : `song:${candidate.songId ?? ""}`;
        const existing = ranked.get(idKey);
        if (!existing || tier < existing.tier) {
            ranked.set(idKey, { candidate, tier });
        }
    };

    const searchTerms = [trimmed, ...buildSongFallbackTerms(trimmed)];
    for (const searchTerm of searchTerms) {
        const searchTermKey = normalizeSongKey(searchTerm);
        const searchTermVariants = new Set(normalizeSearchKeyVariants(searchTerm));
        const [songs, versions] = await Promise.all([
            db.searchSongs(createSongSearchRequest(searchTerm)),
            db.searchSongVersions
                ? db.searchSongVersions(searchTerm, LOOKUP_LIMIT)
                : Promise.resolve({ rows: [] }),
        ]);
        const candidates = [
            ...songs.rows.map(mapSongRowToCandidate),
            ...versions.rows.map(mapVersionRowToCandidate),
        ];
        if (candidates.length === 0) continue;
        for (const candidate of candidates) {
            const label = getCandidateLabel(candidate);
            const candidateKey = normalizeSongKey(label);
            if (!candidateKey) continue;
            if (candidateKey === key) {
                upsert(candidate, 1);
            } else if (searchTermKey && candidateKey === searchTermKey) {
                upsert(candidate, 2);
            } else if (
                [...termVariants].some(
                    (variant) => variant && candidateKey.includes(variant),
                )
            ) {
                upsert(candidate, 3);
            } else if (
                [...searchTermVariants].some(
                    (variant) =>
                        variant &&
                        (candidateKey.includes(variant) || variant.includes(candidateKey)),
                )
            ) {
                upsert(candidate, 4);
            }
        }
        if (ranked.size > 0) break;
        if (searchTerm !== trimmed && candidates[0]) {
            upsert(candidates[0], 4);
            break;
        }
    }

    const suggestions = await db.suggest({
        field: "songName",
        term: trimmed,
        searchUnit: "setlist",
        limit: SUGGEST_FALLBACK_LIMIT,
    });
    const seenSuggestions = new Set<string>();
    for (const suggestion of suggestions) {
        const suggestionTerm = (suggestion.value || suggestion.label || "").trim();
        const suggestionKey = normalizeSongKey(suggestionTerm);
        if (!suggestionKey || seenSuggestions.has(suggestionKey)) continue;
        seenSuggestions.add(suggestionKey);
        const response = await db.searchSongs(createSongSearchRequest(suggestionTerm));
        for (const candidate of response.rows.map(mapSongRowToCandidate)) {
            const candidateKey = normalizeSongKey(candidate.songName);
            if (!candidateKey) continue;
            if (candidateKey === suggestionKey && suggestionKey !== key) {
                upsert(candidate, 2);
            } else if (
                suggestionKey !== key &&
                (candidateKey.includes(suggestionKey) ||
                    suggestionKey.includes(candidateKey))
            ) {
                upsert(candidate, 4);
            }
        }
    }

    const sorted = [...ranked.values()].sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return compareSongLookupCandidate(a.candidate, b.candidate, key);
    });
    const candidates = dedupeSongCandidates(
        sorted.slice(0, LOOKUP_LIMIT).map((item) => item.candidate),
    );
    const autoResolved = sorted[0]?.candidate ?? null;
    return { candidates, autoResolved };
};

const mergePerformerChoices = (
    memberRows: MemberSearchRow[],
    groupRows: SearchSuggestion[],
    groupsByKey: Map<string, number>,
): PerformerLookupCandidate[] => {
    const mappedMembers = memberRows.slice(0, LOOKUP_LIMIT).map((row) => ({
        label: `${row.personName}${row.activeGroupsText ? ` (${row.activeGroupsText})` : ""}`,
        value: row.personName,
        personId: row.personId,
        groupId: null,
    }));
    const mappedGroups = groupRows.slice(0, LOOKUP_LIMIT).map((row) => {
        const value = row.value || row.label;
        return {
            label: `${row.label} [group]`,
            value,
            personId: null,
            groupId: groupsByKey.get(normalizeSongKey(value)) ?? null,
        };
    });
    const seen = new Set<string>();
    return [...mappedMembers, ...mappedGroups].filter((row) => {
        const key = normalizeSongKey(row.value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const comparePerformerChoice = (
    a: PerformerLookupCandidate,
    b: PerformerLookupCandidate,
    keys: Set<string>,
): number => {
    const aIsGroup = /\[group\]\s*$/i.test(a.label);
    const bIsGroup = /\[group\]\s*$/i.test(b.label);
    const aKey = normalizeSongKey(a.value || a.label);
    const bKey = normalizeSongKey(b.value || b.label);
    const aExact = aKey.length > 0 && keys.has(aKey);
    const bExact = bKey.length > 0 && keys.has(bKey);
    if (aExact !== bExact) return aExact ? -1 : 1;
    if (aExact && bExact && aIsGroup !== bIsGroup) return aIsGroup ? -1 : 1;
    const aPrefix = [...keys].some((key) => key.length > 0 && aKey.startsWith(key));
    const bPrefix = [...keys].some((key) => key.length > 0 && bKey.startsWith(key));
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
    const lenDiff = a.label.trim().length - b.label.trim().length;
    if (lenDiff !== 0) return lenDiff;
    return a.label.localeCompare(b.label, "ja");
};

export const splitPerformerNames = (value: string): string[] =>
    value
        .split(/[・、,，／/]+/u)
        .map((item) => item.trim())
        .filter(Boolean);

export const searchPerformerLookupCandidates = async (
    db: SetlistSearchDb,
    term: string,
    groupsByKey: Map<string, number>,
): Promise<PerformerLookupCandidate[]> => {
    const trimmed = term.trim();
    if (!trimmed) return [];
    const [members, groups] = await Promise.all([
        db.searchMembers(createMemberSearchRequest(trimmed)),
        db.suggest({
            field: "groupName",
            term: trimmed,
            searchUnit: "setlist",
            limit: LOOKUP_LIMIT,
        }),
    ]);
    const keys = new Set(normalizeSearchKeyVariants(trimmed));
    return mergePerformerChoices(members.rows, groups, groupsByKey).sort((a, b) =>
        comparePerformerChoice(a, b, keys),
    );
};

export const resolveSetlistCandidateRow = async (
    db: SetlistSearchDb,
    input: { songName: string; performers: string },
    groupsByKey: Map<string, number>,
    cache: SetlistCandidateResolverCache = {},
): Promise<ResolvedSetlistCandidateRow> => {
    const songName = input.songName.trim();
    const songCache = cache.songs;
    const songKey = normalizeSongKey(songName);
    let songLookup: {
        candidates: SongLookupCandidate[];
        autoResolved: SongLookupCandidate | null;
    } = { candidates: [], autoResolved: null };
    if (songName && songKey) {
        const cached = songCache?.get(songKey);
        if (cached) {
            songLookup = await cached;
        } else {
            const lookupPromise = searchSongLookupCandidates(db, songName);
            songCache?.set(songKey, lookupPromise);
            songLookup = await lookupPromise;
        }
    }
    const performerCandidates: Record<string, PerformerLookupCandidate[]> = {};
    const performerResolved: ResolvedPerformerCandidate[] = [];
    let hasUnresolvedPerformer = false;

    for (const performerName of splitPerformerNames(input.performers)) {
        const performerKey = normalizeSongKey(performerName);
        let choicesPromise = performerKey
            ? cache.performers?.get(performerKey)
            : undefined;
        if (!choicesPromise) {
            choicesPromise = searchPerformerLookupCandidates(
                db,
                performerName,
                groupsByKey,
            );
            if (performerKey) cache.performers?.set(performerKey, choicesPromise);
        }
        const choices = await choicesPromise;
        performerCandidates[performerName] = choices;
        const keys = new Set([
            ...normalizeSearchKeyVariants(performerName),
            normalizeSongKey(performerName),
        ]);
        const exactChoices = choices.filter((choice) => {
            const valueKey = normalizeSongKey(choice.value);
            const labelKey = normalizeSongKey(choice.label.replace(/\s*\[group\]\s*$/i, ""));
            return keys.has(valueKey) || keys.has(labelKey);
        });
        const top = exactChoices[0] ?? choices[0] ?? null;
        if (top) {
            performerResolved.push({
                performerName: top.value,
                personId: top.personId,
                groupId: top.groupId,
            });
        } else {
            hasUnresolvedPerformer = true;
            performerResolved.push({
                performerName,
                personId: null,
                groupId: null,
            });
        }
    }

    return {
        songCandidates: songLookup.candidates,
        selectedSong: songLookup.autoResolved,
        performerCandidates,
        performerResolved,
        hasUnresolvedPerformer,
    };
};

export const buildGroupKeyMap = async (
    db: SetlistSearchDb,
): Promise<Map<string, number>> => {
    const groups = db.listGroups ? await db.listGroups() : [];
    return new Map(
        groups
            .map((group) => [normalizeSongKey(group.name), group.id] as const)
            .filter(([key]) => key.length > 0),
    );
};
