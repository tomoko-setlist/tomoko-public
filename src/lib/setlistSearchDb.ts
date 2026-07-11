import { getCalendarMonth } from './setlistSearchDb/calendarQueries'
import {
  getAlbumDetail,
  getAlbumsBySong,
  getAlbumTracks,
  getArtistAlbums,
  getArtistDetail,
  getArtistSongs,
  getCreatorDetail,
  getCreatorSongsByRole,
  getDetailLastUpdatedAt,
  getEventDetail,
  getEventPerformers,
  getEventStages,
  getGroupArtists,
  getGroupAlbums,
  getGroupDetail,
  getGroupEventStages,
  getGroupEvents,
  getGroupMembers,
  getGroupSetlists,
  getHomeDailyDigest,
  getMemberArtists,
  getMemberColors,
  getMemberDetail,
  getMemberEventStages,
  getMemberEvents,
  getMemberProfile,
  getMemberGroupRoles,
  getMemberGroups,
  getMemberSetlists,
  getDashboardData,
  getReleaseDbChanges,
  getReleaseNote,
  getRelatedSetlistsBySong,
  listReleaseNotes,
  getSetlistDetail,
  getSongDetail,
  getSongTopPercentiles,
  getSongSetlists,
  getSongVersions,
  getStagePerformers,
  getStageDetail,
  getStageSetlists,
  getVenueDetail,
  getVenueTopPercentiles,
  getVenueStages,
  listEventTags,
  listGroups,
  listMemberColorNames,
  listPrefectures,
  searchMembers,
  searchStatsAttributeRanking,
  searchStatsSetlistDetails,
  searchSongRanking,
  searchSongs,
} from './setlistSearchDb/detailQueries'
import { initDuckDb } from './setlistSearchDb/initDuckdb'
import {
  loadSearchTables,
  startParquetPrefetch,
  PARQUET_TABLE_FILE_COUNT,
} from './setlistSearchDb/loadCsvTables'
import { searchSetlistRows } from './setlistSearchDb/searchSetlistRows'
import { suggestSearchCandidates } from './setlistSearchDb/suggestQueries'
import { refreshTableSchemaCache } from './setlistSearchDb/tableSchemaCache'

import type { DuckDbLoadProgress } from './setlistSearchDb/initDuckdb'
import type { ParquetLoadProgress, ParquetPrefetch } from './setlistSearchDb/loadCsvTables'
import type { SearchRequest, SetlistSearchDb } from './setlistSearchDb/types'

type CreateSetlistSearchDbOptions = {
  onLoadProgress?: (progress: {
    phase: 'start' | 'loading' | 'done'
    loadedFiles: number
    totalFiles: number
    fileName?: string
    loadedBytes?: number
    totalBytes?: number
  }) => void
}

const FALLBACK_DUCKDB_FILE_COUNT = 2

const clampProgressCount = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.floor(value)))
}

export const createSetlistSearchDb = async (
  options?: CreateSetlistSearchDbOptions,
): Promise<SetlistSearchDb> => {
  const parquetTotalFiles = PARQUET_TABLE_FILE_COUNT
  let duckdbTotalFiles = FALLBACK_DUCKDB_FILE_COUNT

  const emitDuckDbProgress = (progress: DuckDbLoadProgress): void => {
    duckdbTotalFiles = Math.max(
      FALLBACK_DUCKDB_FILE_COUNT,
      clampProgressCount(progress.totalFiles, 1, 10),
    )
    const totalFiles = duckdbTotalFiles + parquetTotalFiles
    const loadedFiles = clampProgressCount(progress.loadedFiles, 0, duckdbTotalFiles)
    options?.onLoadProgress?.({
      phase: progress.phase,
      loadedFiles,
      totalFiles,
      fileName: progress.fileName,
    })
  }

  const emitParquetProgress = (progress: ParquetLoadProgress): void => {
    const totalFiles = duckdbTotalFiles + parquetTotalFiles
    const loadedParquetFiles = clampProgressCount(progress.loadedFiles, 0, parquetTotalFiles)
    options?.onLoadProgress?.({
      phase: progress.phase,
      loadedFiles: duckdbTotalFiles + loadedParquetFiles,
      totalFiles,
      fileName: progress.fileName,
      loadedBytes: progress.loadedBytes,
      totalBytes: progress.totalBytes,
    })
  }

  // Start parquet downloads in parallel with DuckDB WASM initialization.
  let prefetch: ParquetPrefetch | undefined
  if (typeof window !== 'undefined') {
    try {
      prefetch = startParquetPrefetch()
    } catch {
      prefetch = undefined
    }
  }

  const { conn, db, worker, persistent } = await initDuckDb({
    onProgress: emitDuckDbProgress,
  })

  let resolveCoreReady: (() => void) | null = null
  const coreReady = new Promise<void>((resolve) => {
    resolveCoreReady = resolve
  })

  let resolveDetailReady: (() => void) | null = null
  const whenDetailReady = new Promise<void>((resolve) => {
    resolveDetailReady = resolve
  })

  const whenReady = loadSearchTables(conn, db, {
    onProgress: emitParquetProgress,
    prefetch,
    persistentStorage: persistent,
    onCoreReady: () => {
      resolveCoreReady?.()
      void refreshTableSchemaCache(conn)
    },
    onDetailReady: () => {
      resolveDetailReady?.()
    },
  }).then(() => {
    resolveCoreReady?.()
    resolveDetailReady?.()
  })

  // Resolve as soon as core tables are queryable; surface early load failures.
  await Promise.race([coreReady, whenReady])

  const query = async (request: SearchRequest) => searchSetlistRows(conn, request)
  const suggestByRequest = async (request: Parameters<typeof suggestSearchCandidates>[1]) =>
    suggestSearchCandidates(conn, request)
  const getEventDetailById = async (eventId: number) => getEventDetail(conn, eventId)
  const getEventPerformersById = async (eventId: number) => getEventPerformers(conn, eventId)
  const getEventStagesById = async (eventId: number) => getEventStages(conn, eventId)
  const getStageDetailById = async (stageId: number) => getStageDetail(conn, stageId)
  const getStageSetlistsById = async (stageId: number) => getStageSetlists(conn, stageId)
  const getSetlistDetailById = async (setlistId: number) => getSetlistDetail(conn, setlistId)
  const getRelatedSetlistsBySongId = async (songId: number, limit?: number) =>
    getRelatedSetlistsBySong(conn, songId, limit)
  const getSongDetailById = async (songId: number) => getSongDetail(conn, songId)
  const getSongTopPercentilesById = async (songId: number) => getSongTopPercentiles(conn, songId)
  const getSongSetlistsById = async (songId: number, limit?: number) => getSongSetlists(conn, songId, limit)
  const getSongVersionsById = async (songId: number) => getSongVersions(conn, songId)
  const getCreatorDetailById = async (creatorId: number) => getCreatorDetail(conn, creatorId)
  const getCreatorSongsByRoleById = async (
    creatorId: number,
    role: "lyricist" | "composer" | "arranger",
    limit: number,
  ) => getCreatorSongsByRole(conn, creatorId, role, limit)
  const getArtistDetailById = async (artistId: number) => getArtistDetail(conn, artistId)
  const getArtistSongsById = async (artistId: number, limit: number) => getArtistSongs(conn, artistId, limit)
  const getArtistAlbumsById = async (artistId: number, limit: number) => getArtistAlbums(conn, artistId, limit)
  const getAlbumDetailById = async (albumId: number) => getAlbumDetail(conn, albumId)
  const getAlbumTracksById = async (albumId: number) => getAlbumTracks(conn, albumId)
  const getAlbumsBySongId = async (songId: number) => getAlbumsBySong(conn, songId)
  const getVenueDetailById = async (venueId: number) => getVenueDetail(conn, venueId)
  const getVenueTopPercentilesById = async (venueId: number) => getVenueTopPercentiles(conn, venueId)
  const getVenueStagesById = async (venueId: number) => getVenueStages(conn, venueId)
  const searchSongsByRequest = async (request: Parameters<typeof searchSongs>[1]) => searchSongs(conn, request)
  const searchSongRankingByRequest = async (request: Parameters<typeof searchSongRanking>[1]) =>
    searchSongRanking(conn, request)
  const searchStatsAttributeRankingByRequest = async (request: Parameters<typeof searchStatsAttributeRanking>[1]) => {
    await whenReady
    return searchStatsAttributeRanking(conn, request)
  }
  const searchStatsSetlistDetailsByRequest = async (request: Parameters<typeof searchStatsSetlistDetails>[1]) => {
    await whenReady
    return searchStatsSetlistDetails(conn, request)
  }
  const searchMembersByRequest = async (request: Parameters<typeof searchMembers>[1]) => {
    await whenReady
    return searchMembers(conn, request)
  }
  const getMemberDetailById = async (personId: number) => getMemberDetail(conn, personId)
  const getMemberProfileById = async (personId: number) => getMemberProfile(conn, personId)
  const getMemberGroupsById = async (personId: number, limit: number) => getMemberGroups(conn, personId, limit)
  const getMemberColorsById = async (personId: number, limit: number) => {
    await whenReady
    return getMemberColors(conn, personId, limit)
  }
  const getMemberArtistsById = async (personId: number, limit: number) => getMemberArtists(conn, personId, limit)
  const getMemberSetlistsById = async (personId: number, limit: number) => getMemberSetlists(conn, personId, limit)
  const getMemberEventsById = async (personId: number, limit?: number) => getMemberEvents(conn, personId, limit)
  const getMemberEventStagesById = async (personId: number, eventId: number) =>
    getMemberEventStages(conn, personId, eventId)
  const getMemberGroupRolesById = async (personId: number, limit: number) => getMemberGroupRoles(conn, personId, limit)
  const getGroupDetailById = async (groupId: number) => getGroupDetail(conn, groupId)
  const getGroupMembersById = async (groupId: number, limit: number) => getGroupMembers(conn, groupId, limit)
  const getGroupArtistsById = async (groupId: number, limit: number) => getGroupArtists(conn, groupId, limit)
  const getGroupAlbumsById = async (groupId: number, limit: number) => getGroupAlbums(conn, groupId, limit)
  const getGroupSetlistsById = async (groupId: number, limit: number) => getGroupSetlists(conn, groupId, limit)
  const getGroupEventsById = async (groupId: number, limit?: number) => getGroupEvents(conn, groupId, limit)
  const getGroupEventStagesById = async (groupId: number, eventId: number) =>
    getGroupEventStages(conn, groupId, eventId)
  const getStagePerformersById = async (stageId: number) => getStagePerformers(conn, stageId)
  const getDetailLastUpdated = async (
    detailType: "event" | "stage" | "venue" | "song" | "artist" | "album" | "member" | "group" | "creator",
    id: number,
  ) => getDetailLastUpdatedAt(conn, detailType, id)
  const listEventTagsData = async () => listEventTags(conn)
  const listGroupsData = async () => listGroups(conn)
  const listPrefecturesData = async () => listPrefectures(conn)
  const listMemberColorNamesData = async () => {
    await whenReady
    return listMemberColorNames(conn)
  }
  const listReleaseNotesData = async (limit = 120) => listReleaseNotes(conn, limit)
  const getReleaseNoteById = async (releaseId: number) => getReleaseNote(conn, releaseId)
  const getReleaseDbChangesById = async (releaseId: number, limit = 200) =>
    getReleaseDbChanges(conn, releaseId, limit)
  const getHomeDailyDigestByDate = async (referenceDate: string) =>
    getHomeDailyDigest(conn, referenceDate)
  const getDashboardDataFn = async () => getDashboardData(conn)
  const getCalendarMonthFn = async (year: number, month: number) =>
    getCalendarMonth(conn, year, month)

  const close = (): void => {
    void conn.close()
    void db.terminate()
    worker.terminate()
  }

  return {
    whenReady,
    whenDetailReady,
    query,
    suggest: suggestByRequest,
    getEventDetail: getEventDetailById,
    getEventPerformers: getEventPerformersById,
    getEventStages: getEventStagesById,
    getStageDetail: getStageDetailById,
    getStagePerformers: getStagePerformersById,
    getStageSetlists: getStageSetlistsById,
    getSetlistDetail: getSetlistDetailById,
    getRelatedSetlistsBySong: getRelatedSetlistsBySongId,
    getSongDetail: getSongDetailById,
    getSongTopPercentiles: getSongTopPercentilesById,
    getSongSetlists: getSongSetlistsById,
    getSongVersions: getSongVersionsById,
    getCreatorDetail: getCreatorDetailById,
    getCreatorSongsByRole: getCreatorSongsByRoleById,
    getArtistDetail: getArtistDetailById,
    getArtistSongs: getArtistSongsById,
    getArtistAlbums: getArtistAlbumsById,
    getAlbumDetail: getAlbumDetailById,
    getAlbumTracks: getAlbumTracksById,
    getAlbumsBySong: getAlbumsBySongId,
    getVenueDetail: getVenueDetailById,
    getVenueTopPercentiles: getVenueTopPercentilesById,
    getVenueStages: getVenueStagesById,
    listEventTags: listEventTagsData,
    listGroups: listGroupsData,
    listPrefectures: listPrefecturesData,
    listMemberColorNames: listMemberColorNamesData,
    searchSongs: searchSongsByRequest,
    searchSongRanking: searchSongRankingByRequest,
    searchStatsAttributeRanking: searchStatsAttributeRankingByRequest,
    searchStatsSetlistDetails: searchStatsSetlistDetailsByRequest,
    searchMembers: searchMembersByRequest,
    getMemberDetail: getMemberDetailById,
    getMemberProfile: getMemberProfileById,
    getMemberGroups: getMemberGroupsById,
    getMemberColors: getMemberColorsById,
    getMemberArtists: getMemberArtistsById,
    getMemberSetlists: getMemberSetlistsById,
    getMemberEvents: getMemberEventsById,
    getMemberEventStages: getMemberEventStagesById,
    getGroupDetail: getGroupDetailById,
    getGroupMembers: getGroupMembersById,
    getGroupArtists: getGroupArtistsById,
    getGroupAlbums: getGroupAlbumsById,
    getGroupSetlists: getGroupSetlistsById,
    getGroupEvents: getGroupEventsById,
    getGroupEventStages: getGroupEventStagesById,
    getDetailLastUpdated,
    getMemberGroupRoles: getMemberGroupRolesById,
    listReleaseNotes: listReleaseNotesData,
    getReleaseNote: getReleaseNoteById,
    getReleaseDbChanges: getReleaseDbChangesById,
    getHomeDailyDigest: getHomeDailyDigestByDate,
    getDashboardData: getDashboardDataFn,
    getCalendarMonth: getCalendarMonthFn,
    close,
  }
}
