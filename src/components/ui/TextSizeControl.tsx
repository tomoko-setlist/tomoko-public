import {
    getAdjacentTextSizeLevel,
    TEXT_SIZE_LABELS,
    TEXT_SIZE_ORDER,
    TEXT_SIZE_PREVIEW_CLASS,
    type TextSizeLevel,
} from "./textSize";

type TextSizeControlProps = {
    value: TextSizeLevel;
    onChange: (value: TextSizeLevel) => void;
    targetLabel?: string;
    className?: string;
};

export function TextSizeControl({
    value,
    onChange,
    targetLabel = "文字",
    className = "",
}: TextSizeControlProps) {
    const index = Math.max(0, TEXT_SIZE_ORDER.indexOf(value));
    const canShrink = index > 0;
    const canGrow = index < TEXT_SIZE_ORDER.length - 1;
    const smaller = getAdjacentTextSizeLevel(value, "smaller");
    const larger = getAdjacentTextSizeLevel(value, "larger");
    const next = canGrow ? larger : TEXT_SIZE_ORDER[0];
    const label = TEXT_SIZE_LABELS[value];

    return (
        <div
            className={[
                "hidden select-none grid-cols-[2rem_1.25rem] border-2 border-gray-800 bg-white sm:inline-grid",
                className,
            ].filter(Boolean).join(" ")}
            role="group"
            title={`${targetLabel}サイズ: ${label}`}
            aria-label={`${targetLabel}サイズ: ${label}`}
        >
            <button
                type="button"
                onClick={() => onChange(next)}
                className={`flex h-8 w-8 items-center justify-center font-bold leading-none text-gray-800 transition-colors hover:bg-gray-100 ${TEXT_SIZE_PREVIEW_CLASS[value]}`}
                title={`${targetLabel}サイズを切り替え`}
                aria-label={`${targetLabel}サイズを切り替え`}
            >
                A
            </button>
            <div className="flex h-8 w-5 flex-col border-l-2 border-gray-800">
                <button
                    type="button"
                    onClick={() => onChange(larger)}
                    disabled={!canGrow}
                    className="flex h-1/2 items-center justify-center text-[11px] font-black leading-none text-gray-900 transition-colors hover:bg-gray-100 disabled:text-slate-300 disabled:hover:bg-white"
                    title={`${targetLabel}を大きく`}
                    aria-label={`${targetLabel}を大きく`}
                >
                    +
                </button>
                <button
                    type="button"
                    onClick={() => onChange(smaller)}
                    disabled={!canShrink}
                    className="flex h-1/2 items-center justify-center border-t-2 border-gray-800 text-[11px] font-black leading-none text-gray-900 transition-colors hover:bg-gray-100 disabled:border-gray-300 disabled:text-slate-300 disabled:hover:bg-white"
                    title={`${targetLabel}を小さく`}
                    aria-label={`${targetLabel}を小さく`}
                >
                    -
                </button>
            </div>
        </div>
    );
}
