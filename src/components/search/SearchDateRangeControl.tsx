import { useMemo, useState } from "react";

import {
    getPresetDateRange,
    getSearchYearOptions,
    normalizeDateRangeInputs,
    yearRangeToDateRange,
    dateRangeToYearRange,
    coerceDateRangeForMode,
} from "../../lib/searchDateRange";
import { SelectField, XIcon } from "../ui";

import type { SearchDateMode } from "../../lib/setlistSearchDb/types";
import type { KeyboardEvent } from "react";

type SearchDateRangeControlProps = {
    mode: SearchDateMode;
    dateFrom: string;
    dateTo: string;
    disabled?: boolean;
    onModeChange: (mode: SearchDateMode) => void;
    onDateRangeChange: (range: { dateFrom: string; dateTo: string }) => void;
};

const PRESETS: Array<{
    key: "thisYear" | "last1Year" | "last5Years" | "last10Years";
    label: string;
}> = [
    { key: "thisYear", label: "今年" },
    { key: "last1Year", label: "直近1年" },
    { key: "last5Years", label: "直近5年" },
    { key: "last10Years", label: "直近10年" },
];

export function SearchDateRangeControl({
    mode,
    dateFrom,
    dateTo,
    disabled = false,
    onModeChange,
    onDateRangeChange,
}: SearchDateRangeControlProps) {
    const [draft, setDraft] = useState({
        sourceFrom: dateFrom,
        sourceTo: dateTo,
        from: dateFrom,
        to: dateTo,
        error: "",
    });
    const yearOptions = useMemo(() => getSearchYearOptions(), []);
    const yearRange = dateRangeToYearRange({ dateFrom, dateTo });
    const draftSynced = draft.sourceFrom === dateFrom && draft.sourceTo === dateTo;
    const draftFrom = draftSynced ? draft.from : dateFrom;
    const draftTo = draftSynced ? draft.to : dateTo;
    const error = draftSynced ? draft.error : "";
    const hasDateInput = Boolean(dateFrom || dateTo || draftFrom || draftTo || error);

    const updateDraft = (patch: Partial<Pick<typeof draft, "from" | "to" | "error">>) => {
        setDraft({
            sourceFrom: dateFrom,
            sourceTo: dateTo,
            from: draftFrom,
            to: draftTo,
            error,
            ...patch,
        });
    };

    const changeMode = (nextMode: SearchDateMode) => {
        if (nextMode === mode) return;
        const nextRange = coerceDateRangeForMode(nextMode, { dateFrom, dateTo });
        onDateRangeChange(nextRange);
        onModeChange(nextMode);
    };

    const updateYearRange = (nextStartYear: string, nextEndYear: string) => {
        updateDraft({ error: "" });
        onDateRangeChange(yearRangeToDateRange(nextStartYear, nextEndYear));
    };

    const commitDrafts = () => {
        const normalized = normalizeDateRangeInputs(draftFrom, draftTo);
        if (!normalized.ok) {
            updateDraft({ error: "日付は YYYY-MM-DD または YYYYMMDD 形式で入力してください" });
            return;
        }
        updateDraft({
            from: normalized.range.dateFrom,
            to: normalized.range.dateTo,
            error: "",
        });
        onDateRangeChange(normalized.range);
    };

    const applyPreset = (preset: (typeof PRESETS)[number]["key"]) => {
        const nextRange = getPresetDateRange(preset);
        updateDraft({
            from: nextRange.dateFrom,
            to: nextRange.dateTo,
            error: "",
        });
        onDateRangeChange(nextRange);
    };

    const clear = () => {
        updateDraft({ from: "", to: "", error: "" });
        onDateRangeChange({ dateFrom: "", dateTo: "" });
    };

    const handleDateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            commitDrafts();
        }
    };

    return (
        <section className="rounded-none border border-gray-300 bg-gray-50/70 pl-0 pr-2.5 py-1">
            <div className="flex items-center justify-between gap-2 pl-2.5">
                <span className="shrink-0 text-[11px] font-semibold text-slate-700">開催日</span>
                <div className="flex shrink-0 items-center gap-1">
                    <div className="inline-flex h-5 overflow-hidden rounded-none border border-gray-800 bg-white">
                        {(["year", "date"] as const).map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => changeMode(item)}
                                disabled={disabled}
                                className={`min-w-[2.375rem] px-2.5 text-[10px] font-semibold leading-none transition-colors ${
                                    mode === item
                                        ? "bg-gray-900 text-white"
                                        : "bg-white text-slate-700 hover:bg-gray-100"
                                } disabled:cursor-not-allowed disabled:opacity-50`}
                                aria-pressed={mode === item}
                            >
                                {item === "year" ? "年" : "日付"}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={clear}
                        disabled={disabled || !hasDateInput}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-none bg-transparent text-slate-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title="開催日条件をクリア"
                        aria-label="開催日条件をクリア"
                    >
                        <XIcon className="h-3 w-3" />
                    </button>
                </div>
            </div>

            {mode === "year" ? (
                <div className="mt-1 ml-[22px] md:ml-[24px] grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-1">
                    <SelectField
                        value={yearRange.startYear}
                        onChange={(event) => updateYearRange(event.target.value, yearRange.endYear)}
                        disabled={disabled}
                        className="h-6 border-gray-400 px-1.5 py-0 text-[11px]"
                        aria-label="開始年"
                    >
                        <option value="">開始年</option>
                        {yearOptions.map((year) => (
                            <option key={year} value={year}>{year}年</option>
                        ))}
                    </SelectField>
                    <span className="text-center text-xs font-semibold text-slate-500">〜</span>
                    <SelectField
                        value={yearRange.endYear}
                        onChange={(event) => updateYearRange(yearRange.startYear, event.target.value)}
                        disabled={disabled}
                        className="h-6 border-gray-400 px-1.5 py-0 text-[11px]"
                        aria-label="終了年"
                    >
                        <option value="">終了年</option>
                        {yearOptions.map((year) => (
                            <option key={year} value={year}>{year}年</option>
                        ))}
                    </SelectField>
                </div>
            ) : (
                <div className="mt-1 space-y-1">
                    <div className="ml-[22px] md:ml-[24px] flex flex-wrap gap-1">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.key}
                                type="button"
                                onClick={() => applyPreset(preset.key)}
                                disabled={disabled}
                                className="inline-flex h-5.5 items-center justify-center rounded-none border border-gray-300 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:border-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <div className="ml-[22px] md:ml-[24px] grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-1">
                        <input
                            value={draftFrom}
                            onChange={(event) => updateDraft({ from: event.target.value })}
                            onBlur={commitDrafts}
                            onKeyDown={handleDateKeyDown}
                            disabled={disabled}
                            className={`h-6 min-w-0 rounded-none border bg-white px-2 py-0 font-mono text-[11px] focus:outline-none ${
                                error ? "border-red-700" : "border-gray-400"
                            }`}
                            placeholder="YYYY-MM-DD"
                            inputMode="numeric"
                            autoComplete="off"
                            aria-label="開始日"
                        />
                        <span className="text-center text-xs font-semibold text-slate-500">〜</span>
                        <input
                            value={draftTo}
                            onChange={(event) => updateDraft({ to: event.target.value })}
                            onBlur={commitDrafts}
                            onKeyDown={handleDateKeyDown}
                            disabled={disabled}
                            className={`h-6 min-w-0 rounded-none border bg-white px-2 py-0 font-mono text-[11px] focus:outline-none ${
                                error ? "border-red-700" : "border-gray-400"
                            }`}
                            placeholder="YYYY-MM-DD"
                            inputMode="numeric"
                            autoComplete="off"
                            aria-label="終了日"
                        />
                    </div>
                    {error ? <p className="text-[11px] font-semibold text-red-700">{error}</p> : null}
                </div>
            )}
        </section>
    );
}
