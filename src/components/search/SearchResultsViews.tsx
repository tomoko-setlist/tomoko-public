import { useState, type ReactNode } from "react";

import {
    formatDateRangeYmd,
    formatDateYmd,
    formatTimeHm,
    parseTags,
} from "../../lib/uiFormat";
import {
    CalendarIcon,
    MicrophoneIcon,
    MinusIcon,
    PlusIcon,
    SetlistIcon,
    VenueIcon,
    LinkTextButton,
} from "../ui";
import { SearchSortableHeader } from "./SearchSortableHeader";
import { EVENT_TAG_CHIP_CLASS } from "../ui/eventTagClass";
import { SortArrowIndicator } from "../ui/SortArrowIndicator";

import type {
    SearchResponse,
    SearchResultRow,
    SearchUnit,
    SortBy,
    SortOrder,
} from "../../lib/setlistSearchDb/types";

type SharedProps = {
    searchUnit: SearchUnit;
    result: SearchResponse;
    onOpenEvent: (eventId: number) => void;
    onOpenStage: (stageId: number) => void;
    onOpenVenue: (venueId: number) => void;
    onOpenSong: (songId: number) => void;
    onOpenArtist?: (artistId: number) => void;
    getPrefectureNameById?: (id: number | null) => string;
};

type SearchResultsDesktopTableProps = SharedProps & {
    tableHeaders: Array<{
        label: string;
        sortBy?: SortBy;
    }>;
    sortBy: SortBy;
    sortOrder: SortOrder;
    onHeaderSort: (column?: SortBy) => void;
    visible: boolean;
    groupByEvent?: boolean;
};

type SearchResultsCardsProps = SharedProps & {
    visible: boolean;
    groupByEvent?: boolean;
};

type StageEventGroup = {
    eventId: number;
    eventName: string;
    tags: string[];
    totalPerformances: number;
    stages: SearchResultRow[];
};

const RESULT_TAG_CLASS = EVENT_TAG_CHIP_CLASS;

type ResultLinkButtonProps = {
    onClick: () => void;
    children: ReactNode;
    className?: string;
};

function ResultLinkButton({
    onClick,
    children,
    className = "",
}: ResultLinkButtonProps) {
    return (
        <LinkTextButton onClick={onClick} className={className}>
            {children}
        </LinkTextButton>
    );
}

type ResultTagListProps = {
    tags: string[];
    tagKeyPrefix: string;
    max?: number;
    showRestCount?: boolean;
};

function ResultTagList({
    tags,
    tagKeyPrefix,
    max = 3,
    showRestCount = false,
}: ResultTagListProps) {
    if (tags.length === 0) {
        return <span className="text-slate-400">—</span>;
    }
    return (
        <div className="flex flex-wrap gap-1">
            {tags.slice(0, max).map((tag) => (
                <span key={`${tagKeyPrefix}-${tag}`} className={RESULT_TAG_CLASS}>
                    {tag}
                </span>
            ))}
            {showRestCount && tags.length > max ? (
                <span className="text-xs text-slate-500">+{tags.length - max}</span>
            ) : null}
        </div>
    );
}

function ResultTagPills({
    tags,
    tagKeyPrefix,
    max = 3,
}: {
    tags: string[];
    tagKeyPrefix: string;
    max?: number;
}) {
    if (tags.length === 0) return null;
    const [primaryTag, ...restTags] = tags;
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="inline-flex border-2 border-gray-800 bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {primaryTag}
            </span>
            {restTags.slice(0, max - 1).map((tag) => (
                <span
                    key={`${tagKeyPrefix}-${tag}`}
                    className="inline-flex border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-600"
                >
                    {tag}
                </span>
            ))}
            {restTags.length > max - 1 ? (
                <span className="text-[10px] font-semibold leading-none text-slate-500">
                    +{restTags.length - (max - 1)}
                </span>
            ) : null}
        </div>
    );
}

function formatStageDateTime(row: SearchResultRow): string {
    const date = formatDateYmd(row.date_label);
    const time = row.start_time ? formatTimeHm(row.start_time) : "";
    return time ? `${date} ${time}` : date;
}

function formatStagePattern(row: SearchResultRow): string {
    return row.pattern?.trim() || "-";
}

function formatStageGroupDate(stages: SearchResultRow[]): string {
    if (stages.length === 0) return "-";
    if (stages.length === 1) return formatStageDateTime(stages[0]);
    return formatDateRangeYmd(
        stages[stages.length - 1]?.date_label,
        stages[0]?.date_label,
        "-",
    );
}

function summarizeUniqueValues(values: string[], unitLabel: string): string {
    const unique = Array.from(
        new Set(values.map((value) => value.trim()).filter(Boolean)),
    );
    if (unique.length === 0) return "-";
    if (unique.length === 1) return unique[0] ?? "-";
    return `${unique[0]} ほか${unique.length - 1}${unitLabel}`;
}

function formatStageGroupVenue(stages: SearchResultRow[]): string {
    return summarizeUniqueValues(
        stages.map((stage) => stage.venue_name),
        "会場",
    );
}

function formatStageGroupPattern(stages: SearchResultRow[]): string {
    return summarizeUniqueValues(
        stages.map((stage) => stage.pattern ?? ""),
        "パターン",
    );
}

function StagePatternText({ pattern }: { pattern: string }) {
    if (pattern === "-") return null;
    return (
        <span className="text-xs font-normal text-slate-500">
            {pattern}
        </span>
    );
}

function isStageCancelled(row: SearchResultRow): boolean {
    return row.cancelled === true;
}

function getCountableStageCount(stages: SearchResultRow[]): number {
    return stages.filter((stage) => !isStageCancelled(stage)).length;
}

function getRegisteredSetlistStageCount(stages: SearchResultRow[]): number {
    return stages.filter(
        (stage) => !isStageCancelled(stage) && stage.total_performances > 0,
    ).length;
}

function CancelledStageBadge() {
    return (
        <span className="inline-flex items-center justify-center border-2 border-red-700 bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-[1px_1px_0_rgba(127,29,29,0.55)]">
            中止
        </span>
    );
}

function formatStageGroupPrefecture(
    stages: SearchResultRow[],
    getPrefectureNameById?: (id: number | null) => string,
): string {
    if (!getPrefectureNameById) return "-";
    return summarizeUniqueValues(
        stages.map((stage) => getPrefectureNameById(stage.prefecture_id)),
        "都府県",
    );
}

function SetlistOpenButton({
    stageId,
    onOpenStage,
    buttonClassName = "inline-flex h-7 w-7 items-center justify-center rounded-none text-blue-600 hover:bg-blue-50",
    label,
}: {
    stageId: number;
    onOpenStage: (stageId: number) => void;
    buttonClassName?: string;
    label?: string;
}) {
    return (
        <button
            type="button"
            onClick={() => onOpenStage(stageId)}
            className={buttonClassName}
            title="セトリ詳細"
            aria-label="セトリ詳細"
        >
            <SetlistIcon className="h-[18px] w-[18px]" />
            {label ? <span>{label}</span> : null}
        </button>
    );
}

function StageSetlistCell({
    stageId,
    totalPerformances,
    onOpenStage,
    cancelled = false,
    emptyLabel = "未登録",
    buttonClassName = "inline-flex h-7 w-7 items-center justify-center rounded-none text-blue-600 hover:bg-blue-50",
}: {
    stageId: number;
    totalPerformances: number;
    onOpenStage: (stageId: number) => void;
    cancelled?: boolean;
    emptyLabel?: string;
    buttonClassName?: string;
}) {
    if (cancelled) {
        return <CancelledStageBadge />;
    }

    if (totalPerformances <= 0) {
        return <span className="text-xs text-slate-400">{emptyLabel}</span>;
    }

    return <SetlistOpenButton stageId={stageId} onOpenStage={onOpenStage} buttonClassName={buttonClassName} />;
}

function SetlistLinkCell({
    stageId,
    stageCount = 0,
    onOpenStage,
    buttonClassName,
    label,
    showMultipleAsButton = false,
}: {
    stageId: number;
    stageCount?: number;
    onOpenStage: (stageId: number) => void;
    buttonClassName?: string;
    label?: string;
    showMultipleAsButton?: boolean;
}) {
    if (stageCount > 1 && !showMultipleAsButton) {
        return <span className="text-xs text-slate-500">{stageCount}公演</span>;
    }
    return (
        <SetlistOpenButton
            stageId={stageId}
            onOpenStage={onOpenStage}
            buttonClassName={buttonClassName}
            label={label}
        />
    );
}

export function SearchResultsDesktopTable({
    searchUnit,
    result,
    tableHeaders,
    sortBy,
    sortOrder,
    onHeaderSort,
    onOpenEvent,
    onOpenStage,
    onOpenVenue,
    onOpenSong,
    onOpenArtist,
    getPrefectureNameById,
    visible,
    groupByEvent = false,
}: SearchResultsDesktopTableProps) {
    const stageGroups = groupByEvent ? groupStageRowsByEvent(result.rows) : [];
    const multiStageGroupIds = stageGroups
        .filter((group) => group.stages.length > 1)
        .map((group) => group.eventId);
    const multiStageGroupKey = multiStageGroupIds.join(",");
    const [collapseState, setCollapseState] = useState<{
        key: string;
        ids: Set<number>;
    }>(() => ({
        key: multiStageGroupKey,
        ids: new Set(multiStageGroupIds),
    }));
    const collapsedEventIds =
        collapseState.key === multiStageGroupKey
            ? collapseState.ids
            : new Set(multiStageGroupIds);
    const toggleEventCollapsed = (eventId: number) => {
        setCollapseState(() => {
            const next = new Set(collapsedEventIds);
            if (next.has(eventId)) {
                next.delete(eventId);
            } else {
                next.add(eventId);
            }
            return {
                key: multiStageGroupKey,
                ids: next,
            };
        });
    };

    const collapseAllGroups = () => {
        setCollapseState({
            key: multiStageGroupKey,
            ids: new Set(multiStageGroupIds),
        });
    };

    const expandAllGroups = () => {
        setCollapseState({
            key: multiStageGroupKey,
            ids: new Set(),
        });
    };
    const areAllExpanded =
        multiStageGroupIds.length > 0 && collapsedEventIds.size === 0;
    const toggleAllGroups = () => {
        if (areAllExpanded) {
            collapseAllGroups();
            return;
        }
        expandAllGroups();
    };

    return (
        <div className={visible ? "hidden overflow-x-auto md:block" : "hidden"}>
            <table className="w-full border-collapse text-sm">
                <thead className="bg-red-600">
                    <tr>
                        {tableHeaders.map((header, index) => {
                            const isFirst = index === 0;
                            if (
                                isFirst &&
                                searchUnit === "stage" &&
                                groupByEvent &&
                                multiStageGroupIds.length > 0
                            ) {
                                return (
                                    <th
                                        key={`${header.label}-toggle`}
                                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap"
                                    >
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={toggleAllGroups}
                                                className="inline-flex h-5 w-5 items-center justify-center rounded-none text-white/90 hover:text-white"
                                                title={
                                                    areAllExpanded
                                                        ? "すべて折りたたむ"
                                                        : "すべて展開"
                                                }
                                                aria-label={
                                                    areAllExpanded
                                                        ? "すべて折りたたむ"
                                                        : "すべて展開"
                                                }
                                            >
                                                {areAllExpanded ? (
                                                    <MinusIcon className="h-4 w-4" />
                                                ) : (
                                                    <PlusIcon className="h-4 w-4" />
                                                )}
                                            </button>
                                            {header.sortBy ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onHeaderSort(header.sortBy)}
                                                    className="inline-flex items-center gap-1 whitespace-nowrap text-white"
                                                    title={`${header.label}で並び替え`}
                                                >
                                                    <span>{header.label}</span>
                                                    <SortArrowIndicator
                                                        active={sortBy === header.sortBy}
                                                        order={sortOrder}
                                                        className="ml-0.5 inline-flex flex-col gap-[2px] leading-[0.72] text-[9px] select-none"
                                                        activeClassName="text-white"
                                                        inactiveClassName="text-white/45"
                                                        neutralClassName="text-white/75"
                                                    />
                                                </button>
                                            ) : (
                                                <span>{header.label}</span>
                                            )}
                                        </div>
                                    </th>
                                );
                            }
                            return (
                                <SearchSortableHeader
                                    key={header.label}
                                    label={header.label}
                                    sortable={Boolean(header.sortBy)}
                                    active={header.sortBy ? sortBy === header.sortBy : false}
                                    sortOrder={sortOrder}
                                    onSort={() => onHeaderSort(header.sortBy)}
                                    thClassName={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap ${
                                        header.sortBy ? "hover:bg-red-700" : ""
                                    }`}
                                    buttonClassName="inline-flex items-center gap-1 whitespace-nowrap"
                                    activeIconClassName="text-white"
                                    inactiveIconClassName="text-white/45"
                                />
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {searchUnit === "stage" && groupByEvent
                        ? stageGroups.flatMap((group) => {
                              if (group.stages.length === 1) {
                                  const stageRow = group.stages[0];
                                  const tags = parseTags(stageRow.event_tags_json);
                                  return (
                                      <tr
                                          key={`stage-single-${stageRow.row_id}`}
                                          className="hover:bg-slate-50"
                                      >
                                          <td className="px-3 py-3">
                                              <div className="flex flex-col gap-0.5">
                                                  <ResultLinkButton
                                                      onClick={() => onOpenEvent(stageRow.event_id)}
                                                  >
                                                      {stageRow.event_name}
                                                  </ResultLinkButton>
                                                  <StagePatternText
                                                      pattern={formatStagePattern(stageRow)}
                                                  />
                                              </div>
                                          </td>
                                          <td className="px-3 py-3">
                                              <StageSetlistCell
                                                  stageId={stageRow.row_id}
                                                  totalPerformances={stageRow.total_performances}
                                                  onOpenStage={onOpenStage}
                                                  cancelled={isStageCancelled(stageRow)}
                                              />
                                          </td>
                                          <td className="px-3 py-3">
                                              {formatDateYmd(stageRow.date_label)}
                                          </td>
                                          <td className="px-3 py-3">
                                              {formatTimeHm(stageRow.start_time)}
                                          </td>
                                          <td className="px-3 py-3">
                                              <ResultLinkButton
                                                  onClick={() => onOpenVenue(stageRow.venue_id)}
                                              >
                                                  {stageRow.venue_name}
                                              </ResultLinkButton>
                                          </td>
                                          <td className="px-3 py-3">
                                              {getPrefectureNameById
                                                  ? getPrefectureNameById(stageRow.prefecture_id)
                                                  : "-"}
                                          </td>
                                          <td className="px-3 py-3">
                                              <ResultTagList
                                                  tags={tags}
                                                  tagKeyPrefix={`stage-tag-single-${stageRow.row_id}`}
                                              />
                                          </td>
                                      </tr>
                                  );
                              }

                              const isCollapsed = collapsedEventIds.has(group.eventId);
                              const registeredSetlistStageCount =
                                  getRegisteredSetlistStageCount(group.stages);
                              const countableStageCount = getCountableStageCount(group.stages);
                              const headerRow = (
                                  <tr
                                      key={`stage-group-header-${group.eventId}`}
                                      className="bg-slate-50"
                                      >
                                          <td className="px-3 py-3 font-semibold">
                                          <div className="flex items-center gap-2">
                                              <button
                                                  type="button"
                                                  onClick={() =>
                                                      toggleEventCollapsed(group.eventId)
                                                  }
                                                  className="text-slate-700 hover:text-slate-900"
                                                  aria-label={
                                                      isCollapsed
                                                          ? "ステージを展開"
                                                          : "ステージを折りたたむ"
                                                  }
                                                  title={
                                                      isCollapsed
                                                          ? "ステージを展開"
                                                          : "ステージを折りたたむ"
                                                  }
                                              >
                                                  {isCollapsed ? (
                                                      <PlusIcon className="h-4 w-4" />
                                                  ) : (
                                                      <MinusIcon className="h-4 w-4" />
                                                  )}
                                              </button>
                                              <ResultLinkButton
                                                  onClick={() => onOpenEvent(group.eventId)}
                                              >
                                                  {group.eventName}
                                              </ResultLinkButton>
                                              <span className="text-xs font-normal text-slate-600">
                                                  （{countableStageCount}公演）
                                              </span>
                                          </div>
                                          </td>
                                      <td className="px-3 py-3 text-xs text-slate-600">
                                          {registeredSetlistStageCount}件
                                      </td>
                                      <td className="px-3 py-3 text-xs text-slate-600">
                                          {group.stages.length > 0
                                              ? formatDateRangeYmd(
                                                    group.stages[group.stages.length - 1]
                                                        ?.date_label,
                                                    group.stages[0]?.date_label,
                                                    "-",
                                                )
                                              : "-"}
                                      </td>
                                      <td className="px-3 py-3 text-xs text-slate-600">-</td>
                                      <td className="px-3 py-3 text-xs text-slate-600">-</td>
                                      <td className="px-3 py-3 text-xs text-slate-600">-</td>
                                      <td className="px-3 py-3">
                                          <ResultTagList
                                              tags={group.tags}
                                              tagKeyPrefix={`event-tag-${group.eventId}`}
                                          />
                                      </td>
                                  </tr>
                              );
                              if (isCollapsed) {
                                  return headerRow;
                              }
                              const stageRows = group.stages.map((stageRow) => {
                                  const tags = parseTags(stageRow.event_tags_json);
                                  return (
                                      <tr
                                          key={`stage-group-stage-${stageRow.row_id}`}
                                          className="hover:bg-slate-50"
                                      >
                                          <td className="px-3 py-3 text-slate-500">
                                              <div className="flex items-center gap-1.5">
                                                  <span>└</span>
                                                  <StagePatternText
                                                      pattern={formatStagePattern(stageRow)}
                                                  />
                                              </div>
                                          </td>
                                          <td className="px-3 py-3">
                                              <StageSetlistCell
                                                  stageId={stageRow.row_id}
                                                  totalPerformances={stageRow.total_performances}
                                                  onOpenStage={onOpenStage}
                                                  cancelled={isStageCancelled(stageRow)}
                                              />
                                          </td>
                                          <td className="px-3 py-3">
                                              {formatDateYmd(stageRow.date_label)}
                                          </td>
                                          <td className="px-3 py-3">
                                              {formatTimeHm(stageRow.start_time)}
                                          </td>
                                          <td className="px-3 py-3">
                                              <ResultLinkButton
                                                  onClick={() => onOpenVenue(stageRow.venue_id)}
                                              >
                                                  {stageRow.venue_name}
                                              </ResultLinkButton>
                                          </td>
                                          <td className="px-3 py-3">
                                              {getPrefectureNameById
                                                  ? getPrefectureNameById(stageRow.prefecture_id)
                                                  : "-"}
                                          </td>
                                          <td className="px-3 py-3">
                                              <ResultTagList
                                                  tags={tags}
                                                  tagKeyPrefix={`stage-tag-${stageRow.row_id}`}
                                              />
                                          </td>
                                      </tr>
                                  );
                              });
                              return [headerRow, ...stageRows];
                          })
                        : result.rows.map((row, index) => {
                              if (searchUnit === "stage") {
                                  const tags = parseTags(row.event_tags_json);
                                  return (
                                      <tr
                                          key={`${searchUnit}-${row.row_id}`}
                                          className="hover:bg-slate-50"
                                      >
                                          <td className="px-3 py-3">
                                              <div className="flex flex-col gap-0.5">
                                                  <ResultLinkButton
                                                      onClick={() => onOpenEvent(row.event_id)}
                                                  >
                                                      {row.event_name}
                                                  </ResultLinkButton>
                                                  <StagePatternText
                                                      pattern={formatStagePattern(row)}
                                                  />
                                              </div>
                                          </td>
                                          <td className="px-3 py-3">
                                              <StageSetlistCell
                                                  stageId={row.row_id}
                                                  totalPerformances={row.total_performances}
                                                  onOpenStage={onOpenStage}
                                                  cancelled={isStageCancelled(row)}
                                              />
                                          </td>
                                          <td className="px-3 py-3">
                                              {formatDateYmd(row.date_label)}
                                          </td>
                                          <td className="px-3 py-3">
                                              {formatTimeHm(row.start_time)}
                                          </td>
                                          <td className="px-3 py-3">
                                              <ResultLinkButton
                                                  onClick={() => onOpenVenue(row.venue_id)}
                                              >
                                                  {row.venue_name}
                                              </ResultLinkButton>
                                          </td>
                                          <td className="px-3 py-3">
                                              {getPrefectureNameById
                                                  ? getPrefectureNameById(row.prefecture_id)
                                                  : "-"}
                                          </td>
                                          <td className="px-3 py-3">
                                              <ResultTagList
                                                  tags={tags}
                                                  tagKeyPrefix={`stage-tag-plain-${row.row_id}`}
                                                  showRestCount={true}
                                              />
                                          </td>
                                      </tr>
                                  );
                              }
                              return (
                                  <tr
                                      key={`${searchUnit}-${row.row_id}`}
                                      className={`hover:bg-slate-100 ${
                                          index % 2 === 0 ? "bg-white" : "bg-slate-50"
                                      }`}
                                  >
                                      <td className="px-3 py-3">
                                          <SetlistLinkCell
                                              stageId={row.stage_id ?? row.row_id}
                                              stageCount={row.total_stages}
                                              onOpenStage={onOpenStage}
                                          />
                                      </td>
                                      <td className="px-3 py-3">
                                          <ResultLinkButton onClick={() => onOpenSong(row.song_id)}>
                                              {row.primary_text}
                                          </ResultLinkButton>
                                      </td>
                                      <td className="px-3 py-3">
                                          {row.secondary_text || "—"}
                                      </td>
                                      <td className="px-3 py-3">
                                          {typeof row.artist_id === "number" && onOpenArtist ? (
                                              <ResultLinkButton
                                                  onClick={() => onOpenArtist(row.artist_id as number)}
                                              >
                                                  {row.artist_text || "—"}
                                              </ResultLinkButton>
                                          ) : (
                                              row.artist_text || "—"
                                          )}
                                      </td>
                                      <td className="px-3 py-3">
                                          {row.section_text || "—"}
                                      </td>
                                      <td className="px-3 py-3">
                                          <ResultLinkButton onClick={() => onOpenEvent(row.event_id)}>
                                              {row.event_name}
                                          </ResultLinkButton>
                                      </td>
                                      <td className="px-3 py-3">
                                          {formatDateYmd(row.date_label)}
                                      </td>
                                      <td className="px-3 py-3">
                                          {row.venue_name === "複数会場" ? (
                                              <span>{row.venue_name}</span>
                                          ) : (
                                              <ResultLinkButton onClick={() => onOpenVenue(row.venue_id)}>
                                                  {row.venue_name}
                                              </ResultLinkButton>
                                          )}
                                      </td>
                                  </tr>
                              );
                          })}
                </tbody>
            </table>
        </div>
    );
}

export function SearchResultsCards({
    searchUnit,
    result,
    onOpenEvent,
    onOpenStage,
    onOpenVenue,
    onOpenSong,
    onOpenArtist,
    getPrefectureNameById,
    visible,
    groupByEvent = false,
}: SearchResultsCardsProps) {
    const stageGroups = groupByEvent ? groupStageRowsByEvent(result.rows) : [];
    const usesGroupedStageCards = searchUnit === "stage" && groupByEvent;
    const multiStageGroupIds = stageGroups
        .filter((group) => group.stages.length > 1)
        .map((group) => group.eventId);
    const multiStageGroupKey = multiStageGroupIds.join(",");
    const [collapseState, setCollapseState] = useState<{
        key: string;
        ids: Set<number>;
    }>(() => ({
        key: multiStageGroupKey,
        ids: new Set(multiStageGroupIds),
    }));
    const collapsedEventIds =
        collapseState.key === multiStageGroupKey
            ? collapseState.ids
            : new Set(multiStageGroupIds);

    const toggleEventCollapsed = (eventId: number) => {
        setCollapseState(() => {
            const next = new Set(collapsedEventIds);
            if (next.has(eventId)) {
                next.delete(eventId);
            } else {
                next.add(eventId);
            }
            return {
                key: multiStageGroupKey,
                ids: next,
            };
        });
    };

    return (
        <div
            className={`${
                visible
                    ? usesGroupedStageCards
                        ? "md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-3"
                        : "divide-y divide-gray-800 border-y border-gray-800 md:grid md:grid-cols-2 md:gap-3 md:divide-y-0 md:border-y-0 xl:grid-cols-3"
                    : usesGroupedStageCards
                      ? "md:hidden"
                      : "divide-y divide-gray-800 border-y border-gray-800 md:hidden"
            }`}
        >
            {usesGroupedStageCards
                ? stageGroups.map((group) => {
                      const isCollapsed = collapsedEventIds.has(group.eventId);
                      const canCollapse = group.stages.length > 1;
                      const primaryStageId = group.stages[0]?.row_id ?? 0;
                      const registeredSetlistStageCount =
                          getRegisteredSetlistStageCount(group.stages);
                      const countableStageCount = getCountableStageCount(group.stages);
                      const dateLabel = formatStageGroupDate(group.stages);
                      const patternLabel = formatStageGroupPattern(group.stages);
                      const venueLabel = formatStageGroupVenue(group.stages);
                      const prefectureLabel = formatStageGroupPrefecture(
                          group.stages,
                          getPrefectureNameById,
                      );
                      return (
                          <article
                              key={`stage-group-card-${group.eventId}`}
                              className="relative space-y-1 rounded-none border-b border-gray-800 bg-white px-0 py-1.5 first:border-t md:space-y-2 md:rounded-none md:!border-2 md:!border-slate-300 md:bg-white md:px-4 md:py-4"
                          >
                              <div className="min-w-0 pr-20">
                                  <div>
                                      <ResultTagPills
                                          tags={group.tags}
                                          tagKeyPrefix={`group-card-pill-${group.eventId}`}
                                      />
                                  </div>
                                  <ResultLinkButton
                                      onClick={() => onOpenEvent(group.eventId)}
                                      className="mt-1 block text-[15px] font-semibold leading-[1.25] text-blue-700"
                                  >
                                      {group.eventName}
                                  </ResultLinkButton>
                              </div>
                              <button
                                  type="button"
                                  onClick={() =>
                                      canCollapse
                                          ? toggleEventCollapsed(group.eventId)
                                          : onOpenStage(primaryStageId)
                                  }
                                  className="absolute right-0 top-1.5 inline-flex min-w-[3.75rem] items-center justify-center gap-1 border-2 border-gray-800 bg-white px-1.5 py-1 text-[11px] font-semibold leading-none text-slate-800 shadow-[1px_1px_0_rgba(31,41,55,0.55)] hover:bg-slate-100 md:right-4 md:top-4"
                                  aria-label={
                                      canCollapse
                                          ? isCollapsed
                                              ? `${countableStageCount}公演の一覧を表示`
                                              : `${countableStageCount}公演の一覧を閉じる`
                                          : "セトリ詳細"
                                  }
                                  title={
                                      canCollapse
                                          ? isCollapsed
                                              ? `${countableStageCount}公演の一覧を表示`
                                              : `${countableStageCount}公演の一覧を閉じる`
                                          : "セトリ詳細"
                                  }
                              >
                                  <SetlistIcon className="h-3.5 w-3.5" />
                                  <span>
                                      {registeredSetlistStageCount}/{countableStageCount}
                                  </span>
                              </button>
                              <div className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-0.5 text-[11px] leading-4 text-slate-600">
                                  <CalendarIcon className="mt-[1px] h-3.5 w-3.5 text-slate-500" />
                                  <span>{dateLabel}</span>
                                  {patternLabel !== "-" ? (
                                      <>
                                          <span className="mt-[1px] text-[10px] font-semibold text-slate-500">
                                              パターン
                                          </span>
                                          <span>{patternLabel}</span>
                                      </>
                                  ) : null}
                                  <VenueIcon className="mt-[1px] h-3.5 w-3.5 text-slate-500" />
                                  <span>
                                      {venueLabel}
                                      {prefectureLabel !== "-" ? (
                                          <span className="text-slate-400"> / {prefectureLabel}</span>
                                      ) : null}
                                  </span>
                              </div>
                              {canCollapse && !isCollapsed ? (
                                  <div className="space-y-1 pt-1">
                                      <div className="overflow-x-auto border border-slate-300">
                                          <table className="w-full border-collapse text-xs">
                                              <thead className="text-slate-600">
                                                  <tr>
                                                      <th className="w-8 px-1.5 py-0.5 text-left font-semibold" />
                                                      <th className="px-1.5 py-0.5 text-left font-semibold">
                                                          日時
                                                      </th>
                                                      <th className="px-1.5 py-0.5 text-left font-semibold">
                                                          パターン
                                                      </th>
                                                      <th className="px-1.5 py-0.5 text-left font-semibold">
                                                          会場
                                                      </th>
                                                  </tr>
                                              </thead>
                                              <tbody>
                                                  {group.stages.map((stageRow) => (
                                                      <tr
                                                          key={`group-card-stage-${stageRow.row_id}`}
                                                          className="border-t border-slate-200"
                                                      >
                                                          <td className="px-1.5 py-1 text-center align-top">
                                                              <StageSetlistCell
                                                                  stageId={stageRow.row_id}
                                                                  totalPerformances={
                                                                      stageRow.total_performances
                                                                  }
                                                                  onOpenStage={onOpenStage}
                                                                  cancelled={isStageCancelled(stageRow)}
                                                                  emptyLabel="-"
                                                                  buttonClassName="inline-flex h-6 w-6 items-center justify-center rounded-none text-blue-600 hover:bg-blue-50"
                                                              />
                                                          </td>
                                                          <td className="px-1.5 py-1 align-top">
                                                              {formatStageDateTime(stageRow)}
                                                          </td>
                                                          <td className="px-1.5 py-1 align-top">
                                                              {formatStagePattern(stageRow)}
                                                          </td>
                                                          <td className="px-1.5 py-1 align-top">
                                                              <ResultLinkButton
                                                                  onClick={() =>
                                                                      onOpenVenue(stageRow.venue_id)
                                                                  }
                                                              >
                                                                  {stageRow.venue_name}
                                                              </ResultLinkButton>
                                                          </td>
                                                      </tr>
                                                  ))}
                                              </tbody>
                                          </table>
                                      </div>
                                  </div>
                              ) : null}
                          </article>
                      );
                  })
                : result.rows.map((row) => {

                if (searchUnit === "stage") {
                    if (groupByEvent) {
                        return null;
                    }
                    const tags = parseTags(row.event_tags_json);
                    return (
                        <article
                            key={`${searchUnit}-${row.row_id}`}
                            className="space-y-1 rounded-none bg-white px-0 py-1.5 md:space-y-2 md:rounded-none md:!border-2 md:!border-slate-300 md:bg-white md:px-4 md:py-4"
                        >
                            <div className="min-w-0">
                                <ResultLinkButton
                                    onClick={() => onOpenEvent(row.event_id)}
                                    className="font-medium"
                                >
                                    {row.event_name}
                                </ResultLinkButton>
                            </div>
                            <p className="flex items-center gap-2 text-xs text-slate-600 md:text-sm">
                                <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500" />
                                <ResultLinkButton
                                    onClick={() => onOpenStage(row.row_id)}
                                    className="text-blue-600"
                                >
                                    {formatDateYmd(row.date_label)}
                                </ResultLinkButton>
                                {row.start_time ? ` | ${formatTimeHm(row.start_time)}` : ""}
                                <span className="text-xs text-gray-500">
                                    ({row.total_performances}曲)
                                </span>
                            </p>
                            {formatStagePattern(row) !== "-" ? (
                                <p className="flex items-center gap-2 text-xs text-slate-600 md:text-sm">
                                    <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                                        パターン
                                    </span>
                                    <span>{formatStagePattern(row)}</span>
                                </p>
                            ) : null}
                            <p className="flex items-center gap-2 text-xs text-slate-600 md:text-sm">
                                <VenueIcon className="h-4 w-4 shrink-0 text-slate-500" />
                                <ResultLinkButton
                                    onClick={() => onOpenVenue(row.venue_id)}
                                    className="text-blue-600"
                                >
                                    {row.venue_name}
                                </ResultLinkButton>
                                <span className="text-xs text-gray-500">
                                    (
                                    {getPrefectureNameById
                                        ? getPrefectureNameById(row.prefecture_id)
                                        : "-"}
                                    )
                                </span>
                            </p>
                            {tags.length > 0 && (
                                <ResultTagList
                                    tags={tags}
                                    tagKeyPrefix={`stage-card-tag-${row.row_id}`}
                                />
                            )}
                        </article>
                    );
                }

                return (
                    <article
                        key={`${searchUnit}-${row.row_id}`}
                        className="space-y-1 rounded-none bg-white px-0 py-2 md:space-y-2 md:rounded-none md:!border-2 md:!border-slate-300 md:bg-white md:px-4 md:py-4"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex flex-wrap items-baseline gap-1.5">
                                <ResultLinkButton
                                    onClick={() => onOpenSong(row.song_id)}
                                    className="text-[15px] font-semibold leading-5 text-blue-700 underline-offset-2 hover:underline md:text-sm md:leading-5"
                                >
                                    {row.primary_text}
                                </ResultLinkButton>
                                {row.artist_text ? (
                                    <>
                                        <span className="text-xs text-slate-400">/</span>
                                        {typeof row.artist_id === "number" && onOpenArtist ? (
                                            <ResultLinkButton
                                                onClick={() => onOpenArtist(row.artist_id as number)}
                                                className="text-xs text-blue-700"
                                            >
                                                {row.artist_text}
                                            </ResultLinkButton>
                                        ) : (
                                            <span className="text-xs text-slate-600">{row.artist_text}</span>
                                        )}
                                    </>
                                ) : null}
                            </div>
                            <div className="shrink-0">
                                <SetlistLinkCell
                                    stageId={row.stage_id ?? row.row_id}
                                    stageCount={row.total_stages}
                                    onOpenStage={onOpenStage}
                                    showMultipleAsButton
                                    label="セトリ"
                                    buttonClassName="inline-flex items-center gap-0.5 border-2 border-gray-800 bg-white px-1 py-0.5 text-[10px] font-semibold leading-none text-slate-800 shadow-[1px_1px_0_rgba(31,41,55,0.55)] hover:bg-slate-100"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs leading-4 text-slate-600">
                            <span className="inline-flex items-center text-slate-500" title="歌唱者" aria-label="歌唱者">
                                <MicrophoneIcon className="h-3.5 w-3.5 shrink-0" />
                            </span>
                            <span>{row.secondary_text || "—"}</span>
                        </div>
                        <div className="border-t border-slate-200 pt-1.5">
                            <div className="grid grid-cols-[auto_1fr] items-center gap-x-1.5 text-[11px] leading-4 text-slate-600">
                                <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                <div className="min-w-0">
                                    <ResultLinkButton
                                        onClick={() => onOpenEvent(row.event_id)}
                                        className="block text-[11px] font-medium leading-4 text-slate-700 hover:text-blue-700"
                                    >
                                        {row.event_name}
                                    </ResultLinkButton>
                                    <div className="text-[11px] leading-4 text-slate-500">
                                        {formatDateYmd(row.date_label)}
                                        {row.start_time ? ` ${formatTimeHm(row.start_time)}` : ""}
                                        {" ＠ "}
                                        {row.venue_name === "複数会場" ? (
                                            <span>{row.venue_name}</span>
                                        ) : (
                                            <ResultLinkButton
                                                onClick={() => onOpenVenue(row.venue_id)}
                                                className="text-blue-700"
                                            >
                                                {row.venue_name}
                                            </ResultLinkButton>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

function groupStageRowsByEvent(rows: SearchResultRow[]): StageEventGroup[] {
    const grouped = new Map<number, StageEventGroup>();
    for (const row of rows) {
        const current = grouped.get(row.event_id);
        if (!current) {
            grouped.set(row.event_id, {
                eventId: row.event_id,
                eventName: row.event_name,
                tags: parseTags(row.event_tags_json),
                totalPerformances: row.total_performances,
                stages: [row],
            });
            continue;
        }
        current.stages.push(row);
        current.totalPerformances += row.total_performances;
        if (current.tags.length === 0) {
            current.tags = parseTags(row.event_tags_json);
        }
    }
    return Array.from(grouped.values());
}
