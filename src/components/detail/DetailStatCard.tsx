import type { ReactNode } from "react";

type DetailStatCardProps = {
    label: string;
    value: ReactNode;
    rankText?: ReactNode;
    rankClassName?: string;
    className?: string;
};

export function DetailStatCard({
    label,
    value,
    rankText,
    rankClassName = "text-[11px] font-semibold text-slate-700",
    className = "",
}: DetailStatCardProps) {
    return (
        <div className={`border-2 border-gray-800 bg-white p-2 ${className}`.trim()}>
            <p className="text-slate-500">{label}</p>
            <p className="text-lg font-bold text-slate-900">{value}</p>
            {rankText !== undefined ? (
                <p className={rankClassName}>{rankText}</p>
            ) : null}
        </div>
    );
}

