import { useEffect, useMemo, useState } from "react"

import { DETAIL_ANALYSIS_COLORS } from "./DetailAnalysisPalette"
import {
  DetailAnalysisPanel,
  DetailInlineBarList,
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
import { useAlbumCategoryFilter } from "./hooks/useAlbumCategoryFilter"
import { useSongDetail } from "./hooks/useSongDetail"
import { MusicServicePlayControls } from "./MusicServicePlayControls"
import { extractYouTubeId, toYouTubeEmbedUrl } from "../../lib/services/youtube"
import { categoryLabel, formatDateRangeYmd, formatDateYmd, formatTopRank, parseTags, rankToneClass } from "../../lib/uiFormat"
import { toSafeNodeeUrl } from "../../shared/url/externalUrl"
import { LinkTextButton } from "../ui"
import { TagFilterChips } from "./TagFilterChips"

import type { SetlistSearchDb, SongVersionDetail } from "../../lib/setlistSearchDb/types"

type SongDetailPageProps = {
  db: SetlistSearchDb
  songId: number
  onResolveTitle?: (title: string) => void
  onOpenEvent: (eventId: number) => void
  onOpenArtist: (artistId: number) => void
  onOpenCreator?: (creatorId: number) => void
  onOpenAlbum: (albumId: number) => void
}

export function SongDetailPage({
  db,
  songId,
  onResolveTitle,
  onOpenEvent,
  onOpenArtist,
  onOpenCreator,
  onOpenAlbum,
}: SongDetailPageProps) {
  const { loading, error, song, setlists, versions, albums, topPercentiles } = useSongDetail(db, songId)
  const [activeTab, setActiveTab] = useState<"list" | "analysis">("list")
  const { selectedAlbumCategory, setSelectedAlbumCategory, albumCategoryTabs, filteredAlbums } = useAlbumCategoryFilter(albums)
  const [selectedEventTags, setSelectedEventTags] = useState<string[]>([])
  const isMobileVersionList = useDetailMobileViewport()

  useEffect(() => {
    if (song?.songName) {
      onResolveTitle?.(song.songName)
    }
  }, [song?.songName, onResolveTitle])

  const analysis = useMemo(() => {
    const eventIds = new Set<number>()
    const venueIds = new Set<number>()
    const tagStats = new Map<string, number>()
    const sectionStats = new Map<string, number>()

    setlists.forEach((row) => {
      eventIds.add(row.eventId)
      venueIds.add(row.venueId)

      const section = row.section?.trim() ? row.section.trim() : "本編"
      sectionStats.set(section, (sectionStats.get(section) ?? 0) + 1)

      parseTags(row.eventTagsJson).forEach((tag) => {
        tagStats.set(tag, (tagStats.get(tag) ?? 0) + 1)
      })
    })

    const sortedTags = Array.from(tagStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
    const sortedSections = Array.from(sectionStats.entries()).sort((a, b) => b[1] - a[1])
    return {
      totalPerformances: setlists.length,
      totalEvents: eventIds.size,
      totalVenues: venueIds.size,
      totalTagKinds: tagStats.size,
      sortedTags,
      sortedSections,
    }
  }, [setlists])

  const eventGroupedSetlists = useMemo(() => {
    const byEvent = new Map<
      number,
      {
        eventId: number
        eventName: string
        firstDate: string | null
        lastDate: string | null
        venues: string[]
        performers: string[]
        versions: string[]
        rowCount: number
      }
    >()

    setlists.forEach((row) => {
      const existing = byEvent.get(row.eventId)
      const performer = (row.displayPerformerName ?? "").trim()
      const versionName = row.songName && row.songName !== song?.songName ? row.songName : ""
      if (!existing) {
        byEvent.set(row.eventId, {
          eventId: row.eventId,
          eventName: row.eventName,
          firstDate: row.date ?? null,
          lastDate: row.date ?? null,
          venues: row.venueName ? [row.venueName] : [],
          performers: performer ? [performer] : [],
          versions: versionName ? [versionName] : [],
          rowCount: 1,
        })
        return
      }
      existing.rowCount += 1
      if (row.date) {
        if (!existing.firstDate || row.date < existing.firstDate) existing.firstDate = row.date
        if (!existing.lastDate || row.date > existing.lastDate) existing.lastDate = row.date
      }
      if (row.venueName && !existing.venues.includes(row.venueName)) {
        existing.venues.push(row.venueName)
      }
      if (performer && !existing.performers.includes(performer)) {
        existing.performers.push(performer)
      }
      if (versionName && !existing.versions.includes(versionName)) {
        existing.versions.push(versionName)
      }
    })

    const summarizeList = (values: string[], unitLabel: string) => {
      if (values.length === 0) return "-"
      if (values.length === 1) return values[0]
      return `${values[0]} ほか${values.length - 1}${unitLabel}`
    }

    return Array.from(byEvent.values())
      .sort((a, b) => {
        const aTime = Date.parse(a.lastDate ?? "") || 0
        const bTime = Date.parse(b.lastDate ?? "") || 0
        return bTime - aTime
      })
      .map((event) => ({
        eventId: event.eventId,
        eventName: event.eventName,
        dateLabel: formatDateRangeYmd(event.firstDate, event.lastDate),
        sortDate: event.lastDate ?? event.firstDate ?? "",
        venueLabel: summarizeList(event.venues, "会場"),
        performerLabel: summarizeList(event.performers, "名"),
        versionLabel: summarizeList(event.versions, "件"),
        rowCount: event.rowCount,
        tags: Array.from(
          new Set(
            setlists
              .filter((row) => row.eventId === event.eventId)
              .flatMap((row) => parseTags(row.eventTagsJson)),
          ),
        ),
      }))
  }, [setlists, song?.songName])

  const eventTagOptions = useMemo(() => {
    const unique = new Set<string>()
    eventGroupedSetlists.forEach((row) => {
      row.tags.forEach((tag) => unique.add(tag))
    })
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ja"))
  }, [eventGroupedSetlists])

  const filteredEventGroupedSetlists = useMemo(
    () =>
      selectedEventTags.length > 0
        ? eventGroupedSetlists.filter((row) =>
            selectedEventTags.some((tag) => row.tags.includes(tag)),
          )
        : eventGroupedSetlists,
    [eventGroupedSetlists, selectedEventTags],
  )

  const versionMvRows = useMemo(
    () =>
      versions
        .map((version, index) => {
          const youtubeIds = Array.from(
            new Set(
              (version.youtubeIds ?? [])
                .map((item) => extractYouTubeId(item))
                .concat(extractYouTubeId(version.youtubeId))
                .filter((item): item is string => Boolean(item)),
            ),
          )
          const rowKey = `${version.songVersionId ?? "null"}-${index}`
          return {
            rowKey,
            versionName: version.versionName,
            youtubeIds,
          }
        })
        .filter((row) => row.youtubeIds.length > 0),
    [versions],
  )

  const primaryNodeeUrl = useMemo(() => {
    if (!song) return null
    if (song.defaultStreamingSongVersionId !== null) {
      const matched = versions.find(
        (version) => version.songVersionId === song.defaultStreamingSongVersionId && version.nodeeUrl,
      )
      const safeMatchedUrl = toSafeNodeeUrl(matched?.nodeeUrl)
      if (safeMatchedUrl) return safeMatchedUrl
    }

    const linkedVersions = versions.filter((version) => Boolean(version.nodeeUrl))
    if (linkedVersions.length === 1) return toSafeNodeeUrl(linkedVersions[0].nodeeUrl)
    return toSafeNodeeUrl(linkedVersions[0]?.nodeeUrl)
  }, [song, versions])

  if (loading) return <DetailLoadingState />
  if (error) return <DetailErrorState message={error} />
  if (!song) return <DetailNotFoundState message="楽曲が見つかりませんでした。" />

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
      <div className="min-w-0 flex-1 space-y-3">
        <DetailPanel className="p-3 lg:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">SONG</p>
            <h1 className="min-w-0 break-words text-xl font-bold text-slate-900 lg:text-2xl">{song.songName}</h1>
          </div>
          <DetailShareLinkButton className="ml-auto" />
        </div>
        <div className="mt-2 min-w-0">
          <p className="mt-1 text-sm text-slate-700 lg:text-base">
            <LinkTextButton onClick={() => onOpenArtist(song.artistId)} className="font-semibold text-blue-700">
              {song.artistName}
            </LinkTextButton>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            歌唱回数: {song.totalPerformances} 回 / イベント: {song.totalEvents} 件
          </p>
          <p className="mt-1 text-xs text-slate-500">最終歌唱日: {formatDateYmd(song.lastPerformedDate)}</p>
          {primaryNodeeUrl ? (
            <a
              href={primaryNodeeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex rounded-none border-2 border-gray-800 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 lg:hidden"
            >
              サブスクで再生
            </a>
          ) : null}
        </div>
      </DetailPanel>

        {versionMvRows.length > 0 ? (
          <DetailPanel className="p-3 lg:hidden">
            <h2 className="mb-2 text-base font-semibold text-slate-900">MV</h2>
            <div className="space-y-2">
              {versionMvRows.map((row) => {
                return (
                  <div key={row.rowKey}>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {row.youtubeIds.map((youtubeId, index) => (
                        <div
                          key={`${row.rowKey}-${youtubeId}-${index}`}
                          className="relative aspect-video w-full overflow-hidden bg-black"
                        >
                          <iframe
                            title={`official-mv-${row.rowKey}-${index}`}
                            src={toYouTubeEmbedUrl(youtubeId)}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                            className="absolute inset-0 h-full w-full border-0"
                          />
                        </div>
                      ))}
                      </div>
                  </div>
                )
              })}
            </div>
          </DetailPanel>
        ) : null}

        {versions.length > 0 ? (
          <DetailPanel className="p-3 lg:p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Version一覧</h2>
              <span className="shrink-0 border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                全{versions.length}件
              </span>
            </div>
            {isMobileVersionList ? (
              <SongVersionMobileList
                versions={versions}
                onOpenArtist={onOpenArtist}
                onOpenCreator={onOpenCreator}
              />
            ) : (
              <DetailResponsiveTable
                rows={versions}
                rowKey={(row, index) => `${row.songVersionId ?? 0}-${row.versionName}-${index}`}
                disablePagination={true}
                disableSorting={true}
                hideSummary={true}
                mobileAsTable={true}
                columns={[
                  {
                    key: "versionName",
                    header: "Version",
                    render: (row) => row.versionName,
                  },
                  {
                    key: "artist",
                    header: "アーティスト",
                    render: (row) =>
                      row.artistId && row.artistName ? (
                        <LinkTextButton onClick={() => onOpenArtist(row.artistId!)}>
                          {row.artistName}
                        </LinkTextButton>
                      ) : (
                        row.artistName || "-"
                      ),
                  },
                  {
                    key: "lyricist",
                    header: "作詞",
                    render: (row) =>
                      row.lyricistId !== null && row.lyricistName && onOpenCreator ? (
                        <LinkTextButton onClick={() => onOpenCreator(row.lyricistId!)}>
                          {row.lyricistName}
                        </LinkTextButton>
                      ) : (
                        row.lyricistName || "-"
                      ),
                  },
                  {
                    key: "composer",
                    header: "作曲",
                    render: (row) =>
                      row.composerId !== null && row.composerName && onOpenCreator ? (
                        <LinkTextButton onClick={() => onOpenCreator(row.composerId!)}>
                          {row.composerName}
                        </LinkTextButton>
                      ) : (
                        row.composerName || "-"
                      ),
                  },
                  {
                    key: "arranger",
                    header: "編曲",
                    render: (row) =>
                      row.arrangerId !== null && row.arrangerName && onOpenCreator ? (
                        <LinkTextButton onClick={() => onOpenCreator(row.arrangerId!)}>
                          {row.arrangerName}
                        </LinkTextButton>
                      ) : (
                        row.arrangerName || "-"
                      ),
                  },
                  {
                    key: "performanceCount",
                    header: "演奏",
                    render: (row) => row.performanceCount,
                  },
                  {
                    key: "albumTrackCount",
                    header: "収録",
                    render: (row) => row.albumTrackCount,
                  },
                  {
                    key: "streaming",
                    header: "",
                    render: (row) => {
                      const safeNodeeUrl = toSafeNodeeUrl(row.nodeeUrl)
                      return safeNodeeUrl ? (
                        <a
                          href={safeNodeeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="配信で再生"
                          title="配信で再生"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-none border border-gray-800 text-slate-800 hover:bg-slate-100"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </a>
                      ) : (
                        "-"
                      )
                    },
                  },
                ]}
              />
            )}
          </DetailPanel>
        ) : null}

        {albums.length > 0 ? (
          <DetailPanel className="p-3 lg:p-3">
            <h2 className="mb-2 text-base font-semibold text-slate-900">収録アルバム</h2>
            {albumCategoryTabs.length > 1 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedAlbumCategory("all")}
                  className={`rounded-none border-2 px-2 py-1 text-xs font-semibold ${
                    selectedAlbumCategory === "all"
                      ? "border-gray-800 bg-gray-800 text-white"
                      : "border-gray-800 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  すべて
                </button>
                {albumCategoryTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setSelectedAlbumCategory(tab.value)}
                    className={`rounded-none border-2 px-2 py-1 text-xs font-semibold ${
                      selectedAlbumCategory === tab.value
                        ? "border-gray-800 bg-gray-800 text-white"
                        : "border-gray-800 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}

            <ul className="divide-y divide-gray-300 border-y border-gray-300">
              {filteredAlbums.map((album) => (
                <li key={album.albumId} className="px-1 py-1.5">
                  <LinkTextButton
                    onClick={() => onOpenAlbum(album.albumId)}
                    className="text-sm font-medium text-blue-700"
                  >
                    {album.albumName}
                  </LinkTextButton>
                  <p className="text-xs text-slate-600">
                    {formatDateYmd(album.releaseDate)} / {categoryLabel(album.category)} /{" "}
                    <LinkTextButton onClick={() => onOpenArtist(album.artistId)} className="text-blue-700">
                      {album.artistName}
                    </LinkTextButton>
                  </p>
                </li>
              ))}
            </ul>
          </DetailPanel>
        ) : null}

        {setlists.length > 0 ? (
        <DetailPanel className="p-3 lg:p-3">
        <DetailSectionHeader
          title="セットリスト履歴"
          right={<DetailViewModeToggle value={activeTab} onChange={setActiveTab} />}
          below={
            activeTab === "list" && eventTagOptions.length > 0 ? (
              <TagFilterChips
                options={eventTagOptions}
                selected={selectedEventTags}
                onChange={setSelectedEventTags}
                className="text-xs"
              />
            ) : null
          }
          belowClassName="mb-1"
        />

        {activeTab === "list" ? (
          <>
            <DetailResponsiveTable
              rows={filteredEventGroupedSetlists}
              rowKey={(row) => row.eventId}
              initialPageSize={25}
              pageSizeOptions={[25, 50, 100]}
              mobileRowClassName="border-b border-slate-300 bg-white px-1 py-1.5 first:border-t first:border-slate-300"
              columns={[
                {
                  key: "date",
                  header: "日付",
                  mobileHidden: true,
                  sortValue: (row) => row.sortDate ?? "",
                  render: (row) => row.dateLabel,
                },
                {
                  key: "event",
                  header: "イベント",
                  mobileHidden: true,
                  sortValue: (row) => row.eventName,
                  render: (row) => (
                    <LinkTextButton onClick={() => onOpenEvent(row.eventId)}>
                      {row.eventName}
                    </LinkTextButton>
                  ),
                },
                {
                  key: "venue",
                  header: "会場",
                  mobileHidden: true,
                  sortValue: (row) => row.venueLabel,
                  render: (row) => row.venueLabel,
                },
                {
                  key: "performer",
                  header: "歌唱者",
                  mobileHidden: true,
                  sortValue: (row) => row.performerLabel,
                  render: (row) => row.performerLabel,
                },
                {
                  key: "version",
                  header: "Version",
                  mobileHidden: true,
                  sortValue: (row) => row.versionLabel,
                  render: (row) => row.versionLabel,
                },
                {
                  key: "rowCount",
                  header: "件数",
                  mobileHidden: true,
                  sortValue: (row) => row.rowCount,
                  render: (row) => row.rowCount,
                },
                {
                  key: "mobileSetlistHistory",
                  header: "",
                  desktopClassName: "md:hidden",
                  mobileLabelClassName: "hidden",
                  mobileValueClassName: "col-span-2",
                  render: (row) => (
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex min-w-0 items-start gap-2">
                        <LinkTextButton
                          onClick={() => onOpenEvent(row.eventId)}
                          className="min-w-0 flex-1 truncate text-left text-xs font-semibold leading-4 text-blue-700"
                        >
                          {row.eventName}
                        </LinkTextButton>
                        {row.rowCount > 1 ? (
                          <span className="shrink-0 border border-slate-300 bg-slate-50 px-1 text-[10px] font-semibold leading-4 text-slate-600">
                            {row.rowCount}回
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] leading-4 text-slate-500">
                        {row.dateLabel} / {row.venueLabel}
                      </p>
                      {row.performerLabel !== "-" || row.versionLabel !== "-" ? (
                        <p className="truncate text-[11px] leading-4 text-slate-500">
                          {row.performerLabel !== "-" ? row.performerLabel : ""}
                          {row.performerLabel !== "-" && row.versionLabel !== "-" ? " / " : ""}
                          {row.versionLabel !== "-" ? row.versionLabel : ""}
                        </p>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          </>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DetailAnalysisPanel title="概要" eyebrow="SIGNAL">
              <DetailMetricGrid className="md:grid-cols-4">
                <DetailMetricItem
                  label="総演奏回数"
                  value={analysis.totalPerformances}
                  rankText={formatTopRank(
                    topPercentiles?.performanceRank,
                    topPercentiles?.performanceTopPercent,
                  )}
                  rankClassName={`text-[11px] font-semibold ${rankToneClass(topPercentiles?.performanceRank)}`}
                  accentColor={DETAIL_ANALYSIS_COLORS[0]}
                />
                <DetailMetricItem
                  label="イベント数"
                  value={analysis.totalEvents}
                  rankText={formatTopRank(
                    topPercentiles?.eventRank,
                    topPercentiles?.eventTopPercent,
                  )}
                  rankClassName={`text-[11px] font-semibold ${rankToneClass(topPercentiles?.eventRank)}`}
                  accentColor={DETAIL_ANALYSIS_COLORS[1]}
                />
                <DetailMetricItem
                  label="会場数"
                  value={analysis.totalVenues}
                  rankText={formatTopRank(
                    topPercentiles?.venueRank,
                    topPercentiles?.venueTopPercent,
                  )}
                  rankClassName={`text-[11px] font-semibold ${rankToneClass(topPercentiles?.venueRank)}`}
                  accentColor={DETAIL_ANALYSIS_COLORS[2]}
                />
                <DetailMetricItem
                  label="タグ種類数"
                  value={analysis.totalTagKinds}
                  rankText={formatTopRank(
                    topPercentiles?.tagKindsRank,
                    topPercentiles?.tagKindsTopPercent,
                  )}
                  rankClassName={`text-[11px] font-semibold ${rankToneClass(topPercentiles?.tagKindsRank)}`}
                  accentColor={DETAIL_ANALYSIS_COLORS[3]}
                />
              </DetailMetricGrid>
            </DetailAnalysisPanel>

            <DetailAnalysisPanel title="セクション別" eyebrow="PARTS">
              <DetailInlineBarList rows={analysis.sortedSections} maxItems={7} />
            </DetailAnalysisPanel>

            <DetailTagBarChart
              className="md:col-span-2"
              title="イベントタグ別演奏回数"
              rows={analysis.sortedTags}
              totalKinds={analysis.totalTagKinds}
              maxItems={5}
            />
          </div>
        )}
        </DetailPanel>
        ) : null}
      </div>

      {primaryNodeeUrl || versionMvRows.length > 0 ? (
        <div className="hidden w-[280px] shrink-0 lg:block">
          <div className="space-y-3">
            {primaryNodeeUrl ? (
              <DetailPanel className="p-2">
                <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                  STREAMING
                </p>
                <MusicServicePlayControls
                  nodeeUrl={primaryNodeeUrl}
                  title={song.songName}
                  compact={true}
                  showExternalLink={false}
                  className="mt-0 w-full max-w-none"
                />
              </DetailPanel>
            ) : null}
            {versionMvRows.length > 0 ? (
              <DetailPanel className="p-2">
                <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                  MV
                </p>
                <div className="space-y-2">
                  {versionMvRows.map((row) =>
                    row.youtubeIds.map((youtubeId, index) => (
                      <div
                        key={`side-${row.rowKey}-${youtubeId}-${index}`}
                        className="relative aspect-video w-full overflow-hidden bg-black"
                      >
                        <iframe
                          title={`official-mv-side-${row.rowKey}-${index}`}
                          src={toYouTubeEmbedUrl(youtubeId)}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                          className="absolute inset-0 h-full w-full border-0"
                        />
                      </div>
                    )),
                  )}
                </div>
              </DetailPanel>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function detectDetailMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767px)").matches
  )
}

function useDetailMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => detectDetailMobileViewport())

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return

    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(mediaQuery.matches)
    update()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update)
      return () => mediaQuery.removeEventListener("change", update)
    }

    mediaQuery.addListener(update)
    return () => mediaQuery.removeListener(update)
  }, [])

  return isMobile
}

type SongVersionMobileListProps = {
  versions: SongVersionDetail[]
  onOpenArtist: (artistId: number) => void
  onOpenCreator?: (creatorId: number) => void
}

function SongVersionMobileList({
  versions,
  onOpenArtist,
  onOpenCreator,
}: SongVersionMobileListProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  return (
    <ul className="divide-y divide-slate-200 border-y border-slate-300">
      {versions.map((version, index) => {
        const rowKey = `${version.songVersionId ?? 0}-${version.versionName}-${index}`
        const safeNodeeUrl = toSafeNodeeUrl(version.nodeeUrl)
        const isExpanded = expandedKey === rowKey
        const credits = getVersionCredits(version)

        return (
          <li key={rowKey} className="px-1 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-5 tracking-tight text-slate-900">
                  {version.versionName}
                </p>
                <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-slate-500">
                  {version.artistId && version.artistName ? (
                    <LinkTextButton
                      onClick={() => onOpenArtist(version.artistId!)}
                      className="min-w-0 truncate text-left font-semibold text-blue-700"
                    >
                      {version.artistName}
                    </LinkTextButton>
                  ) : (
                    <span className="min-w-0 truncate">{version.artistName || "-"}</span>
                  )}
                  <span className="shrink-0 border-l border-slate-300 pl-1.5">
                    演奏 {version.performanceCount}
                  </span>
                  <span className="shrink-0">収録 {version.albumTrackCount}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {safeNodeeUrl ? (
                  <a
                    href={safeNodeeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="配信で再生"
                    title="配信で再生"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-none border border-slate-400 bg-white text-slate-800 hover:border-gray-800 hover:bg-slate-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setExpandedKey(isExpanded ? null : rowKey)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Version詳細を閉じる" : "Version全文を表示"}: ${version.versionName}`}
                  className="group inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <span
                    className={`relative h-3.5 w-3.5 transition-transform duration-150 ${
                      isExpanded ? "rotate-45" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                    <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
                  </span>
                </button>
              </div>
            </div>

            {credits.length > 0 ? (
              <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
                {credits.map((credit) => (
                  <VersionCreditChip
                    key={credit.label}
                    label={credit.shortLabel}
                    name={credit.name}
                    creatorId={credit.creatorId}
                    onOpenCreator={onOpenCreator}
                  />
                ))}
              </div>
            ) : null}

            {isExpanded ? (
              <dl className="mt-2 grid grid-cols-[56px_1fr] gap-x-2 gap-y-1 border-l-2 border-gray-800 bg-slate-50 px-2 py-2 text-xs leading-5">
                <dt className="font-semibold text-slate-500">Version</dt>
                <dd className="min-w-0 break-words text-slate-900">{version.versionName}</dd>
                <dt className="font-semibold text-slate-500">Artist</dt>
                <dd className="min-w-0 text-slate-900">
                  {version.artistId && version.artistName ? (
                    <LinkTextButton
                      onClick={() => onOpenArtist(version.artistId!)}
                      className="text-blue-700"
                    >
                      {version.artistName}
                    </LinkTextButton>
                  ) : (
                    version.artistName || "-"
                  )}
                </dd>
                {credits.map((credit) => (
                  <div key={`${credit.label}-expanded`} className="contents">
                    <dt className="font-semibold text-slate-500">{credit.label}</dt>
                    <dd className="min-w-0 text-slate-900">
                      <VersionCreditValue
                        name={credit.name}
                        creatorId={credit.creatorId}
                        onOpenCreator={onOpenCreator}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function getVersionCredits(version: SongVersionDetail) {
  return [
    { label: "作詞", shortLabel: "詞", name: version.lyricistName, creatorId: version.lyricistId },
    { label: "作曲", shortLabel: "曲", name: version.composerName, creatorId: version.composerId },
    { label: "編曲", shortLabel: "編", name: version.arrangerName, creatorId: version.arrangerId },
  ].filter((credit) => Boolean(credit.name))
}

type VersionCreditChipProps = {
  label: string
  name: string | null
  creatorId: number | null
  onOpenCreator?: (creatorId: number) => void
}

function VersionCreditChip({
  label,
  name,
  creatorId,
  onOpenCreator,
}: VersionCreditChipProps) {
  return (
    <span className="inline-flex max-w-[11rem] shrink-0 items-center gap-1 border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] leading-4 text-slate-600">
      <span className="shrink-0 font-semibold text-slate-500">{label}</span>
      <VersionCreditValue
        name={name}
        creatorId={creatorId}
        onOpenCreator={onOpenCreator}
        className="truncate"
      />
    </span>
  )
}

type VersionCreditValueProps = {
  name: string | null
  creatorId: number | null
  onOpenCreator?: (creatorId: number) => void
  className?: string
}

function VersionCreditValue({
  name,
  creatorId,
  onOpenCreator,
  className = "",
}: VersionCreditValueProps) {
  if (!name) return "-"
  if (creatorId !== null && onOpenCreator) {
    return (
      <LinkTextButton
        onClick={() => onOpenCreator(creatorId)}
        className={`min-w-0 text-blue-700 ${className}`.trim()}
      >
        {name}
      </LinkTextButton>
    )
  }
  return <span className={`min-w-0 ${className}`.trim()}>{name}</span>
}
