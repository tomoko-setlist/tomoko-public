import { useEffect, useMemo, useRef, useState } from "react";

import { DROPDOWN_CLOSE_DELAY_MS } from "../../lib/constants/interaction";
import { XIcon } from "../ui";

import type { SearchSuggestion } from "../../lib/setlistSearchDb/types";

type Selection = {
    key: string;
    label: string;
};

type NormalizedPerformerMultiInputProps = {
    selections: Selection[];
    onChange: (next: Selection[]) => void;
    onFetchSuggestions: (term: string) => Promise<SearchSuggestion[]>;
    disabled?: boolean;
    placeholder?: string;
};

export function NormalizedPerformerMultiInput({
    selections,
    onChange,
    onFetchSuggestions,
    disabled = false,
    placeholder = "候補から歌唱者を追加",
}: NormalizedPerformerMultiInputProps) {
    const [value, setValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const closeTimerRef = useRef<number | null>(null);
    const requestIdRef = useRef(0);

    const selectedKeys = useMemo(
        () => new Set(selections.map((item) => item.key)),
        [selections],
    );

    useEffect(() => {
        return () => {
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (disabled || !isFocused || value.trim().length < 1) {
            setLoading(false);
            setSuggestions([]);
            setIsOpen(false);
            return;
        }
        const currentRequestId = requestIdRef.current + 1;
        requestIdRef.current = currentRequestId;
        const timer = window.setTimeout(() => {
            void (async () => {
                setLoading(true);
                try {
                    const rows = await onFetchSuggestions(value.trim());
                    if (requestIdRef.current !== currentRequestId) return;
                    setSuggestions(rows.filter((row) => !selectedKeys.has(row.value)));
                    setIsOpen(true);
                } catch {
                    if (requestIdRef.current !== currentRequestId) return;
                    setSuggestions([]);
                    setIsOpen(false);
                } finally {
                    if (requestIdRef.current === currentRequestId) {
                        setLoading(false);
                    }
                }
            })();
        }, 180);
        return () => window.clearTimeout(timer);
    }, [disabled, isFocused, onFetchSuggestions, selectedKeys, value]);

    const addSelection = (suggestion: SearchSuggestion) => {
        if (selectedKeys.has(suggestion.value)) return;
        onChange([
            ...selections,
            {
                key: suggestion.value,
                label: suggestion.label,
            },
        ]);
        setValue("");
        setSuggestions([]);
        setIsOpen(false);
    };

    return (
        <label className="text-xs font-semibold text-slate-600">
            正規化歌唱者
            <div className="mt-1 space-y-2">
                <div className="relative">
                    <input
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        onFocus={() => {
                            if (closeTimerRef.current !== null) {
                                window.clearTimeout(closeTimerRef.current);
                                closeTimerRef.current = null;
                            }
                            setIsFocused(true);
                        }}
                        onBlur={() => {
                            setIsFocused(false);
                            closeTimerRef.current = window.setTimeout(() => {
                                setIsOpen(false);
                            }, DROPDOWN_CLOSE_DELAY_MS);
                        }}
                        disabled={disabled}
                        placeholder={placeholder}
                        autoComplete="off"
                        className="w-full rounded-none border-2 border-gray-800 px-3 py-2 text-sm focus:outline-none"
                    />
                    {isOpen ? (
                        <div className="absolute z-20 mt-1 w-full rounded-none border-2 border-gray-800 bg-white">
                            {loading ? (
                                <div className="px-2 py-1.5 text-xs text-slate-500">
                                    候補取得中...
                                </div>
                            ) : suggestions.length === 0 ? (
                                <div className="px-2 py-1.5 text-xs text-slate-500">
                                    候補がありません
                                </div>
                            ) : (
                                <ul className="max-h-56 overflow-auto py-1">
                                    {suggestions.map((item) => (
                                        <li key={item.value}>
                                            <button
                                                type="button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => addSelection(item)}
                                                className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                                            >
                                                <span className="truncate">{item.label}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ) : null}
                </div>
                {selections.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {selections.map((item) => (
                            <span
                                key={item.key}
                                className="inline-flex items-center gap-1 rounded-none border-2 border-gray-800 bg-white px-2 py-1 text-[11px] text-slate-700"
                            >
                                <span>{item.label}</span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onChange(
                                            selections.filter(
                                                (selection) => selection.key !== item.key,
                                            ),
                                        )
                                    }
                                    className="inline-flex h-4 w-4 items-center justify-center text-slate-500"
                                    aria-label={`${item.label} を削除`}
                                    title="削除"
                                >
                                    <XIcon className="h-3.5 w-3.5" />
                                </button>
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
        </label>
    );
}
