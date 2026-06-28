import { useEffect, useMemo, useState } from "react";

import { DetailSectionHeader } from "./DetailSectionHeader";
import {
    DetailErrorState,
    DetailLoadingState,
    DetailNotFoundState,
    DetailPanel,
    DetailShareLinkButton,
} from "./DetailUi";
import { MicrophoneIcon, UsersIcon } from "../ui";
import { useEventTagFilter } from "./hooks/useEventTagFilter";
import { useMemberDetail } from "./hooks/useMemberDetail";
import {
    RelatedEventStatsLine,
} from "./RelatedEventStats";
import { summarizeRelatedEvents } from "./relatedEventStatsModel";
import { TagFilterChips } from "./TagFilterChips";
import {
    GROUP_TYPE_HELLO_PRO_GROUP,
    GROUP_TYPE_HELLO_PRO_TRAINEE,
    GROUP_TYPE_HELLO_PRO_UNIT,
    GROUP_TYPE_SHUFFLE_UNIT,
    GROUP_TYPE_SPECIAL_UNIT,
} from "../../lib/constants/groupTypes";
import { formatHeightCmDisplay } from "../../lib/heightCm";
import {
    resolveMembershipLeaveDate,
} from "../../lib/membershipActivity";
import { getMemberStatusLabel } from "../../lib/memberStatus";
import {
    formatDateRangeYmd,
    formatDateYmd,
    parseTags,
} from "../../lib/uiFormat";
import { EVENT_TAG_CHIP_CLASS } from "../ui/eventTagClass";

import type {
    GroupMembershipRow,
    SetlistSearchDb,
} from "../../lib/setlistSearchDb/types";

type MemberDetailPageProps = {
    db: SetlistSearchDb;
    personId: number;
    onResolveTitle?: (title: string) => void;
    onOpenGroup: (groupId: number) => void;
    onOpenArtist: (artistId: number) => void;
    onOpenEvent: (eventId: number) => void;
};

const EVENTS_PER_PAGE = 20;

export function MemberDetailPage({
    db,
    personId,
    onResolveTitle,
    onOpenGroup,
    onOpenArtist,
    onOpenEvent,
}: MemberDetailPageProps) {
    const { loading, error, detail, profile, groups, colors, artists, roles, events } = useMemberDetail(db, personId);
    const [eventPage, setEventPage] = useState(1);
    const { selectedTags: selectedEventTags, setSelectedTags: setSelectedEventTags, tagOptions: eventTagOptions, filteredRows: filteredEvents } = useEventTagFilter(events);
    const filteredEventStats = useMemo(
        () => summarizeRelatedEvents(filteredEvents),
        [filteredEvents],
    );
    const [artistSortOrder, setArtistSortOrder] = useState<"asc" | "desc">(
        "asc",
    );

    useEffect(() => {
        if (detail?.personName) onResolveTitle?.(detail.personName);
    }, [detail?.personName, onResolveTitle]);

    if (loading) return <DetailLoadingState />;
    if (error) return <DetailErrorState message={error} />;
    if (!detail)
        return (
            <DetailNotFoundState message="メンバーが見つかりませんでした。" />
        );

    const basicInfoRows = [
        { label: "名前(かな)", value: detail.nameKana },
        {
            label: "本名",
            value:
                detail.lastName || detail.firstName
                    ? `${detail.lastName ?? ""} ${detail.firstName ?? ""}`.trim()
                    : null,
        },
        { label: "誕生日", value: formatDateYmd(detail.birthday) },
        {
            label: "身長",
            value: formatHeightCmDisplay(detail.heightCm),
        },
        { label: "出身地", value: detail.prefectureName },
        { label: "ニックネーム", value: profile?.nickname },
        { label: "愛称", value: profile?.nicknameAlt },
        { label: "好きな食べ物", value: profile?.favoriteFood },
        { label: "座右の銘", value: profile?.motto },
        { label: "プロフィール", value: profile?.officialProfileText },
        { label: "備考", value: profile?.specialNotes },
        {
            label: "没日",
            value: detail.deathday ? formatDateYmd(detail.deathday) : null,
        },
    ]
        .filter((row) => hasDisplayValue(row.value))
        .map((row) => ({ label: row.label, value: toDisplayText(row.value) }));

    const eventTotalPages = Math.max(
        1,
        Math.ceil(filteredEvents.length / EVENTS_PER_PAGE),
    );
    const clampedEventPage = Math.min(eventPage, eventTotalPages);
    const pagedEvents = filteredEvents.slice(
        (clampedEventPage - 1) * EVENTS_PER_PAGE,
        clampedEventPage * EVENTS_PER_PAGE,
    );
    const sortedArtists = [...artists].sort((left, right) => {
        const compared = left.artistName.localeCompare(right.artistName, "ja", {
            sensitivity: "base",
            numeric: true,
        });
        return artistSortOrder === "asc" ? compared : compared * -1;
    });
    const memberStatusLabel = getMemberStatusLabel(detail.memberStatus);
    const currentColors = colors.filter((row) => !row.endDate);
    const latestColor = [...colors].sort((left, right) => {
        const leftTime = left.startDate
            ? new Date(left.startDate).getTime()
            : 0;
        const rightTime = right.startDate
            ? new Date(right.startDate).getTime()
            : 0;
        return rightTime - leftTime;
    })[0];
    const headerColors = (
        currentColors.length > 0
            ? currentColors
            : latestColor
              ? [latestColor]
              : []
    ).map((row) => normalizeHexColor(row.colorCode));
    const slashColorGradient = buildColorLineGradient(headerColors);
    return (
        <div className="space-y-4">
            <DetailPanel className="relative overflow-hidden p-4">
                {headerColors.length > 0 ? (
                    <div
                        className="pointer-events-none absolute -left-4 top-8 h-1.5 w-60 -rotate-[40deg]"
                        style={{
                            transformOrigin: "left top",
                            backgroundImage: slashColorGradient,
                        }}
                        aria-hidden="true"
                    />
                ) : null}
                <div className="relative z-10 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                            MEMBER
                        </p>
                        <div className="mt-0.5 flex min-w-0 items-start gap-2">
                            <div className="max-w-full">
                                <h1 className="min-w-0 break-words text-lg font-bold text-slate-900">
                                    {detail.personName}
                                </h1>
                            </div>
                            {memberStatusLabel ? (
                                <span className="shrink-0 rounded-sm border border-slate-400 bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-700">
                                    {memberStatusLabel}
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <DetailShareLinkButton />
                </div>
                <div className="relative z-10 mt-3">
                    {basicInfoRows.length > 0 ? (
                        <dl className="space-y-1">
                            {basicInfoRows.map((row) => (
                                <div
                                    key={row.label}
                                    className="grid grid-cols-[120px_1fr] gap-2 border-b border-gray-300 py-1.5 last:border-0"
                                >
                                    <dt className="truncate text-xs font-semibold text-slate-500">
                                        {row.label}
                                    </dt>
                                    <dd className="min-w-0 text-sm whitespace-pre-wrap text-slate-800">
                                        {row.value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    ) : (
                        <p className="text-sm text-slate-500">
                            表示できる基本情報がありません。
                        </p>
                    )}
                </div>
            </DetailPanel>

            {colors.length > 0 ? (
                <DetailPanel className="p-4">
                    <h2 className="mb-3 text-base font-semibold text-slate-900">
                        メンバーカラー
                    </h2>
                    <ul className="grid gap-2 sm:grid-cols-2">
                        {colors.map((row) => (
                            <li
                                key={row.memberColorId}
                                className="flex items-center justify-between gap-2 rounded-none border-2 border-gray-800 px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                        {row.colorName || row.colorCode}
                                    </p>
                                    <p className="truncate text-xs text-slate-600">
                                        {row.groupName} /{" "}
                                        {formatDateRangeYmd(
                                            row.startDate,
                                            row.endDate,
                                            "-",
                                        )}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center">
                                    <span
                                        className="h-6 w-6 rounded-none border-2 border-gray-800"
                                        style={{
                                            backgroundColor: normalizeHexColor(
                                                row.colorCode,
                                            ),
                                        }}
                                        title={row.colorCode}
                                        aria-label={`カラーサンプル ${row.colorCode}`}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </DetailPanel>
            ) : null}

            {groups.length > 0 ? (
                <DetailPanel className="p-4">
                    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                        <UsersIcon className="h-4 w-4" />
                        グループ・ユニット
                    </h2>
                    <GroupedMembershipList
                        rows={groups}
                        onOpenGroup={onOpenGroup}
                    />
                </DetailPanel>
            ) : null}

            {artists.length > 0 ? (
                <DetailPanel className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                            <MicrophoneIcon className="h-4 w-4" />
                            関連アーティスト
                        </h2>
                        {artists.length > 1 ? (
                            <select
                                value={artistSortOrder}
                                onChange={(event) =>
                                    setArtistSortOrder(
                                        event.target.value === "desc"
                                            ? "desc"
                                            : "asc",
                                    )
                                }
                                className="rounded-none border-2 border-gray-800 bg-white px-2 py-1 text-xs text-slate-700"
                                aria-label="関連アーティストの並び順"
                            >
                                <option value="asc">かな昇順</option>
                                <option value="desc">かな降順</option>
                            </select>
                        ) : null}
                    </div>
                    <ul className="divide-y divide-gray-300 border-y border-gray-300">
                        {sortedArtists.map((row) => (
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
                </DetailPanel>
            ) : null}

            {roles.length > 0 ? (
                <DetailPanel className="p-4">
                    <h2 className="mb-3 text-base font-semibold text-slate-900">
                        役職履歴
                    </h2>
                    <ul className="divide-y divide-gray-300 border-y border-gray-300">
                        {roles.map((row) => (
                            <li
                                key={row.groupPersonRoleId}
                                className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1 py-1 text-xs"
                            >
                                <span className="font-semibold text-slate-900">
                                    {row.roleName}
                                </span>
                                <span className="text-slate-500">/</span>
                                <span className="text-slate-700">
                                    {row.groupName}
                                </span>
                                <span className="text-slate-500">/</span>
                                <span className="text-slate-600">
                                    {formatDateRangeYmd(
                                        row.appointmentDate,
                                        row.retirementDate,
                                        "-",
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </DetailPanel>
            ) : null}

            {events.length > 0 ? (
                <DetailPanel className="p-4">
                    <DetailSectionHeader
                        title="参加イベント"
                        right={
                            <RelatedEventStatsLine
                                stats={filteredEventStats}
                            />
                        }
                        below={
                            eventTagOptions.length > 0 ? (
                                <TagFilterChips
                                    options={eventTagOptions}
                                    selected={selectedEventTags}
                                    onChange={(next) => {
                                        setSelectedEventTags(next);
                                        setEventPage(1);
                                    }}
                                    className="text-xs text-slate-600"
                                />
                            ) : null
                        }
                    />
                    <div className="space-y-2">
                        <div className="divide-y divide-gray-300 border-y border-gray-300">
                            {pagedEvents.map((eventRow) => {
                                const eventTags = parseTags(
                                    eventRow.eventTagsJson ?? "[]",
                                );
                                return (
                                    <div key={eventRow.eventId}>
                                        <div className="grid grid-cols-[84px_1fr] items-start gap-2 px-1 py-1.5 text-xs">
                                            <div className="whitespace-nowrap text-slate-700">
                                                <div>
                                                    {formatDateYmd(
                                                        eventRow.earliestDate ??
                                                            eventRow.latestDate,
                                                    )}
                                                </div>
                                                {eventRow.earliestDate &&
                                                eventRow.latestDate &&
                                                eventRow.earliestDate !==
                                                    eventRow.latestDate ? (
                                                    <div className="text-[11px] text-slate-500">
                                                        ~{" "}
                                                        {formatDateYmd(
                                                            eventRow.latestDate,
                                                        )}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onOpenEvent(
                                                            eventRow.eventId,
                                                        )
                                                    }
                                                    className="line-clamp-2 text-left text-[12px] leading-tight text-blue-600 hover:underline"
                                                >
                                                    {eventRow.eventName}
                                                </button>
                                                {eventTags.length > 0 ? (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {eventTags.map((tag) => (
                                                            <span
                                                                key={`${eventRow.eventId}-${tag}`}
                                                                className={
                                                                    EVENT_TAG_CHIP_CLASS
                                                                }
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
                                    onClick={() =>
                                        setEventPage((current) =>
                                            Math.max(1, current - 1),
                                        )
                                    }
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
                </DetailPanel>
            ) : null}
        </div>
    );
}

function normalizeHexColor(value: string): string {
    const color = value.trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : "#94a3b8";
}

function buildColorLineGradient(colors: string[]): string {
    if (colors.length === 0) {
        return "linear-gradient(90deg, rgba(71,85,105,0.9) 0%, rgba(71,85,105,0.9) 100%)";
    }
    if (colors.length === 1) {
        return `linear-gradient(90deg, ${colors[0]} 0%, ${colors[0]} 100%)`;
    }
    const step = 100 / colors.length;
    const stops = colors.flatMap((color, index) => {
        const start = (index * step).toFixed(2);
        const end = ((index + 1) * step).toFixed(2);
        return [`${color} ${start}%`, `${color} ${end}%`];
    });
    return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function hasDisplayValue(value: unknown): boolean {
    const text = toDisplayText(value).trim();
    if (!text) return false;
    const lowered = text.toLowerCase();
    return lowered !== "null" && lowered !== "undefined" && text !== "-";
}

function toDisplayText(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        typeof value === "bigint"
    ) {
        return String(value);
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    return "";
}

function formatTenureDays(
    joinDate: string | null,
    leaveDate: string | null,
): string {
    if (!joinDate) return "-";
    const joined = new Date(joinDate);
    const left = leaveDate ? new Date(leaveDate) : new Date();
    if (Number.isNaN(joined.getTime()) || Number.isNaN(left.getTime())) return "-";
    const diff = left.getTime() - joined.getTime();
    if (diff < 0) return "-";
    return `${Math.floor(diff / (1000 * 60 * 60 * 24))}日`;
}

function formatMembershipPeriod(
    joinDate: string | null,
    leaveDate: string | null,
    groupType?: number | null,
    groupDisbandDate?: string | null,
): string {
    const joined = formatDateYmd(joinDate);
    const resolvedLeave = resolveMembershipLeaveDate({
        leaveDate,
        groupType,
        groupDisbandDate,
    });
    if (joined === "-") return "-";
    if (resolvedLeave) {
        const left = formatDateYmd(resolvedLeave);
        const days = formatTenureDays(joinDate, resolvedLeave);
        if (days === "-") return `${joined}〜${left}`;
        return `${joined}〜${left}（${days}）`;
    }
    if (groupType === GROUP_TYPE_SHUFFLE_UNIT) {
        return `${joined}〜`;
    }
    const days = formatTenureDays(joinDate, leaveDate);
    const left = "現在";
    if (days === "-") return `${joined}〜${left}`;
    return `${joined}〜${left}（${days}）`;
}

type MembershipCategory =
    | "type10"
    | "type70"
    | "type20"
    | "type30"
    | "type40"
    | "other";

function resolveMembershipCategory(row: {
    groupType?: number | null;
}): MembershipCategory {
    if (row.groupType === GROUP_TYPE_HELLO_PRO_GROUP) return "type10";
    if (row.groupType === GROUP_TYPE_HELLO_PRO_TRAINEE) return "type70";
    if (row.groupType === GROUP_TYPE_HELLO_PRO_UNIT) return "type20";
    if (row.groupType === GROUP_TYPE_SPECIAL_UNIT) return "type30";
    if (row.groupType === GROUP_TYPE_SHUFFLE_UNIT) return "type40";
    return "other";
}

function GroupedMembershipList({
    rows,
    onOpenGroup,
}: {
    rows: GroupMembershipRow[];
    onOpenGroup: (groupId: number) => void;
}) {
    const categories: Array<{
        key: MembershipCategory;
        label: string;
        accent: string;
        emphasize?: boolean;
    }> = [
        { key: "type10", label: "ハロプログループ", accent: "text-slate-900", emphasize: true },
        { key: "type70", label: "研修生", accent: "text-slate-700" },
        { key: "type20", label: "ハロプロユニット", accent: "text-slate-700" },
        { key: "type30", label: "スペシャルユニット", accent: "text-slate-700" },
        { key: "type40", label: "シャッフルユニット", accent: "text-slate-700" },
        { key: "other", label: "その他", accent: "text-slate-600" },
    ];

    return (
        <div className="space-y-3">
            {categories.map((category) => {
                const filtered = rows.filter(
                    (row) => resolveMembershipCategory(row) === category.key,
                );
                if (filtered.length === 0) return null;
                return (
                    <section
                        key={category.key}
                        className={
                            category.emphasize
                                ? "space-y-1.5 rounded-sm border-2 border-slate-700 bg-slate-50 px-2 py-2 shadow-[2px_2px_0_0_#475569]"
                                : "space-y-1.5"
                        }
                    >
                        <h3
                            className={`text-xs tracking-[0.08em] ${category.accent} ${
                                category.emphasize ? "font-bold" : "font-semibold"
                            }`}
                        >
                            {category.label}
                        </h3>
                        <ul
                            className={
                                category.emphasize
                                    ? "divide-y divide-slate-400 border-y border-slate-400"
                                    : "divide-y divide-gray-300 border-y border-gray-300"
                            }
                        >
                            {filtered.map((row) => (
                                <li
                                    key={row.groupPersonId}
                                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 py-1.5 text-xs"
                                >
                                    <button
                                        type="button"
                                        onClick={() => onOpenGroup(row.groupId)}
                                        className={
                                            category.emphasize
                                                ? "text-sm font-bold text-blue-800 hover:underline"
                                                : "text-sm font-semibold text-blue-700 hover:underline"
                                        }
                                    >
                                        {row.groupName}
                                    </button>
                                    {row.generation ? (
                                        <>
                                            <span className="text-slate-400">/</span>
                                            <span className="text-slate-600">{row.generation}</span>
                                        </>
                                    ) : null}
                                    <span className="text-slate-400">/</span>
                                    <span className="text-slate-600">
                                        {formatMembershipPeriod(
                                            row.joinDate,
                                            row.leaveDate,
                                            row.groupType,
                                            row.groupDisbandDate,
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}
