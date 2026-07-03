import { withSecurityHeaders } from "./_shared/security";

const PAGES_DEV_HOST = "tomoko-duc.pages.dev";
const PRIMARY_HOST = "hp-setlist.com";
const CACHE_RECOVERY_VERSION = "20260702v3";

const RELOAD_JS = `(function(){var k="tomoko-duc-recovered-${CACHE_RECOVERY_VERSION}";try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1")}catch(e){}var jobs=[];if("caches"in window){jobs.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(n){return caches.delete(n)}))}))}if("serviceWorker"in navigator){jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}))}Promise.allSettled(jobs).then(function(){location.replace("/?nocache="+Date.now())},function(){location.replace("/?nocache="+Date.now())})})();`;

export const onRequest: PagesFunction = async (context) => {
    const url = new URL(context.request.url);
    const host = url.hostname.toLowerCase();

    if (host === PAGES_DEV_HOST) {
        const redirectUrl = new URL(url.pathname + url.search, `https://${PRIMARY_HOST}`);
        return withSecurityHeaders(
            Response.redirect(redirectUrl.toString(), 308),
            context.request,
        );
    }

    const upstreamResponse = await context.next();
    const response = new Response(upstreamResponse.body, upstreamResponse);
    const contentType = (response.headers.get("content-type") || "").toLowerCase();

    if (url.pathname === "/sw.js") {
        response.headers.set(
            "Cache-Control",
            "no-cache, no-store, must-revalidate",
        );
    }

    // HTML responses: prevent caching so clients always get fresh index.html
    if (contentType.includes("text/html")) {
        // Missing asset request got SPA fallback HTML
        // → serve JS redirect (for .js) or empty CSS (for .css) instead
        if (url.pathname.startsWith("/assets/")) {
            if (url.pathname.endsWith(".js")) {
                return withSecurityHeaders(
                    new Response(RELOAD_JS, {
                        status: 200,
                        headers: {
                            "content-type": "application/javascript; charset=utf-8",
                            "cache-control": "no-store",
                        },
                    }),
                    context.request,
                );
            }
            if (url.pathname.endsWith(".css")) {
                return withSecurityHeaders(
                    new Response("", {
                        status: 200,
                        headers: {
                            "content-type": "text/css; charset=utf-8",
                            "cache-control": "no-store",
                        },
                    }),
                    context.request,
                );
            }
        }

        response.headers.set(
            "Cache-Control",
            "no-cache, no-store, must-revalidate",
        );
    }

    return withSecurityHeaders(response, context.request);
};
