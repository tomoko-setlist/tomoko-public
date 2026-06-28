import { useEffect, useMemo, useState } from "react"

import { DETAIL_ANALYSIS_COLORS } from "./DetailAnalysisPalette"
import {
  DetailAnalysisPanel,
  DetailMetricGrid,
  DetailMetricItem,
} from "./DetailAnalysisUi"
import { DetailSectionHeader } from "./DetailSectionHeader"
import { DetailTagBarChart } from "./DetailTagBarChart"
import {
  DetailErrorState,
  DetailLoadingState,
  DetailNotFoundState,
  DetailPanel,
  DetailResponsiveTable,
  DetailShareLinkButton,
} from "./DetailUi"
import { DetailViewModeToggle } from "./DetailViewModeToggle"
import { useEventTagFilter } from "./hooks/useEventTagFilter"
import { useVenueDetail } from "./hooks/useVenueDetail"
import { TagFilterChips } from "./TagFilterChips"
import { formatDateRangeYmd, formatDateYmd, formatTimeHm, formatTopRank, parseTags, rankToneClass } from "../../lib/uiFormat"
import { LinkTextButton, SetlistIcon } from "../ui"
import { EVENT_TAG_CHIP_CLASS } from "../ui/eventTagClass"

import type { SetlistSearchDb, StageDetail } from "../../lib/setlistSearchDb/types"

type VenueDetailPageProps = {
  db: SetlistSearchDb
  venueId: number
  onResolveTitle?: (title: string) => void
  onOpenEvent: (eventId: number) => void
  onOpenStage: (stageId: number) => void
}

export function VenueDetailPage({
  db,
  venueId,
  onResolveTitle,
  onOpenEvent,
  onOpenStage,
}: VenueDetailPageProps) {
  const { loading, error, venue, stages, topPercentiles } = useVenueDetail(db, venueId)
  const [activeTab, setActiveTab] = useState<"list" | "analysis">("list")
  const { selectedTags, setSelectedTags, tagOptions: stageTags, filteredRows: filteredStages } = useEventTagFilter(stages)

  useEffect(() => {
    if (venue?.venueName) {
      onResolveTitle?.(venue.venueName)
    }
  }, [venue?.venueName, onResolveTitle])

  const analysis = useMemo(() => {
    const eventIds = new Set<number>()
    const tagStats = new Map<string, number>()
    let cancelledCount = 0
    let totalPerformances = 0

    stages.forEach((stage) => {
      eventIds.add(stage.eventId)
      totalPerformances += stage.totalPerformances ?? 0
      if (stage.cancelled) cancelledCount += 1
      parseTags(stage.eventTagsJson).forEach((tag) => {
        tagStats.set(tag, (tagStats.get(tag) ?? 0) + 1)
      })
    })

    const sortedTags = Array.from(tagStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
    return {
      totalStages: stages.length,
      totalEvents: eventIds.size,
      totalPerformances,
      cancelledCount,
      totalTagKinds: tagStats.size,
      sortedTags,
    }
  }, [stages])
  const showStatusColumn = useMemo(
    () => stages.some((stage) => stage.cancelled),
    [stages],
  )

  if (loading) return <DetailLoadingState />
  if (error) return <DetailErrorState message={error} />
  if (!venue) return <DetailNotFoundState message="会場が見つかりませんでした。" />

  return (
    <div className="space-y-4">
      <DetailPanel className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">VENUE</p>
            <h1 className="min-w-0 break-words text-lg font-bold text-slate-900">{venue.venueName}</h1>
          </div>
          <DetailShareLinkButton />
        </div>
      </DetailPanel>

      {venue.prefectureName || venue.sittingCapacity || venue.standingCapacity ? (
        <DetailPanel className="p-4">
          <h2 className="text-base font-bold text-slate-900">詳細情報</h2>
          <dl className="mt-3 border-y border-slate-300 text-sm">
            {venue.prefectureName ? (
              <div className="grid grid-cols-[5rem_1fr] gap-3 border-b border-slate-200 py-2 last:border-b-0">
                <dt className="text-xs font-semibold text-slate-500">所在地</dt>
                <dd className="font-semibold text-slate-900">{venue.prefectureName}</dd>
              </div>
            ) : null}
            {venue.sittingCapacity || venue.standingCapacity ? (
              <div className="grid grid-cols-[5rem_1fr] gap-3 border-b border-slate-200 py-2 last:border-b-0">
                <dt className="text-xs font-semibold text-slate-500">キャパ</dt>
                <dd className="flex flex-wrap gap-x-3 gap-y-1 font-semibold text-slate-900">
                  {venue.sittingCapacity ? (
                    <span>着席 {venue.sittingCapacity.toLocaleString()}席</span>
                  ) : null}
                  {venue.standingCapacity ? (
                    <span>立見 {venue.standingCapacity.toLocaleString()}人</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>
        </DetailPanel>
      ) : null}

      {stages.length > 0 ? (
      <DetailPanel className="p-4">
        <DetailSectionHeader
          title="開催イベント"
          className="mb-3 flex-row items-center justify-between"
          right={
            <DetailViewModeToggle value={activeTab} onChange={setActiveTab} />
          }
          below={
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
                <span>全{venue.totalStages}公演</span>
                <span>{formatDateRangeYmd(venue.firstDate, venue.lastDate)}</span>
              </div>
              {activeTab === "list" && stageTags.length > 0 ? (
                <TagFilterChips
                  options={stageTags}
                  selected={selectedTags}
                  onChange={setSelectedTags}
                  className="text-xs text-slate-600"
                />
              ) : null}
            </div>
          }
        />

        {activeTab === "list" ? (
          <>
            <DetailResponsiveTable
              rows={filteredStages}
              rowKey={(stage) => stage.stageId}
              initialPageSize={25}
              pageSizeOptions={[25, 50, 100]}
              hideSummary
              mobileRowClassName="border-b border-slate-300 bg-white px-1 py-1.5 first:border-t first:border-slate-300"
              columns={[
              {
                key: "detail",
                header: "セトリ",
                mobileHidden: true,
                render: (stage) => (
                  stage.totalPerformances > 0 ? (
                    <button
                      type="button"
                      onClick={() => onOpenStage(stage.stageId)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-none text-blue-600 hover:bg-blue-50"
                      title="ステージ詳細"
                      aria-label="ステージ詳細"
                    >
                      <SetlistIcon className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )
                ),
              },
              {
                key: "dateTime",
                header: "日時",
                mobileHidden: true,
                render: (stage) => {
                  const dateLabel = formatDateYmd(stage.date)
                  const timeLabel = formatTimeHm(stage.startTime)
                  return (
                    <span>
                      {timeLabel && timeLabel !== "-" ? `${dateLabel} ${timeLabel}` : dateLabel}
                    </span>
                  )
                },
              },
              {
                key: "event",
                header: "イベント",
                mobileHidden: true,
                render: (stage) => (
                  <LinkTextButton onClick={() => onOpenEvent(stage.eventId)}>
                    {stage.eventName}
                  </LinkTextButton>
                ),
              },
              {
                key: "tags",
                header: "タグ",
                mobileHidden: true,
                render: (stage) => {
                  const tags = parseTags(stage.eventTagsJson)
                  if (tags.length === 0) return <span className="text-slate-400">-</span>
                  return (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span
                          key={`${stage.stageId}-${tag}`}
                          className={EVENT_TAG_CHIP_CLASS}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )
                },
              },
              ...(showStatusColumn
                ? [
              {
                key: "status",
                header: "状態",
                mobileHidden: true,
                render: (stage: StageDetail) =>
                  stage.cancelled ? (
                    <span className="inline-flex rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      中止
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                ),
              },
                  ]
                : []),
              {
                key: "mobileVenueStage",
                header: "",
                desktopClassName: "md:hidden",
                mobileLabelClassName: "hidden",
                mobileValueClassName: "col-span-2",
                render: (stage: StageDetail) => {
                  const dateLabel = formatDateYmd(stage.date)
                  const timeLabel = formatTimeHm(stage.startTime)
                  const dateTimeLabel =
                    timeLabel && timeLabel !== "-" ? `${dateLabel} ${timeLabel}` : dateLabel
                  const tags = parseTags(stage.eventTagsJson)
                  return (
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex min-w-0 items-start gap-2">
                        <LinkTextButton
                          onClick={() => onOpenEvent(stage.eventId)}
                          className="min-w-0 flex-1 truncate text-left text-xs font-semibold leading-4 text-blue-700"
                        >
                          {stage.eventName}
                        </LinkTextButton>
                        {stage.totalPerformances > 0 ? (
                          <button
                            type="button"
                            onClick={() => onOpenStage(stage.stageId)}
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-none text-blue-600 hover:bg-blue-50"
                            title="ステージ詳細"
                            aria-label="ステージ詳細"
                          >
                            <SetlistIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] leading-4 text-slate-500">
                        {dateTimeLabel}
                      </p>
                      {tags.length > 0 || stage.cancelled ? (
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {tags.slice(0, 3).map((tag) => (
                            <span
                              key={`${stage.stageId}-mobile-${tag}`}
                              className="inline-flex border border-slate-300 bg-slate-50 px-1 text-[9px] font-semibold leading-3 text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                          {tags.length > 3 ? (
                            <span className="text-[10px] font-semibold leading-3 text-slate-500">
                              +{tags.length - 3}
                            </span>
                          ) : null}
                          {stage.cancelled ? (
                            <span className="inline-flex rounded bg-red-100 px-1.5 text-[10px] font-semibold leading-3 text-red-700">
                              中止
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                },
              },
            ]}
            />
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailAnalysisPanel title="概要" eyebrow="VENUE SIGNAL">
              <DetailMetricGrid className="md:grid-cols-4">
                <DetailMetricItem
                  label="総開催回数"
                  value={analysis.totalStages}
                  rankText={formatTopRank(topPercentiles?.stageRank, topPercentiles?.stageTopPercent)}
                  rankClassName={`text-[11px] font-semibold ${rankToneClass(topPercentiles?.stageRank)}`}
                  accentColor={DETAIL_ANALYSIS_COLORS[0]}
                />
                <DetailMetricItem
                  label="イベント数"
                  value={analysis.totalEvents}
                  rankText={formatTopRank(topPercentiles?.eventRank, topPercentiles?.eventTopPercent)}
                  rankClassName={`text-[11px] font-semibold ${rankToneClass(topPercentiles?.eventRank)}`}
                  accentColor={DETAIL_ANALYSIS_COLORS[1]}
                />
                <DetailMetricItem
                  label="総セットリスト曲数"
                  value={analysis.totalPerformances}
                  rankText={formatTopRank(topPercentiles?.performanceRank, topPercentiles?.performanceTopPercent)}
                  rankClassName={`text-[11px] font-semibold ${rankToneClass(topPercentiles?.performanceRank)}`}
                  accentColor={DETAIL_ANALYSIS_COLORS[2]}
                />
                <DetailMetricItem
                  label="中止回数"
                  value={analysis.cancelledCount}
                  accentColor={DETAIL_ANALYSIS_COLORS[3]}
                />
              </DetailMetricGrid>
            </DetailAnalysisPanel>

            <DetailTagBarChart
              title="イベントタグ別開催回数"
              rows={analysis.sortedTags}
              totalKinds={analysis.totalTagKinds}
              maxItems={5}
            />
          </div>
        )}
      </DetailPanel>
      ) : null}
    </div>
  )
}
