import { useEffect, useState } from "react"

import type { CreatorDetail, CreatorSongRow, SetlistSearchDb } from "../../../lib/setlistSearchDb/types"

type CreatorDetailState = {
  loading: boolean
  error: string
  detail: CreatorDetail | null
  lyricistSongs: CreatorSongRow[]
  composerSongs: CreatorSongRow[]
  arrangerSongs: CreatorSongRow[]
}

export function useCreatorDetail(db: SetlistSearchDb, creatorId: number): CreatorDetailState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState<CreatorDetail | null>(null)
  const [lyricistSongs, setLyricistSongs] = useState<CreatorSongRow[]>([])
  const [composerSongs, setComposerSongs] = useState<CreatorSongRow[]>([])
  const [arrangerSongs, setArrangerSongs] = useState<CreatorSongRow[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError("")
      try {
        const [detailResult, lyricRows, composeRows, arrangeRows] = await Promise.all([
          db.getCreatorDetail(creatorId),
          db.getCreatorSongsByRole(creatorId, "lyricist", 300),
          db.getCreatorSongsByRole(creatorId, "composer", 300),
          db.getCreatorSongsByRole(creatorId, "arranger", 300),
        ])
        if (!cancelled) {
          setDetail(detailResult)
          setLyricistSongs(lyricRows)
          setComposerSongs(composeRows)
          setArrangerSongs(arrangeRows)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [db, creatorId])

  return { loading, error, detail, lyricistSongs, composerSongs, arrangerSongs }
}
