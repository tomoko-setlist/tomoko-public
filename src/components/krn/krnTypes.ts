export type StageCandidate = {
    stageId: number;
    eventId: number;
    eventName: string;
    date: string;
    venueName: string;
    startTime: string;
    pattern: string;
};

export type SongChoice = {
    songId: number;
    songName: string;
    artistId: number | null;
    artistName: string;
};

export type PerformerChoice = {
    label: string;
    value: string;
    personId: number | null;
    groupId: number | null;
};

export type PerformerResolved = {
    personId: number | null;
    groupId: number | null;
};

export type PerformerDelimiter = "・" | "、" | "," | "/" | "／";
export type InlineAffixStyle = "slash" | "dot" | "square" | "round";
export type ParsePerformerDelimiter = "auto" | PerformerDelimiter | "space";

export type KrnEntry = {
    id: string;
    section: string;
    songName: string;
    songId: number | null;
    songVersionId: number | null;
    songArtistId: number | null;
    songArtistName: string;
    isSongFreeInput: boolean;
    performerNames: string[];
    isPerformerTextInput: boolean;
    note: string;
    isMc: boolean;
    isMedley: boolean;
};

export type OutputOptions = {
    artistDisplayMode: "hidden" | "inline" | "newline";
    artistInlineStyle: InlineAffixStyle;
    artistPrefixCustom: string;
    includeEvent: boolean;
    performerDisplayMode: "hidden" | "inline" | "newline";
    performerInlineStyle: InlineAffixStyle;
    performerPrefixCustom: string;
    includeNote: boolean;
    sectionAsHeader: boolean;
    includeMc: boolean;
    countMcInMusicOrder: boolean;
};

export type ExportFormat = "text" | "csv" | "image" | "html" | "twitter";
export type ImageExportSource = "text" | "htmlTable";

export type KrnDraft = {
    stageSearchDate: string;
    stageSearchTerm: string;
    selectedStage: StageCandidate | null;
    eventName: string;
    stageDate: string;
    venueName: string;
    startTime: string;
    pattern: string;
    rawInput: string;
    parseIncludePerformer: boolean;
    parsePerformerDelimiter: ParsePerformerDelimiter;
    entries: KrnEntry[];
    outputOptions: OutputOptions;
    performerDelimiter: PerformerDelimiter;
    exportFormat: ExportFormat;
    imageExportSource: ImageExportSource;
    notifyTomoko: boolean;
};

export type ParsedTweetLike = {
    weightedLength: number;
    valid: boolean;
};

export type KrnLine = {
    lineOrder: number;
    musicOrder: number | null;
    entry: KrnEntry;
};

export type DisplayKrnLine = KrnLine & {
    displayOrder: number;
};
