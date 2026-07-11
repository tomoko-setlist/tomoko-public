import { useEffect, useState } from "react"

import {
  DetailErrorState,
  DetailLoadingState,
  DetailNotFoundState,
  DetailPanel,
  DetailResponsiveTable,
  DetailShareLinkButton,
} from "./DetailUi"
import { useAlbumCategoryFilter } from "./hooks/useAlbumCategoryFilter"
import { useArtistDetail } from "./hooks/useArtistDetail"
import { categoryLabel, formatDateYmd } from "../../lib/uiFormat"

import type { AlbumDetail, SetlistSearchDb, SongSearchRow } from "../../lib/setlistSearchDb/types"

type ArtistDetailPageProps = {
  db: SetlistSearchDb
  artistId: number
  onResolveTitle?: (title: string) => void
  onOpenSong: (songId: number) => void
  onOpenAlbum: (albumId: number) => void
  onOpenMember: (personId: number) => void
  onOpenGroup: (groupId: number) => void
}

const SUBJECT_TYPE_PERSON = 10
const SUBJECT_TYPE_GROUP = 20

export function ArtistDetailPage({
  db,
  artistId,
  onResolveTitle,
  onOpenSong,
  onOpenAlbum,
  onOpenMember,
  onOpenGroup,
}: ArtistDetailPageProps) {
  const { loading, error, detail, songs, albums } = useArtistDetail(db, artistId)
  const { selectedAlbumCategory, setSelectedAlbumCategory, albumCategoryTabs, filteredAlbums } = useAlbumCategoryFilter(albums)
  const isMobileList = useDetailMobileViewport()

  useEffect(() => {
    if (detail?.artistName) {
      onResolveTitle?.(detail.artistName)
    }
  }, [detail?.artistName, onResolveTitle])

  if (loading) return <DetailLoadingState />
  if (error) return <DetailErrorState message={error} />
  if (!detail) return <DetailNotFoundState message="アーティストが見つかりませんでした。" />
  const showPersonLink = detail.subjectType === SUBJECT_TYPE_PERSON && detail.personId !== null
  const showGroupLink = detail.subjectType === SUBJECT_TYPE_GROUP && detail.groupId !== null

  return (
    <div className="space-y-4">
      <DetailPanel className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">ARTIST</p>
            <h1 className="min-w-0 break-words text-lg font-bold text-slate-900">{detail.artistName}</h1>
          </div>
          <DetailShareLinkButton />
        </div>
        <div className="mt-3 border-y border-slate-300 py-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
            <ArtistMetric label="楽曲" value={detail.totalSongs} />
            <ArtistMetric label="アルバム" value={detail.totalAlbums} />
            <ArtistMetric label="演奏" value={detail.totalPerformances} />
            <ArtistMetric label="最終" value={formatDateYmd(detail.lastPerformedDate)} />
          </div>
        </div>
        {showPersonLink || showGroupLink ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {showPersonLink ? (
              <button
                type="button"
                onClick={() => onOpenMember(detail.personId!)}
                className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
              >
                人物詳細{detail.personName ? `: ${detail.personName}` : ""}
              </button>
            ) : null}
            {showGroupLink ? (
              <button
                type="button"
                onClick={() => onOpenGroup(detail.groupId!)}
                className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
              >
                グループ詳細{detail.groupName ? `: ${detail.groupName}` : ""}
              </button>
            ) : null}
          </div>
        ) : null}
      </DetailPanel>

      {songs.length > 0 ? (
        <DetailPanel className="p-4">
          <DetailListHeader title="楽曲一覧" count={songs.length} />
          {isMobileList ? (
            <ArtistSongMobileList rows={songs} onOpenSong={onOpenSong} />
          ) : (
            <DetailResponsiveTable
              rows={songs}
              rowKey={(row) => row.songId}
              columns={[
                {
                  key: "songName",
                  header: "楽曲名",
                  render: (row) => (
                    <button
                      type="button"
                      onClick={() => onOpenSong(row.songId)}
                      className="text-left text-blue-600 hover:underline"
                    >
                      {row.songName}
                    </button>
                  ),
                },
                {
                  key: "performances",
                  header: "歌唱回数",
                  render: (row) => row.totalPerformances,
                },
                {
                  key: "lastDate",
                  header: "最終歌唱日",
                  render: (row) => formatDateYmd(row.lastPerformedDate),
                },
              ]}
            />
          )}
        </DetailPanel>
      ) : null}

      {albums.length > 0 ? (
        <DetailPanel className="p-4">
          <DetailListHeader title="アルバム一覧" count={filteredAlbums.length} />
          {albumCategoryTabs.length > 1 ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
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
          {isMobileList ? (
            <ArtistAlbumMobileList rows={filteredAlbums} onOpenAlbum={onOpenAlbum} />
          ) : (
            <DetailResponsiveTable
              rows={filteredAlbums}
              rowKey={(row) => row.albumId}
              columns={[
                {
                  key: "albumName",
                  header: "アルバム名",
                  render: (row) => (
                    <button
                      type="button"
                      onClick={() => onOpenAlbum(row.albumId)}
                      className="text-left text-blue-600 hover:underline"
                    >
                      {row.albumName}
                    </button>
                  ),
                },
                {
                  key: "category",
                  header: "カテゴリ",
                  render: (row) => categoryLabel(row.category),
                },
                {
                  key: "releaseDate",
                  header: "発売日",
                  render: (row) => formatDateYmd(row.releaseDate),
                },
                {
                  key: "trackCount",
                  header: "曲数",
                  render: (row) => row.trackCount,
                },
              ]}
            />
          )}
        </DetailPanel>
      ) : null}
    </div>
  )
}

type ArtistMetricProps = {
  label: string
  value: string | number
}

function ArtistMetric({ label, value }: ArtistMetricProps) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-base font-semibold leading-tight text-slate-900">{value}</p>
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

type DetailListHeaderProps = {
  title: string
  count: number
}

function DetailListHeader({ title, count }: DetailListHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <span className="shrink-0 border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
        全{count}件
      </span>
    </div>
  )
}

type ArtistSongMobileListProps = {
  rows: SongSearchRow[]
  onOpenSong: (songId: number) => void
}

function ArtistSongMobileList({ rows, onOpenSong }: ArtistSongMobileListProps) {
  return (
    <ul className="divide-y divide-slate-200 border-y border-slate-300">
      {rows.map((row) => (
        <li key={row.songId} className="px-1 py-2.5">
          <button
            type="button"
            onClick={() => onOpenSong(row.songId)}
            className="block w-full min-w-0 text-left"
          >
            <span className="block truncate text-sm font-semibold leading-5 tracking-tight text-blue-700">
              {row.songName}
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-slate-500">
              <span className="shrink-0">歌唱 {row.totalPerformances}</span>
              <span className="shrink-0 border-l border-slate-300 pl-1.5">
                最終 {formatDateYmd(row.lastPerformedDate)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

type ArtistAlbumMobileListProps = {
  rows: AlbumDetail[]
  onOpenAlbum: (albumId: number) => void
}

function ArtistAlbumMobileList({ rows, onOpenAlbum }: ArtistAlbumMobileListProps) {
  return (
    <ul className="divide-y divide-slate-200 border-y border-slate-300">
      {rows.map((row) => (
        <li key={row.albumId} className="px-1 py-2.5">
          <button
            type="button"
            onClick={() => onOpenAlbum(row.albumId)}
            className="block w-full min-w-0 text-left"
          >
            <span className="block truncate text-sm font-semibold leading-5 tracking-tight text-blue-700">
              {row.albumName}
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-slate-500">
              <span className="shrink-0">{categoryLabel(row.category)}</span>
              <span className="shrink-0 border-l border-slate-300 pl-1.5">
                {formatDateYmd(row.releaseDate)}
              </span>
              <span className="shrink-0">{row.trackCount}曲</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
