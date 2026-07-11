import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SongSearchResultsSection } from "./SongSearchResultsSection";
import { useDbSuggestions } from "../../hooks/useDbSuggestions";
import { useScrollVisibility } from "../../hooks/useScrollVisibility";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  normalizePageSize,
} from "../../lib/constants/searchDefaults";
import { STORAGE_FLAG_OFF, STORAGE_FLAG_ON } from "../../lib/constants/stateFlags";
import { DB_REFRESH_EVENT } from "../../lib/dbRefreshEvent";
import { recordSongSearchAnalytics } from "../../lib/searchAnalytics";
import { formatDateYmd } from "../../lib/uiFormat";
import { AutocompleteTextInput } from "../search/AutocompleteTextInput";
import { FloatingEditButton } from "../search/FloatingEditButton";
import { MultiSelectDropdown } from "../search/MultiSelectDropdown";
import {
  SearchConditionSummary,
  type SearchConditionItem,
} from "../search/SearchConditionSummary";
import { SearchDateField } from "../search/SearchDateField";
import { SearchDetailActions } from "../search/SearchDetailActions";
import { SearchMethodTextField } from "../search/SearchMethodTextField";
import { ChevronUpIcon } from "../ui";

import type {
  SearchMethod,
  SetlistSearchDb,
  SongSearchResponse,
} from "../../lib/setlistSearchDb/types";

const STORAGE_KEY = "tomoko-song-search-state-v4";
const CACHE_KEY = "tomoko-song-search-cache-v1";
const CACHE_TTL_MS = 30 * 60 * 1000;
const URL_NS = "s";

type SongSearchPageProps = {
  db: SetlistSearchDb | null;
  onOpenSong: (songId: number) => void;
  onOpenArtist: (artistId: number) => void;
  onOpenAlbum: (albumId: number) => void;
  onOpenCreator?: (creatorId: number) => void;
};

type SongFieldSearchMethods = {
  songName: SearchMethod;
  artistName: SearchMethod;
  lyricistName: SearchMethod;
  composerName: SearchMethod;
  arrangerName: SearchMethod;
  albumName: SearchMethod;
};

type PersistedState = {
  term: string;
  songName: string;
  artistName: string;
  lyricistName: string;
  composerName: string;
  arrangerName: string;
  albumName: string;
  songCategories: number[];
  releaseDateFrom: string;
  releaseDateTo: string;
  methods: SongFieldSearchMethods;
  sortBy: SongSortBy;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
  showAdvanced: boolean;
};

type SongSearchCacheEntry = {
  key: string;
  savedAt: number;
  result: SongSearchResponse;
};

type SongSortBy =
  | "song"
  | "artist"
  | "lyricist"
  | "composer"
  | "arranger"
  | "releaseDate"
  | "date";

type SongResultViewMode = "table" | "card";

const DEFAULT_METHODS: SongFieldSearchMethods = {
  songName: "contains",
  artistName: "contains",
  lyricistName: "contains",
  composerName: "contains",
  arrangerName: "contains",
  albumName: "contains",
};

const SONG_CATEGORY_OPTIONS = [
  { value: 10, label: "ハロプロ楽曲" },
  { value: 20, label: "ハロプロ関連楽曲" },
  { value: 30, label: "劇中歌" },
  { value: 60, label: "その他（カバー等）" },
] as const;

const DEFAULT_SONG_CATEGORIES: number[] = [10];

const EMPTY: SongSearchResponse = {
  rows: [],
  total: 0,
  page: DEFAULT_PAGE,
  limit: DEFAULT_PAGE_SIZE,
  totalPages: DEFAULT_PAGE,
};

export function SongSearchPage({
  db,
  onOpenSong,
  onOpenArtist,
  onOpenAlbum,
  onOpenCreator,
}: SongSearchPageProps) {
  const formRef = useRef<HTMLElement>(null);
  const [term, setTerm] = useState("");
  const [songName, setSongName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [lyricistName, setLyricistName] = useState("");
  const [composerName, setComposerName] = useState("");
  const [arrangerName, setArrangerName] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [songCategories, setSongCategories] = useState<number[]>(DEFAULT_SONG_CATEGORIES);
  const [releaseDateFrom, setReleaseDateFrom] = useState("");
  const [releaseDateTo, setReleaseDateTo] = useState("");
  const [methods, setMethods] = useState<SongFieldSearchMethods>(DEFAULT_METHODS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortBy, setSortBy] = useState<SongSortBy>("song");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageInput, setPageInput] = useState(String(DEFAULT_PAGE));
  const [result, setResult] = useState<SongSearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [viewMode, setViewMode] = useState<SongResultViewMode>("table");

  const fetchSuggestions = useDbSuggestions({
    db,
    searchUnit: "setlist",
    blocked: loading,
  });

  useEffect(() => {
    try {
      const persisted = loadSongStateFromStorage();
      const fromUrl = loadSongStateFromUrl();
      const parsed: Partial<PersistedState> = {
        ...persisted,
        ...fromUrl,
      };
      if (typeof parsed.term === "string") setTerm(parsed.term);
      if (typeof parsed.songName === "string") setSongName(parsed.songName);
      if (typeof parsed.artistName === "string") setArtistName(parsed.artistName);
      if (typeof parsed.lyricistName === "string") setLyricistName(parsed.lyricistName);
      if (typeof parsed.composerName === "string") setComposerName(parsed.composerName);
      if (typeof parsed.arrangerName === "string") setArrangerName(parsed.arrangerName);
      if (typeof parsed.albumName === "string") setAlbumName(parsed.albumName);
      const normalizedSongCategories = normalizeSongCategories(parsed.songCategories);
      if (normalizedSongCategories !== null) {
        setSongCategories(normalizedSongCategories);
      }
      if (typeof parsed.releaseDateFrom === "string") setReleaseDateFrom(parsed.releaseDateFrom);
      if (typeof parsed.releaseDateTo === "string") setReleaseDateTo(parsed.releaseDateTo);
      if (parsed.methods) {
        setMethods({ ...DEFAULT_METHODS, ...parsed.methods });
      }
      if (
        parsed.sortBy === "song" ||
        parsed.sortBy === "artist" ||
        parsed.sortBy === "lyricist" ||
        parsed.sortBy === "composer" ||
        parsed.sortBy === "arranger" ||
        parsed.sortBy === "releaseDate" ||
        parsed.sortBy === "date"
      ) {
        setSortBy(parsed.sortBy);
      }
      if (parsed.sortOrder === "asc" || parsed.sortOrder === "desc") {
        setSortOrder(parsed.sortOrder);
      }
      if (typeof parsed.page === "number" && parsed.page > 0) {
        setPage(Math.floor(parsed.page));
        setPageInput(String(Math.floor(parsed.page)));
      }
      if (
        typeof parsed.pageSize === "number" &&
        Number.isFinite(parsed.pageSize)
      ) {
        setPageSize(normalizePageSize(parsed.pageSize));
      }
      if (typeof parsed.showAdvanced === "boolean") {
        setShowAdvanced(parsed.showAdvanced);
      }
    } catch {
      // no-op
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedState = {
      term,
      songName,
      artistName,
      lyricistName,
      composerName,
      arrangerName,
      albumName,
      songCategories,
      releaseDateFrom,
      releaseDateTo,
      methods,
      sortBy,
      sortOrder,
      page,
      pageSize,
      showAdvanced,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    albumName,
    arrangerName,
    artistName,
    composerName,
    hydrated,
    lyricistName,
    methods,
    page,
    pageSize,
    songCategories,
    releaseDateFrom,
    releaseDateTo,
    showAdvanced,
    songName,
    sortBy,
    sortOrder,
    term,
  ]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const nextUrl = buildSongSearchUrl({
      term,
      songName,
      artistName,
      lyricistName,
      composerName,
      arrangerName,
      albumName,
      songCategories,
      releaseDateFrom,
      releaseDateTo,
      methods,
      sortBy,
      sortOrder,
      page,
      pageSize,
      showAdvanced,
    });
    window.history.replaceState(null, "", nextUrl);
  }, [
    hydrated,
    term,
    songName,
    artistName,
    lyricistName,
    composerName,
    arrangerName,
    albumName,
    songCategories,
    releaseDateFrom,
    releaseDateTo,
    methods,
    sortBy,
    sortOrder,
    page,
    pageSize,
    showAdvanced,
  ]);

  const request = useMemo(
    () => ({
      term,
      songName,
      artistName,
      lyricistName,
      composerName,
      arrangerName,
      albumName,
      songCategories,
      releaseDateFrom,
      releaseDateTo,
      fieldSearchMethods: methods,
      page,
      limit: pageSize,
      sortBy,
      sortOrder,
    }),
    [
      albumName,
      songCategories,
      arrangerName,
      artistName,
      composerName,
      lyricistName,
      methods,
      page,
      pageSize,
      releaseDateFrom,
      releaseDateTo,
      songName,
      sortBy,
      sortOrder,
      term,
    ],
  );

  const dateRangeError = useMemo(() => {
    if (!releaseDateFrom || !releaseDateTo) return "";
    if (releaseDateFrom <= releaseDateTo) return "";
    return "発売日Fromは発売日To以前の日付を指定してください。";
  }, [releaseDateFrom, releaseDateTo]);

  useEffect(() => {
    if (!db || !hydrated) return;
    if (dateRangeError) {
      setResult(EMPTY);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");

      const requestKey = JSON.stringify(request);
      const cached = loadSongSearchCache(requestKey);
      if (cached) {
        setResult(cached);
        recordSongSearchAnalytics(request, cached);
        setLoading(false);
        return;
      }

      try {
        const next = await db.searchSongs(request);
        if (!cancelled) {
          setResult(next);
          saveSongSearchCache(requestKey, next);
          recordSongSearchAnalytics(request, next);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(() => void run(), 130);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dateRangeError, db, hydrated, request]);

  const resetPage = () => setPage(DEFAULT_PAGE);
  const handleSort = (nextSortBy: SongSortBy, nextSortOrder: "asc" | "desc") => {
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    resetPage();
  };
  const handleSortChange = (nextSortBy: SongSortBy) => {
    if (sortBy === nextSortBy) {
      handleSort(nextSortBy, sortOrder === "asc" ? "desc" : "asc");
      return;
    }
    handleSort(nextSortBy, "asc");
  };
  const clearAll = useCallback(() => {
    setTerm("");
    setSongName("");
    setArtistName("");
    setLyricistName("");
    setComposerName("");
    setArrangerName("");
    setAlbumName("");
    setSongCategories(DEFAULT_SONG_CATEGORIES);
    setReleaseDateFrom("");
    setReleaseDateTo("");
    setMethods(DEFAULT_METHODS);
    setSortBy("song");
    setSortOrder("asc");
    setPage(DEFAULT_PAGE);
    setPageSize(25);
    setPageInput(String(DEFAULT_PAGE));
    setShowAdvanced(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleDbRefresh = () => {
      clearAll();
    };
    window.addEventListener(DB_REFRESH_EVENT, handleDbRefresh);
    return () => {
      window.removeEventListener(DB_REFRESH_EVENT, handleDbRefresh);
    };
  }, [clearAll]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const activeConditionItems = useMemo<SearchConditionItem[]>(
    () => [
      term
        ? { key: "term", label: `キーワード: ${term}`, onClear: () => { setTerm(""); resetPage(); } }
        : null,
      songName
        ? { key: "songName", label: `楽曲名: ${songName}`, onClear: () => { setSongName(""); resetPage(); } }
        : null,
      artistName
        ? { key: "artistName", label: `アーティスト: ${artistName}`, onClear: () => { setArtistName(""); resetPage(); } }
        : null,
      lyricistName
        ? { key: "lyricistName", label: `作詞: ${lyricistName}`, onClear: () => { setLyricistName(""); resetPage(); } }
        : null,
      composerName
        ? { key: "composerName", label: `作曲: ${composerName}`, onClear: () => { setComposerName(""); resetPage(); } }
        : null,
      arrangerName
        ? { key: "arrangerName", label: `編曲: ${arrangerName}`, onClear: () => { setArrangerName(""); resetPage(); } }
        : null,
      albumName
        ? { key: "albumName", label: `アルバム: ${albumName}`, onClear: () => { setAlbumName(""); resetPage(); } }
        : null,
      songCategories.length > 0
        ? {
            key: "songCategories",
            label: `カテゴリ: ${songCategories
              .map((category) => songCategoryLabel(category))
              .join(", ")}`,
            onClear: () => {
              setSongCategories([]);
              resetPage();
            },
          }
        : null,
      releaseDateFrom
        ? {
            key: "releaseDateFrom",
            label: `発売日From: ${formatDateYmd(releaseDateFrom)}`,
            onClear: () => {
              setReleaseDateFrom("");
              resetPage();
            },
          }
        : null,
      releaseDateTo
        ? {
            key: "releaseDateTo",
            label: `発売日To: ${formatDateYmd(releaseDateTo)}`,
            onClear: () => {
              setReleaseDateTo("");
              resetPage();
            },
          }
        : null,
    ].filter((item): item is SearchConditionItem => item !== null),
    [
      albumName,
      arrangerName,
      artistName,
      composerName,
      lyricistName,
      releaseDateFrom,
      releaseDateTo,
      songCategories,
      songName,
      term,
    ],
  );
  const showEditFloating = useScrollVisibility(
    formRef,
    hydrated && !loading && !error,
    showAdvanced,
    180,
  );
  const showCloseFloating = showAdvanced && !showEditFloating;
  const canClearConditions =
    term.trim().length > 0 ||
    songName.trim().length > 0 ||
    artistName.trim().length > 0 ||
    lyricistName.trim().length > 0 ||
    composerName.trim().length > 0 ||
    arrangerName.trim().length > 0 ||
    albumName.trim().length > 0 ||
    releaseDateFrom.trim().length > 0 ||
    releaseDateTo.trim().length > 0 ||
    !isDefaultSongCategories(songCategories) ||
    methods.songName !== DEFAULT_METHODS.songName ||
    methods.artistName !== DEFAULT_METHODS.artistName ||
    methods.lyricistName !== DEFAULT_METHODS.lyricistName ||
    methods.composerName !== DEFAULT_METHODS.composerName ||
    methods.arrangerName !== DEFAULT_METHODS.arrangerName ||
    methods.albumName !== DEFAULT_METHODS.albumName ||
    sortBy !== "song" ||
    sortOrder !== "asc" ||
    page !== 1 ||
    pageSize !== 25 ||
    showAdvanced;

  return (
    <div className="space-y-4">
      <section
        ref={formRef}
        className="rounded-none border-2 border-gray-800 bg-white p-4 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] md:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-slate-900">楽曲検索</h1>
          <SearchDetailActions
            expanded={showAdvanced}
            onToggle={() => setShowAdvanced((prev) => !prev)}
            onClear={clearAll}
            clearDisabled={!canClearConditions}
            openLabel="詳細検索"
          />
        </div>

        <div className="mt-3">
          <span className="text-xs font-semibold text-slate-600">
            キーワード
          </span>
          <div className="mt-1">
            <AutocompleteTextInput
              inputClassName="w-full rounded-none border-2 border-gray-800 px-3 py-2 pr-8 text-sm focus:outline-none"
              value={term}
              onChange={(value) => {
                setTerm(value);
                resetPage();
              }}
              onFetchSuggestions={(termValue) => fetchSuggestions("songSearchQuery", termValue)}
              suggestField="songSearchQuery"
              suggestEnabled={Boolean(db)}
              placeholder="曲名・アーティスト・クレジット・アルバム"
            />
          </div>
        </div>

        <div
          aria-hidden={!showAdvanced}
          className={`relative transition-all duration-300 ease-out ${
            showAdvanced
              ? "z-30 max-h-[1400px] translate-y-0 opacity-100 overflow-visible"
              : "z-0 max-h-0 translate-y-[-4px] opacity-0 pointer-events-none overflow-hidden"
          }`}
        >
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <SearchMethodTextField
              label="楽曲名"
              value={songName}
              method={methods.songName}
              onMethodChange={(value) => {
                setMethods((prev) => ({ ...prev, songName: value }));
                resetPage();
              }}
              onChange={(value) => {
                setSongName(value);
                resetPage();
              }}
              onFetchSuggestions={(termValue) => fetchSuggestions("songSearchSongName", termValue)}
              suggestField="songSearchSongName"
              suggestEnabled={Boolean(db)}
            />
            <SearchMethodTextField
              label="アーティスト名"
              value={artistName}
              method={methods.artistName}
              onMethodChange={(value) => {
                setMethods((prev) => ({ ...prev, artistName: value }));
                resetPage();
              }}
              onChange={(value) => {
                setArtistName(value);
                resetPage();
              }}
              onFetchSuggestions={(termValue) => fetchSuggestions("songSearchArtistName", termValue)}
              suggestField="songSearchArtistName"
              suggestEnabled={Boolean(db)}
            />
            <SearchMethodTextField
              label="作詞"
              value={lyricistName}
              method={methods.lyricistName}
              onMethodChange={(value) => {
                setMethods((prev) => ({ ...prev, lyricistName: value }));
                resetPage();
              }}
              onChange={(value) => {
                setLyricistName(value);
                resetPage();
              }}
              onFetchSuggestions={(termValue) => fetchSuggestions("songSearchLyricistName", termValue)}
              suggestField="songSearchLyricistName"
              suggestEnabled={Boolean(db)}
            />
            <SearchMethodTextField
              label="作曲"
              value={composerName}
              method={methods.composerName}
              onMethodChange={(value) => {
                setMethods((prev) => ({ ...prev, composerName: value }));
                resetPage();
              }}
              onChange={(value) => {
                setComposerName(value);
                resetPage();
              }}
              onFetchSuggestions={(termValue) => fetchSuggestions("songSearchComposerName", termValue)}
              suggestField="songSearchComposerName"
              suggestEnabled={Boolean(db)}
            />
            <SearchMethodTextField
              label="編曲"
              value={arrangerName}
              method={methods.arrangerName}
              onMethodChange={(value) => {
                setMethods((prev) => ({ ...prev, arrangerName: value }));
                resetPage();
              }}
              onChange={(value) => {
                setArrangerName(value);
                resetPage();
              }}
              onFetchSuggestions={(termValue) => fetchSuggestions("songSearchArrangerName", termValue)}
              suggestField="songSearchArrangerName"
              suggestEnabled={Boolean(db)}
            />
            <SearchMethodTextField
              label="アルバム"
              value={albumName}
              method={methods.albumName}
              onMethodChange={(value) => {
                setMethods((prev) => ({ ...prev, albumName: value }));
                resetPage();
              }}
              onChange={(value) => {
                setAlbumName(value);
                resetPage();
              }}
              onFetchSuggestions={(termValue) => fetchSuggestions("songSearchAlbumName", termValue)}
              suggestField="songSearchAlbumName"
              suggestEnabled={Boolean(db)}
            />
            <label className="text-xs font-semibold text-slate-600">
              カテゴリ
              <div className="mt-1">
                <MultiSelectDropdown
                  options={SONG_CATEGORY_OPTIONS.map((option) => ({
                    value: String(option.value),
                    label: option.label,
                  }))}
                  selectedValues={songCategories.map((category) => String(category))}
                  onChange={(values) => {
                    setSongCategories(normalizeSongCategoryStrings(values));
                    resetPage();
                  }}
                  placeholder="カテゴリを選択"
                />
              </div>
            </label>
            <SearchDateField
              label="発売日(From)"
              value={releaseDateFrom}
              onChange={(value) => {
                setReleaseDateFrom(value);
                resetPage();
              }}
            />
            <SearchDateField
              label="発売日(To)"
              value={releaseDateTo}
              onChange={(value) => {
                setReleaseDateTo(value);
                resetPage();
              }}
            />
          </div>
        </div>

        <SearchConditionSummary
          items={activeConditionItems}
          showCloseButton={false}
          onClose={() => setShowAdvanced(false)}
        />
      </section>
      <SongSearchResultsSection
        result={result}
        sortBy={sortBy}
        sortOrder={sortOrder}
        viewMode={viewMode}
        setViewMode={setViewMode}
        handleSort={handleSort}
        handleSortChange={handleSortChange}
        loading={loading}
        error={error}
        dateRangeError={dateRangeError}
            onOpenSong={onOpenSong}
            onOpenArtist={onOpenArtist}
            onOpenAlbum={onOpenAlbum}
            onOpenCreator={onOpenCreator}
            page={page}
        pageSize={pageSize}
        pageInput={pageInput}
        setPageInput={setPageInput}
        setPage={setPage}
        setPageSize={setPageSize}
        setShowAdvanced={setShowAdvanced}
      />
      {showCloseFloating ? (
        <button
          type="button"
          onClick={() => setShowAdvanced(false)}
          className="fixed bottom-5 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-none border-2 border-gray-800 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-[4px_4px_0px_0px_rgba(31,41,55,0.9)] active:translate-x-[-50%] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(31,41,55,0.8)] md:left-[calc(50%+8rem)]"
          aria-label="結果を表示"
          title="結果を表示"
        >
          <ChevronUpIcon className="h-4 w-4 shrink-0" />
          <span>結果を表示</span>
        </button>
      ) : null}
      <FloatingEditButton
        targetRef={formRef}
        enabled={hydrated && !loading && !error}
        isFormExpanded={showAdvanced}
        onClick={() => {
          setShowAdvanced(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        label="検索条件を編集"
      />
    </div>
  );
}

function loadSongSearchCache(key: string): SongSearchResponse | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SongSearchCacheEntry;
    if (parsed.key !== key) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.result;
  } catch {
    return null;
  }
}

function saveSongSearchCache(key: string, result: SongSearchResponse): void {
  try {
    const payload: SongSearchCacheEntry = {
      key,
      savedAt: Date.now(),
      result,
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
}

function loadSongStateFromStorage(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return {};
  }
}

function loadSongStateFromUrl(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  const rawSearch = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;
  const params = new URLSearchParams(rawSearch);
  const next: Partial<PersistedState> = {};
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = params.get(key);
      if (value !== null) return value;
    }
    return null;
  };
  const key = (shortKey: string) => `${URL_NS}_${shortKey}`;

  const term = get(key("q"));
  const songName = get(key("sn"));
  const artistName = get(key("an"));
  const lyricistName = get(key("ln"));
  const composerName = get(key("cn"));
  const arrangerName = get(key("rn"));
  const albumName = get(key("ab"));
  const songCategories = get(key("sc"));
  const releaseDateFrom = get(key("df"));
  const releaseDateTo = get(key("dt"));
  const sortBy = get(key("sb"));
  const sortOrder = get(key("so"));
  const page = Number(get(key("p")));
  const pageSize = Number(get(key("ps")));
  const showAdvanced = get(key("a"));

  if (term !== null) next.term = term;
  if (songName !== null) next.songName = songName;
  if (artistName !== null) next.artistName = artistName;
  if (lyricistName !== null) next.lyricistName = lyricistName;
  if (composerName !== null) next.composerName = composerName;
  if (arrangerName !== null) next.arrangerName = arrangerName;
  if (albumName !== null) next.albumName = albumName;
  if (songCategories !== null) {
    const parsedSongCategories = parseSongCategoriesFromUrlParam(songCategories);
    if (parsedSongCategories !== null) {
      next.songCategories = parsedSongCategories;
    }
  }
  if (releaseDateFrom !== null) next.releaseDateFrom = releaseDateFrom;
  if (releaseDateTo !== null) next.releaseDateTo = releaseDateTo;

  if (
    sortBy === "song" ||
    sortBy === "artist" ||
    sortBy === "lyricist" ||
    sortBy === "composer" ||
    sortBy === "arranger" ||
    sortBy === "releaseDate" ||
    sortBy === "date"
  ) {
    next.sortBy = sortBy;
  }
  if (sortOrder === "asc" || sortOrder === "desc") {
    next.sortOrder = sortOrder;
  }
  if (Number.isFinite(page) && page > 0) {
    next.page = Math.floor(page);
  }
  if (Number.isFinite(pageSize)) {
    next.pageSize = normalizePageSize(pageSize);
  }
  if (showAdvanced === STORAGE_FLAG_ON) {
    next.showAdvanced = true;
  } else if (showAdvanced === STORAGE_FLAG_OFF) {
    next.showAdvanced = false;
  }

  const methodSong = get(key("msn"));
  const methodArtist = get(key("man"));
  const methodLyricist = get(key("mln"));
  const methodComposer = get(key("mcn"));
  const methodArranger = get(key("mrn"));
  const methodAlbum = get(key("mab"));
  const normalizedMethodSong = normalizeSearchMethod(methodSong);
  const normalizedMethodArtist = normalizeSearchMethod(methodArtist);
  const normalizedMethodLyricist = normalizeSearchMethod(methodLyricist);
  const normalizedMethodComposer = normalizeSearchMethod(methodComposer);
  const normalizedMethodArranger = normalizeSearchMethod(methodArranger);
  const normalizedMethodAlbum = normalizeSearchMethod(methodAlbum);
  const methods: Partial<SongFieldSearchMethods> = {};
  if (normalizedMethodSong) methods.songName = normalizedMethodSong;
  if (normalizedMethodArtist) methods.artistName = normalizedMethodArtist;
  if (normalizedMethodLyricist) methods.lyricistName = normalizedMethodLyricist;
  if (normalizedMethodComposer) methods.composerName = normalizedMethodComposer;
  if (normalizedMethodArranger) methods.arrangerName = normalizedMethodArranger;
  if (normalizedMethodAlbum) methods.albumName = normalizedMethodAlbum;
  if (Object.keys(methods).length > 0) {
    next.methods = { ...DEFAULT_METHODS, ...methods };
  }

  return next;
}

function normalizeSongCategoryStrings(values: string[]): number[] {
  return normalizeSongCategories(values) ?? DEFAULT_SONG_CATEGORIES;
}

function parseSongCategoriesFromUrlParam(raw: string): number[] | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "all") {
    return [];
  }
  const parsed = normalizeSongCategories(raw.split(","));
  if (parsed === null || parsed.length === 0) {
    return null;
  }
  return parsed;
}

function normalizeSongCategories(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const allowedSet = new Set<number>(SONG_CATEGORY_OPTIONS.map((option) => option.value));
  const mapped = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.floor(item))
    .filter((item) => allowedSet.has(item));
  const deduped = Array.from(new Set(mapped));
  const ordered = SONG_CATEGORY_OPTIONS
    .map((option) => option.value)
    .filter((option) => deduped.includes(option));
  return ordered;
}

function isDefaultSongCategories(values: number[]): boolean {
  if (values.length !== DEFAULT_SONG_CATEGORIES.length) return false;
  return values.every((value, index) => value === DEFAULT_SONG_CATEGORIES[index]);
}

function songCategoryLabel(category: number): string {
  return SONG_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? `その他(${category})`;
}

function normalizeSearchMethod(value: string | null): SearchMethod | null {
  if (
    value === "contains" ||
    value === "notContains" ||
    value === "exact" ||
    value === "notExact" ||
    value === "startsWith" ||
    value === "endsWith"
  ) {
    return value;
  }
  if (value === "equals") {
    return "exact";
  }
  return null;
}

function buildSongSearchUrl(state: PersistedState): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  const key = (shortKey: string) => `${URL_NS}_${shortKey}`;
  const set = (key: string, value: string | number | boolean | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    params.set(key, String(value));
  };

  set(key("q"), state.term);
  set(key("sn"), state.songName);
  set(key("an"), state.artistName);
  set(key("ln"), state.lyricistName);
  set(key("cn"), state.composerName);
  set(key("rn"), state.arrangerName);
  set(key("ab"), state.albumName);
  if (!isDefaultSongCategories(state.songCategories)) {
    set(
      key("sc"),
      state.songCategories.length > 0 ? state.songCategories.join(",") : "all",
    );
  }
  set(key("df"), state.releaseDateFrom);
  set(key("dt"), state.releaseDateTo);
  set(key("sb"), state.sortBy);
  set(key("so"), state.sortOrder);
  if (state.page !== DEFAULT_PAGE) set(key("p"), state.page);
  if (state.pageSize !== DEFAULT_PAGE_SIZE) set(key("ps"), state.pageSize);
  set(key("a"), state.showAdvanced ? STORAGE_FLAG_ON : STORAGE_FLAG_OFF);

  if (state.methods.songName !== DEFAULT_METHODS.songName) set(key("msn"), state.methods.songName);
  if (state.methods.artistName !== DEFAULT_METHODS.artistName) set(key("man"), state.methods.artistName);
  if (state.methods.lyricistName !== DEFAULT_METHODS.lyricistName) set(key("mln"), state.methods.lyricistName);
  if (state.methods.composerName !== DEFAULT_METHODS.composerName) set(key("mcn"), state.methods.composerName);
  if (state.methods.arrangerName !== DEFAULT_METHODS.arrangerName) set(key("mrn"), state.methods.arrangerName);
  if (state.methods.albumName !== DEFAULT_METHODS.albumName) set(key("mab"), state.methods.albumName);

  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}`;
}
