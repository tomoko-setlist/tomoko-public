export type AppRoute =
  | { name: "home" }
  | { name: "krn" }
  | { name: "about" }
  | { name: "contact" }
  | { name: "articles" }
  | { name: "releases" }
  | { name: "song-search" }
  | { name: "song-ranking" }
  | { name: "stats" }
  | { name: "admin" }
  | { name: "member-search" }
  | { name: "article"; slug: string }
  | { name: "release"; id: number }
  | { name: "event"; id: number }
  | { name: "stage"; id: number }
  | { name: "venue"; id: number }
  | { name: "artist"; id: number }
  | { name: "member"; id: number }
  | { name: "group"; id: number }
  | { name: "creator"; id: number }
  | { name: "song"; id: number }
  | { name: "album"; id: number };

const parseId = (value: string | undefined): number | null => {
  if (!value) return null
  const id = Number(value)
  if (!Number.isFinite(id) || id <= 0) return null
  return Math.floor(id)
}

const parseSlug = (value: string | undefined): string | null => {
  if (!value) return null
  let decoded = ""
  try {
    decoded = decodeURIComponent(value).trim()
  } catch {
    return null
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(decoded)) return null
  return decoded
}

const parseNamedRoute = (name: string | undefined, idRaw?: string, slugRaw?: string): AppRoute | null => {
  if (!name) return null
  if (name === "article") {
    const slug = parseSlug(slugRaw ?? idRaw)
    return slug ? { name: "article", slug } : null
  }
  if (name === "articles") {
    const slug = parseSlug(idRaw ?? slugRaw)
    return slug ? { name: "article", slug } : { name: "articles" }
  }
  if (name === "song-search") return { name: "song-search" }
  if (name === "song-ranking") return { name: "song-ranking" }
  if (name === "stats") return { name: "stats" }
  if (name === "krn") return { name: "krn" }
  if (name === "about") return { name: "about" }
  if (name === "contact") return { name: "contact" }
  if (name === "releases") return { name: "releases" }
  if (name === "admin") return { name: "admin" }
  if (name === "member-search") return { name: "member-search" }
  if (name === "home") return { name: "home" }

  const id = parseId(idRaw)
  if (!id) return null
  if (name === "release" || name === "event" || name === "stage" || name === "venue" || name === "artist" || name === "member" || name === "group" || name === "creator" || name === "song" || name === "album") {
    return { name: name, id }
  }
  return null
}

export const parsePathRoute = (pathname: string): AppRoute => {
  const normalized = pathname.trim() || "/"
  const [path] = normalized.split("?")
  const segments = path.split("/").filter(Boolean)
  const [name, idRaw] = segments
  return parseNamedRoute(name, idRaw) ?? { name: "home" }
}

export const parseQueryRoute = (search: string): AppRoute | null => {
  const raw = search.startsWith("?") ? search.slice(1) : search
  if (!raw) return null
  const params = new URLSearchParams(raw)
  const name = params.get("route")
  if (!name) return null
  const id = params.get("id") ?? undefined
  const slug = params.get("slug") ?? undefined
  return parseNamedRoute(name, id, slug)
}

export const parseLegacyHashLocation = (
  hash: string,
): { route: AppRoute; query: string } | null => {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash
  if (!rawHash.startsWith("/")) {
    return null
  }
  const [path, query = ""] = rawHash.split("?")
  return {
    route: parsePathRoute(path),
    query,
  }
}

export const stripLegacyRouteParams = (search: string): string => {
  const raw = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(raw)
  params.delete("route")
  params.delete("id")
  const next = params.toString()
  return next ? `?${next}` : ""
}

export const parseLocationRoute = (
  pathname: string,
  search: string,
): AppRoute => {
  const byPath = parsePathRoute(pathname)
  if (byPath.name !== "home") return byPath

  return parseQueryRoute(search) ?? byPath
}

export const buildPathRoute = (route: AppRoute): string => {
  if (route.name === "home") return "/"
  if (route.name === "krn") return "/krn"
  if (route.name === "about") return "/about"
  if (route.name === "contact") return "/contact"
  if (route.name === "articles") return "/articles"
  if (route.name === "releases") return "/releases"
  if (route.name === "song-search") return "/song-search"
  if (route.name === "song-ranking") return "/song-ranking"
  if (route.name === "stats") return "/stats"
  if (route.name === "admin") return "/admin"
  if (route.name === "member-search") return "/member-search"
  if (route.name === "article") return `/articles/${encodeURIComponent(route.slug)}`
  return `/${route.name}/${route.id}`
}

export const buildRouteKey = (route: AppRoute): string => {
  if ("id" in route) return `${route.name}:${route.id}`
  if ("slug" in route) return `${route.name}:${route.slug}`
  return route.name
}
