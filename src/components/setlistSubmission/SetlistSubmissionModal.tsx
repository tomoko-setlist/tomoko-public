import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import {
    buildGroupKeyMap,
    resolveSetlistCandidateRow,
    searchPerformerLookupCandidates,
    searchSongLookupCandidates,
    splitPerformerNames,
    type PerformerLookupCandidate,
    type ResolvedPerformerCandidate,
    type SetlistCandidateResolverCache,
    type SongLookupCandidate,
} from "../../lib/setlistCandidateResolver";
import { submitSetlistSubmission } from "../../lib/submitSetlistSubmission";
import { formatDateYmd, formatTimeHm } from "../../lib/uiFormat";

import type { SetlistSearchDb } from "../../lib/setlistSearchDb/types";

export type SetlistSubmissionTarget = {
    stageId: number | null;
    eventId: number | null;
    eventName: string;
    stageDate: string;
    startTime: string | null;
    venueName: string;
    pattern?: string | null;
};

type ResolveStatus = "idle" | "resolving" | "matched" | "candidate" | "unresolved";
type ViewMode = "input" | "review" | "success";
type DraftRowKind = "song" | "mc";

type DraftRow = {
    id: string;
    kind: DraftRowKind;
    section: string;
    note: string;
    songName: string;
    performers: string;
    songId: number | null;
    songVersionId: number | null;
    versionName: string;
    songArtistId: number | null;
    songArtistName: string;
    songCandidates: SongLookupCandidate[];
    performerCandidates: Record<string, PerformerLookupCandidate[]>;
    performerResolved: ResolvedPerformerCandidate[];
    resolveStatus: ResolveStatus;
    reviewConfirmed: boolean;
    inMedley: boolean;
};

type SetlistSubmissionModalProps = {
    target: SetlistSubmissionTarget | null;
    open: boolean;
    db?: SetlistSearchDb | null;
    onClose: () => void;
};

const DEFAULT_SECTION = "本編";
const SECTION_OPTIONS = ["本編", "アンコール", "ダブルアンコール"] as const;

const createRow = (
    songName = "",
    performers = "",
    options: Partial<Pick<DraftRow, "kind" | "section" | "note" | "inMedley">> = {},
): DraftRow => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: options.kind ?? "song",
    section: options.section ?? DEFAULT_SECTION,
    note: options.note ?? "",
    songName,
    performers,
    songId: null,
    songVersionId: null,
    versionName: "",
    songArtistId: null,
    songArtistName: "",
    songCandidates: [],
    performerCandidates: {},
    performerResolved: [],
    resolveStatus: "idle",
    reviewConfirmed: false,
    inMedley: options.inMedley ?? false,
});

const getSectionFromLine = (line: string): string | null => {
    if (/^(?:アンコール|encore|en\.?|ＥＮ)$/iu.test(line)) return "アンコール";
    if (/^(?:ダブルアンコール|w\s*encore|double\s+encore|w\.?en\.?)$/iu.test(line)) {
        return "ダブルアンコール";
    }
    if (/^(?:本編|main)$/iu.test(line)) return DEFAULT_SECTION;
    return null;
};

const getMcNoteFromLine = (line: string): string | null => {
    const match = line.match(/^(?:MC|ＭＣ)(?:\s*[:：]\s*(.*)|\s+(.*))?$/u);
    if (!match) return null;
    return (match[1] ?? match[2] ?? "").trim();
};

const parseMemo = (value: string): DraftRow[] => {
    const rows: DraftRow[] = [];
    let section = DEFAULT_SECTION;
    let medleySection: string | null = null;
    value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
            const normalized = line.replace(/^\s*\d+[.)、\s-]*/, "").trim();
            const nextSection = getSectionFromLine(normalized);
            if (nextSection) {
                section = nextSection;
                return;
            }
            const medleyStart = normalized.match(/^(?:>>>|▶▶▶)\s*(.*)/u);
            if (medleyStart) {
                medleySection = medleyStart[1]?.trim() || "メドレー";
                return;
            }
            if (/^(?:<<<|◀◀◀)\s*$/u.test(normalized)) {
                medleySection = null;
                return;
            }
            const rowSection = medleySection ?? section;
            const inMedley = medleySection !== null;
            const mcNote = getMcNoteFromLine(normalized);
            if (mcNote !== null) {
                rows.push(createRow("MC", "", { kind: "mc", section: rowSection, note: mcNote, inMedley }));
                return;
            }
            const performerMatch = normalized.match(/^(.*?)\s*[／/]\s*(.+)$/u);
            if (performerMatch) {
                rows.push(
                    createRow(
                        performerMatch[1]?.trim() ?? normalized,
                        performerMatch[2]?.trim() ?? "",
                        { section: rowSection, inMedley },
                    ),
                );
                return;
            }
            rows.push(createRow(normalized, "", { section: rowSection, inMedley }));
        });
    return rows;
};

const candidateValue = (candidate: SongLookupCandidate): string =>
    `${candidate.source}:${candidate.source === "version" ? candidate.songVersionId ?? "" : candidate.songId ?? ""}`;


const getCandidateLabel = (candidate: SongLookupCandidate): string => {
    const showVersion =
        candidate.source === "version" &&
        candidate.versionName &&
        candidate.versionName !== candidate.songName;
    const base = showVersion
        ? `${candidate.versionName}（${candidate.songName}）`
        : candidate.songName;
    return `${base}${candidate.artistName ? ` / ${candidate.artistName}` : ""}`;
};

type PerformerCandidateSelection = {
    value: string;
    personId: number | null;
    groupId: number | null;
};

const performerCandidateValue = (candidate: PerformerLookupCandidate): string =>
    JSON.stringify({
        value: candidate.value,
        personId: candidate.personId,
        groupId: candidate.groupId,
    });

const parsePerformerCandidateValue = (
    value: string,
): PerformerCandidateSelection | null => {
    try {
        const parsed = JSON.parse(value) as Partial<PerformerCandidateSelection>;
        if (typeof parsed.value !== "string") return null;
        return {
            value: parsed.value,
            personId: typeof parsed.personId === "number" ? parsed.personId : null,
            groupId: typeof parsed.groupId === "number" ? parsed.groupId : null,
        };
    } catch {
        return null;
    }
};

const getPerformerCandidateLabel = (candidate: PerformerLookupCandidate): string =>
    `${candidate.value}${candidate.groupId !== null ? "（グループ）" : ""}`;

const getStatusLabel = (row: DraftRow): string => {
    if (row.kind === "mc") return "MC";
    if (row.resolveStatus === "resolving") return "確認中";
    if (row.reviewConfirmed) return "確認済";
    if (row.resolveStatus === "matched") return "一致";
    if (row.resolveStatus === "candidate") return "候補あり";
    if (row.resolveStatus === "unresolved") return "要確認";
    return "未確認";
};

const getStatusClassName = (row: DraftRow): string => {
    if (row.kind === "mc") return "bg-slate-700 text-white";
    if (row.resolveStatus === "matched") return "bg-emerald-700 text-white";
    if (row.resolveStatus === "candidate") return "bg-blue-700 text-white";
    if (row.resolveStatus === "unresolved") return "bg-amber-100 text-amber-900";
    if (row.resolveStatus === "resolving") return "bg-slate-900 text-white";
    return "bg-slate-100 text-slate-600";
};

const getSubmittedRows = (rows: DraftRow[]): DraftRow[] =>
    rows
        .map((row) => ({
            ...row,
            songName: row.songName.trim(),
            section: row.section.trim() || DEFAULT_SECTION,
            note: row.note.trim(),
            performers: row.performers.trim(),
        }))
        .filter((row) => row.songName.length > 0);

const buildResolvedPerformerText = (
    rawPerformers: string,
    resolved: ResolvedPerformerCandidate[],
): string => {
    const names = splitPerformerNames(rawPerformers);
    if (names.length === 0) return rawPerformers.trim();
    if (resolved.length === 0) return names.join("・");
    return resolved.map((performer) => performer.performerName).join("・");
};

const buildSubmissionResultText = (
    target: SetlistSubmissionTarget,
    submissionId: number,
    rows: DraftRow[],
): string => {
    const date = formatDateYmd(target.stageDate);
    const time = formatTimeHm(target.startTime);
    const title = [
        target.eventName,
        target.pattern?.trim() ? `【${target.pattern.trim()}】` : "",
        time && time !== "-" ? `${date} ${time}` : date,
        target.venueName ? `@ ${target.venueName}` : "",
    ]
        .filter(Boolean)
        .join(" ");
    let musicOrder = 0;
    const lines = rows.map((row) => {
        const section =
            row.section.trim() && row.section.trim() !== DEFAULT_SECTION
                ? `【${row.section.trim()}】 `
                : "";
        const note = row.note.trim() ? `（${row.note.trim()}）` : "";
        if (row.kind === "mc") {
            return `- ${section}${row.songName || "MC"}${note}`;
        }
        musicOrder += 1;
        const performers = row.performers.trim() ? ` / ${row.performers.trim()}` : "";
        return `${musicOrder}. ${section}${row.songName.trim()}${performers}${note}`;
    });
    return [`投稿ID: ${submissionId}`, title, "", ...lines].join("\n");
};

const copyTextToClipboard = async (text: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
        if (!document.execCommand("copy")) {
            throw new Error("copy command failed");
        }
    } finally {
        document.body.removeChild(textarea);
    }
};

export function SetlistSubmissionModal({
    target,
    open,
    db = null,
    onClose,
}: SetlistSubmissionModalProps) {
    const [submitterName, setSubmitterName] = useState("");
    const [commonPerformers, setCommonPerformers] = useState("");
    const [memo, setMemo] = useState("");
    const memoTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [rows, setRows] = useState<DraftRow[]>(() => [createRow()]);
    const [viewMode, setViewMode] = useState<ViewMode>("input");
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [draggingRowIndex, setDraggingRowIndex] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [successText, setSuccessText] = useState("");
    const [copyMessage, setCopyMessage] = useState("");
    const [touchDragPreview, setTouchDragPreview] = useState<{
        rowId: string;
        x: number;
        y: number;
        offsetX: number;
        width: number;
    } | null>(null);
    const touchDragRef = useRef<{
        pointerId: number;
        rowId: string;
        currentIndex: number;
        moved: boolean;
    } | null>(null);
    const suppressRowClickRef = useRef(false);

    useEffect(() => {
        if (!open) return;
        setMemo("");
        setCommonPerformers("");
        setRows([createRow()]);
        setViewMode("input");
        setEditingRowId(null);
        setDraggingRowIndex(null);
        setMessage("");
        setError("");
        setSuccessText("");
        setCopyMessage("");
    }, [open, target?.stageId]);

    const stageLabel = useMemo(() => {
        if (!target) return "";
        const date = formatDateYmd(target.stageDate);
        const time = formatTimeHm(target.startTime);
        const dateTime = time && time !== "-" ? `${date} ${time}` : date;
        return [
            target.eventName,
            target.pattern?.trim() ? `【${target.pattern.trim()}】` : "",
            dateTime,
            target.venueName ? `@ ${target.venueName}` : "",
        ]
            .filter(Boolean)
            .join(" ");
    }, [target]);

    if (!open || !target) return null;

    const updateRow = (id: string, patch: Partial<DraftRow>) => {
        setRows((current) =>
            current.map((row) =>
                row.id === id
                    ? {
                          ...row,
                          ...patch,
                          songId:
                              patch.songId !== undefined
                                  ? patch.songId
                                  : patch.songName !== undefined || patch.kind === "mc"
                                    ? null
                                    : row.songId,
                          songVersionId:
                              patch.songVersionId !== undefined
                                  ? patch.songVersionId
                                  : patch.songName !== undefined || patch.kind === "mc"
                                    ? null
                                    : row.songVersionId,
                          versionName:
                              patch.versionName !== undefined
                                  ? patch.versionName
                                  : patch.songName !== undefined || patch.kind === "mc"
                                    ? ""
                                    : row.versionName,
                          songArtistId:
                              patch.songArtistId !== undefined
                                  ? patch.songArtistId
                                  : patch.songName !== undefined || patch.kind === "mc"
                                    ? null
                                    : row.songArtistId,
                          songArtistName:
                              patch.songArtistName !== undefined
                                  ? patch.songArtistName
                                  : patch.songName !== undefined || patch.kind === "mc"
                                    ? ""
                                    : row.songArtistName,
                          songCandidates:
                              patch.songCandidates !== undefined
                                  ? patch.songCandidates
                                  : patch.songName !== undefined || patch.kind === "mc"
                                    ? []
                                    : row.songCandidates,
                          performerCandidates:
                              patch.performerCandidates !== undefined
                                  ? patch.performerCandidates
                                  : patch.performers !== undefined
                                    ? {}
                                    : row.performerCandidates,
                          performerResolved:
                              patch.performerResolved !== undefined
                                  ? patch.performerResolved
                                  : patch.performers !== undefined
                                    ? []
                                    : row.performerResolved,
                          resolveStatus:
                              patch.resolveStatus !== undefined
                                  ? patch.resolveStatus
                                  : patch.kind === "mc"
                                    ? "matched"
                                    : patch.songName !== undefined ||
                                        patch.performers !== undefined
                                      ? "idle"
                                      : row.resolveStatus,
                          reviewConfirmed:
                              patch.reviewConfirmed !== undefined
                                  ? patch.reviewConfirmed
                                  : patch.songName !== undefined ||
                                      patch.performers !== undefined ||
                                      patch.kind !== undefined
                                    ? false
                                    : row.reviewConfirmed,
                      }
                    : row,
            ),
        );
    };

    const resolveRows = async (targetRows: DraftRow[]): Promise<DraftRow[]> => {
        if (!db) return targetRows;
        setResolving(true);
        setRows((current) =>
            current.map((row) =>
                targetRows.some((targetRow) => targetRow.id === row.id)
                    ? { ...row, resolveStatus: "resolving" }
                    : row,
            ),
        );
        try {
            const groupsByKey = await buildGroupKeyMap(db);
            const cache: SetlistCandidateResolverCache = {
                songs: new Map(),
                performers: new Map(),
            };
            const resolvedRows = await Promise.all(
                targetRows.map(async (row) => {
                    if (row.kind === "mc") {
                        return {
                            ...row,
                            songName: row.songName.trim() || "MC",
                            songId: null,
                            songVersionId: null,
                            versionName: "",
                            songArtistId: null,
                            songArtistName: "",
                            songCandidates: [],
                            performerCandidates: {},
                            performerResolved: [],
                            resolveStatus: "matched" as const,
                        };
                    }
                    const resolved = await resolveSetlistCandidateRow(
                        db,
                        row,
                        groupsByKey,
                        cache,
                    );
                    const selected =
                        row.songId || row.songVersionId
                            ? row.songCandidates.find((candidate) => {
                                  if (row.songVersionId) {
                                      return (
                                          candidate.source === "version" &&
                                          candidate.songVersionId === row.songVersionId
                                      );
                                  }
                                  return (
                                      candidate.source === "song" &&
                                      candidate.songId === row.songId
                                  );
                              }) ?? resolved.selectedSong
                            : resolved.selectedSong;
                    const hasUnresolvedPerformer = resolved.hasUnresolvedPerformer;
                    const hasMultipleSongCandidates = resolved.songCandidates.length > 1;
                    const nextResolveStatus: ResolveStatus = selected
                        ? hasUnresolvedPerformer || hasMultipleSongCandidates
                            ? "candidate"
                            : "matched"
                        : resolved.songCandidates.length > 0
                          ? "candidate"
                          : row.songName.trim()
                            ? "unresolved"
                            : "idle";
                    const next: DraftRow = {
                        ...row,
                        songName: selected?.songName ?? row.songName.trim(),
                        songId: selected?.songId ?? null,
                        songVersionId: selected?.songVersionId ?? null,
                        versionName: selected?.versionName ?? "",
                        songArtistId: selected?.artistId ?? null,
                        songArtistName: selected?.artistName ?? "",
                        songCandidates: resolved.songCandidates,
                        performerCandidates: resolved.performerCandidates,
                        performerResolved: resolved.performerResolved,
                        performers: buildResolvedPerformerText(
                            row.performers,
                            resolved.performerResolved,
                        ),
                        resolveStatus: row.reviewConfirmed ? "matched" : nextResolveStatus,
                    };
                    return next;
                }),
            );
            setRows((current) =>
                current.map(
                    (row) =>
                        resolvedRows.find((resolved) => resolved.id === row.id) ?? row,
                ),
            );
            return targetRows.map(
                (row) => resolvedRows.find((resolved) => resolved.id === row.id) ?? row,
            );
        } finally {
            setResolving(false);
        }
    };

    const openReview = async () => {
        const parsed = parseMemo(memo);
        const common = commonPerformers.trim();
        const baseRows = parsed.length > 0 ? parsed : rows;
        const nextRows = baseRows.map((row) => ({
            ...row,
            performers: row.kind === "song" ? row.performers.trim() || common : "",
        }));
        setError("");
        setRows(nextRows);
        const resolved = db ? await resolveRows(nextRows) : nextRows;
        setRows(resolved);
        setEditingRowId(null);
        setViewMode("review");
    };

    const insertMemoText = (value: string) => {
        const textarea = memoTextareaRef.current;
        if (!textarea) {
            setMemo((current) => `${current}${value}`);
            return;
        }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const next = `${memo.slice(0, start)}${value}${memo.slice(end)}`;
        setMemo(next);
        window.requestAnimationFrame(() => {
            textarea.focus();
            const cursor = start + value.length;
            textarea.setSelectionRange(cursor, cursor);
        });
    };

    const selectPerformerCandidate = (
        id: string,
        performerName: string,
        value: string,
    ) => {
        const selected = parsePerformerCandidateValue(value);
        if (!selected) return;
        setRows((current) =>
            current.map((row) => {
                if (row.id !== id) return row;
                const performerNames = splitPerformerNames(row.performers);
                const nextPerformerNames = performerNames.map((name) =>
                    name === performerName ? selected.value : name,
                );
                const existingResolved = row.performerResolved.find(
                    (performer) => performer.performerName === performerName,
                );
                const nextResolved = row.performerResolved.some(
                    (performer) => performer.performerName === performerName,
                )
                    ? row.performerResolved.map((performer) =>
                          performer.performerName === performerName
                              ? {
                                    performerName: selected.value,
                                    personId: selected.personId,
                                    groupId: selected.groupId,
                                }
                              : performer,
                      )
                    : [
                          ...row.performerResolved,
                          {
                              performerName: selected.value,
                              personId: selected.personId,
                              groupId: selected.groupId,
                          },
                      ];
                const hasUnresolvedPerformer =
                    nextResolved.some(
                        (performer) =>
                            performer.personId === null && performer.groupId === null,
                    ) && nextPerformerNames.length > 0;
                return {
                    ...row,
                    performers:
                        nextPerformerNames.length > 0
                            ? nextPerformerNames.join("・")
                            : selected.value,
                    reviewConfirmed: true,
                    performerResolved: existingResolved
                        ? nextResolved
                        : nextResolved.filter(
                              (performer, index, array) =>
                                  array.findIndex(
                                      (item) =>
                                          item.performerName === performer.performerName,
                                  ) === index,
                          ),
                    resolveStatus:
                        row.songId || row.songVersionId
                            ? hasUnresolvedPerformer || row.songCandidates.length > 1
                                ? "candidate"
                                : "matched"
                            : row.resolveStatus,
                };
            }),
        );
    };

    const moveRow = (fromIndex: number, toIndex: number) => {
        setRows((current) => {
            if (
                fromIndex < 0 ||
                toIndex < 0 ||
                fromIndex >= current.length ||
                toIndex >= current.length
            ) {
                return current;
            }
            const next = [...current];
            const [moved] = next.splice(fromIndex, 1);
            if (!moved) return current;
            next.splice(toIndex, 0, moved);
            return next;
        });
    };

    const startTouchReorder = (
        event: PointerEvent<HTMLElement>,
        index: number,
    ) => {
        if (event.pointerType === "mouse") return;
        const row = rows[index];
        if (!row) return;
        const sourceRow = event.currentTarget.closest("[data-setlist-row-index]");
        const sourceRect =
            sourceRow instanceof HTMLElement
                ? sourceRow.getBoundingClientRect()
                : null;
        touchDragRef.current = {
            pointerId: event.pointerId,
            rowId: row.id,
            currentIndex: index,
            moved: false,
        };
        setDraggingRowIndex(index);
        setTouchDragPreview({
            rowId: row.id,
            x: event.clientX,
            y: event.clientY,
            offsetX: sourceRect ? event.clientX - sourceRect.left : 24,
            width: sourceRect?.width ?? Math.max(window.innerWidth - 24, 280),
        });
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    };

    const updateTouchReorder = (event: PointerEvent<HTMLElement>) => {
        const drag = touchDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        setTouchDragPreview((current) => ({
            rowId: drag.rowId,
            x: event.clientX,
            y: event.clientY,
            offsetX: current?.offsetX ?? 24,
            width: current?.width ?? Math.max(window.innerWidth - 24, 280),
        }));
        const target = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest("[data-setlist-row-index]");
        if (!(target instanceof HTMLElement)) return;
        const nextIndex = Number(target.dataset.setlistRowIndex);
        if (!Number.isInteger(nextIndex) || nextIndex === drag.currentIndex) return;
        moveRow(drag.currentIndex, nextIndex);
        drag.currentIndex = nextIndex;
        setDraggingRowIndex(nextIndex);
        drag.moved = true;
        suppressRowClickRef.current = true;
        event.preventDefault();
    };

    const endTouchReorder = (event: PointerEvent<HTMLElement>) => {
        const drag = touchDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (drag.moved) {
            suppressRowClickRef.current = true;
            window.setTimeout(() => {
                suppressRowClickRef.current = false;
            }, 0);
        }
        touchDragRef.current = null;
        setDraggingRowIndex(null);
        setTouchDragPreview(null);
    };

    const deleteRow = (id: string) => {
        setRows((current) => {
            if (current.length <= 1) return current;
            const next = current.filter((row) => row.id !== id);
            if (editingRowId === id) setEditingRowId(next[0]?.id ?? null);
            return next;
        });
    };

    const resolveSingleRow = (row: DraftRow) => {
        void resolveRows([
            {
                ...row,
                songName: row.songName.trim(),
                performers: row.performers.trim(),
            },
        ]);
    };

    const submit = async () => {
        const safeRows = getSubmittedRows(rows);
        if (safeRows.length === 0) {
            setError("曲名を1曲以上入力してください。");
            return;
        }
        setSubmitting(true);
        setError("");
        setMessage("");
        setCopyMessage("");
        try {
            const resolvedRows = db ? await resolveRows(safeRows) : safeRows;
            let musicOrder = 0;
            const result = await submitSetlistSubmission({
                submitterName: submitterName.trim(),
                eventName: target.eventName,
                stageDate: target.stageDate,
                startTime: target.startTime ?? "",
                venueName: target.venueName,
                pattern: target.pattern ?? "",
                stageId: target.stageId,
                eventId: target.eventId,
                pageUrl: typeof window === "undefined" ? "" : window.location.href,
                entries: resolvedRows.map((row, index) => {
                    const isMc = row.kind === "mc";
                    if (!isMc) musicOrder += 1;
                    return {
                        lineOrder: index + 1,
                        musicOrder: isMc ? null : musicOrder,
                        section: row.section,
                        displayName: row.songName,
                        isMc,
                        isMedley: row.inMedley,
                        note: row.note,
                        songName: row.songName,
                        songId: isMc ? null : row.songId,
                        songVersionId: isMc ? null : row.songVersionId,
                        artistName: isMc ? "" : row.songArtistName,
                        performers: isMc ? "" : row.performers,
                        performersNormalized: isMc ? [] : row.performerResolved,
                    };
                }),
            });
            setSuccessText(buildSubmissionResultText(target, result.id, resolvedRows));
            setMessage(`送信しました。投稿ID: ${result.id}`);
            setEditingRowId(null);
            setViewMode("success");
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSubmitting(false);
        }
    };

    const copySuccessText = async () => {
        if (!successText.trim()) return;
        try {
            await copyTextToClipboard(successText);
            setCopyMessage("コピーしました");
        } catch {
            setCopyMessage("コピーに失敗しました");
        }
    };

    const filledRows = getSubmittedRows(rows);
    const filledMusicRows = filledRows.filter((row) => row.kind === "song");
    const needsReviewRows = filledRows.filter(
        (row) =>
            row.kind === "song" &&
            (row.resolveStatus === "candidate" || row.resolveStatus === "unresolved"),
    );
    const selectedRow = editingRowId
        ? rows.find((row) => row.id === editingRowId) ?? null
        : null;
    const selectedIndex = selectedRow
        ? rows.findIndex((row) => row.id === selectedRow.id)
        : -1;
    const touchDragRow = touchDragPreview
        ? rows.find((row) => row.id === touchDragPreview.rowId) ?? null
        : null;
    const touchDragViewportWidth =
        typeof window === "undefined"
            ? (touchDragPreview?.width ?? 0) + 24
            : window.innerWidth;

    const hasInput =
        viewMode === "input" &&
        (memo.trim().length > 0 ||
            rows.length > 1 ||
            rows.some((row) => row.songName.trim() || row.performers.trim()));
    const handleClose = () => {
        if (!hasInput || window.confirm("入力内容が破棄されます。閉じますか？")) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-[120] flex items-start bg-slate-950/45 p-2 pt-3 sm:justify-center"
            onClick={handleClose}
        >
            <div
                className="flex max-h-[calc(100svh-1rem)] w-full flex-col overflow-hidden rounded-[1.75rem] bg-slate-50 shadow-[0_-20px_80px_rgba(15,23,42,0.28)] sm:max-h-[97vh] sm:max-w-5xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-3 backdrop-blur sm:px-5">
                    <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                            <h2 className="text-base font-black leading-tight text-slate-950">
                                {viewMode === "input"
                                    ? "セトリを投稿"
                                    : viewMode === "success"
                                      ? "送信完了"
                                      : "投稿内容を確認"}
                            </h2>
                            <p className="whitespace-normal break-words text-sm leading-5 text-slate-500">
                                {stageLabel}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600 hover:bg-slate-200"
                            aria-label="閉じる"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {viewMode === "input" ? (
                    <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-5">
                        <div className="mx-auto max-w-2xl space-y-3">
                            <label className="block rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                                <span className="text-sm font-bold text-slate-900">
                                    1行ずつ曲を入力
                                </span>
                                <textarea
                                    ref={memoTextareaRef}
                                    value={memo}
                                    onChange={(event) => setMemo(event.target.value)}
                                    aria-label="1行ずつ曲を入力"
                                    className="mt-2 h-56 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-100"
                                    placeholder={"1行に1曲ずつ入力\n曲名 / 歌唱者\n曲名\n\nEN より下の行はアンコール扱い\n>>> でメドレー開始\n<<< でメドレー終了"}
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => insertMemoText(" / ")}
                                        className="h-8 rounded-full bg-slate-950 px-3 text-xs font-black text-white active:scale-[0.98]"
                                    >
                                        歌唱者
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMemoText("\nEN")}
                                        className="h-8 rounded-full bg-white px-3 text-xs font-black text-slate-800 ring-1 ring-slate-200 active:scale-[0.98]"
                                    >
                                        EN
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMemoText("\n>>>\n")}
                                        className="h-8 rounded-full bg-white px-3 text-xs font-black text-slate-800 ring-1 ring-slate-200 active:scale-[0.98]"
                                    >
                                        メドレー開始
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMemoText("\n<<<\n")}
                                        className="h-8 rounded-full bg-white px-3 text-xs font-black text-slate-800 ring-1 ring-slate-200 active:scale-[0.98]"
                                    >
                                        メドレー終了
                                    </button>
                                </div>
                            </label>

                            <label className="block rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                                <span className="text-sm font-bold text-slate-900">
                                    歌唱者を一括入力
                                </span>
                                <input
                                    value={commonPerformers}
                                    onChange={(event) =>
                                        setCommonPerformers(event.target.value)
                                    }
                                    className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                                    placeholder="全曲共通の歌唱者"
                                />
                            </label>
                        </div>
                    </div>
                ) : viewMode === "success" ? (
                    <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
                        <div className="mx-auto max-w-2xl space-y-3">
                            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                                <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-700">
                                    SENT
                                </p>
                                <h3 className="mt-1 text-lg font-black text-slate-950">
                                    送信しました
                                </h3>
                            </div>
                            <label className="block rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                                <span className="text-sm font-bold text-slate-900">
                                    送信結果
                                </span>
                                <textarea
                                    readOnly
                                    value={successText}
                                    className="mt-2 h-64 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-5 text-slate-950 outline-none"
                                    aria-label="送信結果"
                                />
                            </label>
                        </div>
                    </div>
                ) : (
                    <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_320px]">
                        <div
                            className={`min-h-0 overflow-y-auto px-3 py-3 sm:px-4 ${
                                selectedRow ? "hidden md:block" : ""
                            }`}
                        >
                            <div className="mb-2 flex items-end justify-between gap-2">
                                <div>
                                    <h3 className="text-base font-black text-slate-950">
                                        確認
                                    </h3>
                                    <p className="text-xs font-semibold text-slate-500">
                                        {filledMusicRows.length}曲 / {filledRows.length}行
                                        {needsReviewRows.length > 0
                                            ? ` / 要確認 ${needsReviewRows.length}件`
                                            : ""}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const row = createRow();
                                            setRows((current) => [...current, row]);
                                            setEditingRowId(row.id);
                                        }}
                                        className="h-8 rounded-full bg-white px-3 text-xs font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 active:scale-[0.98]"
                                    >
                                        曲追加
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                                {rows.map((row, index) => {
                                    const active = row.id === editingRowId;
                                    return (
                                        <div
                                            key={row.id}
                                            data-setlist-row-index={index}
                                            draggable
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => {
                                                if (suppressRowClickRef.current) return;
                                                setEditingRowId(row.id);
                                            }}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === "Enter" ||
                                                    event.key === " "
                                                ) {
                                                    event.preventDefault();
                                                    setEditingRowId(row.id);
                                                }
                                            }}
                                            onDragStart={(event) => {
                                                setDraggingRowIndex(index);
                                                if (event.dataTransfer) {
                                                    event.dataTransfer.effectAllowed = "move";
                                                }
                                            }}
                                            onDragEnd={() => setDraggingRowIndex(null)}
                                            onDragOver={(event) => event.preventDefault()}
                                            onDrop={() => {
                                                if (draggingRowIndex === null) return;
                                                moveRow(draggingRowIndex, index);
                                                setDraggingRowIndex(null);
                                            }}
                                            className={`grid w-full cursor-grab grid-cols-[2.5rem_minmax(0,1fr)_5.2rem] items-center gap-2 border-b border-slate-100 px-2 py-2 text-left active:cursor-grabbing last:border-b-0 ${
                                                draggingRowIndex === index
                                                    ? "bg-red-50 opacity-45 ring-2 ring-red-200"
                                                    : active
                                                      ? "bg-slate-100"
                                                      : "bg-white"
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                className={`flex h-9 w-9 touch-none select-none flex-col items-center justify-center rounded-xl border text-[10px] font-black tabular-nums transition active:scale-95 ${
                                                    draggingRowIndex === index
                                                        ? "border-red-300 bg-white text-red-700"
                                                        : "border-slate-200 bg-slate-50 text-slate-500"
                                                }`}
                                                onPointerDown={(event) =>
                                                    startTouchReorder(event, index)
                                                }
                                                onPointerMove={updateTouchReorder}
                                                onPointerUp={endTouchReorder}
                                                onPointerCancel={endTouchReorder}
                                                onClick={(event) => event.stopPropagation()}
                                                aria-label={`${index + 1}行目をドラッグして並び替え`}
                                                title="ドラッグして並び替え"
                                            >
                                                <span className="leading-none">{index + 1}</span>
                                                <span className="mt-0.5 grid grid-cols-2 gap-[2px]" aria-hidden="true">
                                                    <span className="h-0.5 w-0.5 rounded-full bg-current" />
                                                    <span className="h-0.5 w-0.5 rounded-full bg-current" />
                                                    <span className="h-0.5 w-0.5 rounded-full bg-current" />
                                                    <span className="h-0.5 w-0.5 rounded-full bg-current" />
                                                </span>
                                            </button>
                                            <span className="min-w-0">
                                                <span className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
                                                    <span className="min-w-0 truncate text-sm font-bold text-slate-950">
                                                        {row.kind === "mc"
                                                            ? row.note.trim() || "MC"
                                                            : row.versionName ||
                                                              row.songName.trim() ||
                                                              "曲名未入力"}
                                                    </span>
                                                    {row.kind === "song" &&
                                                    row.songArtistName ? (
                                                        <span className="shrink-0 truncate text-xs font-bold text-slate-500">
                                                            / {row.songArtistName}
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span className="block truncate text-[11px] font-semibold text-slate-400">
                                                    {row.inMedley ? (
                                                        <span className="mr-1 inline-flex h-4 items-center rounded-full bg-purple-100 px-1.5 text-[10px] font-black text-purple-700">
                                                            M
                                                        </span>
                                                    ) : null}
                                                    {row.section.trim() || DEFAULT_SECTION}
                                                    {row.kind === "song" ? (
                                                        <>
                                                            {" "}
                                                            {row.performers.trim() ? (
                                                                <>
                                                                    <svg className="mr-0.5 inline-block h-3 w-3 align-[-1px] text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                                                                        <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
                                                                        <line x1="12" y1="19" x2="12" y2="22"/>
                                                                    </svg>
                                                                    {row.performers.trim()}
                                                                </>
                                                            ) : (
                                                                "歌唱者なし"
                                                            )}
                                                            {row.note.trim() ? ` / ${row.note.trim()}` : ""}
                                                        </>
                                                    ) : null}
                                                </span>
                                            </span>
                                            <span
                                                className={`justify-self-end rounded-full px-2 py-1 text-[11px] font-bold ${getStatusClassName(row)}`}
                                            >
                                                {getStatusLabel(row)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <label className="mt-3 block rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                                <span className="text-sm font-bold text-slate-900">
                                    投稿者名（任意）
                                </span>
                                <input
                                    value={submitterName}
                                    onChange={(event) =>
                                        setSubmitterName(event.target.value)
                                    }
                                    className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                                    maxLength={80}
                                    placeholder="お名前、ハンドルネームなど"
                                />
                            </label>
                        </div>
                        <div
                            className={
                                selectedRow
                                    ? "min-h-0 overflow-y-auto bg-white px-3 py-3 md:border-l md:border-slate-200"
                                    : "hidden min-h-0 border-l border-slate-200 bg-white p-3 md:block"
                            }
                        >
                            {selectedRow ? (
                                <>
                                    <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-500">
                                                {selectedIndex + 1} / {rows.length}
                                            </p>
                                            <h3 className="text-base font-black text-slate-950">
                                                詳細
                                            </h3>
                                        </div>
                                        <span
                                            className={`rounded-full px-2 py-1 text-[11px] font-bold ${getStatusClassName(selectedRow)}`}
                                        >
                                            {getStatusLabel(selectedRow)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setEditingRowId(null)}
                                            className="h-9 rounded-xl bg-slate-100 px-4 text-xs font-black text-slate-800"
                                        >
                                            一覧へ戻る
                                        </button>
                                    </div>
                                    <RowEditor
                                        row={selectedRow}
                                        rowIndex={selectedIndex}
                                        rowCount={rows.length}
                                        onChange={(patch) =>
                                            updateRow(selectedRow.id, patch)
                                        }
                                        onSelectPerformer={(performerName, value) =>
                                            selectPerformerCandidate(
                                                selectedRow.id,
                                                performerName,
                                                value,
                                            )
                                        }
                                        onResolve={() => resolveSingleRow(selectedRow)}
                                        onReviewConfirmedChange={(confirmed) =>
                                            updateRow(selectedRow.id, {
                                                reviewConfirmed: confirmed,
                                                resolveStatus: confirmed
                                                    ? "matched"
                                                    : selectedRow.songId ||
                                                        selectedRow.songVersionId
                                                      ? "candidate"
                                                      : "unresolved",
                                            })
                                        }
                                        resolving={resolving}
                                        canResolve={Boolean(db)}
                                        onDelete={() => deleteRow(selectedRow.id)}
                                        db={db}
                                    />
                                </>
                            ) : (
                                <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 p-4 text-center text-xs font-bold leading-5 text-slate-500">
                                    一覧から曲を選択
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {touchDragPreview && touchDragRow ? (
                    <div
                        className="pointer-events-none fixed z-[160] grid grid-cols-[2.5rem_minmax(0,1fr)_5.2rem] items-center gap-2 rounded-2xl bg-white px-2 py-2 text-left shadow-[0_18px_46px_rgba(15,23,42,0.32)] ring-2 ring-red-300 md:hidden"
                        style={{
                            left: Math.min(
                                Math.max(12, touchDragPreview.x - touchDragPreview.offsetX),
                                Math.max(
                                    12,
                                    touchDragViewportWidth - touchDragPreview.width - 12,
                                ),
                            ),
                            top: touchDragPreview.y,
                            width: touchDragPreview.width,
                            transform: "translateY(-50%) scale(1.015)",
                        }}
                    >
                        <span className="flex h-9 w-9 select-none flex-col items-center justify-center rounded-xl border border-red-300 bg-red-50 text-[10px] font-black tabular-nums text-red-700">
                            {draggingRowIndex !== null ? draggingRowIndex + 1 : ""}
                            <span className="mt-0.5 grid grid-cols-2 gap-[2px]" aria-hidden="true">
                                <span className="h-0.5 w-0.5 rounded-full bg-current" />
                                <span className="h-0.5 w-0.5 rounded-full bg-current" />
                                <span className="h-0.5 w-0.5 rounded-full bg-current" />
                                <span className="h-0.5 w-0.5 rounded-full bg-current" />
                            </span>
                        </span>
                        <span className="min-w-0">
                            <span className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
                                <span className="min-w-0 truncate text-sm font-bold text-slate-950">
                                    {touchDragRow.kind === "mc"
                                        ? touchDragRow.note.trim() || "MC"
                                        : touchDragRow.versionName ||
                                          touchDragRow.songName.trim() ||
                                          "曲名未入力"}
                                </span>
                                {touchDragRow.kind === "song" &&
                                touchDragRow.songArtistName ? (
                                    <span className="shrink-0 truncate text-xs font-bold text-slate-500">
                                        / {touchDragRow.songArtistName}
                                    </span>
                                ) : null}
                            </span>
                            <span className="block truncate text-[11px] font-semibold text-slate-400">
                                {touchDragRow.section.trim() || DEFAULT_SECTION}
                                {touchDragRow.kind === "song" && touchDragRow.performers.trim()
                                    ? ` ${touchDragRow.performers.trim()}`
                                    : ""}
                            </span>
                        </span>
                        <span
                            className={`justify-self-end rounded-full px-2 py-1 text-[11px] font-bold ${getStatusClassName(touchDragRow)}`}
                        >
                            {getStatusLabel(touchDragRow)}
                        </span>
                    </div>
                ) : null}

                <div className="space-y-2 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:px-5">
                    {error ? (
                        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                            {error}
                        </p>
                    ) : null}
                    {message ? (
                        <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                            {message}
                        </p>
                    ) : null}
                    {copyMessage ? (
                        <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                            {copyMessage}
                        </p>
                    ) : null}
                    {viewMode === "review" && needsReviewRows.length > 0 ? (
                        <p className="text-xs font-bold text-amber-800">
                            要確認が{needsReviewRows.length}件あります
                        </p>
                    ) : null}
                    <div className="flex justify-center gap-2">
                        {viewMode === "review" ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setViewMode("input");
                                    setEditingRowId(null);
                                }}
                                className="h-12 rounded-2xl bg-white px-4 text-sm font-black text-slate-800 ring-1 ring-slate-200 active:scale-[0.99]"
                            >
                                戻る
                            </button>
                        ) : null}
                        {viewMode === "success" ? (
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-12 rounded-2xl bg-white px-4 text-sm font-black text-slate-800 ring-1 ring-slate-200 active:scale-[0.99]"
                            >
                                閉じる
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => {
                                if (viewMode === "input") {
                                    void openReview();
                                } else if (viewMode === "success") {
                                    void copySuccessText();
                                } else {
                                    void submit();
                                }
                            }}
                            disabled={
                                submitting ||
                                resolving ||
                                (viewMode === "review" && Boolean(message))
                            }
                            className="h-12 rounded-2xl bg-red-600 px-5 text-sm font-black text-white shadow-lg shadow-red-600/20 active:scale-[0.99] disabled:bg-slate-300 disabled:shadow-none"
                        >
                            {viewMode === "input"
                                ? resolving
                                    ? "確認中..."
                                    : "次へ"
                                : viewMode === "success"
                                  ? "結果をコピー"
                                : submitting
                                  ? "送信中..."
                                  : resolving
                                    ? "候補を確認中..."
                                    : "この内容で投稿"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function RowEditor({
    row,
    rowIndex,
    rowCount,
    onChange,
    onSelectPerformer,
    onResolve,
    onReviewConfirmedChange,
    resolving,
    canResolve,
    onDelete,
    db,
}: {
    row: DraftRow;
    rowIndex: number;
    rowCount: number;
    onChange: (patch: Partial<DraftRow>) => void;
    onSelectPerformer: (performerName: string, value: string) => void;
    onResolve: () => void;
    onReviewConfirmedChange: (confirmed: boolean) => void;
    resolving: boolean;
    canResolve: boolean;
    onDelete: () => void;
    db?: SetlistSearchDb | null;
}) {
    const selectedCandidate =
        row.songVersionId !== null
            ? `version:${row.songVersionId}`
            : row.songId !== null
              ? `song:${row.songId}`
              : "";
    const performerNames = splitPerformerNames(row.performers);
    const performerTotal = performerNames.length;
    const performerResolvedCount = row.performerResolved.filter(
        (performer) => performer.personId !== null || performer.groupId !== null,
    ).length;
    const isMc = row.kind === "mc";

    const [songCandidatesOn, setSongCandidatesOn] = useState(true);
    const [songIsFocused, setSongIsFocused] = useState(false);
    const [songIsOpen, setSongIsOpen] = useState(false);
    const songBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const songDismissedRef = useRef(false);
    const songAppliedRef = useRef<string | null>(null);
    const [songLiveCandidates, setSongLiveCandidates] = useState<SongLookupCandidate[]>([]);
    const songTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!db || isMc) return;
        const term = row.songName.trim();
        if (!term || !songIsFocused) return;
        if (songAppliedRef.current === term) {
            songAppliedRef.current = null;
            return;
        }
        if (songTimerRef.current) clearTimeout(songTimerRef.current);
        songTimerRef.current = setTimeout(() => {
            void searchSongLookupCandidates(db, term).then(({ candidates }) => {
                const seen = new Set<string>();
                const deduped = candidates.filter((c) => {
                    const key = getCandidateLabel(c);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                setSongLiveCandidates(deduped);
                if (deduped.length > 0) setSongIsOpen(true);
            });
        }, 150);
        return () => {
            if (songTimerRef.current) clearTimeout(songTimerRef.current);
        };
    }, [row.songName, db, isMc, songIsFocused]);

    const effectiveSongCandidates =
        songLiveCandidates.length > 0 ? songLiveCandidates : row.songCandidates;

    const [liveCandidates, setLiveCandidates] = useState<
        Record<string, PerformerLookupCandidate[]>
    >({});
    const [candidatesOn, setCandidatesOn] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const groupsRef = useRef<Map<string, number> | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dismissedRef = useRef<string | null>(null);
    const appliedFlagRef = useRef(false);

    const searchPerformers = async (names: string[]) => {
        if (!db) return;
        if (!groupsRef.current) {
            groupsRef.current = await buildGroupKeyMap(db);
        }
        const result: Record<string, PerformerLookupCandidate[]> = {};
        await Promise.all(
            names.map(async (name) => {
                result[name] = await searchPerformerLookupCandidates(
                    db,
                    name,
                    groupsRef.current!,
                );
            }),
        );
        setLiveCandidates(result);
    };

    useEffect(() => {
        if (!db || isMc || !candidatesOn) return;
        const value = row.performers.trim();
        if (!value || !isFocused) return;
        if (appliedFlagRef.current) {
            appliedFlagRef.current = false;
            return;
        }
        if (dismissedRef.current === value) return;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            const names = splitPerformerNames(row.performers);
            if (names.length === 0 || dismissedRef.current === value) return;
            void searchPerformers(names).then(() => {
                setIsOpen(true);
            });
        }, 150);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row.performers, db, isMc, candidatesOn, isFocused]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        };
    }, []);

    const effectiveCandidates: Record<string, PerformerLookupCandidate[]> =
        Object.keys(liveCandidates).length > 0 ? liveCandidates : row.performerCandidates;

    const displayPerformerCandidates = performerNames
        .map((performerName) => ({
            performerName,
            candidates: effectiveCandidates[performerName] ?? [],
        }))
        .filter((group) => group.candidates.length > 0);

    const closeDropdown = () => {
        dismissedRef.current = row.performers.trim();
        setIsOpen(false);
    };

    const handleBlur = () => {
        setIsFocused(false);
        blurTimerRef.current = setTimeout(() => {
            setIsOpen(false);
            setLiveCandidates({});
        }, 200);
    };

    const handleFocus = () => {
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        setIsFocused(true);
        dismissedRef.current = null;
        appliedFlagRef.current = false;
    };

    return (
        <div className="space-y-3">
            <div className="hidden items-center justify-between gap-2 md:flex">
                <div>
                    <p className="text-xs font-bold text-slate-500">
                        {rowIndex + 1} / {rowCount}
                    </p>
                    <h3 className="text-base font-black text-slate-950">詳細</h3>
                </div>
                <span
                    className={`rounded-full px-2 py-1 text-[11px] font-bold ${getStatusClassName(row)}`}
                >
                    {getStatusLabel(row)}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <label>
                    <span className="mb-1 block text-xs font-bold text-slate-600">
                        種別
                    </span>
                    <select
                        value={row.kind}
                        onChange={(event) => {
                            const kind = event.target.value as DraftRowKind;
                            onChange({
                                kind,
                                songName:
                                    kind === "mc" ? row.songName.trim() || "MC" : row.songName,
                                performers: kind === "mc" ? "" : row.performers,
                            });
                        }}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    >
                        <option value="song">曲</option>
                        <option value="mc">MC</option>
                    </select>
                </label>
                <label>
                    <span className="mb-1 block text-xs font-bold text-slate-600">
                        セクション
                    </span>
                    <input
                        list={`section-options-${row.id}`}
                        value={row.section}
                        onChange={(event) => onChange({ section: event.target.value })}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                        placeholder="本編"
                    />
                    <datalist id={`section-options-${row.id}`}>
                        {SECTION_OPTIONS.map((section) => (
                            <option key={section} value={section} />
                        ))}
                    </datalist>
                </label>
            </div>

            <label className="relative block">
                <span className="mb-1 block text-xs font-bold text-slate-600">
                    {isMc ? "表示名" : "曲名"}
                </span>
                <div className="relative">
                    <input
                        value={row.songName}
                        onChange={(event) => {
                            songDismissedRef.current = false;
                            songAppliedRef.current = null;
                            onChange({ songName: event.target.value });
                        }}
                        onFocus={() => {
                            if (songBlurTimerRef.current) clearTimeout(songBlurTimerRef.current);
                            setSongIsFocused(true);
                            songDismissedRef.current = false;
                            songAppliedRef.current = null;
                        }}
                        onBlur={() => {
                            setSongIsFocused(false);
                            songBlurTimerRef.current = setTimeout(() => {
                                setSongIsOpen(false);
                                setSongLiveCandidates([]);
                            }, 200);
                        }}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-16 text-sm font-semibold text-slate-950 outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                        placeholder={isMc ? "MC" : "曲名"}
                    />
                    {!isMc ? (
                        <>
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                setSongCandidatesOn((prev) => {
                                    const next = !prev;
                                    if (!next) setSongIsOpen(false);
                                    else songDismissedRef.current = false;
                                    return next;
                                });
                            }}
                            aria-label={songCandidatesOn ? "候補をOFFにする" : "候補をONにする"}
                            aria-pressed={songCandidatesOn}
                            title={songCandidatesOn ? "候補をOFFにする" : "候補をONにする"}
                            className={`absolute right-8 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-transparent transition-colors ${
                                songCandidatesOn
                                    ? "text-amber-600 hover:bg-amber-50"
                                    : "text-slate-400 hover:bg-slate-100"
                            }`}
                        >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/>
                                <path d="M9 21h6"/>
                                <path d="M10 15h4"/>
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                songDismissedRef.current = true;
                                setSongIsOpen(false);
                                setSongLiveCandidates([]);
                                onChange({ songName: "" });
                            }}
                            disabled={!row.songName}
                            aria-label="入力をクリア"
                            title="入力をクリア"
                            className="absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-transparent text-slate-500 disabled:pointer-events-none disabled:opacity-30"
                        >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        </>
                    ) : null}
                </div>
                {!isMc && songCandidatesOn && songIsOpen && effectiveSongCandidates.length > 0 ? (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                        <div className="flex justify-end border-b border-slate-200 px-1 py-0.5">
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    songDismissedRef.current = true;
                                    setSongIsOpen(false);
                                }}
                                className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="候補を閉じる"
                                title="候補を閉じる"
                            >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1 p-2">
                            {effectiveSongCandidates.slice(0, 8).map((candidate) => {
                                const key = candidateValue(candidate);
                                const isSongSelected = key === selectedCandidate;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            songAppliedRef.current = candidate.songName;
                                            onChange({
                                                songName: candidate.songName,
                                                songId: candidate.songId,
                                                songVersionId: candidate.songVersionId,
                                                versionName: candidate.versionName,
                                                songArtistId: candidate.artistId,
                                                songArtistName: candidate.artistName,
                                                songCandidates: effectiveSongCandidates,
                                                reviewConfirmed: true,
                                                resolveStatus: "matched" as const,
                                            });
                                            songDismissedRef.current = true;
                                            setSongIsOpen(false);
                                        }}
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition active:scale-[0.97] ${
                                            isSongSelected
                                                ? "bg-emerald-600 text-white"
                                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                        }`}
                                    >
                                        {getCandidateLabel(candidate)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </label>

            {!isMc ? (
                <div>
                    <span className="mb-1 block text-xs font-bold text-slate-600">
                        アーティスト
                    </span>
                    <span className="flex h-10 items-center rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-700">
                        {row.songArtistName || "-"}
                    </span>
                </div>
            ) : null}

            {isMc ? null : (
                <label className="relative block">
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">
                        歌唱者
                        {performerTotal > 0 ? (
                            <span className="ml-2 text-slate-400">
                                {performerResolvedCount}/{performerTotal}
                            </span>
                        ) : null}
                    </span>
                </div>
                <div className="relative">
                    <input
                        value={row.performers}
                        onChange={(event) => {
                            dismissedRef.current = null;
                            appliedFlagRef.current = false;
                            onChange({ performers: event.target.value });
                        }}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-16 text-sm text-slate-950 outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                        placeholder="歌唱者（任意）"
                    />
                    {db ? (
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                setCandidatesOn((prev) => {
                                    const next = !prev;
                                    if (!next) {
                                        setIsOpen(false);
                                        setLiveCandidates({});
                                    } else {
                                        dismissedRef.current = null;
                                    }
                                    return next;
                                });
                            }}
                            aria-label={candidatesOn ? "候補をOFFにする" : "候補をONにする"}
                            aria-pressed={candidatesOn}
                            title={candidatesOn ? "候補をOFFにする" : "候補をONにする"}
                            className={`absolute right-8 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-transparent transition-colors ${
                                candidatesOn
                                    ? "text-amber-600 hover:bg-amber-50"
                                    : "text-slate-400 hover:bg-slate-100"
                            }`}
                        >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/>
                                <path d="M9 21h6"/>
                                <path d="M10 15h4"/>
                            </svg>
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => {
                            dismissedRef.current = "";
                            setIsOpen(false);
                            setLiveCandidates({});
                            onChange({ performers: "" });
                        }}
                        disabled={!row.performers}
                        aria-label="入力をクリア"
                        title="入力をクリア"
                        className="absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-transparent text-slate-500 disabled:pointer-events-none disabled:opacity-30"
                    >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                {candidatesOn && isOpen && displayPerformerCandidates.length > 0 ? (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                        <div className="flex justify-end border-b border-slate-200 px-1 py-0.5">
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={closeDropdown}
                                className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="候補を閉じる"
                                title="候補を閉じる"
                            >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-2">
                            {displayPerformerCandidates.map(({ performerName, candidates }) => (
                                <div key={performerName} className="mb-2 last:mb-0">
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {performerName}
                                    </span>
                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                        {candidates.slice(0, 8).map((candidate) => {
                                            const isSelected = row.performerResolved.some(
                                                (p) =>
                                                    p.performerName === candidate.value &&
                                                    p.personId === candidate.personId &&
                                                    p.groupId === candidate.groupId,
                                            );
                                            return (
                                                <button
                                                    key={performerCandidateValue(candidate)}
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        onSelectPerformer(
                                                            performerName,
                                                            performerCandidateValue(candidate),
                                                        );
                                                        appliedFlagRef.current = true;
                                                        setIsOpen(false);
                                                    }}
                                                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition active:scale-[0.97] ${
                                                        isSelected
                                                            ? "bg-emerald-600 text-white"
                                                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                                    }`}
                                                >
                                                    {getPerformerCandidateLabel(candidate)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                </label>
            )}

            <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">備考</span>
                <textarea
                    value={row.note}
                    onChange={(event) => onChange({ note: event.target.value })}
                    className="h-20 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                    placeholder={isMc ? "MCの内容など" : "補足があれば入力"}
                />
            </label>

            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={onResolve}
                    disabled={isMc || !canResolve || resolving}
                    className="h-9 rounded-xl bg-slate-950 text-xs font-black text-white disabled:bg-slate-300"
                >
                    {resolving ? "確認中..." : "再確認"}
                </button>
                <button
                    type="button"
                    onClick={() => onReviewConfirmedChange(!row.reviewConfirmed)}
                    disabled={isMc}
                    className={`h-9 rounded-xl text-xs font-black disabled:bg-slate-100 disabled:text-slate-300 ${
                        row.reviewConfirmed
                            ? "bg-amber-50 text-amber-800"
                            : "bg-emerald-700 text-white"
                    }`}
                >
                    {row.reviewConfirmed ? "要確認に戻す" : "確認済みにする"}
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={rowCount <= 1}
                    className="col-span-2 h-9 rounded-xl bg-rose-50 text-xs font-black text-rose-700 disabled:text-rose-200"
                >
                    削除
                </button>
            </div>
        </div>
    );
}
