import { useEffect } from "react"

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

import type { SetlistSearchDb } from "../../lib/setlistSearchDb/types"

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
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <div className="min-w-0 rounded-none border-2 border-gray-800 bg-slate-50 px-2 py-1">
            <span className="text-[11px] text-slate-500">楽曲数</span>
            <p className="mt-0.5 break-all text-sm font-semibold leading-tight text-slate-900">{detail.totalSongs}</p>
          </div>
          <div className="min-w-0 rounded-none border-2 border-gray-800 bg-slate-50 px-2 py-1">
            <span className="text-[11px] text-slate-500">アルバム数</span>
            <p className="mt-0.5 break-all text-sm font-semibold leading-tight text-slate-900">{detail.totalAlbums}</p>
          </div>
          <div className="min-w-0 rounded-none border-2 border-gray-800 bg-slate-50 px-2 py-1">
            <span className="text-[11px] text-slate-500">演奏回数</span>
            <p className="mt-0.5 break-all text-sm font-semibold leading-tight text-slate-900">{detail.totalPerformances}</p>
          </div>
          <div className="min-w-0 rounded-none border-2 border-gray-800 bg-slate-50 px-2 py-1">
            <span className="text-[11px] text-slate-500">最終歌唱日</span>
            <p className="mt-0.5 break-all text-sm font-semibold leading-tight text-slate-900">{formatDateYmd(detail.lastPerformedDate)}</p>
          </div>
        </div>
        {showPersonLink || showGroupLink ? (
          <div className="mt-2 flex flex-wrap justify-end gap-2 text-xs">
            {showPersonLink ? (
              <button
                type="button"
                onClick={() => onOpenMember(detail.personId!)}
                className="inline-flex rounded-none border-2 border-gray-800 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-100"
              >
                人物詳細へ{detail.personName ? ` (${detail.personName})` : ""}
              </button>
            ) : null}
            {showGroupLink ? (
              <button
                type="button"
                onClick={() => onOpenGroup(detail.groupId!)}
                className="inline-flex rounded-none border-2 border-gray-800 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-100"
              >
                グループ詳細へ{detail.groupName ? ` (${detail.groupName})` : ""}
              </button>
            ) : null}
          </div>
        ) : null}
      </DetailPanel>

      {songs.length > 0 ? (
        <DetailPanel className="p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">楽曲一覧</h2>
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
        </DetailPanel>
      ) : null}

      {albums.length > 0 ? (
        <DetailPanel className="p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">アルバム一覧</h2>
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
        </DetailPanel>
      ) : null}
    </div>
  )
}
