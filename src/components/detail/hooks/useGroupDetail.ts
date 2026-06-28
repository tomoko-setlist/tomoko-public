import { useEffect, useState } from "react"

import type {
  AlbumDetail,
  ArtistProfileRow,
  GroupDetail,
  GroupMembershipRow,
  RelatedEventRow,
  SetlistSearchDb,
} from "../../../lib/setlistSearchDb/types"

type GroupDetailState = {
  loading: boolean
  error: string
  detail: GroupDetail | null
  members: GroupMembershipRow[]
  artists: ArtistProfileRow[]
  albums: AlbumDetail[]
  events: RelatedEventRow[]
}

export function useGroupDetail(db: SetlistSearchDb, groupId: number): GroupDetailState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [members, setMembers] = useState<GroupMembershipRow[]>([])
  const [artists, setArtists] = useState<ArtistProfileRow[]>([])
  const [albums, setAlbums] = useState<AlbumDetail[]>([])
  const [events, setEvents] = useState<RelatedEventRow[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError("")
      try {
        const [detailResult, memberRows, artistRows, albumRows, eventRows] = await Promise.all([
          db.getGroupDetail(groupId),
          db.getGroupMembers(groupId, 300),
          db.getGroupArtists(groupId, 200),
          db.getGroupAlbums(groupId, 200),
          db.getGroupEvents(groupId),
        ])
        if (!cancelled) {
          setDetail(detailResult)
          setMembers(memberRows)
          setArtists(artistRows)
          setAlbums(albumRows)
          setEvents(eventRows)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [db, groupId])

  return { loading, error, detail, members, artists, albums, events }
}
