import { formatDateYmd, formatTimeHm } from "../../lib/uiFormat";

import type {
    DisplayKrnLine,
    InlineAffixStyle,
    KrnEntry,
    KrnLine,
    OutputOptions,
    ParsePerformerDelimiter,
    PerformerDelimiter,
} from "./krnTypes";

export const KRN_NOTE_EMPTY = "-";

const ORDER_START = 1;
const ORDER_PADDING = 2;
const ENTRY_PREFIX_PATTERN = /^[\s♪♬・●○◯◎■□▪▫◆◇▶▷▸▹\-ー‐‑‒–—―*＊]+/u;
const ENTRY_ORDER_PATTERN =
    /^\s*(?:\d{1,3}|[０-９]{1,3})(?:\s*[.．:：\-－)]|\s+|曲目\s*)\s*/u;
const SECTION_HEADER_PATTERN =
    /^(?:encore|en\.?|アンコール|本編|wencore|double\s+encore|メドレー|medley)/i;
const MC_LINE_PATTERN = /(?:^|\s)(?:mc|ＭＣ|MC_|ＭＣ_)(?:\s|$|[（(])|挨拶/u;

type ExportPayload = {
    eventName: string;
    stageDate: string;
    venueName: string;
    startTime: string;
    pattern: string;
    stageId: number | null;
    eventId: number | null;
    entries: KrnEntry[];
    outputOptions: OutputOptions;
    performerDelimiter: PerformerDelimiter;
};

export const createKrnEntry = (overrides?: Partial<KrnEntry>): KrnEntry => ({
    id: `krn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    section: "",
    songName: "",
    songId: null,
    songVersionId: null,
    songArtistId: null,
    songArtistName: "",
    isSongFreeInput: false,
    performerNames: [],
    isPerformerTextInput: false,
    note: "",
    isMc: false,
    isMedley: false,
    ...overrides,
});

export const buildEventTitleLine = (
    eventName: string,
    pattern: string,
): string => {
    const name = eventName.trim();
    const patternLabel = pattern.trim();
    if (name && patternLabel) return `${name} 【${patternLabel}】`;
    if (name) return name;
    if (patternLabel) return `【${patternLabel}】`;
    return "";
};

export const buildEventDetailLine = (
    stageDate: string,
    startTime: string,
    venueName: string,
): string => {
    const dateLabel = formatDateYmd(stageDate);
    const timeLabel = formatTimeHm(startTime);
    const venue = venueName.trim();
    const left = [dateLabel, timeLabel]
        .filter((value) => value && value !== KRN_NOTE_EMPTY)
        .join(" ");
    if (left && venue) return `${left} @${venue}`;
    if (left) return left;
    return venue;
};

const normalizeSectionHeader = (line: string): string => {
    const normalized = line
        .replace(/^【|】$/g, "")
        .replace(/^\[|\]$/g, "")
        .trim();

    if (/^encore|^en\.?|アンコール/i.test(normalized)) {
        return "EN";
    }
    if (/wencore|double\s+encore|ダブルアンコール/i.test(normalized)) {
        return "WE";
    }
    if (/メドレー|medley/i.test(normalized)) {
        return "メドレー";
    }
    if (/^本編$/i.test(normalized)) {
        return "本編";
    }
    return normalized;
};

const cleanSongLine = (line: string): string =>
    line
        .replace(ENTRY_PREFIX_PATTERN, "")
        .replace(ENTRY_ORDER_PATTERN, "")
        .replace(/\s+$/g, "")
        .trim();

export const parsePerformerNames = (value: string): string[] =>
    value
        .split(/[・/／,、]+/)
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

const parsePerformerNamesByDelimiter = (
    value: string,
    delimiter: ParsePerformerDelimiter,
): string[] => {
    const normalized = value.replace(/\u3000/g, " ").trim();
    if (!normalized) return [];
    if (delimiter === "auto") return parsePerformerNames(normalized);
    if (delimiter === "space") {
        if (!/\s+/.test(normalized)) return [];
        return normalized
            .split(/\s+/)
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
    }
    if (!normalized.includes(delimiter)) return [];
    return normalized
        .split(delimiter)
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
};

const extractSongAndPerformerText = (
    line: string,
    includePerformer: boolean,
): { songName: string; performerRaw: string } => {
    const cleaned = cleanSongLine(line);
    if (!includePerformer) return { songName: cleaned, performerRaw: "" };
    const withMatch = cleaned.match(
        /^(.*?)(?:\s*[wWｗＷ]\s*|\s+with\s+)(.+)$/i,
    );
    if (withMatch) {
        return {
            songName: cleanSongLine(withMatch[1] ?? ""),
            performerRaw: (withMatch[2] ?? "").trim(),
        };
    }
    const slashMatch = cleaned.match(/^(.*?)\s+[/／]\s+(.+)$/);
    if (slashMatch) {
        return {
            songName: cleanSongLine(slashMatch[1] ?? ""),
            performerRaw: (slashMatch[2] ?? "").trim(),
        };
    }
    return { songName: cleaned, performerRaw: "" };
};

const normalizeLeadingCircledNumber = (value: string): string => {
    if (!value) return value;
    const first = value.codePointAt(0);
    if (first === undefined) return value;
    const chars = Array.from(value);
    const toAscii = (num: number) => `${num}${chars.slice(1).join("")}`;
    if (first >= 0x2780 && first <= 0x2789) {
        return toAscii(first - 0x2780 + 1);
    }
    if (first >= 0x2776 && first <= 0x277f) {
        return toAscii(first - 0x2776 + 1);
    }
    if (first >= 0x278a && first <= 0x2793) {
        return toAscii(first - 0x278a + 1);
    }
    return value;
};

export const joinPerformerNames = (
    names: string[],
    delimiter: PerformerDelimiter,
): string =>
    names
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .join(delimiter);

export const parseRawEntries = (
    rawInput: string,
    options?: {
        includePerformer?: boolean;
        performerDelimiter?: ParsePerformerDelimiter;
    },
): KrnEntry[] => {
    const lines = rawInput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const includePerformer = options?.includePerformer ?? false;
    const performerDelimiter = options?.performerDelimiter ?? "auto";

    const contentLines = lines.filter(
        (line) => !SECTION_HEADER_PATTERN.test(line),
    );
    const allLinesStartWithOrderLikeNumber =
        contentLines.length >= 2 &&
        contentLines.every((line) =>
            /^(?:M|ｍ)?[0-9０-９]{1,3}/.test(
                normalizeLeadingCircledNumber(line.normalize("NFKC")),
            ),
        );

    let section = "";
    let fallbackOrder = 1;
    const parsed: Array<{ order: number; entry: KrnEntry }> = [];

    for (const originalLine of lines) {
        if (SECTION_HEADER_PATTERN.test(originalLine)) {
            section = normalizeSectionHeader(originalLine);
            continue;
        }

        const normalized = normalizeLeadingCircledNumber(
            originalLine.normalize("NFKC"),
        );
        const orderMatch =
            normalized.match(
                /^([0-9]{1,3})\s*(?:[.)．:：、]|曲目)\s*(.+)$/,
            ) ??
            normalized.match(/^([0-9]{1,3})\s+(.+)$/) ??
            normalized.match(
                /^M([0-9]{1,3})\s*(?:[.)．:：、]|曲目)\s*(.+)$/i,
            ) ??
            normalized.match(/^M([0-9]{1,3})\s+(.+)$/i);
        const denseOrderMatch =
            !orderMatch && allLinesStartWithOrderLikeNumber
                ? (normalized.match(/^([0-9]{1,3})(.+)$/) ??
                  normalized.match(/^M([0-9]{1,3})(.+)$/i))
                : null;

        const order = orderMatch
            ? Number(orderMatch[1])
            : denseOrderMatch
              ? Number(denseOrderMatch[1])
              : fallbackOrder;
        const body = (
            orderMatch
                ? orderMatch[2]
                : denseOrderMatch
                  ? denseOrderMatch[2]
                  : normalized
        ).trim();
        if (!body) {
            continue;
        }

        if (MC_LINE_PATTERN.test(body) || /^(MC|挨拶|トーク)/i.test(body)) {
            const mcNote = body
                .replace(/^(MC|挨拶|トーク)\s*[:：\-ー]?\s*/i, "")
                .trim();
            parsed.push({
                order,
                entry: createKrnEntry({
                    section,
                    songName: "MC",
                    note: mcNote,
                    isMc: true,
                }),
            });
            fallbackOrder += 1;
            continue;
        }

        const { songName, performerRaw } = extractSongAndPerformerText(
            body,
            includePerformer,
        );
        if (!songName) continue;

        parsed.push({
            order,
            entry: createKrnEntry({
                section,
                songName,
                performerNames: parsePerformerNamesByDelimiter(
                    performerRaw,
                    performerDelimiter,
                ),
                isMc: false,
            }),
        });
        fallbackOrder += 1;
    }

    return parsed
        .sort((left, right) => left.order - right.order)
        .map((row) => row.entry);
};

const applyInlineAffix = (
    base: string,
    value: string,
    style: InlineAffixStyle,
): string => {
    if (!value) return base;
    if (style === "dot") return `${base}・${value}`;
    if (style === "square") return `${base}【${value}】`;
    if (style === "round") return `${base}（${value}）`;
    return `${base} / ${value}`;
};

export const buildKrnLines = (
    entries: KrnEntry[],
    options?: {
        includeMc?: boolean;
        countMcInMusicOrder?: boolean;
    },
): KrnLine[] => {
    const includeMc = options?.includeMc ?? true;
    const countMcInMusicOrder = options?.countMcInMusicOrder ?? false;
    let lineOrder = ORDER_START;
    let musicOrder = ORDER_START;
    const out: KrnLine[] = [];
    for (const entry of entries) {
        if (!entry.songName.trim()) continue;
        const isMc = entry.isMc || /^MC$/i.test(entry.songName.trim());
        if (isMc && !includeMc) continue;
        const currentMusicOrder = isMc
            ? countMcInMusicOrder
                ? musicOrder
                : null
            : musicOrder;
        out.push({
            lineOrder,
            musicOrder: currentMusicOrder,
            entry,
        });
        lineOrder += 1;
        if (!isMc || countMcInMusicOrder) {
            musicOrder += 1;
        }
    }
    return out;
};

export const buildDisplayKrnLines = (
    entries: KrnEntry[],
    options?: {
        includeMc?: boolean;
        countMcInMusicOrder?: boolean;
    },
): DisplayKrnLine[] => {
    const countMcInMusicOrder = options?.countMcInMusicOrder ?? false;
    const rows = buildKrnLines(entries, options);
    let songDisplayOrder = ORDER_START;
    let previousWasMedley = false;
    let previousEntrySection = "";

    return rows.map((row) => {
        const entry = row.entry;
        const songName = entry.songName.trim();
        const isMc = entry.isMc || /^MC$/i.test(songName);
        const section = entry.section.trim();
        const isMedley = !isMc && entry.isMedley;
        const isParallelMedley =
            isMedley && previousWasMedley && section === previousEntrySection;

        let displayOrder = row.lineOrder;
        if (isMc) {
            if (countMcInMusicOrder) {
                displayOrder = songDisplayOrder++;
            } else {
                displayOrder = songDisplayOrder - 1;
            }
        } else {
            displayOrder = isParallelMedley
                ? songDisplayOrder - 1
                : songDisplayOrder++;
        }

        previousWasMedley = isMedley;
        previousEntrySection = section;
        return {
            ...row,
            displayOrder,
        };
    });
};

export const buildExportText = (params: ExportPayload): string => {
    const lines: string[] = [];
    const hasEventInfo =
        params.eventName.trim().length > 0 ||
        params.stageDate.trim().length > 0 ||
        params.venueName.trim().length > 0 ||
        params.startTime.trim().length > 0 ||
        params.pattern.trim().length > 0 ||
        params.stageId !== null ||
        params.eventId !== null;

    if (params.outputOptions.includeEvent && hasEventInfo) {
        const titleLine = buildEventTitleLine(params.eventName, params.pattern);
        const detailLine = buildEventDetailLine(
            params.stageDate,
            params.startTime,
            params.venueName,
        );
        if (titleLine) lines.push(titleLine);
        if (detailLine) lines.push(detailLine);
    }

    if (lines.length > 0) {
        lines.push("");
    }
    let previousSectionHeader = "";
    const exportLines = buildKrnLines(params.entries, {
        includeMc: params.outputOptions.includeMc,
        countMcInMusicOrder: params.outputOptions.countMcInMusicOrder,
    });
    let songDisplayOrder = ORDER_START;
    let previousWasMedley = false;
    let previousEntrySection = "";

    for (let index = 0; index < exportLines.length; index += 1) {
        const row = exportLines[index];
        const entry = row.entry;
        const songName = entry.songName.trim();
        const isMc = entry.isMc || /^MC$/i.test(songName);
        const section = entry.section.trim();
        const isMedley = !isMc && entry.isMedley;
        const isParallelMedley =
            isMedley && previousWasMedley && section === previousEntrySection;
        const isInlineMc = isMc && !params.outputOptions.countMcInMusicOrder;

        if (
            params.outputOptions.sectionAsHeader &&
            section &&
            section !== previousSectionHeader
        ) {
            lines.push(`【${section}】`);
            previousSectionHeader = section;
        }
        let displayOrder = row.lineOrder;
        if (isMc) {
            if (params.outputOptions.countMcInMusicOrder) {
                displayOrder = songDisplayOrder++;
            } else {
                displayOrder = songDisplayOrder - 1;
            }
        } else {
            displayOrder = isParallelMedley
                ? songDisplayOrder - 1
                : songDisplayOrder++;
        }
        const orderLabel = String(Math.max(ORDER_START, displayOrder)).padStart(
            ORDER_PADDING,
            "0",
        );
        const artistText = entry.songArtistName.trim();
        const performerText = joinPerformerNames(
            entry.performerNames,
            params.performerDelimiter,
        );
        const baseWithArtist =
            params.outputOptions.artistDisplayMode === "inline" && artistText
                ? applyInlineAffix(
                      songName,
                      artistText,
                      params.outputOptions.artistInlineStyle,
                  )
                : songName;
        const baseDisplaySong =
            params.outputOptions.performerDisplayMode === "inline" &&
            !isMc &&
            performerText.length > 0
                ? applyInlineAffix(
                      baseWithArtist,
                      performerText,
                      params.outputOptions.performerInlineStyle,
                  )
                : baseWithArtist;
        const displaySong =
            !params.outputOptions.sectionAsHeader && section
                ? `【${section}】 ${baseDisplaySong}`
                : baseDisplaySong;
        const suffixParts: string[] = [];
        if (params.outputOptions.includeNote && entry.note.trim())
            suffixParts.push(entry.note.trim());
        const isIndentedLine = isParallelMedley || isInlineMc;
        const prefix = isInlineMc
            ? "--  "
            : isIndentedLine
              ? " ".repeat(orderLabel.length + 2)
              : `${orderLabel}. `;
        lines.push(
            `${prefix}${displaySong}${suffixParts.length > 0 ? ` (${suffixParts.join(" / ")})` : ""}`,
        );
        if (
            params.outputOptions.artistDisplayMode === "newline" &&
            artistText
        ) {
            const artistLine = `${params.outputOptions.artistPrefixCustom}${artistText}`;
            lines.push(
                `${isIndentedLine ? " ".repeat(orderLabel.length + 2) : "   "} ${artistLine}`,
            );
        }
        if (
            params.outputOptions.performerDisplayMode === "newline" &&
            !isMc &&
            entry.performerNames.length > 0
        ) {
            const performerText = joinPerformerNames(
                entry.performerNames,
                params.performerDelimiter,
            );
            const performerLine = `${params.outputOptions.performerPrefixCustom}${performerText}`;
            lines.push(
                `${isIndentedLine ? " ".repeat(orderLabel.length + 2) : "   "} ${performerLine}`,
            );
        }
        previousWasMedley = isMedley;
        previousEntrySection = section;
    }

    return lines.join("\n").trim();
};

const escapeCsvCell = (value: string): string =>
    `"${value.replace(/"/g, '""')}"`;

export const buildExportCsv = (params: ExportPayload): string => {
    const headers = ["曲順", "曲名"];
    headers.push("セクション");
    if (params.outputOptions.artistDisplayMode !== "hidden")
        headers.push("アーティスト");
    if (params.outputOptions.performerDisplayMode !== "hidden")
        headers.push("歌唱者");
    if (params.outputOptions.includeNote) headers.push("備考");

    const bodyRows = buildDisplayKrnLines(params.entries, {
        includeMc: params.outputOptions.includeMc,
        countMcInMusicOrder: params.outputOptions.countMcInMusicOrder,
    });

    const rows: string[][] = [headers];
    for (const row of bodyRows) {
        const entry = row.entry;
        const section = entry.section.trim();
        const isMc = entry.isMc || /^MC$/i.test(entry.songName.trim());

        const base = [
            String(Math.max(ORDER_START, row.displayOrder)),
            entry.songName.trim(),
            section,
        ];
        if (params.outputOptions.artistDisplayMode !== "hidden") {
            base.push(entry.songArtistName.trim());
        }
        if (params.outputOptions.performerDisplayMode !== "hidden") {
            base.push(
                isMc
                    ? ""
                    : joinPerformerNames(
                          entry.performerNames,
                          params.performerDelimiter,
                      ),
            );
        }
        if (params.outputOptions.includeNote) {
            base.push(entry.note.trim());
        }
        rows.push(base);
    }

    return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
};

const buildExportHtmlTable = (params: ExportPayload): string => {
    const rows = buildDisplayKrnLines(params.entries, {
        includeMc: params.outputOptions.includeMc,
        countMcInMusicOrder: params.outputOptions.countMcInMusicOrder,
    });
    const headers = ["曲順", "曲名"];
    if (!params.outputOptions.sectionAsHeader) headers.push("セクション");
    if (params.outputOptions.artistDisplayMode !== "hidden")
        headers.push("アーティスト");
    if (params.outputOptions.performerDisplayMode !== "hidden")
        headers.push("歌唱者");
    if (params.outputOptions.includeNote) headers.push("備考");

    let previousSection = "";
    const bodyRows: string[] = [];
    for (const row of rows) {
        const entry = row.entry;
        const section = entry.section.trim();
        const isMc = entry.isMc || /^MC$/i.test(entry.songName.trim());
        const songName = entry.songName.trim();
        if (
            params.outputOptions.sectionAsHeader &&
            section &&
            section !== previousSection
        ) {
            bodyRows.push(
                `<tr class="section"><th colspan="${headers.length}">${escapeHtml(section)}</th></tr>`,
            );
            previousSection = section;
        }

        const cells = [
            escapeHtml(String(Math.max(ORDER_START, row.displayOrder))),
            escapeHtml(songName),
        ];
        if (!params.outputOptions.sectionAsHeader)
            cells.push(escapeHtml(section));
        if (params.outputOptions.artistDisplayMode !== "hidden")
            cells.push(escapeHtml(entry.songArtistName.trim()));
        if (params.outputOptions.performerDisplayMode !== "hidden") {
            cells.push(
                isMc
                    ? ""
                    : escapeHtml(
                          joinPerformerNames(
                              entry.performerNames,
                              params.performerDelimiter,
                          ),
                      ),
            );
        }
        if (params.outputOptions.includeNote)
            cells.push(escapeHtml(entry.note.trim()));

        bodyRows.push(
            `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`,
        );
    }

    return `<table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${bodyRows.join("")}</tbody>
  </table>`;
};

export const buildExportHtml = (params: ExportPayload): string => {
    const hasEventInfo =
        params.eventName.trim().length > 0 ||
        params.stageDate.trim().length > 0 ||
        params.venueName.trim().length > 0 ||
        params.startTime.trim().length > 0 ||
        params.pattern.trim().length > 0;
    const tableHtml = buildExportHtmlTable(params);
    const eventLines: string[] = [];
    if (params.outputOptions.includeEvent && hasEventInfo) {
        const titleLine = buildEventTitleLine(params.eventName, params.pattern);
        const detailLine = buildEventDetailLine(
            params.stageDate,
            params.startTime,
            params.venueName,
        );
        if (titleLine) eventLines.push(`<div>${escapeHtml(titleLine)}</div>`);
        if (detailLine) eventLines.push(`<div>${escapeHtml(detailLine)}</div>`);
    }

    const fragmentHtml = `${eventLines.length > 0 ? `<div class="event">${eventLines.join("")}</div>\n  ` : ""}${tableHtml}`;

    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KRN Export</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; margin: 16px; color: #1f2937; }
    .event { margin-bottom: 12px; font-size: 13px; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }
    thead th { background: #f3f4f6; text-align: left; }
    tr.section th { background: #ede9fe; color: #4c1d95; text-align: left; font-weight: 700; }
  </style>
</head>
<body>
  ${fragmentHtml}
</body>
</html>`;
};

export const buildExportHtmlFragment = (params: ExportPayload): string => {
    const hasEventInfo =
        params.eventName.trim().length > 0 ||
        params.stageDate.trim().length > 0 ||
        params.venueName.trim().length > 0 ||
        params.startTime.trim().length > 0 ||
        params.pattern.trim().length > 0;
    const tableHtml = buildExportHtmlTable(params);
    if (!params.outputOptions.includeEvent || !hasEventInfo) {
        return tableHtml;
    }
    const eventLines: string[] = [];
    const titleLine = buildEventTitleLine(params.eventName, params.pattern);
    const detailLine = buildEventDetailLine(
        params.stageDate,
        params.startTime,
        params.venueName,
    );
    if (titleLine) eventLines.push(`<div>${escapeHtml(titleLine)}</div>`);
    if (detailLine) eventLines.push(`<div>${escapeHtml(detailLine)}</div>`);
    return `<div class="event">${eventLines.join("")}</div>\n${tableHtml}`;
};

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
