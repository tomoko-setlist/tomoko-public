import { toText } from "./queryUtils";

import type { GroupMembershipRow } from "./types";

const parsePackedTuples = (value: unknown, fieldCount: 3 | 4): string[][] => {
    if (value === null || value === undefined) return [];
    const text = toText(value).trim();
    if (!text) return [];
    if (!text.includes("|")) {
        return [fieldCount === 4 ? [text, "", "", ""] : [text, "", ""]];
    }
    const pattern =
        fieldCount === 4
            ? /([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)(?:\|\||$)/g
            : /([^|]*)\|([^|]*)\|([^|]*)(?:\|\||$)/g;
    const rows: string[][] = [];
    let match = pattern.exec(text);
    while (match) {
        if (fieldCount === 4) {
            rows.push([match[1] ?? "", match[2] ?? "", match[3] ?? "", match[4] ?? ""]);
        } else {
            rows.push([match[1] ?? "", match[2] ?? "", match[3] ?? ""]);
        }
        match = pattern.exec(text);
    }
    return rows;
};

export const parsePackedMemberColors = (
    value: unknown,
): NonNullable<GroupMembershipRow["memberColors"]> => {
    return parsePackedTuples(value, 4)
        .map(([colorCodeRaw, colorNameRaw, startDateRaw, endDateRaw]) => {
            const colorCode = colorCodeRaw?.trim() ?? "";
            if (!colorCode) return null;
            const colorName = colorNameRaw?.trim() ?? "";
            const startDate = startDateRaw?.trim() ?? "";
            const endDate = endDateRaw?.trim() ?? "";
            return {
                colorCode,
                colorName: colorName.length > 0 ? colorName : null,
                startDate: startDate.length > 0 ? startDate : null,
                endDate: endDate.length > 0 ? endDate : null,
            };
        })
        .filter(
            (
                row,
            ): row is {
                colorCode: string;
                colorName: string | null;
                startDate: string | null;
                endDate: string | null;
            } => row !== null,
        );
};

export const parsePackedMemberRoles = (
    value: unknown,
): NonNullable<GroupMembershipRow["memberRoles"]> => {
    return parsePackedTuples(value, 3)
        .map(([roleNameRaw, appointmentDateRaw, retirementDateRaw]) => {
            const roleName = roleNameRaw?.trim() ?? "";
            if (!roleName) return null;
            const appointmentDate = appointmentDateRaw?.trim() ?? "";
            const retirementDate = retirementDateRaw?.trim() ?? "";
            return {
                roleName,
                appointmentDate:
                    appointmentDate.length > 0 ? appointmentDate : null,
                retirementDate:
                    retirementDate.length > 0 ? retirementDate : null,
            };
        })
        .filter(
            (
                row,
            ): row is {
                roleName: string;
                appointmentDate: string | null;
                retirementDate: string | null;
            } => row !== null,
        );
};

export const parsePackedGroupAliases = (value: unknown): string[] => {
    return parsePackedTuples(value, 3)
        .map(([nameRaw, startRaw, endRaw]) => {
            const name = nameRaw?.trim() ?? "";
            if (!name) return null;
            const start = startRaw?.trim() ?? "";
            const end = endRaw?.trim() ?? "";
            if (!start && !end) return name;
            return `${name} (${start || "?"} - ${end || "現在"})`;
        })
        .filter((v): v is string => v !== null);
};
