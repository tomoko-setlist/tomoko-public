import { parseDateTimeUtc, parseYmd } from "./date/standards"

const JST_TIME_ZONE = "Asia/Tokyo"

const jstDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: JST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const jstTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: JST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const normalizeText = (value: string | null | undefined): string => {
  if (!value) return ""
  const text = value.trim()
  if (!text) return ""
  const lowered = text.toLowerCase()
  if (lowered === "null" || lowered === "undefined") return ""
  return text
}

const tryParseUtcLikeDate = (text: string): Date | null => {
  return parseDateTimeUtc(text)
}

export const parseTags = (eventTagsJson: string): string[] => {
  const normalized = normalizeText(eventTagsJson)
  if (!normalized || normalized.toLowerCase() === "null" || normalized === "[]") {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(eventTagsJson)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

export const categoryLabel = (category: number): string => {
  const categories: Record<number, string> = {
    10: "シングル",
    20: "アルバム",
    30: "デジタル",
    40: "ミニアルバム",
    50: "ベストアルバム",
    60: "サウンドトラック",
  }
  return categories[category] ?? "その他"
}

export const formatTimeHm = (value: string | null | undefined): string => {
  const text = normalizeText(value)
  if (!text) return "-"

  const basicTime = text.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/)
  if (basicTime) {
    return `${basicTime[1].padStart(2, "0")}:${basicTime[2]}`
  }

  const parsed = tryParseUtcLikeDate(text)
  if (parsed) {
    return jstTimeFormatter.format(parsed)
  }

  return text.length >= 5 && text.charAt(2) === ":" ? text.slice(0, 5) : text
}

export const formatDateYmd = (value: string | null | undefined): string => {
  const text = normalizeText(value)
  if (!text) return "-"

  const strictDate = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (strictDate) {
    const [, year, month, day] = strictDate
    const ymd = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    if (parseYmd(ymd)) return ymd.replace(/-/g, "/")
  }

  const parsed = tryParseUtcLikeDate(text)
  if (parsed) {
    return jstDateFormatter.format(parsed)
  }

  const matched = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (matched) {
    const [, year, month, day] = matched
    return `${year}/${month.padStart(2, "0")}/${day.padStart(2, "0")}`
  }

  return text
}

export const formatTopRank = (
  rank: number | null | undefined,
  topPercent: number | null | undefined,
): string => {
  if (rank === null || rank === undefined || !Number.isFinite(rank)) {
    return "-"
  }
  const roundedPercent =
    topPercent === null || topPercent === undefined || !Number.isFinite(topPercent)
      ? null
      : Math.max(0.1, Math.min(100, Math.round(topPercent * 10) / 10))
  return roundedPercent === null ? `${Math.round(rank)}位` : `${Math.round(rank)}位 (上位${roundedPercent}%)`
}

export const rankToneClass = (rank: number | null | undefined): string => {
  if (rank === null || rank === undefined || !Number.isFinite(rank)) {
    return "text-slate-800"
  }
  const safeRank = Math.max(1, Math.round(rank))
  if (safeRank <= 5) return "text-rose-700"
  if (safeRank <= 9) return "text-amber-700"
  if (safeRank <= 99) return "text-sky-700"
  return "text-slate-800"
}

export const formatDateRangeYmd = (
  from: string | null | undefined,
  to: string | null | undefined,
  separator = "〜",
): string => {
  const fromLabel = formatDateYmd(from)
  const toLabel = formatDateYmd(to)
  const hasFrom = fromLabel !== "-"
  const hasTo = toLabel !== "-"

  if (!hasFrom && !hasTo) return "-"
  if (hasFrom && hasTo) {
    if (fromLabel === toLabel) return fromLabel
    return `${fromLabel} ${separator} ${toLabel}`
  }
  return hasFrom ? fromLabel : toLabel
}
