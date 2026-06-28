export type AppleMusicTrackSeed = {
  songName: string
  artistName?: string | null
}

export type AppleMusicCreatePlaylistInput = {
  playlistName: string
  description?: string
  tracks: AppleMusicTrackSeed[]
}

export type AppleMusicCreatePlaylistResult = {
  playlistId: string
  playlistUrl: string | null
  addedCount: number
  unresolvedTracks: AppleMusicTrackSeed[]
}

type AppleMusicDeveloperTokenResponse = {
  developerToken?: string
}

type AppleMusicApiError = {
  error?: string
}

type MusicKitInstance = {
  authorize: () => Promise<string>
}

type MusicKitNamespace = {
  configure: (options: { developerToken: string; app: { name: string; build: string } }) => void
  getInstance: () => MusicKitInstance
}

declare global {
  interface Window {
    MusicKit?: MusicKitNamespace
  }
}

let musicKitLoaderPromise: Promise<void> | null = null

const loadMusicKit = async (): Promise<void> => {
  if (typeof window === "undefined") throw new Error("apple_music_not_available")
  if (window.MusicKit) return
  if (!musicKitLoaderPromise) {
    musicKitLoaderPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js"
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("MusicKitの読み込みに失敗しました。"))
      document.head.appendChild(script)
    })
  }
  await musicKitLoaderPromise
}

const fetchDeveloperToken = async (): Promise<string> => {
  const response = await fetch("/api/apple-music/developer-token")
  if (!response.ok) {
    let error = `Apple Music API ${response.status}`
    try {
      const payload = (await response.json()) as AppleMusicApiError
      if (typeof payload.error === "string" && payload.error.trim()) error = payload.error
    } catch {
      // ignore
    }
    throw new Error(error)
  }
  const payload = (await response.json()) as AppleMusicDeveloperTokenResponse
  const token = String(payload.developerToken ?? "").trim()
  if (!token) throw new Error("apple_music_not_configured")
  return token
}

const authorizeAppleMusic = async (): Promise<string> => {
  await loadMusicKit()
  const developerToken = await fetchDeveloperToken()
  const musicKit = window.MusicKit
  if (!musicKit) throw new Error("apple_music_not_available")
  musicKit.configure({
    developerToken,
    app: {
      name: "ToMoKo",
      build: "1.0.0",
    },
  })
  const instance = musicKit.getInstance()
  return instance.authorize()
}

export const createAppleMusicPlaylistFromTracks = async (
  input: AppleMusicCreatePlaylistInput,
): Promise<AppleMusicCreatePlaylistResult> => {
  const userToken = await authorizeAppleMusic()
  if (!userToken) throw new Error("apple_music_auth_required")

  const response = await fetch("/api/apple-music/create-playlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-apple-music-user-token": userToken,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    let error = `Apple Music API ${response.status}`
    try {
      const payload = (await response.json()) as AppleMusicApiError
      if (typeof payload.error === "string" && payload.error.trim()) {
        error = payload.error
      }
    } catch {
      // ignore
    }
    throw new Error(error)
  }

  return (await response.json()) as AppleMusicCreatePlaylistResult
}
