const NODEE_HOSTS = new Set(["nodee.net", "www.nodee.net", "n0.com"]);

export const toSafeExternalUrl = (value: string | null | undefined): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

export const toSafeNodeeUrl = (value: string | null | undefined): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") {
      return null;
    }
    if (!NODEE_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

export const toNodeeEmbedUrl = (value: string | null | undefined): string | null => {
  const safeUrl = toSafeNodeeUrl(value);
  if (!safeUrl) return null;

  const parsed = new URL(safeUrl);
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  // Supports:
  // - /s/:slug
  // - /a/:slug
  // - /embed/s/:slug
  // - /embed/a/:slug
  const [first, second, third] = segments;
  if ((first === "s" || first === "a") && second) {
    return `https://nodee.net/embed/${first}/${second}`;
  }
  if (first === "embed" && (second === "s" || second === "a") && third) {
    return `https://nodee.net/embed/${second}/${third}`;
  }
  return null;
};
