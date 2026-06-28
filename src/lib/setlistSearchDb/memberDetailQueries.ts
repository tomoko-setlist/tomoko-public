import {
    parsePackedGroupAliases,
    parsePackedMemberColors,
    parsePackedMemberRoles,
} from "./packedDataParser";
import { clampInt, toInt, toSafePositiveInt, toText } from "./queryUtils";
import { duckdbDateYmdExpr } from "../date/duckdbDateExpr";
import { normalizeHeightCm } from "../heightCm";

import type {
    AlbumDetail,
    ArtistProfileRow,
    GroupDetail,
    GroupMembershipRow,
    GroupRoleRow,
    MemberColorRow,
    MemberDetail,
    MemberProfile,
} from "./types";
import type * as duckdb from "@duckdb/duckdb-wasm";

const LIMIT_MIN = 1;
const MEMBER_RELATED_LIMIT_MAX = 200;
const ARTIST_PROFILE_LIMIT_MAX = 300;

export const getMemberDetail = async (
    conn: duckdb.AsyncDuckDBConnection,
    personId: number,
): Promise<MemberDetail | null> => {
    const safePersonId = toSafePositiveInt(personId);
    const result = await conn.query(`
      SELECT
        CAST(personId AS INTEGER) AS personId,
        CAST(personName AS TEXT) AS personName,
        CAST(memberStatus AS TEXT) AS memberStatus,
        CAST(nameKana AS TEXT) AS nameKana,
        CAST(firstName AS TEXT) AS firstName,
        CAST(lastName AS TEXT) AS lastName,
        CAST(heightCm AS INTEGER) AS heightCm,
        CAST(birthPlaceText AS TEXT) AS birthPlaceText,
        CAST(birthday AS TEXT) AS birthday,
        CAST(deathday AS TEXT) AS deathday,
        CAST(prefectureName AS TEXT) AS prefectureName,
        CAST(countryName AS TEXT) AS countryName
      FROM persons
      WHERE personId = ${safePersonId}
      LIMIT 1
    `);
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
        personId: toInt(row.personId),
        personName: toText(row.personName),
        memberStatus: row.memberStatus
            ? (toText(row.memberStatus) as MemberDetail["memberStatus"])
            : null,
        nameKana: row.nameKana ? toText(row.nameKana) : null,
        firstName: row.firstName ? toText(row.firstName) : null,
        lastName: row.lastName ? toText(row.lastName) : null,
        heightCm: normalizeHeightCm(
            row.heightCm === null || row.heightCm === undefined
                ? null
                : toInt(row.heightCm),
        ),
        birthPlaceText: row.birthPlaceText ? toText(row.birthPlaceText) : null,
        birthday: row.birthday ? toText(row.birthday) : null,
        deathday: row.deathday ? toText(row.deathday) : null,
        prefectureName: row.prefectureName ? toText(row.prefectureName) : null,
        countryName: row.countryName ? toText(row.countryName) : null,
    };
};

export const getMemberProfile = async (
    conn: duckdb.AsyncDuckDBConnection,
    personId: number,
): Promise<MemberProfile | null> => {
    const safePersonId = toSafePositiveInt(personId);
    const result = await conn.query(`
      SELECT
        CAST(memberProfileId AS INTEGER) AS memberProfileId,
        CAST(personId AS INTEGER) AS personId,
        CAST(nickname AS TEXT) AS nickname,
        CAST(nicknameAlt AS TEXT) AS nicknameAlt,
        CAST(bloodType AS TEXT) AS bloodType,
        CAST(specialSkill AS TEXT) AS specialSkill,
        CAST(hobby AS TEXT) AS hobby,
        CAST(motto AS TEXT) AS motto,
        CAST(officialProfileText AS TEXT) AS officialProfileText,
        CAST(favoriteFood AS TEXT) AS favoriteFood,
        CAST(favoriteMusic AS TEXT) AS favoriteMusic,
        CAST(favoriteSports AS TEXT) AS favoriteSports,
        CAST(specialNotes AS TEXT) AS specialNotes
      FROM member_profiles
      WHERE personId = ${safePersonId}
      ORDER BY memberProfileId DESC
      LIMIT 1
    `);
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
        memberProfileId: toInt(row.memberProfileId),
        personId: toInt(row.personId),
        nickname: row.nickname ? toText(row.nickname) : null,
        nicknameAlt: row.nicknameAlt ? toText(row.nicknameAlt) : null,
        bloodType: row.bloodType ? toText(row.bloodType) : null,
        specialSkill: row.specialSkill ? toText(row.specialSkill) : null,
        hobby: row.hobby ? toText(row.hobby) : null,
        motto: row.motto ? toText(row.motto) : null,
        officialProfileText: row.officialProfileText
            ? toText(row.officialProfileText)
            : null,
        favoriteFood: row.favoriteFood ? toText(row.favoriteFood) : null,
        favoriteMusic: row.favoriteMusic ? toText(row.favoriteMusic) : null,
        favoriteSports: row.favoriteSports ? toText(row.favoriteSports) : null,
        specialNotes: row.specialNotes ? toText(row.specialNotes) : null,
    };
};

export const getMemberGroups = async (
    conn: duckdb.AsyncDuckDBConnection,
    personId: number,
    limit: number,
): Promise<GroupMembershipRow[]> => {
    const safePersonId = toSafePositiveInt(personId);
    const safeLimit = clampInt(limit, LIMIT_MIN, MEMBER_RELATED_LIMIT_MAX);
    const result = await conn.query(`
      SELECT
        CAST(gm.groupPersonId AS INTEGER) AS groupPersonId,
        CAST(gm.groupId AS INTEGER) AS groupId,
        CAST(
          COALESCE(
            (
              SELECT CAST(ga.aliasName AS TEXT)
              FROM group_aliases ga
              WHERE ga.groupId = gm.groupId
                AND ${duckdbDateYmdExpr("ga.startDate")} <= COALESCE(NULLIF(${duckdbDateYmdExpr("gm.leaveDate")}, ''), CAST(CURRENT_DATE AS TEXT))
                AND (
                  ga.endDate IS NULL
                  OR ${duckdbDateYmdExpr("ga.endDate")} >= COALESCE(NULLIF(${duckdbDateYmdExpr("gm.leaveDate")}, ''), CAST(CURRENT_DATE AS TEXT))
                )
              ORDER BY ${duckdbDateYmdExpr("ga.startDate")} DESC, CAST(ga.groupAliasId AS INTEGER) DESC
              LIMIT 1
            ),
            CAST(gm.groupName AS TEXT)
          ) AS TEXT
        ) AS groupName,
        CAST(g.groupType AS INTEGER) AS groupType,
        CAST(g.disbandDate AS TEXT) AS groupDisbandDate,
        CAST(gm.personId AS INTEGER) AS personId,
        CAST(gm.personName AS TEXT) AS personName,
        CAST(
          COALESCE(
            NULLIF(CAST(p.birthPlaceText AS TEXT), ''),
            NULLIF(CAST(p.prefectureName AS TEXT), '')
          ) AS TEXT
        ) AS birthPlaceText,
        CAST(gm.birthday AS TEXT) AS birthday,
        CAST(gm.generation AS TEXT) AS generation,
        CAST(gm.joinDate AS TEXT) AS joinDate,
        CAST(gm.leaveDate AS TEXT) AS leaveDate
      FROM group_memberships gm
      LEFT JOIN groups g
        ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
      LEFT JOIN persons p
        ON CAST(p.personId AS INTEGER) = CAST(gm.personId AS INTEGER)
      WHERE CAST(gm.personId AS INTEGER) = ${safePersonId}
      ORDER BY gm.joinDate ASC, gm.birthday ASC, gm.groupPersonId ASC
      LIMIT ${safeLimit}
    `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        groupPersonId: toInt(row.groupPersonId),
        groupId: toInt(row.groupId),
        groupName: toText(row.groupName),
        groupType:
            row.groupType === null || row.groupType === undefined
                ? null
                : toInt(row.groupType),
        groupDisbandDate: row.groupDisbandDate
            ? toText(row.groupDisbandDate)
            : null,
        personId: toInt(row.personId),
        personName: toText(row.personName),
        birthPlaceText: row.birthPlaceText ? toText(row.birthPlaceText) : null,
        birthday: row.birthday ? toText(row.birthday) : null,
        generation: row.generation ? toText(row.generation) : null,
        joinDate: toText(row.joinDate),
        leaveDate: row.leaveDate ? toText(row.leaveDate) : null,
    }));
};

export const getMemberColors = async (
    conn: duckdb.AsyncDuckDBConnection,
    personId: number,
    limit: number,
): Promise<MemberColorRow[]> => {
    const safePersonId = toSafePositiveInt(personId);
    const safeLimit = clampInt(limit, LIMIT_MIN, MEMBER_RELATED_LIMIT_MAX);
    const result = await conn.query(`
      SELECT
        CAST(memberColorId AS INTEGER) AS memberColorId,
        CAST(groupPersonId AS INTEGER) AS groupPersonId,
        CAST(personId AS INTEGER) AS personId,
        CAST(groupId AS INTEGER) AS groupId,
        CAST(
          COALESCE(
            (
              SELECT CAST(ga.aliasName AS TEXT)
              FROM group_aliases ga
              WHERE ga.groupId = mc.groupId
                AND ${duckdbDateYmdExpr("ga.startDate")} <= COALESCE(NULLIF(${duckdbDateYmdExpr("mc.startDate")}, ''), COALESCE(NULLIF(${duckdbDateYmdExpr("mc.endDate")}, ''), CAST(CURRENT_DATE AS TEXT)))
                AND (
                  ga.endDate IS NULL
                  OR ${duckdbDateYmdExpr("ga.endDate")} >= COALESCE(NULLIF(${duckdbDateYmdExpr("mc.startDate")}, ''), COALESCE(NULLIF(${duckdbDateYmdExpr("mc.endDate")}, ''), CAST(CURRENT_DATE AS TEXT)))
                )
              ORDER BY ${duckdbDateYmdExpr("ga.startDate")} DESC, CAST(ga.groupAliasId AS INTEGER) DESC
              LIMIT 1
            ),
            CAST(mc.groupName AS TEXT)
          ) AS TEXT
        ) AS groupName,
        CAST(colorCode AS TEXT) AS colorCode,
        CAST(colorName AS TEXT) AS colorName,
        CAST(startDate AS TEXT) AS startDate,
        CAST(endDate AS TEXT) AS endDate
      FROM member_colors mc
      WHERE personId = ${safePersonId}
      ORDER BY startDate DESC, memberColorId DESC
      LIMIT ${safeLimit}
    `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        memberColorId: toInt(row.memberColorId),
        groupPersonId: toInt(row.groupPersonId),
        personId: toInt(row.personId),
        groupId: toInt(row.groupId),
        groupName: toText(row.groupName),
        colorCode: toText(row.colorCode),
        colorName: row.colorName ? toText(row.colorName) : null,
        startDate: toText(row.startDate),
        endDate: row.endDate ? toText(row.endDate) : null,
    }));
};

export const getMemberArtists = async (
    conn: duckdb.AsyncDuckDBConnection,
    personId: number,
    limit: number,
): Promise<ArtistProfileRow[]> => {
    const safePersonId = toSafePositiveInt(personId);
    const safeLimit = clampInt(limit, LIMIT_MIN, MEMBER_RELATED_LIMIT_MAX);
    const result = await conn.query(`
      WITH member_group_periods AS (
        SELECT
          CAST(gm.groupId AS INTEGER) AS groupId,
          ${duckdbDateYmdExpr("gm.joinDate")} AS joinDate,
          COALESCE(NULLIF(${duckdbDateYmdExpr("gm.leaveDate")}, ''), CAST(CURRENT_DATE AS TEXT)) AS leaveDate
        FROM group_memberships gm
        WHERE CAST(gm.personId AS INTEGER) = ${safePersonId}
      ),
      member_group_aliases AS (
        SELECT
          mgp.groupId AS groupId,
          CAST(ga.aliasName AS TEXT) AS aliasName,
          ${duckdbDateYmdExpr("ga.startDate")} AS startDate,
          ${duckdbDateYmdExpr("ga.endDate")} AS endDate,
          ROW_NUMBER() OVER (
            PARTITION BY mgp.groupId
            ORDER BY
              ${duckdbDateYmdExpr("ga.startDate")} DESC,
              CAST(ga.aliasName AS TEXT) ASC
          ) AS row_num
        FROM member_group_periods mgp
        JOIN group_aliases ga
          ON CAST(ga.groupId AS INTEGER) = mgp.groupId
        WHERE ${duckdbDateYmdExpr("ga.startDate")} <= mgp.leaveDate
          AND (
            ga.endDate IS NULL
            OR ${duckdbDateYmdExpr("ga.endDate")} >= mgp.joinDate
          )
      ),
      candidate_artists AS (
        SELECT
          CAST(ap.artistId AS INTEGER) AS artistId,
          CAST(ap.artistName AS TEXT) AS artistName,
          CAST(ap.personId AS INTEGER) AS personId,
          CAST(ap.personName AS TEXT) AS personName,
          CAST(ap.groupId AS INTEGER) AS groupId,
          CAST(ap.groupName AS TEXT) AS groupName,
          CAST(ap.subjectType AS INTEGER) AS subjectType,
          CAST(ap.isHello AS BOOLEAN) AS isHello,
          CASE WHEN CAST(ap.personId AS INTEGER) = ${safePersonId} THEN 0 ELSE 1 END AS sourcePriority
        FROM artist_profiles ap
        WHERE CAST(ap.personId AS INTEGER) = ${safePersonId}
           OR CAST(ap.groupId AS INTEGER) IN (
             SELECT DISTINCT groupId
             FROM member_group_periods
           )
      ),
      filtered_candidates AS (
        SELECT ca.*
        FROM candidate_artists ca
        WHERE ca.groupId IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM group_aliases ga_any
             WHERE CAST(ga_any.groupId AS INTEGER) = ca.groupId
           )
           OR EXISTS (
             SELECT 1
             FROM member_group_aliases mga
             WHERE mga.groupId = ca.groupId
           )
      ),
      normalized_candidates AS (
        SELECT
          fc.artistId AS artistId,
          CASE
            WHEN fc.groupId IS NOT NULL
                 AND fc.artistName = fc.groupName
                 AND mga.aliasName IS NOT NULL
              THEN mga.aliasName
            ELSE fc.artistName
          END AS artistName,
          fc.personId AS personId,
          fc.personName AS personName,
          fc.groupId AS groupId,
          CASE
            WHEN fc.groupId IS NOT NULL AND mga.aliasName IS NOT NULL
              THEN mga.aliasName
            ELSE fc.groupName
          END AS groupName,
          fc.subjectType AS subjectType,
          fc.isHello AS isHello,
          fc.sourcePriority AS sourcePriority
        FROM filtered_candidates fc
        LEFT JOIN member_group_aliases mga
          ON mga.groupId = fc.groupId
         AND mga.row_num = 1
      ),
      deduped AS (
        SELECT
          artistId,
          artistName,
          personId,
          personName,
          groupId,
          groupName,
          subjectType,
          isHello,
          ROW_NUMBER() OVER (
            PARTITION BY artistId
            ORDER BY sourcePriority ASC, artistName ASC, artistId ASC
          ) AS row_num
        FROM normalized_candidates
      )
      SELECT
        artistId,
        artistName,
        personId,
        personName,
        groupId,
        groupName,
        subjectType,
        isHello
      FROM deduped
      WHERE row_num = 1
      ORDER BY artistName ASC, artistId ASC
      LIMIT ${safeLimit}
    `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        artistId: toInt(row.artistId),
        artistName: toText(row.artistName),
        personId:
            row.personId === null || row.personId === undefined
                ? null
                : toInt(row.personId),
        personName: row.personName ? toText(row.personName) : null,
        groupId:
            row.groupId === null || row.groupId === undefined
                ? null
                : toInt(row.groupId),
        groupName: row.groupName ? toText(row.groupName) : null,
        subjectType: toInt(row.subjectType),
        isHello: Boolean(row.isHello),
    }));
};

export const getMemberGroupRoles = async (
    conn: duckdb.AsyncDuckDBConnection,
    personId: number,
    limit: number,
): Promise<GroupRoleRow[]> => {
    const safePersonId = toSafePositiveInt(personId);
    const safeLimit = clampInt(limit, LIMIT_MIN, MEMBER_RELATED_LIMIT_MAX);
    const result = await conn.query(`
      SELECT
        CAST(gr.groupPersonRoleId AS INTEGER) AS groupPersonRoleId,
        CAST(gr.groupPersonId AS INTEGER) AS groupPersonId,
        CAST(gr.groupId AS INTEGER) AS groupId,
        CAST(COALESCE(g.groupName, '') AS TEXT) AS groupName,
        CAST(gr.personId AS INTEGER) AS personId,
        CAST(gr.roleName AS TEXT) AS roleName,
        CAST(gr.appointmentDate AS TEXT) AS appointmentDate,
        CAST(gr.retirementDate AS TEXT) AS retirementDate
      FROM group_roles gr
      LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gr.groupId AS INTEGER)
      WHERE gr.personId = ${safePersonId}
      ORDER BY gr.appointmentDate DESC, gr.groupPersonRoleId DESC
      LIMIT ${safeLimit}
    `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        groupPersonRoleId: toInt(row.groupPersonRoleId),
        groupPersonId: toInt(row.groupPersonId),
        groupId: toInt(row.groupId),
        groupName: toText(row.groupName),
        personId: toInt(row.personId),
        roleName: toText(row.roleName),
        appointmentDate: toText(row.appointmentDate),
        retirementDate: row.retirementDate ? toText(row.retirementDate) : null,
    }));
};

export const getGroupDetail = async (
    conn: duckdb.AsyncDuckDBConnection,
    groupId: number,
): Promise<GroupDetail | null> => {
    const safeGroupId = toSafePositiveInt(groupId);
    const result = await conn.query(`
      SELECT
        CAST(g.groupId AS INTEGER) AS groupId,
        CAST(g.groupName AS TEXT) AS groupName,
        CAST(g.groupType AS INTEGER) AS groupType,
        CAST(g.debutDate AS TEXT) AS debutDate,
        CAST(g.formationDate AS TEXT) AS formationDate,
        CAST(g.disbandDate AS TEXT) AS disbandDate,
        CAST(
          (
            SELECT string_agg(
              CAST(ga.aliasName AS TEXT) || '|' ||
              COALESCE(CAST(ga.startDate AS TEXT), '') || '|' ||
              COALESCE(CAST(ga.endDate AS TEXT), ''),
              '||'
            )
            FROM group_aliases ga
            WHERE ga.groupId = g.groupId
          ) AS TEXT
        ) AS aliasMeta,
        COUNT(DISTINCT m.personId) AS totalMembers
      FROM groups g
      LEFT JOIN group_memberships m
        ON m.groupId = g.groupId
      WHERE g.groupId = ${safeGroupId}
      GROUP BY g.groupId, g.groupName, g.groupType, g.debutDate, g.formationDate, g.disbandDate
      LIMIT 1
    `);
    const row = result.toArray()[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
        groupId: toInt(row.groupId),
        groupName: toText(row.groupName),
        pastNames: parsePackedGroupAliases(row.aliasMeta)
            .filter((alias) => !alias.startsWith(`${toText(row.groupName)} (`) && alias !== toText(row.groupName)),
        groupType: toInt(row.groupType),
        debutDate: row.debutDate ? toText(row.debutDate) : null,
        formationDate: row.formationDate ? toText(row.formationDate) : null,
        disbandDate: row.disbandDate ? toText(row.disbandDate) : null,
        totalMembers: toInt(row.totalMembers),
    };
};

export const getGroupMembers = async (
    conn: duckdb.AsyncDuckDBConnection,
    groupId: number,
    limit: number,
): Promise<GroupMembershipRow[]> => {
    const safeGroupId = toSafePositiveInt(groupId);
    const safeLimit = clampInt(limit, LIMIT_MIN, ARTIST_PROFILE_LIMIT_MAX);
    const result = await conn.query(`
      SELECT
        CAST(groupPersonId AS INTEGER) AS groupPersonId,
        CAST(groupId AS INTEGER) AS groupId,
        CAST(groupName AS TEXT) AS groupName,
        CAST(personId AS INTEGER) AS personId,
        CAST(personName AS TEXT) AS personName,
        CAST(birthPlaceText AS TEXT) AS birthPlaceText,
        CAST(birthday AS TEXT) AS birthday,
        CAST(deathday AS TEXT) AS deathday,
        CAST(generation AS TEXT) AS generation,
        CAST(joinDate AS TEXT) AS joinDate,
        CAST(leaveDate AS TEXT) AS leaveDate,
        CAST(colorMeta AS TEXT) AS colorMeta,
        CAST(roleMeta AS TEXT) AS roleMeta
      FROM (
        SELECT
          gm.groupPersonId,
          gm.groupId,
          gm.groupName,
          gm.personId,
          gm.personName,
          COALESCE(
            NULLIF(CAST(p.birthPlaceText AS TEXT), ''),
            NULLIF(CAST(p.prefectureName AS TEXT), '')
          ) AS birthPlaceText,
          gm.birthday,
          CAST(p.deathday AS TEXT) AS deathday,
          gm.generation,
          gm.joinDate,
          gm.leaveDate,
          (
            SELECT string_agg(
              CAST(mc.colorCode AS TEXT) || '|' ||
              COALESCE(CAST(mc.colorName AS TEXT), '') || '|' ||
              COALESCE(CAST(mc.startDate AS TEXT), '') || '|' ||
              COALESCE(CAST(mc.endDate AS TEXT), ''),
              '||'
            )
            FROM member_colors mc
            WHERE mc.groupPersonId = gm.groupPersonId
          ) AS colorMeta,
          (
            SELECT string_agg(
              CAST(gr.roleName AS TEXT) || '|' ||
              COALESCE(CAST(gr.appointmentDate AS TEXT), '') || '|' ||
              COALESCE(CAST(gr.retirementDate AS TEXT), ''),
              '||'
            )
            FROM group_roles gr
            WHERE gr.groupPersonId = gm.groupPersonId
          ) AS roleMeta
        FROM group_memberships gm
        LEFT JOIN persons p
          ON CAST(p.personId AS INTEGER) = CAST(gm.personId AS INTEGER)
      ) grouped
      WHERE groupId = ${safeGroupId}
      ORDER BY joinDate ASC, birthday ASC, groupPersonId ASC
      LIMIT ${safeLimit}
    `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        groupPersonId: toInt(row.groupPersonId),
        groupId: toInt(row.groupId),
        groupName: toText(row.groupName),
        personId: toInt(row.personId),
        personName: toText(row.personName),
        birthPlaceText: row.birthPlaceText ? toText(row.birthPlaceText) : null,
        birthday: row.birthday ? toText(row.birthday) : null,
        deathday: row.deathday ? toText(row.deathday) : null,
        generation: row.generation ? toText(row.generation) : null,
        joinDate: toText(row.joinDate),
        leaveDate: row.leaveDate ? toText(row.leaveDate) : null,
        memberColors: parsePackedMemberColors(row.colorMeta),
        memberRoles: parsePackedMemberRoles(row.roleMeta),
    }));
};

export const getGroupArtists = async (
    conn: duckdb.AsyncDuckDBConnection,
    groupId: number,
    limit: number,
): Promise<ArtistProfileRow[]> => {
    const safeGroupId = toSafePositiveInt(groupId);
    const safeLimit = clampInt(limit, LIMIT_MIN, MEMBER_RELATED_LIMIT_MAX);
    const result = await conn.query(`
      WITH candidate_artists AS (
        SELECT
          CAST(ap.artistId AS INTEGER) AS artistId,
          CAST(ap.artistName AS TEXT) AS artistName,
          CAST(ap.personId AS INTEGER) AS personId,
          CAST(ap.personName AS TEXT) AS personName,
          CAST(ap.groupId AS INTEGER) AS groupId,
          CAST(ap.groupName AS TEXT) AS groupName,
          CAST(ap.subjectType AS INTEGER) AS subjectType,
          CAST(ap.isHello AS BOOLEAN) AS isHello,
          CASE WHEN CAST(ap.groupId AS INTEGER) = ${safeGroupId} THEN 0 ELSE 1 END AS sourcePriority
        FROM artist_profiles ap
        WHERE CAST(ap.groupId AS INTEGER) = ${safeGroupId}
           OR CAST(ap.personId AS INTEGER) IN (
             SELECT DISTINCT CAST(gm.personId AS INTEGER)
             FROM group_memberships gm
             WHERE CAST(gm.groupId AS INTEGER) = ${safeGroupId}
           )
      ),
      deduped AS (
        SELECT
          artistId,
          artistName,
          personId,
          personName,
          groupId,
          groupName,
          subjectType,
          isHello,
          ROW_NUMBER() OVER (
            PARTITION BY artistId
            ORDER BY sourcePriority ASC, artistName ASC, artistId ASC
          ) AS row_num
        FROM candidate_artists
      )
      SELECT
        artistId,
        artistName,
        personId,
        personName,
        groupId,
        groupName,
        subjectType,
        isHello
      FROM deduped
      WHERE row_num = 1
      ORDER BY artistName ASC, artistId ASC
      LIMIT ${safeLimit}
    `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        artistId: toInt(row.artistId),
        artistName: toText(row.artistName),
        personId:
            row.personId === null || row.personId === undefined
                ? null
                : toInt(row.personId),
        personName: row.personName ? toText(row.personName) : null,
        groupId:
            row.groupId === null || row.groupId === undefined
                ? null
                : toInt(row.groupId),
        groupName: row.groupName ? toText(row.groupName) : null,
        subjectType: toInt(row.subjectType),
        isHello: Boolean(row.isHello),
    }));
};

export const getGroupAlbums = async (
    conn: duckdb.AsyncDuckDBConnection,
    groupId: number,
    limit: number,
): Promise<AlbumDetail[]> => {
    const safeGroupId = toSafePositiveInt(groupId);
    const safeLimit = clampInt(limit, LIMIT_MIN, MEMBER_RELATED_LIMIT_MAX);
    const result = await conn.query(`
      WITH candidate_artists AS (
        SELECT
          CAST(ap.artistId AS INTEGER) AS artistId,
          CASE WHEN CAST(ap.groupId AS INTEGER) = ${safeGroupId} THEN 0 ELSE 1 END AS sourcePriority
        FROM artist_profiles ap
        WHERE CAST(ap.groupId AS INTEGER) = ${safeGroupId}
           OR CAST(ap.personId AS INTEGER) IN (
             SELECT DISTINCT CAST(gm.personId AS INTEGER)
             FROM group_memberships gm
             WHERE CAST(gm.groupId AS INTEGER) = ${safeGroupId}
           )
      ),
      deduped_artists AS (
        SELECT artistId
        FROM (
          SELECT
            artistId,
            ROW_NUMBER() OVER (
              PARTITION BY artistId
              ORDER BY sourcePriority ASC, artistId ASC
            ) AS row_num
          FROM candidate_artists
        ) ranked
        WHERE row_num = 1
      ),
      group_linked_artists AS (
        SELECT artistId
        FROM candidate_artists
        WHERE sourcePriority = 0
      ),
      target_artists AS (
        SELECT artistId FROM group_linked_artists
        UNION ALL
        SELECT da.artistId
        FROM deduped_artists da
        WHERE NOT EXISTS (SELECT 1 FROM group_linked_artists)
      )
      SELECT
        CAST(a.albumId AS INTEGER) AS albumId,
        CAST(a.albumName AS TEXT) AS albumName,
        CAST(a.category AS INTEGER) AS category,
        CAST(a.releaseDate AS TEXT) AS releaseDate,
        CAST(a.artistId AS INTEGER) AS artistId,
        CAST(a.artistName AS TEXT) AS artistName,
        CAST(a.trackCount AS INTEGER) AS trackCount
      FROM albums a
      JOIN target_artists ta ON CAST(ta.artistId AS INTEGER) = CAST(a.artistId AS INTEGER)
      WHERE CAST(a.category AS INTEGER) IN (10, 20, 40, 50)
        AND TRIM(COALESCE(CAST(a.releaseDate AS TEXT), '')) <> ''
      ORDER BY CAST(a.releaseDate AS TEXT) ASC, CAST(a.albumId AS INTEGER) ASC
      LIMIT ${safeLimit}
    `);
    return (result.toArray() as Array<Record<string, unknown>>).map((row) => ({
        albumId: toInt(row.albumId),
        albumName: toText(row.albumName),
        category: toInt(row.category),
        releaseDate: toText(row.releaseDate),
        artistId: toInt(row.artistId),
        artistName: toText(row.artistName),
        trackCount: toInt(row.trackCount),
    }));
};
