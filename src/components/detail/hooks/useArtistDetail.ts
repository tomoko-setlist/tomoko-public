import { useEffect, useState } from "react";

import type { AlbumDetail, ArtistDetail, SetlistSearchDb, SongSearchRow } from "../../../lib/setlistSearchDb/types";

type ArtistDetailState = {
    loading: boolean;
    error: string;
    detail: ArtistDetail | null;
    songs: SongSearchRow[];
    albums: AlbumDetail[];
};

export function useArtistDetail(db: SetlistSearchDb, artistId: number): ArtistDetailState {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [detail, setDetail] = useState<ArtistDetail | null>(null);
    const [songs, setSongs] = useState<SongSearchRow[]>([]);
    const [albums, setAlbums] = useState<AlbumDetail[]>([]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError("");
            try {
                const [detailResult, songRows, albumRows] = await Promise.all([
                    db.getArtistDetail(artistId),
                    db.getArtistSongs(artistId, 200),
                    db.getArtistAlbums(artistId, 200),
                ]);
                if (!cancelled) {
                    setDetail(detailResult);
                    setSongs(songRows);
                    setAlbums(albumRows);
                }
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [artistId, db]);

    return { loading, error, detail, songs, albums };
}
