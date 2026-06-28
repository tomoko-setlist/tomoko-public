import { useEffect, useState } from "react"

import type { AlbumDetail, AlbumTrack, SetlistSearchDb } from "../../../lib/setlistSearchDb/types"

type AlbumDetailState = {
  loading: boolean
  error: string
  album: AlbumDetail | null
  tracks: AlbumTrack[]
}

export function useAlbumDetail(db: SetlistSearchDb, albumId: number): AlbumDetailState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [album, setAlbum] = useState<AlbumDetail | null>(null)
  const [tracks, setTracks] = useState<AlbumTrack[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError("")
      try {
        const [albumResult, trackRows] = await Promise.all([
          db.getAlbumDetail(albumId),
          db.getAlbumTracks(albumId),
        ])
        if (!cancelled) {
          setAlbum(albumResult)
          setTracks(trackRows)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [db, albumId])

  return { loading, error, album, tracks }
}
