
import {
  createTaskLimiter,
  fetchParquetWithCache,
  getParquetFetchConcurrency,
  getTableAssetUrl,
  mapWithConcurrency,
  resolveReleaseMetadata,
  withCacheBust,
  RELEASE_CHECK_TIMEOUT_MS,
} from './parquetFetch'
import {
  PARQUET_CACHE_NAME,
  clearStoredParquetFileSizes,
  clearStoredParquetGeneratedAt,
  clearStoredSignature,
  clearStoredSnapshotSignature,
  consumeForceRefreshFlag,
  getLastReleaseCheckedAt,
  getReleaseCheckIntervalMs,
  getStoredParquetFileSizes,
  getStoredParquetGeneratedAt,
  getStoredSignature,
  getStoredSnapshotSignature,
  setLastReleaseCheckedAt,
  setStoredParquetFileSizes,
  setStoredParquetGeneratedAt,
  setStoredSignature,
  setStoredSnapshotSignature,
} from './parquetStorage'
import { refreshTableSchemaCache } from './tableSchemaCache'

import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

export {
  getStoredParquetGeneratedAt,
  requestParquetForceRefresh,
} from './parquetStorage'

const SNAPSHOT_SCHEMA_VERSION = '3'
const SNAPSHOT_META_TABLE = 'app_snapshot_meta'
const DB_LOAD_DEBUG_STORAGE_KEY = 'tomoko:debugDbLoad'

export type ParquetLoadProgress = {
  phase: 'start' | 'loading' | 'done'
  loadedFiles: number
  totalFiles: number
  fileName?: string
  loadedBytes?: number
  totalBytes?: number
}

type LoadSearchTablesOptions = {
  onProgress?: (progress: ParquetLoadProgress) => void
  // Fired once the core tables (home screen + setlist search) are queryable.
  onCoreReady?: () => void
  // Fired once detail-page tables are queryable (before search-alias / member-index tables).
  onDetailReady?: () => void
  // Bytes prefetched in parallel with DuckDB initialization.
  prefetch?: ParquetPrefetch
  // Whether the DuckDB database is OPFS-backed (snapshot survives reloads).
  persistentStorage?: boolean
}

type TableDefinition = {
  viewName: string
  fileName: string
  // Required for the home screen / base setlist search; loaded first.
  core?: boolean
  // Loaded after core tables; unlocks most detail pages.
  detail?: boolean
  optional?: boolean
  emptyTableSql?: string
}

const TABLE_DEFINITIONS: readonly TableDefinition[] = [
  { viewName: 'events', fileName: 'events.parquet', core: true },
  { viewName: 'stages', fileName: 'stages.parquet', core: true },
  { viewName: 'setlists', fileName: 'setlists.parquet', core: true },
  {
    viewName: 'setlist_entry_performers',
    fileName: 'setlist_entry_performers.parquet',
    core: true,
    optional: true,
    emptyTableSql:
      "CREATE OR REPLACE TABLE setlist_entry_performers(setlistEntryId BIGINT, stageId BIGINT, eventId BIGINT, performerName TEXT, personId BIGINT, personName TEXT, groupId BIGINT, groupName TEXT);",
  },
  {
    viewName: 'event_performers',
    fileName: 'event_performers.parquet',
    detail: true,
    optional: true,
    emptyTableSql:
      "CREATE OR REPLACE TABLE event_performers(eventPerformerId BIGINT, eventId BIGINT, performerName TEXT, memberPersonIdsJson TEXT, personId BIGINT, personName TEXT, groupId BIGINT, groupName TEXT, performerRole TEXT, note TEXT, absencePersonNamesJson TEXT, \"order\" BIGINT, sortOrder BIGINT, sourceType TEXT);",
  },
  {
    viewName: 'stage_performers',
    fileName: 'stage_performers.parquet',
    detail: true,
    optional: true,
    emptyTableSql:
      "CREATE OR REPLACE TABLE stage_performers(stagePerformerId BIGINT, stageId BIGINT, eventId BIGINT, performerName TEXT, memberPersonIdsJson TEXT, personId BIGINT, personName TEXT, groupId BIGINT, groupName TEXT, performerRole TEXT, note TEXT, absencePersonNamesJson TEXT, \"order\" BIGINT, sortOrder BIGINT, sourceType TEXT);",
  },
  {
    viewName: 'event_performer_persons',
    fileName: 'event_performer_persons.parquet',
    optional: true,
    emptyTableSql:
      "CREATE OR REPLACE TABLE event_performer_persons(eventPerformerPersonId BIGINT, eventPerformerId BIGINT, eventId BIGINT, personId BIGINT, personName TEXT, groupId BIGINT, groupName TEXT, sourceType TEXT);",
  },
  {
    viewName: 'stage_performer_persons',
    fileName: 'stage_performer_persons.parquet',
    optional: true,
    emptyTableSql:
      "CREATE OR REPLACE TABLE stage_performer_persons(stagePerformerPersonId BIGINT, stagePerformerId BIGINT, stageId BIGINT, eventId BIGINT, personId BIGINT, personName TEXT, groupId BIGINT, groupName TEXT, sourceType TEXT);",
  },
  { viewName: 'songs', fileName: 'songs.parquet', core: true },
  { viewName: 'song_metrics', fileName: 'song_metrics.parquet', detail: true },
  { viewName: 'song_versions', fileName: 'song_versions.parquet', detail: true },
  { viewName: 'albums', fileName: 'albums.parquet', detail: true },
  { viewName: 'album_tracks', fileName: 'album_tracks.parquet', detail: true },
  { viewName: 'event_tags', fileName: 'event_tags.parquet', core: true },
  { viewName: 'prefectures', fileName: 'prefectures.parquet', core: true },
  { viewName: 'venues', fileName: 'venues.parquet', core: true },
  { viewName: 'artist_profiles', fileName: 'artist_profiles.parquet', core: true },
  {
    viewName: 'creator_profiles',
    fileName: 'creator_profiles.parquet',
    detail: true,
    optional: true,
    emptyTableSql:
      "CREATE OR REPLACE TABLE creator_profiles(creatorId BIGINT, creatorName TEXT, personId BIGINT, personName TEXT, groupId BIGINT, groupName TEXT, subjectType BIGINT);",
  },
  { viewName: 'persons', fileName: 'persons.parquet', core: true },
  { viewName: 'groups', fileName: 'groups.parquet', detail: true },
  { viewName: 'group_memberships', fileName: 'group_memberships.parquet', detail: true },
  { viewName: 'group_roles', fileName: 'group_roles.parquet', detail: true },
  { viewName: 'group_aliases', fileName: 'group_aliases.parquet' },
  { viewName: 'venue_name_histories', fileName: 'venue_name_histories.parquet', detail: true },
  {
    viewName: 'search_aliases',
    fileName: 'search_aliases.parquet',
    optional: true,
    emptyTableSql:
      'CREATE OR REPLACE TABLE search_aliases(searchAliasId BIGINT, entityType TEXT, entityId BIGINT, fieldName TEXT, alias TEXT, aliasSearchKey TEXT, source TEXT, confidence DOUBLE, status TEXT);',
  },
  { viewName: 'member_profiles', fileName: 'member_profiles.parquet', detail: true },
  { viewName: 'member_colors', fileName: 'member_colors.parquet' },
  { viewName: 'member_search_index', fileName: 'member_search_index.parquet' },
  { viewName: 'release_notes', fileName: 'release_notes.parquet', core: true },
  { viewName: 'release_db_changes', fileName: 'release_db_changes.parquet', core: true },
] as const

const CORE_TABLE_DEFINITIONS = TABLE_DEFINITIONS.filter(({ core }) => core)
const DETAIL_TABLE_DEFINITIONS = TABLE_DEFINITIONS.filter(({ detail }) => detail)
const BACKGROUND_TABLE_DEFINITIONS = TABLE_DEFINITIONS.filter(
  ({ core, detail }) => !core && !detail,
)
// Core → detail → background so home and detail pages unlock as early as possible.
const PREFETCH_ORDERED_DEFINITIONS = [
  ...CORE_TABLE_DEFINITIONS,
  ...DETAIL_TABLE_DEFINITIONS,
  ...BACKGROUND_TABLE_DEFINITIONS,
]

export const PARQUET_TABLE_FILE_COUNT = TABLE_DEFINITIONS.length
const SNAPSHOT_REQUIRED_TABLES = TABLE_DEFINITIONS.map(({ viewName }) => viewName)

const escapeSqlLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`

const getPerfNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const isDbLoadDebugEnabled = (): boolean => {
  const isDev = Boolean(import.meta.env.DEV)
  if (isDev) return true
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(DB_LOAD_DEBUG_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const debugDbLoad = (label: string, startedAt: number, extra?: Record<string, unknown>) => {
  if (!isDbLoadDebugEnabled()) return
  const elapsedMs = Math.round(getPerfNow() - startedAt)
  console.debug('[setlistSearchDb] loadSearchTables', {
    label,
    elapsedMs,
    ...extra,
  })
}

const hasRelationColumn = async (
  conn: AsyncDuckDBConnection,
  relationName: string,
  columnName: string,
): Promise<boolean> => {
  const result = await conn.query(`
    SELECT COUNT(*) AS cnt
    FROM pragma_table_info('${relationName}')
    WHERE lower(name) = lower('${columnName}')
  `)
  const row = result.toArray()[0] as Record<string, unknown> | undefined
  return Number(row?.cnt ?? 0) > 0
}

const ensureSnapshotMetaTable = async (conn: AsyncDuckDBConnection): Promise<void> => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ${SNAPSHOT_META_TABLE} (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}

const readSnapshotMeta = async (
  conn: AsyncDuckDBConnection,
): Promise<Record<string, string>> => {
  await ensureSnapshotMetaTable(conn)
  const result = await conn.query(`
    SELECT CAST(key AS TEXT) AS key, CAST(value AS TEXT) AS value
    FROM ${SNAPSHOT_META_TABLE}
  `)
  const out: Record<string, string> = {}
  for (const row of result.toArray() as Array<Record<string, unknown>>) {
    const key = typeof row.key === 'string' ? row.key : null
    const value = typeof row.value === 'string' ? row.value : null
    if (key && value !== null) {
      out[key] = value
    }
  }
  return out
}

const writeSnapshotMeta = async (
  conn: AsyncDuckDBConnection,
  values: Record<string, string>,
): Promise<void> => {
  await ensureSnapshotMetaTable(conn)
  const entries = Object.entries(values)
  if (entries.length === 0) {
    return
  }
  const sql = entries
    .map(
      ([key, value]) =>
        `INSERT OR REPLACE INTO ${SNAPSHOT_META_TABLE}(key, value) VALUES (${escapeSqlLiteral(
          key,
        )}, ${escapeSqlLiteral(value)});`,
    )
    .join('\n')
  await conn.query(sql)
}

const relationExists = async (
  conn: AsyncDuckDBConnection,
  relationName: string,
): Promise<boolean> => {
  const result = await conn.query(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE lower(table_name) = lower('${relationName}')
      AND lower(table_schema) = 'main'
  `)
  const row = result.toArray()[0] as Record<string, unknown> | undefined
  return Number(row?.cnt ?? 0) > 0
}

const hasAllSnapshotTables = async (conn: AsyncDuckDBConnection): Promise<boolean> => {
  const checks = await Promise.all(
    SNAPSHOT_REQUIRED_TABLES.map((tableName) => relationExists(conn, tableName)),
  )
  return checks.every(Boolean)
}

const dropSnapshotTables = async (conn: AsyncDuckDBConnection): Promise<void> => {
  const sql = SNAPSHOT_REQUIRED_TABLES.map((tableName) => `DROP TABLE IF EXISTS ${tableName};`).join(
    '\n',
  )
  await conn.query(sql)
}

const syncCacheWithRelease = async (baseUrl: string, forceCheck: boolean): Promise<void> => {
  const now = Date.now()
  if (!forceCheck && now - getLastReleaseCheckedAt() < getReleaseCheckIntervalMs()) {
    return
  }

  try {
    const cacheBustToken = forceCheck ? String(Date.now()) : undefined
    const timeoutMs = forceCheck ? undefined : RELEASE_CHECK_TIMEOUT_MS
    const { signature, generatedAt, fileSizes } = await resolveReleaseMetadata(
      baseUrl,
      cacheBustToken,
      timeoutMs,
    )
    if (generatedAt) {
      setStoredParquetGeneratedAt(generatedAt)
    }
    if (fileSizes) {
      setStoredParquetFileSizes(fileSizes)
    }
    if (!signature) {
      setLastReleaseCheckedAt(now)
      return
    }
    const stored = getStoredSignature()
    if (stored && stored !== signature) {
      await clearParquetCache()
      setStoredSignature(signature)
    } else if (!stored) {
      // Storage may be unavailable in some environments. Avoid repeated cache wipe
      // when we cannot persist signature and continue with best-effort reuse.
      setStoredSignature(signature)
    }
    setLastReleaseCheckedAt(now)
  } catch {
    // If release signature check fails, keep existing cache and continue.
  }
}

export type ParquetPrefetch = {
  forceNetwork: boolean
  ready: Promise<void>
  getBytes: (fileName: string) => Promise<Uint8Array> | undefined
}

let activeParquetPrefetch: ParquetPrefetch | null = null

// Starts downloading parquet assets in parallel with DuckDB WASM initialization.
// Skips downloading when the OPFS snapshot is very likely reusable.
// Safe to call multiple times; returns the same in-flight prefetch.
export const startParquetPrefetch = (): ParquetPrefetch => {
  if (activeParquetPrefetch) {
    return activeParquetPrefetch
  }
  const baseUrl = window.location.origin
  const forceNetwork = consumeForceRefreshFlag()
  const byteMap = new Map<string, Promise<Uint8Array>>()

  const ready = (async () => {
    await syncCacheWithRelease(baseUrl, forceNetwork)
    if (!forceNetwork) {
      const expectedSignature = getStoredSignature()
      const snapshotSignature = getStoredSnapshotSignature()
      if (expectedSignature && snapshotSignature === expectedSignature) {
        return
      }
    }
    const cacheBustToken = forceNetwork ? String(Date.now()) : undefined
    const limit = createTaskLimiter(getParquetFetchConcurrency())
    for (const definition of PREFETCH_ORDERED_DEFINITIONS) {
      const assetUrl = getTableAssetUrl(baseUrl, definition.fileName)
      const requestUrl = withCacheBust(assetUrl, cacheBustToken)
      const promise = limit(() => fetchParquetWithCache(requestUrl, forceNetwork, assetUrl))
      // Errors are surfaced when the table loader consumes the promise.
      promise.catch(() => {})
      byteMap.set(definition.fileName, promise)
    }
  })()
  ready.catch(() => {})

  activeParquetPrefetch = {
    forceNetwork,
    ready,
    getBytes: (fileName) => byteMap.get(fileName),
  }
  return activeParquetPrefetch
}

type ProgressTracker = {
  start: () => void
  advance: (fileName: string) => void
  done: () => void
}

const createProgressTracker = (
  onProgress: LoadSearchTablesOptions['onProgress'],
): ProgressTracker => {
  const totalFiles = TABLE_DEFINITIONS.length
  const sizes = getStoredParquetFileSizes()
  let totalBytes: number | null = null
  if (sizes) {
    let sum = 0
    let allKnown = true
    for (const definition of TABLE_DEFINITIONS) {
      const size = sizes[definition.fileName]
      if (typeof size !== 'number') {
        allKnown = false
        break
      }
      sum += size
    }
    totalBytes = allKnown ? sum : null
  }

  let loadedFiles = 0
  let loadedBytes = 0
  const byteFields = (): Pick<ParquetLoadProgress, 'loadedBytes' | 'totalBytes'> =>
    totalBytes !== null ? { loadedBytes, totalBytes } : {}

  return {
    start: () => {
      onProgress?.({ phase: 'start', loadedFiles: 0, totalFiles, ...byteFields() })
    },
    advance: (fileName: string) => {
      loadedFiles += 1
      if (totalBytes !== null && sizes) {
        loadedBytes += sizes[fileName] ?? 0
      }
      onProgress?.({
        phase: 'loading',
        loadedFiles,
        totalFiles,
        fileName,
        ...byteFields(),
      })
    },
    done: () => {
      loadedFiles = totalFiles
      if (totalBytes !== null) {
        loadedBytes = totalBytes
      }
      onProgress?.({ phase: 'done', loadedFiles: totalFiles, totalFiles, ...byteFields() })
    },
  }
}

const registerAndCreateTables = async (
  conn: AsyncDuckDBConnection,
  db: AsyncDuckDB,
  baseUrl: string,
  forceNetwork: boolean,
  definitions: readonly TableDefinition[],
  tracker: ProgressTracker,
  getPrefetchedBytes?: ParquetPrefetch['getBytes'],
) => {
  const concurrency = getParquetFetchConcurrency()
  const cacheBustToken = forceNetwork ? String(Date.now()) : undefined

  const loadedTables = await mapWithConcurrency(
    definitions,
    concurrency,
    async (definition) => {
      const assetUrl = getTableAssetUrl(baseUrl, definition.fileName)
      const requestUrl = withCacheBust(assetUrl, cacheBustToken)
      let virtualFilePath: string | null = null
      try {
        let bytes: Uint8Array
        const prefetched = getPrefetchedBytes?.(definition.fileName)
        if (prefetched) {
          try {
            bytes = await prefetched
          } catch {
            bytes = await fetchParquetWithCache(requestUrl, forceNetwork, assetUrl)
          }
        } else {
          bytes = await fetchParquetWithCache(requestUrl, forceNetwork, assetUrl)
        }
        virtualFilePath = `cache/parquet/${definition.fileName}`
        await db.registerFileBuffer(virtualFilePath, bytes)
      } catch (error) {
        if (!definition.optional) {
          throw error
        }
      }
      tracker.advance(definition.fileName)
      return { ...definition, virtualFilePath }
    },
  )

  const createTableSql = loadedTables
    .map(
      ({ viewName, virtualFilePath, emptyTableSql }) =>
        virtualFilePath
          ? `CREATE OR REPLACE TABLE ${viewName} AS SELECT * FROM read_parquet('${virtualFilePath}');`
          : emptyTableSql,
    )
    .filter((sql): sql is string => Boolean(sql))
    .join('\n')

  await conn.query(createTableSql)
}

const tryReuseSnapshotTables = async (
  conn: AsyncDuckDBConnection,
  expectedSignature: string | null,
  onProgress?: LoadSearchTablesOptions['onProgress'],
): Promise<boolean> => {
  const meta = await readSnapshotMeta(conn)
  if (meta.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    return false
  }
  const snapshotSignature = meta.parquetSignature ?? null
  // If release signature cannot be resolved in current environment (timeout/storage),
  // still allow local snapshot reuse to avoid repeated full parquet downloads.
  if (expectedSignature && snapshotSignature && snapshotSignature !== expectedSignature) {
    return false
  }
  if (expectedSignature && !snapshotSignature) {
    return false
  }
  if (!(await hasAllSnapshotTables(conn))) {
    return false
  }
  const hasYoutubeId = await hasRelationColumn(conn, 'song_versions', 'youtubeId')
  if (!hasYoutubeId) {
    return false
  }

  if (meta.parquetGeneratedAt) {
    setStoredParquetGeneratedAt(meta.parquetGeneratedAt)
  }
  onProgress?.({
    phase: 'start',
    loadedFiles: SNAPSHOT_REQUIRED_TABLES.length,
    totalFiles: SNAPSHOT_REQUIRED_TABLES.length,
  })
  onProgress?.({
    phase: 'done',
    loadedFiles: SNAPSHOT_REQUIRED_TABLES.length,
    totalFiles: SNAPSHOT_REQUIRED_TABLES.length,
  })
  return true
}

export const loadSearchTables = async (
  conn: AsyncDuckDBConnection,
  db: AsyncDuckDB,
  options?: LoadSearchTablesOptions,
): Promise<void> => {
  const startedAt = getPerfNow()
  const baseUrl = window.location.origin
  const prefetch = options?.prefetch
  const forceNetwork = prefetch ? prefetch.forceNetwork : consumeForceRefreshFlag()
  const onProgress = options?.onProgress
  const persistentStorage = options?.persistentStorage ?? false
  let coreAnnounced = false
  let detailAnnounced = false
  const announceCoreReady = () => {
    if (coreAnnounced) return
    coreAnnounced = true
    options?.onCoreReady?.()
  }
  const announceDetailReady = () => {
    if (detailAnnounced) return
    detailAnnounced = true
    options?.onDetailReady?.()
  }

  if (prefetch) {
    // The prefetch already performed the release check before fetching.
    await prefetch.ready
  } else {
    await syncCacheWithRelease(baseUrl, forceNetwork)
  }
  debugDbLoad('release-check', startedAt, { forceNetwork })

  const expectedSignature = getStoredSignature()
  if (!forceNetwork) {
    try {
      const reused = await tryReuseSnapshotTables(conn, expectedSignature, onProgress)
      if (reused) {
        if (persistentStorage && expectedSignature) {
          setStoredSnapshotSignature(expectedSignature)
        }
        await refreshTableSchemaCache(conn)
        announceCoreReady()
        announceDetailReady()
        debugDbLoad('snapshot-reused', startedAt, { expectedSignature })
        return
      }
    } catch {
      // Snapshot reuse failure should not block regular parquet loading.
    }
  }

  await dropSnapshotTables(conn)

  const loadAllTables = async (
    force: boolean,
    getPrefetchedBytes?: ParquetPrefetch['getBytes'],
  ) => {
    const tracker = createProgressTracker(onProgress)
    tracker.start()
    await registerAndCreateTables(
      conn,
      db,
      baseUrl,
      force,
      CORE_TABLE_DEFINITIONS,
      tracker,
      getPrefetchedBytes,
    )
    announceCoreReady()
    await registerAndCreateTables(
      conn,
      db,
      baseUrl,
      force,
      DETAIL_TABLE_DEFINITIONS,
      tracker,
      getPrefetchedBytes,
    )
    await refreshTableSchemaCache(conn)
    announceDetailReady()
    await registerAndCreateTables(
      conn,
      db,
      baseUrl,
      force,
      BACKGROUND_TABLE_DEFINITIONS,
      tracker,
      getPrefetchedBytes,
    )
    await refreshTableSchemaCache(conn)
    tracker.done()
  }

  await loadAllTables(forceNetwork, prefetch?.getBytes)
  debugDbLoad('parquet-loaded', startedAt, { forceNetwork })

  // Recover automatically from stale cached parquet (older schema without youtubeId).
  let tableSignature = expectedSignature
  if (!forceNetwork) {
    const hasYoutubeId = await hasRelationColumn(conn, 'song_versions', 'youtubeId')
    if (!hasYoutubeId) {
      await clearParquetCache()
      await dropSnapshotTables(conn)
      await loadAllTables(true)
      tableSignature = getStoredSignature()
      debugDbLoad('parquet-reloaded-for-schema', startedAt)
    }
  }

  const generatedAt = getStoredParquetGeneratedAt()
  await writeSnapshotMeta(conn, {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    ...(tableSignature ? { parquetSignature: tableSignature } : {}),
    ...(generatedAt ? { parquetGeneratedAt: generatedAt } : {}),
  })
  if (persistentStorage && tableSignature) {
    setStoredSnapshotSignature(tableSignature)
  } else {
    clearStoredSnapshotSignature()
  }
  debugDbLoad('snapshot-meta-written', startedAt, { tableSignature, generatedAt })
}

export const clearParquetCache = async (): Promise<void> => {
  activeParquetPrefetch = null
  if (typeof window !== 'undefined' && 'caches' in window) {
    await caches.delete(PARQUET_CACHE_NAME)
    const cacheKeys = await caches.keys()
    const parquetUrls = TABLE_DEFINITIONS.map(({ fileName }) =>
      getTableAssetUrl(window.location.origin, fileName),
    )
    parquetUrls.push(`${window.location.origin}/data/parquet/manifest.json`)

    await Promise.all(
      cacheKeys.map(async (cacheName) => {
        // Runtime caches managed by service worker can keep stale parquet payloads.
        if (cacheName.startsWith('runtime-tomoko-pwa-')) {
          await caches.delete(cacheName)
          return
        }
        const cache = await caches.open(cacheName)
        await Promise.all(parquetUrls.map((url) => cache.delete(url)))
      }),
    )
  }
  clearStoredSignature()
  clearStoredParquetGeneratedAt()
  clearStoredSnapshotSignature()
  clearStoredParquetFileSizes()
  setLastReleaseCheckedAt(0)
}
