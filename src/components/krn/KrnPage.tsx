import {
    DndContext,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DraggableAttributes,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    type MutableRefObject,
    type ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import * as twitterText from "twitter-text";

import {
    KRN_NOTE_EMPTY as NOTE_EMPTY,
    buildEventDetailLine,
    buildEventTitleLine,
    buildExportCsv,
    buildExportHtml,
    buildExportHtmlFragment,
    buildExportText,
    buildKrnLines,
    createKrnEntry as createEntry,
    escapeHtml,
    joinPerformerNames,
    parsePerformerNames,
    parseRawEntries,
} from "./krnExportBuilders";
import { renderMarkupToPngBlob } from "./krnPngExport";
import {
    buildSongFallbackTerms,
    normalizeSongKey,
} from "../../lib/krnSongLookup";
import {
    DEFAULT_PAGE,
    DEFAULT_SUGGEST_LIMIT,
} from "../../lib/constants/searchDefaults";
import { normalizeSearchKey, normalizeSearchKeyVariants } from "../../lib/searchTextNormalization";
import {
    DEFAULT_FIELD_SEARCH_METHODS,
    type SearchRequest,
    type SearchResultRow,
    type SetlistDetail,
} from "../../lib/setlistSearchDb/types";
import { submitKrnSubmission } from "../../lib/submitKrnSubmission";
import { formatDateYmd } from "../../lib/uiFormat";
import { SearchDateField } from "../search/SearchDateField";
import {
    DownloadIcon,
    GripVerticalIcon,
    KrnPreviewIcon,
    LinkIcon,
    PlusIcon,
    ResetIcon,
    SparklesIcon,
    SearchIcon,
    TrashIcon,
    XIcon,
} from "../ui";

import type {
    ExportFormat,
    ImageExportSource,
    InlineAffixStyle,
    KrnDraft,
    KrnEntry,
    OutputOptions,
    ParsePerformerDelimiter,
    ParsedTweetLike,
    PerformerChoice,
    PerformerDelimiter,
    PerformerResolved,
    SongChoice,
    StageCandidate,
} from "./krnTypes";
import type {
    MemberSearchRequest,
    MemberSearchRow,
    SearchSuggestion,
    SetlistSearchDb,
    SongSearchRequest,
    SongSearchRow,
} from "../../lib/setlistSearchDb/types";

type KrnPageProps = {
    db: SetlistSearchDb;
};

type SortableHandleListeners = ReturnType<typeof useSortable>["listeners"];

const DRAFT_STORAGE_KEY = "tomoko.krn.draft.v2";
const TWITTER_MAX_LENGTH = 280;
const STAGE_SEARCH_LIMIT = 30;
const LOOKUP_SUGGEST_LIMIT = DEFAULT_SUGGEST_LIMIT;
const SONG_RESOLVE_CANDIDATE_LIMIT = 20;
const SONG_SUGGEST_FALLBACK_LIMIT = 5;
const SEARCH_MIN_TERM_LENGTH = 1;
const TOAST_AUTO_CLOSE_MS = 2200;
const LOOKUP_DEBOUNCE_MS = 220;
const DRAGGING_Z_INDEX = 20;
const ENTRY_STEP_MIN = 0;
const ENTRY_STEP_MAX = 2;
const STAGE_INPUT_SCROLL_TARGET_ID = "krn-setlist-input-section";
const QUICK_NOTE_TAGS = ["新曲", "1ハーフ", "生演奏"] as const;
const QUICK_SECTION_TAGS = ["EN", "ソロ", "ダンスパフォーマンス", "回替わり"] as const;
const unknownToText = (value: unknown): string =>
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
        ? String(value)
        : "";

const parseTweetWithTwitterText = (value: string): ParsedTweetLike => {
    const candidate = twitterText as unknown as {
        parseTweet?: (text: string) => ParsedTweetLike;
        default?: { parseTweet?: (text: string) => ParsedTweetLike };
    };
    const fn = candidate.parseTweet ?? candidate.default?.parseTweet;
    if (typeof fn === "function") {
        return fn(value);
    }
    return {
        weightedLength: [...value].length,
        valid: [...value].length <= TWITTER_MAX_LENGTH,
    };
};

const createSearchRequest = (
    term: string,
    dateFrom: string,
    dateTo: string,
): SearchRequest => ({
    searchUnit: "stage",
    groupByEvent: false,
    term,
    personName: "",
    songName: "",
    artistName: "",
    lyricistName: "",
    composerName: "",
    arrangerName: "",
    eventName: "",
    venueName: "",
    eventTag: "",
    sectionName: "",
    prefectureIds: "",
    fieldSearchMethods: DEFAULT_FIELD_SEARCH_METHODS,
    dateFrom,
    dateTo,
    sortBy: "date",
    sortOrder: "desc",
    page: DEFAULT_PAGE,
    limit: STAGE_SEARCH_LIMIT,
});

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
    page: DEFAULT_PAGE,
    limit: LOOKUP_SUGGEST_LIMIT,
    sortBy: "song",
    sortOrder: "desc",
});

const createMemberSearchRequest = (term: string): MemberSearchRequest => ({
    term,
    personName: term,
    groupName: "",
    prefectureName: "",
    page: DEFAULT_PAGE,
    limit: LOOKUP_SUGGEST_LIMIT,
    sortBy: "name",
    sortOrder: "asc",
});

const toStageCandidate = (row: SearchResultRow): StageCandidate => ({
    stageId: row.row_id,
    eventId: row.event_id,
    eventName: row.event_name,
    date: row.date_label,
    venueName: row.venue_name,
    startTime: row.start_time ?? "",
    pattern: "",
});

const splitNoteTags = (value: string): string[] =>
    value
        .split(/[/／・,、]+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

const appendNoteTag = (note: string, tag: string): string => {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return note;
    const parts = splitNoteTags(note);
    if (parts.includes(trimmedTag)) return note;
    return [...parts, trimmedTag].join(" / ");
};

const appendSectionTag = (section: string, tag: string): string => {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return section;
    const current = section.trim();
    if (!current) return trimmedTag;
    const parts = current
        .split(/[/／・,、]+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    if (parts.includes(trimmedTag)) return section;
    return [...parts, trimmedTag].join(" / ");
};

const copyText = async (value: string): Promise<boolean> => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
    }
    if (typeof document === "undefined") return false;

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-10000px";
    textarea.style.top = "-10000px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    return succeeded;
};

const downloadTextFile = (filename: string, content: string) => {
    if (typeof window === "undefined") return;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
};

const downloadBlobFile = (filename: string, blob: Blob) => {
    if (typeof window === "undefined") return;
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
};

const formatDateForFilename = (value: string): string => {
    const formatted = formatDateYmd(value);
    return formatted === NOTE_EMPTY ? "" : formatted.replace(/\//g, "-");
};

const normalizePerformerKey = (value: string): string =>
    normalizeSearchKey(value);
const normalizePerformerStateKey = (value: string): string =>
    normalizePerformerKey(value);

type SortableEntryContainerProps = {
    id: string;
    children: (params: {
        handleRef: (element: HTMLElement | null) => void;
        handleAttributes: DraggableAttributes;
        handleListeners: SortableHandleListeners;
        isDragging: boolean;
    }) => ReactNode;
};

function SortableEntryContainer({ id, children }: SortableEntryContainerProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? DRAGGING_Z_INDEX : undefined,
    };
    return (
        <div ref={setNodeRef} style={style}>
            {children({
                handleRef: setActivatorNodeRef,
                handleAttributes: attributes,
                handleListeners: listeners,
                isDragging,
            })}
        </div>
    );
}

const buildDefaultPerformerResolutionByEntry = (
    rows: KrnEntry[],
): Record<string, Record<string, PerformerResolved>> =>
    Object.fromEntries(
        rows.map((entry) => [
            entry.id,
            Object.fromEntries(
                entry.performerNames
                    .map((name) => name.trim())
                    .filter((name) => name.length > 0)
                    .map((name) => [
                        normalizePerformerStateKey(name),
                        {
                            personId: null,
                            groupId: null,
                        } satisfies PerformerResolved,
                    ]),
            ),
        ]),
    );

const createInitialRows = (): KrnEntry[] => [createEntry()];
const createInitialRowState = (): {
    entries: KrnEntry[];
    songQueryByEntry: Record<string, string>;
    performerQueryByEntry: Record<string, string>;
} => {
    const entries = createInitialRows();
    return {
        entries,
        songQueryByEntry: Object.fromEntries(
            entries.map((row) => [row.id, ""]),
        ),
        performerQueryByEntry: Object.fromEntries(
            entries.map((row) => [row.id, ""]),
        ),
    };
};

export function KrnPage({ db }: KrnPageProps) {
    const songSuggestTimerRef = useRef<Record<string, number>>({});
    const performerSuggestTimerRef = useRef<Record<string, number>>({});
    const songSuggestRequestSeqRef = useRef<Record<string, number>>({});
    const performerSuggestRequestSeqRef = useRef<Record<string, number>>({});
    const groupIdByKeyRef = useRef<Map<string, number> | null>(null);
    const songInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const performerInputRefs = useRef<Record<string, HTMLInputElement | null>>(
        {},
    );
    const [stageSearchDate, setStageSearchDate] = useState("");
    const [stageSearchTerm, setStageSearchTerm] = useState("");
    const [searchingStage, setSearchingStage] = useState(false);
    const [stageSearchError, setStageSearchError] = useState("");
    const [stageCandidates, setStageCandidates] = useState<StageCandidate[]>(
        [],
    );
    const [stageSearchExecuted, setStageSearchExecuted] = useState(false);
    const [selectedStage, setSelectedStage] = useState<StageCandidate | null>(
        null,
    );

    const [eventName, setEventName] = useState("");
    const [stageDate, setStageDate] = useState("");
    const [venueName, setVenueName] = useState("");
    const [startTime, setStartTime] = useState("");
    const [pattern, setPattern] = useState("");

    const [rawInput, setRawInput] = useState("");
    const [isParseModalOpen, setIsParseModalOpen] = useState(false);
    const [parseIncludePerformer, setParseIncludePerformer] = useState(true);
    const [parsePerformerDelimiter, setParsePerformerDelimiter] =
        useState<ParsePerformerDelimiter>("auto");
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [isClearDraftModalOpen, setIsClearDraftModalOpen] = useState(false);
    const [htmlPreviewMode, setHtmlPreviewMode] = useState<"render" | "code">(
        "render",
    );
    const [isImportingMemo, setIsImportingMemo] = useState(false);
    const initialRowState = useMemo(() => createInitialRowState(), []);
    const [entries, setEntries] = useState<KrnEntry[]>(initialRowState.entries);
    const [songQueryByEntry, setSongQueryByEntry] = useState<
        Record<string, string>
    >(initialRowState.songQueryByEntry);
    const [performerQueryByEntry, setPerformerQueryByEntry] = useState<
        Record<string, string>
    >(initialRowState.performerQueryByEntry);
    const [songChoicesByEntry, setSongChoicesByEntry] = useState<
        Record<string, SongChoice[]>
    >({});
    const [songSearchedByEntry, setSongSearchedByEntry] = useState<
        Record<string, boolean>
    >({});
    const [performerChoicesByEntry, setPerformerChoicesByEntry] = useState<
        Record<string, PerformerChoice[]>
    >({});
    const [performerResolutionByEntry, setPerformerResolutionByEntry] =
        useState<Record<string, Record<string, PerformerResolved>>>({});
    const [songLoadingByEntry, setSongLoadingByEntry] = useState<
        Record<string, boolean>
    >({});
    const [performerLoadingByEntry, setPerformerLoadingByEntry] = useState<
        Record<string, boolean>
    >({});
    const [songDropdownOpenByEntry, setSongDropdownOpenByEntry] = useState<
        Record<string, boolean>
    >({});
    const [performerDropdownOpenByEntry, setPerformerDropdownOpenByEntry] =
        useState<Record<string, boolean>>({});
    const [entryStepById, setEntryStepById] = useState<Record<string, number>>(
        {},
    );

    const [outputOptions, setOutputOptions] = useState<OutputOptions>({
        artistDisplayMode: "inline",
        artistInlineStyle: "slash",
        artistPrefixCustom: "アーティスト: ",
        includeEvent: true,
        performerDisplayMode: "newline",
        performerInlineStyle: "dot",
        performerPrefixCustom: "歌唱: ",
        includeNote: true,
        sectionAsHeader: true,
        includeMc: false,
        countMcInMusicOrder: false,
    });
    const [performerDelimiter, setPerformerDelimiter] =
        useState<PerformerDelimiter>("・");
    const [commonPerformerInput, setCommonPerformerInput] = useState("");
    const [exportFormat, setExportFormat] = useState<ExportFormat>("text");
    const [imageExportSource, setImageExportSource] =
        useState<ImageExportSource>("text");
    const [notifyTomoko, setNotifyTomoko] = useState(true);
    const [isExportingImage, setIsExportingImage] = useState(false);
    const [operationMessage, setOperationMessage] = useState("");
    const dragSensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 4,
            },
        }),
        useSensor(TouchSensor),
    );

    useEffect(() => {
        if (typeof window === "undefined") return;
        const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) return;

        try {
            const draft = JSON.parse(raw) as Partial<KrnDraft>;
            if (typeof draft.stageSearchDate === "string")
                setStageSearchDate(draft.stageSearchDate);
            if (typeof draft.stageSearchTerm === "string")
                setStageSearchTerm(draft.stageSearchTerm);
            if (typeof draft.eventName === "string")
                setEventName(draft.eventName);
            if (typeof draft.stageDate === "string")
                setStageDate(draft.stageDate);
            if (typeof draft.venueName === "string")
                setVenueName(draft.venueName);
            if (typeof draft.startTime === "string")
                setStartTime(draft.startTime);
            if (typeof draft.pattern === "string") setPattern(draft.pattern);
            if (typeof draft.rawInput === "string") setRawInput(draft.rawInput);
            if (typeof draft.parseIncludePerformer === "boolean") {
                setParseIncludePerformer(draft.parseIncludePerformer);
            }
            if (
                draft.parsePerformerDelimiter === "auto" ||
                draft.parsePerformerDelimiter === "・" ||
                draft.parsePerformerDelimiter === "、" ||
                draft.parsePerformerDelimiter === "," ||
                draft.parsePerformerDelimiter === "/" ||
                draft.parsePerformerDelimiter === "／" ||
                draft.parsePerformerDelimiter === "space"
            ) {
                setParsePerformerDelimiter(draft.parsePerformerDelimiter);
            }
            if (Array.isArray(draft.entries)) {
                const normalizedEntries = draft.entries
                    .map((entry) => {
                        if (!entry || typeof entry !== "object") return null;
                        const candidate = entry as Partial<KrnEntry> & {
                            isNewSong?: boolean;
                        };
                        const legacyLabels = Array.isArray(
                            (candidate as { labels?: unknown[] }).labels,
                        )
                            ? (
                                  (candidate as { labels?: unknown[] })
                                      .labels ?? []
                              )
                                  .map((value) => unknownToText(value).trim())
                                  .filter((value) => value.length > 0)
                            : [];
                        const legacyNoteParts = [
                            String(candidate.note ?? "").trim(),
                            ...legacyLabels,
                            candidate.isNewSong ? "新曲" : "",
                        ].filter((value) => value.length > 0);
                        return createEntry({
                            ...candidate,
                            isSongFreeInput:
                                candidate.isSongFreeInput === undefined
                                    ? Boolean(candidate.isNewSong)
                                    : Boolean(candidate.isSongFreeInput),
                            note: legacyNoteParts.join(" / "),
                        });
                    })
                    .filter((entry): entry is KrnEntry => entry !== null);
                setEntries(normalizedEntries);
                setPerformerResolutionByEntry(
                    buildDefaultPerformerResolutionByEntry(normalizedEntries),
                );
                setSongQueryByEntry(
                    Object.fromEntries(
                        normalizedEntries.map((entry) => [
                            entry.id,
                            entry.songName,
                        ]),
                    ),
                );
                setPerformerQueryByEntry(
                    Object.fromEntries(
                        normalizedEntries.map((entry) => [
                            entry.id,
                            joinPerformerNames(
                                entry.performerNames ?? [],
                                "・",
                            ),
                        ]),
                    ),
                );
            }
            if (
                draft.selectedStage &&
                typeof draft.selectedStage === "object"
            ) {
                const candidate =
                    draft.selectedStage as Partial<StageCandidate>;
                if (
                    typeof candidate.stageId === "number" &&
                    typeof candidate.eventId === "number" &&
                    typeof candidate.eventName === "string" &&
                    typeof candidate.date === "string" &&
                    typeof candidate.venueName === "string" &&
                    typeof candidate.startTime === "string" &&
                    typeof candidate.pattern === "string"
                ) {
                    setSelectedStage(candidate as StageCandidate);
                }
            }
            if (
                draft.outputOptions &&
                typeof draft.outputOptions === "object"
            ) {
                const legacyOutput = draft.outputOptions as OutputOptions & {
                    includeArtist?: boolean;
                    includePerformer?: boolean;
                };
                setOutputOptions({
                    artistDisplayMode:
                        legacyOutput.artistDisplayMode === "hidden" ||
                        legacyOutput.artistDisplayMode === "newline"
                            ? legacyOutput.artistDisplayMode
                            : legacyOutput.includeArtist === undefined ||
                                legacyOutput.includeArtist
                              ? "inline"
                              : "hidden",
                    artistInlineStyle:
                        legacyOutput.artistInlineStyle === "dot" ||
                        legacyOutput.artistInlineStyle === "square" ||
                        legacyOutput.artistInlineStyle === "round"
                            ? legacyOutput.artistInlineStyle
                            : "slash",
                    artistPrefixCustom:
                        typeof legacyOutput.artistPrefixCustom === "string"
                            ? legacyOutput.artistPrefixCustom
                            : "アーティスト: ",
                    includeEvent: Boolean(legacyOutput.includeEvent),
                    performerDisplayMode:
                        legacyOutput.performerDisplayMode === "hidden" ||
                        legacyOutput.performerDisplayMode === "inline"
                            ? legacyOutput.performerDisplayMode
                            : legacyOutput.includePerformer === undefined ||
                                legacyOutput.includePerformer
                              ? "newline"
                              : "hidden",
                    performerInlineStyle:
                        legacyOutput.performerInlineStyle === "slash" ||
                        legacyOutput.performerInlineStyle === "square" ||
                        legacyOutput.performerInlineStyle === "round"
                            ? legacyOutput.performerInlineStyle
                            : "dot",
                    performerPrefixCustom:
                        typeof legacyOutput.performerPrefixCustom === "string"
                            ? legacyOutput.performerPrefixCustom
                            : "歌唱: ",
                    includeNote:
                        legacyOutput.includeNote === undefined
                            ? true
                            : Boolean(legacyOutput.includeNote),
                    sectionAsHeader:
                        legacyOutput.sectionAsHeader === undefined
                            ? true
                            : Boolean(legacyOutput.sectionAsHeader),
                    includeMc: Boolean(legacyOutput.includeMc),
                    countMcInMusicOrder: Boolean(
                        legacyOutput.countMcInMusicOrder,
                    ),
                });
            }
            if (
                draft.performerDelimiter === "・" ||
                draft.performerDelimiter === "、" ||
                draft.performerDelimiter === "," ||
                draft.performerDelimiter === "/" ||
                draft.performerDelimiter === "／"
            ) {
                setPerformerDelimiter(draft.performerDelimiter);
            }
            if (
                draft.exportFormat === "text" ||
                draft.exportFormat === "csv" ||
                draft.exportFormat === "image" ||
                draft.exportFormat === "html" ||
                draft.exportFormat === "twitter"
            ) {
                setExportFormat(draft.exportFormat);
            }
            if (
                draft.imageExportSource === "text" ||
                draft.imageExportSource === "htmlTable"
            ) {
                setImageExportSource(draft.imageExportSource);
            }
            if (typeof draft.notifyTomoko === "boolean") {
                setNotifyTomoko(draft.notifyTomoko);
            }
        } catch {
            // ignore invalid draft
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const draft: KrnDraft = {
            stageSearchDate,
            stageSearchTerm,
            selectedStage,
            eventName,
            stageDate,
            venueName,
            startTime,
            pattern,
            rawInput,
            parseIncludePerformer,
            parsePerformerDelimiter,
            entries,
            outputOptions,
            performerDelimiter,
            exportFormat,
            imageExportSource,
            notifyTomoko,
        };
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }, [
        stageSearchDate,
        stageSearchTerm,
        selectedStage,
        eventName,
        stageDate,
        venueName,
        startTime,
        pattern,
        rawInput,
        parseIncludePerformer,
        parsePerformerDelimiter,
        entries,
        outputOptions,
        performerDelimiter,
        exportFormat,
        imageExportSource,
        notifyTomoko,
    ]);

    useEffect(() => {
        if (!operationMessage) return;
        const timer = window.setTimeout(
            () => setOperationMessage(""),
            TOAST_AUTO_CLOSE_MS,
        );
        return () => clearTimeout(timer);
    }, [operationMessage]);

    useEffect(() => {
        setEntryStepById((current) => {
            const next: Record<string, number> = {};
            for (const entry of entries) {
                next[entry.id] = Math.max(
                    ENTRY_STEP_MIN,
                    Math.min(ENTRY_STEP_MAX, current[entry.id] ?? ENTRY_STEP_MIN),
                );
            }
            return next;
        });
    }, [entries]);

    const performStageSearch = async () => {
        const dateValue = stageSearchDate.trim();
        const term = stageSearchTerm.trim();

        setStageSearchExecuted(true);
        setSearchingStage(true);
        setStageSearchError("");
        try {
            const dateYmd = dateValue;
            const result = await db.query(
                createSearchRequest(term, dateYmd, dateYmd),
            );
            setStageCandidates(
                result.rows
                    .map(toStageCandidate)
                    .filter(
                        (candidate, index, self) =>
                            index ===
                            self.findIndex(
                                (item) => item.stageId === candidate.stageId,
                            ),
                    ),
            );
        } catch (error) {
            setStageCandidates([]);
            setStageSearchError(
                error instanceof Error ? error.message : String(error),
            );
        } finally {
            setSearchingStage(false);
        }
    };

    const selectStage = async (candidate: StageCandidate) => {
        setSelectedStage(candidate);
        setEventName(candidate.eventName);
        setStageDate(candidate.date);
        setVenueName(candidate.venueName);
        setStartTime(candidate.startTime);
        setPattern(candidate.pattern);

        try {
            const detail = await db.getStageDetail(candidate.stageId);
            if (!detail) return;
            setStartTime(detail.startTime ?? candidate.startTime);
            setPattern(detail.pattern ?? "");
        } catch {
            // noop
        }
    };

    const loadExistingSetlist = async () => {
        if (!selectedStage) return;
        try {
            const setlists = await db.getStageSetlists(selectedStage.stageId);
            const nextEntries = setlists
                .sort((left, right) => left.musicOrder - right.musicOrder)
                .map((row) => mapSetlistToEntry(row));
            setEntries(nextEntries);
            setPerformerResolutionByEntry(
                buildDefaultPerformerResolutionByEntry(nextEntries),
            );
            setSongQueryByEntry(
                Object.fromEntries(
                    nextEntries.map((entry) => [entry.id, entry.songName]),
                ),
            );
            setSongSearchedByEntry(
                Object.fromEntries(
                    nextEntries.map((entry) => [entry.id, false]),
                ),
            );
            setOperationMessage(
                nextEntries.length > 0
                    ? `既存セットリスト ${nextEntries.length} 件を読み込みました。`
                    : "既存セットリストはまだ登録されていません。",
            );
        } catch (error) {
            setOperationMessage(
                `既存セットリスト読込に失敗: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    };

    const parseRawInput = async () => {
        const parsed = parseRawEntries(rawInput, {
            includePerformer: parseIncludePerformer,
            performerDelimiter: parsePerformerDelimiter,
        });
        if (parsed.length === 0) {
            setOperationMessage("抽出できる楽曲行がありませんでした。");
            return;
        }

        setIsImportingMemo(true);
        try {
            const songResolved = await resolveSongCandidates(parsed);
            const performerResolved = parseIncludePerformer
                ? await resolvePerformerCandidates(songResolved)
                : {
                      rows: songResolved,
                      resolvedByEntry:
                          buildDefaultPerformerResolutionByEntry(songResolved),
                  };
            const resolved = performerResolved.rows;
            setEntries(resolved);
            setPerformerResolutionByEntry(performerResolved.resolvedByEntry);
            setSongQueryByEntry(
                Object.fromEntries(
                    resolved.map((entry) => [entry.id, entry.songName]),
                ),
            );
            setSongSearchedByEntry(
                Object.fromEntries(resolved.map((entry) => [entry.id, false])),
            );
            setPerformerQueryByEntry(
                Object.fromEntries(
                    resolved.map((entry) => [
                        entry.id,
                        joinPerformerNames(
                            entry.performerNames ?? [],
                            performerDelimiter,
                        ),
                    ]),
                ),
            );
            const resolvedCount = resolved.filter(
                (entry) => entry.songId,
            ).length;
            setOperationMessage(
                `${resolved.length} 件を取り込みました（song候補一致: ${resolvedCount}件）。`,
            );
        } finally {
            setIsImportingMemo(false);
        }
    };

    const addEmptyEntry = () => {
        const entry = createEntry();
        setEntries((current) => [...current, entry]);
        setPerformerResolutionByEntry((current) => ({
            ...current,
            [entry.id]: {},
        }));
        setSongQueryByEntry((current) => ({ ...current, [entry.id]: "" }));
        setSongSearchedByEntry((current) => ({
            ...current,
            [entry.id]: false,
        }));
        setPerformerQueryByEntry((current) => ({ ...current, [entry.id]: "" }));
    };
    const removeEntry = (id: string) => {
        setEntries((current) => current.filter((entry) => entry.id !== id));
        setSongQueryByEntry((current) => {
            const next = { ...current };
            delete next[id];
            return next;
        });
        setSongSearchedByEntry((current) => {
            const next = { ...current };
            delete next[id];
            return next;
        });
        setPerformerQueryByEntry((current) => {
            const next = { ...current };
            delete next[id];
            return next;
        });
        setPerformerResolutionByEntry((current) => {
            const next = { ...current };
            delete next[id];
            return next;
        });
    };

    const updateEntry = (id: string, patch: Partial<KrnEntry>) => {
        setEntries((current) =>
            current.map((entry) =>
                entry.id === id
                    ? {
                          ...entry,
                          ...patch,
                      }
                    : entry,
            ),
        );
    };
    const handleEntryDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setEntries((current) => {
            const fromIndex = current.findIndex(
                (entry) => entry.id === String(active.id),
            );
            const toIndex = current.findIndex(
                (entry) => entry.id === String(over.id),
            );
            if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
                return current;
            }
            return arrayMove(current, fromIndex, toIndex);
        });
    };

    const setEntryStep = (entryId: string, step: number) => {
        const normalized = Math.max(
            ENTRY_STEP_MIN,
            Math.min(ENTRY_STEP_MAX, step),
        );
        setEntryStepById((current) => ({ ...current, [entryId]: normalized }));
    };

    const focusInputAtEnd = (
        refs: MutableRefObject<Record<string, HTMLInputElement | null>>,
        entryId: string,
    ) => {
        if (typeof window === "undefined") return;
        window.requestAnimationFrame(() => {
            const input = refs.current[entryId];
            if (!input) return;
            input.focus();
            const cursor = input.value.length;
            input.setSelectionRange(cursor, cursor);
        });
    };

    const blurInput = (
        refs: MutableRefObject<Record<string, HTMLInputElement | null>>,
        entryId: string,
    ) => {
        if (typeof window === "undefined") return;
        window.requestAnimationFrame(() => {
            refs.current[entryId]?.blur();
        });
    };

    const skipEventInfoAndGoToSetlist = () => {
        if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => {
                const target = document.getElementById(
                    STAGE_INPUT_SCROLL_TARGET_ID,
                );
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    };

    const loadGroupIdByNormalizedKey = async (name: string): Promise<number | null> => {
        const key = normalizePerformerKey(name);
        if (!key || typeof db.listGroups !== "function") return null;
        if (!groupIdByKeyRef.current) {
            const map = new Map<string, number>();
            const groups = await db.listGroups();
            for (const group of groups) {
                const groupKey = normalizePerformerKey(group.name);
                if (!groupKey) continue;
                if (!map.has(groupKey)) map.set(groupKey, group.id);
            }
            groupIdByKeyRef.current = map;
        }
        return groupIdByKeyRef.current.get(key) ?? null;
    };

    const enrichPerformerChoicesWithGroupIds = async (
        choices: PerformerChoice[],
    ): Promise<PerformerChoice[]> =>
        await Promise.all(
            choices.map(async (choice) => {
                if (choice.groupId) return choice;
                const isGroupChoice = /\[group\]\s*$/i.test(choice.label);
                if (!isGroupChoice) return choice;
                const groupId = await loadGroupIdByNormalizedKey(choice.value);
                if (!groupId) return choice;
                return { ...choice, groupId };
            }),
        );

    const resolveSongByPriority = async (
        term: string,
        options?: {
            limit?: number;
            isStale?: () => boolean;
        },
    ): Promise<{
        choices: SongChoice[];
        autoResolved: SongChoice | null;
    }> => {
        const limit = options?.limit ?? LOOKUP_SUGGEST_LIMIT;
        const isStale = options?.isStale;
        const trimmed = term.trim();
        const termKey = normalizeSongKey(trimmed);
        const termVariants = new Set(normalizeSearchKeyVariants(trimmed));
        if (!termKey) return { choices: [], autoResolved: null };

        type Ranked = { choice: SongChoice; tier: 1 | 2 | 3 | 4 };
        const bestBySongId = new Map<number, Ranked>();
        const uniqueByName = new Map<string, Ranked>();
        const upsert = (choice: SongChoice, tier: 1 | 2 | 3 | 4) => {
            const byId = bestBySongId.get(choice.songId);
            if (!byId || tier < byId.tier) {
                bestBySongId.set(choice.songId, { choice, tier });
            }
            const nameKey = normalizeSongKey(choice.songName);
            const byName = uniqueByName.get(nameKey);
            if (!byName || tier < byName.tier) {
                uniqueByName.set(nameKey, { choice, tier });
            }
        };

        const directRows = await db.searchSongs(createSongSearchRequest(trimmed));
        if (isStale?.()) return { choices: [], autoResolved: null };
        let directChoices = directRows.rows
            .slice(0, SONG_RESOLVE_CANDIDATE_LIMIT)
            .map(mapSongRowToChoice);
        if (directChoices.length === 0) {
            for (const fallbackTerm of buildSongFallbackTerms(trimmed)) {
                const fallbackRows = await db.searchSongs(
                    createSongSearchRequest(fallbackTerm),
                );
                if (isStale?.()) return { choices: [], autoResolved: null };
                const picked = fallbackRows.rows
                    .slice(0, SONG_RESOLVE_CANDIDATE_LIMIT)
                    .map(mapSongRowToChoice);
                if (picked.length > 0) {
                    directChoices = picked;
                    break;
                }
            }
        }

        for (const choice of directChoices) {
            const nameKey = normalizeSongKey(choice.songName);
            if (!nameKey) continue;
            if (nameKey === termKey) {
                upsert(choice, 1);
                continue;
            }
            if (
                [...termVariants].some(
                    (variant) => variant && nameKey.includes(variant),
                )
            ) {
                upsert(choice, 3);
            }
        }

        const suggestRows = await db.suggest({
            field: "songName",
            term: trimmed,
            searchUnit: "setlist",
            limit: SONG_SUGGEST_FALLBACK_LIMIT,
        });
        if (isStale?.()) return { choices: [], autoResolved: null };

        const seenSuggestion = new Set<string>();
        for (const suggestion of suggestRows) {
            const candidateTerm = (suggestion.value || suggestion.label || "").trim();
            if (!candidateTerm) continue;
            const suggestionKey = normalizeSongKey(candidateTerm);
            if (!suggestionKey || seenSuggestion.has(suggestionKey)) continue;
            seenSuggestion.add(suggestionKey);

            const candidateRows = await db.searchSongs(
                createSongSearchRequest(candidateTerm),
            );
            if (isStale?.()) return { choices: [], autoResolved: null };
            const candidateChoices = candidateRows.rows
                .slice(0, SONG_RESOLVE_CANDIDATE_LIMIT)
                .map(mapSongRowToChoice);
            for (const choice of candidateChoices) {
                const nameKey = normalizeSongKey(choice.songName);
                if (!nameKey) continue;
                if (nameKey === suggestionKey && suggestionKey !== termKey) {
                    upsert(choice, 2);
                    continue;
                }
                if (
                    suggestionKey !== termKey &&
                    (nameKey.includes(suggestionKey) ||
                        suggestionKey.includes(nameKey))
                ) {
                    upsert(choice, 4);
                }
            }
        }

        const ranked = [...bestBySongId.values()].sort((a, b) => {
            if (a.tier !== b.tier) return a.tier - b.tier;
            return compareSongChoice(a.choice, b.choice, termKey);
        });
        const deduped = ranked
            .map((item) => uniqueByName.get(normalizeSongKey(item.choice.songName)) ?? item)
            .filter((item, index, self) => self.indexOf(item) === index)
            .slice(0, limit)
            .map((item) => item.choice);

        const bestTier = ranked[0]?.tier;
        const autoResolved =
            bestTier === undefined
                ? null
                : ranked.filter((item) => item.tier === bestTier).length === 1
                  ? ranked[0]?.choice ?? null
                  : null;

        return {
            choices: deduped,
            autoResolved,
        };
    };

    const suggestSongs = async (entryId: string, termInput?: string) => {
        const fallbackTerm =
            entries.find((item) => item.id === entryId)?.songName ?? "";
        const term = (
            termInput ??
            songQueryByEntry[entryId] ??
            fallbackTerm
        ).trim();
        if (term.length < SEARCH_MIN_TERM_LENGTH) {
            setOperationMessage("楽曲候補検索は1文字以上で実行してください。");
            setSongSearchedByEntry((current) => ({
                ...current,
                [entryId]: false,
            }));
            return;
        }

        setSongSearchedByEntry((current) => ({ ...current, [entryId]: false }));
        setSongLoadingByEntry((current) => ({ ...current, [entryId]: true }));
        const requestSeq = (songSuggestRequestSeqRef.current[entryId] ?? 0) + 1;
        songSuggestRequestSeqRef.current[entryId] = requestSeq;
        let shouldUpdate = true;
        try {
            const resolved = await resolveSongByPriority(term, {
                limit: LOOKUP_SUGGEST_LIMIT,
                isStale: () =>
                    songSuggestRequestSeqRef.current[entryId] !== requestSeq,
            });
            if (songSuggestRequestSeqRef.current[entryId] !== requestSeq) {
                shouldUpdate = false;
                return;
            }
            const choices = resolved.choices;
            setSongChoicesByEntry((current) => ({
                ...current,
                [entryId]: choices,
            }));
            if (resolved.autoResolved) {
                updateEntry(entryId, {
                    songName: resolved.autoResolved.songName,
                    songId: resolved.autoResolved.songId,
                    songVersionId: null,
                    songArtistId: resolved.autoResolved.artistId,
                    songArtistName: resolved.autoResolved.artistName,
                });
            }
        } catch (error) {
            if (songSuggestRequestSeqRef.current[entryId] !== requestSeq) {
                shouldUpdate = false;
                return;
            }
            setOperationMessage(
                `楽曲候補検索に失敗: ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            if (shouldUpdate) {
                setSongLoadingByEntry((current) => ({
                    ...current,
                    [entryId]: false,
                }));
                setSongSearchedByEntry((current) => ({
                    ...current,
                    [entryId]: true,
                }));
            }
        }
    };

    const selectSongChoice = (entryId: string, songId: number) => {
        const choice = songChoicesByEntry[entryId]?.find(
            (row) => row.songId === songId,
        );
        if (!choice) return;
        updateEntry(entryId, {
            songName: choice.songName,
            songId: choice.songId,
            songVersionId: null,
            songArtistId: choice.artistId,
            songArtistName: choice.artistName,
        });
        setSongQueryByEntry((current) => ({
            ...current,
            [entryId]: choice.songName,
        }));
        setSongChoicesByEntry((current) => ({
            ...current,
            [entryId]: [],
        }));
        setSongDropdownOpenByEntry((current) => ({
            ...current,
            [entryId]: false,
        }));
        blurInput(songInputRefs, entryId);
    };

    const queueSuggestSongs = (entryId: string, value: string) => {
        const existingTimer = songSuggestTimerRef.current[entryId];
        if (existingTimer) {
            window.clearTimeout(existingTimer);
        }
        songSuggestTimerRef.current[entryId] = window.setTimeout(() => {
            void suggestSongs(entryId, value);
            delete songSuggestTimerRef.current[entryId];
        }, LOOKUP_DEBOUNCE_MS);
    };

    const openSongCandidatePicker = (entry: KrnEntry) => {
        updateEntry(entry.id, {
            isSongFreeInput: false,
        });
        const term = (
            songQueryByEntry[entry.id] ??
            entry.songName
        ).trim();
        setSongQueryByEntry((current) => ({
            ...current,
            [entry.id]: term,
        }));
        setSongSearchedByEntry((current) => ({
            ...current,
            [entry.id]: false,
        }));
        setSongDropdownOpenByEntry((current) => ({
            ...current,
            [entry.id]: true,
        }));
        if (term.length >= SEARCH_MIN_TERM_LENGTH) {
            void suggestSongs(entry.id, term);
        }
        focusInputAtEnd(songInputRefs, entry.id);
    };

    const suggestPerformers = async (entryId: string, termInput?: string) => {
        const term = (termInput ?? performerQueryByEntry[entryId] ?? "").trim();
        if (term.length < SEARCH_MIN_TERM_LENGTH) {
            return;
        }

        setPerformerLoadingByEntry((current) => ({
            ...current,
            [entryId]: true,
        }));
        const requestSeq =
            (performerSuggestRequestSeqRef.current[entryId] ?? 0) + 1;
        performerSuggestRequestSeqRef.current[entryId] = requestSeq;
        let shouldUpdate = true;
        try {
            const [members, groups] = await Promise.all([
                db.searchMembers(createMemberSearchRequest(term)),
                db.suggest({
                    field: "groupName",
                    term,
                    searchUnit: "setlist",
                    limit: LOOKUP_SUGGEST_LIMIT,
                }),
            ]);
            if (performerSuggestRequestSeqRef.current[entryId] !== requestSeq) {
                shouldUpdate = false;
                return;
            }
            const termKeys = new Set(normalizeSearchKeyVariants(term));
            const mergedChoices = mergePerformerChoices(members.rows, groups);
            const choices = (await enrichPerformerChoicesWithGroupIds(mergedChoices)).sort(
                (a, b) => comparePerformerChoice(a, b, termKeys),
            );
            setPerformerChoicesByEntry((current) => ({
                ...current,
                [entryId]: choices,
            }));
        } catch (error) {
            if (performerSuggestRequestSeqRef.current[entryId] !== requestSeq) {
                shouldUpdate = false;
                return;
            }
            setOperationMessage(
                `歌唱者候補検索に失敗: ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            if (shouldUpdate) {
                setPerformerLoadingByEntry((current) => ({
                    ...current,
                    [entryId]: false,
                }));
            }
        }
    };

    const addPerformersToEntry = (
        entryId: string,
        performers: Array<{
            name: string;
            personId?: number | null;
            groupId?: number | null;
        }>,
    ) => {
        const normalizedItems = performers
            .map((performer) => ({
                name: performer.name.trim(),
                personId: performer.personId ?? null,
                groupId: performer.groupId ?? null,
            }))
            .filter((performer) => performer.name.length > 0);
        if (normalizedItems.length === 0) return;
        setEntries((current) =>
            current.map((entry) => {
                if (entry.id !== entryId) return entry;
                const nextSet = new Set([
                    ...entry.performerNames.map((name) => name.trim()),
                    ...normalizedItems.map((item) => item.name),
                ]);
                return {
                    ...entry,
                    performerNames: [...nextSet].filter(
                        (name) => name.length > 0,
                    ),
                };
            }),
        );
        setPerformerResolutionByEntry((current) => {
            const nextByEntry = { ...(current[entryId] ?? {}) };
            for (const performer of normalizedItems) {
                nextByEntry[normalizePerformerStateKey(performer.name)] = {
                    personId: performer.personId,
                    groupId: performer.groupId,
                };
            }
            return {
                ...current,
                [entryId]: nextByEntry,
            };
        });
    };

    const applyCommonPerformers = () => {
        const names = parsePerformerNames(commonPerformerInput);
        if (names.length === 0) {
            setOperationMessage("共通歌唱者を入力してください。");
            return;
        }
        let appliedRows = 0;
        setEntries((current) =>
            current.map((entry) => {
                if (entry.isMc) return entry;
                appliedRows += 1;
                const nextSet = new Set([
                    ...entry.performerNames.map((name) => name.trim()),
                    ...names,
                ]);
                return {
                    ...entry,
                    performerNames: [...nextSet].filter(
                        (name) => name.length > 0,
                    ),
                };
            }),
        );
        setPerformerResolutionByEntry((current) => {
            const next = { ...current };
            for (const entry of entries) {
                if (entry.isMc) continue;
                const byEntry = { ...(next[entry.id] ?? {}) };
                for (const name of names) {
                    byEntry[normalizePerformerStateKey(name)] = {
                        personId: null,
                        groupId: null,
                    };
                }
                next[entry.id] = byEntry;
            }
            return next;
        });
        setOperationMessage(`共通歌唱者を ${appliedRows} 行に追加しました。`);
    };

    const addPerformerFromQuery = (entry: KrnEntry) => {
        const raw = (performerQueryByEntry[entry.id] ?? "").trim();
        if (!raw) return;
        if (!entry.isPerformerTextInput) {
            const exact = (performerChoicesByEntry[entry.id] ?? []).find(
                (choice) => choice.value === raw || choice.label === raw,
            );
            if (!exact) {
                setOperationMessage("歌唱者は候補から選択してください。");
                return;
            }
            addPerformersToEntry(entry.id, [
                {
                    name: exact.value,
                    personId: exact.personId,
                    groupId: exact.groupId,
                },
            ]);
            setPerformerQueryByEntry((current) => ({
                ...current,
                [entry.id]: "",
            }));
            return;
        }

        const names = parsePerformerNames(raw);
        if (names.length === 0) return;
        addPerformersToEntry(
            entry.id,
            names.map((name) => ({
                name,
                personId: null,
                groupId: null,
            })),
        );
        setPerformerQueryByEntry((current) => ({ ...current, [entry.id]: "" }));
    };

    const removePerformerFromEntry = (entryId: string, name: string) => {
        setEntries((current) =>
            current.map((entry) =>
                entry.id === entryId
                    ? {
                          ...entry,
                          performerNames: entry.performerNames.filter(
                              (value) => value !== name,
                          ),
                      }
                    : entry,
            ),
        );
        setPerformerResolutionByEntry((current) => {
            const byEntry = { ...(current[entryId] ?? {}) };
            delete byEntry[normalizePerformerStateKey(name)];
            return {
                ...current,
                [entryId]: byEntry,
            };
        });
    };

    const queueSuggestPerformers = (entryId: string, value: string) => {
        const existingTimer = performerSuggestTimerRef.current[entryId];
        if (existingTimer) {
            window.clearTimeout(existingTimer);
        }
        performerSuggestTimerRef.current[entryId] = window.setTimeout(() => {
            void suggestPerformers(entryId, value);
            delete performerSuggestTimerRef.current[entryId];
        }, LOOKUP_DEBOUNCE_MS);
    };

    const openPerformerCandidatePicker = (entry: KrnEntry) => {
        updateEntry(entry.id, {
            isPerformerTextInput: false,
        });
        const fallbackTerm = joinPerformerNames(
            entry.performerNames ?? [],
            performerDelimiter,
        );
        const term = (
            performerQueryByEntry[entry.id] ??
            fallbackTerm
        ).trim();
        setPerformerQueryByEntry((current) => ({
            ...current,
            [entry.id]: term,
        }));
        setPerformerDropdownOpenByEntry((current) => ({
            ...current,
            [entry.id]: true,
        }));
        if (term.length >= SEARCH_MIN_TERM_LENGTH) {
            void suggestPerformers(entry.id, term);
        }
        focusInputAtEnd(performerInputRefs, entry.id);
    };

    const resolveSongCandidates = async (
        rows: KrnEntry[],
    ): Promise<KrnEntry[]> => {
        if (typeof db.searchSongs !== "function") {
            return rows.map((row) => ({
                ...row,
                songId: null,
                songVersionId: null,
                isSongFreeInput: true,
            }));
        }
        const cache = new Map<string, SongChoice | null>();
        const out: KrnEntry[] = [];

        for (const row of rows) {
            if (row.isMc || /^MC$/i.test((row.songName ?? "").trim())) {
                out.push({
                    ...row,
                    songId: null,
                    songVersionId: null,
                    songArtistId: null,
                    songArtistName: "",
                });
                continue;
            }
            const songName = (row.songName ?? "").trim();
            if (!songName) {
                out.push(row);
                continue;
            }
            const key = normalizeSongKey(songName);
            if (!key) {
                out.push(row);
                continue;
            }

            if (!cache.has(key)) {
                const resolved = await resolveSongByPriority(songName, {
                    limit: SONG_RESOLVE_CANDIDATE_LIMIT,
                });
                cache.set(key, resolved.autoResolved);
            }

            const hit = cache.get(key);
            if (hit) {
                out.push({
                    ...row,
                    songName: hit.songName,
                    songId: hit.songId,
                    songVersionId: null,
                    songArtistId: hit.artistId,
                    songArtistName: hit.artistName,
                    isSongFreeInput: false,
                });
                continue;
            }
            out.push({
                ...row,
                songId: null,
                songVersionId: null,
                songArtistId: null,
                isSongFreeInput: true,
            });
        }

        return out;
    };

    const resolvePerformerCandidates = async (
        rows: KrnEntry[],
    ): Promise<{
        rows: KrnEntry[];
        resolvedByEntry: Record<string, Record<string, PerformerResolved>>;
    }> => {
        const cache = new Map<string, string | null>();
        const cacheMeta = new Map<string, PerformerResolved>();
        const resolveSinglePerformer = async (name: string): Promise<{
            resolvedName: string | null;
            meta: PerformerResolved;
        }> => {
            const key = normalizePerformerKey(name);
            if (!key) {
                return {
                    resolvedName: null,
                    meta: { personId: null, groupId: null },
                };
            }
            const keyVariants = new Set(normalizeSearchKeyVariants(name));
            if (!cache.has(key)) {
                try {
                    const [members, groups] = await Promise.all([
                        db.searchMembers(createMemberSearchRequest(name)),
                        db.suggest({
                            field: "groupName",
                            term: name,
                            searchUnit: "setlist",
                            limit: LOOKUP_SUGGEST_LIMIT,
                        }),
                    ]);
                    const choices = await enrichPerformerChoicesWithGroupIds(
                        mergePerformerChoices(members.rows, groups),
                    );
                    const exactMatches = choices.filter((choice) => {
                        const valueKey = normalizePerformerKey(choice.value);
                        const labelKey = normalizePerformerKey(choice.label);
                        return (
                            keyVariants.has(valueKey) ||
                            keyVariants.has(labelKey)
                        );
                    });
                    const sortedMatches = [...exactMatches].sort((a, b) =>
                        comparePerformerChoice(a, b, keyVariants),
                    );
                    const top = sortedMatches[0];
                    const topIsGroup = top
                        ? /\[group\]\s*$/i.test(top.label)
                        : false;
                    if (sortedMatches.length === 1 || topIsGroup) {
                        if (top) {
                            cache.set(key, top.value);
                            cacheMeta.set(key, {
                                personId: top.personId,
                                groupId: top.groupId,
                            });
                        } else {
                            cache.set(key, null);
                            cacheMeta.set(key, {
                                personId: null,
                                groupId: null,
                            });
                        }
                    } else {
                        cache.set(key, null);
                        cacheMeta.set(key, {
                            personId: null,
                            groupId: null,
                        });
                    }
                } catch {
                    cache.set(key, null);
                    cacheMeta.set(key, { personId: null, groupId: null });
                }
            }
            return {
                resolvedName: cache.get(key) ?? null,
                meta: cacheMeta.get(key) ?? { personId: null, groupId: null },
            };
        };
        const out: KrnEntry[] = [];
        const resolvedByEntry: Record<
            string,
            Record<string, PerformerResolved>
        > = {};
        for (const row of rows) {
            if (row.isMc || row.performerNames.length === 0) {
                out.push(row);
                continue;
            }
            const resolvedNames: string[] = [];
            let hasUnresolved = false;
            const byEntry: Record<string, PerformerResolved> = {};
            for (const rawName of row.performerNames) {
                const name = rawName.trim();
                if (!name) continue;
                const resolvedSingle = await resolveSinglePerformer(name);
                if (resolvedSingle.resolvedName) {
                    resolvedNames.push(resolvedSingle.resolvedName);
                    byEntry[normalizePerformerStateKey(resolvedSingle.resolvedName)] =
                        resolvedSingle.meta;
                    continue;
                }

                const spacedParts = name
                    .split(/\s+/)
                    .map((part) => part.trim())
                    .filter((part) => part.length > 0);
                if (spacedParts.length >= 2) {
                    let allResolved = true;
                    for (const part of spacedParts) {
                        const partial = await resolveSinglePerformer(part);
                        const resolvedName = partial.resolvedName ?? part;
                        resolvedNames.push(resolvedName);
                        byEntry[normalizePerformerStateKey(resolvedName)] =
                            partial.resolvedName
                                ? partial.meta
                                : {
                                      personId: null,
                                      groupId: null,
                                  };
                        if (!partial.resolvedName) {
                            allResolved = false;
                        }
                    }
                    if (!allResolved) hasUnresolved = true;
                } else {
                    resolvedNames.push(name);
                    hasUnresolved = true;
                    byEntry[normalizePerformerStateKey(name)] = {
                        personId: null,
                        groupId: null,
                    };
                }
            }
            resolvedByEntry[row.id] = byEntry;
            out.push({
                ...row,
                performerNames: [...new Set(resolvedNames)],
                isPerformerTextInput: hasUnresolved,
            });
        }
        return {
            rows: out,
            resolvedByEntry,
        };
    };

    const clearDraft = () => {
        setStageSearchDate("");
        setStageSearchTerm("");
        setStageCandidates([]);
        setStageSearchError("");
        setSelectedStage(null);
        setEventName("");
        setStageDate("");
        setVenueName("");
        setStartTime("");
        setPattern("");
        setRawInput("");
        setParseIncludePerformer(true);
        setParsePerformerDelimiter("auto");
        const initialRows = createInitialRows();
        setEntries(initialRows);
        setSongQueryByEntry(
            Object.fromEntries(initialRows.map((row) => [row.id, ""])),
        );
        setPerformerQueryByEntry(
            Object.fromEntries(initialRows.map((row) => [row.id, ""])),
        );
        setSongChoicesByEntry({});
        setSongSearchedByEntry({});
        setPerformerChoicesByEntry({});
        setPerformerResolutionByEntry(
            buildDefaultPerformerResolutionByEntry(initialRows),
        );
        setCommonPerformerInput("");
        setOutputOptions({
            artistDisplayMode: "inline",
            artistInlineStyle: "slash",
            artistPrefixCustom: "アーティスト: ",
            includeEvent: true,
            performerDisplayMode: "newline",
            performerInlineStyle: "dot",
            performerPrefixCustom: "歌唱: ",
            includeNote: true,
            sectionAsHeader: true,
            includeMc: false,
            countMcInMusicOrder: false,
        });
        setExportFormat("text");
        setPerformerDelimiter("・");
        setNotifyTomoko(true);
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
    };

    const normalizedEntries = useMemo(
        () => entries.filter((entry) => entry.songName.trim().length > 0),
        [entries],
    );
    const exportLines = useMemo(
        () => buildKrnLines(normalizedEntries),
        [normalizedEntries],
    );

    const exportPayload = useMemo(
        () => ({
            eventName,
            stageDate,
            venueName,
            startTime,
            pattern,
            stageId: selectedStage?.stageId ?? null,
            eventId: selectedStage?.eventId ?? null,
            entries: normalizedEntries,
            outputOptions,
            performerDelimiter,
        }),
        [
            eventName,
            stageDate,
            venueName,
            startTime,
            pattern,
            selectedStage,
            normalizedEntries,
            outputOptions,
            performerDelimiter,
        ],
    );

    const exportText = useMemo(
        () => buildExportText(exportPayload),
        [exportPayload],
    );
    const exportCsv = useMemo(
        () => buildExportCsv(exportPayload),
        [exportPayload],
    );
    const exportHtmlFragment = useMemo(
        () => buildExportHtmlFragment(exportPayload),
        [exportPayload],
    );
    const exportHtml = useMemo(
        () => buildExportHtml(exportPayload),
        [exportPayload],
    );
    const imageTextMarkup = useMemo(
        () =>
            `<div style="display:inline-block;background:#fff;color:#1f2937;padding:16px;border:1px solid #ddd6fe;border-radius:12px;font-family:'M PLUS 1 Code','SFMono-Regular','Consolas','Menlo',monospace;font-size:18px;line-height:1.45;white-space:pre;">${escapeHtml(exportText || NOTE_EMPTY)}</div>`,
        [exportText],
    );
    const imageHtmlMarkup = useMemo(
        () =>
            `<div style="display:inline-block;background:#fff;color:#1f2937;padding:16px;border:1px solid #ddd6fe;border-radius:12px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;">
  <style>
    table{border-collapse:collapse;font-size:14px;width:auto;max-width:none}
    th,td{border:1px solid #d1d5db;padding:6px 8px;vertical-align:top;white-space:nowrap}
    thead th{background:#f3f4f6;text-align:left}
    tr.section th{background:#ede9fe;color:#4c1d95;text-align:left;font-weight:700}
    .event{margin-bottom:10px;font-size:13px;line-height:1.4;white-space:nowrap}
  </style>
  ${exportHtmlFragment}
</div>`,
        [exportHtmlFragment],
    );
    const imagePreviewText =
        imageExportSource === "text" ? exportText : exportHtmlFragment;

    const exportPreview = useMemo(() => {
        if (exportFormat === "csv") {
            return exportCsv;
        }
        if (exportFormat === "html") {
            return exportHtml;
        }
        if (exportFormat === "twitter") {
            return `${exportText}\n\n#KRNセトリ #ハロプロ`;
        }
        if (exportFormat === "image") {
            return imagePreviewText;
        }
        return exportText;
    }, [exportFormat, exportText, exportCsv, exportHtml, imagePreviewText]);

    const filenamePrefix = useMemo(() => {
        const eventTitle = buildEventTitleLine(eventName, pattern).trim();
        const venuePart = venueName.trim();
        const baseName = [eventTitle, venuePart]
            .filter((value) => value.length > 0)
            .join("-");
        const slug = (baseName || eventName || "krn-setlist")
            .replace(/[\\/:*?"<>|]/g, "")
            .replace(/\s+/g, "-")
            .slice(0, 48);
        const datePrefix = formatDateForFilename(stageDate);
        const safeSlug = slug || "krn-setlist";
        return datePrefix ? `${datePrefix}-${safeSlug}` : safeSlug;
    }, [eventName, pattern, venueName, stageDate]);
    const isCopyAction = exportFormat === "text" || exportFormat === "html";
    const canDownloadImage = exportFormat === "text" || exportFormat === "html";
    const isTwitterAction = exportFormat === "twitter";
    const tweetParseResult = useMemo(
        () =>
            isTwitterAction ? parseTweetWithTwitterText(exportPreview) : null,
        [isTwitterAction, exportPreview],
    );
    const tweetLength = tweetParseResult?.weightedLength ?? 0;
    const isTweetTooLong = isTwitterAction && tweetParseResult?.valid === false;

    const triggerTomokoSubmission = () => {
        if (!notifyTomoko) return;
        if (exportLines.length === 0) {
            setOperationMessage(
                "ToMoKo送信スキップ: 送信対象の行がありません（楽曲行を1件以上作成してください）。",
            );
            return;
        }
        void submitKrnSubmission({
            routeName: "krn",
            routeId: null,
            eventName,
            stageDate,
            startTime,
            venueName,
            pattern,
            stageId: selectedStage?.stageId ?? null,
            eventId: selectedStage?.eventId ?? null,
            outputFormat: exportFormat,
            notifyTomoko,
            options: {
                includeEvent: outputOptions.includeEvent,
                includeArtist: outputOptions.artistDisplayMode !== "hidden",
                includePerformer:
                    outputOptions.performerDisplayMode !== "hidden",
                performerDelimiter,
                artistDisplayMode: outputOptions.artistDisplayMode,
                artistInlineStyle: outputOptions.artistInlineStyle,
                artistPrefixCustom: outputOptions.artistPrefixCustom,
                performerDisplayMode: outputOptions.performerDisplayMode,
                performerInlineStyle: outputOptions.performerInlineStyle,
                performerPrefixCustom: outputOptions.performerPrefixCustom,
            },
            exportPreview,
            entries: exportLines.map((line) => ({
                lineOrder: line.lineOrder,
                musicOrder: line.musicOrder,
                section: line.entry.section,
                displayName: line.entry.songName,
                isMc:
                    line.entry.isMc || /^MC$/i.test(line.entry.songName.trim()),
                isMedley: line.entry.isMedley,
                isNewSong: false,
                note: line.entry.note,
                songId: line.entry.songId,
                songVersionId: line.entry.songVersionId,
                songArtistId: line.entry.songArtistId,
                artistName: line.entry.songArtistName,
                performers: line.entry.performerNames,
                performersNormalized: line.entry.performerNames.map((name) => {
                    const resolved =
                        performerResolutionByEntry[line.entry.id]?.[
                            normalizePerformerStateKey(name)
                        ];
                    return {
                        performerName: name,
                        personId: resolved?.personId ?? null,
                        groupId: resolved?.groupId ?? null,
                    };
                }),
            })),
        })
            .then((submission) => {
                setOperationMessage(
                    `ToMoKoへ送信しました (受付ID: ${submission.id}, ${submission.lineCount}行)。`,
                );
            })
            .catch((error) => {
                setOperationMessage(
                    `ToMoKo送信失敗: ${error instanceof Error ? error.message : String(error)}`,
                );
            });
    };

    const downloadImageFromSource = (source: ImageExportSource) => {
        triggerTomokoSubmission();
        setIsExportingImage(true);
        void renderMarkupToPngBlob(
            source === "text" ? imageTextMarkup : imageHtmlMarkup,
        )
            .then((blob) => {
                if (!blob) {
                    setOperationMessage("画像の生成に失敗しました。");
                    return;
                }
                const suffix = source === "text" ? "text-image" : "table-image";
                downloadBlobFile(`${filenamePrefix}-${suffix}.png`, blob);
                setOperationMessage("画像を保存しました。");
            })
            .catch((error) => {
                setOperationMessage(
                    `画像生成に失敗: ${error instanceof Error ? error.message : String(error)}`,
                );
            })
            .finally(() => {
                setIsExportingImage(false);
            });
    };

    const handleCopyExportAction = () => {
        triggerTomokoSubmission();
        const copyValue =
            exportFormat === "html" ? exportHtmlFragment : exportText;
        void copyText(copyValue).then((ok) => {
            setOperationMessage(
                ok
                    ? "出力テキストをコピーしました。"
                    : "コピーに失敗しました。",
            );
        });
    };

    const handlePrimaryExportAction = () => {
        if (isTwitterAction && isTweetTooLong) {
            setOperationMessage(
                `投稿文字数が上限を超えています (${tweetLength}/${TWITTER_MAX_LENGTH})。`,
            );
            return;
        }

        if (isTwitterAction) {
            if (typeof window === "undefined") {
                setOperationMessage("Twitter投稿画面を開けませんでした。");
                return;
            }
            const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(exportPreview)}`;
            const opened = window.open(
                intentUrl,
                "_blank",
                "noopener,noreferrer",
            );
            if (opened) {
                setOperationMessage("Twitter投稿画面を開きました。");
                triggerTomokoSubmission();
            } else {
                setOperationMessage(
                    "Twitter投稿画面を開けなかったため、ポップアップ設定を確認してください。",
                );
            }
            return;
        }
        if (exportFormat === "image") {
            downloadImageFromSource(imageExportSource);
            return;
        }
        triggerTomokoSubmission();
        const ext = exportFormat === "csv" ? "csv" : "txt";
        downloadTextFile(`${filenamePrefix}.${ext}`, exportPreview);
        setOperationMessage("出力ファイルを保存しました。");
    };

    return (
        <section className="mx-auto max-w-5xl space-y-3 pb-24 [&_input]:text-base [&_select]:text-base [&_textarea]:text-base md:pb-8 md:[&_input]:text-sm md:[&_select]:text-sm md:[&_textarea]:text-sm">
            <div className="relative rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-100 via-fuchsia-50 to-indigo-100 p-3 shadow-sm md:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
                        <div className="flex flex-col items-center leading-none">
                            <img
                                src="/KRN.png"
                                alt="KRN ロゴ"
                                className="-my-1 h-28 w-auto md:-my-2 md:h-36"
                            />
                        </div>
                        <p className="max-w-md text-sm leading-5 text-violet-800">
                            1. イベント情報を選択 → 2. セットリストを入力 → 3.
                            プレビュー&出力ボタンを実行
                            で簡単に詳細なセットリストが作成できます。
                        </p>
                    </div>
                </div>
                <a
                    href="/"
                    title="ToMoKoへ戻る"
                    aria-label="ToMoKoへ戻る"
                    className="absolute right-2 top-2 inline-flex h-9 items-center justify-center gap-1 rounded-none bg-transparent px-1 text-violet-900 transition hover:opacity-70"
                >
                    <span className="hidden text-xs font-semibold text-violet-900 md:inline">
                        ToMoKo
                    </span>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 -960 960 960"
                        className="h-6 w-6 fill-current"
                        aria-hidden="true"
                    >
                        <path d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z" />
                    </svg>
                </a>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3 md:p-4">
                <h2 className="mb-3 text-sm font-semibold text-violet-900">
                    1. イベント情報を選択
                </h2>
                <form
                    autoComplete="off"
                    className="flex flex-col gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void performStageSearch();
                    }}
                >
                    <div className="min-w-0">
                        <SearchDateField
                            label="検索日付"
                            hideLabel
                            value={stageSearchDate}
                            onChange={setStageSearchDate}
                        />
                    </div>
                    <input autoComplete="off"
                        type="text"
                        value={stageSearchTerm}
                        onChange={(event) =>
                            setStageSearchTerm(event.target.value)
                        }
                        placeholder="イベント名・会場名・キーワード (任意)"
                        className="h-8 w-full rounded-xl border border-violet-300 px-3 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={searchingStage}
                        className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50/70 px-3 text-sm font-semibold text-violet-800 disabled:opacity-60"
                    >
                        <SearchIcon className="h-4 w-4" />
                        {searchingStage ? "検索中..." : "検索"}
                    </button>
                </form>
                {stageSearchError ? (
                    <p className="mt-2 text-xs text-red-700">
                        {stageSearchError}
                    </p>
                ) : null}
                {stageSearchExecuted &&
                !searchingStage &&
                !stageSearchError &&
                stageCandidates.length === 0 ? (
                    <p className="mt-2 text-xs text-violet-700">
                        検索結果が見つかりませんでした。
                    </p>
                ) : null}

                {stageCandidates.length > 0 ? (
                    <ul className="mt-3 max-h-56 space-y-2 overflow-auto border border-violet-100 p-2">
                        {stageCandidates.map((candidate) => (
                            <li key={candidate.stageId}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        void selectStage(candidate);
                                    }}
                                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                                        selectedStage?.stageId ===
                                        candidate.stageId
                                            ? "border-violet-400 bg-violet-100/80"
                                            : "border-violet-200 bg-violet-50/70"
                                    }`}
                                >
                                    <div className="font-medium text-violet-900">
                                        {buildEventTitleLine(
                                            candidate.eventName,
                                            candidate.pattern,
                                        )}
                                    </div>
                                    <div className="mt-1 text-xs text-violet-600">
                                        {buildEventDetailLine(
                                            candidate.date,
                                            candidate.startTime,
                                            candidate.venueName,
                                        )}
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <label className="text-xs text-violet-800">
                        イベント名
                        <input autoComplete="off"
                            type="text"
                            value={eventName}
                            onChange={(event) =>
                                setEventName(event.target.value)
                            }
                            className="mt-1 h-8 w-full rounded-xl border border-violet-300 px-3 text-sm"
                        />
                    </label>
                    <SearchDateField
                        label="開催日"
                        value={stageDate}
                        onChange={setStageDate}
                    />
                    <label className="text-xs text-violet-800">
                        会場
                        <input autoComplete="off"
                            type="text"
                            value={venueName}
                            onChange={(event) =>
                                setVenueName(event.target.value)
                            }
                            className="mt-1 h-8 w-full rounded-xl border border-violet-300 px-3 text-sm"
                        />
                    </label>
                    <label className="text-xs text-violet-800">
                        開演時間
                        <input autoComplete="off"
                            type="text"
                            value={startTime}
                            onChange={(event) =>
                                setStartTime(event.target.value)
                            }
                            placeholder="HH:mm"
                            className="mt-1 h-8 w-full rounded-xl border border-violet-300 px-3 text-sm"
                        />
                    </label>
                    <label className="text-xs text-violet-800">
                        パターン
                        <input autoComplete="off"
                            type="text"
                            value={pattern}
                            onChange={(event) => setPattern(event.target.value)}
                            placeholder="A/B"
                            className="mt-1 h-8 w-full rounded-xl border border-violet-300 px-3 text-sm"
                        />
                    </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={!selectedStage}
                        onClick={() => {
                            void loadExistingSetlist();
                        }}
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50/70 px-3 text-xs font-semibold text-violet-800 disabled:opacity-60"
                    >
                        <LinkIcon className="h-4 w-4" />
                        既存セットリスト読込
                    </button>
                </div>
                <div className="mt-2 text-right">
                    <button
                        type="button"
                        onClick={skipEventInfoAndGoToSetlist}
                        className="text-[11px] text-violet-600 underline underline-offset-2"
                    >
                        あとで入力する
                    </button>
                </div>
            </div>

            <div
                id={STAGE_INPUT_SCROLL_TARGET_ID}
                className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3 md:p-4"
            >
                <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-violet-900">
                        2. セットリストを入力
                    </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setIsParseModalOpen(true)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-500 bg-violet-600 px-4 text-sm font-bold text-white shadow-sm"
                    >
                        <SparklesIcon className="h-4 w-4" />
                        雑メモを変換して取り込み
                    </button>
                </div>
                <p className="mt-2 text-[11px] text-violet-700">
                    入力した名前を全行の歌唱者に一括で追加します。
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[240px] flex-1">
                        <input autoComplete="off"
                            type="text"
                            value={commonPerformerInput}
                            onChange={(event) =>
                                setCommonPerformerInput(event.target.value)
                            }
                            placeholder="Juice=Juice"
                            className="h-8 w-full rounded-xl border border-violet-300 bg-white px-2 pr-8 text-xs text-violet-900"
                        />
                        <button
                            type="button"
                            onClick={() => setCommonPerformerInput("")}
                            disabled={commonPerformerInput.trim().length === 0}
                            aria-label="共通歌唱者をクリア"
                            title="共通歌唱者をクリア"
                            className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-xl border border-transparent text-violet-600 disabled:pointer-events-none disabled:opacity-30"
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={applyCommonPerformers}
                        className="inline-flex h-8 items-center justify-center rounded-xl border border-violet-300 bg-violet-50/70 px-3 text-xs font-semibold text-violet-800"
                    >
                        追加
                    </button>
                </div>

                <p className="mt-4 text-xs font-semibold text-violet-800">
                    入力中のセットリスト: {normalizedEntries.length}曲
                </p>
                {entries.length === 0 ? (
                    <p className="mt-2 text-sm text-violet-600">
                        まだセットリスト行がありません。まず「行を追加」か「雑メモを解析して取り込み」で入力してください。
                    </p>
                ) : (
                    <div className="mt-3 space-y-3">
                        <DndContext
                            sensors={dragSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleEntryDragEnd}
                        >
                            <SortableContext
                                items={entries.map((entry) => entry.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {entries.map((entry, index) => (
                                    <SortableEntryContainer
                                        key={entry.id}
                                        id={entry.id}
                                    >
                                        {({
                                            handleRef,
                                            handleAttributes,
                                            handleListeners,
                                            isDragging,
                                        }) => (
                                            <article
                                                className={`rounded-xl border border-violet-200 bg-white/70 p-3 shadow-sm ${isDragging ? "ring-2 ring-violet-300" : ""}`}
                                            >
                                                <div className="flex items-center justify-between border-b border-violet-100 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            ref={handleRef}
                                                            {...handleAttributes}
                                                            {...handleListeners}
                                                            className="inline-flex h-8 items-center gap-1 rounded-xl px-1 text-violet-600 cursor-grab active:cursor-grabbing touch-none select-none"
                                                            title="ドラッグして並び替え"
                                                        >
                                                            <GripVerticalIcon className="h-4 w-4" />
                                                            <span
                                                                aria-label={`曲順 ${index + 1}`}
                                                                className="inline-flex h-8 items-center gap-0.5 px-1 text-xs font-semibold tabular-nums text-violet-700 select-none"
                                                            >
                                                                <span>#</span>
                                                                <span className="text-sm leading-none">
                                                                    {index + 1}
                                                                </span>
                                                            </span>
                                                        </div>
                                                        <label
                                                            className="ml-2 inline-flex items-center gap-1 text-xs text-violet-800"
                                                            onPointerDown={(
                                                                event,
                                                            ) =>
                                                                event.stopPropagation()
                                                            }
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    entry.isMc
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) => {
                                                                    const checked =
                                                                        event
                                                                            .target
                                                                            .checked;
                                                                    updateEntry(
                                                                        entry.id,
                                                                        {
                                                                            isMc: checked,
                                                                            songName:
                                                                                checked
                                                                                    ? "MC"
                                                                                    : entry.songName ===
                                                                                        "MC"
                                                                                      ? ""
                                                                                      : entry.songName,
                                                                            songId: null,
                                                                            songVersionId:
                                                                                null,
                                                                            songArtistId:
                                                                                null,
                                                                            songArtistName:
                                                                                "",
                                                                            isSongFreeInput:
                                                                                checked
                                                                                    ? true
                                                                                    : entry.isSongFreeInput,
                                                                            isMedley:
                                                                                checked
                                                                                    ? false
                                                                                    : entry.isMedley,
                                                                        },
                                                                    );
                                                                    setEntryStep(
                                                                        entry.id,
                                                                        0,
                                                                    );
                                                                }}
                                                            />
                                                            MC
                                                        </label>
                                                        <label
                                                            className="ml-2 inline-flex items-center gap-1 text-xs text-violet-800"
                                                            onPointerDown={(
                                                                event,
                                                            ) =>
                                                                event.stopPropagation()
                                                            }
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    entry.isMedley
                                                                }
                                                                disabled={
                                                                    entry.isMc
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateEntry(
                                                                        entry.id,
                                                                        {
                                                                            isMedley:
                                                                                event
                                                                                    .target
                                                                                    .checked,
                                                                            section:
                                                                                event
                                                                                    .target
                                                                                    .checked
                                                                                    ? appendSectionTag(
                                                                                          entry.section,
                                                                                          "メドレー",
                                                                                      )
                                                                                    : entry.section,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            メドレー
                                                        </label>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeEntry(
                                                                entry.id,
                                                            )
                                                        }
                                                        onPointerDown={(
                                                            event,
                                                        ) =>
                                                            event.stopPropagation()
                                                        }
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-violet-500 hover:bg-violet-100/70 hover:text-violet-700"
                                                        title="この行を削除"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>

                                                <div className="mt-2 flex gap-1 md:hidden">
                                                    {(entry.isMc
                                                        ? ([
                                                              "表示名",
                                                              "補足",
                                                          ] as const)
                                                        : ([
                                                              "楽曲",
                                                              "歌唱者",
                                                              "補足",
                                                          ] as const)
                                                    ).map(
                                                        (
                                                            label,
                                                            indexInTabs,
                                                        ) => {
                                                            const stepIndex =
                                                                entry.isMc &&
                                                                indexInTabs ===
                                                                    1
                                                                    ? 2
                                                                    : indexInTabs;
                                                            const active =
                                                                (entryStepById[
                                                                    entry.id
                                                                ] ?? 0) ===
                                                                stepIndex;
                                                            return (
                                                                <button
                                                                    key={`${entry.id}-step-tab-${label}`}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEntryStep(
                                                                            entry.id,
                                                                            stepIndex,
                                                                        )
                                                                    }
                                                                    aria-pressed={
                                                                        active
                                                                    }
                                                                    className={`h-7 rounded-full border px-2 text-[11px] font-semibold transition-colors ${
                                                                        active
                                                                            ? "border-violet-700 bg-violet-700 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.4)_inset]"
                                                                            : "border-violet-200 bg-white/70 text-violet-600"
                                                                    }`}
                                                                >
                                                                    {label}
                                                                </button>
                                                            );
                                                        },
                                                    )}
                                                </div>

                                                <div className="mt-3 space-y-3">
                                                    <label
                                                        id={`krn-entry-${entry.id}-step-0`}
                                                        className={`text-xs text-violet-800 ${
                                                            (entryStepById[
                                                                entry.id
                                                            ] ?? 0) === 0
                                                                ? "block"
                                                                : "hidden"
                                                        } md:block`}
                                                    >
                                                        <span className="mb-1 flex items-center justify-between">
                                                            <span>
                                                                {entry.isMc
                                                                    ? "表示名"
                                                                    : "楽曲名"}
                                                            </span>
                                                            {entry.isMc ? null : (
                                                                <span className="inline-flex gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            openSongCandidatePicker(
                                                                                entry,
                                                                            )
                                                                        }
                                                                        className={`h-8 rounded-xl border px-2 text-[11px] ${
                                                                            entry.isSongFreeInput
                                                                                ? "border-violet-200 text-violet-600"
                                                                                : "border-violet-400 bg-violet-100/80 text-violet-900"
                                                                        }`}
                                                                    >
                                                                        候補から選択
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            updateEntry(
                                                                                entry.id,
                                                                                {
                                                                                    isSongFreeInput: true,
                                                                                    songId: null,
                                                                                    songVersionId:
                                                                                        null,
                                                                                    songArtistId:
                                                                                        null,
                                                                                    songArtistName:
                                                                                        "",
                                                                                },
                                                                            )
                                                                        }
                                                                        className={`h-8 rounded-xl border px-2 text-[11px] ${
                                                                            entry.isSongFreeInput
                                                                                ? "border-violet-400 bg-violet-100/80 text-violet-900"
                                                                                : "border-violet-200 text-violet-600"
                                                                        }`}
                                                                    >
                                                                        自由入力
                                                                    </button>
                                                                </span>
                                                            )}
                                                        </span>
                                                        {entry.isMc ? (
                                                            <input autoComplete="off"
                                                                type="text"
                                                                value={
                                                                    entry.songName
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateEntry(
                                                                        entry.id,
                                                                        {
                                                                            songName:
                                                                                event
                                                                                    .target
                                                                                    .value ||
                                                                                "MC",
                                                                            songId: null,
                                                                            songVersionId:
                                                                                null,
                                                                            songArtistId:
                                                                                null,
                                                                            songArtistName:
                                                                                "",
                                                                        },
                                                                    )
                                                                }
                                                                placeholder="表示名を入力"
                                                                className="mt-1 h-8 w-full rounded-xl border border-violet-300 px-2 text-sm"
                                                            />
                                                        ) : entry.isSongFreeInput ? (
                                                            <input autoComplete="off"
                                                                type="text"
                                                                value={
                                                                    entry.songName
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateEntry(
                                                                        entry.id,
                                                                        {
                                                                            songName:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                            songId: null,
                                                                            songVersionId:
                                                                                null,
                                                                            songArtistId:
                                                                                null,
                                                                        },
                                                                    )
                                                                }
                                                                placeholder="表示名を自由入力"
                                                                className="mt-1 h-8 w-full rounded-xl border border-violet-300 px-2 text-sm"
                                                            />
                                                        ) : (
                                                            <div className="mt-1 space-y-1">
                                                                <div className="relative">
                                                                    <input autoComplete="off"
                                                                        type="text"
                                                                        ref={(
                                                                            node,
                                                                        ) => {
                                                                            songInputRefs.current[
                                                                                entry.id
                                                                            ] =
                                                                                node;
                                                                        }}
                                                                        value={
                                                                            songQueryByEntry[
                                                                                entry
                                                                                    .id
                                                                            ] ??
                                                                            entry.songName
                                                                        }
                                                                        onFocus={() => {
                                                                            setSongDropdownOpenByEntry(
                                                                                (
                                                                                    current,
                                                                                ) => ({
                                                                                    ...current,
                                                                                    [entry.id]: true,
                                                                                }),
                                                                            );
                                                                            const currentValue =
                                                                                (
                                                                                    songQueryByEntry[
                                                                                        entry
                                                                                            .id
                                                                                    ] ??
                                                                                    entry.songName
                                                                                ).trim();
                                                                            if (
                                                                                currentValue.length >=
                                                                                1
                                                                            ) {
                                                                                queueSuggestSongs(
                                                                                    entry.id,
                                                                                    currentValue,
                                                                                );
                                                                            }
                                                                        }}
                                                                        onBlur={() => {
                                                                            window.setTimeout(
                                                                                () => {
                                                                                    setSongDropdownOpenByEntry(
                                                                                        (
                                                                                            current,
                                                                                        ) => ({
                                                                                            ...current,
                                                                                            [entry.id]: false,
                                                                                        }),
                                                                                    );
                                                                                },
                                                                                120,
                                                                            );
                                                                        }}
                                                                        onChange={(
                                                                            event,
                                                                        ) => {
                                                                            const value =
                                                                                event
                                                                                    .target
                                                                                    .value;
                                                                            setSongDropdownOpenByEntry(
                                                                                (
                                                                                    current,
                                                                                ) => ({
                                                                                    ...current,
                                                                                    [entry.id]: true,
                                                                                }),
                                                                            );
                                                                            setSongQueryByEntry(
                                                                                (
                                                                                    current,
                                                                                ) => ({
                                                                                    ...current,
                                                                                    [entry.id]:
                                                                                        value,
                                                                                }),
                                                                            );
                                                                            setSongSearchedByEntry(
                                                                                (
                                                                                    current,
                                                                                ) => ({
                                                                                    ...current,
                                                                                    [entry.id]: false,
                                                                                }),
                                                                            );
                                                                            const exact =
                                                                                (
                                                                                    songChoicesByEntry[
                                                                                        entry
                                                                                            .id
                                                                                    ] ??
                                                                                    []
                                                                                ).find(
                                                                                    (
                                                                                        choice,
                                                                                    ) => {
                                                                                        return (
                                                                                            choice.songName ===
                                                                                            value
                                                                                        );
                                                                                    },
                                                                                );
                                                                            if (
                                                                                exact
                                                                            ) {
                                                                                selectSongChoice(
                                                                                    entry.id,
                                                                                    exact.songId,
                                                                                );
                                                                                return;
                                                                            }
                                                                            updateEntry(
                                                                                entry.id,
                                                                                {
                                                                                    songName:
                                                                                        value
                                                                                            .split(
                                                                                                " / ",
                                                                                            )[0]
                                                                                            ?.trim() ??
                                                                                        value,
                                                                                    songId: null,
                                                                                    songVersionId:
                                                                                        null,
                                                                                    songArtistId:
                                                                                        null,
                                                                                    songArtistName:
                                                                                        "",
                                                                                },
                                                                            );
                                                                            if (
                                                                                value.trim()
                                                                                    .length >=
                                                                                1
                                                                            ) {
                                                                                queueSuggestSongs(
                                                                                    entry.id,
                                                                                    value,
                                                                                );
                                                                            }
                                                                        }}
                                                                        placeholder="楽曲名を入力して候補を絞り込み"
                                                                        className="h-8 w-full rounded-xl border border-violet-300 px-2 text-sm"
                                                                    />
                                                                    {songDropdownOpenByEntry[
                                                                        entry.id
                                                                    ] &&
                                                                    (
                                                                        songChoicesByEntry[
                                                                            entry
                                                                                .id
                                                                        ] ?? []
                                                                    ).length >
                                                                        0 ? (
                                                                        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-auto rounded-xl border border-violet-200 bg-white shadow-sm">
                                                                            {(
                                                                                songChoicesByEntry[
                                                                                    entry
                                                                                        .id
                                                                                ] ??
                                                                                []
                                                                            ).map(
                                                                                (
                                                                                    choice,
                                                                                ) => (
                                                                                    <button
                                                                                        key={`${entry.id}-${choice.songId}`}
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            selectSongChoice(
                                                                                                entry.id,
                                                                                                choice.songId,
                                                                                            )
                                                                                        }
                                                                                        onMouseDown={(
                                                                                            event,
                                                                                        ) =>
                                                                                            event.preventDefault()
                                                                                        }
                                                                                        className="block w-full border-b border-violet-100 px-2 py-1.5 text-left text-xs text-violet-900 last:border-b-0 hover:bg-violet-50"
                                                                                    >
                                                                                        <div>
                                                                                            {
                                                                                                choice.songName
                                                                                            }
                                                                                        </div>
                                                                                        <div className="text-[10px] text-violet-600">
                                                                                            {
                                                                                                choice.artistName
                                                                                            }
                                                                                        </div>
                                                                                    </button>
                                                                                ),
                                                                            )}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                {entry.songArtistName.trim() ? (
                                                                    <p className="text-[11px] text-violet-600">
                                                                        アーティスト:{" "}
                                                                        {entry.songArtistName.trim()}
                                                                    </p>
                                                                ) : null}
                                                                {songLoadingByEntry[
                                                                    entry.id
                                                                ] ? (
                                                                    <p className="text-[11px] text-violet-600">
                                                                        候補を更新中...
                                                                    </p>
                                                                ) : songSearchedByEntry[
                                                                      entry.id
                                                                  ] &&
                                                                  (
                                                                      songQueryByEntry[
                                                                          entry
                                                                              .id
                                                                      ] ?? ""
                                                                  ).trim()
                                                                      .length >
                                                                      0 &&
                                                                  (
                                                                      songChoicesByEntry[
                                                                          entry
                                                                              .id
                                                                      ] ?? []
                                                                  ).length ===
                                                                      0 ? (
                                                                    <p className="text-[11px] text-violet-600">
                                                                        候補がありません
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        )}
                                                        <div className="mt-2 flex justify-end gap-2 md:hidden">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setEntryStep(
                                                                        entry.id,
                                                                        entry.isMc
                                                                            ? 2
                                                                            : 1,
                                                                    )
                                                                }
                                                                className="h-8 rounded-xl border border-violet-300 bg-violet-50 px-2 text-[11px] font-semibold text-violet-800"
                                                            >
                                                                次へ
                                                            </button>
                                                        </div>
                                                    </label>
                                                    {!entry.isMc ? (
                                                        <label
                                                            id={`krn-entry-${entry.id}-step-1`}
                                                            className={`text-xs text-violet-800 ${
                                                                (entryStepById[
                                                                    entry.id
                                                                ] ?? 0) === 1
                                                                    ? "block"
                                                                    : "hidden"
                                                            } md:block`}
                                                        >
                                                            <span className="mb-1 flex items-center justify-between">
                                                                <span>
                                                                    歌唱者
                                                                </span>
                                                                <span className="inline-flex gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            openPerformerCandidatePicker(
                                                                                entry,
                                                                            )
                                                                        }
                                                                        className={`h-8 rounded-xl border px-2 text-[11px] ${
                                                                            entry.isPerformerTextInput
                                                                                ? "border-violet-200 text-violet-600"
                                                                                : "border-violet-400 bg-violet-100/80 text-violet-900"
                                                                        }`}
                                                                    >
                                                                        候補から選択
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            updateEntry(
                                                                                entry.id,
                                                                                {
                                                                                    isPerformerTextInput: true,
                                                                                },
                                                                            )
                                                                        }
                                                                        className={`h-8 rounded-xl border px-2 text-[11px] ${
                                                                            entry.isPerformerTextInput
                                                                                ? "border-violet-400 bg-violet-100/80 text-violet-900"
                                                                                : "border-violet-200 text-violet-600"
                                                                        }`}
                                                                    >
                                                                        自由入力
                                                                    </button>
                                                                </span>
                                                            </span>
                                                            <div className="mt-1 flex gap-2">
                                                                <div className="relative flex-1">
                                                                    <input autoComplete="off"
                                                                        type="text"
                                                                        ref={(
                                                                            node,
                                                                        ) => {
                                                                            performerInputRefs.current[
                                                                                entry.id
                                                                            ] =
                                                                                node;
                                                                        }}
                                                                        value={
                                                                            performerQueryByEntry[
                                                                                entry
                                                                                    .id
                                                                            ] ??
                                                                            ""
                                                                        }
                                                                        onFocus={() => {
                                                                            if (
                                                                                entry.isPerformerTextInput
                                                                            )
                                                                                return;
                                                                            setPerformerDropdownOpenByEntry(
                                                                                (
                                                                                    current,
                                                                                ) => ({
                                                                                    ...current,
                                                                                    [entry.id]: true,
                                                                                }),
                                                                            );
                                                                            const currentValue =
                                                                                (
                                                                                    performerQueryByEntry[
                                                                                        entry
                                                                                            .id
                                                                                    ] ??
                                                                                    ""
                                                                                ).trim();
                                                                            if (
                                                                                currentValue.length >=
                                                                                1
                                                                            ) {
                                                                                queueSuggestPerformers(
                                                                                    entry.id,
                                                                                    currentValue,
                                                                                );
                                                                            }
                                                                        }}
                                                                        onBlur={() => {
                                                                            window.setTimeout(
                                                                                () => {
                                                                                    setPerformerDropdownOpenByEntry(
                                                                                        (
                                                                                            current,
                                                                                        ) => ({
                                                                                            ...current,
                                                                                            [entry.id]: false,
                                                                                        }),
                                                                                    );
                                                                                },
                                                                                120,
                                                                            );
                                                                        }}
                                                                        onChange={(
                                                                            event,
                                                                        ) => {
                                                                            const value =
                                                                                event
                                                                                    .target
                                                                                    .value;
                                                                            setPerformerQueryByEntry(
                                                                                (
                                                                                    current,
                                                                                ) => ({
                                                                                    ...current,
                                                                                    [entry.id]:
                                                                                        value,
                                                                                }),
                                                                            );
                                                                            if (
                                                                                entry.isPerformerTextInput
                                                                            )
                                                                                return;
                                                                            setPerformerDropdownOpenByEntry(
                                                                                (
                                                                                    current,
                                                                                ) => ({
                                                                                    ...current,
                                                                                    [entry.id]: true,
                                                                                }),
                                                                            );
                                                                            const exact =
                                                                                (
                                                                                    performerChoicesByEntry[
                                                                                        entry
                                                                                            .id
                                                                                    ] ??
                                                                                    []
                                                                                ).find(
                                                                                    (
                                                                                        choice,
                                                                                    ) =>
                                                                                        choice.value ===
                                                                                            value ||
                                                                                        choice.label ===
                                                                                            value,
                                                                                );
                                                                            if (
                                                                                exact
                                                                            ) {
                                                                                addPerformersToEntry(
                                                                                    entry.id,
                                                                                    [
                                                                                        {
                                                                                            name: exact.value,
                                                                                            personId:
                                                                                                exact.personId,
                                                                                            groupId:
                                                                                                exact.groupId,
                                                                                        },
                                                                                    ],
                                                                                );
                                                                                setPerformerQueryByEntry(
                                                                                    (
                                                                                        current,
                                                                                    ) => ({
                                                                                        ...current,
                                                                                        [entry.id]:
                                                                                            "",
                                                                                    }),
                                                                                );
                                                                                setPerformerChoicesByEntry(
                                                                                    (
                                                                                        current,
                                                                                    ) => ({
                                                                                        ...current,
                                                                                        [entry.id]:
                                                                                            [],
                                                                                    }),
                                                                                );
                                                                                setPerformerDropdownOpenByEntry(
                                                                                    (
                                                                                        current,
                                                                                    ) => ({
                                                                                        ...current,
                                                                                        [entry.id]: false,
                                                                                    }),
                                                                                );
                                                                                blurInput(
                                                                                    performerInputRefs,
                                                                                    entry.id,
                                                                                );
                                                                                return;
                                                                            }
                                                                            if (
                                                                                value.trim()
                                                                                    .length >=
                                                                                1
                                                                            ) {
                                                                                queueSuggestPerformers(
                                                                                    entry.id,
                                                                                    value,
                                                                                );
                                                                            }
                                                                        }}
                                                                        onKeyDown={(
                                                                            event,
                                                                        ) => {
                                                                            if (
                                                                                event.key !==
                                                                                "Enter"
                                                                            )
                                                                                return;
                                                                            event.preventDefault();
                                                                            addPerformerFromQuery(
                                                                                entry,
                                                                            );
                                                                        }}
                                                                        placeholder={
                                                                            entry.isPerformerTextInput
                                                                                ? "歌唱者名を入力して追加"
                                                                                : "歌唱者名を入力して候補から追加"
                                                                        }
                                                                        className="h-8 w-full rounded-xl border border-violet-300 px-2 text-sm"
                                                                    />
                                                                    {!entry.isPerformerTextInput &&
                                                                    performerDropdownOpenByEntry[
                                                                        entry.id
                                                                    ] &&
                                                                    (
                                                                        performerChoicesByEntry[
                                                                            entry
                                                                                .id
                                                                        ] ?? []
                                                                    ).length >
                                                                        0 ? (
                                                                        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-auto rounded-xl border border-violet-200 bg-white shadow-sm">
                                                                            {(
                                                                                performerChoicesByEntry[
                                                                                    entry
                                                                                        .id
                                                                                ] ??
                                                                                []
                                                                            ).map(
                                                                                (
                                                                                    choice,
                                                                                    choiceIndex,
                                                                                ) => (
                                                                                    <button
                                                                                        key={`${entry.id}-${choiceIndex}-${choice.value}`}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            addPerformersToEntry(
                                                                                                entry.id,
                                                                                                [
                                                                                                    {
                                                                                                        name: choice.value,
                                                                                                        personId:
                                                                                                            choice.personId,
                                                                                                        groupId:
                                                                                                            choice.groupId,
                                                                                                    },
                                                                                                ],
                                                                                            );
                                                                                            setPerformerQueryByEntry(
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    [entry.id]:
                                                                                                        "",
                                                                                                }),
                                                                                            );
                                                                                            setPerformerChoicesByEntry(
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    [entry.id]:
                                                                                                        [],
                                                                                                }),
                                                                                            );
                                                                                            setPerformerDropdownOpenByEntry(
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    [entry.id]: false,
                                                                                                }),
                                                                                            );
                                                                                            blurInput(
                                                                                                performerInputRefs,
                                                                                                entry.id,
                                                                                            );
                                                                                        }}
                                                                                        onMouseDown={(
                                                                                            event,
                                                                                        ) =>
                                                                                            event.preventDefault()
                                                                                        }
                                                                                        className="block w-full border-b border-violet-100 px-2 py-1.5 text-left text-xs text-violet-900 last:border-b-0 hover:bg-violet-50"
                                                                                    >
                                                                                        <div>
                                                                                            {
                                                                                                choice.value
                                                                                            }
                                                                                        </div>
                                                                                        <div className="text-[10px] text-violet-600">
                                                                                            {
                                                                                                choice.label
                                                                                            }
                                                                                        </div>
                                                                                    </button>
                                                                                ),
                                                                            )}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        addPerformerFromQuery(
                                                                            entry,
                                                                        );
                                                                    }}
                                                                    aria-label="歌唱者を追加"
                                                                    title="歌唱者を追加"
                                                                    className="inline-flex h-8 items-center justify-center rounded-xl border border-violet-200 px-3 text-xs font-semibold text-violet-800"
                                                                >
                                                                    追加
                                                                </button>
                                                            </div>
                                                            {!entry.isMc &&
                                                            entry.performerNames
                                                                .length > 0 ? (
                                                                <div className="mt-2 flex flex-wrap gap-1">
                                                                    {entry.performerNames.map(
                                                                        (
                                                                            name,
                                                                        ) => (
                                                                            <button
                                                                                key={`${entry.id}-${name}`}
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    removePerformerFromEntry(
                                                                                        entry.id,
                                                                                        name,
                                                                                    )
                                                                                }
                                                                                className="rounded-full border border-violet-200 bg-violet-100/60 px-2 py-0.5 text-[11px] text-violet-800"
                                                                                title="タップで削除"
                                                                            >
                                                                                {
                                                                                    name
                                                                                }{" "}
                                                                                ×
                                                                            </button>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                            {!entry.isMc &&
                                                            !entry.isPerformerTextInput &&
                                                            performerLoadingByEntry[
                                                                entry.id
                                                            ] ? (
                                                                <p className="mt-1 text-[11px] text-violet-600">
                                                                    候補を更新中...
                                                                </p>
                                                            ) : null}
                                                            <div className="mt-2 flex justify-between gap-2 md:hidden">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEntryStep(
                                                                            entry.id,
                                                                            0,
                                                                        )
                                                                    }
                                                                    className="h-8 rounded-xl border border-violet-200 px-2 text-[11px] text-violet-700"
                                                                >
                                                                    戻る
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEntryStep(
                                                                            entry.id,
                                                                            2,
                                                                        )
                                                                    }
                                                                    className="h-8 rounded-xl border border-violet-300 bg-violet-50 px-2 text-[11px] font-semibold text-violet-800"
                                                                >
                                                                    次へ
                                                                </button>
                                                            </div>
                                                        </label>
                                                    ) : null}

                                                    <div
                                                        id={`krn-entry-${entry.id}-step-2`}
                                                        className={`space-y-3 ${
                                                            (entryStepById[
                                                                entry.id
                                                            ] ?? 0) === 2
                                                                ? "block"
                                                                : "hidden"
                                                        } md:block`}
                                                    >
                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            <label className="text-xs text-violet-800">
                                                                備考
                                                                <div className="relative mt-1">
                                                                    <input autoComplete="off"
                                                                        type="text"
                                                                        value={
                                                                            entry.note
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            updateEntry(
                                                                                entry.id,
                                                                                {
                                                                                    note: event
                                                                                        .target
                                                                                        .value,
                                                                                },
                                                                            )
                                                                        }
                                                                        placeholder={
                                                                            entry.isMc
                                                                                ? "メンバー、内容等"
                                                                                : "生演奏/演出/ゲストなど"
                                                                        }
                                                                        className="h-8 w-full rounded-xl border border-violet-300 px-2 pr-8 text-sm"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            updateEntry(
                                                                                entry.id,
                                                                                {
                                                                                    note: "",
                                                                                },
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            entry.note.trim()
                                                                                .length ===
                                                                            0
                                                                        }
                                                                        aria-label="備考をクリア"
                                                                        title="備考をクリア"
                                                                        className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-xl border border-transparent text-violet-600 disabled:pointer-events-none disabled:opacity-30"
                                                                    >
                                                                        <XIcon className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {QUICK_NOTE_TAGS.map(
                                                                        (
                                                                            tag,
                                                                        ) => (
                                                                            <button
                                                                                key={`${entry.id}-quick-note-${tag}`}
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    updateEntry(
                                                                                        entry.id,
                                                                                        {
                                                                                            note: appendNoteTag(
                                                                                                entry.note,
                                                                                                tag,
                                                                                            ),
                                                                                        },
                                                                                    )
                                                                                }
                                                                                className="rounded-full border border-violet-200 bg-violet-50/80 px-2 py-0.5 text-[11px] text-violet-800"
                                                                            >
                                                                                +{" "}
                                                                                {
                                                                                    tag
                                                                                }
                                                                            </button>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            </label>
                                                            <label className="text-xs text-violet-800">
                                                                セクション
                                                                <div className="relative mt-1">
                                                                    <input autoComplete="off"
                                                                        type="text"
                                                                        value={
                                                                            entry.section
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            updateEntry(
                                                                                entry.id,
                                                                                {
                                                                                    section:
                                                                                        event
                                                                                            .target
                                                                                            .value,
                                                                                },
                                                                            )
                                                                        }
                                                                        placeholder="本編/ENCORE"
                                                                        className="h-8 w-full rounded-xl border border-violet-300 px-2 pr-8 text-xs"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            updateEntry(
                                                                                entry.id,
                                                                                {
                                                                                    section:
                                                                                        "",
                                                                                },
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            entry.section.trim()
                                                                                .length ===
                                                                            0
                                                                        }
                                                                        aria-label="セクションをクリア"
                                                                        title="セクションをクリア"
                                                                        className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-xl border border-transparent text-violet-600 disabled:pointer-events-none disabled:opacity-30"
                                                                    >
                                                                        <XIcon className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {QUICK_SECTION_TAGS.map(
                                                                        (
                                                                            tag,
                                                                        ) => (
                                                                            <button
                                                                                key={`${entry.id}-quick-section-${tag}`}
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    updateEntry(
                                                                                        entry.id,
                                                                                        {
                                                                                            section:
                                                                                                appendSectionTag(
                                                                                                    entry.section,
                                                                                                    tag,
                                                                                                ),
                                                                                        },
                                                                                    )
                                                                                }
                                                                                className="rounded-full border border-violet-200 bg-violet-50/80 px-2 py-0.5 text-[11px] text-violet-800"
                                                                            >
                                                                                +{" "}
                                                                                {
                                                                                    tag
                                                                                }
                                                                            </button>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            </label>
                                                        </div>
                                                        <div className="mt-1 flex justify-start md:hidden">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setEntryStep(
                                                                        entry.id,
                                                                        entry.isMc
                                                                            ? 0
                                                                            : 1,
                                                                    )
                                                                }
                                                                className="h-8 rounded-xl border border-violet-200 px-2 text-[11px] text-violet-700"
                                                            >
                                                                戻る
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </article>
                                        )}
                                    </SortableEntryContainer>
                                ))}
                            </SortableContext>
                        </DndContext>
                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={addEmptyEntry}
                                className="inline-flex h-8 items-center gap-1 rounded-xl border border-violet-300 bg-violet-50/70 px-3 text-xs font-semibold text-violet-800"
                            >
                                <PlusIcon className="h-4 w-4" />
                                行を追加
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3 md:p-4">
                <h2 className="text-sm font-semibold text-violet-900">
                    4. 出力情報オプション
                </h2>
                <div className="mt-2 grid gap-1.5 text-xs text-violet-800 md:grid-cols-2">
                    <label className="flex items-center justify-between rounded-xl border border-violet-200 bg-white/80 px-2.5 py-1.5 md:col-span-2">
                        <span className="leading-tight tracking-tight">
                            イベント情報を含める
                        </span>
                        <span className="relative inline-flex h-6 w-11 items-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={outputOptions.includeEvent}
                                onChange={(event) =>
                                    setOutputOptions((current) => ({
                                        ...current,
                                        includeEvent: event.target.checked,
                                    }))
                                }
                            />
                            <span className="absolute inset-0 rounded-full bg-violet-200 transition peer-checked:bg-violet-600" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                        </span>
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-violet-200 bg-white/80 px-2.5 py-1.5 md:col-span-2">
                        <span className="leading-tight tracking-tight">
                            アーティスト名を含める
                        </span>
                        <span className="relative inline-flex h-6 w-11 items-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={
                                    outputOptions.artistDisplayMode !== "hidden"
                                }
                                onChange={(event) =>
                                    setOutputOptions((current) => ({
                                        ...current,
                                        artistDisplayMode: event.target.checked
                                            ? "inline"
                                            : "hidden",
                                    }))
                                }
                            />
                            <span className="absolute inset-0 rounded-full bg-violet-200 transition peer-checked:bg-violet-600" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                        </span>
                    </label>
                    <div
                        className={`rounded-xl border px-2.5 py-1.5 md:col-span-2 ${
                            outputOptions.artistDisplayMode !== "hidden"
                                ? "border-violet-200 bg-white/80"
                                : "border-violet-100 bg-violet-50/70 text-violet-400"
                        }`}
                    >
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="shrink-0 leading-tight tracking-tight">
                                アーティスト表示
                            </span>
                            <div className="ml-auto flex min-w-0 items-center justify-end gap-2 whitespace-nowrap">
                                <select
                                    value={outputOptions.artistDisplayMode}
                                    disabled={
                                        outputOptions.artistDisplayMode ===
                                        "hidden"
                                    }
                                    onChange={(event) =>
                                        setOutputOptions((current) => ({
                                            ...current,
                                            artistDisplayMode: event.target
                                                .value as OutputOptions["artistDisplayMode"],
                                        }))
                                    }
                                    className="h-7 rounded-xl border border-violet-300 bg-violet-50/70 px-2 text-right text-[11px] text-violet-800"
                                >
                                    <option value="inline">行内</option>
                                    <option value="newline">改行</option>
                                </select>
                                {outputOptions.artistDisplayMode !== "hidden" &&
                                outputOptions.artistDisplayMode === "inline" ? (
                                    <select
                                        value={outputOptions.artistInlineStyle}
                                        onChange={(event) =>
                                            setOutputOptions((current) => ({
                                                ...current,
                                                artistInlineStyle: event.target
                                                    .value as InlineAffixStyle,
                                            }))
                                        }
                                        className="h-7 rounded-xl border border-violet-300 bg-violet-50/70 px-2 text-right text-[11px] text-violet-800"
                                    >
                                        <option value="slash">/</option>
                                        <option value="dot">・</option>
                                        <option value="square">【 】</option>
                                        <option value="round">（ ）</option>
                                    </select>
                                ) : null}
                                {outputOptions.artistDisplayMode !== "hidden" &&
                                outputOptions.artistDisplayMode ===
                                    "newline" ? (
                                    <input autoComplete="off"
                                        type="text"
                                        value={outputOptions.artistPrefixCustom}
                                        onChange={(event) =>
                                            setOutputOptions((current) => ({
                                                ...current,
                                                artistPrefixCustom:
                                                    event.target.value,
                                            }))
                                        }
                                        placeholder="アーティスト: "
                                        className="h-7 min-w-[120px] rounded-xl border border-violet-300 bg-white px-2 text-[11px] text-violet-800"
                                    />
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <label className="flex items-center justify-between rounded-xl border border-violet-200 bg-white/80 px-2.5 py-1.5 md:col-span-2">
                        <span className="leading-tight tracking-tight">
                            歌唱者を含める
                        </span>
                        <span className="relative inline-flex h-6 w-11 items-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={
                                    outputOptions.performerDisplayMode !==
                                    "hidden"
                                }
                                onChange={(event) =>
                                    setOutputOptions((current) => ({
                                        ...current,
                                        performerDisplayMode: event.target
                                            .checked
                                            ? "newline"
                                            : "hidden",
                                    }))
                                }
                            />
                            <span className="absolute inset-0 rounded-full bg-violet-200 transition peer-checked:bg-violet-600" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                        </span>
                    </label>
                    <div
                        className={`rounded-xl border px-2.5 py-1.5 md:col-span-2 ${
                            outputOptions.performerDisplayMode !== "hidden"
                                ? "border-violet-200 bg-white/80"
                                : "border-violet-100 bg-violet-50/70 text-violet-400"
                        }`}
                    >
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="shrink-0 leading-tight tracking-tight">
                                歌唱者表示
                            </span>
                            <div className="ml-auto flex min-w-0 items-center justify-end gap-2 whitespace-nowrap">
                                <select
                                    value={outputOptions.performerDisplayMode}
                                    disabled={
                                        outputOptions.performerDisplayMode ===
                                        "hidden"
                                    }
                                    onChange={(event) =>
                                        setOutputOptions((current) => ({
                                            ...current,
                                            performerDisplayMode: event.target
                                                .value as OutputOptions["performerDisplayMode"],
                                        }))
                                    }
                                    className="h-7 rounded-xl border border-violet-300 bg-violet-50/70 px-2 text-right text-[11px] text-violet-800"
                                >
                                    <option value="inline">行内</option>
                                    <option value="newline">改行</option>
                                </select>
                                {outputOptions.performerDisplayMode !==
                                    "hidden" &&
                                outputOptions.performerDisplayMode ===
                                    "inline" ? (
                                    <select
                                        value={
                                            outputOptions.performerInlineStyle
                                        }
                                        onChange={(event) =>
                                            setOutputOptions((current) => ({
                                                ...current,
                                                performerInlineStyle: event
                                                    .target
                                                    .value as InlineAffixStyle,
                                            }))
                                        }
                                        className="h-7 rounded-xl border border-violet-300 bg-violet-50/70 px-2 text-right text-[11px] text-violet-800"
                                    >
                                        <option value="slash">/</option>
                                        <option value="dot">・</option>
                                        <option value="square">【 】</option>
                                        <option value="round">（ ）</option>
                                    </select>
                                ) : null}
                                {outputOptions.performerDisplayMode !==
                                    "hidden" &&
                                outputOptions.performerDisplayMode ===
                                    "newline" ? (
                                    <input autoComplete="off"
                                        type="text"
                                        value={
                                            outputOptions.performerPrefixCustom
                                        }
                                        onChange={(event) =>
                                            setOutputOptions((current) => ({
                                                ...current,
                                                performerPrefixCustom:
                                                    event.target.value,
                                            }))
                                        }
                                        placeholder="歌唱: "
                                        className="h-7 min-w-[120px] rounded-xl border border-violet-300 bg-white px-2 text-[11px] text-violet-800"
                                    />
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <label className="flex items-center justify-between rounded-xl border border-violet-200 bg-white/80 px-2.5 py-1.5">
                        <span className="leading-tight tracking-tight">
                            セクションをヘッダ行で表示
                        </span>
                        <span className="relative inline-flex h-6 w-11 items-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={outputOptions.sectionAsHeader}
                                onChange={(event) =>
                                    setOutputOptions((current) => ({
                                        ...current,
                                        sectionAsHeader: event.target.checked,
                                    }))
                                }
                            />
                            <span className="absolute inset-0 rounded-full bg-violet-200 transition peer-checked:bg-violet-600" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                        </span>
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-violet-200 bg-white/80 px-2.5 py-1.5">
                        <span className="leading-tight tracking-tight">
                            備考を含める
                        </span>
                        <span className="relative inline-flex h-6 w-11 items-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={outputOptions.includeNote}
                                onChange={(event) =>
                                    setOutputOptions((current) => ({
                                        ...current,
                                        includeNote: event.target.checked,
                                    }))
                                }
                            />
                            <span className="absolute inset-0 rounded-full bg-violet-200 transition peer-checked:bg-violet-600" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                        </span>
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-violet-200 bg-white/80 px-2.5 py-1.5">
                        <span className="leading-tight tracking-tight">
                            MCを含める
                        </span>
                        <span className="relative inline-flex h-6 w-11 items-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={outputOptions.includeMc}
                                onChange={(event) =>
                                    setOutputOptions((current) => ({
                                        ...current,
                                        includeMc: event.target.checked,
                                        countMcInMusicOrder: event.target
                                            .checked
                                            ? current.countMcInMusicOrder
                                            : false,
                                    }))
                                }
                            />
                            <span className="absolute inset-0 rounded-full bg-violet-200 transition peer-checked:bg-violet-600" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                        </span>
                    </label>
                    <label
                        className={`flex items-center justify-between rounded-xl border px-2.5 py-1.5 ${
                            outputOptions.includeMc
                                ? "border-violet-200 bg-white/80"
                                : "border-violet-100 bg-violet-50/70 text-violet-400"
                        }`}
                    >
                        <span className="leading-tight tracking-tight">
                            MCを曲順にカウントする
                        </span>
                        <span className="relative inline-flex h-6 w-11 items-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={outputOptions.countMcInMusicOrder}
                                disabled={!outputOptions.includeMc}
                                onChange={(event) =>
                                    setOutputOptions((current) => ({
                                        ...current,
                                        countMcInMusicOrder:
                                            event.target.checked,
                                    }))
                                }
                            />
                            <span className="absolute inset-0 rounded-full bg-violet-200 transition peer-checked:bg-violet-600 peer-disabled:bg-violet-100" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-disabled:bg-violet-50" />
                        </span>
                    </label>
                </div>

                <h2 className="mt-6 text-sm font-semibold text-violet-900">
                    5. データ送信
                </h2>
                <div className="mt-2 text-xs text-violet-800">
                    <label className="flex items-center justify-between rounded-xl border border-violet-200 bg-white/80 px-2.5 py-1.5">
                        <span className="leading-tight tracking-tight">
                            ToMoKoにも教える
                        </span>
                        <span className="relative inline-flex h-6 w-11 items-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={notifyTomoko}
                                onChange={(event) =>
                                    setNotifyTomoko(event.target.checked)
                                }
                            />
                            <span className="absolute inset-0 rounded-full bg-violet-200 transition peer-checked:bg-violet-600" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                        </span>
                    </label>
                    <p className="mt-1.5 text-[11px] leading-tight text-violet-600">
                        出力時にToMoKoにデータを提供します。※データは管理者のレビュー後にDBへ保存されます。
                    </p>
                </div>
            </div>

            {isParseModalOpen ? (
                <div
                    className="fixed inset-0 z-20 bg-slate-900/40 p-4"
                    onClick={() => setIsParseModalOpen(false)}
                >
                    <div
                        className="mx-auto max-w-3xl rounded-xl border border-violet-200 bg-violet-50/70 p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,0.72)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3 className="text-sm font-semibold text-violet-900">
                            雑メモ変換
                        </h3>
                        <p className="mt-2 text-xs text-violet-600">
                            シンプルなメモをセットリストに変換します。
                        </p>
                        <div className="relative mt-3">
                            <textarea
                                value={rawInput}
                                onChange={(event) =>
                                    setRawInput(event.target.value)
                                }
                                placeholder={`曲名\nMC\n曲名 / 歌唱者名\nEN\n曲名`}
                                className="h-56 w-full rounded-xl border border-violet-300 p-3 pb-10 text-sm leading-6"
                            />
                            <button
                                type="button"
                                onClick={() => setRawInput("")}
                                disabled={rawInput.trim().length === 0}
                                aria-label="雑メモをクリア"
                                title="雑メモをクリア"
                                className="absolute bottom-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-xl border border-transparent text-violet-600 disabled:pointer-events-none disabled:opacity-30"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-violet-800 md:grid-cols-2">
                            <label className="flex items-center justify-between rounded-xl border border-violet-200 bg-white/80 px-3 py-2">
                                <span className="leading-tight tracking-tight">
                                    歌唱者情報も解析する
                                </span>
                                <span className="relative inline-flex h-6 w-11 items-center">
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={parseIncludePerformer}
                                        onChange={(event) =>
                                            setParseIncludePerformer(
                                                event.target.checked,
                                            )
                                        }
                                    />
                                    <span className="absolute inset-0 rounded-full bg-violet-200 transition peer-checked:bg-violet-600" />
                                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                                </span>
                            </label>
                            <label
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${
                                    parseIncludePerformer
                                        ? "border-violet-200 bg-white/80"
                                        : "border-violet-100 bg-violet-50/70 text-violet-400"
                                }`}
                            >
                                歌唱者区切り文字
                                <select
                                    value={parsePerformerDelimiter}
                                    disabled={!parseIncludePerformer}
                                    onChange={(event) =>
                                        setParsePerformerDelimiter(
                                            event.target
                                                .value as ParsePerformerDelimiter,
                                        )
                                    }
                                    className="h-7 rounded-xl border border-violet-300 bg-violet-50/70 px-2 text-[11px] text-violet-800 disabled:opacity-50"
                                >
                                    <option value="auto">自動判定</option>
                                    <option value="・">・</option>
                                    <option value="、">、</option>
                                    <option value=",">,</option>
                                    <option value="/">/</option>
                                    <option value="／">／</option>
                                    <option value="space">空白</option>
                                </select>
                            </label>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsParseModalOpen(false)}
                                className="h-8 rounded-xl border border-violet-300 bg-violet-50/70 px-3 text-xs font-semibold text-violet-800"
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void parseRawInput().then(() => {
                                        setIsParseModalOpen(false);
                                    });
                                }}
                                disabled={isImportingMemo}
                                className="h-8 rounded-xl border border-violet-300 bg-violet-50/70 px-3 text-xs font-semibold text-violet-800 disabled:opacity-60"
                            >
                                {isImportingMemo ? "変換中..." : "変換"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
                <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-violet-300 bg-violet-100 px-4 text-sm font-semibold text-violet-900 shadow-sm"
                >
                    <KrnPreviewIcon className="h-4 w-4" />
                    プレビュー
                </button>
                <button
                    type="button"
                    onClick={() => setIsClearDraftModalOpen(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-violet-300 bg-violet-100 text-violet-900 shadow-sm"
                    title="下書きクリア"
                    aria-label="下書きクリア"
                >
                    <ResetIcon className="h-5 w-5" />
                </button>
            </div>

            {isClearDraftModalOpen ? (
                <div className="fixed inset-0 z-30 bg-slate-900/40 p-3 md:p-6">
                    <div className="mx-auto mt-20 w-full max-w-md rounded-2xl border border-violet-200 bg-violet-50/95 p-4">
                        <h2 className="text-sm font-semibold text-violet-900">
                            下書きをクリアしますか？
                        </h2>
                        <p className="mt-2 text-xs text-violet-800">
                            入力中のイベント情報・セットリスト・出力設定を初期状態に戻します。
                        </p>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsClearDraftModalOpen(false)}
                                className="h-8 rounded-xl border border-violet-300 bg-violet-50/70 px-3 text-xs font-semibold text-violet-800"
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    clearDraft();
                                    setIsClearDraftModalOpen(false);
                                }}
                                className="inline-flex h-8 items-center gap-1 rounded-xl border border-violet-400 bg-violet-100 px-3 text-xs font-semibold text-violet-900"
                            >
                                <ResetIcon className="h-4 w-4" />
                                クリア
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isPreviewModalOpen ? (
                <div className="fixed inset-0 z-30 bg-slate-900/40 p-3 md:p-6">
                    <div className="mx-auto flex h-full max-w-4xl flex-col rounded-2xl border border-violet-200 bg-violet-50/95 p-3 md:p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-violet-900">
                                プレビュー
                            </h2>
                            <div className="flex items-center gap-1">
                                {isCopyAction ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleCopyExportAction}
                                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-violet-300 bg-violet-50/70 px-2 text-xs font-semibold text-violet-800"
                                        >
                                            コピー
                                        </button>
                                        {canDownloadImage ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    downloadImageFromSource(
                                                        exportFormat === "html"
                                                            ? "htmlTable"
                                                            : "text",
                                                    )
                                                }
                                                disabled={isExportingImage}
                                                className="inline-flex h-8 items-center gap-1 rounded-xl border border-violet-300 bg-violet-50/70 px-2 text-xs font-semibold text-violet-800 disabled:opacity-60"
                                            >
                                                <DownloadIcon className="h-4 w-4" />
                                                {isExportingImage
                                                    ? "画像生成中..."
                                                    : "画像をダウンロード"}
                                            </button>
                                        ) : null}
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handlePrimaryExportAction}
                                        className="inline-flex h-8 items-center gap-1 rounded-xl border border-violet-300 bg-violet-50/70 px-2 text-xs font-semibold text-violet-800"
                                    >
                                        {!isTwitterAction ? (
                                            <DownloadIcon className="h-4 w-4" />
                                        ) : null}
                                        {isTwitterAction
                                            ? "Twitterに投稿"
                                            : "出力"}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsPreviewModalOpen(false)}
                                    className="inline-flex h-8 items-center justify-center rounded-xl border border-violet-300 px-2 text-xs text-violet-800"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="mb-3 grid gap-2 text-sm text-violet-800 md:grid-cols-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="krn-export-format-modal"
                                    checked={exportFormat === "text"}
                                    onChange={() => setExportFormat("text")}
                                />
                                テキスト
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="krn-export-format-modal"
                                    checked={exportFormat === "csv"}
                                    onChange={() => setExportFormat("csv")}
                                />
                                CSV
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="krn-export-format-modal"
                                    checked={exportFormat === "html"}
                                    onChange={() => setExportFormat("html")}
                                />
                                HTML（表）
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="krn-export-format-modal"
                                    checked={exportFormat === "twitter"}
                                    onChange={() => setExportFormat("twitter")}
                                />
                                Twitter投稿文
                            </label>
                        </div>
                        {exportFormat === "image" ? (
                            <div className="mb-2 flex gap-2 text-xs">
                                <label className="flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name="krn-image-export-source"
                                        checked={imageExportSource === "text"}
                                        onChange={() =>
                                            setImageExportSource("text")
                                        }
                                    />
                                    テキストを画像化
                                </label>
                                <label className="flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name="krn-image-export-source"
                                        checked={
                                            imageExportSource === "htmlTable"
                                        }
                                        onChange={() =>
                                            setImageExportSource("htmlTable")
                                        }
                                    />
                                    HTML表を画像化
                                </label>
                            </div>
                        ) : null}
                        {exportFormat === "html" ? (
                            <div className="mb-2 flex gap-2 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setHtmlPreviewMode("render")}
                                    className={`rounded-full border px-2 py-1 ${
                                        htmlPreviewMode === "render"
                                            ? "border-violet-400 bg-violet-100/80 text-violet-900"
                                            : "border-violet-200 text-violet-700"
                                    }`}
                                >
                                    ブラウザ表示
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHtmlPreviewMode("code")}
                                    className={`rounded-full border px-2 py-1 ${
                                        htmlPreviewMode === "code"
                                            ? "border-violet-400 bg-violet-100/80 text-violet-900"
                                            : "border-violet-200 text-violet-700"
                                    }`}
                                >
                                    コード表示
                                </button>
                            </div>
                        ) : null}
                        {isTwitterAction ? (
                            <p
                                className={`mb-3 text-xs ${
                                    isTweetTooLong
                                        ? "text-red-700"
                                        : "text-violet-700"
                                }`}
                            >
                                文字数: {tweetLength}/{TWITTER_MAX_LENGTH}
                            </p>
                        ) : null}
                        {exportFormat === "html" &&
                        htmlPreviewMode === "render" ? (
                            <iframe
                                title="html-preview"
                                sandbox=""
                                srcDoc={exportHtml}
                                className="min-h-0 h-full flex-1 rounded-xl border border-violet-300 bg-white"
                            />
                        ) : exportFormat === "image" &&
                          imageExportSource === "htmlTable" ? (
                            <iframe
                                title="image-html-preview"
                                sandbox=""
                                srcDoc={exportHtml}
                                className="min-h-0 h-full flex-1 rounded-xl border border-violet-300 bg-white"
                            />
                        ) : (
                            <pre
                                className={`min-h-0 flex-1 overflow-y-auto rounded-xl border border-violet-300 bg-violet-50 p-3 text-xs leading-6 text-violet-800 ${
                                    exportFormat === "image"
                                        ? "overflow-x-auto whitespace-pre"
                                        : "overflow-x-hidden whitespace-pre-wrap break-words"
                                }`}
                            >
                                {exportFormat === "html" &&
                                htmlPreviewMode === "code"
                                    ? exportHtmlFragment
                                    : exportPreview}
                            </pre>
                        )}
                    </div>
                </div>
            ) : null}

            {operationMessage ? (
                <div className="fixed left-1/2 top-8 z-40 w-[min(92vw,640px)] -translate-x-1/2 rounded-xl border border-violet-300 bg-violet-50/95 px-3 py-2 text-xs font-semibold text-violet-800 shadow-[3px_3px_0px_0px_rgba(15,23,42,0.7)]">
                    {operationMessage}
                </div>
            ) : null}
        </section>
    );
}

function mapSongRowToChoice(row: SongSearchRow): SongChoice {
    return {
        songId: row.songId,
        songName: row.songName,
        artistId: row.artistId ?? null,
        artistName: row.artistName,
    };
}

function getCandidateLabelWeight(label: string): number {
    const normalized = normalizeSongKey(label);
    if (normalized.length > 0) return normalized.length;
    const trimmed = label.trim();
    return trimmed.length > 0 ? trimmed.length : Number.MAX_SAFE_INTEGER;
}

function compareSongChoice(
    a: SongChoice,
    b: SongChoice,
    key: string,
): number {
    const aExact = key.length > 0 && normalizeSongKey(a.songName) === key;
    const bExact = key.length > 0 && normalizeSongKey(b.songName) === key;
    if (aExact !== bExact) return aExact ? -1 : 1;
    const labelDiff = getCandidateLabelWeight(a.songName) - getCandidateLabelWeight(b.songName);
    if (labelDiff !== 0) return labelDiff;
    if (a.songId !== b.songId) return a.songId - b.songId;
    return a.songName.localeCompare(b.songName, "ja");
}

function comparePerformerChoice(
    a: PerformerChoice,
    b: PerformerChoice,
    keys: Set<string>,
): number {
    const aIsGroup = /\[group\]\s*$/i.test(a.label);
    const bIsGroup = /\[group\]\s*$/i.test(b.label);
    const aKey = normalizePerformerKey(a.value || a.label);
    const bKey = normalizePerformerKey(b.value || b.label);
    const aExact = aKey.length > 0 && keys.has(aKey);
    const bExact = bKey.length > 0 && keys.has(bKey);
    if (aExact !== bExact) return aExact ? -1 : 1;
    if (aExact && bExact && aIsGroup !== bIsGroup) return aIsGroup ? -1 : 1;
    const lenDiff = a.label.trim().length - b.label.trim().length;
    if (lenDiff !== 0) return lenDiff;
    return a.label.localeCompare(b.label, "ja");
}

function mergePerformerChoices(
    memberRows: MemberSearchRow[],
    groupRows: SearchSuggestion[],
): PerformerChoice[] {
    const mappedMembers = memberRows
        .slice(0, LOOKUP_SUGGEST_LIMIT)
        .map((row) => ({
            label: `${row.personName}${row.activeGroupsText ? ` (${row.activeGroupsText})` : ""}`,
            value: row.personName,
            personId: row.personId,
            groupId: null,
        }));
    const mappedGroups = groupRows
        .slice(0, LOOKUP_SUGGEST_LIMIT)
        .map((row) => ({
            label: `${row.label} [group]`,
            value: row.value,
            personId: null,
            groupId: null,
        }));

    const combined = [...mappedMembers, ...mappedGroups];
    const seen = new Set<string>();
    return combined.filter((row) => {
        if (seen.has(row.value)) return false;
        seen.add(row.value);
        return true;
    });
}

function mapSetlistToEntry(row: SetlistDetail): KrnEntry {
    return createEntry({
        section: row.section ?? "",
        songName: row.songName,
        songId: row.songId,
        songArtistId: row.artistId ?? null,
        songArtistName: row.artistName ?? "",
        performerNames: parsePerformerNames(row.displayPerformerName ?? ""),
        isPerformerTextInput: false,
        isMc: false,
    });
}
