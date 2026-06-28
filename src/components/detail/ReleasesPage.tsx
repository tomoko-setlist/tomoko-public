import { useEffect, useState } from "react";

import {
    DetailErrorState,
    DetailLoadingState,
    DetailPanel,
    DetailShareLinkButton,
} from "./DetailUi";
import { formatDateYmd } from "../../lib/uiFormat";
import { EVENT_TAG_CHIP_CLASS } from "../ui/eventTagClass";

import type { ReleaseNoteSummary, SetlistSearchDb } from "../../lib/setlistSearchDb/types";

type ReleasesPageProps = {
    db: SetlistSearchDb;
    onResolveTitle?: (title: string) => void;
    onOpenRelease: (releaseId: number) => void;
};

export function ReleasesPage({ db, onResolveTitle, onOpenRelease }: ReleasesPageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [rows, setRows] = useState<ReleaseNoteSummary[]>([]);

    useEffect(() => {
        onResolveTitle?.("お知らせ");
    }, [onResolveTitle]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError("");
            try {
                if (!db.listReleaseNotes) {
                    throw new Error("お知らせ機能はこのデータ版に含まれていません。");
                }
                const releaseRows = await db.listReleaseNotes(200);
                if (!cancelled) {
                    setRows(releaseRows);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db]);

    if (loading) return <DetailLoadingState />;
    if (error) return <DetailErrorState message={error} />;

    return (
        <div className="space-y-4">
            <DetailPanel className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                            ANNOUNCEMENTS
                        </p>
                        <h1 className="text-lg font-bold text-slate-900">お知らせ</h1>
                        <p className="mt-1 text-xs text-slate-600">
                            機能追加・改善・データ更新履歴を確認できます。
                        </p>
                    </div>
                    <DetailShareLinkButton />
                </div>
            </DetailPanel>

            {rows.length === 0 ? (
                <DetailPanel className="p-6 text-sm text-slate-600">
                    お知らせはまだありません。
                </DetailPanel>
            ) : (
                rows.map((row) => (
                    <DetailPanel key={row.releaseId} className="p-0">
                        <article className="p-4 md:p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-semibold tracking-wide text-neutral-500">
                                        {formatDateYmd(row.releasedAt)}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => onOpenRelease(row.releaseId)}
                                        className="mt-1 text-left text-lg font-bold leading-snug text-blue-700 hover:underline"
                                    >
                                        {row.title}
                                    </button>
                                    {row.relatedRelease ? (
                                        <p className="mt-1 text-xs text-neutral-500">
                                            対象リリース: {row.relatedRelease}
                                        </p>
                                    ) : null}
                                </div>
                                <span className="shrink-0 border border-neutral-400 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                                    {row.announcementKind === "release"
                                        ? "リリース"
                                        : "お知らせ"}
                                </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-neutral-700">
                                {row.summary}
                            </p>
                            {row.tags.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-1">
                                    {row.tags.map((tag) => (
                                        <span
                                            key={`${row.releaseId}-${tag}`}
                                            className={EVENT_TAG_CHIP_CLASS}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </article>
                    </DetailPanel>
                ))
            )}
        </div>
    );
}
