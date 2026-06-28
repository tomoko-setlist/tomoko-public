import { useEffect, useState } from "react"

import type { ReleaseDbChange, ReleaseNoteDetail, SetlistSearchDb } from "../../../lib/setlistSearchDb/types"

type ReleaseDetailState = {
  loading: boolean
  error: string
  detail: ReleaseNoteDetail | null
  changes: ReleaseDbChange[]
}

export function useReleaseDetail(db: SetlistSearchDb, releaseId: number): ReleaseDetailState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState<ReleaseNoteDetail | null>(null)
  const [changes, setChanges] = useState<ReleaseDbChange[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError("")
      try {
        if (!db.getReleaseNote || !db.getReleaseDbChanges) {
          throw new Error("お知らせ機能はこのデータ版に含まれていません。")
        }
        const [releaseDetail, dbChanges] = await Promise.all([
          db.getReleaseNote(releaseId),
          db.getReleaseDbChanges(releaseId, 500),
        ])
        if (!cancelled) {
          setDetail(releaseDetail)
          setChanges(dbChanges)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [db, releaseId])

  return { loading, error, detail, changes }
}
