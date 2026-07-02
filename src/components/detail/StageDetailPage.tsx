import { useEffect, useMemo, useRef, useState } from "react";

import {
    DetailErrorState,
    DetailLoadingState,
    DetailNotFoundState,
    DetailPanel,
    DetailShareLinkButton,
} from "./DetailUi";
import { useStageDetail } from "./hooks/useStageDetail";
import { PerformerList } from "./PerformerList";
import { formatDateYmd, formatTimeHm, parseTags } from "../../lib/uiFormat";
import {
    SetlistSubmissionModal,
    type SetlistSubmissionTarget,
} from "../setlistSubmission/SetlistSubmissionModal";
import { CalendarIcon, EyeIcon, MeatballIcon, TableIcon, UsersIcon } from "../ui";
import { EVENT_TAG_CHIP_CLASS } from "../ui/eventTagClass";

import type {
    SetlistDetail,
    SetlistSearchDb,
} from "../../lib/setlistSearchDb/types";

type StageDetailPageProps = {
    db: SetlistSearchDb;
    stageId: number;
    onResolveTitle?: (title: string) => void;
    onOpenEvent: (eventId: number) => void;
    onOpenSong: (songId: number) => void;
    onOpenArtist: (artistId: number) => void;
    onOpenMember: (personId: number) => void;
    onOpenGroup: (groupId: number) => void;
};

type DisplayMode = "table" | "preview";
const STAGE_DETAIL_VIEW_PREFS_KEY = "tomoko.stageDetail.viewPrefs.v1";
type StageDetailViewPrefs = {
    displayMode: DisplayMode;
    showSection: boolean;
    showPerformer: boolean;
    showArtist: boolean;
    showRemarks: boolean;
};
const DEFAULT_STAGE_DETAIL_VIEW_PREFS: StageDetailViewPrefs = {
    displayMode: "table",
    showSection: true,
    showPerformer: true,
    showArtist: false,
    showRemarks: false,
};

function loadStageDetailViewPrefs(): StageDetailViewPrefs {
    if (typeof window === "undefined") {
        return DEFAULT_STAGE_DETAIL_VIEW_PREFS;
    }
    try {
        const raw = window.localStorage.getItem(STAGE_DETAIL_VIEW_PREFS_KEY);
        if (!raw) return DEFAULT_STAGE_DETAIL_VIEW_PREFS;
        const parsed = JSON.parse(raw) as Partial<StageDetailViewPrefs>;
        return {
            displayMode:
                parsed.displayMode === "table" || parsed.displayMode === "preview"
                    ? parsed.displayMode
                    : DEFAULT_STAGE_DETAIL_VIEW_PREFS.displayMode,
            showSection:
                typeof parsed.showSection === "boolean"
                    ? parsed.showSection
                    : DEFAULT_STAGE_DETAIL_VIEW_PREFS.showSection,
            showPerformer:
                typeof parsed.showPerformer === "boolean"
                    ? parsed.showPerformer
                    : DEFAULT_STAGE_DETAIL_VIEW_PREFS.showPerformer,
            showArtist:
                typeof parsed.showArtist === "boolean"
                    ? parsed.showArtist
                    : DEFAULT_STAGE_DETAIL_VIEW_PREFS.showArtist,
            showRemarks:
                typeof parsed.showRemarks === "boolean"
                    ? parsed.showRemarks
                    : DEFAULT_STAGE_DETAIL_VIEW_PREFS.showRemarks,
        };
    } catch {
        return DEFAULT_STAGE_DETAIL_VIEW_PREFS;
    }
}

export function StageDetailPage({
    db,
    stageId,
    onResolveTitle,
    onOpenEvent,
    onOpenSong,
    onOpenArtist,
    onOpenMember,
    onOpenGroup,
}: StageDetailPageProps) {
    const initialViewPrefs = useMemo(() => loadStageDetailViewPrefs(), []);
    const { loading, error, stage, setlists, performers } = useStageDetail(db, stageId);
    const [displayMode, setDisplayMode] = useState<DisplayMode>(
        initialViewPrefs.displayMode,
    );
    const [showSection, setShowSection] = useState(initialViewPrefs.showSection);
    const [showPerformer, setShowPerformer] = useState(initialViewPrefs.showPerformer);
    const [showArtist, setShowArtist] = useState(initialViewPrefs.showArtist);
    const [showRemarks, setShowRemarks] = useState(initialViewPrefs.showRemarks);
    const [isOptionMenuOpen, setIsOptionMenuOpen] = useState(false);
    const [submissionTarget, setSubmissionTarget] =
        useState<SetlistSubmissionTarget | null>(null);
    const optionMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (stage) {
            onResolveTitle?.(stage.eventName);
        }
    }, [stage, onResolveTitle]);

    useEffect(() => {
        if (!isOptionMenuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (!optionMenuRef.current?.contains(target)) {
                setIsOptionMenuOpen(false);
            }
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [isOptionMenuOpen]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(
                STAGE_DETAIL_VIEW_PREFS_KEY,
                JSON.stringify({
                    displayMode,
                    showSection,
                    showPerformer,
                    showArtist,
                    showRemarks,
                }),
            );
        } catch {
            // ignore storage errors
        }
    }, [displayMode, showSection, showPerformer, showArtist, showRemarks]);

    const tags = useMemo(
        () => (stage ? parseTags(stage.eventTagsJson) : []),
        [stage],
    );

    const previewLines = useMemo(() => {
        const lines: string[] = [];
        let previousSection = "";
        setlists.forEach((row) => {
            const section = row.section?.trim() || "本編";
            if (showSection && section !== previousSection) {
                lines.push(`【${section}】`);
                previousSection = section;
            }
            const parts = [`${row.musicOrder}. ${row.songName}`];
            if (showArtist && row.artistName) parts.push(`/${row.artistName}`);
            if (showPerformer && row.displayPerformerName) {
                parts.push(`(${row.displayPerformerName})`);
            }
            if (showRemarks && row.remarks?.trim()) {
                parts.push(`[${row.remarks.trim()}]`);
            }
            lines.push(parts.join(" "));
        });
        return lines;
    }, [setlists, showSection, showPerformer, showArtist, showRemarks]);

    const mobileSectionBlocks = useMemo(() => {
        const blocks: Array<{
            key: string;
            section: string;
            rows: SetlistDetail[];
        }> = [];
        let previousSection = "";
        setlists.forEach((row) => {
            const section = row.section?.trim() || "本編";
            if (blocks.length === 0 || section !== previousSection) {
                blocks.push({
                    key: `section-${section}-${row.setlistId}`,
                    section,
                    rows: [row],
                });
                previousSection = section;
                return;
            }
            blocks[blocks.length - 1].rows.push(row);
        });
        return blocks;
    }, [setlists]);

    if (loading) return <DetailLoadingState />;
    if (error) return <DetailErrorState message={error} />;
    if (!stage) return <DetailNotFoundState message="ステージが見つかりませんでした。" />;

    return (
        <div className="space-y-4">
            <DetailPanel className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                            STAGE
                        </p>
                        <h1 className="min-w-0 break-words text-lg font-bold text-slate-900">
                            {stage.eventStageNumber ? `【#${stage.eventStageNumber}】` : ""}
                            {stage.eventName}
                            {stage.pattern?.trim() ? `【${stage.pattern.trim()}】` : ""}
                        </h1>
                    </div>
                    <DetailShareLinkButton />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-base font-semibold text-slate-800">
                    <CalendarIcon className="h-4 w-4 shrink-0 text-slate-600" />
                    <span>
                        {formatDateYmd(stage.date)} / 開演 {formatTimeHm(stage.startTime)}
                    </span>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                    @ {stage.venueName}
                    {stage.prefectureName ? ` (${stage.prefectureName})` : ""}
                </p>
                {stage.cancelled ? (
                    <p className="mt-1 inline-flex rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        中止
                    </p>
                ) : null}
                <div className="mt-2 flex justify-end">
                    <button
                        type="button"
                        onClick={() => onOpenEvent(stage.eventId)}
                        className="inline-flex rounded-none border-2 border-gray-800 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-100"
                    >
                        イベント詳細へ
                    </button>
                </div>
                {tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className={EVENT_TAG_CHIP_CLASS}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : null}
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

            {setlists.length > 0 ? (
            <DetailPanel className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900">セットリスト</h2>
                    <div className="relative flex items-center gap-2" ref={optionMenuRef}>
                        <button
                            type="button"
                            onClick={() => setIsOptionMenuOpen((current) => !current)}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-none border-2 border-gray-800 ${
                                isOptionMenuOpen
                                    ? "bg-gray-200 text-gray-900"
                                    : "bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                            title="表示オプション"
                            aria-label="表示オプション"
                        >
                            <MeatballIcon className="h-4 w-4" />
                        </button>
                        {isOptionMenuOpen ? (
                            <div className="absolute right-0 top-12 z-20 min-w-44 rounded-none border-2 border-gray-800 bg-white p-2 shadow-sm">
                                <div className="space-y-2 text-xs">
                                    <div className="space-y-1">
                                        <p className="px-1 text-[10px] font-semibold tracking-[0.08em] text-slate-500">
                                            表示形式
                                        </p>
                                        <div className="inline-flex w-full bg-white p-1">
                                            <button
                                                type="button"
                                                onClick={() => setDisplayMode("table")}
                                                className={`inline-flex h-8 flex-1 items-center justify-center rounded-none border-2 ${
                                                    displayMode === "table"
                                                        ? "border-gray-800 bg-gray-200 text-gray-900"
                                                        : "border-transparent text-gray-700 hover:border-gray-300 hover:bg-gray-100"
                                                }`}
                                                title="テーブル表示"
                                                aria-label="テーブル表示"
                                            >
                                                <TableIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDisplayMode("preview")}
                                                className={`inline-flex h-8 flex-1 items-center justify-center rounded-none border-2 ${
                                                    displayMode === "preview"
                                                        ? "border-gray-800 bg-gray-200 text-gray-900"
                                                        : "border-transparent text-gray-700 hover:border-gray-300 hover:bg-gray-100"
                                                }`}
                                                title="プレビュー表示"
                                                aria-label="プレビュー表示"
                                            >
                                                <EyeIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="px-1 text-[10px] font-semibold tracking-[0.08em] text-slate-500">
                                            表示オプション
                                        </p>
                                        <label className="inline-flex w-full items-center justify-between gap-2 px-2 py-1 text-slate-700">
                                            <span>セクション</span>
                                            <span className="relative inline-flex h-5 w-10 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={showSection}
                                                    onChange={(event) => setShowSection(event.target.checked)}
                                                    className="peer sr-only"
                                                />
                                                <span className="absolute inset-0 rounded-none bg-gray-200 transition peer-checked:bg-red-600" />
                                                <span className="absolute left-0.5 top-0.5 h-3 w-4 rounded-none bg-white transition peer-checked:translate-x-5" />
                                            </span>
                                        </label>
                                        <label className="inline-flex w-full items-center justify-between gap-2 px-2 py-1 text-slate-700">
                                            <span>歌唱者</span>
                                            <span className="relative inline-flex h-5 w-10 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={showPerformer}
                                                    onChange={(event) => setShowPerformer(event.target.checked)}
                                                    className="peer sr-only"
                                                />
                                                <span className="absolute inset-0 rounded-none bg-gray-200 transition peer-checked:bg-red-600" />
                                                <span className="absolute left-0.5 top-0.5 h-3 w-4 rounded-none bg-white transition peer-checked:translate-x-5" />
                                            </span>
                                        </label>
                                        <label className="inline-flex w-full items-center justify-between gap-2 px-2 py-1 text-slate-700">
                                            <span>アーティスト</span>
                                            <span className="relative inline-flex h-5 w-10 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={showArtist}
                                                    onChange={(event) => setShowArtist(event.target.checked)}
                                                    className="peer sr-only"
                                                />
                                                <span className="absolute inset-0 rounded-none bg-gray-200 transition peer-checked:bg-red-600" />
                                                <span className="absolute left-0.5 top-0.5 h-3 w-4 rounded-none bg-white transition peer-checked:translate-x-5" />
                                            </span>
                                        </label>
                                        <label className="inline-flex w-full items-center justify-between gap-2 px-2 py-1 text-slate-700">
                                            <span>備考</span>
                                            <span className="relative inline-flex h-5 w-10 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={showRemarks}
                                                    onChange={(event) => setShowRemarks(event.target.checked)}
                                                    className="peer sr-only"
                                                />
                                                <span className="absolute inset-0 rounded-none bg-gray-200 transition peer-checked:bg-red-600" />
                                                <span className="absolute left-0.5 top-0.5 h-3 w-4 rounded-none bg-white transition peer-checked:translate-x-5" />
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
                {displayMode === "preview" ? (
                    <pre className="overflow-x-auto border-2 border-gray-800 bg-slate-50 p-3 text-[13px] whitespace-pre-wrap text-slate-800">
                        {previewLines.join("\n")}
                    </pre>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-sm">
                                <thead className="border-b-2 border-gray-800 bg-slate-50 text-xs text-slate-600">
                                    <tr>
                                        <th className="px-2 py-2 text-left">順番</th>
                                        {showSection ? (
                                            <th className="px-2 py-2 text-left">セクション</th>
                                        ) : null}
                                        <th className="px-2 py-2 text-left">曲名</th>
                                        {showArtist ? (
                                            <th className="px-2 py-2 text-left">アーティスト</th>
                                        ) : null}
                                        {showPerformer ? (
                                            <th className="px-2 py-2 text-left">歌唱者</th>
                                        ) : null}
                                        {showRemarks ? (
                                            <th className="px-2 py-2 text-left">備考</th>
                                        ) : null}
                                    </tr>
                                </thead>
                                <tbody>
                                    {setlists.map((row) => (
                                        <tr key={row.setlistId} className="border-b border-gray-300">
                                            <td className="px-2 py-2">#{row.musicOrder}</td>
                                            {showSection ? (
                                                <td className="px-2 py-2">
                                                    {row.section?.trim() || "本編"}
                                                </td>
                                            ) : null}
                                            <td className="px-2 py-2">
                                                {row.songId !== null ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenSong(row.songId)}
                                                        className="text-left text-blue-600 hover:underline"
                                                    >
                                                        {row.songName}
                                                    </button>
                                                ) : (
                                                    <span>{row.songName}</span>
                                                )}
                                            </td>
                                            {showArtist ? (
                                                <td className="px-2 py-2">
                                                    {(() => {
                                                        const artistId = row.artistId;
                                                        const artistName = row.artistName;
                                                        if (artistId !== null && artistName) {
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onOpenArtist(artistId)}
                                                                    className="text-left text-blue-600 hover:underline"
                                                                >
                                                                    {artistName}
                                                                </button>
                                                            );
                                                        }
                                                        return artistName || "-";
                                                    })()}
                                                </td>
                                            ) : null}
                                            {showPerformer ? (
                                                <td className="px-2 py-2">
                                                    {row.displayPerformerName || "-"}
                                                </td>
                                            ) : null}
                                            {showRemarks ? (
                                                <td className="px-2 py-2">{row.remarks?.trim() || "-"}</td>
                                            ) : null}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <ul className="space-y-2 md:hidden">
                            {mobileSectionBlocks.map((block) => (
                                <li
                                    key={block.key}
                                    className="px-1.5 py-1"
                                >
                                    <ul>
                                        {showSection && block.section !== "本編" ? (
                                            <li className="mb-1 border-y border-gray-400 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-slate-700">
                                                【{block.section}】
                                            </li>
                                        ) : null}
                                        {block.rows.map((row, index) => (
                                            <li
                                                key={`mobile-${row.setlistId}`}
                                                className={`py-1 text-xs text-slate-800 ${
                                                    index < block.rows.length - 1
                                                        ? "border-b border-gray-300"
                                                        : ""
                                                }`}
                                            >
                                                <span className="mr-1 text-slate-500">#{row.musicOrder}</span>
                                                {row.songId !== null ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenSong(row.songId)}
                                                        className="text-left text-blue-600 hover:underline"
                                                    >
                                                        {row.songName}
                                                    </button>
                                                ) : (
                                                    <span>{row.songName}</span>
                                                )}
                                                {showArtist && row.artistName ? (
                                                    <>
                                                        <span className="ml-1 text-slate-500">(</span>
                                                        {(() => {
                                                            const artistId = row.artistId;
                                                            if (artistId !== null) {
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onOpenArtist(artistId)}
                                                                        className="text-left text-blue-600 hover:underline"
                                                                    >
                                                                        {row.artistName}
                                                                    </button>
                                                                );
                                                            }
                                                            return <span className="text-slate-500">{row.artistName}</span>;
                                                        })()}
                                                        <span className="text-slate-500">)</span>
                                                    </>
                                                ) : null}
                                                {showPerformer && row.displayPerformerName ? (
                                                    <span className="ml-1 text-slate-600">
                                                        / {row.displayPerformerName}
                                                    </span>
                                                ) : null}
                                                {showRemarks && row.remarks?.trim() ? (
                                                    <span className="ml-1 text-slate-500">
                                                        [{row.remarks.trim()}]
                                                    </span>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </DetailPanel>
            ) : (
                <DetailPanel className="p-4">
                    <h2 className="text-base font-semibold text-slate-900">セットリスト</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        この公演のセットリストは未登録です。
                    </p>
                    <button
                        type="button"
                        onClick={() =>
                            setSubmissionTarget({
                                stageId: stage.stageId,
                                eventId: stage.eventId,
                                eventName: stage.eventName,
                                stageDate: stage.date,
                                startTime: stage.startTime,
                                venueName: stage.venueName,
                                pattern: stage.pattern,
                            })
                        }
                        className="mt-3 w-full rounded-none border-2 border-gray-800 bg-red-600 px-4 py-3 text-base font-bold text-white sm:w-auto"
                    >
                        セトリを投稿
                    </button>
                </DetailPanel>
            )}
            <SetlistSubmissionModal
                open={submissionTarget !== null}
                target={submissionTarget}
                db={db}
                onClose={() => setSubmissionTarget(null)}
            />
        </div>
    );
}
