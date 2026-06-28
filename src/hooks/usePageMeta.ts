import { useEffect, useMemo } from "react";

import { buildPageMeta } from "../lib/pageMeta";

import type { AppRoute } from "../lib/appRoute";

const ensureMetaByName = (name: string): HTMLMetaElement => {
    const selector = `meta[name="${name}"]`;
    const existing = document.head.querySelector(selector);
    if (existing instanceof HTMLMetaElement) return existing;
    const node = document.createElement("meta");
    node.setAttribute("name", name);
    document.head.appendChild(node);
    return node;
};

const ensureMetaByProperty = (property: string): HTMLMetaElement => {
    const selector = `meta[property="${property}"]`;
    const existing = document.head.querySelector(selector);
    if (existing instanceof HTMLMetaElement) return existing;
    const node = document.createElement("meta");
    node.setAttribute("property", property);
    document.head.appendChild(node);
    return node;
};

const ensureCanonicalLink = (): HTMLLinkElement => {
    const selector = `link[rel="canonical"]`;
    const existing = document.head.querySelector(selector);
    if (existing instanceof HTMLLinkElement) return existing;
    const node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
    return node;
};

export function usePageMeta({
    route,
    routeTitles,
}: {
    route: AppRoute;
    routeTitles: Record<string, string>;
}) {
    const meta = useMemo(() => {
        if (typeof window === "undefined") return null;
        return buildPageMeta({
            route,
            routeTitles,
            origin: window.location.origin,
        });
    }, [route, routeTitles]);

    useEffect(() => {
        if (!meta || typeof document === "undefined") return;

        document.title = meta.title;

        ensureMetaByName("description").setAttribute("content", meta.description);
        ensureMetaByName("robots").setAttribute("content", meta.robots);

        ensureMetaByProperty("og:type").setAttribute("content", meta.ogType);
        ensureMetaByProperty("og:title").setAttribute("content", meta.title);
        ensureMetaByProperty("og:description").setAttribute("content", meta.description);
        ensureMetaByProperty("og:url").setAttribute("content", meta.canonicalUrl);

        ensureMetaByName("twitter:title").setAttribute("content", meta.title);
        ensureMetaByName("twitter:description").setAttribute("content", meta.description);

        ensureCanonicalLink().setAttribute("href", meta.canonicalUrl);
    }, [meta]);
}
