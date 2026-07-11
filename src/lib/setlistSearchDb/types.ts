export type SearchUnit = "stage" | "setlist";
export type SearchDateMode = "year" | "date";
export type SortOrder = "asc" | "desc";
export type SortBy =
    | "date"
    | "event"
    | "venue"
    | "title"
    | "performer"
    | "artist"
    | "startTime";
export type SearchMethod =
    | "contains"
    | "notContains"
    | "exact"
    | "notExact"
    | "startsWith"
    | "endsWith";

export type AdvancedConditionField =
    | "songName"
    | "personName"
    | "artistName"
    | "lyricistName"
    | "composerName"
    | "arrangerName"
    | "eventName"
    | "venueName"
    | "sectionName"
    | "eventTag"
    | "prefectureId";

export type AdvancedConditionValue = {
    id: string;
    field: AdvancedConditionField;
    value: string;
    method: SearchMethod;
};

export type AdvancedConditionGroup = {
    id: string;
    joinWithPrev?: "and" | "or";
    field: AdvancedConditionField;
    conditionJoin?: "and" | "or";
    values: AdvancedConditionValue[];
};
export type SearchSuggestField =
    | "query"
    | "songSearchQuery"
    | "songSearchSongName"
    | "songSearchArtistName"
    | "songSearchLyricistName"
    | "songSearchComposerName"
    | "songSearchArrangerName"
    | "songSearchAlbumName"
    | "memberSearchQuery"
    | "memberSearchPersonName"
    | "memberSearchGroupName"
    | "memberSearchGeneration"
    | "memberSearchRoleName"
    | "memberSearchColorName"
    | "normalizedPerformer"
    | "songName"
    | "personName"
    | "groupName"
    | "prefectureName"
    | "artistName"
    | "lyricistName"
    | "composerName"
    | "arrangerName"
    | "albumName"
    | "eventName"
    | "venueName"
    | "sectionName"
    | "eventTag";
export type SearchSuggestVariant = "A" | "B";

export type SearchSuggestion = {
    value: string;
    label: string;
};

export type SearchSuggestRequest = {
    field: SearchSuggestField;
    term: string;
    searchUnit: SearchUnit;
    limit: number;
    variant?: SearchSuggestVariant;
};

export type FieldSearchMethods = {
    personName: SearchMethod;
    songName: SearchMethod;
    artistName: SearchMethod;
    lyricistName: SearchMethod;
    composerName: SearchMethod;
    arrangerName: SearchMethod;
    eventName: SearchMethod;
    venueName: SearchMethod;
    eventTag: SearchMethod;
    sectionName: SearchMethod;
};

export const DEFAULT_FIELD_SEARCH_METHODS: FieldSearchMethods = {
    personName: "contains",
    songName: "contains",
    artistName: "contains",
    lyricistName: "contains",
    composerName: "contains",
    arrangerName: "contains",
    eventName: "contains",
    venueName: "contains",
    eventTag: "contains",
    sectionName: "contains",
};

export type SearchRequest = {
    searchUnit: SearchUnit;
    groupByEvent?: boolean;
    groupByEventSong?: boolean;
    term: string;
    normalizedPerformerKeys?: string;
    conditionGroups?: AdvancedConditionGroup[];
    conditionTopLevelJoin?: "and" | "or";
    personName: string;
    songName: string;
    artistName: string;
    lyricistName: string;
    composerName: string;
    arrangerName: string;
    eventName: string;
    venueName: string;
    eventTag: string;
    sectionName: string;
    prefectureIds: string;
    fieldSearchMethods: FieldSearchMethods;
    dateFrom: string;
    dateTo: string;
    sortBy: SortBy;
    sortOrder: SortOrder;
    page: number;
    limit: number;
};

export type SearchResultRow = {
    row_id: number;
    stage_id?: number;
    event_id: number;
    song_id: number;
    artist_id?: number | null;
    venue_id: number;
    primary_text: string;
    secondary_text: string;
    artist_text: string;
    section_text: string;
    start_time: string | null;
    pattern?: string | null;
    cancelled?: boolean | null;
    prefecture_id: number | null;
    event_name: string;
    date_label: string;
    venue_name: string;
    total_stages: number;
    total_performances: number;
    event_tags_json: string;
};

export type EventDetail = {
    eventId: number;
    eventName: string;
    firstDate: string;
    lastDate: string;
    totalStages: number;
    totalPerformances: number;
    eventTagsJson: string;
};

export type StageDetail = {
    stageId: number;
    eventId: number;
    eventStageNumber?: number | null;
    eventName: string;
    venueId: number;
    venueName: string;
    prefectureName?: string | null;
    date: string;
    startTime: string | null;
    pattern?: string | null;
    cancelled?: boolean;
    totalPerformances: number;
    eventTagsJson: string;
};

export type SetlistDetail = {
    setlistId: number;
    stageId: number;
    eventId: number;
    eventName: string;
    venueId: number;
    venueName: string;
    date: string;
    startTime: string | null;
    musicOrder: number;
    section: string;
    remarks?: string | null;
    displayPerformerName: string | null;
    songId: number;
    songName: string;
    artistId: number | null;
    artistName: string | null;
    lyricistName: string | null;
    composerName: string | null;
    arrangerName: string | null;
    creatorsText: string | null;
    eventTagsJson: string;
};

export type SongDetail = {
    songId: number;
    songName: string;
    artistId: number;
    artistName: string;
    defaultStreamingSongVersionId: number | null;
    totalPerformances: number;
    totalStages: number;
    totalEvents: number;
    lastPerformedDate: string | null;
};

export type SongTopPercentiles = {
    totalSongs: number;
    performanceRank: number;
    eventRank: number;
    venueRank: number;
    tagKindsRank: number;
    performanceTopPercent: number;
    eventTopPercent: number;
    venueTopPercent: number;
    tagKindsTopPercent: number;
};

export type SongVersionDetail = {
    songVersionId: number | null;
    versionName: string;
    artistId: number | null;
    artistName: string | null;
    nodeeUrl: string | null;
    youtubeId: string | null;
    youtubeIds: string[];
    lyricistId: number | null;
    lyricistName: string | null;
    composerId: number | null;
    composerName: string | null;
    arrangerId: number | null;
    arrangerName: string | null;
    performanceCount: number;
    albumTrackCount: number;
};

export type SongVersionSearchRow = {
    songVersionId: number;
    versionName: string;
    songId: number | null;
    songName: string;
    songArtistId: number | null;
    songArtistName: string;
    artistId: number | null;
    artistName: string;
};

export type SongVersionSearchResponse = {
    rows: SongVersionSearchRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export type CreatorDetail = {
    creatorId: number;
    creatorName: string;
    subjectType: number;
    personId: number | null;
    personName: string | null;
    groupId: number | null;
    groupName: string | null;
};

export type CreatorRole = "lyricist" | "composer" | "arranger";

export type CreatorSongRow = {
    songId: number;
    songName: string;
    artistId: number;
    artistName: string;
    totalPerformances: number;
    lastPerformedDate: string | null;
};

export type ArtistDetail = {
    artistId: number;
    artistName: string;
    subjectType: number;
    personId: number | null;
    personName: string | null;
    groupId: number | null;
    groupName: string | null;
    totalSongs: number;
    totalAlbums: number;
    totalPerformances: number;
    totalStages: number;
    totalEvents: number;
    lastPerformedDate: string | null;
};

export type AlbumDetail = {
    albumId: number;
    albumName: string;
    category: number;
    releaseDate: string;
    artistId: number;
    artistName: string;
    trackCount: number;
    link?: string | null;
    nodeeUrl?: string | null;
    primaryStreamingSongVersionId?: number | null;
};

export type AlbumTrack = {
    albumTrackId: number;
    albumId: number;
    trackNumber: number;
    songVersionId: number | null;
    songId: number | null;
    versionName: string | null;
    songName: string | null;
    artistId: number | null;
    artistName: string | null;
    songVersions: Array<{
        songVersionId: number | null;
        songId: number | null;
        versionName: string | null;
        songName: string | null;
        artistId: number | null;
        artistName: string | null;
    }>;
};

export type VenueDetail = {
    venueId: number;
    venueName: string;
    prefectureName?: string | null;
    sittingCapacity?: number | null;
    standingCapacity?: number | null;
    totalStages: number;
    firstDate: string | null;
    lastDate: string | null;
};

export type VenueTopPercentiles = {
    totalVenues: number;
    stageRank: number;
    eventRank: number;
    performanceRank: number;
    stageTopPercent: number;
    eventTopPercent: number;
    performanceTopPercent: number;
};

export type AnnouncementKind = "release" | "notice";

export type ReleaseNoteSummary = {
    releaseId: number;
    slug: string;
    title: string;
    summary: string;
    releasedAt: string;
    announcementKind: AnnouncementKind;
    relatedRelease: string | null;
    tags: string[];
};

export type ReleaseNoteDetail = ReleaseNoteSummary & {
    bodyMarkdown: string;
    parquetGeneratedAt: string | null;
    parquetSignature: string | null;
};

export type ReleaseDbChange = {
    releaseId: number;
    changeOrder: number;
    entity: string;
    beforeCount: number | null;
    afterCount: number | null;
    delta: number | null;
    note: string | null;
    source: string | null;
};

export type DashboardRelease = ReleaseNoteSummary & {
    changes: ReleaseDbChange[];
};

export type DashboardData = {
    stats: HomeDigestStats;
    releases: DashboardRelease[];
};

export type HomeDigestStats = {
    totalSetlists: number;
    totalStages: number;
    totalEvents: number;
    totalSongs: number;
    totalMembers: number;
    latestReleaseTitle: string | null;
    latestReleaseDate: string | null;
};

export type HomeDigestStage = {
    stageId: number;
    eventId: number;
    eventName: string;
    venueId: number;
    venueName: string;
    prefectureName: string | null;
    date: string;
    startTime: string | null;
    pattern: string | null;
    cancelled: boolean;
    totalPerformances: number;
};

export type HomeDigestAnniversaryStage = HomeDigestStage & {
    yearsAgo: number;
};

export type HomeDigestSong = {
    songId: number;
    songName: string;
    artistId: number | null;
    artistName: string | null;
    totalPerformances: number;
    totalStages: number;
    lastPerformedDate: string | null;
};

export type HomeDailyDigest = {
    referenceDate: string;
    stats: HomeDigestStats;
    upcomingStages: HomeDigestStage[];
    recentStages: HomeDigestStage[];
    anniversaryStages: HomeDigestAnniversaryStage[];
    recentHotSongs: HomeDigestSong[];
};

export type SongSearchRow = {
    songId: number;
    songName: string;
    artistId: number;
    artistName: string;
    lyricistId?: number | null;
    lyricistName: string | null;
    composerId?: number | null;
    composerName: string | null;
    arrangerId?: number | null;
    arrangerName: string | null;
    albumNames: string | null;
    firstAlbumId: number | null;
    albumEntries?: Array<{
        albumId: number;
        albumName: string;
    }>;
    releaseDate: string | null;
    totalPerformances: number;
    totalStages: number;
    totalEvents: number;
    lastPerformedDate: string | null;
};

export type MasterOption = {
    id: number;
    name: string;
};

export type SongSearchRequest = {
    term: string;
    songName: string;
    artistName: string;
    lyricistName: string;
    composerName: string;
    arrangerName: string;
    albumName: string;
    songCategories?: number[];
    releaseDateFrom: string;
    releaseDateTo: string;
    fieldSearchMethods: {
        songName: SearchMethod;
        artistName: SearchMethod;
        lyricistName: SearchMethod;
        composerName: SearchMethod;
        arrangerName: SearchMethod;
        albumName: SearchMethod;
    };
    page: number;
    limit: number;
    sortBy:
        | "song"
        | "artist"
        | "lyricist"
        | "composer"
        | "arranger"
        | "releaseDate"
        | "date";
    sortOrder: SortOrder;
};

export type SongSearchResponse = {
    rows: SongSearchRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export type SongRankingRow = {
    rank: number;
    entityType:
        | "song"
        | "artist"
        | "performer"
        | "venue"
        | "prefecture"
        | "memberColor"
        | "memberColorFamily"
        | "memberBirthplace"
        | "memberJoinAge"
        | "venuePrefecture"
        | "lyricist"
        | "composer"
        | "arranger";
    entityId: number | null;
    entityName: string;
    songId: number | null;
    songName: string | null;
    artistId: number | null;
    artistName: string | null;
    totalPerformances: number;
    totalStages: number;
    totalEvents: number;
    lastPerformedDate: string | null;
    joinAgeYears?: number | null;
    joinAgeDays?: number | null;
};

export type SongRankingConditionField =
    | "songName"
    | "artistName"
    | "performerName"
    | "performerGroupName"
    | "eventName"
    | "venueName"
    | "section"
    | "remarks"
    | "lyricistName"
    | "composerName"
    | "arrangerName"
    | "eventTag"
    | "prefectureId"
    | "performerAge"
    | "memberStatus"
    | "bloodType"
    | "generation"
    | "roleName"
    | "colorName";

export type SongRankingConditionMethod = SearchMethod | "eq" | "not";

export type SongRankingCondition = {
    field: SongRankingConditionField;
    method: SongRankingConditionMethod;
    value: string;
};

export type SongRankingConditionGroup = {
    joinWithPrev: "and" | "or";
    conditionJoin: "and" | "or";
    conditions: SongRankingCondition[];
};

export type SongRankingRequest = {
    conditionGroups: SongRankingConditionGroup[];
    dateFrom: string;
    dateTo: string;
    page: number;
    limit: number;
    rankingBy?: "song" | "artist" | "performer" | "venue" | "prefecture" | "lyricist" | "composer" | "arranger";
    sortBy: "performances" | "stages" | "events" | "lastDate" | "song" | "artist";
    sortOrder: SortOrder;
    minPerformances?: number;
    minStages?: number;
    minEvents?: number;
    months?: number[];
    monthDays?: string[];
};

export type StatsAttributeRankingBy =
    | "memberColor"
    | "memberColorFamily"
    | "memberBirthplace"
    | "memberJoinAge"
    | "venuePrefecture";

export type StatsAttributeRankingRequest = {
    rankingBy: StatsAttributeRankingBy;
    conditionGroups: SongRankingConditionGroup[];
    dateFrom: string;
    dateTo: string;
    page: number;
    limit: number;
    sortOrder: SortOrder;
    memberScope?: "currentHello" | "currentHelloAndTrainees" | "helloHistory" | "helloOg" | "all";
    memberBirthdayFrom?: string;
    memberBirthdayTo?: string;
    memberBirthMonths?: number[];
    months?: number[];
    monthDays?: string[];
};

export type SongRankingResponse = {
    rows: SongRankingRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export type StatsSetlistDetailColumn =
    | "songName"
    | "artistName"
    | "eventName"
    | "date"
    | "venueName"
    | "performerName"
    | "sectionName"
    | "memberName"
    | "groupName"
    | "birthday"
    | "prefectureName"
    | "lyricistName"
    | "composerName"
    | "arrangerName"
    | "releaseDate"
    | "totalPerformances"
    | "totalStages"
    | "totalEvents";

export type StatsSetlistDetailRow = {
    rank: number;
    setlistId: number;
    stageId: number;
    eventId: number;
    eventName: string;
    venueId: number | null;
    venueName: string | null;
    date: string | null;
    sectionName: string | null;
    performerName: string | null;
    songId: number | null;
    songName: string | null;
    artistId: number | null;
    artistName: string | null;
    memberId?: number | null;
    memberName?: string | null;
    groupId?: number | null;
    groupName?: string | null;
    birthday?: string | null;
    prefectureName?: string | null;
    lyricistId?: number | null;
    lyricistName?: string | null;
    composerId?: number | null;
    composerName?: string | null;
    arrangerId?: number | null;
    arrangerName?: string | null;
    releaseDate?: string | null;
    totalPerformances?: number | null;
    totalStages?: number | null;
    totalEvents?: number | null;
};

export type StatsSetlistDetailRequest = {
    conditionGroups: SongRankingConditionGroup[];
    dateFrom: string;
    dateTo: string;
    page: number;
    limit: number;
    sortOrder: SortOrder;
    distinctBy?: "member" | "song";
    memberScope?: "currentHello" | "currentHelloAndTrainees" | "helloHistory" | "helloOg" | "all";
    months?: number[];
    monthDays?: string[];
};

export type StatsSetlistDetailResponse = {
    rows: StatsSetlistDetailRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export type SearchResponse = {
    rows: SearchResultRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    eventTotal?: number;
    stageTotal?: number;
};

export type ArtistProfileRow = {
    artistId: number;
    artistName: string;
    personId: number | null;
    personName: string | null;
    groupId: number | null;
    groupName: string | null;
    subjectType: number;
    isHello: boolean;
};

export type PersonRow = {
    personId: number;
    personName: string;
    nameKana: string | null;
    firstName: string | null;
    lastName: string | null;
    heightCm: number | null;
    birthPlaceText: string | null;
    birthday: string | null;
    prefectureId: number | null;
    prefectureName: string | null;
    countryId: number | null;
    countryName: string | null;
};

export type GroupRow = {
    groupId: number;
    groupName: string;
    groupType: number;
    debutDate: string | null;
    formationDate: string | null;
    disbandDate: string | null;
};

export type GroupMembershipRow = {
    groupPersonId: number;
    groupId: number;
    groupName: string;
    groupType?: number | null;
    groupDisbandDate?: string | null;
    personId: number;
    personName: string;
    birthPlaceText: string | null;
    birthday: string | null;
    deathday?: string | null;
    generation: string | null;
    joinDate: string;
    leaveDate: string | null;
    memberColors?: Array<{
        colorCode: string;
        colorName: string | null;
        startDate: string | null;
        endDate: string | null;
    }>;
    memberRoles?: Array<{
        roleName: string;
        appointmentDate: string | null;
        retirementDate: string | null;
    }>;
};

export type GroupRoleRow = {
    groupPersonRoleId: number;
    groupPersonId: number;
    groupId: number;
    groupName: string;
    personId: number;
    roleName: string;
    appointmentDate: string;
    retirementDate: string | null;
};

export type MemberSearchRequest = {
    term: string;
    personName: string;
    groupName: string;
    prefectureIds?: string;
    prefectureName: string;
    joinedFrom?: string;
    joinedTo?: string;
    birthdayFrom?: string;
    birthdayTo?: string;
    birthMonths?: string;
    activeStatus?:
        | "all"
        | "activeHello"
        | "trainee"
        | "helloOg"
        | "formerTrainee";
    bloodType?: string;
    generation?: string;
    roleName?: string;
    colorName?: string;
    page: number;
    limit: number;
    sortBy: "name" | "kana" | "joinedAt";
    sortOrder: SortOrder;
};

export type MemberStatus =
    | "activeHello"
    | "trainee"
    | "helloOg"
    | "formerTrainee"
    | "other";

export type MemberSearchRow = {
    personId: number;
    personName: string;
    nameKana: string | null;
    prefectureName: string | null;
    colorsText: string | null;
    memberColors?: Array<{
        colorCode: string;
        colorName: string | null;
        startDate: string | null;
        endDate: string | null;
    }>;
    memberStatus?: MemberStatus | null;
    birthday: string | null;
    latestJoinDate: string | null;
    activeGroupsText: string | null;
    formerGroupsText: string | null;
    groupsText: string | null;
    activeGroupType10Text?: string | null;
    activeGroupType70Text?: string | null;
    activeGroupType20Text?: string | null;
    activeGroupType30Text?: string | null;
    activeGroupType40Text?: string | null;
    activeGroupTypeOtherText?: string | null;
    formerGroupType10Text?: string | null;
    formerGroupType70Text?: string | null;
    formerGroupType20Text?: string | null;
    formerGroupType30Text?: string | null;
    formerGroupType40Text?: string | null;
    formerGroupTypeOtherText?: string | null;
};

export type MemberSearchResponse = {
    rows: MemberSearchRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export type RelatedEventRow = {
    eventId: number;
    eventName: string;
    eventTagsJson?: string;
    latestDate: string | null;
    earliestDate: string | null;
    stageCount: number;
    setlistCount: number;
};

export type PerformerSummaryRow = {
    performerName: string;
    memberPersonIdsJson?: string | null;
    absencePersonNamesJson?: string | null;
    performerRole?: string | null;
    note?: string | null;
    personId: number | null;
    personName: string | null;
    groupId: number | null;
    groupName: string | null;
    stageCount: number;
    setlistCount: number;
};

export type MemberDetail = {
    personId: number;
    personName: string;
    memberStatus: MemberStatus | null;
    nameKana: string | null;
    firstName: string | null;
    lastName: string | null;
    heightCm: number | null;
    birthPlaceText: string | null;
    birthday: string | null;
    deathday: string | null;
    prefectureName: string | null;
    countryName: string | null;
};

export type MemberProfile = {
    memberProfileId: number;
    personId: number;
    nickname: string | null;
    nicknameAlt: string | null;
    bloodType: string | null;
    specialSkill: string | null;
    hobby: string | null;
    motto: string | null;
    officialProfileText: string | null;
    favoriteFood: string | null;
    favoriteMusic: string | null;
    favoriteSports: string | null;
    specialNotes: string | null;
};

export type MemberColorRow = {
    memberColorId: number;
    groupPersonId: number;
    personId: number;
    groupId: number;
    groupName: string;
    colorCode: string;
    colorName: string | null;
    startDate: string;
    endDate: string | null;
};

export type GroupDetail = {
    groupId: number;
    groupName: string;
    pastNames: string[];
    groupType: number;
    debutDate: string | null;
    formationDate: string | null;
    disbandDate: string | null;
    totalMembers: number;
};

export type CalendarEventKind =
    | "birthday"
    | "groupJoin"
    | "hpJoin"
    | "graduation"
    | "groupFormation"
    | "groupDebut"
    | "stage";

export type CalendarStage = {
    stageId: number;
    startTime: string | null;
    venueId: number | null;
    venueName: string | null;
    prefectureName: string | null;
    cancelled: boolean;
    hasSetlist: boolean;
};

export type CalendarLiveEvent = {
    id: string;
    date: string;
    kind: "stage";
    eventId: number;
    title: string;
    stages: CalendarStage[];
    eventTags: string[];
};

export type CalendarPersonSummary = {
    personId: number;
    personName: string;
};

export type CalendarGraduationScope = {
    type: "group" | "helloProject";
    groupId: number | null;
    label: string;
};

export type CalendarBasicAnniversaryEvent = {
    id: string;
    date: string;
    sourceDate: string;
    kind: "birthday" | "hpJoin" | "groupFormation" | "groupDebut";
    title: string;
    subtitle: string | null;
    anniversaryYears: number;
    targetType: "member" | "group";
    targetId: number;
    relatedGroupId: number | null;
};

export type CalendarGroupJoinEvent = {
    id: string;
    date: string;
    sourceDate: string;
    kind: "groupJoin";
    title: string;
    subtitle: string;
    anniversaryYears: number;
    targetType: "group";
    targetId: number;
    relatedGroupId: number;
    members: CalendarPersonSummary[];
};

export type CalendarGraduationEvent = {
    id: string;
    date: string;
    sourceDate: string;
    kind: "graduation";
    title: string;
    subtitle: string;
    anniversaryYears: number;
    targetType: "member";
    targetId: number;
    relatedGroupId: null;
    scopes: CalendarGraduationScope[];
};

export type CalendarAnniversaryEvent =
    | CalendarBasicAnniversaryEvent
    | CalendarGroupJoinEvent
    | CalendarGraduationEvent;

export type CalendarEvent = CalendarLiveEvent | CalendarAnniversaryEvent;

export type CalendarDay = {
    date: string;
    events: CalendarEvent[];
};

export type CalendarMonth = {
    month: string;
    days: CalendarDay[];
    totals: {
        liveEvents: number;
        stages: number;
        anniversaries: number;
    };
};

export type SetlistSearchDb = {
    // Resolves once all tables (including non-core ones) are loaded.
    // The db is returned as soon as core tables are queryable.
    whenReady?: Promise<void>;
    // Resolves once detail-page tables are loaded (before search aliases / member index).
    whenDetailReady?: Promise<void>;
    query: (request: SearchRequest) => Promise<SearchResponse>;
    suggest: (request: SearchSuggestRequest) => Promise<SearchSuggestion[]>;
    getEventDetail: (eventId: number) => Promise<EventDetail | null>;
    getEventStages: (eventId: number) => Promise<StageDetail[]>;
    getStageDetail: (stageId: number) => Promise<StageDetail | null>;
    getStageSetlists: (stageId: number) => Promise<SetlistDetail[]>;
    getSetlistDetail: (setlistId: number) => Promise<SetlistDetail | null>;
    getRelatedSetlistsBySong: (songId: number, limit?: number) => Promise<SetlistDetail[]>;
    getSongDetail: (songId: number) => Promise<SongDetail | null>;
    getSongTopPercentiles?: (songId: number) => Promise<SongTopPercentiles | null>;
    getSongSetlists: (songId: number, limit?: number) => Promise<SetlistDetail[]>;
    getSongVersions: (songId: number) => Promise<SongVersionDetail[]>;
    getCreatorDetail: (creatorId: number) => Promise<CreatorDetail | null>;
    getCreatorSongsByRole: (
        creatorId: number,
        role: CreatorRole,
        limit: number,
    ) => Promise<CreatorSongRow[]>;
    getArtistDetail: (artistId: number) => Promise<ArtistDetail | null>;
    getArtistSongs: (artistId: number, limit: number) => Promise<SongSearchRow[]>;
    getArtistAlbums: (artistId: number, limit: number) => Promise<AlbumDetail[]>;
    getAlbumDetail: (albumId: number) => Promise<AlbumDetail | null>;
    getAlbumTracks: (albumId: number) => Promise<AlbumTrack[]>;
    getAlbumsBySong: (songId: number) => Promise<AlbumDetail[]>;
    getVenueDetail: (venueId: number) => Promise<VenueDetail | null>;
    getVenueTopPercentiles?: (venueId: number) => Promise<VenueTopPercentiles | null>;
    getVenueStages: (venueId: number) => Promise<StageDetail[]>;
    listEventTags: () => Promise<MasterOption[]>;
    listPrefectures: () => Promise<MasterOption[]>;
    listMemberColorNames: () => Promise<string[]>;
    listGroups?: () => Promise<MasterOption[]>;
    searchSongs: (request: SongSearchRequest) => Promise<SongSearchResponse>;
    searchSongVersions?: (
        term: string,
        limit?: number,
    ) => Promise<SongVersionSearchResponse>;
    searchSongRanking: (request: SongRankingRequest) => Promise<SongRankingResponse>;
    searchStatsAttributeRanking?: (request: StatsAttributeRankingRequest) => Promise<SongRankingResponse>;
    searchStatsSetlistDetails?: (request: StatsSetlistDetailRequest) => Promise<StatsSetlistDetailResponse>;
    searchMembers: (request: MemberSearchRequest) => Promise<MemberSearchResponse>;
    getMemberDetail: (personId: number) => Promise<MemberDetail | null>;
    getMemberProfile: (personId: number) => Promise<MemberProfile | null>;
    getMemberGroups: (personId: number, limit: number) => Promise<GroupMembershipRow[]>;
    getMemberColors: (personId: number, limit: number) => Promise<MemberColorRow[]>;
    getMemberArtists: (personId: number, limit: number) => Promise<ArtistProfileRow[]>;
    getMemberSetlists: (personId: number, limit: number) => Promise<SetlistDetail[]>;
    getMemberEvents: (personId: number, limit?: number) => Promise<RelatedEventRow[]>;
    getMemberEventStages: (personId: number, eventId: number) => Promise<StageDetail[]>;
    getGroupDetail: (groupId: number) => Promise<GroupDetail | null>;
    getGroupMembers: (groupId: number, limit: number) => Promise<GroupMembershipRow[]>;
    getGroupArtists: (groupId: number, limit: number) => Promise<ArtistProfileRow[]>;
    getGroupAlbums: (groupId: number, limit: number) => Promise<AlbumDetail[]>;
    getGroupSetlists: (groupId: number, limit: number) => Promise<SetlistDetail[]>;
    getGroupEvents: (groupId: number, limit?: number) => Promise<RelatedEventRow[]>;
    getGroupEventStages: (groupId: number, eventId: number) => Promise<StageDetail[]>;
    getEventPerformers: (eventId: number) => Promise<PerformerSummaryRow[]>;
    getStagePerformers: (stageId: number) => Promise<PerformerSummaryRow[]>;
    getDetailLastUpdated: (
        detailType:
            | "event"
            | "stage"
            | "venue"
            | "song"
            | "artist"
            | "album"
            | "member"
            | "group"
            | "creator",
        id: number,
    ) => Promise<string | null>;
    getMemberGroupRoles: (personId: number, limit: number) => Promise<GroupRoleRow[]>;
    listReleaseNotes?: (limit?: number) => Promise<ReleaseNoteSummary[]>;
    getReleaseNote?: (releaseId: number) => Promise<ReleaseNoteDetail | null>;
    getReleaseDbChanges?: (
        releaseId: number,
        limit?: number,
    ) => Promise<ReleaseDbChange[]>;
    getHomeDailyDigest?: (referenceDate: string) => Promise<HomeDailyDigest>;
    getDashboardData?: () => Promise<DashboardData>;
    getCalendarMonth: (year: number, month: number) => Promise<CalendarMonth>;
    close: () => void;
};
