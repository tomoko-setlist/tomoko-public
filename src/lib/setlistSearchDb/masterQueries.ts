import { toInt, toText } from "./queryUtils";

import type { MasterOption } from "./types";
import type * as duckdb from "@duckdb/duckdb-wasm";

export const listEventTags = async (
    conn: duckdb.AsyncDuckDBConnection,
): Promise<MasterOption[]> => {
    const result = await conn.query(`
    SELECT
      CAST(tagId AS INTEGER) AS id,
      CAST(tagName AS TEXT) AS name
    FROM event_tags
    ORDER BY name ASC, id ASC
  `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        id: toInt(row.id),
        name: toText(row.name),
    }));
};

export const listPrefectures = async (
    conn: duckdb.AsyncDuckDBConnection,
): Promise<MasterOption[]> => {
    const result = await conn.query(`
    SELECT
      CAST(prefectureId AS INTEGER) AS id,
      CAST(prefectureName AS TEXT) AS name
    FROM prefectures
    ORDER BY id ASC
  `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        id: toInt(row.id),
        name: toText(row.name),
    }));
};

export const listMemberColorNames = async (
    conn: duckdb.AsyncDuckDBConnection,
): Promise<string[]> => {
    const result = await conn.query(`
    SELECT DISTINCT CAST(colorName AS TEXT) AS name
    FROM member_colors
    WHERE COALESCE(TRIM(CAST(colorName AS TEXT)), '') <> ''
    ORDER BY name ASC
  `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => toText(row.name));
};

export const listGroups = async (
    conn: duckdb.AsyncDuckDBConnection,
): Promise<MasterOption[]> => {
    const result = await conn.query(`
    SELECT
      CAST(id AS INTEGER) AS id,
      CAST(name AS TEXT) AS name
    FROM (
      SELECT
        CAST(groupId AS INTEGER) AS id,
        CAST(groupName AS TEXT) AS name
      FROM groups
      UNION
      SELECT
        CAST(groupId AS INTEGER) AS id,
        CAST(aliasName AS TEXT) AS name
      FROM group_aliases
    ) merged
    WHERE COALESCE(name, '') <> ''
    ORDER BY name ASC, id ASC
  `);

    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        id: toInt(row.id),
        name: toText(row.name),
    }));
};
