import { duckdbDateYmdExpr } from "../date/duckdbDateExpr";

const aliasStartYmd = duckdbDateYmdExpr("ga.startDate");
const aliasEndYmd = duckdbDateYmdExpr("ga.endDate");
const membershipLeaveYmd = `COALESCE(NULLIF(${duckdbDateYmdExpr("gm.leaveDate")}, ''), CAST(CURRENT_DATE AS TEXT))`;

/** DuckDB: 在籍期間に応じたグループ表示名（エイリアス優先）。 */
export const SQL_MEMBERSHIP_DISPLAY_GROUP_NAME = `COALESCE(
  (
    SELECT CAST(ga.aliasName AS TEXT)
    FROM group_aliases ga
    WHERE CAST(ga.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)
      AND ${aliasStartYmd} <= ${membershipLeaveYmd}
      AND (
        ga.endDate IS NULL
        OR ${aliasEndYmd} >= ${membershipLeaveYmd}
      )
    ORDER BY ${aliasStartYmd} DESC, CAST(ga.groupAliasId AS INTEGER) DESC
    LIMIT 1
  ),
  CAST(gm.groupName AS TEXT)
)`;
