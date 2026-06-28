import { useEffect, useState } from "react"

import type {
  ArtistProfileRow,
  GroupMembershipRow,
  GroupRoleRow,
  MemberColorRow,
  MemberDetail,
  MemberProfile,
  RelatedEventRow,
  SetlistSearchDb,
} from "../../../lib/setlistSearchDb/types"

type MemberDetailState = {
  loading: boolean
  error: string
  detail: MemberDetail | null
  profile: MemberProfile | null
  groups: GroupMembershipRow[]
  colors: MemberColorRow[]
  artists: ArtistProfileRow[]
  roles: GroupRoleRow[]
  events: RelatedEventRow[]
  loadingExtras: boolean
}

export function useMemberDetail(db: SetlistSearchDb, personId: number): MemberDetailState {
  const [loading, setLoading] = useState(true)
  const [loadingExtras, setLoadingExtras] = useState(false)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [groups, setGroups] = useState<GroupMembershipRow[]>([])
  const [colors, setColors] = useState<MemberColorRow[]>([])
  const [artists, setArtists] = useState<ArtistProfileRow[]>([])
  const [roles, setRoles] = useState<GroupRoleRow[]>([])
  const [events, setEvents] = useState<RelatedEventRow[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setLoadingExtras(false)
      setError("")
      try {
        const dbCompat = db as Partial<SetlistSearchDb>
        const profilePromise =
          typeof dbCompat.getMemberProfile === "function"
            ? dbCompat.getMemberProfile(personId)
            : Promise.resolve<MemberProfile | null>(null)

        const [detailResult, profileResult, groupRows, artistRows, roleRows] =
          await Promise.all([
            db.getMemberDetail(personId),
            profilePromise,
            db.getMemberGroups(personId, 200),
            db.getMemberArtists(personId, 200),
            db.getMemberGroupRoles(personId, 200),
          ])
        if (!cancelled) {
          setDetail(detailResult)
          setProfile(profileResult)
          setGroups(groupRows)
          setArtists(artistRows)
          setRoles(roleRows)
          setLoading(false)
          setLoadingExtras(true)
        }

        const colorsPromise =
          typeof dbCompat.getMemberColors === "function"
            ? dbCompat.getMemberColors(personId, 200)
            : Promise.resolve<MemberColorRow[]>([])
        const eventsPromise =
          typeof dbCompat.getMemberEvents === "function"
            ? dbCompat.getMemberEvents(personId)
            : Promise.resolve<RelatedEventRow[]>([])

        const [colorRows, eventRows] = await Promise.all([colorsPromise, eventsPromise])
        if (!cancelled) {
          setColors(colorRows)
          setEvents(eventRows)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadingExtras(false)
        }
      }
    }
    void run()
    return () => { cancelled = true }
  }, [db, personId])

  return { loading, error, detail, profile, groups, colors, artists, roles, events, loadingExtras }
}
