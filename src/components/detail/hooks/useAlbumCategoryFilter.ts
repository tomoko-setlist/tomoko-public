import { useMemo, useState } from "react"

import { categoryLabel } from "../../../lib/uiFormat"

type WithCategory = { category: number }

export function useAlbumCategoryFilter<T extends WithCategory>(albums: T[]): {
  selectedAlbumCategory: number | "all"
  setSelectedAlbumCategory: (value: number | "all") => void
  albumCategoryTabs: { value: number; label: string }[]
  filteredAlbums: T[]
} {
  const [selectedAlbumCategory, setSelectedAlbumCategory] = useState<number | "all">("all")

  const albumCategoryTabs = useMemo(() => {
    const categories = Array.from(new Set(albums.map((album) => album.category))).sort(
      (a, b) => a - b,
    )
    return categories.map((category) => ({ value: category, label: categoryLabel(category) }))
  }, [albums])

  const normalizedSelectedAlbumCategory =
    selectedAlbumCategory !== "all" &&
    !albums.some((album) => album.category === selectedAlbumCategory)
      ? "all"
      : selectedAlbumCategory

  const filteredAlbums = useMemo(
    () =>
      normalizedSelectedAlbumCategory === "all"
        ? albums
        : albums.filter((album) => album.category === normalizedSelectedAlbumCategory),
    [albums, normalizedSelectedAlbumCategory],
  )

  return {
    selectedAlbumCategory: normalizedSelectedAlbumCategory,
    setSelectedAlbumCategory,
    albumCategoryTabs,
    filteredAlbums,
  }
}
