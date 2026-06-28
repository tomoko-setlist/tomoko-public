import { useEffect, useState } from "react";

import type {
    AlbumDetail,
    SetlistDetail,
    SetlistSearchDb,
    SongDetail,
    SongTopPercentiles,
    SongVersionDetail,
} from "../../../lib/setlistSearchDb/types";

const SONG_SETLIST_PREVIEW_LIMIT = 400;

type SongDetailState = {
    loading: boolean;
    error: string;
    song: SongDetail | null;
    setlists: SetlistDetail[];
    versions: SongVersionDetail[];
    albums: AlbumDetail[];
    topPercentiles: SongTopPercentiles | null;
    loadingExtras: boolean;
};

export function useSongDetail(db: SetlistSearchDb, songId: number): SongDetailState {
    const [loading, setLoading] = useState(true);
    const [loadingExtras, setLoadingExtras] = useState(false);
    const [error, setError] = useState("");
    const [song, setSong] = useState<SongDetail | null>(null);
    const [setlists, setSetlists] = useState<SetlistDetail[]>([]);
    const [versions, setVersions] = useState<SongVersionDetail[]>([]);
    const [albums, setAlbums] = useState<AlbumDetail[]>([]);
    const [topPercentiles, setTopPercentiles] = useState<SongTopPercentiles | null>(null);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setLoadingExtras(false);
            setError("");
            try {
                const [songResult, setlistRows] = await Promise.all([
                    db.getSongDetail(songId),
                    db.getSongSetlists(songId, SONG_SETLIST_PREVIEW_LIMIT),
                ]);
                if (!songResult) {
                    if (!cancelled) {
                        setSong(null);
                        setSetlists([]);
                        setVersions([]);
                        setAlbums([]);
                        setTopPercentiles(null);
                    }
                    return;
                }
                if (!cancelled) {
                    setSong(songResult);
                    setSetlists(setlistRows);
                    setLoading(false);
                    setLoadingExtras(true);
                }

                const dbCompat = db as Partial<SetlistSearchDb>;
                const versionsPromise =
                    typeof dbCompat.getSongVersions === "function"
                        ? dbCompat.getSongVersions(songId)
                        : Promise.resolve<SongVersionDetail[]>([]);
                const topPercentilesPromise =
                    typeof dbCompat.getSongTopPercentiles === "function"
                        ? dbCompat.getSongTopPercentiles(songId)
                        : Promise.resolve<SongTopPercentiles | null>(null);
                const [albumRows, versionRows, percentileRows] = await Promise.all([
                    db.getAlbumsBySong(songId),
                    versionsPromise,
                    topPercentilesPromise,
                ]);
                if (!cancelled) {
                    setAlbums(albumRows);
                    setVersions(versionRows);
                    setTopPercentiles(percentileRows);
                }
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : String(e));
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setLoadingExtras(false);
                }
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db, songId]);

    return { loading, error, song, setlists, versions, albums, topPercentiles, loadingExtras };
}
