type SortArrowIndicatorProps = {
    active: boolean;
    order: "asc" | "desc";
    className?: string;
    activeClassName?: string;
    inactiveClassName?: string;
    neutralClassName?: string;
};

export function SortArrowIndicator({
    active,
    order,
    className = "ml-0.5 inline-flex flex-col gap-[1px] leading-[0.72] text-[9px] select-none",
    activeClassName = "text-current",
    inactiveClassName = "text-current/40",
    neutralClassName = "text-current/70",
}: SortArrowIndicatorProps) {
    const upClass = !active
        ? neutralClassName
        : order === "asc"
          ? activeClassName
          : inactiveClassName;
    const downClass = !active
        ? neutralClassName
        : order === "desc"
          ? activeClassName
          : inactiveClassName;

    return (
        <span aria-hidden="true" className={className}>
            <span
                className={`${upClass} inline-block h-0 w-0 border-x-[4px] border-x-transparent border-b-[5px] border-b-current`}
            />
            <span
                className={`${downClass} inline-block h-0 w-0 border-x-[4px] border-x-transparent border-t-[5px] border-t-current`}
            />
        </span>
    );
}
