import * as duckdb from '@duckdb/duckdb-wasm'

export type DuckDbContext = {
  conn: duckdb.AsyncDuckDBConnection
  db: duckdb.AsyncDuckDB
  worker: Worker
  // True when the database file lives in OPFS and survives reloads.
  persistent: boolean
}

export type DuckDbLoadProgress = {
  phase: 'start' | 'loading' | 'done'
  loadedFiles: number
  totalFiles: number
  fileName?: string
}

type InitDuckDbOptions = {
  onProgress?: (progress: DuckDbLoadProgress) => void
}

const resolveBundleBase = (): string | null => {
  const envValue = (import.meta as ImportMeta & {
    env?: { VITE_DUCKDB_WASM_BASE_URL?: string }
  }).env?.VITE_DUCKDB_WASM_BASE_URL
  if (typeof envValue !== 'string') return null
  const trimmed = envValue.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

const buildCustomBundles = (base: string): duckdb.DuckDBBundles => {
  return {
    mvp: {
      mainModule: `${base}/duckdb-mvp.wasm`,
      mainWorker: `${base}/duckdb-browser-mvp.worker.js`,
    },
    eh: {
      mainModule: `${base}/duckdb-eh.wasm`,
      mainWorker: `${base}/duckdb-browser-eh.worker.js`,
    },
  }
}

type BundleCandidate = {
  label: string
  bundles: duckdb.DuckDBBundles
  probe?: boolean
}

const buildBundleCandidates = (): BundleCandidate[] => {
  const envBase = resolveBundleBase()
  const candidates: BundleCandidate[] = []

  if (envBase) {
    candidates.push({
      label: `env:${envBase}`,
      bundles: buildCustomBundles(envBase),
      probe: true,
    })
  }

  candidates.push({
    label: 'jsdelivr',
    bundles: duckdb.getJsDelivrBundles(),
  })

  return candidates
}

const BUNDLE_CANDIDATES = buildBundleCandidates()

const getDuckDbDownloadTargets = (bundle: duckdb.DuckDBBundle): string[] => {
  const values = [bundle.mainWorker, bundle.mainModule, bundle.pthreadWorker]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
  return [...new Set(values)]
}

const toAssetFileName = (url: string): string => {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://example.com')
    const segment = parsed.pathname.split('/').filter(Boolean).at(-1)
    return segment ? decodeURIComponent(segment) : url
  } catch {
    return url
  }
}

const addHeadHint = (
  selector: string,
  create: () => HTMLLinkElement,
): void => {
  if (typeof document === 'undefined') return
  if (document.head.querySelector(selector)) return
  document.head.appendChild(create())
}

const hintDuckDbAssets = (bundle: duckdb.DuckDBBundle): void => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return
  }
  const origins = new Set<string>()
  for (const url of [bundle.mainModule, bundle.mainWorker, bundle.pthreadWorker]) {
    if (!url) continue
    try {
      origins.add(new URL(url, window.location.href).origin)
    } catch {
      // ignore invalid URL
    }
  }
  origins.forEach((origin) => {
    addHeadHint(`link[data-duckdb-preconnect="${origin}"]`, () => {
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = origin
      link.crossOrigin = 'anonymous'
      link.setAttribute('data-duckdb-preconnect', origin)
      return link
    })
  })
}

const createWorkerFromBundle = (
  bundle: duckdb.DuckDBBundle,
): { worker: Worker; cleanup: () => void } => {
  const workerUrl = bundle.mainWorker
  if (!workerUrl) {
    throw new Error('DuckDB worker URL is not available')
  }

  const blobUrl = URL.createObjectURL(
    new Blob([`importScripts("${workerUrl}");`], { type: 'text/javascript' }),
  )
  return {
    worker: new Worker(blobUrl),
    cleanup: () => {
      URL.revokeObjectURL(blobUrl)
    },
  }
}

const PROBE_TIMEOUT_MS = 2000

const probeAssetAvailability = async (url: string): Promise<boolean> => {
  if (typeof fetch === 'undefined') return false
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeoutId = controller ? setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS) : null
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller?.signal })
    if (!response.ok) return false
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    return !contentType.includes('text/html')
  } catch {
    return false
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
  }
}

const instantiateBundle = async (bundle: duckdb.DuckDBBundle): Promise<DuckDbContext> => {
  if (!bundle.mainWorker || !bundle.mainModule) {
    throw new Error('Failed to select a valid DuckDB WASM bundle')
  }

  const { worker, cleanup } = createWorkerFromBundle(bundle)
  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    cleanup()
    let persistent = false
    try {
      await db.open({
        path: 'opfs://tomoko_search.duckdb',
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
        opfs: { fileHandling: 'auto' },
      })
      persistent = true
    } catch {
      await db.open({})
    }
    const conn = await db.connect()
    return { conn, db, worker, persistent }
  } catch (error) {
    cleanup()
    try {
      await db.terminate()
    } catch {
      // ignore cleanup errors
    }
    worker.terminate()
    throw error
  }
}

export const initDuckDb = async (options?: InitDuckDbOptions): Promise<DuckDbContext> => {
  let lastError: unknown = null

  for (const candidate of BUNDLE_CANDIDATES) {
    try {
      const selectedBundle = await duckdb.selectBundle(candidate.bundles)
      if (candidate.probe && selectedBundle.mainWorker) {
        const available = await probeAssetAvailability(selectedBundle.mainWorker)
        if (!available) {
          throw new Error('bundle assets unavailable (probe failed)')
        }
      }
      hintDuckDbAssets(selectedBundle)
      const downloadTargets = getDuckDbDownloadTargets(selectedBundle)
      const progressTotal = Math.max(1, downloadTargets.length)
      const firstTarget = downloadTargets[0]
      if (firstTarget) {
        options?.onProgress?.({
          phase: 'start',
          loadedFiles: 0,
          totalFiles: progressTotal,
          fileName: toAssetFileName(firstTarget),
        })
        options?.onProgress?.({
          phase: 'loading',
          loadedFiles: 1,
          totalFiles: progressTotal,
          fileName: toAssetFileName(firstTarget),
        })
      } else {
        options?.onProgress?.({
          phase: 'start',
          loadedFiles: 0,
          totalFiles: progressTotal,
        })
      }
      const context = await instantiateBundle(selectedBundle)
      const lastTarget = downloadTargets[downloadTargets.length - 1]
      const finalFileName = lastTarget ? toAssetFileName(lastTarget) : undefined
      options?.onProgress?.({
        phase: 'loading',
        loadedFiles: progressTotal,
        totalFiles: progressTotal,
        ...(finalFileName ? { fileName: finalFileName } : {}),
      })
      options?.onProgress?.({
        phase: 'done',
        loadedFiles: progressTotal,
        totalFiles: progressTotal,
        ...(finalFileName ? { fileName: finalFileName } : {}),
      })
      return context
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[duckdb] Failed to initialize bundle candidate "${candidate.label}": ${message}`)
    }
  }

  throw new Error(
    `Failed to initialize DuckDB bundle (${lastError instanceof Error ? lastError.message : String(lastError)})`,
  )
}
