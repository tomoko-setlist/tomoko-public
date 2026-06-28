import { useEffect, useMemo, useState } from "react";

import {
    DetailErrorState,
    DetailLoadingState,
    DetailNotFoundState,
    DetailPanel,
    DetailShareLinkButton,
} from "./DetailUi";
import { GroupDetailTabs, type GroupDetailTabId } from "./GroupDetailTabs";
import { GroupMembershipTimeline } from "./GroupMembershipTimeline";
import { useEventTagFilter } from "./hooks/useEventTagFilter";
import { useGroupDetail } from "./hooks/useGroupDetail";
import {
    buildGroupTimelineModel,
    compareGroupMembershipByJoinAndBirthday,
} from "./membershipTimelineModel";
import { MicrophoneIcon, UserIcon } from "../ui";
import {
    RelatedEventStatsLine,
} from "./RelatedEventStats";
import { summarizeRelatedEvents } from "./relatedEventStatsModel";
import { TagFilterChips } from "./TagFilterChips";
import { formatMemberAgeLabel, formatAgeYears } from "../../lib/ageFormat";
import {
    GROUP_TYPE_CREATOR,
    GROUP_TYPE_HELLO_PRO_GROUP,
    GROUP_TYPE_HELLO_PRO_TRAINEE,
    GROUP_TYPE_HELLO_PRO_UNIT,
    GROUP_TYPE_OG_GROUP_OR_UNIT,
    GROUP_TYPE_OTHER,
    GROUP_TYPE_SHUFFLE_UNIT,
    GROUP_TYPE_SPECIAL_UNIT,
} from "../../lib/constants/groupTypes";
import {
    isOngoingMembership,
    formatMembershipTenureLabel,
} from "../../lib/membershipActivity";
import { formatDateRangeYmd, formatDateYmd, parseTags } from "../../lib/uiFormat";
import { EVENT_TAG_CHIP_CLASS } from "../ui/eventTagClass";

import type {
    GroupMembershipRow,
    SetlistSearchDb,
} from "../../lib/setlistSearchDb/types";

type GroupDetailPageProps = {
    db: SetlistSearchDb;
    groupId: number;
    onResolveTitle?: (title: string) => void;
    onOpenMember: (personId: number) => void;
    onOpenArtist: (artistId: number) => void;
    onOpenAlbum: (albumId: number) => void;
    onOpenEvent: (eventId: number) => void;
};
type MemberSortKey = "joinDate" | "birthday" | "name" | "generation";
type SortOrder = "asc" | "desc";

const GROUP_ACTIVITY_END_LABELS: Record<string, string> = {
    "Berryz工房": "無期限活動停止",
    "カントリー・ガールズ": "活動休止",
};
const GROUP_TYPE_LABELS: Record<number, string> = {
    [GROUP_TYPE_HELLO_PRO_GROUP]: "ハロプログループ",
    [GROUP_TYPE_HELLO_PRO_UNIT]: "ハロプロユニット",
    [GROUP_TYPE_SPECIAL_UNIT]: "スペシャルユニット",
    [GROUP_TYPE_SHUFFLE_UNIT]: "シャッフルユニット",
    [GROUP_TYPE_OG_GROUP_OR_UNIT]: "OGグループ / ユニット",
    [GROUP_TYPE_CREATOR]: "クリエイター",
    [GROUP_TYPE_HELLO_PRO_TRAINEE]: "ハロプロ研修生",
    [GROUP_TYPE_OTHER]: "その他",
};
const EVENTS_PER_PAGE = 20;

export function GroupDetailPage({
    db,
    groupId,
    onResolveTitle,
    onOpenMember,
    onOpenArtist,
    onOpenAlbum,
    onOpenEvent,
}: GroupDetailPageProps) {
    const { loading, error, detail, members, artists, albums, events } = useGroupDetail(db, groupId);
    const [eventPage, setEventPage] = useState(1);
    const [memberSortKey, setMemberSortKey] = useState<MemberSortKey>("joinDate");
    const [memberSortOrder, setMemberSortOrder] = useState<SortOrder>("asc");
    const [activeTab, setActiveTab] = useState<GroupDetailTabId>("members");
    const { selectedTags: selectedEventTags, setSelectedTags: setSelectedEventTags, tagOptions: eventTagOptions, filteredRows: filteredEvents } = useEventTagFilter(events);
    const filteredEventStats = useMemo(
        () => summarizeRelatedEvents(filteredEvents),
        [filteredEvents],
    );
    const eventTabStats = useMemo(
        () => summarizeRelatedEvents(events),
        [events],
    );

    const timelineModel = useMemo(
        () =>
            detail
                ? buildGroupTimelineModel(members, {
                      formationDate: detail.formationDate,
                      debutDate: detail.debutDate,
                      disbandDate: detail.disbandDate,
                      groupType: detail.groupType,
                  })
                : null,
        [detail, members],
    );
    const tabs = useMemo(() => {
        const items = [];
        if (members.length > 0) {
            items.push({ id: "members" as const, label: "メンバー", count: members.length });
        }
        if (timelineModel) {
            items.push({ id: "timeline" as const, label: "タイムライン" });
        }
        if (artists.length > 0) {
            items.push({ id: "artists" as const, label: "関連アーティスト", count: artists.length });
        }
        if (events.length > 0) {
            items.push({ id: "events" as const, label: "出演イベント", count: eventTabStats.eventCount });
        }
        return items;
    }, [members.length, timelineModel, artists.length, events.length, eventTabStats.eventCount]);

    const activeTabId = useMemo((): GroupDetailTabId => {
        if (tabs.length === 0) return activeTab;
        if (tabs.some((tab) => tab.id === activeTab)) return activeTab;
        return tabs[0].id;
    }, [tabs, activeTab]);

    useEffect(() => {
        if (detail?.groupName) onResolveTitle?.(detail.groupName);
    }, [detail?.groupName, onResolveTitle]);

    if (loading) return <DetailLoadingState />;
    if (error) return <DetailErrorState message={error} />;
    if (!detail) return <DetailNotFoundState message="グループが見つかりませんでした。" />;
    const activityEndLabel =
        GROUP_ACTIVITY_END_LABELS[detail.groupName] ?? "解散";
    const groupTypeLabel =
        GROUP_TYPE_LABELS[detail.groupType] ?? String(detail.groupType);

    const sortedMembers = [...members].sort((a, b) => {
        let diff = 0;
        if (memberSortKey === "joinDate") {
            diff = compareGroupMembershipByJoinAndBirthday(a, b);
        } else if (memberSortKey === "birthday") {
            diff = toSortableTime(a.birthday) - toSortableTime(b.birthday);
        } else if (memberSortKey === "name") {
            diff = a.personName.localeCompare(b.personName, "ja", {
                sensitivity: "base",
                numeric: true,
            });
        } else if (memberSortKey === "generation") {
            diff = (a.generation ?? "").localeCompare(b.generation ?? "", "ja", {
                sensitivity: "base",
                numeric: true,
            });
        }
        if (diff === 0) {
            diff = a.groupPersonId - b.groupPersonId;
        }
        return memberSortOrder === "asc" ? diff : diff * -1;
    });
    const isShuffleGroup = detail.groupType === GROUP_TYPE_SHUFFLE_UNIT;
    const activeMembers = isShuffleGroup
        ? []
        : sortedMembers.filter((row) =>
              isOngoingMembership({ leaveDate: row.leaveDate, groupType: detail.groupType }),
          );
    const ogMembers = isShuffleGroup
        ? sortedMembers
        : sortedMembers.filter(
              (row) =>
                  !isOngoingMembership({ leaveDate: row.leaveDate, groupType: detail.groupType }),
          );
    const formatGeneration = (value: string | null) => {
        const text = (value ?? "").trim();
        return text || "-";
    };
    const eventTotalPages = Math.max(
        1,
        Math.ceil(filteredEvents.length / EVENTS_PER_PAGE),
    );
    const clampedEventPage = Math.min(eventPage, eventTotalPages);
    const pagedEvents = filteredEvents.slice(
        (clampedEventPage - 1) * EVENTS_PER_PAGE,
        clampedEventPage * EVENTS_PER_PAGE,
    );

    const handleMemberSortChange = (key: MemberSortKey) => {
        if (memberSortKey === key) {
            setMemberSortOrder((current) => (current === "asc" ? "desc" : "asc"));
            return;
        }
        setMemberSortKey(key);
        setMemberSortOrder("asc");
    };

    return (
        <div className="space-y-4">
            <DetailPanel className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">GROUP</p>
                        <h1 className="min-w-0 break-words text-lg font-bold text-slate-900">{detail.groupName}</h1>
                    </div>
                    <DetailShareLinkButton />
                </div>
                <div className="mt-1.5 space-y-1 text-sm text-slate-600">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                        <span>
                            種別: <span className="font-semibold text-slate-800">{groupTypeLabel}</span>
                        </span>
                        <span>
                            メンバー総数: <span className="font-semibold text-slate-900">{detail.totalMembers}</span>
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                        <span>
                            結成: <span className="font-semibold text-slate-800">{formatDateYmd(detail.formationDate)}</span>
                        </span>
                        <span>
                            デビュー: <span className="font-semibold text-slate-800">{formatDateYmd(detail.debutDate)}</span>
                        </span>
                        {detail.disbandDate ? (
                            <span>
                                {activityEndLabel}: <span className="font-semibold text-slate-800">{formatDateYmd(detail.disbandDate)}</span>
                            </span>
                        ) : null}
                    </div>
                    {detail.pastNames.length > 0 ? (
                        <p className="text-xs">
                            過去名: <span className="font-semibold text-slate-700">{detail.pastNames.join(" / ")}</span>
                        </p>
                    ) : null}
                </div>
            </DetailPanel>

            {tabs.length > 0 ? (
                <DetailPanel className="overflow-hidden p-0">
                    <GroupDetailTabs tabs={tabs} activeTab={activeTabId} onChange={setActiveTab} />
                    <div className="p-4">
                        {activeTabId === "members" ? (
                            <div className="space-y-4">
                                {isShuffleGroup && sortedMembers.length > 0 ? (
                                    <section>
                                        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                                            <UserIcon className="h-4 w-4" />
                                            メンバー（{sortedMembers.length}）
                                        </h2>
                                        <MemberCardList
                                            rows={sortedMembers}
                                            onOpenMember={onOpenMember}
                                            showLeaveDate={true}
                                            groupType={detail.groupType}
                                            groupDisbandDate={detail.disbandDate}
                                            formatGeneration={formatGeneration}
                                            sortKey={memberSortKey}
                                            sortOrder={memberSortOrder}
                                            onSortChange={handleMemberSortChange}
                                        />
                                    </section>
                                ) : null}

                                {!isShuffleGroup && activeMembers.length > 0 ? (
                                    <section>
                                        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                                            <UserIcon className="h-4 w-4" />
                                            現役メンバー（{activeMembers.length}）
                                        </h2>
                                        <MemberCardList
                                            rows={activeMembers}
                                            onOpenMember={onOpenMember}
                                            showLeaveDate={false}
                                            formatGeneration={formatGeneration}
                                            sortKey={memberSortKey}
                                            sortOrder={memberSortOrder}
                                            onSortChange={handleMemberSortChange}
                                        />
                                    </section>
                                ) : null}

                                {!isShuffleGroup && ogMembers.length > 0 ? (
                                    <section>
                                        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                                            <UserIcon className="h-4 w-4" />
                                            OGメンバー
                                        </h2>
                                        <MemberCardList
                                            rows={ogMembers}
                                            onOpenMember={onOpenMember}
                                            showLeaveDate
                                            formatGeneration={formatGeneration}
                                            sortKey={memberSortKey}
                                            sortOrder={memberSortOrder}
                                            onSortChange={handleMemberSortChange}
                                        />
                                    </section>
                                ) : null}
                            </div>
                        ) : null}

                        {activeTabId === "timeline" && timelineModel ? (
                            <GroupMembershipTimeline
                                members={members}
                                albums={albums}
                                context={{
                                    formationDate: detail.formationDate,
                                    debutDate: detail.debutDate,
                                    disbandDate: detail.disbandDate,
                                    groupType: detail.groupType,
                                }}
                                onOpenMember={onOpenMember}
                                onOpenAlbum={onOpenAlbum}
                            />
                        ) : null}

                        {activeTabId === "artists" && artists.length > 0 ? (
                            <section>
                                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                                    <MicrophoneIcon className="h-4 w-4" />
                                    関連アーティスト
                                </h2>
                                <ul className="divide-y divide-gray-300 border-y border-gray-300">
                                    {artists.map((row) => (
                                        <li key={row.artistId} className="px-1 py-1.5">
                                            <button
                                                type="button"
                                                onClick={() => onOpenArtist(row.artistId)}
                                                className="text-left text-sm text-blue-600 hover:underline"
                                            >
                                                {row.artistName}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ) : null}

                        {activeTabId === "events" && events.length > 0 ? (
                            <section>
                                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <h2 className="text-base font-semibold text-slate-900">参加イベント</h2>
                                    <RelatedEventStatsLine
                                        stats={filteredEventStats}
                                    />
                                </div>
                                {eventTagOptions.length > 0 ? (
                                    <div className="mb-2">
                                        <TagFilterChips
                                            options={eventTagOptions}
                                            selected={selectedEventTags}
                                            onChange={(next) => {
                                                setSelectedEventTags(next);
                                                setEventPage(1);
                                            }}
                                            className="text-xs text-slate-600"
                                        />
                                    </div>
                                ) : null}
                                <div className="space-y-2">
                                    <div className="divide-y divide-gray-300 border-y border-gray-300">
                                        {pagedEvents.map((eventRow) => {
                                            const eventTags = parseTags(eventRow.eventTagsJson ?? "[]");
                                            return (
                                                <div key={eventRow.eventId}>
                                                    <div className="grid grid-cols-[84px_1fr] items-start gap-2 px-1 py-1.5 text-xs">
                                                        <div className="whitespace-nowrap text-slate-700">
                                                            <div>{formatDateYmd(eventRow.earliestDate ?? eventRow.latestDate)}</div>
                                                            {eventRow.earliestDate &&
                                                            eventRow.latestDate &&
                                                            eventRow.earliestDate !== eventRow.latestDate ? (
                                                                <div className="text-[11px] text-slate-500">
                                                                    ~ {formatDateYmd(eventRow.latestDate)}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => onOpenEvent(eventRow.eventId)}
                                                                className="line-clamp-2 text-left text-[12px] leading-tight text-blue-600 hover:underline"
                                                            >
                                                                {eventRow.eventName}
                                                            </button>
                                                            {eventTags.length > 0 ? (
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {eventTags.map((tag) => (
                                                                        <span
                                                                            key={`${eventRow.eventId}-${tag}`}
                                                                            className={EVENT_TAG_CHIP_CLASS}
                                                                        >
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {eventTotalPages > 1 ? (
                                        <div className="flex items-center justify-end gap-2 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => setEventPage((current) => Math.max(1, current - 1))}
                                                disabled={clampedEventPage <= 1}
                                                className="rounded-none border border-gray-600 px-2 py-0.5 disabled:opacity-40"
                                            >
                                                前へ
                                            </button>
                                            <span className="text-slate-600">
                                                {clampedEventPage} / {eventTotalPages}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setEventPage((current) =>
                                                        Math.min(eventTotalPages, current + 1),
                                                    )
                                                }
                                                disabled={clampedEventPage >= eventTotalPages}
                                                className="rounded-none border border-gray-600 px-2 py-0.5 disabled:opacity-40"
                                            >
                                                次へ
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </section>
                        ) : null}
                    </div>
                </DetailPanel>
            ) : null}
        </div>
    );
}

function MemberCardList({
    rows,
    onOpenMember,
    showLeaveDate,
    groupType,
    groupDisbandDate,
    formatGeneration,
    sortKey,
    sortOrder,
    onSortChange,
}: {
    rows: GroupMembershipRow[];
    onOpenMember: (personId: number) => void;
    showLeaveDate: boolean;
    groupType?: number;
    groupDisbandDate?: string | null;
    formatGeneration: (value: string | null) => string;
    sortKey: MemberSortKey;
    sortOrder: SortOrder;
    onSortChange: (key: MemberSortKey) => void;
}) {
    const sortLabel = (key: MemberSortKey) =>
        sortKey === key ? (sortOrder === "asc" ? " ↑" : " ↓") : "";

    const formatTenure = (row: GroupMembershipRow) => {
        if (showLeaveDate) {
            return formatMembershipTenureLabel(row.joinDate, {
                leaveDate: row.leaveDate,
                groupType,
                groupDisbandDate,
            });
        }
        return `${formatDateYmd(row.joinDate)} - 現在`;
    };

    return (
        <>
            <ul className="space-y-2.5 md:hidden">
                {rows.map((row) => {
                    const primaryColor =
                        row.memberColors?.find((color) => !color.endDate) ??
                        row.memberColors?.[0] ??
                        null;
                    return (
                        <li
                            key={row.groupPersonId}
                            className="border-2 border-slate-700 bg-white px-3 py-2 shadow-[4px_4px_0_0_#475569]"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => onOpenMember(row.personId)}
                                        className="text-left text-base font-semibold text-blue-700 hover:underline"
                                    >
                                        {row.personName}
                                    </button>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                                        <span>
                                            <span className="font-semibold text-slate-800">
                                                {formatDateYmd(row.birthday)}
                                            </span>{" "}
                                            生
                                        </span>
                                        <span>
                                            <span className="font-semibold text-slate-800">
                                                {formatMemberAgeLabel(row.birthday, row.deathday)}
                                            </span>
                                        </span>
                                        <span className="inline-flex items-baseline gap-1 text-slate-500">
                                            <span className="text-sm font-bold text-slate-800">
                                                {row.birthPlaceText || "-"}
                                            </span>
                                            <span className="text-[11px]">出身</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="shrink-0 text-right">
                                    <div className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                                        {primaryColor ? (
                                            <span
                                                className="h-4 w-4 border border-slate-500"
                                                style={{ backgroundColor: primaryColor.colorCode }}
                                            />
                                        ) : null}
                                        <span>{primaryColor?.colorName || primaryColor?.colorCode || "-"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-300 pt-1.5 text-xs text-slate-700">
                                <span className="text-left">
                                    <span className="text-[10px] font-semibold text-slate-500">在籍期間 </span>
                                    {formatTenure(row)}
                                </span>
                                {row.generation && row.generation.trim() ? (
                                    <span className="text-right font-semibold text-slate-800">
                                        {formatGeneration(row.generation)}
                                    </span>
                                ) : null}
                            </div>

                            {row.memberRoles && row.memberRoles.length > 0 ? (
                                <div className="mt-1 border-t border-slate-300 pt-1">
                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                        {row.memberRoles.map((role, index) => (
                                            (() => {
                                                const active = isRoleActive(
                                                    role.appointmentDate,
                                                    role.retirementDate,
                                                );
                                                return (
                                            <span
                                                key={`${row.groupPersonId}-${role.roleName}-${role.appointmentDate ?? "na"}-${index}`}
                                                className={
                                                    active
                                                        ? "inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-100 px-2 py-[1px] text-[11px] font-semibold text-slate-900"
                                                        : "inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-[1px] text-[11px] text-slate-500"
                                                }
                                            >
                                                <span className={active ? "font-semibold" : ""}>
                                                    {role.roleName}
                                                </span>
                                                <span className="text-slate-500">
                                                    {formatDateRangeYmd(
                                                        role.appointmentDate,
                                                        role.retirementDate,
                                                        "-",
                                                    )}
                                                </span>
                                            </span>
                                                );
                                            })()
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>

            <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse border-2 border-slate-700 text-sm">
                    <thead>
                        <tr className="bg-slate-100 text-xs text-slate-700">
                            <th className="border border-slate-300 px-2 py-2 text-left">
                                <button type="button" onClick={() => onSortChange("name")} className="hover:underline">
                                    名前{sortLabel("name")}
                                </button>
                            </th>
                            <th className="border border-slate-300 px-2 py-2 text-left">
                                <button type="button" onClick={() => onSortChange("birthday")} className="hover:underline">
                                    生年月日{sortLabel("birthday")}
                                </button>
                            </th>
                            <th className="border border-slate-300 px-2 py-2 text-right">年齢</th>
                            <th className="border border-slate-300 px-2 py-2 text-left">出身</th>
                            <th className="border border-slate-300 px-2 py-2 text-left">メンバーカラー</th>
                            <th className="border border-slate-300 px-2 py-2 text-left">
                                <button type="button" onClick={() => onSortChange("joinDate")} className="hover:underline">
                                    在籍期間{sortLabel("joinDate")}
                                </button>
                            </th>
                            <th className="border border-slate-300 px-2 py-2 text-left">
                                <button type="button" onClick={() => onSortChange("generation")} className="hover:underline">
                                    期{sortLabel("generation")}
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const primaryColor =
                                row.memberColors?.find((color) => !color.endDate) ??
                                row.memberColors?.[0] ??
                                null;
                            return (
                                <tr key={row.groupPersonId} className="align-top even:bg-slate-50/50">
                                    <td className="border border-slate-300 px-2 py-2">
                                        <button
                                            type="button"
                                            onClick={() => onOpenMember(row.personId)}
                                            className="text-left font-semibold text-blue-700 hover:underline"
                                        >
                                            {row.personName}
                                        </button>
                                    </td>
                                    <td className="border border-slate-300 px-2 py-2 text-slate-700">
                                        {formatDateYmd(row.birthday)}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-2 text-right text-slate-700">
                                        {row.deathday
                                            ? `享年${formatAgeYears(row.birthday, row.deathday)}`
                                            : formatAgeYears(row.birthday)}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-2 text-slate-700">
                                        {row.birthPlaceText || "-"}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-2 text-slate-700">
                                        <span className="inline-flex items-center gap-1.5">
                                            {primaryColor ? (
                                                <span
                                                    className="h-3.5 w-3.5 border border-slate-500"
                                                    style={{ backgroundColor: primaryColor.colorCode }}
                                                />
                                            ) : null}
                                            <span>{primaryColor?.colorName || primaryColor?.colorCode || "-"}</span>
                                        </span>
                                    </td>
                                    <td className="border border-slate-300 px-2 py-2 text-slate-700">
                                        {formatTenure(row)}
                                        {row.memberRoles && row.memberRoles.length > 0 ? (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {row.memberRoles.map((role, index) => {
                                                    const active = isRoleActive(
                                                        role.appointmentDate,
                                                        role.retirementDate,
                                                    );
                                                    return (
                                                        <span
                                                            key={`${row.groupPersonId}-${role.roleName}-${role.appointmentDate ?? "na"}-${index}`}
                                                            className={
                                                                active
                                                                    ? "inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-100 px-2 py-[1px] text-[11px] font-semibold text-slate-900"
                                                                    : "inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-[1px] text-[11px] text-slate-500"
                                                            }
                                                        >
                                                            <span>{role.roleName}</span>
                                                            <span className="text-slate-500">
                                                                {formatDateRangeYmd(
                                                                    role.appointmentDate,
                                                                    role.retirementDate,
                                                                    "-",
                                                                )}
                                                            </span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-2 text-slate-700">
                                        {formatGeneration(row.generation)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
}

function toSortableTime(value: string | null | undefined): number {
    const text = String(value ?? "").trim();
    if (!text) return Number.MAX_SAFE_INTEGER;
    if (/^\d{10,13}$/.test(text)) {
        const n = Number(text);
        if (Number.isFinite(n)) return text.length <= 10 ? n * 1000 : n;
    }
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function isRoleActive(
    appointmentDate: string | null | undefined,
    retirementDate: string | null | undefined,
): boolean {
    const now = Date.now();
    const start = toSortableTime(appointmentDate);
    const end = toSortableTime(retirementDate);
    const started = !Number.isFinite(start) || start === Number.MAX_SAFE_INTEGER || start <= now;
    const notEnded = !retirementDate || !retirementDate.trim() || end >= now;
    return started && notEnded;
}
