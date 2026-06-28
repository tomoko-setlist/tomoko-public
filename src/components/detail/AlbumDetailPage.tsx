import { useEffect } from "react"

import {
  DetailErrorState,
  DetailLoadingState,
  DetailNotFoundState,
  DetailPanel,
  DetailResponsiveTable,
  DetailShareLinkButton,
} from "./DetailUi"
import { useAlbumDetail } from "./hooks/useAlbumDetail"
import { MusicServicePlayControls } from "./MusicServicePlayControls"
import { categoryLabel, formatDateYmd } from "../../lib/uiFormat"
import { toSafeExternalUrl, toSafeNodeeUrl } from "../../shared/url/externalUrl"
import { LinkTextButton } from "../ui"

import type { AlbumTrack, SetlistSearchDb } from "../../lib/setlistSearchDb/types"

type AlbumDetailPageProps = {
  db: SetlistSearchDb
  albumId: number
  onResolveTitle?: (title: string) => void
  onOpenSong: (songId: number) => void
  onOpenArtist: (artistId: number) => void
}

export function AlbumDetailPage({ db, albumId, onResolveTitle, onOpenSong, onOpenArtist }: AlbumDetailPageProps) {
  const { loading, error, album, tracks } = useAlbumDetail(db, albumId)

  useEffect(() => {
    if (album?.albumName) {
      onResolveTitle?.(album.albumName)
    }
  }, [album?.albumName, onResolveTitle])

  if (loading) return <DetailLoadingState />
  if (error) return <DetailErrorState message={error} />
  if (!album) return <DetailNotFoundState message="アルバムが見つかりませんでした。" />

  const resolveTrackVersions = (track: AlbumTrack) =>
    track.songVersions.length > 0
      ? track.songVersions
        : [
          {
            songVersionId: track.songVersionId,
            songId: track.songId,
            versionName: track.versionName,
            songName: track.songName,
            artistId: track.artistId,
            artistName: track.artistName,
          },
        ]

  const safeAlbumLink = toSafeExternalUrl(album.link)
  const primaryNodeeUrl = toSafeNodeeUrl(album.nodeeUrl)

  return (
    <div className="space-y-3 lg:flex lg:items-start lg:gap-4 lg:space-y-0">
      <div className="min-w-0 flex-1 space-y-3">
        <DetailPanel className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">ALBUM</p>
              <h1 className="min-w-0 break-words text-lg font-bold text-slate-900">{album.albumName}</h1>
            </div>
            <DetailShareLinkButton className="ml-auto" />
          </div>
          <div className="mt-2 min-w-0">
            <p className="mt-1 text-sm text-slate-600">
              <button
                type="button"
                onClick={() => onOpenArtist(album.artistId)}
                className="text-left text-blue-700 hover:underline"
              >
                {album.artistName}
              </button>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {formatDateYmd(album.releaseDate)} / {categoryLabel(album.category)} / {album.trackCount} 曲
            </p>
            {safeAlbumLink ? (
              <p className="mt-1 text-sm text-slate-600">
                公式ページ:{" "}
                <a
                  href={safeAlbumLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline break-all"
                >
                  {safeAlbumLink}
                </a>
              </p>
            ) : null}
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

        {tracks.length > 0 ? (
          <DetailPanel className="p-3">
            <h2 className="mb-2 text-base font-semibold text-slate-900">収録曲</h2>
            <DetailResponsiveTable
              rows={tracks}
              rowKey={(track) => track.albumTrackId}
              disablePagination={true}
              columns={[
            {
              key: "trackNumber",
              header: "#",
              render: (track) => track.trackNumber,
            },
            {
              key: "song",
              header: "曲名",
              render: (track) => {
                const versions = resolveTrackVersions(track)
                if (versions.length === 0) return "-"
                return (
                  <span className="break-words">
                    {versions.map((entry, index) => (
                      <span key={`${track.albumTrackId}-song-${entry.songVersionId ?? "null"}-${index}`}>
                        {index > 0 ? " / " : ""}
                        {entry.songId ? (
                          <LinkTextButton onClick={() => onOpenSong(entry.songId as number)}>
                            {entry.songName || "-"}
                          </LinkTextButton>
                        ) : (
                          <span>{entry.songName || "-"}</span>
                        )}
                      </span>
                    ))}
                  </span>
                )
              },
            },
            {
              key: "version",
              header: "バージョン",
              render: (track) => {
                const labels = resolveTrackVersions(track)
                  .map((entry) => entry.versionName?.trim())
                  .filter((value): value is string => Boolean(value))
                if (labels.length === 0) return "-"
                return Array.from(new Set(labels)).join(" / ")
              },
            },
            {
              key: "artist",
              header: "アーティスト",
              render: (track) => {
                const versions = resolveTrackVersions(track)
                if (versions.length === 0) return "-"
                return (
                  <span className="break-words">
                    {versions.map((entry, index) => (
                      <span key={`${track.albumTrackId}-artist-${entry.artistId ?? "null"}-${index}`}>
                        {index > 0 ? " / " : ""}
                        {entry.artistId !== null && entry.artistName ? (
                          <LinkTextButton onClick={() => onOpenArtist(entry.artistId as number)}>
                            {entry.artistName}
                          </LinkTextButton>
                        ) : (
                          <span>{entry.artistName || "-"}</span>
                        )}
                      </span>
                    ))}
                  </span>
                )
              },
            },
              ]}
            />
          </DetailPanel>
        ) : null}
      </div>

      {primaryNodeeUrl ? (
        <div className="hidden w-[280px] shrink-0 lg:block">
          <DetailPanel className="p-2">
            <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-slate-500">
              STREAMING
            </p>
            <MusicServicePlayControls
              nodeeUrl={primaryNodeeUrl}
              title={album.albumName}
              compact={true}
              showExternalLink={false}
              className="mt-0 w-full max-w-none"
            />
          </DetailPanel>
        </div>
      ) : null}
    </div>
  )
}
