import { useEffect, useRef, useState } from 'react'

import { AutocompleteTextInput } from './AutocompleteTextInput'
import { ConditionExpressionPreview } from './ConditionExpressionPreview'
import { SingleSelectDropdown } from './MultiSelectDropdown'
import { PrefectureSingleSelectDropdown } from './PrefectureSelectDropdowns'
import { SearchDateRangeControl } from './SearchDateRangeControl'
import { SearchDetailActions } from './SearchDetailActions'
import { useScrollVisibility } from '../../hooks/useScrollVisibility'
import { recordSuggestionAnalytics } from '../../lib/searchAnalytics'
import { DEFAULT_FIELD_SEARCH_METHODS } from '../../lib/setlistSearchDb/types'
import { CalendarIcon, ChevronUpIcon, IndentDecreaseIcon, IndentIncreaseIcon, PlusIcon, SelectField, SetlistIcon, XIcon } from '../ui'

import type {
  AdvancedConditionField,
  AdvancedConditionGroup,
  FieldSearchMethods,
  MasterOption,
  SearchDateMode,
  SearchMethod,
  SearchSuggestField,
  SearchSuggestVariant,
  SearchSuggestion,
  SearchUnit,
} from '../../lib/setlistSearchDb/types'
import type { ReactNode } from 'react'

type SearchFormPanelProps = {
  dbReady: boolean
  hasSearched: boolean
  modeLabels: Record<SearchUnit, string>
  searchUnit: SearchUnit
  groupByEventSong: boolean
  query: string
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
  conditionGroups?: AdvancedConditionGroup[]
  conditionTopLevelJoin?: 'and' | 'or'
  prefectureIds: string
  eventTagOptions: MasterOption[]
  prefectureOptions: MasterOption[]
  fieldSearchMethods: FieldSearchMethods
  dateMode: SearchDateMode
  dateFrom: string
  dateTo: string
  formCollapsed: boolean
  statusText: string
  suggestVariant?: SearchSuggestVariant
  onSearchUnitChange: (unit: SearchUnit) => void
  onQueryChange: (value: string) => void
  onGroupByEventSongChange: (value: boolean) => void
  onPersonNameChange: (value: string) => void
  onSongNameChange: (value: string) => void
  onArtistNameChange: (value: string) => void
  onLyricistNameChange: (value: string) => void
  onComposerNameChange: (value: string) => void
  onArrangerNameChange: (value: string) => void
  onEventNameChange: (value: string) => void
  onVenueNameChange: (value: string) => void
  onEventTagChange: (value: string) => void
  onSectionNameChange: (value: string) => void
  onConditionGroupAdd?: (field: AdvancedConditionField) => void
  onConditionTopLevelJoinChange?: (join: 'and' | 'or') => void
  onConditionGroupJoinChange?: (groupId: string, join: 'and' | 'or') => void
  onConditionGroupRemove?: (groupId: string) => void
  onConditionGroupFieldChange?: (groupId: string, field: AdvancedConditionField, rowId?: string) => void
  onConditionValueChange?: (
    groupId: string,
    index: number,
    value: { value?: string; method?: SearchMethod },
  ) => void
  onConditionValueRemove?: (groupId: string, index: number) => void
  onConditionGroupWithPrevious?: (groupIndex: number) => void
  onConditionUngroup?: (groupIndex: number, rowId: string) => void
  onPrefectureIdsChange: (value: string) => void
  onFieldSearchMethodChange: (field: keyof FieldSearchMethods, value: SearchMethod) => void
  onDateModeChange: (mode: SearchDateMode) => void
  onDateRangeChange: (range: { dateFrom: string; dateTo: string }) => void
  onToggleForm: () => void
  onResetFilters: () => void
  onFetchSuggestions: (
    field: SearchSuggestField,
    term: string,
  ) => Promise<SearchSuggestion[]>
}

export function SearchFormPanel({
  dbReady,
  hasSearched,
  modeLabels,
  searchUnit,
  groupByEventSong,
  query,
  personName,
  songName,
  artistName,
  lyricistName,
  composerName,
  arrangerName,
  eventName,
  venueName,
  eventTag,
  sectionName,
  conditionGroups = [],
  conditionTopLevelJoin = 'and',
  prefectureIds,
  eventTagOptions,
  prefectureOptions,
  fieldSearchMethods,
  dateMode,
  dateFrom,
  dateTo,
  formCollapsed,
  statusText,
  suggestVariant = 'A',
  onSearchUnitChange,
  onQueryChange,
  onGroupByEventSongChange,
  onConditionGroupAdd,
  onConditionTopLevelJoinChange,
  onConditionGroupJoinChange,
  onConditionGroupRemove,
  onConditionValueChange,
  onConditionValueRemove,
  onConditionGroupWithPrevious,
  onConditionUngroup,
  onDateModeChange,
  onDateRangeChange,
  onToggleForm,
  onResetFilters,
  onFetchSuggestions,
}: SearchFormPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const conditionButtonsRef = useRef<HTMLDivElement | null>(null)
  const [groupingHelpOpen, setGroupingHelpOpen] = useState(false)
  const [conditionButtonsOverflow, setConditionButtonsOverflow] = useState(false)
  const showEditFloating = useScrollVisibility(
    panelRef,
    !formCollapsed,
    !formCollapsed,
    180,
  )
  const showCloseFloating = !formCollapsed && !showEditFloating

  useEffect(() => {
    const element = conditionButtonsRef.current
    if (!element) return

    const updateOverflow = () => {
      setConditionButtonsOverflow(element.scrollWidth > element.clientWidth + 1)
    }

    updateOverflow()
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateOverflow) : null
    resizeObserver?.observe(element)
    window.addEventListener('resize', updateOverflow)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateOverflow)
    }
  }, [formCollapsed, searchUnit])

  const searchUnitIcons: Record<SearchUnit, ReactNode> = {
    stage: <CalendarIcon className="h-4 w-4" />,
    setlist: <SetlistIcon className="h-4 w-4" />,
  }
  const queryPlaceholder =
    !dbReady
      ? statusText
      : searchUnit === 'stage'
          ? 'イベント名・会場名・タグ・楽曲名・歌唱者'
          : '楽曲名・歌唱者・アーティスト・イベント名'
  const groupingHelpText =
    '同じイベント（ツアー）タイトルでセトリが同じ公演が複数あった場合、検索結果を１件に集約して表示します。'
  const querySuggestEnabled = dbReady
  const detailSuggestEnabled = dbReady
  const conditionFieldOptions: Array<{ value: AdvancedConditionField; label: string }> = [
    { value: 'eventTag', label: 'イベントタグ' },
    { value: 'songName', label: '楽曲名' },
    { value: 'personName', label: '歌唱者' },
    { value: 'artistName', label: 'アーティスト' },
    { value: 'eventName', label: 'イベント名' },
    { value: 'lyricistName', label: '作詞' },
    { value: 'composerName', label: '作曲' },
    { value: 'arrangerName', label: '編曲' },
    { value: 'venueName', label: '会場名' },
    { value: 'prefectureId', label: '都道府県' },
    { value: 'sectionName', label: 'セクション' },
  ]
  const methodOptions: Array<{ value: SearchMethod; label: string }> = [
    { value: 'contains', label: '含む' },
    { value: 'startsWith', label: 'で始まる' },
    { value: 'endsWith', label: 'で終わる' },
    { value: 'exact', label: 'である' },
    { value: 'notContains', label: '含まない' },
    { value: 'notExact', label: 'でない' },
  ]
  const dropdownMethodOptions: Array<{ value: SearchMethod; label: string }> = [
    { value: 'exact', label: 'である' },
    { value: 'notExact', label: 'でない' },
  ]
  const conditionPreviewMethodLabels: Record<SearchMethod, string> = {
    contains: 'を含む',
    startsWith: 'で始まる',
    endsWith: 'で終わる',
    exact: 'である',
    notContains: 'を含まない',
    notExact: 'でない',
  }
  const dropdownConditionPreviewMethodLabels: Partial<Record<SearchMethod, string>> = {
    contains: 'である',
    exact: 'である',
    notContains: 'でない',
    notExact: 'でない',
  }
  const conditionSuggestFields: Partial<Record<AdvancedConditionField, SearchSuggestField>> = {
    songName: 'songName',
    personName: 'personName',
    artistName: 'artistName',
    lyricistName: 'lyricistName',
    composerName: 'composerName',
    arrangerName: 'arrangerName',
    eventName: 'eventName',
    venueName: 'venueName',
    sectionName: 'sectionName',
  }
  const recordSuggestionApply = (
    selected: SearchSuggestion,
    field?: SearchSuggestField,
  ) => {
    if (!field) return
    recordSuggestionAnalytics({
      field,
      value: selected.value,
      searchUnit,
      searchMode: 'advanced',
    })
  }
  const fieldLabelMap = new Map(conditionFieldOptions.map((option) => [option.value, option.label]))
  const canClearConditions =
    query.trim().length > 0 ||
    conditionGroups.some((group) => group.values.some((value) => value.value.trim().length > 0)) ||
    groupByEventSong ||
    personName.trim().length > 0 ||
    songName.trim().length > 0 ||
    artistName.trim().length > 0 ||
    lyricistName.trim().length > 0 ||
    composerName.trim().length > 0 ||
    arrangerName.trim().length > 0 ||
    eventName.trim().length > 0 ||
    venueName.trim().length > 0 ||
    eventTag.trim().length > 0 ||
    sectionName.trim().length > 0 ||
    prefectureIds.trim().length > 0 ||
    dateFrom.trim().length > 0 ||
    dateTo.trim().length > 0 ||
    fieldSearchMethods.personName !== DEFAULT_FIELD_SEARCH_METHODS.personName ||
    fieldSearchMethods.songName !== DEFAULT_FIELD_SEARCH_METHODS.songName ||
    fieldSearchMethods.artistName !== DEFAULT_FIELD_SEARCH_METHODS.artistName ||
    fieldSearchMethods.lyricistName !== DEFAULT_FIELD_SEARCH_METHODS.lyricistName ||
    fieldSearchMethods.composerName !== DEFAULT_FIELD_SEARCH_METHODS.composerName ||
    fieldSearchMethods.arrangerName !== DEFAULT_FIELD_SEARCH_METHODS.arrangerName ||
    fieldSearchMethods.eventName !== DEFAULT_FIELD_SEARCH_METHODS.eventName ||
    fieldSearchMethods.venueName !== DEFAULT_FIELD_SEARCH_METHODS.venueName ||
    fieldSearchMethods.sectionName !== DEFAULT_FIELD_SEARCH_METHODS.sectionName

  return (
    <section
      ref={panelRef}
      className="rounded-none border-2 border-gray-800 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] md:p-5"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center">
          <div
            role="radiogroup"
            aria-label="検索タイプ"
            className="relative inline-flex h-9 overflow-hidden rounded-none border-2 border-gray-800 bg-white shadow-[2px_2px_0px_0px_rgba(31,41,55,0.65)]"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 w-1/2 bg-red-600 transition-transform duration-300 ease-out ${
                searchUnit === 'setlist' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            {(['stage', 'setlist'] as SearchUnit[]).map((unit) => (
              <button
                key={unit}
                type="button"
                role="radio"
                aria-checked={searchUnit === unit}
                aria-label={modeLabels[unit]}
                title={modeLabels[unit]}
                className={`relative z-[1] inline-flex h-9 w-9 items-center justify-center text-xs font-semibold transition-colors duration-300 ${
                  searchUnit === unit
                    ? 'text-white'
                    : 'text-gray-700'
                }`}
                onClick={() => onSearchUnitChange(unit)}
                disabled={!dbReady}
              >
                {searchUnitIcons[unit]}
              </button>
            ))}
          </div>
          <p className="ml-3 flex-1 text-center text-base font-semibold text-slate-700">
            {modeLabels[searchUnit]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchDetailActions
            expanded={!formCollapsed}
            onToggle={onToggleForm}
            onClear={onResetFilters}
            clearDisabled={!canClearConditions}
          />
        </div>
      </div>

      <label className="text-xs font-semibold text-slate-600">
        キーワード検索
        <AutocompleteTextInput
          className="mt-1"
          inputClassName="w-full rounded-none border-2 border-gray-800 px-3 py-2 pr-8 text-[11px] md:text-sm focus:outline-none"
          reservedButtonPadding="3.1rem"
          iconDensity="default"
          value={query}
          onChange={onQueryChange}
          disabled={!dbReady}
          placeholder={queryPlaceholder}
          ariaLabel="キーワード検索"
          onFetchSuggestions={(term) => onFetchSuggestions('query', term)}
          suggestField="query"
          suggestVariant={suggestVariant}
          suggestEnabled={querySuggestEnabled}
          onSuggestionApply={recordSuggestionApply}
        />
      </label>

      {searchUnit === "setlist" ? (
        <>
          <label className="mt-2 inline-flex w-full items-center gap-2 px-1 py-1 text-xs text-slate-700">
            <span className="relative inline-flex h-6 w-6 items-center justify-center">
              <input
                type="checkbox"
                checked={groupByEventSong}
                onChange={(event) => onGroupByEventSongChange(event.target.checked)}
                disabled={!dbReady}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded-none border-2 border-gray-800 bg-white transition peer-checked:border-red-700 peer-checked:bg-red-600 peer-disabled:opacity-50" />
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100 peer-disabled:opacity-40"
              >
                <path
                  d="M5 10.5l3 3 7-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              </svg>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-semibold">結果をイベント毎にまとめる</span>
              <span className="group relative inline-flex">
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-none border border-gray-700 text-[10px] font-bold text-gray-700"
                  aria-label={groupingHelpText}
                  title="表示説明"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setGroupingHelpOpen((prev) => !prev)
                  }}
                >
                  ?
                </button>
                <span className="absolute left-0 top-full z-20 mt-1 hidden w-[260px] rounded-none border-2 border-gray-800 bg-white px-2 py-1.5 text-[11px] leading-4 text-slate-700 shadow-[2px_2px_0px_0px_rgba(31,41,55,0.6)] md:group-hover:block md:group-focus-within:block">
                  {groupingHelpText}
                </span>
              </span>
            </span>
          </label>
          {groupingHelpOpen ? (
            <p className="mt-1 rounded-none border-2 border-gray-800 bg-white px-2 py-1.5 text-[11px] leading-4 text-slate-700 md:hidden">
              {groupingHelpText}
            </p>
          ) : null}
        </>
      ) : null}

      <div
        aria-hidden={formCollapsed}
        className={`transition-all duration-300 ease-out ${
          formCollapsed
            ? 'max-h-0 opacity-0 pointer-events-none overflow-hidden'
            : 'max-h-[1400px] opacity-100 overflow-visible'
        }`}
      >
        <div>
          <div className="mt-3 space-y-3">
              <div className="border-b border-dashed border-gray-300 pb-2">
                <div className="flex min-w-0 items-center gap-1">
                  <span className="shrink-0 text-[11px] font-semibold text-slate-600">条件</span>
                  <div className="relative min-w-0 flex-1">
                    <div ref={conditionButtonsRef} className="flex min-w-0 gap-1 overflow-x-auto py-0.5 pr-5">
                      {conditionFieldOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-none border border-gray-300 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-[1px_1px_0px_0px_rgba(31,41,55,0.28)] hover:border-gray-800 hover:bg-gray-50"
                          onClick={() => onConditionGroupAdd?.(option.value)}
                          title={`${option.label}条件を追加`}
                        >
                          <PlusIcon className="h-2.5 w-2.5" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {conditionButtonsOverflow ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-0 right-0 top-0 flex w-10 items-center justify-end bg-gradient-to-l from-white via-white/95 to-transparent pr-1 text-base font-black leading-none text-slate-700"
                      >
                        ›
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div>
                <SearchDateRangeControl
                  mode={dateMode}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  disabled={!dbReady}
                  onModeChange={onDateModeChange}
                  onDateRangeChange={onDateRangeChange}
                />
              </div>
              <div className="space-y-2">
                {conditionGroups.length > 1 ? (
                  <div className="flex items-center">
                    <JoinModeToggle
                      value={conditionTopLevelJoin}
                      onChange={(next) => onConditionTopLevelJoinChange?.(next)}
                      title="条件間結合"
                    />
                  </div>
                ) : null}
                {conditionGroups.map((group, groupIndex) => {
                  const isGroupedBlock = group.values.length > 1
                  return (
                    <div key={group.id} className="space-y-1">
                      <div
                        className={
                          isGroupedBlock
                            ? "relative my-2 ml-1 rounded-none bg-gray-50/70 py-1.5 pl-3 pr-2"
                            : "p-0"
                        }
                      >
                        {isGroupedBlock ? (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-1 left-0 top-1 w-2 border-y-2 border-l-2 border-gray-800"
                          />
                        ) : null}
                        <div className="space-y-1.5">
                          {isGroupedBlock ? (
                            <div className="flex items-center pl-1">
                              <JoinModeToggle
                                value={group.conditionJoin === 'and' ? 'and' : 'or'}
                                onChange={(next) => onConditionGroupJoinChange?.(group.id, next)}
                                title="グループ内結合"
                              />
                            </div>
                          ) : null}
                          {group.values.map((row, index) => {
                            const fieldLabel = conditionFieldOptions.find((option) => option.value === row.field)?.label ?? row.field
                            return (
                              <div key={row.id} className="space-y-0.5 md:space-y-1">
                                <div className="grid h-4 min-w-0 grid-cols-[22px_minmax(0,1fr)] items-center gap-0 md:h-5 md:grid-cols-[24px_minmax(0,1fr)]">
                                  <span aria-hidden="true" />
                                  <span className="min-w-0 truncate text-[11px] font-semibold leading-none text-slate-600 md:text-xs" title={fieldLabel}>
                                    {fieldLabel}
                                  </span>
                                </div>
                                <div className="grid grid-cols-[22px_minmax(0,1fr)_72px_26px] items-center gap-0 md:grid-cols-[24px_minmax(0,1fr)_96px_32px]">
                                  <div className="flex h-7 items-center justify-center md:h-8">
                                    {!isGroupedBlock && index === 0 && groupIndex > 0 ? (
                                      <button
                                        type="button"
                                        className="inline-flex h-7 w-5 shrink-0 items-center justify-center rounded-none text-gray-700 hover:bg-gray-100 hover:text-red-700 md:h-8 md:w-6"
                                        title="上の条件とグループ化"
                                        aria-label="上の条件とグループ化"
                                        onClick={() => onConditionGroupWithPrevious?.(groupIndex)}
                                      >
                                        <IndentIncreaseIcon className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                    {isGroupedBlock ? (
                                      <button
                                        type="button"
                                        className="inline-flex h-7 w-5 shrink-0 items-center justify-center rounded-none text-gray-700 hover:bg-gray-100 hover:text-red-700 md:h-8 md:w-6"
                                        title="この条件をグループ解除"
                                        aria-label="この条件をグループ解除"
                                        onClick={() => onConditionUngroup?.(groupIndex, row.id)}
                                      >
                                        <IndentDecreaseIcon className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                  </div>
                                  {row.field === 'eventTag' ? (
                                    <SingleSelectDropdown
                                      options={eventTagOptions.map((option) => ({
                                        value: option.name,
                                        label: option.name,
                                      }))}
                                      value={row.value}
                                      onChange={(value) => onConditionValueChange?.(group.id, index, { value })}
                                      placeholder="タグを選択"
                                      optionColumns={2}
                                      compact
                                    />
                                  ) : row.field === 'prefectureId' ? (
                                    <PrefectureSingleSelectDropdown
                                      prefectureOptions={prefectureOptions}
                                      value={row.value}
                                      onChange={(value) => onConditionValueChange?.(group.id, index, { value })}
                                      placeholder="都道府県を選択"
                                      compact
                                    />
                                  ) : (
                                    <AutocompleteTextInput
                                      value={row.value}
                                      onChange={(value) => onConditionValueChange?.(group.id, index, { value })}
                                      className="min-w-0"
                                      inputClassName="w-full rounded-none border border-gray-400 px-1.5 py-0 pr-14 text-[11px] h-7 focus:outline-none md:h-8 md:px-2 md:text-xs"
                                      reservedButtonPadding="1.35rem"
                                      iconDensity="compact"
                                      placeholder="キーワード"
                                      disabled={!dbReady}
                                      suggestionsPanelExtraWidthPx={98}
                                      onFetchSuggestions={
                                        conditionSuggestFields[row.field]
                                          ? (term) => onFetchSuggestions(conditionSuggestFields[row.field] as SearchSuggestField, term)
                                          : undefined
                                      }
                                      suggestField={conditionSuggestFields[row.field]}
                                      suggestVariant={suggestVariant}
                                      suggestEnabled={detailSuggestEnabled && Boolean(conditionSuggestFields[row.field])}
                                      onSuggestionApply={recordSuggestionApply}
                                    />
                                  )}
                                  <SelectField
                                    value={row.method}
                                    onChange={(event) =>
                                      onConditionValueChange?.(group.id, index, { method: event.target.value as SearchMethod })
                                    }
                                    className="border-gray-400 border-l-0 px-1 py-0 text-[11px] md:h-8 md:text-xs"
                                  >
                                    {((row.field === 'eventTag' || row.field === 'prefectureId')
                                      ? dropdownMethodOptions
                                      : methodOptions
                                    ).map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </SelectField>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (group.values.length > 1) {
                                        onConditionValueRemove?.(group.id, index)
                                      } else {
                                        onConditionGroupRemove?.(group.id)
                                      }
                                    }}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-none p-0 text-red-700 hover:bg-red-50 hover:text-red-800 md:h-8 md:w-8"
                                    title="条件を削除"
                                    aria-label="条件を削除"
                                  >
                                    <XIcon className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
          </div>
        </div>
      </div>

      <ConditionExpressionPreview
        groups={conditionGroups.map((group) => ({
          conditionJoin: group.conditionJoin === 'or' ? 'or' : 'and',
          conditions: group.values.map((value) => ({
            field: value.field,
            value: value.value,
            method: value.method,
          })),
        }))}
        topLevelJoin={conditionTopLevelJoin}
        dateFrom={dateFrom}
        dateTo={dateTo}
        getFieldLabel={(field) => fieldLabelMap.get(field as AdvancedConditionField) ?? field}
        getMethodLabel={(item) =>
          ((item.field === 'eventTag' || item.field === 'prefectureId')
            ? dropdownConditionPreviewMethodLabels[item.method as SearchMethod]
            : undefined) ??
          conditionPreviewMethodLabels[item.method as SearchMethod] ??
          item.method
        }
        isNegativeMethod={(method) => method === 'notContains' || method === 'notExact'}
        getDisplayValue={(item) =>
          item.field === 'prefectureId'
            ? (prefectureOptions.find((option) => String(option.id) === item.value.trim())?.name ?? item.value.trim())
            : item.value.trim()
        }
      />

      {showCloseFloating ? (
        <button
          type="button"
          onClick={onToggleForm}
          className="fixed bottom-5 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-none border-2 border-gray-800 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-[4px_4px_0px_0px_rgba(31,41,55,0.9)] active:translate-x-[-50%] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(31,41,55,0.8)] md:left-[calc(50%+8rem)]"
          aria-label="結果を表示"
          title="結果を表示"
        >
          <ChevronUpIcon className="h-4 w-4 shrink-0" />
          <span>結果を表示</span>
        </button>
      ) : null}
      {!hasSearched && dbReady ? <div className="mt-3 text-sm text-slate-600">{statusText}</div> : null}
    </section>
  )
}

function JoinModeToggle({
  value,
  onChange,
  title,
}: {
  value: 'and' | 'or'
  onChange: (value: 'and' | 'or') => void
  title: string
}) {
  const next = value === 'and' ? 'or' : 'and'
  const label = value.toUpperCase()
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      className={`inline-flex h-5 min-w-10 items-center justify-center rounded-none border border-gray-800 px-2 font-mono text-[10px] font-bold leading-none tracking-wide text-white shadow-[1px_1px_0px_0px_rgba(31,41,55,0.65)] hover:bg-red-700 ${
        value === 'and' ? 'bg-gray-900' : 'bg-red-600'
      }`}
      title={`${title}: ${label}`}
      aria-label={`${title}: ${label}`}
    >
      {label}
    </button>
  )
}
