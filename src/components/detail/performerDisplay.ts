import { HELLO_PRO_TRAINEE_CORE_GROUP_NAMES } from "../../lib/constants/helloProTrainee";

import type { PerformerSummaryRow } from "../../lib/setlistSearchDb/types";

export type PerformerDisplayMember = {
    personId: number | null;
    name: string;
};

export type PerformerDisplayItem =
    | {
          type: "single";
          key: string;
          label: string;
          row: PerformerSummaryRow;
          members: PerformerDisplayMember[];
      }
    | {
          type: "group";
          key: string;
          label: string;
          row: PerformerSummaryRow;
          members: PerformerDisplayMember[];
      };

const normalizeNameKey = (value: string): string =>
    value.replace(/[ \u3000\t\r\n]/g, "").trim();

const isTraineeGroupLabel = (label: string): boolean =>
    HELLO_PRO_TRAINEE_CORE_GROUP_NAMES.some(
        (groupName) => normalizeNameKey(label) === normalizeNameKey(groupName),
    );

const extractGroupMemberNames = (label: string): string[] => {
    const text = String(label ?? "").trim();
    if (!text) return [];
    const matched =
        text.match(/[（(]([^（）()]*)[）)]/) ??
        text.match(/[（(]([^（）()]*)$/);
    if (!matched || !matched[1]) return [];
    return matched[1]
        .split(/[・/／,、]/)
        .map((part) => normalizeNameKey(part))
        .filter((part) => part.length > 0);
};

const extractGroupBaseName = (label: string): string => {
    const text = String(label ?? "").trim();
    if (!text) return "";
    const stripped = text.replace(/[（(][^（）()]*[）)]?$/, "").trim();
    return stripped || text;
};

const joinUniqueNames = (names: string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of names) {
        const key = normalizeNameKey(raw);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(raw.trim());
    }
    return out;
};

const parseMemberPersonIdsJson = (value?: string | null): number[] => {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item: unknown) => Number(item))
            .filter((item) => Number.isFinite(item));
    } catch {
        return [];
    }
};

const parseAbsenceNamesJson = (value?: string | null): string[] => {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item) => String(item ?? "").trim())
            .filter((item) => item.length > 0);
    } catch {
        return [];
    }
};

const withAbsenceSuffix = (base: string, row: PerformerSummaryRow): string => {
    const absences = joinUniqueNames(parseAbsenceNamesJson(row.absencePersonNamesJson));
    if (absences.length === 0) return base;
    const baseKey = normalizeNameKey(base);
    if (
        row.groupId === null &&
        absences.length === 1 &&
        normalizeNameKey(absences[0] ?? "") === baseKey
    ) {
        return `${base}（欠席）`;
    }
    return `${base}（欠席: ${absences.join("・")}）`;
};

const rowDisplayName = (row: PerformerSummaryRow): string =>
    String(row.performerName || row.personName || row.groupName || "").trim();

const rowIdentityKey = (row: PerformerSummaryRow): string =>
    `${row.personId ?? "p"}:${row.groupId ?? "g"}:${normalizeNameKey(rowDisplayName(row))}`;

export const buildDisplayPerformerRows = (
    rows: PerformerSummaryRow[],
): PerformerSummaryRow[] => {
    if (rows.length === 0) return rows;

    const deduped: PerformerSummaryRow[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        const key = rowIdentityKey(row);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(row);
    }

    const hasGroupRows = deduped.some((row) => row.groupId !== null);
    if (!hasGroupRows) return deduped;

    const displayRows: PerformerSummaryRow[] = [];
    const groupByKey = new Map<string, { rowIndex: number; memberNames: string[] }>();

    for (const row of deduped) {
        if (row.groupId === null) {
            displayRows.push(row);
            continue;
        }
        const baseName = String(
            extractGroupBaseName(row.performerName || "") || row.groupName || "",
        ).trim();
        const key = row.groupId !== null ? `gid:${row.groupId}` : `gname:${normalizeNameKey(baseName)}`;
        const extractedMembers = extractGroupMemberNames(row.performerName || "");
        const existing = groupByKey.get(key);
        if (!existing) {
            displayRows.push({ ...row });
            groupByKey.set(key, {
                rowIndex: displayRows.length - 1,
                memberNames: [...extractedMembers],
            });
            continue;
        }
        existing.memberNames.push(...extractedMembers);
    }

    const groupedMemberNameKeys = new Set<string>();
    const groupedMemberPersonIds = new Set<number>();
    for (const item of groupByKey.values()) {
        const uniqueMembers = joinUniqueNames(item.memberNames);
        for (const memberName of uniqueMembers) {
            groupedMemberNameKeys.add(normalizeNameKey(memberName));
        }
        const row = displayRows[item.rowIndex];
        for (const personId of parseMemberPersonIdsJson(row.memberPersonIdsJson)) {
            groupedMemberPersonIds.add(personId);
        }
        const groupBase = String(
            extractGroupBaseName(row.performerName || "") || row.groupName || "",
        ).trim();
        row.performerName =
            uniqueMembers.length > 0
                ? `${groupBase}（${uniqueMembers.join("・")}）`
                : groupBase;
    }

    if (groupedMemberNameKeys.size === 0 && groupedMemberPersonIds.size === 0) {
        return displayRows;
    }

    return displayRows.filter((row) => {
        if (row.groupId !== null) return true;
        if (row.personId !== null && groupedMemberPersonIds.has(row.personId)) return false;
        const nameKey = normalizeNameKey(rowDisplayName(row));
        if (!nameKey) return true;
        return !groupedMemberNameKeys.has(nameKey);
    });
};

export const buildDisplayPerformerItems = (
    rows: PerformerSummaryRow[],
): PerformerDisplayItem[] => {
    const displayRows = buildDisplayPerformerRows(rows);
    const personRowsById = new Map<number, PerformerSummaryRow>();
    for (const row of rows) {
        if (row.personId !== null && !personRowsById.has(row.personId)) {
            personRowsById.set(row.personId, row);
        }
    }

    return displayRows.map((row, index) => {
        const key = `${row.groupId ?? "g"}-${row.personId ?? "p"}-${index}`;
        if (row.groupId === null) {
            return {
                type: "single" as const,
                key,
                label: withAbsenceSuffix(
                    row.performerName || row.personName || "-",
                    row,
                ),
                row,
                members: [],
            };
        }

        const memberIds = parseMemberPersonIdsJson(row.memberPersonIdsJson);
        const extractedMemberNames = extractGroupMemberNames(row.performerName || "");
        const membersFromIds = memberIds
            .map((personId, memberIndex) => {
                const personRow = personRowsById.get(personId);
                return {
                    personId,
                    name:
                        personRow?.performerName ||
                        personRow?.personName ||
                        extractedMemberNames[memberIndex] ||
                        "",
                };
            })
            .filter((member) => member.name.length > 0);
        const groupLabelBase = extractGroupBaseName(
            row.performerName || row.groupName || "-",
        );
        const isTraineeGroup = isTraineeGroupLabel(groupLabelBase);
        const members = isTraineeGroup
            ? membersFromIds
            : membersFromIds.length > 0
              ? membersFromIds
              : extractedMemberNames.map((name) => ({
                    personId: null,
                    name,
                }));
        const uniqueMembers = members.filter((member, memberIndex, source) => {
            const memberKey =
                member.personId !== null
                    ? `id:${member.personId}`
                    : `name:${normalizeNameKey(member.name)}`;
            return (
                source.findIndex((item) => {
                    const currentKey =
                        item.personId !== null
                            ? `id:${item.personId}`
                            : `name:${normalizeNameKey(item.name)}`;
                    return currentKey === memberKey;
                }) === memberIndex
            );
        });
        const shouldExpandMembers = uniqueMembers.length > 0;
        const groupLabel = withAbsenceSuffix(groupLabelBase, row);

        return {
            type: "group" as const,
            key,
            label: groupLabel,
            row,
            members: shouldExpandMembers ? uniqueMembers : [],
        };
    });
};
