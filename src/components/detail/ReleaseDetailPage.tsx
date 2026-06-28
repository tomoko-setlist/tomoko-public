import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
    DetailErrorState,
    DetailLoadingState,
    DetailNotFoundState,
    DetailPanel,
    DetailShareLinkButton,
} from "./DetailUi";
import { ReleaseDbChangeSummary } from "./ReleaseDbChangeSummary";
import { useReleaseDetail } from "./hooks/useReleaseDetail";
import { formatDateYmd } from "../../lib/uiFormat";
import { toSafeExternalUrl } from "../../shared/url/externalUrl";
import { EVENT_TAG_CHIP_CLASS } from "../ui/eventTagClass";

import type { SetlistSearchDb } from "../../lib/setlistSearchDb/types";

type ReleaseDetailPageProps = {
    db: SetlistSearchDb;
    releaseId: number;
    onResolveTitle?: (title: string) => void;
};

export function ReleaseDetailPage({
    db,
    releaseId,
    onResolveTitle,
}: ReleaseDetailPageProps) {
    const { loading, error, detail, changes } = useReleaseDetail(db, releaseId);

    useEffect(() => {
        if (detail?.title) {
            onResolveTitle?.(detail.title);
        }
    }, [detail?.title, onResolveTitle]);

    if (loading) return <DetailLoadingState />;
    if (error) return <DetailErrorState message={error} />;
    if (!detail) return <DetailNotFoundState message="お知らせが見つかりませんでした。" />;

    return (
        <div className="space-y-4">
            <DetailPanel className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                            {detail.announcementKind === "release"
                                ? "RELEASE"
                                : "ANNOUNCEMENT"}
                        </p>
                        <h1 className="min-w-0 break-words text-lg font-bold text-slate-900">
                            {detail.title}
                        </h1>
                        <p className="mt-1 text-xs text-slate-500">
                            公開日: {formatDateYmd(detail.releasedAt)}
                        </p>
                        {detail.relatedRelease ? (
                            <p className="mt-1 text-xs text-slate-500">
                                対象リリース: {detail.relatedRelease}
                            </p>
                        ) : null}
                    </div>
                    <DetailShareLinkButton />
                </div>

                <p className="mt-3 text-sm text-slate-700">{detail.summary}</p>

                {detail.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {detail.tags.map((tag) => (
                            <span key={`${detail.releaseId}-${tag}`} className={EVENT_TAG_CHIP_CLASS}>
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : null}

                {detail.parquetGeneratedAt || detail.parquetSignature ? (
                    <div className="mt-3 grid gap-1 text-xs text-slate-600">
                        {detail.parquetGeneratedAt ? (
                            <p>データ生成時刻: {detail.parquetGeneratedAt}</p>
                        ) : null}
                        {detail.parquetSignature ? (
                            <p className="break-all">データ署名: {detail.parquetSignature}</p>
                        ) : null}
                    </div>
                ) : null}
            </DetailPanel>

            <DetailPanel className="p-4">
                <h2 className="mb-3 text-base font-semibold text-slate-900">変更内容</h2>
                {detail.bodyMarkdown.trim().length === 0 ? (
                    <p className="border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">
                        本文はありません。
                    </p>
                ) : (
                    <div className="border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ children }) => (
                                    <h3 className="mt-4 text-base font-bold text-slate-900 first:mt-0">
                                        {children}
                                    </h3>
                                ),
                                h2: ({ children }) => (
                                    <h4 className="mt-4 text-sm font-bold text-slate-900 first:mt-0">
                                        {children}
                                    </h4>
                                ),
                                h3: ({ children }) => (
                                    <h5 className="mt-3 text-sm font-semibold text-slate-900 first:mt-0">
                                        {children}
                                    </h5>
                                ),
                                p: ({ children }) => (
                                    <p className="mt-2 whitespace-pre-wrap leading-6 first:mt-0">
                                        {children}
                                    </p>
                                ),
                                ul: ({ children }) => (
                                    <ul className="mt-2 list-disc space-y-1 pl-5 first:mt-0">
                                        {children}
                                    </ul>
                                ),
                                ol: ({ children }) => (
                                    <ol className="mt-2 list-decimal space-y-1 pl-5 first:mt-0">
                                        {children}
                                    </ol>
                                ),
                                li: ({ children }) => <li className="leading-6">{children}</li>,
                                a: ({ href, children }) => {
                                    const safeHref = toSafeExternalUrl(href);
                                    if (!safeHref) {
                                        return <span>{children}</span>;
                                    }
                                    return (
                                        <a
                                            href={safeHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline decoration-slate-500 underline-offset-2 hover:text-blue-700"
                                        >
                                            {children}
                                        </a>
                                    );
                                },
                                blockquote: ({ children }) => (
                                    <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 text-slate-700 first:mt-0">
                                        {children}
                                    </blockquote>
                                ),
                                code: ({ children }) => (
                                    <code className="rounded bg-slate-200 px-1 py-0.5 text-[12px]">
                                        {children}
                                    </code>
                                ),
                            }}
                        >
                            {detail.bodyMarkdown}
                        </ReactMarkdown>
                    </div>
                )}
            </DetailPanel>

            {changes.length > 0 ? (
                <DetailPanel className="p-4">
                    <h2 className="mb-3 text-base font-semibold text-slate-900">DB更新情報</h2>
                    <ReleaseDbChangeSummary changes={changes} />
                </DetailPanel>
            ) : null}
        </div>
    );
}
