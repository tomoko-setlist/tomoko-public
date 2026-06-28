export type MusicServiceId = "spotify" | "appleMusic" | "youtubeMusic" | "amazonMusic";

export type MusicServiceOption = {
  id: MusicServiceId;
  label: string;
};

const STORAGE_KEY = "tomoko:preferredMusicService";

export const MUSIC_SERVICE_OPTIONS: MusicServiceOption[] = [
  { id: "spotify", label: "Spotify" },
  { id: "appleMusic", label: "Apple Music" },
  { id: "youtubeMusic", label: "YouTube Music" },
  { id: "amazonMusic", label: "Amazon Music" },
];

const MUSIC_SERVICE_SET = new Set<MusicServiceId>(MUSIC_SERVICE_OPTIONS.map((option) => option.id));

export const DEFAULT_MUSIC_SERVICE: MusicServiceId = "spotify";

const normalizeQueryPart = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .trim();

export const isIosDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  const platform = navigator.platform ?? "";
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
};

export const buildMusicSearchQuery = (songName: string, artistName: string): string =>
  [normalizeQueryPart(songName), normalizeQueryPart(artistName)].filter(Boolean).join(" ");

export const getMusicServiceLabel = (service: MusicServiceId): string =>
  MUSIC_SERVICE_OPTIONS.find((option) => option.id === service)?.label ?? "Music";

export const isMusicServiceId = (value: string | null | undefined): value is MusicServiceId =>
  !!value && MUSIC_SERVICE_SET.has(value as MusicServiceId);

export const getPreferredMusicService = (): MusicServiceId => {
  if (typeof window === "undefined") return DEFAULT_MUSIC_SERVICE;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return isMusicServiceId(saved) ? saved : DEFAULT_MUSIC_SERVICE;
};

export const setPreferredMusicService = (service: MusicServiceId): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, service);
};

export const buildMusicSearchUrl = (
  service: MusicServiceId,
  songName: string,
  artistName: string,
): string => {
  const query = encodeURIComponent(buildMusicSearchQuery(songName, artistName));

  switch (service) {
    case "spotify":
      return `https://open.spotify.com/search/${query}`;
    case "appleMusic":
      return `https://music.apple.com/jp/search?term=${query}&l=ja&app=music`;
    case "youtubeMusic":
      return `https://music.youtube.com/search?q=${query}`;
    case "amazonMusic":
      return `https://music.amazon.co.jp/search/${query}`;
    default:
      return `https://open.spotify.com/search/${query}`;
  }
};

const normalizeAppleMusicUrl = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    if (!/apple\.com$/i.test(url.hostname)) return rawUrl;
    const segments = url.pathname.split("/");
    // Apple Music URL format uses "/{storefront}/..." (e.g. /jp/album/...)
    if (segments.length > 1 && segments[1].length === 2) {
      segments[1] = "jp";
      url.pathname = segments.join("/");
    }
    url.searchParams.set("l", "ja");
    url.searchParams.set("app", "music");
    return url.toString();
  } catch {
    return rawUrl;
  }
};

export const resolveAppleMusicTrackUrl = async (
  songName: string,
  artistName: string,
): Promise<string | null> => {
  const term = buildMusicSearchQuery(songName, artistName);
  if (!term) return null;
  const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term,
  )}&entity=song&country=JP&limit=1`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const json = (await response.json()) as {
      results?: Array<{
        trackViewUrl?: string;
        collectionViewUrl?: string;
        artistViewUrl?: string;
      }>;
    };
    const top = json.results?.[0];
    return top?.trackViewUrl ?? top?.collectionViewUrl ?? top?.artistViewUrl ?? null;
  } catch {
    return null;
  }
};

export const resolveMusicServiceUrl = async (
  service: MusicServiceId,
  songName: string,
  artistName: string,
): Promise<string> => {
  if (service === "appleMusic") {
    const resolved = await resolveAppleMusicTrackUrl(songName, artistName);
    if (resolved) return normalizeAppleMusicUrl(resolved);
  }
  return buildMusicSearchUrl(service, songName, artistName);
};
