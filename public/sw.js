const CACHE_VERSION = "tomoko-pwa-v8";
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const DUCKDB_RUNTIME_CACHE = `duckdb-runtime-${CACHE_VERSION}`;
const APP_SHELL_URLS = ["/site.webmanifest", "/icon.svg"];

const isNoStoreResponse = (response) =>
  (response.headers.get("cache-control") || "").toLowerCase().includes("no-store");

const isCacheableResponse = (response, allowedTypes = ["basic"]) =>
  response &&
  response.status === 200 &&
  allowedTypes.includes(response.type) &&
  !isNoStoreResponse(response);

const shouldBypassHttpCache = (url) =>
  url.origin === self.location.origin &&
  (url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/assets/"));

const fetchFreshWhenNeeded = (request, url) =>
  shouldBypassHttpCache(url) ? fetch(request, { cache: "no-store" }) : fetch(request);

const isDuckDbRuntimeAsset = (url) => {
  if (url.hostname === "cdn.jsdelivr.net") {
    return (
      url.pathname.includes("/@duckdb/duckdb-wasm@") &&
      (url.pathname.endsWith("/duckdb-eh.wasm") ||
        url.pathname.endsWith("/duckdb-mvp.wasm") ||
        url.pathname.endsWith("/duckdb-browser-eh.worker.js") ||
        url.pathname.endsWith("/duckdb-browser-mvp.worker.js"))
    );
  }
  if (url.hostname === "extensions.duckdb.org") {
    return url.pathname.endsWith("/parquet.duckdb_extension.wasm");
  }
  return false;
};

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (isCacheableResponse(response, ["basic", "cors"])) {
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== APP_SHELL_CACHE &&
                key !== RUNTIME_CACHE &&
                key !== DUCKDB_RUNTIME_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  const url = new URL(event.request.url);

  if (isDuckDbRuntimeAsset(url)) {
    event.respondWith(cacheFirst(event.request, DUCKDB_RUNTIME_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  // Parquet assets are updated frequently. Always fetch fresh and skip SW cache.
  if (url.pathname.startsWith("/data/parquet/")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (isCacheableResponse(response)) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || caches.match("/");
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetchFreshWhenNeeded(event.request, url).then((response) => {
        if (isCacheableResponse(response)) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    }),
  );
});
