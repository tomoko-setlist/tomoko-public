import { SortArrowIndicator } from "../ui/SortArrowIndicator";

type SearchSortableHeaderProps = {
    label: string;
    sortable?: boolean;
    active?: boolean;
    sortOrder?: "asc" | "desc";
    onSort?: () => void;
    thClassName?: string;
    buttonClassName?: string;
    activeIconClassName?: string;
    inactiveIconClassName?: string;
    activeThClassName?: string;
    inactiveThClassName?: string;
};

export function SearchSortableHeader({
    label,
    sortable = false,
    active = false,
    sortOrder = "asc",
    onSort,
    thClassName = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white",
    buttonClassName = "inline-flex items-center gap-1 whitespace-nowrap",
    activeIconClassName = "text-white",
    inactiveIconClassName = "text-white/70",
    activeThClassName = "bg-red-700",
    inactiveThClassName = "",
}: SearchSortableHeaderProps) {
    if (!sortable) {
        return <th className={thClassName}>{label}</th>;
    }

    return (
        <th className={`${thClassName} ${active ? activeThClassName : inactiveThClassName}`.trim()}>
            <button
                type="button"
                onClick={onSort}
                className={buttonClassName}
                title={`${label}で並び替え`}
            >
                <span>{label}</span>
                <SortArrowIndicator
                    active={active}
                    order={sortOrder}
                    className="ml-0.5 inline-flex flex-col gap-[2px] leading-[0.72] text-[9px] select-none"
                    activeClassName={activeIconClassName}
                    inactiveClassName={inactiveIconClassName}
                    neutralClassName={inactiveIconClassName}
                />
            </button>
        </th>
    );
}
