import { useEffect, useMemo } from "react";

import {
    DetailErrorState,
    DetailLoadingState,
    DetailNotFoundState,
    DetailPanel,
    DetailResponsiveTable,
    DetailShareLinkButton,
} from "./DetailUi";
import { useEventDetail } from "./hooks/useEventDetail";
import { PerformerList } from "./PerformerList";
import { formatDateRangeYmd, formatDateYmd, formatTimeHm, parseTags } from "../../lib/uiFormat";
import { SetlistIcon, UsersIcon } from "../ui";

import type { SetlistSearchDb, StageDetail } from "../../lib/setlistSearchDb/types";

const EVENT_DETAIL_TAG_CLASS =
    "inline-flex items-center rounded-none border-2 border-gray-800 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold leading-4 text-slate-900 shadow-[1px_1px_0_rgba(31,41,55,0.45)]";

type EventDetailPageProps = {
    db: SetlistSearchDb;
    eventId: number;
    onResolveTitle?: (title: string) => void;
    onOpenStage: (stageId: number) => void;
    onOpenVenue: (venueId: number) => void;
    onOpenMember: (personId: number) => void;
    onOpenGroup: (groupId: number) => void;
};

export function EventDetailPage({
    db,
    eventId,
    onResolveTitle,
    onOpenStage,
    onOpenVenue,
    onOpenMember,
    onOpenGroup,
}: EventDetailPageProps) {
    const { loading, error, event, stages, performers } = useEventDetail(db, eventId);

    useEffect(() => {
        if (event?.eventName) {
            onResolveTitle?.(event.eventName);
        }
    }, [event?.eventName, onResolveTitle]);

    const hasPatternColumn = useMemo(
        () => stages.some((stage) => Boolean(stage.pattern?.trim())),
        [stages],
    );
    const hasRemarksColumn = useMemo(
        () => stages.some((stage) => Boolean(stage.cancelled)),
        [stages],
    );
    if (loading) return <DetailLoadingState />;
    if (error) return <DetailErrorState message={error} />;
    if (!event) return <DetailNotFoundState message="イベントが見つかりませんでした。" />;

    const tags = parseTags(event.eventTagsJson);
    const eventScheduleLabel = formatDateRangeYmd(event.firstDate, event.lastDate);
    const isEventCancelled = stages.length > 0 && stages.every((stage) => Boolean(stage.cancelled));

    return (
        <div className="space-y-4">
            <DetailPanel className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">EVENT</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="min-w-0 break-words text-lg font-bold text-slate-900">{event.eventName}</h1>
                            {isEventCancelled ? (
                                <span
                                    aria-label="イベント中止"
                                    className="inline-flex rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
                                >
                                    中止
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <DetailShareLinkButton />
                </div>
                {tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className={EVENT_DETAIL_TAG_CLASS}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </DetailPanel>

            {performers.length > 0 ? (
                <DetailPanel className="p-4">
                    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                        <UsersIcon className="h-4 w-4" />
                        出演者
                    </h2>
                    <PerformerList
                        performers={performers}
                        onOpenMember={onOpenMember}
                        onOpenGroup={onOpenGroup}
                    />
                </DetailPanel>
            ) : null}

            {stages.length > 0 ? (
                <DetailPanel className="p-4">
                    <div className="mb-3 space-y-3">
                        <div className="py-1">
                            <div className="flex items-end justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                                        開催日程
                                    </p>
                                    <p className="mt-0.5 whitespace-nowrap text-sm font-bold leading-6 text-slate-900 sm:text-lg">
                                        {eventScheduleLabel}
                                        {isEventCancelled ? (
                                            <span
                                                aria-label="イベント中止"
                                                className="ml-2 inline-flex align-middle rounded bg-red-100 px-2 py-0.5 text-xs font-semibold leading-5 text-red-700"
                                            >
                                                中止
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                                        公演数
                                    </p>
                                    <p className="mt-0.5 whitespace-nowrap text-sm font-bold leading-6 text-slate-900 sm:text-base">
                                        全{stages.length}公演
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DetailResponsiveTable
                        rows={stages}
                        rowKey={(stage) => stage.stageId}
                        disablePagination
                        disableSorting
                        hideSummary
                        mobileRowClassName="border-b border-slate-300 bg-white px-3 py-2 first:border-t first:border-slate-300"
                        columns={(() => {
                        const columns = [
                            {
                                key: "eventStageNumber",
                                header: "#",
                                mobileHidden: true,
                                render: (stage: StageDetail) =>
                                    stage.eventStageNumber
                                        ? stage.eventStageNumber
                                        : "-",
                            },
                            {
                                key: "detail",
                                header: "セトリ",
                                mobileHidden: true,
                                render: (stage: StageDetail) =>
                                    stage.totalPerformances > 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => onOpenStage(stage.stageId)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-none text-blue-600 hover:bg-blue-50"
                                            title="ステージ詳細"
                                            aria-label="ステージ詳細"
                                        >
                                            <SetlistIcon className="h-4 w-4" />
                                        </button>
                                    ) : (
                                        <span className="text-slate-400">未登録</span>
                                    ),
                            },
                            {
                                key: "date",
                                header: "日程",
                                mobileHidden: true,
                                render: (stage: StageDetail) => formatDateYmd(stage.date),
                            },
                            {
                                key: "time",
                                header: "開演時間",
                                mobileHidden: true,
                                render: (stage: StageDetail) => formatTimeHm(stage.startTime),
                            },
                            {
                                key: "mobileCardMain",
                                header: "",
                                desktopClassName: "md:hidden",
                                mobileLabelClassName: "hidden",
                                mobileValueClassName: "col-span-2",
                                render: (stage: StageDetail) => {
                                    const dateLabel = formatDateYmd(stage.date);
                                    const timeLabel = formatTimeHm(stage.startTime);
                                    const dateTimeLabel =
                                        timeLabel && timeLabel !== "-"
                                            ? `${dateLabel} ${timeLabel}`
                                            : dateLabel;
                                    const venueAreaLabel = stage.prefectureName
                                        ? `${stage.venueName}（${stage.prefectureName}）`
                                        : stage.venueName;

                                    return (
                                        <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-0.5">
                                            <div className="row-span-2 flex flex-col items-center gap-1 self-center">
                                                <span className="text-xs font-semibold leading-none text-slate-700">
                                                    {stage.eventStageNumber
                                                        ? `#${stage.eventStageNumber}`
                                                        : "-"}
                                                </span>
                                                {stage.totalPerformances > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenStage(stage.stageId)}
                                                        className="inline-flex h-6 w-6 items-center justify-center rounded-none text-blue-600 hover:bg-blue-50"
                                                        title="ステージ詳細"
                                                        aria-label="ステージ詳細"
                                                    >
                                                        <SetlistIcon className="block h-4 w-4" />
                                                    </button>
                                                ) : (
                                                    <span
                                                        className="h-1.5 w-1.5 rounded-full bg-slate-400"
                                                        title="セトリ未登録"
                                                        aria-label="セトリ未登録"
                                                    />
                                                )}
                                            </div>
                                            <p className="col-start-2 truncate text-xs text-slate-900">
                                                {dateTimeLabel}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => onOpenVenue(stage.venueId)}
                                                className="col-start-2 truncate text-left text-xs text-blue-600 hover:underline"
                                            >
                                                {venueAreaLabel}
                                            </button>
                                            {stage.pattern ? (
                                                <span className="col-start-2 inline-flex w-fit border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-600">
                                                    {stage.pattern}
                                                </span>
                                            ) : null}
                                            {stage.cancelled ? (
                                                <span className="col-start-2 inline-flex w-fit rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                                    中止
                                                </span>
                                            ) : null}
                                        </div>
                                    );
                                },
                            },
                            {
                                key: "venue",
                                header: "会場",
                                mobileHidden: true,
                                sortValue: (stage: StageDetail) => stage.venueName,
                                render: (stage: StageDetail) => (
                                    <button
                                        type="button"
                                        onClick={() => onOpenVenue(stage.venueId)}
                                        className="text-left text-blue-600 hover:underline"
                                    >
                                        {stage.venueName}
                                    </button>
                                ),
                            },
                            {
                                key: "prefecture",
                                header: "都道府県",
                                mobileHidden: true,
                                render: (stage: StageDetail) => stage.prefectureName || "-",
                            },
                            {
                                key: "totalPerformances",
                                header: "曲数",
                                mobileHidden: true,
                                render: (stage: StageDetail) => stage.totalPerformances,
                            },
                        ];
                        if (hasPatternColumn) {
                            columns.push({
                                key: "pattern",
                                header: "パターン",
                                mobileHidden: true,
                                render: (stage: StageDetail) => stage.pattern || "-",
                            });
                        }
                        if (hasRemarksColumn) {
                            columns.push({
                                key: "status",
                                header: "備考",
                                mobileHidden: true,
                                render: (stage: StageDetail) =>
                                    stage.cancelled ? (
                                        <span className="inline-flex rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                            中止
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">-</span>
                                    ),
                            });
                        }
                            return columns;
                        })()}
                    />
                </DetailPanel>
            ) : null}

        </div>
    );
}
