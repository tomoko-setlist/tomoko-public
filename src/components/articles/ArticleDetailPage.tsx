import { useEffect } from "react";

import { getArticleBySlug, renderArticleTags } from "../../content/articles";
import { formatDateYmd } from "../../lib/uiFormat";
import {
    DetailNotFoundState,
    DetailPanel,
    DetailShareLinkButton,
} from "../detail/DetailUi";

type ArticleDetailPageProps = {
    slug: string;
    onResolveTitle?: (title: string) => void;
};

export function ArticleDetailPage({ slug, onResolveTitle }: ArticleDetailPageProps) {
    const article = getArticleBySlug(slug);

    useEffect(() => {
        if (article?.title) {
            onResolveTitle?.(article.title);
        }
    }, [article?.title, onResolveTitle]);

    if (!article || article.status !== "published") {
        return <DetailNotFoundState message="記事が見つかりませんでした。" />;
    }

    return (
        <div className="space-y-4">
            <DetailPanel className="overflow-hidden p-0">
                <article>
                    <header className="border-b-2 border-gray-800 bg-white px-4 py-5 md:px-8 md:py-8">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold tracking-[0.16em] text-red-700">
                                    {article.heroLabel}
                                </p>
                                <h1 className="mt-2 max-w-3xl break-words text-2xl font-bold leading-tight text-slate-950 md:text-4xl">
                                    {article.title}
                                </h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                                    {article.summary}
                                </p>
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-500">
                                        公開日: {formatDateYmd(article.publishedAt)}
                                    </span>
                                    {renderArticleTags(article)}
                                </div>
                            </div>
                            <DetailShareLinkButton />
                        </div>
                    </header>
                    <div className="bg-white px-4 py-6 md:px-8 md:py-10">
                        {article.content}
                    </div>
                </article>
            </DetailPanel>
        </div>
    );
}

export default ArticleDetailPage;
