import { parseBirthMonthsCsv } from "../birthMonthSearch";
import { escapePattern, escapeSqlLiteral, splitTerms, toInt, toText } from "./memberQueryUtils";
import {
    SQL_MEMBERSHIP_IS_ONGOING,
    SQL_MEMBERSHIP_IS_PAST,
} from "./membershipActiveSql";
import { SQL_MEMBERSHIP_DISPLAY_GROUP_NAME } from "./membershipDisplaySql";
import { parsePackedMemberColors } from "./packedDataParser";
import {
    GROUP_TYPE_HELLO_PRO_GROUP,
    GROUP_TYPE_HELLO_PRO_TRAINEE,
    GROUP_TYPE_HELLO_PRO_UNIT,
    GROUP_TYPE_SHUFFLE_UNIT,
    GROUP_TYPE_SPECIAL_UNIT,
} from "../constants/groupTypes";
import { duckdbDateYmdExpr } from "../date/duckdbDateExpr";

import type { MemberSearchRequest, MemberSearchResponse, MemberStatus } from "./types";
import type * as duckdb from "@duckdb/duckdb-wasm";

export const searchMembers = async (
    conn: duckdb.AsyncDuckDBConnection,
    request: MemberSearchRequest,
): Promise<MemberSearchResponse> => {
    const page = Math.max(1, request.page);
    const limit = Math.max(1, Math.min(100, request.limit));
    const offset = (page - 1) * limit;

    const term = request.term?.trim() ?? "";
    const personName = request.personName?.trim() ?? "";
    const groupName = request.groupName?.trim() ?? "";
    const prefectureIds = (request.prefectureIds ?? "")
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isInteger(value) && value > 0);
    const prefectureName = request.prefectureName?.trim() ?? "";
    const birthdayFrom = request.birthdayFrom?.trim() ?? request.joinedFrom?.trim() ?? "";
    const birthdayTo = request.birthdayTo?.trim() ?? request.joinedTo?.trim() ?? "";
    const birthMonths = parseBirthMonthsCsv(request.birthMonths);
    const activeStatus = request.activeStatus ?? "all";
    const bloodType = request.bloodType?.trim() ?? "";
    const generation = request.generation?.trim() ?? "";
    const roleName = request.roleName?.trim() ?? "";
    const colorNames = splitTerms(request.colorName ?? "");
    const birthdayYmd = duckdbDateYmdExpr("base.birthday");

    const filters: string[] = [];
    const resolvedPrefectureExpr = `COALESCE(
      CAST(base.prefectureName AS TEXT),
      NULLIF(
        regexp_extract(
          regexp_replace(COALESCE(CAST(base.birthPlaceText AS TEXT), ''), '^.*/', ''),
          '(北海道|東京都|京都府|大阪府|[^\\\\s]+県)',
          1
        ),
        ''
      )
    )`;
    if (term) {
        filters.push(
            `lower(
                COALESCE(CAST(base.personName AS TEXT), '') || ' ' ||
                COALESCE(CAST(base.nameKana AS TEXT), '') || ' ' ||
                COALESCE(${resolvedPrefectureExpr}, '') || ' ' ||
                COALESCE(CAST(base.groupsText AS TEXT), '')
            ) LIKE lower('${escapePattern(term)}')`,
        );
    }
    if (personName) {
        filters.push(
            `lower(COALESCE(CAST(base.personName AS TEXT), '')) LIKE lower('${escapePattern(personName)}')`,
        );
    }
    if (groupName) {
        filters.push(
            `lower(
              COALESCE(
                CAST(base.groupSearchText AS TEXT),
                CAST(base.groupsText AS TEXT),
                ''
              )
            ) LIKE lower('${escapePattern(groupName)}')`,
        );
    }
    if (prefectureIds.length > 0) {
        const idsCsv = prefectureIds.join(",");
        filters.push(
            `COALESCE(${resolvedPrefectureExpr}, '') IN (
              SELECT CAST(prefectureName AS TEXT)
              FROM prefectures
              WHERE CAST(prefectureId AS INTEGER) IN (${idsCsv})
            )`,
        );
    } else if (prefectureName) {
        filters.push(
            `lower(COALESCE(${resolvedPrefectureExpr}, '')) LIKE lower('${escapePattern(prefectureName)}')`,
        );
    }
    if (birthdayFrom) {
        filters.push(
            `COALESCE(${birthdayYmd}, '') >= '${escapeSqlLiteral(birthdayFrom)}'`,
        );
    }
    if (birthdayTo) {
        filters.push(
            `COALESCE(${birthdayYmd}, '') <= '${escapeSqlLiteral(birthdayTo)}'`,
        );
    }
    if (birthMonths.length > 0) {
        filters.push(`COALESCE(TRIM(CAST(base.birthday AS TEXT)), '') <> ''`);
        filters.push(
            `CAST(substr(${birthdayYmd}, 6, 2) AS INTEGER) IN (${birthMonths.join(",")})`,
        );
    }
    if (activeStatus === "activeHello") {
        filters.push(`COALESCE(CAST(person_meta.memberStatus AS TEXT), 'other') = 'activeHello'`);
    } else if (activeStatus === "trainee") {
        filters.push(`COALESCE(CAST(person_meta.memberStatus AS TEXT), 'other') = 'trainee'`);
    } else if (activeStatus === "helloOg") {
        filters.push(`COALESCE(CAST(person_meta.memberStatus AS TEXT), 'other') = 'helloOg'`);
    } else if (activeStatus === "formerTrainee") {
        filters.push(`COALESCE(CAST(person_meta.memberStatus AS TEXT), 'other') = 'formerTrainee'`);
    }
    if (bloodType) {
        filters.push(
            `lower(COALESCE(CAST(base.bloodType AS TEXT), '')) LIKE lower('${escapePattern(bloodType)}')`,
        );
    }
    if (generation) {
        filters.push(
            `lower(COALESCE(CAST(base.generationsText AS TEXT), '')) LIKE lower('${escapePattern(generation)}')`,
        );
    }
    if (roleName) {
        filters.push(
            `lower(COALESCE(CAST(base.rolesText AS TEXT), '')) LIKE lower('${escapePattern(roleName)}')`,
        );
    }
    if (colorNames.length > 0) {
        const colorFilters = colorNames.map(
            (name) => `
            EXISTS (
              SELECT 1
              FROM member_colors mc
              INNER JOIN group_memberships gm
                ON CAST(mc.groupPersonId AS INTEGER) = CAST(gm.groupPersonId AS INTEGER)
              WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
                AND lower(trim(COALESCE(CAST(mc.colorName AS TEXT), ''))) = lower('${escapeSqlLiteral(name.trim())}')
            )`,
        );
        filters.push(`(${colorFilters.join(" OR ")})`);
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const orderDirection = request.sortOrder === "desc" ? "DESC" : "ASC";
    const orderBy =
        request.sortBy === "kana"
            ? `COALESCE(base.nameKana, base.personName) ${orderDirection}, base.personName ASC`
            : request.sortBy === "joinedAt"
                ? `base.birthday ${orderDirection} NULLS LAST, base.personName ASC`
                : `base.personName ${orderDirection}, base.personId ASC`;

    const rowsResult = await conn.query(`
      SELECT
        CAST(base.personId AS INTEGER) AS personId,
        CAST(base.personName AS TEXT) AS personName,
        CAST(base.nameKana AS TEXT) AS nameKana,
        CAST(${resolvedPrefectureExpr} AS TEXT) AS prefectureName,
        CAST(base.colorsText AS TEXT) AS colorsText,
        CAST((
          SELECT string_agg(
            CAST(mc.colorCode AS TEXT) || '|' ||
            COALESCE(CAST(mc.colorName AS TEXT), '') || '|' ||
            COALESCE(CAST(mc.startDate AS TEXT), '') || '|' ||
            COALESCE(CAST(mc.endDate AS TEXT), ''),
            '||'
          )
          FROM member_colors mc
          INNER JOIN group_memberships gm
            ON CAST(mc.groupPersonId AS INTEGER) = CAST(gm.groupPersonId AS INTEGER)
          WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
        ) AS TEXT) AS colorsMeta,
        CAST(COALESCE(CAST(person_meta.memberStatus AS TEXT), 'other') AS TEXT) AS memberStatus,
        CAST(base.birthday AS TEXT) AS birthday,
        CAST(base.latestJoinDate AS TEXT) AS latestJoinDate,
        CAST(base.activeGroupsText AS TEXT) AS activeGroupsText,
        CAST(base.formerGroupsText AS TEXT) AS formerGroupsText,
        CAST(base.groupsText AS TEXT) AS groupsText,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND ${SQL_MEMBERSHIP_IS_ONGOING}
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) = ${GROUP_TYPE_HELLO_PRO_GROUP}
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS activeGroupType10Text,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND ${SQL_MEMBERSHIP_IS_ONGOING}
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) = ${GROUP_TYPE_HELLO_PRO_TRAINEE}
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS activeGroupType70Text,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND ${SQL_MEMBERSHIP_IS_ONGOING}
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) = ${GROUP_TYPE_HELLO_PRO_UNIT}
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS activeGroupType20Text,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND ${SQL_MEMBERSHIP_IS_ONGOING}
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) = ${GROUP_TYPE_SPECIAL_UNIT}
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS activeGroupType30Text,
        CAST(NULL AS TEXT) AS activeGroupType40Text,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND ${SQL_MEMBERSHIP_IS_ONGOING}
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) NOT IN (${GROUP_TYPE_HELLO_PRO_GROUP},${GROUP_TYPE_HELLO_PRO_TRAINEE},${GROUP_TYPE_HELLO_PRO_UNIT},${GROUP_TYPE_SPECIAL_UNIT},${GROUP_TYPE_SHUFFLE_UNIT})
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS activeGroupTypeOtherText,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND ${SQL_MEMBERSHIP_IS_PAST}
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) = ${GROUP_TYPE_HELLO_PRO_GROUP}
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS formerGroupType10Text,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND ${SQL_MEMBERSHIP_IS_PAST}
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) = ${GROUP_TYPE_HELLO_PRO_TRAINEE}
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS formerGroupType70Text,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND ${SQL_MEMBERSHIP_IS_PAST}
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) = ${GROUP_TYPE_HELLO_PRO_UNIT}
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS formerGroupType20Text,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND ${SQL_MEMBERSHIP_IS_PAST}
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) = ${GROUP_TYPE_SPECIAL_UNIT}
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS formerGroupType30Text,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) = ${GROUP_TYPE_SHUFFLE_UNIT}
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS formerGroupType40Text,
        CAST((
          SELECT string_agg(CAST(t.groupName AS TEXT), ' / ')
          FROM (
            SELECT DISTINCT ${SQL_MEMBERSHIP_DISPLAY_GROUP_NAME} AS groupName, CAST(gm.joinDate AS TEXT) AS joinDate
            FROM group_memberships gm
            LEFT JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
            WHERE CAST(gm.personId AS INTEGER) = CAST(base.personId AS INTEGER)
              AND ${SQL_MEMBERSHIP_IS_PAST}
              AND COALESCE(CAST(g.groupType AS INTEGER), 0) NOT IN (${GROUP_TYPE_HELLO_PRO_GROUP},${GROUP_TYPE_HELLO_PRO_TRAINEE},${GROUP_TYPE_HELLO_PRO_UNIT},${GROUP_TYPE_SPECIAL_UNIT},${GROUP_TYPE_SHUFFLE_UNIT})
            ORDER BY joinDate ASC
          ) t
        ) AS TEXT) AS formerGroupTypeOtherText,
        CAST(COUNT(*) OVER() AS INTEGER) AS totalCount
      FROM member_search_index base
      LEFT JOIN persons person_meta
        ON CAST(person_meta.personId AS INTEGER) = CAST(base.personId AS INTEGER)
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const rowArray = rowsResult.toArray() as Array<Record<string, unknown>>;
    let total = rowArray.length > 0 ? toInt(rowArray[0]?.totalCount) : 0;
    if (rowArray.length === 0) {
        const countResult = await conn.query(`
          SELECT COUNT(*) AS total
          FROM member_search_index base
          LEFT JOIN persons person_meta
            ON CAST(person_meta.personId AS INTEGER) = CAST(base.personId AS INTEGER)
          ${where}
        `);
        total = Number((countResult.toArray()[0] as Record<string, unknown>)?.total ?? 0);
    }
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
        rows: rowArray.map((row) => ({
            personId: toInt(row.personId),
            personName: toText(row.personName),
            nameKana: row.nameKana ? toText(row.nameKana) : null,
            prefectureName: row.prefectureName ? toText(row.prefectureName) : null,
            colorsText: row.colorsText ? toText(row.colorsText) : null,
            memberColors: parsePackedMemberColors(row.colorsMeta),
            memberStatus: toMemberStatus(row.memberStatus),
            birthday: row.birthday ? toText(row.birthday) : null,
            latestJoinDate: row.latestJoinDate ? toText(row.latestJoinDate) : null,
            activeGroupsText: row.activeGroupsText ? toText(row.activeGroupsText) : null,
            formerGroupsText: row.formerGroupsText ? toText(row.formerGroupsText) : null,
            groupsText: row.groupsText ? toText(row.groupsText) : null,
            activeGroupType10Text: row.activeGroupType10Text ? toText(row.activeGroupType10Text) : null,
            activeGroupType70Text: row.activeGroupType70Text ? toText(row.activeGroupType70Text) : null,
            activeGroupType20Text: row.activeGroupType20Text ? toText(row.activeGroupType20Text) : null,
            activeGroupType30Text: row.activeGroupType30Text ? toText(row.activeGroupType30Text) : null,
            activeGroupType40Text: row.activeGroupType40Text ? toText(row.activeGroupType40Text) : null,
            activeGroupTypeOtherText: row.activeGroupTypeOtherText ? toText(row.activeGroupTypeOtherText) : null,
            formerGroupType10Text: row.formerGroupType10Text ? toText(row.formerGroupType10Text) : null,
            formerGroupType70Text: row.formerGroupType70Text ? toText(row.formerGroupType70Text) : null,
            formerGroupType20Text: row.formerGroupType20Text ? toText(row.formerGroupType20Text) : null,
            formerGroupType30Text: row.formerGroupType30Text ? toText(row.formerGroupType30Text) : null,
            formerGroupType40Text: row.formerGroupType40Text ? toText(row.formerGroupType40Text) : null,
            formerGroupTypeOtherText: row.formerGroupTypeOtherText ? toText(row.formerGroupTypeOtherText) : null,
        })),
        total,
        page,
        limit,
        totalPages,
    };
};

function toMemberStatus(value: unknown): MemberStatus {
    const text = toText(value);
    if (
        text === "activeHello" ||
        text === "trainee" ||
        text === "helloOg" ||
        text === "formerTrainee" ||
        text === "other"
    ) {
        return text;
    }
    return "other";
}
