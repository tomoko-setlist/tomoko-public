const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export const extractYouTubeId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (YOUTUBE_ID_PATTERN.test(raw)) return raw;

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be") {
      const candidate = url.pathname.replace("/", "").trim();
      return YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
    }
    if (host.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && YOUTUBE_ID_PATTERN.test(v)) return v;
      const m = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1] ?? null;
      const s = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (s) return s[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
};

export const toYouTubeWatchUrl = (youtubeId: string): string =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;

export const toYouTubeEmbedUrl = (youtubeId: string): string =>
  `https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}`;

