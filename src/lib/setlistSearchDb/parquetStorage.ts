export const PARQUET_CACHE_NAME = 'tomoko-duc-parquet-cache-v1'
const PARQUET_RELEASE_SIGNATURE_KEY = 'tomoko-duc-parquet-release-signature-v1'
const PARQUET_FORCE_REFRESH_KEY = 'tomoko-duc-parquet-force-refresh-v1'
const PARQUET_RELEASE_CHECKED_AT_KEY = 'tomoko-duc-parquet-release-checked-at-v1'
const PARQUET_GENERATED_AT_KEY = 'tomoko-duc-parquet-generated-at-v1'
const OPFS_SNAPSHOT_SIGNATURE_KEY = 'tomoko-duc-opfs-snapshot-signature-v1'
const PARQUET_FILE_SIZES_KEY = 'tomoko-duc-parquet-file-sizes-v1'
export const RELEASE_CHECK_INTERVAL_MS = 30 * 60 * 1000

let volatileReleaseSignature: string | null = null

export const getCache = async (): Promise<Cache | null> => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return null
  }
  return caches.open(PARQUET_CACHE_NAME)
}

export const getStoredSignature = (): string | null => {
  try {
    const stored = localStorage.getItem(PARQUET_RELEASE_SIGNATURE_KEY)
    if (stored) {
      volatileReleaseSignature = stored
    }
    return stored ?? volatileReleaseSignature
  } catch {
    return volatileReleaseSignature
  }
}

export const setStoredSignature = (signature: string): void => {
  volatileReleaseSignature = signature
  try {
    localStorage.setItem(PARQUET_RELEASE_SIGNATURE_KEY, signature)
  } catch {
    // ignore storage errors
  }
}

export const clearStoredSignature = (): void => {
  volatileReleaseSignature = null
  try {
    localStorage.removeItem(PARQUET_RELEASE_SIGNATURE_KEY)
  } catch {
    // ignore storage errors
  }
}

export const getStoredParquetGeneratedAt = (): string | null => {
  try {
    return localStorage.getItem(PARQUET_GENERATED_AT_KEY)
  } catch {
    return null
  }
}

export const setStoredParquetGeneratedAt = (value: string): void => {
  try {
    localStorage.setItem(PARQUET_GENERATED_AT_KEY, value)
  } catch {
    // ignore storage errors
  }
}

export const clearStoredParquetGeneratedAt = (): void => {
  try {
    localStorage.removeItem(PARQUET_GENERATED_AT_KEY)
  } catch {
    // ignore storage errors
  }
}

// Mirrors the OPFS snapshot signature in localStorage so we can predict snapshot
// reuse before DuckDB finishes initializing (used to decide whether to prefetch).
export const getStoredSnapshotSignature = (): string | null => {
  try {
    return localStorage.getItem(OPFS_SNAPSHOT_SIGNATURE_KEY)
  } catch {
    return null
  }
}

export const setStoredSnapshotSignature = (signature: string): void => {
  try {
    localStorage.setItem(OPFS_SNAPSHOT_SIGNATURE_KEY, signature)
  } catch {
    // ignore storage errors
  }
}

export const clearStoredSnapshotSignature = (): void => {
  try {
    localStorage.removeItem(OPFS_SNAPSHOT_SIGNATURE_KEY)
  } catch {
    // ignore storage errors
  }
}

export type ParquetFileSizeMap = Record<string, number>

export const getStoredParquetFileSizes = (): ParquetFileSizeMap | null => {
  try {
    const raw = localStorage.getItem(PARQUET_FILE_SIZES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const out: ParquetFileSizeMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        out[key] = value
      }
    }
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}

export const setStoredParquetFileSizes = (sizes: ParquetFileSizeMap): void => {
  try {
    localStorage.setItem(PARQUET_FILE_SIZES_KEY, JSON.stringify(sizes))
  } catch {
    // ignore storage errors
  }
}

export const clearStoredParquetFileSizes = (): void => {
  try {
    localStorage.removeItem(PARQUET_FILE_SIZES_KEY)
  } catch {
    // ignore storage errors
  }
}

export const getForceRefreshFlag = (): boolean => {
  try {
    return localStorage.getItem(PARQUET_FORCE_REFRESH_KEY) === '1'
  } catch {
    return false
  }
}

export const consumeForceRefreshFlag = (): boolean => {
  const enabled = getForceRefreshFlag()
  if (enabled) {
    try {
      localStorage.removeItem(PARQUET_FORCE_REFRESH_KEY)
    } catch {
      // ignore storage errors
    }
  }
  return enabled
}

export const requestParquetForceRefresh = (): void => {
  try {
    localStorage.setItem(PARQUET_FORCE_REFRESH_KEY, '1')
  } catch {
    // ignore storage errors
  }
}

export const getLastReleaseCheckedAt = (): number => {
  try {
    const raw = localStorage.getItem(PARQUET_RELEASE_CHECKED_AT_KEY)
    if (!raw) return 0
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

export const setLastReleaseCheckedAt = (value: number): void => {
  try {
    localStorage.setItem(PARQUET_RELEASE_CHECKED_AT_KEY, String(value))
  } catch {
    // ignore storage errors
  }
}

export const getReleaseCheckIntervalMs = (): number => {
  if (typeof window === 'undefined') return RELEASE_CHECK_INTERVAL_MS
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return 0
  }
  return RELEASE_CHECK_INTERVAL_MS
}
