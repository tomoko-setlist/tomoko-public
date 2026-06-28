import { GridIcon, TableIcon } from "../ui";

type SearchViewModeToggleProps = {
    viewMode: "table" | "card";
    onChange: (mode: "table" | "card") => void;
    className?: string;
};

export function SearchViewModeToggle({
    viewMode,
    onChange,
    className = "inline-flex items-center gap-1 rounded-none bg-white p-1",
}: SearchViewModeToggleProps) {
    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => onChange("table")}
                aria-label="テーブル表示"
                title="テーブル表示"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-none border-2 transition-colors ${
                    viewMode === "table"
                        ? "border-gray-800 bg-gray-200 text-gray-900"
                        : "border-transparent text-gray-600 hover:border-gray-400 hover:bg-gray-100"
                }`}
            >
                <TableIcon className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => onChange("card")}
                aria-label="カード表示"
                title="カード表示"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-none border-2 transition-colors ${
                    viewMode === "card"
                        ? "border-gray-800 bg-gray-200 text-gray-900"
                        : "border-transparent text-gray-600 hover:border-gray-400 hover:bg-gray-100"
                }`}
            >
                <GridIcon className="h-4 w-4" />
            </button>
        </div>
    );
}
