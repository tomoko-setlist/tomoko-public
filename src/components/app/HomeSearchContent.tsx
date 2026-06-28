import { useRef } from "react";

import {
    updateFieldSearchMethod,
    type UseSearchPageState,
} from "../../hooks/useSearchPageState";
import {
    FloatingEditButton,
    SearchFormPanel,
    SearchResultsTable,
} from "../search";

import type { AppRoute } from "../../lib/appRoute";

type HomeSearchContentProps = {
    dbReady: boolean;
    modeLabels: Record<"stage" | "setlist", string>;
    search: UseSearchPageState;
    navigate: (route: AppRoute) => void;
};

export function HomeSearchContent({
    dbReady,
    modeLabels,
    search,
    navigate,
}: HomeSearchContentProps) {
    const formRef = useRef<HTMLDivElement>(null);

    return (
        <>
            <div ref={formRef}>
                <SearchFormPanel
                    dbReady={dbReady}
                    hasSearched={search.hasSearched}
                    modeLabels={modeLabels}
                    searchUnit={search.searchUnit}
                    groupByEventSong={search.groupByEventSong}
                    query={search.query}
                    personName={search.personName}
                    songName={search.songName}
                    artistName={search.artistName}
                    lyricistName={search.lyricistName}
                    composerName={search.composerName}
                    arrangerName={search.arrangerName}
                    eventName={search.eventName}
                    venueName={search.venueName}
                    eventTag={search.eventTag}
                    sectionName={search.sectionName}
                    conditionGroups={search.conditionGroups}
                    conditionTopLevelJoin={search.conditionTopLevelJoin}
                    prefectureIds={search.prefectureIds}
                    eventTagOptions={search.eventTagOptions}
                    prefectureOptions={search.prefectureOptions}
                    fieldSearchMethods={search.fieldSearchMethods}
                    dateMode={search.dateMode}
                    dateFrom={search.dateFrom}
                    dateTo={search.dateTo}
                    formCollapsed={search.formCollapsed}
                    statusText={search.statusText}
                    suggestVariant={search.suggestVariant}
                    onSearchUnitChange={search.handleSearchUnitChange}
                    onQueryChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setQuery,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onGroupByEventSongChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setGroupByEventSong,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onPersonNameChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setPersonName,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onSongNameChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setSongName,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onArtistNameChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setArtistName,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onLyricistNameChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setLyricistName,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onComposerNameChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setComposerName,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onArrangerNameChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setArrangerName,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onEventNameChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setEventName,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onVenueNameChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setVenueName,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onEventTagChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setEventTag,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onSectionNameChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setSectionName,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onConditionGroupAdd={(field) => {
                        search.addConditionGroup(field);
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onConditionTopLevelJoinChange={(join) => {
                        search.updateConditionTopLevelJoin(join);
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onConditionGroupJoinChange={(groupId, join) => {
                        search.updateGroupConditionJoin(groupId, join);
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onConditionGroupRemove={(groupId) => {
                        search.removeConditionGroup(groupId);
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onConditionGroupFieldChange={(groupId, field, rowId) => {
                        search.updateConditionGroupField(groupId, field, rowId);
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onConditionGroupWithPrevious={(groupIndex) => {
                        search.groupBlockWithPrevious(groupIndex);
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onConditionUngroup={(groupIndex, rowId) => {
                        search.ungroupCondition(groupIndex, rowId);
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onConditionValueChange={(groupId, index, value) => {
                        search.updateConditionValue(groupId, index, value);
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onConditionValueRemove={(groupId, index) => {
                        search.removeConditionValue(groupId, index);
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onPrefectureIdsChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setPrefectureIds,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onFieldSearchMethodChange={(field, value) => {
                        updateFieldSearchMethod(
                            search.setFieldSearchMethods,
                            field,
                            value,
                        );
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onDateModeChange={(value) =>
                        setValueWithPageReset(
                            value,
                            search.setDateMode,
                            search.setPage,
                            search.setPageInput,
                        )
                    }
                    onDateRangeChange={(range) => {
                        search.setDateFrom(range.dateFrom);
                        search.setDateTo(range.dateTo);
                        search.setPage(1);
                        search.setPageInput("1");
                    }}
                    onToggleForm={() => search.setFormCollapsed((prev) => !prev)}
                    onResetFilters={search.resetFilters}
                    onFetchSuggestions={search.suggest}
                />
            </div>

            <SearchResultsTable
                searchUnit={search.searchUnit}
                result={search.result}
                hasSearched={search.hasSearched}
                statusText={search.statusText}
                tableHeaders={search.tableHeaders}
                sortBy={search.sortBy}
                sortOrder={search.sortOrder}
                onSort={(nextSortBy, nextSortOrder) => {
                    search.setSortBy(nextSortBy);
                    search.setSortOrder(nextSortOrder);
                    search.setPage(1);
                }}
                onOpenEvent={(id) => navigate({ name: "event", id })}
                onOpenStage={(id) => navigate({ name: "stage", id })}
                onOpenVenue={(id) => navigate({ name: "venue", id })}
                onOpenSong={(id) => navigate({ name: "song", id })}
                onOpenArtist={(id) => navigate({ name: "artist", id })}
                getPrefectureNameById={(id) => {
                    if (id === null || id === undefined) return "-";
                    const hit = search.prefectureOptions.find(
                        (item) => item.id === id,
                    );
                    return hit?.name ?? `ID:${id}`;
                }}
                page={search.page}
                pageSize={search.pageSize}
                pageInput={search.pageInput}
                setPageInput={search.setPageInput}
                onGoToPage={(nextPage) => {
                    search.goToPage(nextPage);
                    search.setFormCollapsed(true);
                }}
                onPageSizeChange={(nextPageSize) => {
                    search.handlePageSizeChange(nextPageSize);
                    search.setFormCollapsed(true);
                }}
            />
            <FloatingEditButton
                targetRef={formRef}
                enabled={search.hasSearched}
                isFormExpanded={!search.formCollapsed}
                visibilityBottomThresholdPx={180}
                onClick={() => {
                    search.setFormCollapsed(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                label="検索条件を編集"
            />
        </>
    );
}

function setValueWithPageReset<T>(
    value: T,
    setter: (value: T) => void,
    setPage: (value: number) => void,
    setPageInput: (value: string) => void,
) {
    setter(value);
    setPage(1);
    setPageInput("1");
}
