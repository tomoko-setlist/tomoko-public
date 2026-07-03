import { useEffect } from "react";

import { listPublishedArticles, renderArticleTags } from "../../content/articles";
import { formatDateYmd } from "../../lib/uiFormat";
import { DetailPanel, DetailShareLinkButton } from "../detail/DetailUi";

type ArticlesPageProps = {
    onResolveTitle?: (title: string) => void;
    onOpenArticle: (slug: string) => void;
};

export function ArticlesPage({ onResolveTitle, onOpenArticle }: ArticlesPageProps) {
    const articles = listPublishedArticles();

    useEffect(() => {
        onResolveTitle?.("記事一覧");
    }, [onResolveTitle]);

    return (
        <div className="space-y-4">
            <DetailPanel className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                            ARTICLES
                        </p>
                        <h1 className="text-lg font-bold text-slate-900">記事一覧</h1>
                    </div>
                    <DetailShareLinkButton />
                </div>
            </DetailPanel>

            <div className="grid gap-3 lg:grid-cols-2">
                {articles.map((article) => (
                    <DetailPanel key={article.slug} className="p-0">
                        <article className="p-4 md:p-5">
                            <p className="text-[11px] font-semibold tracking-wide text-neutral-500">
                                {formatDateYmd(article.publishedAt)}
                            </p>
                            <button
                                type="button"
                                onClick={() => onOpenArticle(article.slug)}
                                className="mt-1 text-left text-lg font-bold leading-snug text-blue-700 hover:underline"
                            >
                                {article.title}
                            </button>
                            <p className="mt-3 text-sm leading-6 text-neutral-700">
                                {article.summary}
                            </p>
                            {article.tags.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-1">
                                    {renderArticleTags(article)}
                                </div>
                            ) : null}
                        </article>
                    </DetailPanel>
                ))}
            </div>
        </div>
    );
}

export default ArticlesPage;
