import { useEffect, useState } from "react"

import type { PerformerSummaryRow, SetlistDetail, SetlistSearchDb, StageDetail } from "../../../lib/setlistSearchDb/types"

type StageDetailState = {
  loading: boolean
  error: string
  stage: StageDetail | null
  setlists: SetlistDetail[]
  performers: PerformerSummaryRow[]
}

export function useStageDetail(db: SetlistSearchDb, stageId: number): StageDetailState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [stage, setStage] = useState<StageDetail | null>(null)
  const [setlists, setSetlists] = useState<SetlistDetail[]>([])
  const [performers, setPerformers] = useState<PerformerSummaryRow[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError("")
      try {
        await db.whenDetailReady
        const [stageResult, rows, performerRows] = await Promise.all([
          db.getStageDetail(stageId),
          db.getStageSetlists(stageId),
          db.getStagePerformers(stageId),
        ])
        if (!cancelled) {
          setStage(stageResult)
          setSetlists(rows)
          setPerformers(performerRows)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [db, stageId])

  return { loading, error, stage, setlists, performers }
}
