import { GROUP_TYPE_SHUFFLE_UNIT } from "./constants/groupTypes";
import { formatDateYmd } from "./uiFormat";

export type MembershipActivityContext = {
    leaveDate?: string | null;
    groupType?: number | null;
    groupDisbandDate?: string | null;
};

/** シーズン限りのシャッフルユニットは脱退日がなくても現役所属にしない。 */
export function isOngoingMembership({
    leaveDate,
    groupType,
}: MembershipActivityContext): boolean {
    if (groupType === GROUP_TYPE_SHUFFLE_UNIT) return false;
    return (leaveDate ?? "").trim().length === 0;
}

export function resolveMembershipLeaveDate({
    leaveDate,
    groupType,
    groupDisbandDate,
}: MembershipActivityContext): string | null {
    const explicitLeave = (leaveDate ?? "").trim();
    if (explicitLeave) return explicitLeave;
    if (groupType === GROUP_TYPE_SHUFFLE_UNIT) {
        const disband = (groupDisbandDate ?? "").trim();
        if (disband) return disband;
    }
    return null;
}

export function formatMembershipTenureLabel(
    joinDate: string | null | undefined,
    context: MembershipActivityContext,
): string {
    const joined = formatDateYmd(joinDate);
    if (joined === "-") return "-";
    const resolvedLeave = resolveMembershipLeaveDate(context);
    if (resolvedLeave) {
        const left = formatDateYmd(resolvedLeave);
        return left === "-" ? `${joined} - ${left}` : `${joined} - ${left}`;
    }
    if (context.groupType === GROUP_TYPE_SHUFFLE_UNIT) {
        return `${joined} -`;
    }
    return `${joined} - 現在`;
}
