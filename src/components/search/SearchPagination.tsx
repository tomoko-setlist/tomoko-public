import { PAGE_SIZE_OPTIONS } from "../../lib/constants/searchDefaults";
import {
    ArrowLeftIcon,
    DoubleArrowLeftIcon,
    DoubleArrowRightIcon,
} from "../ui";

type SearchPaginationProps = {
    page: number;
    totalPages: number;
    pageSize: number;
    pageInput: string;
    setPageInput: (value: string) => void;
    onGoToPage: (nextPage: number) => void;
    onPageSizeChange: (nextPageSize: number) => void;
    pageSizeOptions?: number[];
    className?: string;
};

export function SearchPagination({
    page,
    totalPages,
    pageSize,
    pageInput,
    setPageInput,
    onGoToPage,
    onPageSizeChange,
    pageSizeOptions = [...PAGE_SIZE_OPTIONS],
    className = "mt-4 overflow-x-auto rounded-none border-2 border-slate-300 bg-slate-50 px-2 py-2",
}: SearchPaginationProps) {
    const hasPrev = page > 1;
    const hasNext = page < totalPages;
    const iconButtonClass =
        "inline-flex h-7 w-7 items-center justify-center rounded-none border-2 border-slate-500 bg-white text-slate-700 shadow-[2px_2px_0px_0px_rgba(100,116,139,0.45)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0px_0px_rgba(100,116,139,0.45)] hover:bg-slate-100 active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0 sm:h-8 sm:w-8";
    const scrollToTop = () => {
        if (typeof window !== "undefined") {
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }
    };
    const goToPageAndScroll = (nextPage: number) => {
        onGoToPage(nextPage);
        scrollToTop();
    };
    const changePageSizeAndScroll = (nextPageSize: number) => {
        onPageSizeChange(nextPageSize);
        scrollToTop();
    };

    return (
        <div className={className}>
            <div className="flex min-w-max items-center justify-between gap-2">
            <label className="flex items-center text-xs text-slate-600">
                <select
                    className="rounded-none border-2 border-slate-500 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-[2px_2px_0px_0px_rgba(100,116,139,0.35)] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:px-3 sm:py-1.5 sm:text-sm"
                    value={pageSize}
                    onChange={(event) =>
                        changePageSizeAndScroll(Number(event.target.value))
                    }
                    title="表示件数"
                    aria-label="表示件数"
                >
                    {pageSizeOptions.map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </select>
            </label>
            <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                <button
                    type="button"
                    className={iconButtonClass}
                    onClick={() => hasPrev && goToPageAndScroll(1)}
                    disabled={!hasPrev}
                    aria-label="最初のページ"
                    title="最初のページ"
                >
                    <DoubleArrowLeftIcon className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    className={iconButtonClass}
                    onClick={() => hasPrev && goToPageAndScroll(page - 1)}
                    disabled={!hasPrev}
                    aria-label="前のページ"
                    title="前のページ"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <div className="inline-flex items-center gap-1 rounded-none border-2 border-slate-500 bg-white px-1.5 py-1 text-xs shadow-[2px_2px_0px_0px_rgba(100,116,139,0.35)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0px_0px_rgba(100,116,139,0.35)] sm:px-2 sm:text-sm">
                    <input
                        className="w-8 border-none bg-transparent px-0.5 text-center font-semibold text-slate-800 focus:outline-none sm:w-12 sm:px-1"
                        value={pageInput}
                        autoComplete="off"
                        onChange={(event) => setPageInput(event.target.value)}
                        onBlur={() => {
                            const next = Number(pageInput);
                            if (Number.isFinite(next)) {
                                goToPageAndScroll(next);
                            } else {
                                setPageInput(String(page));
                            }
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                const next = Number(pageInput);
                                if (Number.isFinite(next)) {
                                    goToPageAndScroll(next);
                                } else {
                                    setPageInput(String(page));
                                }
                                (event.currentTarget).blur();
                            }
                        }}
                        aria-label="ページ番号"
                        title={`ページ番号 (1-${totalPages})`}
                    />
                    <span className="text-slate-400">/</span>
                    <span className="min-w-6 text-right font-semibold text-slate-600 sm:min-w-8">
                        {totalPages}
                    </span>
                </div>
                <button
                    type="button"
                    className={iconButtonClass}
                    onClick={() => hasNext && goToPageAndScroll(page + 1)}
                    disabled={!hasNext}
                    aria-label="次のページ"
                    title="次のページ"
                >
                    <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                </button>
                <button
                    type="button"
                    className={iconButtonClass}
                    onClick={() => hasNext && goToPageAndScroll(totalPages)}
                    disabled={!hasNext}
                    aria-label="最後のページ"
                    title="最後のページ"
                >
                    <DoubleArrowRightIcon className="h-4 w-4" />
                </button>
            </div>
            </div>
        </div>
    );
}
