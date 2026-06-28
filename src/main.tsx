import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App'
import {
  clearSearchRouteQueryIfNeeded,
  consumeClientReleaseChange,
} from './lib/releaseBootstrap'
import {
  clearPersistedSearchStates,
  clearSearchResultCaches,
} from './lib/searchResultCache'
import { requestParquetForceRefresh, startParquetPrefetch } from './lib/setlistSearchDb/loadCsvTables'

if (typeof window !== 'undefined') {
  startParquetPrefetch()
}

if (
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.location.protocol === 'http:' &&
  window.location.hostname === 'localhost'
) {
  const redirectedUrl = new URL(window.location.href)
  redirectedUrl.hostname = '127.0.0.1'
  window.location.replace(redirectedUrl.toString())
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  clearSearchResultCaches()
  clearPersistedSearchStates()
  requestParquetForceRefresh()
}

if (typeof window !== 'undefined' && consumeClientReleaseChange()) {
  clearSearchResultCaches()
  clearPersistedSearchStates()
  requestParquetForceRefresh()
  clearSearchRouteQueryIfNeeded()
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("service worker registration failed", error)
    })
  })
}
