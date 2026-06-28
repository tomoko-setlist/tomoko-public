import { GROUP_TYPE_SHUFFLE_UNIT } from "../constants/groupTypes";

/** DuckDB: 所属中（シャッフルユニットを除く、leaveDate 未設定）。 */
export const SQL_MEMBERSHIP_IS_ONGOING = `(gm.leaveDate IS NULL OR CAST(gm.leaveDate AS TEXT) = '') AND COALESCE(CAST(g.groupType AS INTEGER), 0) <> ${GROUP_TYPE_SHUFFLE_UNIT}`;

/** DuckDB: 過去所属（leaveDate あり、または脱退日未設定のシャッフルユニット）。 */
export const SQL_MEMBERSHIP_IS_PAST = `((COALESCE(CAST(g.groupType AS INTEGER), 0) = ${GROUP_TYPE_SHUFFLE_UNIT} AND (gm.leaveDate IS NULL OR CAST(gm.leaveDate AS TEXT) = '')) OR (gm.leaveDate IS NOT NULL AND CAST(gm.leaveDate AS TEXT) <> ''))`;
