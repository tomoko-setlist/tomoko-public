import { useCallback, useEffect, useRef, useState } from "react";

import {
    buildPathRoute,
    buildRouteKey,
    parseLegacyHashLocation,
    parseLocationRoute,
    parseQueryRoute,
    stripLegacyRouteParams,
    type AppRoute,
} from "../lib/appRoute";

const FALLBACK_ROUTE: AppRoute = { name: "home" };

export function useAppRoute() {
    const readRoute = useCallback(
        () => parseLocationRoute(window.location.pathname, window.location.search),
        [],
    );
    const normalizeLegacyRoute = useCallback((): AppRoute => {
        const legacyHash = parseLegacyHashLocation(window.location.hash);
        if (legacyHash) {
            const path = buildPathRoute(legacyHash.route);
            const query = legacyHash.query ? `?${legacyHash.query}` : "";
            window.history.replaceState(null, "", `${path}${query}`);
            return legacyHash.route;
        }

        const queryRoute = parseQueryRoute(window.location.search);
        if (queryRoute) {
            const path = buildPathRoute(queryRoute);
            const query = stripLegacyRouteParams(window.location.search);
            window.history.replaceState(null, "", `${path}${query}`);
            return queryRoute;
        }

        return readRoute();
    }, [readRoute]);

    const [route, setRoute] = useState<AppRoute>(() =>
        typeof window === "undefined" ? FALLBACK_ROUTE : normalizeLegacyRoute(),
    );
    const [history, setHistory] = useState<AppRoute[]>([]);
    const routeRef = useRef<AppRoute>(route);
    const pendingHistoryRef = useRef<AppRoute[] | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const onPopState = () => {
            setRoute(readRoute());
        };
        window.addEventListener("popstate", onPopState);
        return () => {
            window.removeEventListener("popstate", onPopState);
        };
    }, [readRoute]);

    useEffect(() => {
        const prev = routeRef.current;
        if (buildRouteKey(prev) !== buildRouteKey(route)) {
            const pendingHistory = pendingHistoryRef.current;
            if (pendingHistory) {
                setHistory(pendingHistory.slice(-12));
                pendingHistoryRef.current = null;
            } else {
                setHistory((current) => [...current, prev].slice(-12));
            }
        }
        routeRef.current = route;
    }, [route]);

    const navigate = useCallback((next: AppRoute) => {
        if (typeof window === "undefined") {
            return;
        }
        const targetPath = buildPathRoute(next);
        const current = routeRef.current;
        if (buildRouteKey(current) === buildRouteKey(next)) {
            window.history.replaceState(null, "", targetPath);
        } else {
            window.history.pushState(null, "", targetPath);
        }
        setRoute(next);
    }, []);

    const navigateWithHistoryOverride = useCallback(
        (next: AppRoute, nextHistory: AppRoute[]) => {
            if (typeof window === "undefined") {
                return;
            }
            pendingHistoryRef.current = nextHistory;
            const targetPath = buildPathRoute(next);
            const current = routeRef.current;
            if (buildRouteKey(current) === buildRouteKey(next)) {
                window.history.replaceState(null, "", targetPath);
            } else {
                window.history.pushState(null, "", targetPath);
            }
            setRoute(next);
        },
        [],
    );

    const goBack = useCallback(
        (steps = 1, fallback: AppRoute = FALLBACK_ROUTE) => {
            const count = Math.max(1, steps);
            const targetIndex = history.length - count;
            const target = targetIndex >= 0 ? history[targetIndex] : null;
            if (target) {
                navigateWithHistoryOverride(target, history.slice(0, targetIndex));
                return;
            }
            navigateWithHistoryOverride(fallback, []);
        },
        [history, navigateWithHistoryOverride],
    );

    const navigateToHistoryRoute = useCallback(
        (target: AppRoute, fallback: AppRoute = FALLBACK_ROUTE) => {
            const targetKey = buildRouteKey(target);
            let targetIndex = -1;
            for (let index = history.length - 1; index >= 0; index -= 1) {
                if (buildRouteKey(history[index]) === targetKey) {
                    targetIndex = index;
                    break;
                }
            }
            if (targetIndex >= 0) {
                navigateWithHistoryOverride(target, history.slice(0, targetIndex));
                return;
            }
            navigateWithHistoryOverride(fallback, []);
        },
        [history, navigateWithHistoryOverride],
    );

    return {
        route,
        history,
        navigate,
        goBack,
        navigateToHistoryRoute,
    };
}
