import { useCallback, useEffect, useState } from "react";

import { dispatchDbRefreshedEvent } from "../lib/dbRefreshEvent";
import {
    clearPersistedSearchStates,
    clearSearchResultCaches,
} from "../lib/searchResultCache";
import { createSetlistSearchDb } from "../lib/setlistSearchDb";
import {
    clearParquetCache,
    requestParquetForceRefresh,
} from "../lib/setlistSearchDb/loadCsvTables";

import type { SetlistSearchDb } from "../lib/setlistSearchDb/types";

export type DbStatus = "loading" | "coreReady" | "detailReady" | "ready" | "error";

// True when core tables are queryable (home screen / setlist search usable).
export const isDbStatusUsable = (status: DbStatus): boolean =>
    status === "ready" || status === "coreReady" || status === "detailReady";

// True when detail routes can query event/stage/song/venue tables.
export const isDbDetailUsable = (status: DbStatus): boolean =>
    status === "ready" || status === "detailReady";

export type DbState = {
    status: DbStatus;
    error: string;
    progressLoadedFiles?: number;
    progressTotalFiles?: number;
    progressFileName?: string;
    progressLoadedBytes?: number;
    progressTotalBytes?: number;
};

let sharedDb: SetlistSearchDb | null = null;
let sharedDbPromise: Promise<SetlistSearchDb> | null = null;

const getOrCreateSharedDb = async (options?: {
    onLoadProgress?: (progress: {
        phase: "start" | "loading" | "done";
        loadedFiles: number;
        totalFiles: number;
        fileName?: string;
        loadedBytes?: number;
        totalBytes?: number;
    }) => void;
}): Promise<SetlistSearchDb> => {
    if (sharedDb) {
        return sharedDb;
    }
    if (!sharedDbPromise) {
        sharedDbPromise = createSetlistSearchDb({
            onLoadProgress: options?.onLoadProgress,
        })
            .then((db) => {
                sharedDb = db;
                return db;
            })
            .catch((error) => {
                sharedDbPromise = null;
                throw error;
            });
    }
    return sharedDbPromise;
};

const disposeSharedDb = () => {
    if (sharedDb) {
        sharedDb.close();
    }
    sharedDb = null;
    sharedDbPromise = null;
};

export function useSetlistSearchDb(options: { enabled?: boolean } = {}) {
    const enabled = options.enabled ?? true;
    const [db, setDb] = useState<SetlistSearchDb | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [dbState, setDbState] = useState<DbState>({
        status: "loading",
        error: "",
        progressLoadedFiles: 0,
        progressTotalFiles: 0,
        progressFileName: "",
    });

    const refreshDb = useCallback(async () => {
        setDbState({
            status: "loading",
            error: "",
            progressLoadedFiles: 0,
            progressTotalFiles: 0,
            progressFileName: "",
        });
        setDb(null);
        disposeSharedDb();
        clearSearchResultCaches();
        clearPersistedSearchStates();
        dispatchDbRefreshedEvent();
        requestParquetForceRefresh();
        await clearParquetCache();
        setReloadToken((current) => current + 1);
    }, []);

    useEffect(() => {
        let isCancelled = false;

        if (!enabled) {
            setDb(sharedDb);
            setDbState({
                status: "ready",
                error: "",
                progressLoadedFiles: undefined,
                progressTotalFiles: undefined,
                progressFileName: undefined,
                progressLoadedBytes: undefined,
                progressTotalBytes: undefined,
            });
            return () => {
                isCancelled = true;
            };
        }

        const init = async () => {
            try {
                const searchDb = await getOrCreateSharedDb({
                    onLoadProgress: (progress) => {
                        if (isCancelled) return;
                        setDbState((current) => ({
                            ...current,
                            // Keep coreReady while remaining tables load in background.
                            status:
                                current.status === "coreReady"
                                    ? "coreReady"
                                    : "loading",
                            progressLoadedFiles: progress.loadedFiles,
                            progressTotalFiles: progress.totalFiles,
                            progressFileName:
                                progress.fileName ??
                                current.progressFileName ??
                                "",
                            progressLoadedBytes: progress.loadedBytes,
                            progressTotalBytes: progress.totalBytes,
                        }));
                    },
                });

                if (isCancelled) {
                    return;
                }

                setDb(searchDb);
                setDbState((current) => ({
                    ...current,
                    status: "coreReady",
                    error: "",
                }));
                if (typeof performance !== "undefined" && typeof performance.mark === "function") {
                    performance.mark("tomoko:coreReady");
                    try {
                        performance.measure("tomoko:coreReady", "duckdb:init:start", "tomoko:coreReady");
                    } catch {
                        // ignore missing duckdb start mark
                    }
                }

                await searchDb.whenDetailReady;

                if (!isCancelled) {
                    setDbState((current) => ({
                        ...current,
                        status: "detailReady",
                        error: "",
                    }));
                }

                await searchDb.whenReady;

                if (!isCancelled) {
                    setDbState({
                        status: "ready",
                        error: "",
                        progressLoadedFiles: undefined,
                        progressTotalFiles: undefined,
                        progressFileName: undefined,
                        progressLoadedBytes: undefined,
                        progressTotalBytes: undefined,
                    });
                }
            } catch (error) {
                if (!isCancelled) {
                    setDbState({
                        status: "error",
                        error:
                            error instanceof Error ? error.message : String(error),
                        progressLoadedFiles: undefined,
                        progressTotalFiles: undefined,
                        progressFileName: undefined,
                        progressLoadedBytes: undefined,
                        progressTotalBytes: undefined,
                    });
                }
            }
        };

        void init();

        return () => {
            isCancelled = true;
        };
    }, [enabled, reloadToken]);

    return {
        db,
        dbState,
        refreshDb,
    };
}
