import { useEffect, useRef, useState } from "react";

import { parseLocationRoute } from "../../lib/appRoute";
import { submitIssueReport } from "../../lib/reportIssue";
import { getStoredParquetGeneratedAt } from "../../lib/setlistSearchDb/loadCsvTables";
import { formatDateYmd, formatTimeHm } from "../../lib/uiFormat";
import { ArrowLeftIcon, ShareIcon } from "../ui";
import { SortArrowIndicator } from "../ui/SortArrowIndicator";

import type { AppRoute } from "../../lib/appRoute";
import type { SetlistSearchDb } from "../../lib/setlistSearchDb/types";
import type { ReactNode } from "react";

type DetailPanelProps = {
    children: ReactNode;
    className?: string;
};

const DETAIL_PANEL_BASE_CLASS =
    "rounded-none border-2 border-gray-800 bg-white shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]";

export const DETAIL_TABLE_HEAD_CLASS =
    "border-b-2 border-gray-800 bg-slate-50 text-xs text-slate-600";
export const DETAIL_TABLE_ROW_CLASS = "border-b border-gray-300";

export type DetailTableColumn<T> = {
    key: string;
    header: string;
    desktopClassName?: string;
    mobileLabelClassName?: string;
    mobileValueClassName?: string;
    mobileHidden?: boolean;
    mobileOnly?: boolean;
    render: (row: T) => ReactNode;
    sortValue?: (row: T) => string | number | Date | null | undefined;
};

export function DetailPanel({ children, className = "" }: DetailPanelProps) {
    return (
        <section className={`${DETAIL_PANEL_BASE_CLASS} ${className}`.trim()}>
            {children}
        </section>
    );
}

export function DetailLoadingState() {
    return <DetailPanel className="p-6">読み込み中...</DetailPanel>;
}

type DetailLastUpdatedLabelProps = {
    className?: string;
    db?: SetlistSearchDb | null;
    route?: AppRoute | null;
};

export function DetailLastUpdatedLabel({
    className = "",
    db = null,
    route = null,
}: DetailLastUpdatedLabelProps) {
    const [generatedAt, setGeneratedAt] = useState<string | null>(() =>
        getStoredParquetGeneratedAt(),
    );

    useEffect(() => {
        if (!db || !route || !("id" in route)) return;
        const routeName = route.name;
        const detailType =
            routeName === "event" ||
            routeName === "stage" ||
            routeName === "venue" ||
            routeName === "song" ||
            routeName === "artist" ||
            routeName === "album" ||
            routeName === "member" ||
            routeName === "group" ||
            routeName === "creator"
                ? routeName
                : null;
        if (!detailType) return;
        let cancelled = false;
        const run = async () => {
            try {
                const latest = await db.getDetailLastUpdated(detailType, route.id);
                if (!cancelled && latest) {
                    setGeneratedAt(latest);
                }
            } catch {
                // ignore query errors
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db, route]);

    useEffect(() => {
        if (generatedAt) return;
        let cancelled = false;
        const run = async () => {
            try {
                const response = await fetch("/data/parquet/manifest.json", {
                    cache: "no-store",
                });
                if (!response.ok) return;
                const payload = (await response.json()) as unknown;
                if (
                    typeof payload === "object" &&
                    payload !== null &&
                    typeof (payload as { generatedAt?: unknown }).generatedAt ===
                        "string" &&
                    !cancelled
                ) {
                    setGeneratedAt(
                        (payload as { generatedAt: string }).generatedAt,
                    );
                }
            } catch {
                // ignore fetch errors
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [generatedAt]);

    if (!generatedAt) return null;

    return (
        <p className={`text-xs text-slate-500 ${className}`.trim()}>
            最終更新: {formatDateYmd(generatedAt)} {formatTimeHm(generatedAt)}
        </p>
    );
}

type DetailErrorStateProps = {
    message: string;
};

export function DetailErrorState({ message }: DetailErrorStateProps) {
    return (
        <section className="rounded-none border-2 border-red-600 bg-red-50 p-6 text-sm text-red-700">
            {message}
        </section>
    );
}

type DetailNotFoundStateProps = {
    message: string;
};

export function DetailNotFoundState({ message }: DetailNotFoundStateProps) {
    return (
        <DetailPanel className="p-6">
            <p className="text-sm text-slate-600">{message}</p>
            <button
                type="button"
                onClick={() => {
                    if (typeof window !== "undefined") {
                        window.location.assign("/");
                    }
                }}
                className="mt-3 inline-flex rounded-none border-2 border-gray-800 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-100"
            >
                トップに戻る
            </button>
        </DetailPanel>
    );
}

type DetailShareLinkButtonProps = {
    className?: string;
};

export function DetailShareLinkButton({
    className = "",
}: DetailShareLinkButtonProps) {
    const [copied, setCopied] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportType, setReportType] =
        useState<"correction" | "missing_info" | "request" | "other">("correction");
    const [reportMessage, setReportMessage] = useState("");
    const [reportContactName, setReportContactName] = useState("");
    const [reportContactEmail, setReportContactEmail] = useState("");
    const [reportError, setReportError] = useState("");
    const [reportSending, setReportSending] = useState(false);
    const [reportToastOpen, setReportToastOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1600);
        return () => window.clearTimeout(timer);
    }, [copied]);

    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (!rootRef.current?.contains(target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [menuOpen]);

    useEffect(() => {
        if (!reportToastOpen) return;
        const timer = window.setTimeout(() => {
            setReportToastOpen(false);
        }, 2200);
        return () => window.clearTimeout(timer);
    }, [reportToastOpen]);

    const handleCopy = async () => {
        if (typeof window === "undefined") return;
        const url = window.location.href;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = url;
                textarea.setAttribute("readonly", "true");
                textarea.style.position = "absolute";
                textarea.style.left = "-9999px";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    const handleShareX = () => {
        if (typeof window === "undefined") return;
        const pageUrl = window.location.href;
        const pageTitle = document.title;
        const shareText = `${pageTitle}\n${pageUrl}`;
        const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
        window.open(intentUrl, "_blank", "noopener,noreferrer");
        setMenuOpen(false);
    };

    const handleShareLine = () => {
        if (typeof window === "undefined") return;
        const pageUrl = window.location.href;
        const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(pageUrl)}`;
        window.open(lineShareUrl, "_blank", "noopener,noreferrer");
        setMenuOpen(false);
    };

    const handleOpenReport = () => {
        setMenuOpen(false);
        setReportOpen(true);
        setReportError("");
    };

    const handleCloseReport = () => {
        setReportOpen(false);
        setReportType("correction");
        setReportMessage("");
        setReportContactName("");
        setReportContactEmail("");
        setReportError("");
        setReportSending(false);
    };

    const handleSubmitReport = async () => {
        if (typeof window === "undefined") return;
        const message = reportMessage.trim();
        if (message.length < 3) {
            setReportError("内容を3文字以上入力してください。");
            return;
        }
        if (message.length > 1000) {
            setReportError("内容は1000文字以内で入力してください。");
            return;
        }
        const contactName = reportContactName.trim();
        if (contactName.length > 80) {
            setReportError("お名前は80文字以内で入力してください。");
            return;
        }
        const contactEmail = reportContactEmail.trim();
        if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
            setReportError("メールアドレスの形式を確認してください。");
            return;
        }

        setReportSending(true);
        setReportError("");
        try {
            const route = parseLocationRoute(
                window.location.pathname,
                window.location.search,
            );
            await submitIssueReport({
                message,
                pageUrl: window.location.href,
                pageTitle: document.title || "",
                routeName: route.name,
                routeId: "id" in route ? route.id : null,
                reportType,
                contactName,
                contactEmail,
                sourceContext: "detail-report",
            });
            setReportOpen(false);
            setReportError("");
            setReportToastOpen(true);
            setReportMessage("");
            setReportContactName("");
            setReportContactEmail("");
            setReportType("correction");
        } catch (error) {
            setReportError(error instanceof Error ? error.message : String(error));
        } finally {
            setReportSending(false);
        }
    };

    return (
        <div ref={rootRef} className={`relative ${className}`.trim()}>
            <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                title={copied ? "コピーしました" : "共有"}
                aria-label="共有メニューを開く"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-gray-800 bg-white text-gray-800 hover:bg-gray-100"
            >
                <ShareIcon className="h-4 w-4" />
            </button>
            {menuOpen ? (
                <div className="absolute right-0 z-50 mt-1 min-w-[150px] rounded-none border-2 border-gray-800 bg-white p-1 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]">
                    <button
                        type="button"
                        onClick={handleShareX}
                        className="block w-full rounded-none px-2 py-1.5 text-left text-xs text-gray-800 hover:bg-gray-100"
                    >
                        Twitterに共有
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            handleShareLine();
                        }}
                        className="block w-full rounded-none px-2 py-1.5 text-left text-xs text-gray-800 hover:bg-gray-100"
                    >
                        LINEで共有
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            void handleCopy();
                            setMenuOpen(false);
                        }}
                        className="block w-full rounded-none px-2 py-1.5 text-left text-xs text-gray-800 hover:bg-gray-100"
                    >
                        リンクをコピー
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenReport}
                        className="block w-full rounded-none px-2 py-1.5 text-left text-xs text-gray-800 hover:bg-gray-100"
                    >
                        誤りを報告
                    </button>
                </div>
            ) : null}
            {reportOpen ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-3 py-6">
                    <div className="w-full max-w-lg rounded-none border-2 border-gray-800 bg-white p-4 shadow-[4px_4px_0px_0px_rgba(31,41,55,0.8)]">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-gray-900">誤りを報告</h3>
                            <button
                                type="button"
                                onClick={handleCloseReport}
                                className="rounded-none border-2 border-gray-800 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100"
                            >
                                閉じる
                            </button>
                        </div>
                        <p className="mb-2 text-xs text-slate-600">
                            掲載内容の誤りや不足情報などをお送りください。
                        </p>
                        <label className="mb-2 block text-xs font-semibold text-slate-700">
                            種別
                            <select
                                value={reportType}
                                onChange={(event) =>
                                    setReportType(
                                        event.target.value as
                                            | "correction"
                                            | "missing_info"
                                            | "request"
                                            | "other",
                                    )
                                }
                                className="mt-1 w-full rounded-none border-2 border-gray-800 bg-white px-2 py-2 text-sm text-gray-900 focus:outline-none"
                            >
                                <option value="correction">誤り</option>
                                <option value="missing_info">不足情報</option>
                                <option value="request">要望</option>
                                <option value="other">その他</option>
                            </select>
                        </label>
                        <textarea
                            value={reportMessage}
                            onChange={(event) => setReportMessage(event.target.value)}
                            rows={6}
                            maxLength={1000}
                            placeholder="気づいた点や修正してほしい内容を入力してください。正しい情報が分かる場合はあわせて記載してください。"
                            className="w-full rounded-none border-2 border-gray-800 px-2 py-2 text-sm text-gray-900 focus:outline-none"
                        />
                        <label className="mt-2 block text-xs font-semibold text-slate-700">
                            お名前（任意）
                            <input
                                type="text"
                                value={reportContactName}
                                onChange={(event) =>
                                    setReportContactName(event.target.value)
                                }
                                maxLength={80}
                                placeholder="例: 山田 太郎"
                                className="mt-1 w-full rounded-none border-2 border-gray-800 px-2 py-2 text-sm text-gray-900 focus:outline-none"
                            />
                        </label>
                        <label className="mt-2 block text-xs font-semibold text-slate-700">
                            メールアドレス（返信が必要な場合のみ）
                            <input
                                type="email"
                                value={reportContactEmail}
                                onChange={(event) =>
                                    setReportContactEmail(event.target.value)
                                }
                                maxLength={254}
                                placeholder="you@example.com"
                                className="mt-1 w-full rounded-none border-2 border-gray-800 px-2 py-2 text-sm text-gray-900 focus:outline-none"
                            />
                        </label>
                        <p className="mt-2 px-1 py-1 text-[11px] leading-5 text-slate-700">
                            ※いただいた内容は、確認・修正対応・サービス改善のために利用します。本文には住所、電話番号、パスワードなどを書かないでください。
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">
                                {reportMessage.length}/1000
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    void handleSubmitReport();
                                }}
                                disabled={reportSending}
                                className="rounded-none border-2 border-gray-800 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {reportSending ? "送信中..." : "送信"}
                            </button>
                        </div>
                        {reportError ? (
                            <p className="mt-2 text-xs text-red-600">{reportError}</p>
                        ) : null}
                    </div>
                </div>
            ) : null}
            {reportToastOpen ? (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed bottom-4 right-4 z-[70] rounded-none border-2 border-green-800 bg-white px-3 py-2 text-xs font-semibold text-green-800 shadow-[3px_3px_0px_0px_rgba(22,101,52,0.5)]"
                >
                    報告を送信しました。ありがとうございます。
                </div>
            ) : null}
        </div>
    );
}

type DetailResponsiveTableProps<T> = {
    rows: T[];
    rowKey: (row: T, index: number) => string | number;
    columns: DetailTableColumn<T>[];
    emptyMessage?: string;
    pageSizeOptions?: number[];
    initialPageSize?: number;
    disablePagination?: boolean;
    hideSummary?: boolean;
    disableSorting?: boolean;
    mobileAsTable?: boolean;
    hideMobileEmptyRows?: boolean;
    mobileRowClassName?: string;
};

export function DetailResponsiveTable<T>({
    rows,
    rowKey,
    columns,
    emptyMessage = "データがありません。",
    pageSizeOptions = [10, 20, 50, 100],
    initialPageSize = 20,
    disablePagination = false,
    hideSummary = false,
    disableSorting = false,
    mobileAsTable = false,
    hideMobileEmptyRows = false,
    mobileRowClassName = "border-b-2 border-gray-800 bg-white px-3 py-2 first:border-t-2",
}: DetailResponsiveTableProps<T>) {
    const detectMobile = (): boolean =>
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 767px)").matches;
    const normalizedPageSizeOptions = Array.from(
        new Set([10, ...pageSizeOptions]),
    ).sort((a, b) => a - b);
    const [isMobile, setIsMobile] = useState<boolean>(() => detectMobile());
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [pageSize, setPageSize] = useState<number>(() =>
        detectMobile()
            ? (normalizedPageSizeOptions[0] ?? 10)
            : initialPageSize,
    );
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) {
            return;
        }
        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const update = () => {
            setIsMobile(mediaQuery.matches);
        };
        update();
        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", update);
        } else {
            mediaQuery.addListener(update);
        }
        return () => {
            if (typeof mediaQuery.removeEventListener === "function") {
                mediaQuery.removeEventListener("change", update);
            } else {
                mediaQuery.removeListener(update);
            }
        };
    }, []);

    const sortableColumns = disableSorting
        ? []
        : columns.filter((column) => isColumnSortable(column, rows));
    const activeSortKey = sortKey ?? (isMobile ? sortableColumns[0]?.key ?? null : null);
    const sortedRows = disableSorting
        ? [...rows]
        : [...rows].sort((left, right) => {
              if (!activeSortKey) return 0;
              const column = columns.find((item) => item.key === activeSortKey);
              if (!column) return 0;
              const leftValue = getSortableValue(left, column);
              const rightValue = getSortableValue(right, column);
              const compared = compareSortableValue(leftValue, rightValue);
              return sortOrder === "asc" ? compared : compared * -1;
          });
    const totalPages = disablePagination
        ? 1
        : Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pagedRows = disablePagination
        ? sortedRows
        : sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    if (rows.length === 0) {
        return <p className="text-sm text-slate-500">{emptyMessage}</p>;
    }

    if (!isMobile) {
        return (
            <div>
                {!hideSummary ? (
                    <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                        <span>
                            {sortedRows.length}件中 {(currentPage - 1) * pageSize + 1}-
                            {Math.min(currentPage * pageSize, sortedRows.length)}件
                        </span>
                    </div>
                ) : null}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className={DETAIL_TABLE_HEAD_CLASS}>
                            <tr>
                                {columns.filter((column) => !column.mobileOnly).map((column) => (
                                    <th
                                        key={column.key}
                                        className={`px-2 py-2 text-left whitespace-nowrap ${column.desktopClassName ?? ""}`.trim()}
                                    >
                                        {!disableSorting && isColumnSortable(column, rows) ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (sortKey === column.key) {
                                                        setSortOrder((current) =>
                                                            current === "asc" ? "desc" : "asc",
                                                        );
                                                    } else {
                                                        setSortKey(column.key);
                                                        setSortOrder("asc");
                                                    }
                                                    setPage(1);
                                                }}
                                                className="inline-flex items-center gap-1 hover:text-slate-900"
                                            >
                                                <span>{column.header}</span>
                                                <SortArrowIndicator
                                                    active={sortKey === column.key}
                                                    order={sortOrder}
                                                    className="ml-0.5 inline-flex flex-col gap-[2px] leading-[0.72] text-[9px] select-none"
                                                    activeClassName="text-slate-700"
                                                    inactiveClassName="text-slate-300"
                                                    neutralClassName="text-slate-500"
                                                />
                                            </button>
                                        ) : (
                                            column.header
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pagedRows.map((row, rowIndex) => (
                                <tr
                                    key={String(rowKey(row, rowIndex))}
                                    className={DETAIL_TABLE_ROW_CLASS}
                                >
                                    {columns.filter((column) => !column.mobileOnly).map((column) => (
                                        <td
                                            key={column.key}
                                            className={`px-2 py-2 ${column.desktopClassName ?? ""}`.trim()}
                                        >
                                            {column.render(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!disablePagination ? (
                    <div className="mt-4 border-t border-gray-200 pt-2 flex items-center justify-between gap-2 text-xs">
                        <label className="inline-flex h-6 items-center">
                            <select
                                className="h-6 rounded-none border-2 border-gray-800 bg-white px-1.5 text-xs text-slate-800"
                                value={pageSize}
                                onChange={(event) => {
                                    const nextSize =
                                        Number(event.target.value) || initialPageSize;
                                    setPageSize(nextSize);
                                    setPage(1);
                                }}
                            >
                                {normalizedPageSizeOptions.map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {totalPages > 1 ? (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                                    disabled={currentPage <= 1}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-none border-2 border-gray-800 bg-white text-slate-800 disabled:opacity-40"
                                    aria-label="前のページ"
                                    title="前のページ"
                                >
                                    <ArrowLeftIcon className="h-3 w-3" />
                                </button>
                                <span className="min-w-[56px] text-center text-slate-600">
                                    {currentPage}/{totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPage((current) => Math.min(totalPages, current + 1))
                                    }
                                    disabled={currentPage >= totalPages}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-none border-2 border-gray-800 bg-white text-slate-800 disabled:opacity-40"
                                    aria-label="次のページ"
                                    title="次のページ"
                                >
                                    <ArrowLeftIcon className="h-3 w-3 rotate-180" />
                                </button>
                            </div>
                        ) : (
                            <span />
                        )}
                    </div>
                ) : null}
            </div>
        );
    }

    const mobileColumns = columns.filter((column) => !column.mobileHidden);
    const showMobileToolbar = !hideSummary || sortableColumns.length > 0;

    if (mobileAsTable) {
        return (
            <div className="space-y-0">
                {showMobileToolbar ? (
                    <div
                        className={`mb-2 flex min-h-6 items-center gap-2 ${hideSummary ? "justify-end" : ""}`}
                    >
                        {!hideSummary ? (
                            <span className="text-xs font-semibold text-slate-700 leading-6">
                                {sortedRows.length}件中 {(currentPage - 1) * pageSize + 1}-
                                {Math.min(currentPage * pageSize, sortedRows.length)}件
                            </span>
                        ) : null}
                        {sortableColumns.length > 0 ? (
                            <div className="ml-auto flex items-center gap-2 text-[11px]">
                                <select
                                    className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-bold text-slate-800 shadow-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                    value={activeSortKey ?? sortableColumns[0]?.key ?? ""}
                                    onChange={(event) => {
                                        setSortKey(event.target.value);
                                        setSortOrder("asc");
                                        setPage(1);
                                    }}
                                    aria-label="並び替え"
                                >
                                    {sortableColumns.map((column) => (
                                        <option key={column.key} value={column.key}>
                                            {column.header}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSortOrder((current) => {
                                            setPage(1);
                                            return current === "asc" ? "desc" : "asc";
                                        })
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-red-300 hover:text-red-700"
                                    aria-label={sortOrder === "asc" ? "昇順" : "降順"}
                                    title={sortOrder === "asc" ? "昇順" : "降順"}
                                >
                                    <span className="text-[10px] font-bold leading-none">
                                        {sortOrder === "asc" ? "▲" : "▼"}
                                    </span>
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className={DETAIL_TABLE_HEAD_CLASS}>
                            <tr>
                                {mobileColumns.map((column) => (
                                    <th
                                        key={column.key}
                                        className={`px-2 py-1.5 text-left whitespace-nowrap ${column.mobileLabelClassName ?? ""}`.trim()}
                                    >
                                        {column.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pagedRows.map((row, rowIndex) => (
                                <tr
                                    key={String(rowKey(row, rowIndex))}
                                    className={DETAIL_TABLE_ROW_CLASS}
                                >
                                    {mobileColumns.map((column) => (
                                        <td
                                            key={column.key}
                                            className={`px-2 py-1.5 align-top text-slate-900 ${column.mobileValueClassName ?? ""}`.trim()}
                                        >
                                            {column.render(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!disablePagination ? (
                    <div className="mt-6 border-t border-gray-200 pt-2 flex items-center justify-between gap-2 text-[11px]">
                        <label className="inline-flex h-6 items-center">
                            <select
                                className="h-6 rounded-none border-2 border-gray-700 bg-white px-1.5 text-[11px] text-slate-800"
                                value={pageSize}
                                onChange={(event) => {
                                    const nextSize = Number(event.target.value) || initialPageSize;
                                    setPageSize(nextSize);
                                    setPage(1);
                                }}
                            >
                                {normalizedPageSizeOptions.map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {totalPages > 1 ? (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                                    disabled={currentPage <= 1}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-none border-2 border-gray-700 bg-white text-slate-800 disabled:opacity-40"
                                    aria-label="前のページ"
                                    title="前のページ"
                                >
                                    <ArrowLeftIcon className="h-3 w-3" />
                                </button>
                                <span className="min-w-[52px] text-center text-slate-600">
                                    {currentPage}/{totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-none border-2 border-gray-700 bg-white text-slate-800 disabled:opacity-40"
                                    aria-label="次のページ"
                                    title="次のページ"
                                >
                                    <ArrowLeftIcon className="h-3 w-3 rotate-180" />
                                </button>
                            </div>
                        ) : (
                            <span />
                        )}
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className="space-y-0">
            {showMobileToolbar ? (
                <div className={`mb-2 flex min-h-6 items-center gap-2 ${hideSummary ? "justify-end" : ""}`}>
                    {!hideSummary ? (
                        <span className="text-xs font-semibold text-slate-700 leading-6">
                            {sortedRows.length}件中 {(currentPage - 1) * pageSize + 1}-
                            {Math.min(currentPage * pageSize, sortedRows.length)}件
                        </span>
                    ) : null}
                    {sortableColumns.length > 0 ? (
                        <div className="ml-auto flex items-center gap-2 text-[11px]">
                            <select
                                className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-bold text-slate-800 shadow-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                value={activeSortKey ?? sortableColumns[0]?.key ?? ""}
                                onChange={(event) => {
                                    setSortKey(event.target.value);
                                    setSortOrder("asc");
                                    setPage(1);
                                }}
                                aria-label="並び替え"
                            >
                                {sortableColumns.map((column) => (
                                    <option key={column.key} value={column.key}>
                                        {column.header}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() =>
                                    setSortOrder((current) => {
                                        setPage(1);
                                        return current === "asc" ? "desc" : "asc";
                                    })
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-red-300 hover:text-red-700"
                                aria-label={sortOrder === "asc" ? "昇順" : "降順"}
                                title={sortOrder === "asc" ? "昇順" : "降順"}
                            >
                                <span className="text-[10px] font-bold leading-none">
                                    {sortOrder === "asc" ? "▲" : "▼"}
                                </span>
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : null}
            {pagedRows.map((row, rowIndex) => (
                <section
                    key={String(rowKey(row, rowIndex))}
                    className={mobileRowClassName}
                >
                    <dl className="space-y-1.5">
                        {mobileColumns.map((column) => {
                            const rendered = column.render(row);
                            if (rendered === null || rendered === undefined) {
                                return null;
                            }
                            if (hideMobileEmptyRows && isMobileEmptyValue(rendered)) {
                                return null;
                            }
                            return (
                                <div key={column.key} className="grid grid-cols-[88px_1fr] gap-2">
                                    <dt
                                        className={`truncate text-[11px] font-semibold text-slate-500 ${column.mobileLabelClassName ?? ""}`.trim()}
                                    >
                                        {column.header}
                                    </dt>
                                    <dd
                                        className={`min-w-0 text-xs text-slate-900 ${column.mobileValueClassName ?? ""}`.trim()}
                                    >
                                        {rendered}
                                    </dd>
                                </div>
                            );
                        })}
                    </dl>
                </section>
            ))}
            {!disablePagination ? (
                <div className="mt-6 border-t border-gray-200 pt-2 flex items-center justify-between gap-2 text-[11px]">
                    <label className="inline-flex h-6 items-center">
                        <select
                            className="h-6 rounded-none border-2 border-gray-700 bg-white px-1.5 text-[11px] text-slate-800"
                            value={pageSize}
                            onChange={(event) => {
                                const nextSize =
                                    Number(event.target.value) || initialPageSize;
                                setPageSize(nextSize);
                                setPage(1);
                            }}
                        >
                            {normalizedPageSizeOptions.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </label>
                        {totalPages > 1 ? (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                                    disabled={currentPage <= 1}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-none border-2 border-gray-700 bg-white text-slate-800 disabled:opacity-40"
                                    aria-label="前のページ"
                                    title="前のページ"
                                >
                                <ArrowLeftIcon className="h-3 w-3" />
                            </button>
                            <span className="min-w-[52px] text-center text-slate-600">
                                {currentPage}/{totalPages}
                            </span>
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-none border-2 border-gray-700 bg-white text-slate-800 disabled:opacity-40"
                                    aria-label="次のページ"
                                    title="次のページ"
                                >
                                <ArrowLeftIcon className="h-3 w-3 rotate-180" />
                            </button>
                        </div>
                    ) : (
                        <span />
                    )}
                </div>
            ) : null}
        </div>
    );
}

function isMobileEmptyValue(value: ReactNode): boolean {
    if (typeof value === "string") {
        const text = value.trim();
        return text === "" || text === "-" || text === "—";
    }
    return false;
}

function isColumnSortable<T>(column: DetailTableColumn<T>, rows: T[]): boolean {
    if (column.sortValue) return true;
    if (rows.length === 0) return false;
    const sample = rows[0] as Record<string, unknown>;
    return isPrimitiveSortableValue(sample[column.key]);
}

function getSortableValue<T>(row: T, column: DetailTableColumn<T>): unknown {
    if (column.sortValue) return column.sortValue(row);
    const raw = (row as Record<string, unknown>)[column.key];
    return isPrimitiveSortableValue(raw) ? raw : null;
}

function compareSortableValue(left: unknown, right: unknown): number {
    if (left === right) return 0;
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    if (left instanceof Date && right instanceof Date) {
        return left.getTime() - right.getTime();
    }
    if (typeof left === "number" && typeof right === "number") {
        return left - right;
    }
    if (typeof left === "string" && typeof right === "string") {
        return left.localeCompare(right, "ja");
    }
    if (typeof left === "boolean" && typeof right === "boolean") {
        return Number(left) - Number(right);
    }
    if (typeof left === "bigint" && typeof right === "bigint") {
        return left > right ? 1 : -1;
    }
    return 0;
}

function isPrimitiveSortableValue(value: unknown): value is string | number | Date {
    return (
        typeof value === "string" ||
        typeof value === "number" ||
        value instanceof Date
    );
}
