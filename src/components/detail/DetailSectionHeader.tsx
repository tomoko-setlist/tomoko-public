import type { ReactNode } from "react";

type DetailSectionHeaderProps = {
    title: ReactNode;
    right?: ReactNode;
    below?: ReactNode;
    className?: string;
    titleClassName?: string;
    belowClassName?: string;
};

export function DetailSectionHeader({
    title,
    right,
    below,
    className = "mb-3",
    titleClassName = "text-base font-semibold text-slate-900",
    belowClassName = "mb-3",
}: DetailSectionHeaderProps) {
    return (
        <>
            <div className={`flex flex-col gap-2 md:flex-row md:items-center md:justify-between ${className}`.trim()}>
                <h2 className={titleClassName}>{title}</h2>
                {right ?? null}
            </div>
            {below ? <div className={belowClassName}>{below}</div> : null}
        </>
    );
}

