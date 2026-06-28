import { useMemo, useState } from "react"

import { parseTags } from "../../../lib/uiFormat"

type WithEventTagsJson = { eventTagsJson?: string | null }

export function useEventTagFilter<T extends WithEventTagsJson>(rows: T[]): {
  selectedTags: string[]
  setSelectedTags: (tags: string[]) => void
  tagOptions: string[]
  filteredRows: T[]
} {
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const tagOptions = useMemo(() => {
    const unique = new Set<string>()
    rows.forEach((row) => {
      parseTags(row.eventTagsJson ?? "[]").forEach((tag) => unique.add(tag))
    })
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ja"))
  }, [rows])

  const filteredRows = useMemo(
    () =>
      selectedTags.length > 0
        ? rows.filter((row) =>
            selectedTags.some((tag) => parseTags(row.eventTagsJson ?? "[]").includes(tag)),
          )
        : rows,
    [rows, selectedTags],
  )

  return { selectedTags, setSelectedTags, tagOptions, filteredRows }
}
