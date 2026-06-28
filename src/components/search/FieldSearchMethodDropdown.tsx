import { useEffect, useRef, useState } from "react";

import { ContainsIcon, EqualsIcon, StartsWithIcon } from "../ui";

import type { SearchMethod } from "../../lib/setlistSearchDb/types";

const METHOD_LABEL: Record<SearchMethod, string> = {
    contains: "含む",
    notContains: "含まない",
    exact: "である",
    notExact: "でない",
    startsWith: "で始まる",
    endsWith: "で終わる",
};

type FieldSearchMethodDropdownProps = {
    value: SearchMethod;
    onChange: (value: SearchMethod) => void;
    disabled?: boolean;
    options?: SearchMethod[];
    labels?: Partial<Record<SearchMethod, string>>;
    compact?: boolean;
};

export function FieldSearchMethodDropdown({
    value,
    onChange,
    disabled = false,
    options = [
        "contains",
        "notContains",
        "exact",
        "notExact",
        "startsWith",
        "endsWith",
    ],
    labels = METHOD_LABEL,
    compact = false,
}: FieldSearchMethodDropdownProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selectedLabel = labels[value] ?? METHOD_LABEL[value];

    useEffect(() => {
        const onDocumentClick = (event: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocumentClick);
        return () => document.removeEventListener("mousedown", onDocumentClick);
    }, []);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                title={`検索方法: ${selectedLabel}`}
                className={
                    compact
                        ? `inline-flex h-7 w-full items-center justify-center gap-1 rounded-none border border-l-0 border-gray-300 bg-white px-1 text-[11px] font-medium text-gray-700 transition-colors ${
                            disabled ? "cursor-not-allowed opacity-60" : "hover:bg-gray-50"
                        }`
                        : `inline-flex h-9 w-9 items-center justify-center rounded-none border-2 border-gray-800 bg-white text-gray-700 text-xs font-medium shadow-[2px_2px_0px_0px_rgba(31,41,55,0.7)] transition-all duration-200 ${
                            disabled
                                ? "cursor-not-allowed opacity-60 shadow-none"
                                : "hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(31,41,55,0.7)]"
                        }`
                }
            >
                <span>{methodIcon(value, compact ? "h-3.5 w-3.5" : "h-4 w-4")}</span>
                {compact ? <span className="min-w-0 truncate">{selectedLabel}</span> : null}
            </button>
            {open && !disabled ? (
                <div
                    className={
                        compact
                            ? "absolute right-0 top-8 z-30 grid w-[216px] grid-cols-3 overflow-hidden rounded-none border-2 border-gray-800 bg-white shadow-[3px_3px_0px_0px_rgba(31,41,55,0.7)]"
                            : "absolute right-0 top-10 z-20 min-w-[132px] overflow-hidden rounded-none border-2 border-gray-800 bg-white shadow-[3px_3px_0px_0px_rgba(31,41,55,0.7)]"
                    }
                >
                    {options.map(
                        (method) => (
                            <button
                                key={method}
                                type="button"
                                onClick={() => {
                                    onChange(method);
                                    setOpen(false);
                                }}
                                className={`w-full px-2 py-2 text-left text-xs transition-colors ${
                                    method === value
                                        ? "bg-gray-200 font-semibold text-gray-900"
                                        : "text-slate-700 hover:bg-slate-100"
                                }`}
                            >
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                    {methodIcon(method, compact ? "h-3.5 w-3.5" : "h-4 w-4")}
                                    <span className="min-w-0 truncate">{labels[method] ?? METHOD_LABEL[method]}</span>
                                </span>
                            </button>
                        ),
                    )}
                </div>
            ) : null}
        </div>
    );
}

function methodIcon(method: SearchMethod, className = "h-4 w-4") {
    if (method === "contains") {
        return <ContainsIcon className={className} />;
    }
    if (method === "notContains") {
        return (
            <span className={`inline-flex items-center justify-center text-[11px] font-bold leading-none ${className}`}>
                ⊄
            </span>
        );
    }
    if (method === "exact") {
        return <EqualsIcon className={className} />;
    }
    if (method === "notExact") {
        return (
            <span className={`inline-flex items-center justify-center text-sm font-bold leading-none ${className}`}>
                ≠
            </span>
        );
    }
    return <StartsWithIcon className={className} />;
}
