import { useMemo, useState } from "react";

import { MinusIcon, PlusIcon } from "../ui";
import { buildDisplayPerformerItems } from "./performerDisplay";

import type { PerformerSummaryRow } from "../../lib/setlistSearchDb/types";

type PerformerListProps = {
    performers: PerformerSummaryRow[];
    onOpenMember: (personId: number) => void;
    onOpenGroup: (groupId: number) => void;
};

export function PerformerList({
    performers,
    onOpenMember,
    onOpenGroup,
}: PerformerListProps) {
    const items = useMemo(() => buildDisplayPerformerItems(performers), [performers]);
    const resetKey = useMemo(
        () =>
            performers
                .map((row) => `${row.groupId ?? ""}:${row.personId ?? ""}:${row.performerName}`)
                .join("|"),
        [performers],
    );

    return (
        <PerformerListInner
            key={resetKey}
            items={items}
            onOpenMember={onOpenMember}
            onOpenGroup={onOpenGroup}
        />
    );
}

type PerformerListInnerProps = {
    items: ReturnType<typeof buildDisplayPerformerItems>;
    onOpenMember: (personId: number) => void;
    onOpenGroup: (groupId: number) => void;
};

function PerformerListInner({ items, onOpenMember, onOpenGroup }: PerformerListInnerProps) {
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

    const toggleGroupExpanded = (groupKey: string) => {
        setExpandedGroupKeys((current) => {
            const next = new Set(current);
            if (next.has(groupKey)) {
                next.delete(groupKey);
            } else {
                next.add(groupKey);
            }
            return next;
        });
    };

    if (items.length === 0) {
        return <p className="text-sm text-slate-500">出演者情報がありません。</p>;
    }

    const renderMeta = (item: (typeof items)[number]) => {
        const role = item.row.performerRole?.trim() ?? "";
        const note = item.row.note?.trim() ?? "";
        if (!role && !note) return null;
        return (
            <p className="mt-1 text-xs text-slate-600">
                {role ? `役割: ${role}` : ""}
                {role && note ? " / " : ""}
                {note ? note : ""}
            </p>
        );
    };

    return (
        <ul className="divide-y divide-gray-300 border-y border-gray-300">
            {items.map((item) => (
                <li key={item.key} className="px-1 py-1.5">
                    {item.type === "group" ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        item.row.groupId !== null &&
                                        onOpenGroup(item.row.groupId)
                                    }
                                    className="truncate text-left text-blue-600 hover:underline"
                                >
                                    {item.label}
                                </button>
                                {item.members.length > 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => toggleGroupExpanded(item.key)}
                                        className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-none px-2 text-[11px] text-slate-600 hover:bg-slate-50"
                                        aria-label={
                                            expandedGroupKeys.has(item.key)
                                                ? "メンバーを隠す"
                                                : "メンバーを表示"
                                        }
                                    >
                                        {expandedGroupKeys.has(item.key) ? (
                                            <MinusIcon className="h-3.5 w-3.5" />
                                        ) : (
                                            <PlusIcon className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                ) : null}
                            </div>
                            {expandedGroupKeys.has(item.key) && item.members.length > 0 ? (
                                <ul className="space-y-1 pl-4 text-sm">
                                    {item.members.map((member) => (
                                        <li key={`${item.key}-${member.personId ?? member.name}`}>
                                            {member.personId !== null ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenMember(member.personId as number)}
                                                    className="text-left text-blue-600 hover:underline"
                                                >
                                                    {member.name}
                                                </button>
                                            ) : (
                                                <span className="text-slate-700">
                                                    {member.name}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {renderMeta(item)}
                        </div>
                    ) : item.row.personId ? (
                        <div>
                            <button
                                type="button"
                                onClick={() => onOpenMember(item.row.personId as number)}
                                className="text-left text-blue-600 hover:underline"
                            >
                                {item.label}
                            </button>
                            {renderMeta(item)}
                        </div>
                    ) : item.row.groupId ? (
                        <div>
                            <button
                                type="button"
                                onClick={() => onOpenGroup(item.row.groupId as number)}
                                className="text-left text-blue-600 hover:underline"
                            >
                                {item.label}
                            </button>
                            {renderMeta(item)}
                        </div>
                    ) : (
                        <div>
                            <p className="text-sm text-slate-900">{item.label}</p>
                            {renderMeta(item)}
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );
}
