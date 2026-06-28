import {
    buildFilterSql,
    buildGroupedEventOrderBySql,
    buildOrderBySql,
    buildSourceSql,
    isUnfilteredSetlistRequest,
    normalizeDateSql,
} from "./searchQueryBuilder";

import type { SearchRequest, SearchResponse } from "./types";
import type * as duckdb from "@duckdb/duckdb-wasm";

export const searchSetlistRows = async (
    conn: duckdb.AsyncDuckDBConnection,
    request: SearchRequest,
): Promise<SearchResponse> => {
    const rawSearchUnit = (request as { searchUnit?: string }).searchUnit;
    const effectiveRequest: SearchRequest =
        rawSearchUnit === "event"
            ? { ...request, searchUnit: "stage" }
            : request;
    const page = Math.max(1, request.page);
    const limit = Math.max(1, Math.min(100, request.limit));
    const offset = (page - 1) * limit;
    if (isUnfilteredSetlistRequest(effectiveRequest)) {
        const setlistDate = normalizeDateSql("sl.date");
        const fastRowsResult = await conn.query(`
    WITH base AS (
      SELECT
        CAST(sl.setlistId AS INTEGER) AS row_id,
        CAST(sl.stageId AS INTEGER) AS stage_id,
        CAST(sl.eventId AS INTEGER) AS event_id,
        CAST(sl.songId AS INTEGER) AS song_id,
        CAST(sl.artistId AS INTEGER) AS artist_id,
        CAST(sl.venueId AS INTEGER) AS venue_id,
        CAST(sl.songName AS TEXT) AS primary_text,
        COALESCE(CAST(sl.displayPerformerName AS TEXT), '') AS secondary_text,
        COALESCE(CAST(sl.artistName AS TEXT), '') AS artist_text,
        COALESCE(CAST(sl.section AS TEXT), '') AS section_text,
        CAST(sl.startTime AS TEXT) AS start_time,
        CAST(sl.prefectureId AS INTEGER) AS prefecture_id,
        CAST(sl.eventName AS TEXT) AS event_name,
        ${setlistDate} AS date_label,
        CAST(sl.venueName AS TEXT) AS venue_name,
        ${setlistDate} AS sort_date,
        COALESCE(CAST(sl.artistName AS TEXT), '') AS base_artist,
        0 AS total_stages,
        0 AS total_performances,
        CAST(sl.eventTagsJson AS TEXT) AS event_tags_json
      FROM setlists sl
    )
    SELECT
      row_id,
      stage_id,
      event_id,
      song_id,
      artist_id,
      venue_id,
      primary_text,
      secondary_text,
      artist_text,
      section_text,
      start_time,
      prefecture_id,
      event_name,
      date_label,
      venue_name,
      total_stages,
      total_performances,
      event_tags_json,
      COUNT(*) OVER() AS total_count
    FROM base
    ORDER BY ${buildOrderBySql(effectiveRequest)}
    LIMIT ${limit}
    OFFSET ${offset}
  `);
        const fastRows = fastRowsResult.toArray() as Array<
            SearchResponse["rows"][number] & { total_count: number | bigint }
        >;
        const total =
            fastRows.length > 0 ? Number(fastRows[0].total_count ?? 0) : 0;
        const rows = fastRows.map((row) => {
            const { total_count: _ignored, ...rest } = row;
            return rest;
        });
        const totalPages = Math.max(1, Math.ceil(total / limit));

        return { rows, total, page, limit, totalPages };
    }

    const sourceSql = buildSourceSql(
        effectiveRequest.searchUnit,
        effectiveRequest.term,
    );
    const filteredSql = `
    SELECT
      row_id,
      stage_id,
      event_id,
      song_id,
      artist_id,
      venue_id,
      primary_text,
      secondary_text,
      base_artist AS artist_text,
      start_time,
      pattern,
      cancelled,
      event_name,
      date_label,
      venue_name,
      sort_date,
      eventTagsJson AS event_tags_json,
      section_text,
      base_performer,
      base_artist,
      base_lyricist,
      base_composer,
      base_arranger,
      base_song_search_key,
      prefecture_id,
      total_stages,
      total_performances
    FROM (${sourceSql}) AS base
    ${buildFilterSql(effectiveRequest)}
  `;
    const useEventUnitPaging =
        effectiveRequest.searchUnit === "stage" &&
        Boolean(effectiveRequest.groupByEvent);
    const useSetlistSongEventGrouping =
        effectiveRequest.searchUnit === "setlist" &&
        Boolean(effectiveRequest.groupByEventSong);

    let eventTotal: number | undefined;
    let stageTotal: number | undefined;
    let total = 0;
    if (effectiveRequest.searchUnit === "stage") {
        const summaryResult = await conn.query(`
    SELECT
      COUNT(CASE WHEN NOT cancelled THEN 1 ELSE NULL END) AS stage_total,
      COUNT(DISTINCT event_id) AS event_total
    FROM (${filteredSql}) AS q
  `);
        const summaryRows = summaryResult.toArray() as Array<{
            stage_total: number | bigint;
            event_total: number | bigint;
        }>;
        stageTotal = Number(summaryRows[0]?.stage_total ?? 0);
        eventTotal = Number(summaryRows[0]?.event_total ?? 0);
        total = useEventUnitPaging ? eventTotal : stageTotal;
    } else if (useSetlistSongEventGrouping) {
        const groupedCountResult = await conn.query(`
    SELECT COUNT(*) AS total
    FROM (
      SELECT event_id, song_id
      FROM (${filteredSql}) AS q
      GROUP BY event_id, song_id
    ) grouped
  `);
        const groupedCountRows = groupedCountResult.toArray() as Array<{
            total: number | bigint;
        }>;
        total = Number(groupedCountRows[0]?.total ?? 0);
    } else {
        const countResult = await conn.query(`
    SELECT COUNT(*) AS total
    FROM (${filteredSql}) AS q
  `);
        const countRows = countResult.toArray() as Array<{
            total: number | bigint;
        }>;
        total = Number(countRows[0]?.total ?? 0);
    }
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const rowsResult = await conn.query(
        useEventUnitPaging
            ? `
    WITH filtered AS (
      ${filteredSql}
    ),
    grouped AS (
      SELECT
        event_id,
        MAX(event_name) AS event_name,
        MAX(sort_date) AS sort_date,
        MAX(venue_name) AS venue_name
      FROM filtered
      GROUP BY event_id
    ),
    event_page AS (
      SELECT
        event_id,
        ROW_NUMBER() OVER (ORDER BY ${buildGroupedEventOrderBySql(effectiveRequest)}) AS event_rank
      FROM grouped
      ORDER BY ${buildGroupedEventOrderBySql(effectiveRequest)}
      LIMIT ${limit}
      OFFSET ${offset}
    )
    SELECT
      f.row_id,
      f.stage_id,
      f.event_id,
      f.song_id,
      f.artist_id,
      f.venue_id,
      f.primary_text,
      f.secondary_text,
      f.artist_text,
      f.section_text,
      f.start_time,
      f.pattern,
      f.cancelled,
      f.prefecture_id,
      f.event_name,
      f.date_label,
      f.venue_name,
      f.total_stages,
      f.total_performances,
      f.event_tags_json
    FROM filtered f
    JOIN event_page ep ON ep.event_id = f.event_id
    ORDER BY ep.event_rank ASC, f.sort_date DESC, f.row_id DESC
  `
            : useSetlistSongEventGrouping
              ? `
    WITH filtered AS (
      ${filteredSql}
    ),
    grouped AS (
      SELECT
        CAST(MIN(row_id) AS INTEGER) AS row_id,
        CAST(MAX(stage_id) AS INTEGER) AS stage_id,
        CAST(event_id AS INTEGER) AS event_id,
        CAST(song_id AS INTEGER) AS song_id,
        CAST(MAX(artist_id) AS INTEGER) AS artist_id,
        CAST(MAX(venue_id) AS INTEGER) AS venue_id,
        CAST(MAX(primary_text) AS TEXT) AS primary_text,
        CAST(
          COALESCE(
            NULLIF(string_agg(DISTINCT NULLIF(trim(secondary_text), ''), ' / '), ''),
            ''
          ) AS TEXT
        ) AS secondary_text,
        CAST(MAX(base_artist) AS TEXT) AS artist_text,
        CAST(
          COALESCE(
            NULLIF(string_agg(DISTINCT NULLIF(trim(section_text), ''), ' / '), ''),
            ''
          ) AS TEXT
        ) AS section_text,
        CAST(MAX(start_time) AS TEXT) AS start_time,
        CAST(NULL AS TEXT) AS pattern,
        CAST(FALSE AS BOOLEAN) AS cancelled,
        CAST(MAX(prefecture_id) AS INTEGER) AS prefecture_id,
        CAST(MAX(event_name) AS TEXT) AS event_name,
        CAST(MAX(date_label) AS TEXT) AS date_label,
        CAST(
          CASE
            WHEN COUNT(DISTINCT venue_name) > 1 THEN '複数会場'
            ELSE MAX(venue_name)
          END AS TEXT
        ) AS venue_name,
        CAST(COUNT(DISTINCT CASE WHEN NOT cancelled THEN stage_id ELSE NULL END) AS INTEGER) AS total_stages,
        CAST(COUNT(*) AS INTEGER) AS total_performances,
        CAST(MAX(event_tags_json) AS TEXT) AS event_tags_json,
        CAST(MAX(sort_date) AS TEXT) AS sort_date,
        CAST(MAX(base_artist) AS TEXT) AS base_artist
      FROM filtered
      GROUP BY event_id, song_id
    )
    SELECT
      row_id,
      stage_id,
      event_id,
      song_id,
      artist_id,
      venue_id,
      primary_text,
      secondary_text,
      artist_text,
      section_text,
      start_time,
      pattern,
      cancelled,
      prefecture_id,
      event_name,
      date_label,
      venue_name,
      total_stages,
      total_performances,
      event_tags_json
    FROM grouped
    ORDER BY ${buildOrderBySql(effectiveRequest)}
    LIMIT ${limit}
    OFFSET ${offset}
  `
              : `
    SELECT
      row_id,
      stage_id,
      event_id,
      song_id,
      artist_id,
      venue_id,
      primary_text,
      secondary_text,
      artist_text,
      section_text,
      start_time,
      pattern,
      cancelled,
      prefecture_id,
      event_name,
      date_label,
      venue_name,
      total_stages,
      total_performances,
      event_tags_json
    FROM (${filteredSql}) AS q
    ORDER BY ${buildOrderBySql(effectiveRequest)}
    LIMIT ${limit}
    OFFSET ${offset}
  `,
    );

    return {
        rows: rowsResult.toArray() as SearchResponse["rows"],
        total,
        page,
        limit,
        totalPages,
        eventTotal,
        stageTotal,
    };
};
