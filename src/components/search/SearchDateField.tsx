import { useState, type KeyboardEvent } from "react";

import { clampYmd, parseFlexibleYmd } from "../../lib/searchDateRange";

const DEFAULT_PLACEHOLDER = "YYYY-MM-DD";

type SearchDateFieldProps = {
    label: string;
    value: string;
    disabled?: boolean;
    compact?: boolean;
    hideLabel?: boolean;
    placeholder?: string;
    onChange: (value: string) => void;
};

type DraftState = {
    anchor: string;
    text: string;
    error: string;
};

export function SearchDateField({
    label,
    value,
    disabled = false,
    compact = false,
    hideLabel = false,
    placeholder = DEFAULT_PLACEHOLDER,
    onChange,
}: SearchDateFieldProps) {
    const [draft, setDraft] = useState<DraftState | null>(null);
    const draftActive = draft !== null && draft.anchor === value;
    const displayText = draftActive ? draft.text : value;
    const error = draftActive ? draft.error : "";

    const updateDraft = (patch: Partial<Pick<DraftState, "text" | "error">>) => {
        setDraft({
            anchor: value,
            text: draftActive ? draft.text : value,
            error: draftActive ? draft.error : "",
            ...patch,
        });
    };

    const commit = () => {
        const trimmed = displayText.trim();
        if (!trimmed) {
            setDraft(null);
            onChange("");
            return;
        }
        const parsed = parseFlexibleYmd(trimmed);
        if (parsed === null) {
            updateDraft({ error: "YYYY-MM-DD または YYYYMMDD 形式で入力してください" });
            return;
        }
        const normalized = clampYmd(parsed);
        setDraft(null);
        onChange(normalized);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            commit();
        }
    };

    const inputClassName = [
        "min-w-0 w-full rounded-none border bg-white px-2 py-0 font-mono focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        compact ? "h-7 text-xs" : "h-6 text-[11px]",
        error ? "border-red-700" : "border-gray-400",
    ].join(" ");

    return (
        <label className="min-w-0 text-xs font-semibold text-slate-600">
            <span className={hideLabel ? "sr-only" : ""}>{label}</span>
            <div className={hideLabel ? "" : "mt-1 space-y-1"}>
                <input
                    value={displayText}
                    onChange={(event) => {
                        updateDraft({ text: event.target.value, error: "" });
                    }}
                    onBlur={commit}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    className={inputClassName}
                    placeholder={placeholder}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={label}
                    aria-invalid={error ? true : undefined}
                />
                {error ? <p className="text-[11px] font-semibold text-red-700">{error}</p> : null}
            </div>
        </label>
    );
}
