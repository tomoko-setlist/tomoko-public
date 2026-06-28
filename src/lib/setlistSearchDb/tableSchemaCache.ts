import { toText } from './queryUtils'

import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

type SchemaCache = Map<string, Set<string>>

let cache: SchemaCache | null = null
let warmPromise: Promise<SchemaCache> | null = null

export const resetTableSchemaCache = (): void => {
  cache = null
  warmPromise = null
}

export const warmTableSchemaCache = async (conn: AsyncDuckDBConnection): Promise<void> => {
  if (cache) return
  if (!warmPromise) {
    warmPromise = (async () => {
      const result = await conn.query(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE lower(table_schema) = 'main'
      `)
      const next = new Map<string, Set<string>>()
      for (const row of result.toArray() as Array<Record<string, unknown>>) {
        const tableName = toText(row.table_name).toLowerCase()
        const columnName = toText(row.column_name).toLowerCase()
        if (!tableName || !columnName) continue
        const columns = next.get(tableName) ?? new Set<string>()
        columns.add(columnName)
        next.set(tableName, columns)
      }
      cache = next
      return next
    })()
  }
  await warmPromise
}

/** Rebuild schema cache after tiered parquet tables are loaded. */
export const refreshTableSchemaCache = async (
  conn: AsyncDuckDBConnection,
): Promise<void> => {
  resetTableSchemaCache()
  await warmTableSchemaCache(conn)
}

export const hasTableColumn = (tableName: string, columnName: string): boolean => {
  if (!cache) return false
  return cache.get(tableName.toLowerCase())?.has(columnName.toLowerCase()) ?? false
}

export const tableExists = (tableName: string): boolean => {
  if (!cache) return false
  return cache.has(tableName.toLowerCase())
}

/** Schema-aware column check; warms cache on first use. */
export const hasTableColumnAsync = async (
  conn: AsyncDuckDBConnection,
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  await warmTableSchemaCache(conn)
  if (!tableExists(tableName)) {
    // Core tables warm the cache first; detail tables arrive later in tiered load.
    await refreshTableSchemaCache(conn)
  }
  if (!tableExists(tableName)) return false
  return hasTableColumn(tableName, columnName)
}
