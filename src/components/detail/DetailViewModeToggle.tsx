import { BarChartHorizontalIcon, TableIcon } from "../ui";

type DetailViewMode = "list" | "analysis";

type DetailViewModeToggleProps = {
    value: DetailViewMode;
    onChange: (next: DetailViewMode) => void;
    className?: string;
};

export function DetailViewModeToggle({
    value,
    onChange,
    className = "",
}: DetailViewModeToggleProps) {
    return (
        <div className={`inline-flex p-1 ${className}`.trim()}>
            <button
                type="button"
                onClick={() => onChange("list")}
                className={`inline-flex items-center gap-1 rounded-none border-2 px-2 py-1 text-xs ${
                    value === "list"
                        ? "border-gray-800 bg-gray-200 text-gray-900"
                        : "border-transparent text-gray-700 hover:border-gray-300 hover:bg-gray-100"
                }`}
            >
                <TableIcon className="h-4 w-4" />
                一覧
            </button>
            <button
                type="button"
                onClick={() => onChange("analysis")}
                className={`inline-flex items-center gap-1 rounded-none border-2 px-2 py-1 text-xs ${
                    value === "analysis"
                        ? "border-gray-800 bg-gray-200 text-gray-900"
                        : "border-transparent text-gray-700 hover:border-gray-300 hover:bg-gray-100"
                }`}
            >
                <BarChartHorizontalIcon className="h-4 w-4" />
                分析
            </button>
        </div>
    );
}

