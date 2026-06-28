type SearchFilterChipProps = {
    label: string;
    onClear: () => void;
    className?: string;
    iconClassName?: string;
};

export function SearchFilterChip({
    label,
    onClear,
    className = "inline-flex items-center rounded-none border border-gray-200 bg-gray-100 px-2 py-1 text-xs text-gray-800 hover:border-gray-300",
    iconClassName = "ml-1 h-3 w-3",
}: SearchFilterChipProps) {
    return (
        <button type="button" className={className} onClick={onClear}>
            <span>{label}</span>
            <span aria-hidden="true" className={iconClassName}>
                ×
            </span>
        </button>
    );
}
