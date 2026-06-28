import { getCache } from './parquetStorage'

const PARQUET_FETCH_TIMEOUT_MS = 45_000
const PARQUET_FETCH_RETRY_COUNT = 1
// HTTP/2 multiplexes parquet fetches over a single connection, so a higher
// concurrency mostly removes request serialization latency.
const PARQUET_FETCH_CONCURRENCY = 8
const RELEASE_CHECK_TIMEOUT_MS = 2500

export const getTableAssetUrl = (baseUrl: string, fileName: string): string =>
  `${baseUrl}/data/parquet/${fileName}`

export const withCacheBust = (url: string, token?: string): string => {
  if (!token) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}__ts=${encodeURIComponent(token)}`
}

const looksLikeHtml = (bytes: Uint8Array): boolean => {
  const snippet = new TextDecoder().decode(bytes.slice(0, 256)).toLowerCase()
  return snippet.includes('<html') || snippet.includes('<!doctype html')
}

const isParquetMagicValid = (bytes: Uint8Array): boolean => {
  if (bytes.length < 8) {
    return false
  }
  const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  const tail = String.fromCharCode(
    bytes[bytes.length - 4],
    bytes[bytes.length - 3],
    bytes[bytes.length - 2],
    bytes[bytes.length - 1],
  )
  return head === 'PAR1' && tail === 'PAR1'
}

export const validateParquetPayload = (url: string, contentType: string, bytes: Uint8Array): void => {
  if (contentType.toLowerCase().includes('text/html') || looksLikeHtml(bytes)) {
    throw new Error(
      `Unexpected HTML response for parquet asset: ${url}. ` +
        'Run `npm run data:build:parquet` and deploy with parquet files included.',
    )
  }
  if (!isParquetMagicValid(bytes)) {
    throw new Error(`Invalid parquet file content: ${url} (missing PAR1 magic bytes).`)
  }
}

export const fetchParquetWithCache = async (
  url: string,
  forceNetwork: boolean,
  cacheKey: string = url,
): Promise<Uint8Array> => {
  const cache = await getCache()
  if (!forceNetwork) {
    const cached = await cache?.match(cacheKey)
    if (cached && cached.ok) {
      const contentType = cached.headers.get('content-type') ?? ''
      const bytes = new Uint8Array(await cached.arrayBuffer())
      validateParquetPayload(cacheKey, contentType, bytes)
      return bytes
    }
  }

  const fetchOnce = async (cacheMode: RequestCache): Promise<Uint8Array> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timeoutId =
      controller && PARQUET_FETCH_TIMEOUT_MS > 0
        ? setTimeout(() => controller.abort(), PARQUET_FETCH_TIMEOUT_MS)
        : null
    try {
      const response = await fetch(url, {
        cache: cacheMode,
        signal: controller?.signal,
      })
      if (!response.ok) {
        throw new Error(`Parquet asset not found: ${url} (status ${response.status})`)
      }
      if (cache) {
        await cache.put(cacheKey, response.clone())
      }
      const contentType = response.headers.get('content-type') ?? ''
      const bytes = new Uint8Array(await response.arrayBuffer())
      validateParquetPayload(url, contentType, bytes)
      return bytes
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }

  let lastError: unknown = null
  const retries = Math.max(0, PARQUET_FETCH_RETRY_COUNT)
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const cacheMode: RequestCache =
      forceNetwork || attempt > 0 ? 'no-store' : 'default'
    try {
      return await fetchOnce(cacheMode)
    } catch (error) {
      lastError = error
      if (attempt >= retries) {
        break
      }
    }
  }

  throw new Error(
    `Failed to fetch parquet asset: ${url} (${lastError instanceof Error ? lastError.message : String(lastError)})`,
  )
}

export type ManifestMetadata = {
  signature: string | null
  generatedAt: string | null
  fileSizes: Record<string, number> | null
}

const parseManifestFileSizes = (value: unknown): Record<string, number> | null => {
  if (!Array.isArray(value)) return null
  const sizes: Record<string, number> = {}
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    if (
      typeof record.fileName === 'string' &&
      typeof record.sizeBytes === 'number' &&
      Number.isFinite(record.sizeBytes) &&
      record.sizeBytes > 0
    ) {
      sizes[record.fileName] = record.sizeBytes
    }
  }
  return Object.keys(sizes).length > 0 ? sizes : null
}

export const fetchManifestMetadata = async (
  baseUrl: string,
  cacheBustToken?: string,
  timeoutMs?: number,
): Promise<ManifestMetadata> => {
  const manifestUrl = withCacheBust(`${baseUrl}/data/parquet/manifest.json`, cacheBustToken)
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeoutId =
    controller && typeof timeoutMs === 'number' && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null
  try {
    const response = await fetch(manifestUrl, {
      cache: 'no-store',
      signal: controller?.signal,
    })
    if (!response.ok) {
      return { signature: null, generatedAt: null, fileSizes: null }
    }
    const payload = (await response.json()) as unknown
    if (typeof payload !== 'object' || payload === null) {
      return { signature: JSON.stringify(payload), generatedAt: null, fileSizes: null }
    }
    const record = payload as Record<string, unknown>
    const signature =
      typeof record.signature === 'string' ? record.signature : JSON.stringify(payload)
    const generatedAt = typeof record.generatedAt === 'string' ? record.generatedAt : null
    const fileSizes = parseManifestFileSizes(record.files)
    return { signature, generatedAt, fileSizes }
  } catch {
    return { signature: null, generatedAt: null, fileSizes: null }
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
  }
}

export const resolveReleaseMetadata = async (
  baseUrl: string,
  cacheBustToken?: string,
  timeoutMs?: number,
): Promise<ManifestMetadata> => {
  const metadata = await fetchManifestMetadata(baseUrl, cacheBustToken, timeoutMs)
  if (metadata.signature) {
    return {
      signature: `manifest:${metadata.signature}`,
      generatedAt: metadata.generatedAt,
      fileSizes: metadata.fileSizes,
    }
  }
  return { signature: null, generatedAt: metadata.generatedAt, fileSizes: metadata.fileSizes }
}

export const mapWithConcurrency = async <T, U>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<U>,
): Promise<U[]> => {
  const safeLimit = Math.max(1, Math.min(limit, items.length))
  const results = new Array<U>(items.length)
  let nextIndex = 0

  const run = async () => {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) {
        return
      }
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(new Array(safeLimit).fill(0).map(() => run()))
  return results
}

export const getParquetFetchConcurrency = (): number => {
  if (typeof window === 'undefined') {
    return PARQUET_FETCH_CONCURRENCY
  }
  const nav = window.navigator as Navigator & {
    connection?: {
      saveData?: boolean
      effectiveType?: string
    }
    hardwareConcurrency?: number
  }
  if (nav.connection?.saveData) {
    return 2
  }
  const effectiveType = String(nav.connection?.effectiveType ?? '').toLowerCase()
  if (effectiveType.includes('2g')) {
    return 2
  }
  if (effectiveType.includes('3g')) {
    return 3
  }
  const cores = Number(nav.hardwareConcurrency ?? 0)
  if (Number.isFinite(cores) && cores > 0 && cores <= 4) {
    return Math.min(4, PARQUET_FETCH_CONCURRENCY)
  }
  return PARQUET_FETCH_CONCURRENCY
}

// Limits concurrent executions while letting callers hold per-item promises
// that are created eagerly (unlike mapWithConcurrency).
export const createTaskLimiter = (limit: number): (<T>(task: () => Promise<T>) => Promise<T>) => {
  const safeLimit = Math.max(1, limit)
  let active = 0
  const queue: Array<() => void> = []

  const acquire = (): Promise<void> =>
    new Promise((resolve) => {
      if (active < safeLimit) {
        active += 1
        resolve()
        return
      }
      queue.push(() => {
        active += 1
        resolve()
      })
    })

  const release = (): void => {
    active -= 1
    const next = queue.shift()
    if (next) {
      next()
    }
  }

  return async <T,>(task: () => Promise<T>): Promise<T> => {
    await acquire()
    try {
      return await task()
    } finally {
      release()
    }
  }
}

export { RELEASE_CHECK_TIMEOUT_MS }
