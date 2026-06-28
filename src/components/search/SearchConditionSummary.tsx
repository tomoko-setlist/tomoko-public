import { SearchFilterChip } from "./SearchFilterChip";

type SearchConditionItem = {
    key: string;
    label: string;
    onClear: () => void;
};

type SearchConditionSummaryProps = {
    items: SearchConditionItem[];
    showCloseButton?: boolean;
    onClose?: () => void;
    closeLabel?: string;
    className?: string;
};

export function SearchConditionSummary({
    items,
    showCloseButton = false,
    onClose,
    closeLabel = "詳細条件を閉じる",
    className = "mt-4",
}: SearchConditionSummaryProps) {
    const hasItems = items.length > 0;

    return (
        <div className={`relative z-0 ${className}`.trim()}>
            <div className="flex flex-wrap items-center gap-2">
                {hasItems ? (
                    <div className="relative mr-2 bg-gray-700 px-2 py-0.5 text-xs font-medium text-white shadow-[1px_1px_0px_0px_rgba(31,41,55,0.35)]">
                        検索条件
                        <div className="absolute right-0 top-0 h-0 w-0 translate-x-full border-b-[10px] border-l-[8px] border-b-transparent border-l-gray-700 border-t-[10px] border-t-transparent" />
                    </div>
                ) : null}
                {items.map((item) => (
                    <SearchFilterChip
                        key={item.key}
                        label={item.label}
                        onClear={item.onClear}
                    />
                ))}
            </div>
            {showCloseButton && onClose ? (
                <div className="mt-3 flex w-full justify-center">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center text-sm font-semibold text-gray-700 underline underline-offset-2 transition hover:text-gray-900"
                        title={closeLabel}
                        aria-label={closeLabel}
                    >
                        {closeLabel}
                    </button>
                </div>
            ) : null}
        </div>
    );
}

export type { SearchConditionItem };
