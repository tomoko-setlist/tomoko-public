import {
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    normalizePageSize,
} from "./constants/searchDefaults";
import { STORAGE_FLAG_OFF, STORAGE_FLAG_ON } from "./constants/stateFlags";

import type { MemberSearchRequest } from "./setlistSearchDb/types";

const STORAGE_KEY = "tomoko-member-search-state-v1";
const URL_NS = "m";

export type MemberSearchSortBy = MemberSearchRequest["sortBy"];
export type MemberSearchActiveStatus = NonNullable<MemberSearchRequest["activeStatus"]>;

export type MemberSearchPersistedState = {
    term: string;
    personName: string;
    groupName: string;
    prefectureIds: string;
    birthdayFrom: string;
    birthdayTo: string;
    birthMonths: string;
    activeStatus: MemberSearchActiveStatus;
    generation: string;
    roleName: string;
    colorName: string;
    page: number;
    pageSize: number;
    sortBy: MemberSearchSortBy;
    sortOrder: "asc" | "desc";
    showAdvanced: boolean;
};

export function parseCsv(value: string): string[] {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

export function loadMemberStateFromStorage(): Partial<MemberSearchPersistedState> {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as Partial<MemberSearchPersistedState>;
    } catch {
        return {};
    }
}

export function saveMemberStateToStorage(state: MemberSearchPersistedState): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadMemberStateFromUrl(): Partial<MemberSearchPersistedState> {
    if (typeof window === "undefined") return {};
    const rawSearch = window.location.search.startsWith("?")
        ? window.location.search.slice(1)
        : window.location.search;
    const params = new URLSearchParams(rawSearch);
    const next: Partial<MemberSearchPersistedState> = {};
    const get = (...keys: string[]) => {
        for (const key of keys) {
            const value = params.get(key);
            if (value !== null) return value;
        }
        return null;
    };
    const key = (shortKey: string) => `${URL_NS}_${shortKey}`;

    const term = get(key("q"));
    const personName = get(key("pn"));
    const groupName = get(key("gn"));
    const prefectureIds = get(key("pf"));
    const birthdayFrom = get(key("bf"), key("df"));
    const birthdayTo = get(key("bt"), key("dt"));
    const birthMonths = get(key("bm"));
    const activeStatus = get(key("as"));
    const generation = get(key("gen"));
    const roleName = get(key("rl"));
    const colorName = get(key("cl"));
    const page = Number(get(key("p")));
    const pageSize = Number(get(key("ps")));
    const sortBy = get(key("sb"));
    const sortOrder = get(key("so"));
    const advanced = get(key("a"));

    if (term !== null) next.term = term;
    if (personName !== null) next.personName = personName;
    if (groupName !== null) next.groupName = groupName;
    if (prefectureIds !== null) next.prefectureIds = prefectureIds;
    if (birthdayFrom !== null) next.birthdayFrom = birthdayFrom;
    if (birthdayTo !== null) next.birthdayTo = birthdayTo;
    if (birthMonths !== null) next.birthMonths = birthMonths;
    if (
        activeStatus === "all" ||
        activeStatus === "activeHello" ||
        activeStatus === "trainee" ||
        activeStatus === "helloOg" ||
        activeStatus === "formerTrainee"
    ) {
        next.activeStatus = activeStatus;
    }
    if (generation !== null) next.generation = generation;
    if (roleName !== null) next.roleName = roleName;
    if (colorName !== null) next.colorName = colorName;
    if (Number.isFinite(page) && page > 0) next.page = Math.floor(page);
    if (Number.isFinite(pageSize)) {
        next.pageSize = normalizePageSize(pageSize);
    }
    if (
        sortBy === "joinedAt" ||
        sortBy === "name" ||
        sortBy === "kana"
    ) {
        next.sortBy = sortBy;
    }
    if (sortOrder === "asc" || sortOrder === "desc") {
        next.sortOrder = sortOrder;
    }
    if (advanced === STORAGE_FLAG_ON) next.showAdvanced = true;
    if (advanced === STORAGE_FLAG_OFF) next.showAdvanced = false;

    return next;
}

export function buildMemberSearchUrl(state: MemberSearchPersistedState): string {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams();
    const key = (shortKey: string) => `${URL_NS}_${shortKey}`;
    const set = (k: string, value: string | number | null | undefined) => {
        if (value === null || value === undefined || value === "") return;
        params.set(k, String(value));
    };

    set(key("q"), state.term);
    set(key("pn"), state.personName);
    set(key("gn"), state.groupName);
    set(key("pf"), state.prefectureIds);
    set(key("bf"), state.birthdayFrom);
    set(key("bt"), state.birthdayTo);
    set(key("bm"), state.birthMonths);
    if (state.activeStatus !== "all") set(key("as"), state.activeStatus);
    set(key("gen"), state.generation);
    set(key("rl"), state.roleName);
    set(key("cl"), state.colorName);
    if (state.page !== DEFAULT_PAGE) set(key("p"), state.page);
    if (state.pageSize !== DEFAULT_PAGE_SIZE) set(key("ps"), state.pageSize);
    if (state.sortBy !== "kana") set(key("sb"), state.sortBy);
    if (state.sortOrder !== "asc") set(key("so"), state.sortOrder);
    set(key("a"), state.showAdvanced ? STORAGE_FLAG_ON : STORAGE_FLAG_OFF);

    const query = params.toString();
    return `${window.location.pathname}${query ? `?${query}` : ""}`;
}
