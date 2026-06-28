import { useCallback, useEffect, useRef, useState } from "react";

import { DROPDOWN_CLOSE_DELAY_MS } from "../../lib/constants/interaction";
import { recordSuggestionSelection } from "../../lib/suggestionMetrics";
import { LightbulbIcon, XIcon } from "../ui";

import type {
    SearchSuggestField,
    SearchSuggestVariant,
    SearchSuggestion,
} from "../../lib/setlistSearchDb/types";

type AutocompleteTextInputProps = {
    value: string;
    onChange: (value: string) => void;
    onFetchSuggestions?: (term: string) => Promise<SearchSuggestion[]>;
    onSuggestionApply?: (
        selected: SearchSuggestion,
        field?: SearchSuggestField,
    ) => void;
    suggestField?: SearchSuggestField;
    suggestVariant?: SearchSuggestVariant;
    suggestEnabled?: boolean;
    disabled?: boolean;
    placeholder?: string;
    ariaLabel?: string;
    className?: string;
    inputClassName?: string;
    emptyText?: string;
    minSuggestChars?: number;
    suggestDelayMs?: number;
    autoComplete?: string;
    suggestionsPanelClassName?: string;
    suggestionsPanelExtraWidthPx?: number;
    reservedButtonPadding?: string;
    iconDensity?: "default" | "compact";
};

export function AutocompleteTextInput({
    value,
    onChange,
    onFetchSuggestions,
    onSuggestionApply,
    suggestField,
    suggestVariant = "A",
    suggestEnabled = true,
    disabled = false,
    placeholder,
    ariaLabel,
    className,
    inputClassName = "w-full rounded-none border-2 border-gray-800 px-3 py-2 pr-8 text-sm focus:outline-none",
    emptyText = "候補がありません",
    minSuggestChars = 1,
    suggestDelayMs = 80,
    autoComplete = "off",
    suggestionsPanelClassName,
    suggestionsPanelExtraWidthPx = 0,
    reservedButtonPadding,
    iconDensity = "default",
}: AutocompleteTextInputProps) {
    const [isFocused, setIsFocused] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [localSuggestEnabled, setLocalSuggestEnabled] = useState(true);
    const fetchRequestRef = useRef(0);
    const closeTimerRef = useRef<number | null>(null);
    const lastAppliedValueRef = useRef<string | null>(null);
    const dismissedValueRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
            }
        };
    }, []);

    const canUseSuggestions = suggestEnabled && Boolean(onFetchSuggestions);
    const effectiveSuggestEnabled = canUseSuggestions && localSuggestEnabled;

    const closeSuggestionState = useCallback(() => {
        fetchRequestRef.current += 1;
        setLoading(false);
        setSuggestions([]);
        setIsOpen(false);
        setActiveIndex(-1);
    }, []);

    useEffect(() => {
        if (effectiveSuggestEnabled) {
            return;
        }
        closeSuggestionState();
    }, [closeSuggestionState, effectiveSuggestEnabled]);

    useEffect(() => {
        if (disabled || !effectiveSuggestEnabled || !onFetchSuggestions) {
            setLoading(false);
            setSuggestions([]);
            setIsOpen(false);
            setActiveIndex(-1);
            return;
        }
        if (
            lastAppliedValueRef.current !== null &&
            value === lastAppliedValueRef.current
        ) {
            lastAppliedValueRef.current = null;
            setLoading(false);
            setSuggestions([]);
            setIsOpen(false);
            setActiveIndex(-1);
            return;
        }
        const term = value.trim();
        if (!term || term.length < minSuggestChars || !isFocused) {
            setLoading(false);
            setSuggestions([]);
            setIsOpen(false);
            setActiveIndex(-1);
            return;
        }
        if (dismissedValueRef.current === term) {
            setLoading(false);
            setIsOpen(false);
            setActiveIndex(-1);
            return;
        }

        const currentRequest = fetchRequestRef.current + 1;
        fetchRequestRef.current = currentRequest;
        setLoading(suggestions.length === 0);
        if (!isOpen) {
            setIsOpen(true);
        }
        setActiveIndex(-1);
        const timer = window.setTimeout(() => {
            void (async () => {
                try {
                    const rows = await onFetchSuggestions(term);
                    if (fetchRequestRef.current !== currentRequest) return;
                    if (dismissedValueRef.current === term) return;
                    setSuggestions(rows);
                    setIsOpen(true);
                    setActiveIndex(-1);
                } catch {
                    if (fetchRequestRef.current !== currentRequest) return;
                    setSuggestions([]);
                    setIsOpen(false);
                    setActiveIndex(-1);
                } finally {
                    if (fetchRequestRef.current === currentRequest) {
                        setLoading(false);
                    }
                }
            })();
        }, suggestDelayMs);

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        disabled,
        isFocused,
        isOpen,
        minSuggestChars,
        onFetchSuggestions,
        suggestDelayMs,
        effectiveSuggestEnabled,
        suggestions.length,
        value,
    ]);

    const canClear = !disabled && value.length > 0;
    const highlightTerm = value.trim();
    const effectiveReservedButtonPadding = reservedButtonPadding ?? (iconDensity === "compact" ? "1.35rem" : "1.6rem");
    const effectiveReservedLeftPadding = canUseSuggestions
        ? iconDensity === "compact"
            ? "1.3rem"
            : "1.6rem"
        : undefined;
    const suggestButtonClass =
        iconDensity === "compact"
            ? "left-0.5 h-4 w-4"
            : "left-1 h-5 w-5";
    const suggestIconClass = iconDensity === "compact" ? "h-3 w-3" : "h-3.5 w-3.5";
    const clearButtonClass =
        iconDensity === "compact"
            ? "right-0.5 h-4 w-4"
            : "right-1 h-5 w-5";
    const clearIconClass = iconDensity === "compact" ? "h-3 w-3" : "h-3.5 w-3.5";

    const applySuggestion = (selected: SearchSuggestion) => {
        lastAppliedValueRef.current = selected.value;
        dismissedValueRef.current = selected.value.trim();
        onChange(selected.value);
        setIsOpen(false);
        setActiveIndex(-1);
        if (suggestField) {
            recordSuggestionSelection(suggestField, suggestVariant);
        }
        onSuggestionApply?.(selected, suggestField);
    };

    const closeSuggestions = () => {
        dismissedValueRef.current = value.trim();
        setIsOpen(false);
        setActiveIndex(-1);
    };

    return (
        <div className={`relative ${className ?? ""}`}>
            <input
                aria-label={ariaLabel}
                className={inputClassName}
                style={
                    effectiveReservedButtonPadding || effectiveReservedLeftPadding
                        ? {
                              ...(effectiveReservedButtonPadding
                                  ? { paddingRight: effectiveReservedButtonPadding }
                                  : {}),
                              ...(effectiveReservedLeftPadding
                                  ? { paddingLeft: effectiveReservedLeftPadding }
                                  : {}),
                          }
                        : undefined
                }
                value={value}
                onChange={(event) => {
                    dismissedValueRef.current = null;
                    onChange(event.target.value);
                }}
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
                        setActiveIndex(-1);
                    }, DROPDOWN_CLOSE_DELAY_MS);
                }}
                onKeyDown={(event) => {
                    if (!isOpen || suggestions.length === 0) {
                        if (event.key === "Escape") {
                            setIsOpen(false);
                            setActiveIndex(-1);
                        }
                        return;
                    }
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setActiveIndex((prev) =>
                            prev >= suggestions.length - 1 ? 0 : prev + 1,
                        );
                        return;
                    }
                    if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActiveIndex((prev) =>
                            prev <= 0 ? suggestions.length - 1 : prev - 1,
                        );
                        return;
                    }
                    if (event.key === "Enter") {
                        if (activeIndex >= 0 && activeIndex < suggestions.length) {
                            event.preventDefault();
                            const selected = suggestions[activeIndex];
                            applySuggestion(selected);
                        }
                        return;
                    }
                    if (event.key === "Escape") {
                        setIsOpen(false);
                        setActiveIndex(-1);
                    }
                }}
                disabled={disabled}
                placeholder={placeholder}
                autoComplete={autoComplete}
            />
            {canUseSuggestions ? (
                <button
                    type="button"
                    onMouseDown={(event) => {
                        event.preventDefault();
                    }}
                    onClick={() => {
                        setLocalSuggestEnabled((prev) => {
                            const next = !prev;
                            if (!next) {
                                closeSuggestionState();
                            } else {
                                dismissedValueRef.current = null;
                            }
                            return next;
                        });
                    }}
                    disabled={disabled}
                    aria-label={
                        localSuggestEnabled ? "候補をOFFにする" : "候補をONにする"
                    }
                    aria-pressed={localSuggestEnabled}
                    title={localSuggestEnabled ? "候補をOFFにする" : "候補をONにする"}
                    className={`absolute top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-none border border-transparent transition-colors disabled:pointer-events-none disabled:opacity-30 ${suggestButtonClass} ${
                        localSuggestEnabled
                            ? "text-amber-600 hover:bg-amber-50"
                            : "text-slate-400 hover:bg-slate-100"
                    }`}
                >
                    <LightbulbIcon className={suggestIconClass} />
                </button>
            ) : null}
            <button
                type="button"
                onClick={() => {
                    dismissedValueRef.current = "";
                    setIsOpen(false);
                    setActiveIndex(-1);
                    onChange("");
                }}
                disabled={!canClear}
                aria-label="入力をクリア"
                title="入力をクリア"
                className={`absolute top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-none border border-transparent text-slate-500 disabled:pointer-events-none disabled:opacity-30 ${clearButtonClass}`}
            >
                <XIcon className={clearIconClass} />
            </button>
            {effectiveSuggestEnabled && isOpen ? (
                <div
                    className={`absolute z-20 mt-1 w-full rounded-none border-2 border-gray-800 bg-white ${suggestionsPanelClassName ?? ""}`}
                    style={
                        suggestionsPanelExtraWidthPx > 0
                            ? { width: `calc(100% + ${suggestionsPanelExtraWidthPx}px)` }
                            : undefined
                    }
                >
                    <div className="flex justify-end border-b border-slate-200 px-1 py-0.5">
                        <button
                            type="button"
                            onMouseDown={(event) => {
                                event.preventDefault();
                            }}
                            onClick={closeSuggestions}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-none text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="候補を閉じる"
                            title="候補を閉じる"
                        >
                            <XIcon className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    {loading ? (
                        <div className="px-2 py-1.5 text-xs text-slate-500">
                            候補取得中...
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-slate-500">
                            {emptyText}
                        </div>
                    ) : (
                        <ul className="max-h-56 overflow-auto py-1">
                            {suggestions.map((item, index) => (
                                <li key={`${item.value}-${index}`}>
                                    <button
                                        type="button"
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                        }}
                                        onClick={() => {
                                            applySuggestion(item);
                                        }}
                                        className={`flex w-full items-center px-2 py-1.5 text-left text-xs ${
                                            activeIndex === index
                                                ? "bg-gray-200 text-slate-900"
                                                : "bg-white text-slate-700 hover:bg-slate-100"
                                        }`}
                                    >
                                        <span className="truncate">
                                            {renderHighlightedLabel(item.label, highlightTerm)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}
        </div>
    );
}

function renderHighlightedLabel(label: string, rawTerm: string) {
    const term = rawTerm.trim();
    if (!term) return label;

    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "ig");
    const parts = label.split(regex);
    if (parts.length <= 1) return label;
    const lowerTerm = term.toLowerCase();

    return parts.map((part, index) =>
        part.toLowerCase() === lowerTerm ? (
            <mark
                key={`${part}-${index}`}
                className="bg-yellow-200 px-0.5 text-current"
            >
                {part}
            </mark>
        ) : (
            <span key={`${part}-${index}`}>{part}</span>
        ),
    );
}
