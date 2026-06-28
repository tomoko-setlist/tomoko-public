import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, normalizePageSize, PAGE_SIZE_OPTIONS } from './constants/searchDefaults'
import { STORAGE_FLAG_OFF, STORAGE_FLAG_ON } from './constants/stateFlags'
import {
  type AdvancedConditionField,
  type AdvancedConditionGroup,
  type AdvancedConditionValue,
  DEFAULT_FIELD_SEARCH_METHODS,
  type FieldSearchMethods,
  type SearchDateMode,
  type SearchMethod,
  type SearchUnit,
  type SortBy,
  type SortOrder,
} from './setlistSearchDb/types'

export type SearchMode = 'simple' | 'advanced'

export type PersistedState = {
  searchUnit: SearchUnit
  groupByEvent: boolean
  groupByEventSong: boolean
  searchMode: SearchMode
  query: string
  normalizedPerformerKeys: string
  normalizedPerformerSelections?: Array<{ key: string; label: string }>
  conditionGroups?: AdvancedConditionGroup[]
  conditionTopLevelJoin?: 'and' | 'or'
  personName: string
  songName: string
  artistName: string
  lyricistName: string
  composerName: string
  arrangerName: string
  eventName: string
  venueName: string
  eventTag: string
  sectionName: string
  prefectureIds: string
  fieldSearchMethods: FieldSearchMethods
  dateMode: SearchDateMode
  dateFrom: string
  dateTo: string
  sortBy: SortBy
  sortOrder: SortOrder
  page: number
  pageSize: number
  formCollapsed: boolean
  hasSearched: boolean
}

export const STORAGE_KEY = 'tomoko-duc.search-ui.v2'

export const DEFAULT_STATE: PersistedState = {
  searchUnit: 'setlist',
  groupByEvent: true,
  groupByEventSong: false,
  searchMode: 'advanced',
  query: '',
  normalizedPerformerKeys: '',
  personName: '',
  songName: '',
  artistName: '',
  lyricistName: '',
  composerName: '',
  arrangerName: '',
  eventName: '',
  venueName: '',
  eventTag: '',
  sectionName: '',
  prefectureIds: '',
  fieldSearchMethods: DEFAULT_FIELD_SEARCH_METHODS,
  dateMode: 'year',
  dateFrom: '',
  dateTo: '',
  sortBy: 'date',
  sortOrder: 'desc',
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
  formCollapsed: true,
  hasSearched: false,
  conditionTopLevelJoin: 'and',
}

const SEARCH_UNITS: SearchUnit[] = ['stage', 'setlist']
const SORT_BY_OPTIONS: SortBy[] = ['date', 'event', 'venue', 'title', 'performer', 'artist', 'startTime']
const SORT_ORDER_OPTIONS: SortOrder[] = ['asc', 'desc']
const DATE_MODE_CODES: Array<readonly [SearchDateMode, string]> = [
  ['year', 'y'],
  ['date', 'd'],
]
const DATE_MODE_TO_CODE = new Map<SearchDateMode, string>(DATE_MODE_CODES)
const CODE_TO_DATE_MODE = new Map<string, SearchDateMode>(
  DATE_MODE_CODES.map(([mode, code]) => [code, mode]),
)

const isSearchUnit = (value: string | null): value is SearchUnit =>
  value !== null && SEARCH_UNITS.includes(value as SearchUnit)

const isSortBy = (value: string | null): value is SortBy =>
  value !== null && SORT_BY_OPTIONS.includes(value as SortBy)

const isSortOrder = (value: string | null): value is SortOrder =>
  value !== null && SORT_ORDER_OPTIONS.includes(value as SortOrder)

const isSearchDateMode = (value: unknown): value is SearchDateMode =>
  value === 'year' || value === 'date'

const ALLOWED_CONDITION_FIELDS = new Set([
  'songName',
  'personName',
  'artistName',
  'lyricistName',
  'composerName',
  'arrangerName',
  'eventName',
  'venueName',
  'sectionName',
  'eventTag',
  'prefectureId',
])
const CONDITION_FIELD_CODES: Array<readonly [AdvancedConditionField, string]> = [
  ['songName', 's'],
  ['personName', 'p'],
  ['artistName', 'a'],
  ['lyricistName', 'l'],
  ['composerName', 'c'],
  ['arrangerName', 'r'],
  ['eventName', 'e'],
  ['venueName', 'v'],
  ['sectionName', 'x'],
  ['eventTag', 't'],
  ['prefectureId', 'pr'],
]
const FIELD_TO_CODE = new Map<AdvancedConditionField, string>(CONDITION_FIELD_CODES)
const CODE_TO_FIELD = new Map<string, AdvancedConditionField>(
  CONDITION_FIELD_CODES.map(([field, code]) => [code, field]),
)
const CONDITION_METHOD_CODES: Array<readonly [SearchMethod, string]> = [
  ['contains', 'c'],
  ['notContains', 'nc'],
  ['exact', 'e'],
  ['notExact', 'ne'],
  ['startsWith', 'sw'],
  ['endsWith', 'ew'],
]
const METHOD_TO_CODE = new Map<SearchMethod, string>(CONDITION_METHOD_CODES)
const CODE_TO_METHOD = new Map<string, SearchMethod>(
  CONDITION_METHOD_CODES.map(([method, code]) => [code, method]),
)

type CompactConditionRow = [string, string, string]
type CompactConditionGroup = [string, string, CompactConditionRow[]]
type CompactConditionPayload = [string, CompactConditionGroup[]]

const encodeBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const decodeBase64Url = (value: string): string => {
  const padded = `${value.replaceAll('-', '+').replaceAll('_', '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const encodeJoin = (value: 'and' | 'or' | undefined): string => value === 'or' ? 'o' : ''
const decodeJoin = (value: unknown): 'and' | 'or' => value === 'o' ? 'or' : 'and'

const parseConditionGroups = (raw: unknown): AdvancedConditionGroup[] | undefined => {
  if (!Array.isArray(raw)) return undefined
  const groups = raw
    .map((group, groupIndex): AdvancedConditionGroup | null => {
      if (!group || typeof group !== 'object') return null
      const g = group as Record<string, unknown>
      if (typeof g.id !== 'string' || typeof g.field !== 'string' || !ALLOWED_CONDITION_FIELDS.has(g.field)) {
        return null
      }
      if (!Array.isArray(g.values)) return null
      const values = g.values
        .map((value, valueIndex) => {
          if (!value || typeof value !== 'object') return null
          const v = value as Record<string, unknown>
          if (typeof v.value !== 'string' || typeof v.method !== 'string') return null
          const field = typeof v.field === 'string' && ALLOWED_CONDITION_FIELDS.has(v.field) ? v.field : g.field
          return {
            id: typeof v.id === 'string' ? v.id : `pv_${groupIndex}_${valueIndex}`,
            field: field as AdvancedConditionField,
            value: v.value,
            method: v.method as FieldSearchMethods[keyof FieldSearchMethods],
          }
        })
        .filter((value): value is AdvancedConditionValue => value !== null)
      if (values.length === 0) return null
      return {
        id: g.id,
        field: g.field as AdvancedConditionField,
        joinWithPrev: g.joinWithPrev === 'or' ? 'or' : 'and',
        conditionJoin: g.conditionJoin === 'or' ? 'or' : 'and',
        values,
      }
    })
    .filter((group): group is AdvancedConditionGroup => group !== null)
  return groups.length > 0 ? groups : undefined
}

const encodeConditionState = (
  conditionGroups: AdvancedConditionGroup[] | undefined,
  conditionTopLevelJoin: 'and' | 'or' | undefined,
): string => {
  const groups: CompactConditionGroup[] = (conditionGroups ?? [])
    .map((group) => {
      const rows = group.values
        .map((value): CompactConditionRow | null => {
          const field = FIELD_TO_CODE.get(value.field ?? group.field)
          const method = METHOD_TO_CODE.get(value.method)
          const text = value.value.trim()
          if (!field || !method || text.length === 0) return null
          return [field, method, text]
        })
        .filter((value): value is CompactConditionRow => value !== null)
      if (rows.length === 0) return null
      return [encodeJoin(group.joinWithPrev), encodeJoin(group.conditionJoin), rows] satisfies CompactConditionGroup
    })
    .filter((group): group is CompactConditionGroup => group !== null)

  if (groups.length === 0) return ''
  return encodeBase64Url(JSON.stringify([encodeJoin(conditionTopLevelJoin), groups] satisfies CompactConditionPayload))
}

const decodeConditionState = (
  raw: string | null,
): Pick<PersistedState, 'conditionGroups' | 'conditionTopLevelJoin'> | undefined => {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(decodeBase64Url(raw)) as unknown
    if (!Array.isArray(parsed) || parsed.length < 2 || !Array.isArray(parsed[1])) return undefined
    const groups = parsed[1]
      .map((group, groupIndex): AdvancedConditionGroup | null => {
        if (!Array.isArray(group) || group.length < 3 || !Array.isArray(group[2])) return null
        const values = group[2]
          .map((row, rowIndex): AdvancedConditionValue | null => {
            if (!Array.isArray(row) || row.length < 3) return null
            const field = typeof row[0] === 'string' ? CODE_TO_FIELD.get(row[0]) : undefined
            const method = typeof row[1] === 'string' ? CODE_TO_METHOD.get(row[1]) : undefined
            const value = typeof row[2] === 'string' ? row[2].trim() : ''
            if (!field || !method || value.length === 0) return null
            return {
              id: `cu_${groupIndex}_${rowIndex}`,
              field,
              method,
              value,
            }
          })
          .filter((row): row is AdvancedConditionValue => row !== null)
        if (values.length === 0) return null
        return {
          id: `cg_${groupIndex}`,
          field: values[0].field,
          joinWithPrev: decodeJoin(group[0]),
          conditionJoin: decodeJoin(group[1]),
          values,
        }
      })
      .filter((group): group is AdvancedConditionGroup => group !== null)
    if (groups.length === 0) return undefined
    return {
      conditionGroups: groups,
      conditionTopLevelJoin: decodeJoin(parsed[0]),
    }
  } catch {
    return undefined
  }
}

export const loadPersistedState = (): PersistedState => {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return DEFAULT_STATE
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      ...DEFAULT_STATE,
      ...parsed,
      normalizedPerformerSelections: Array.isArray(parsed.normalizedPerformerSelections)
        ? parsed.normalizedPerformerSelections
            .filter(
              (
                item,
              ): item is {
                key: string
                label: string
              } =>
                Boolean(
                  item &&
                    typeof item === 'object' &&
                    typeof item.key === 'string' &&
                    typeof item.label === 'string',
                ),
            )
        : undefined,
      conditionGroups: parseConditionGroups(parsed.conditionGroups),
      conditionTopLevelJoin: parsed.conditionTopLevelJoin === 'or' ? 'or' : 'and',
      dateMode: isSearchDateMode(parsed.dateMode) ? parsed.dateMode : DEFAULT_STATE.dateMode,
      searchUnit: SEARCH_UNITS.includes(parsed.searchUnit as SearchUnit)
        ? (parsed.searchUnit as SearchUnit)
        : DEFAULT_STATE.searchUnit,
      fieldSearchMethods: {
        ...DEFAULT_STATE.fieldSearchMethods,
        ...(parsed.fieldSearchMethods ?? {}),
      },
      page:
        parsed.page && Number.isFinite(parsed.page) && parsed.page > 0
          ? Math.floor(parsed.page)
          : DEFAULT_PAGE,
      pageSize:
        parsed.pageSize &&
        Number.isFinite(parsed.pageSize)
          ? normalizePageSize(parsed.pageSize)
          : DEFAULT_STATE.pageSize,
    }
  } catch {
    return DEFAULT_STATE
  }
}

export const loadStateFromUrl = (): Partial<PersistedState> => {
  if (typeof window === 'undefined') {
    return {}
  }

  const rawSearch = window.location.search.startsWith('?')
    ? window.location.search.slice(1)
    : window.location.search
  const params = new URLSearchParams(rawSearch)
  const get = (canonicalKey: string, ...legacyKeys: string[]): string | null => {
    const canonicalValue = params.get(canonicalKey)
    if (canonicalValue !== null) return canonicalValue
    for (const key of legacyKeys) {
      const value = params.get(key)
      if (value !== null) return value
    }
    return null
  }
  const legacyKeys = (shortKey: string): string[] => [
    `s_${shortKey}`,
    `m_${shortKey}`,
  ]
  const next: Partial<PersistedState> = {}
  const unit = get('u', ...legacyKeys('u'))
  if (isSearchUnit(unit)) {
    next.searchUnit = unit
  }

  const query = get('query', ...legacyKeys('q'))
  if (query !== null) {
    next.query = query
  }
  const personName = get('personName', ...legacyKeys('pn'))
  if (personName !== null) {
    next.personName = personName
  }

  const normalizedPerformerKeys = get('normalizedPerformerKeys', ...legacyKeys('npk'))
  if (normalizedPerformerKeys !== null) {
    next.normalizedPerformerKeys = normalizedPerformerKeys
  }

  const songName = get('songName', ...legacyKeys('sn'))
  if (songName !== null) {
    next.songName = songName
  }

  const artistName = get('artistName', ...legacyKeys('an'))
  if (artistName !== null) {
    next.artistName = artistName
  }

  const lyricistName = get('lyricistName', ...legacyKeys('ln'))
  if (lyricistName !== null) {
    next.lyricistName = lyricistName
  }

  const composerName = get('composerName', ...legacyKeys('cn'))
  if (composerName !== null) {
    next.composerName = composerName
  }

  const arrangerName = get('arrangerName', ...legacyKeys('rn'))
  if (arrangerName !== null) {
    next.arrangerName = arrangerName
  }

  const eventName = get('eventName', ...legacyKeys('en'))
  if (eventName !== null) {
    next.eventName = eventName
  }

  const venueName = get('venueName', ...legacyKeys('vn'))
  if (venueName !== null) {
    next.venueName = venueName
  }

  const eventTag = get('eventTag', ...legacyKeys('et'))
  if (eventTag !== null) {
    next.eventTag = eventTag
  }

  const dateFrom = get('dateFrom', ...legacyKeys('df'))
  if (dateFrom !== null) {
    next.dateFrom = dateFrom
  }

  const dateTo = get('dateTo', ...legacyKeys('dt'))
  if (dateTo !== null) {
    next.dateTo = dateTo
  }
  const hasDateModeParam = params.has('dm') || legacyKeys('dm').some((key) => params.has(key))
  const dateMode = CODE_TO_DATE_MODE.get(get('dm', ...legacyKeys('dm')) ?? '')
  if (dateMode) {
    next.dateMode = dateMode
  } else if (!hasDateModeParam && (dateFrom !== null || dateTo !== null)) {
    next.dateMode = DEFAULT_STATE.dateMode
  }

  const sectionName = get('sectionName', ...legacyKeys('xn'))
  if (sectionName !== null) {
    next.sectionName = sectionName
  }

  const prefectureIds = get('prefectureIds', ...legacyKeys('pf'))
  if (prefectureIds !== null) {
    next.prefectureIds = prefectureIds
  }

  const sortBy = get('sb', ...legacyKeys('sb'))
  if (isSortBy(sortBy)) {
    next.sortBy = sortBy
  }

  const sortOrder = get('so', ...legacyKeys('so'))
  if (isSortOrder(sortOrder)) {
    next.sortOrder = sortOrder
  }

  const page = Number(get('p', ...legacyKeys('p')))
  if (Number.isFinite(page) && page > 0) {
    next.page = Math.floor(page)
  }
  const pageSize = Math.floor(Number(get('ps', ...legacyKeys('ps'))))
  if (PAGE_SIZE_OPTIONS.includes(pageSize as (typeof PAGE_SIZE_OPTIONS)[number])) {
    next.pageSize = pageSize
  }
  const groupByEventSong = get('ges', ...legacyKeys('ges'))
  if (groupByEventSong === STORAGE_FLAG_ON) {
    next.groupByEventSong = true
  } else if (groupByEventSong === STORAGE_FLAG_OFF) {
    next.groupByEventSong = false
  }

  const conditionState = decodeConditionState(get('c', ...legacyKeys('c')))
  if (conditionState) {
    next.conditionGroups = conditionState.conditionGroups
    next.conditionTopLevelJoin = conditionState.conditionTopLevelJoin
  }

  return next
}

export const buildUrl = (state: PersistedState): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  const params = new URLSearchParams()
  params.set('u', state.searchUnit)
  if (state.query) {
    params.set('query', state.query)
  }
  if (state.personName) {
    params.set('personName', state.personName)
  }
  if (state.normalizedPerformerKeys) {
    params.set('normalizedPerformerKeys', state.normalizedPerformerKeys)
  }
  if (state.songName) {
    params.set('songName', state.songName)
  }
  if (state.artistName) {
    params.set('artistName', state.artistName)
  }
  if (state.lyricistName) {
    params.set('lyricistName', state.lyricistName)
  }
  if (state.composerName) {
    params.set('composerName', state.composerName)
  }
  if (state.arrangerName) {
    params.set('arrangerName', state.arrangerName)
  }
  if (state.eventName) {
    params.set('eventName', state.eventName)
  }
  if (state.venueName) {
    params.set('venueName', state.venueName)
  }
  if (state.eventTag) {
    params.set('eventTag', state.eventTag)
  }
  if (state.sectionName) {
    params.set('sectionName', state.sectionName)
  }
  if (state.prefectureIds) {
    params.set('prefectureIds', state.prefectureIds)
  }
  if (state.dateFrom) {
    params.set('dateFrom', state.dateFrom)
  }
  if (state.dateTo) {
    params.set('dateTo', state.dateTo)
  }
  params.set('dm', DATE_MODE_TO_CODE.get(state.dateMode) ?? DATE_MODE_TO_CODE.get(DEFAULT_STATE.dateMode) ?? 'y')
  if (state.sortBy !== DEFAULT_STATE.sortBy) {
    params.set('sb', state.sortBy)
  }
  if (state.sortOrder !== DEFAULT_STATE.sortOrder) {
    params.set('so', state.sortOrder)
  }
  if (state.page !== DEFAULT_STATE.page) {
    params.set('p', String(state.page))
  }
  if (state.pageSize !== DEFAULT_STATE.pageSize) {
    params.set('ps', String(state.pageSize))
  }
  if (state.groupByEventSong !== DEFAULT_STATE.groupByEventSong) {
    params.set('ges', state.groupByEventSong ? STORAGE_FLAG_ON : STORAGE_FLAG_OFF)
  }
  const encodedConditions = encodeConditionState(state.conditionGroups, state.conditionTopLevelJoin)
  if (encodedConditions) {
    params.set('c', encodedConditions)
  }
  const nextQuery = params.toString()
  return `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
}
