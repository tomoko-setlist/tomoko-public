type TagFilterChipsProps = {
    options: string[];
    selected: string[];
    onChange: (next: string[]) => void;
    className?: string;
};

export function TagFilterChips({
    options,
    selected,
    onChange,
    className = "",
}: TagFilterChipsProps) {
    if (options.length === 0) {
        return null;
    }

    return (
        <div className={`flex flex-wrap items-center gap-1 ${className}`.trim()}>
            {options.map((tag) => {
                const active = selected.includes(tag);
                return (
                    <button
                        key={tag}
                        type="button"
                        onClick={() =>
                            onChange(
                                active
                                    ? selected.filter((value) => value !== tag)
                                    : [...selected, tag],
                            )
                        }
                        className={`rounded-none border px-2 py-0.5 text-[11px] shadow-[1px_1px_0_rgba(15,23,42,0.25)] ${
                            active
                                ? "border-gray-800 bg-gray-200 text-gray-900"
                                : "border-gray-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                        {tag}
                    </button>
                );
            })}
            {selected.length > 0 ? (
                <button
                    type="button"
                    onClick={() => onChange([])}
                    className="rounded-none border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-slate-600 shadow-[1px_1px_0_rgba(15,23,42,0.25)] hover:bg-slate-50"
                >
                    解除
                </button>
            ) : null}
        </div>
    );
}
