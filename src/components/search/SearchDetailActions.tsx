import { FilterIcon, ResetIcon } from "../ui";

type SearchDetailActionsProps = {
    expanded: boolean;
    onToggle: () => void;
    onClear: () => void;
    clearDisabled?: boolean;
    openLabel?: string;
    closeLabel?: string;
    clearLabel?: string;
    className?: string;
};

export function SearchDetailActions({
    expanded,
    onToggle,
    onClear,
    clearDisabled = false,
    openLabel = "詳細条件を開く",
    closeLabel = "詳細条件を閉じる",
    clearLabel = "クリア",
    className = "flex items-center gap-2",
}: SearchDetailActionsProps) {
    const baseIconButtonClass =
        "inline-flex h-9 w-9 items-center justify-center rounded-none border-2 border-gray-800 shadow-[2px_2px_0px_0px_rgba(31,41,55,0.7)] transition-all duration-200 hover:shadow-[1px_1px_0px_0px_rgba(31,41,55,0.8)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none";
    const toggleButtonClass = expanded
        ? `${baseIconButtonClass} bg-gray-800 text-white hover:bg-gray-900`
        : `${baseIconButtonClass} bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-800`;

    return (
        <div className={className}>
            <button
                type="button"
                onClick={onToggle}
                className={toggleButtonClass}
                title={expanded ? closeLabel : openLabel}
                aria-label={expanded ? closeLabel : openLabel}
            >
                <FilterIcon className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={onClear}
                disabled={clearDisabled}
                className={
                    clearDisabled
                        ? `${baseIconButtonClass} cursor-not-allowed border-gray-400 bg-gray-100 text-gray-400 shadow-none`
                        : `${baseIconButtonClass} bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900`
                }
                title={clearLabel}
                aria-label={clearLabel}
            >
                <ResetIcon className="h-4 w-4" />
            </button>
        </div>
    );
}
