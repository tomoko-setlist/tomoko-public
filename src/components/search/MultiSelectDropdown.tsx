import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ChevronDownIcon, ResetIcon } from "../ui";

import type { DropdownOptionGroup } from "../../lib/prefectureRegions";

type Option = {
    value: string;
    label: string;
};

type MultiSelectDropdownProps = {
    options?: Option[];
    groups?: DropdownOptionGroup[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    disabled?: boolean;
    placeholder: string;
    optionColumns?: 1 | 2;
};

type SingleSelectDropdownProps = {
    options: Option[];
    groups?: DropdownOptionGroup[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder: string;
    optionColumns?: 1 | 2;
    compact?: boolean;
};

const resolveAllOptions = (options: Option[] | undefined, groups: DropdownOptionGroup[] | undefined) =>
    groups ? groups.flatMap((group) => group.options) : (options ?? []);

function GroupSelectHeader({
    group,
    selectedValues,
    onToggle,
    optionColumns,
}: {
    group: DropdownOptionGroup;
    selectedValues: string[];
    optionColumns: 1 | 2;
    onToggle: (group: DropdownOptionGroup) => void;
}) {
    const checkboxRef = useRef<HTMLInputElement>(null);
    const groupValues = useMemo(() => group.options.map((option) => option.value), [group.options]);
    const selectedCount = groupValues.filter((value) => selectedValues.includes(value)).length;
    const allSelected = groupValues.length > 0 && selectedCount === groupValues.length;
    const someSelected = selectedCount > 0 && !allSelected;

    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.indeterminate = someSelected;
        }
    }, [someSelected]);

    return (
        <div
            className={`border-b border-gray-300 bg-slate-100 px-3 py-1.5 ${optionColumns === 2 ? "col-span-2" : ""}`}
        >
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-gray-800">
                <input
                    ref={checkboxRef}
                    type="checkbox"
                    className="h-4 w-4 rounded-none border-2 border-gray-700 text-red-600 focus:ring-0"
                    checked={allSelected}
                    onChange={() => onToggle(group)}
                />
                <span>{group.label}</span>
            </label>
        </div>
    );
}

export function MultiSelectDropdown({
    options,
    groups,
    selectedValues,
    onChange,
    disabled = false,
    placeholder,
    optionColumns = 1,
}: MultiSelectDropdownProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelPosition, setPanelPosition] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);

    const allOptions = useMemo(() => resolveAllOptions(options, groups), [groups, options]);

    const updatePanelPosition = useCallback(() => {
        if (!rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        const minWidth = groups && optionColumns === 2 ? 280 : rect.width;
        setPanelPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: Math.max(rect.width, minWidth),
        });
    }, [groups, optionColumns]);

    useEffect(() => {
        const onDocumentClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!rootRef.current) return;
            if (rootRef.current.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDocumentClick);
        return () => document.removeEventListener("mousedown", onDocumentClick);
    }, []);

    useEffect(() => {
        if (!open) return;
        updatePanelPosition();
        const onWindowChange = () => updatePanelPosition();
        window.addEventListener("resize", onWindowChange);
        window.addEventListener("scroll", onWindowChange, true);
        return () => {
            window.removeEventListener("resize", onWindowChange);
            window.removeEventListener("scroll", onWindowChange, true);
        };
    }, [open, updatePanelPosition]);

    useEffect(() => {
        if (open) {
            updatePanelPosition();
        }
    }, [open, selectedValues, updatePanelPosition]);

    const selectedLabels = useMemo(() => {
        if (selectedValues.length === 0) return [];
        const selected = new Set(selectedValues);
        return allOptions
            .filter((option) => selected.has(option.value))
            .map((option) => option.label);
    }, [allOptions, selectedValues]);

    const toggleValue = (value: string) => {
        const set = new Set(selectedValues);
        if (set.has(value)) {
            set.delete(value);
        } else {
            set.add(value);
        }
        onChange(Array.from(set));
    };

    const toggleGroup = (group: DropdownOptionGroup) => {
        const groupValues = group.options.map((option) => option.value);
        const allSelected = groupValues.every((value) => selectedValues.includes(value));
        const set = new Set(selectedValues);
        if (allSelected) {
            for (const value of groupValues) {
                set.delete(value);
            }
        } else {
            for (const value of groupValues) {
                set.add(value);
            }
        }
        onChange(Array.from(set));
    };

    const renderOption = (option: Option) => {
        const checked = selectedValues.includes(option.value);
        return (
            <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${optionColumns === 2 ? "border-b border-r border-gray-200 even:border-r-0" : "border-b border-gray-200 last:border-b-0"}`}
            >
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded-none border-2 border-gray-700 text-red-600 focus:ring-0"
                    checked={checked}
                    onChange={() => toggleValue(option.value)}
                />
                <span className="truncate text-gray-700">{option.label}</span>
            </label>
        );
    };

    const panel =
        typeof document !== "undefined" && open && !disabled && panelPosition
            ? createPortal(
                  <div
                      ref={panelRef}
                      className="overflow-hidden rounded-none border-2 border-gray-800 bg-white shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]"
                      style={{
                          position: "absolute",
                          top: panelPosition.top,
                          left: panelPosition.left,
                          width: panelPosition.width,
                          zIndex: 500,
                      }}
                  >
                      <div
                          className={`max-h-72 overflow-y-auto ${optionColumns === 2 ? "grid grid-cols-2" : ""}`}
                      >
                          {groups
                              ? groups.flatMap((group) => [
                                    <GroupSelectHeader
                                        key={`${group.id}-header`}
                                        group={group}
                                        selectedValues={selectedValues}
                                        onToggle={toggleGroup}
                                        optionColumns={optionColumns}
                                    />,
                                    ...group.options.map((option) => renderOption(option)),
                                ])
                              : allOptions.map((option) => renderOption(option))}
                      </div>
                      {selectedValues.length > 0 ? (
                          <div className="border-t-2 border-gray-800 p-2">
                              <button
                                  type="button"
                                  onClick={() => onChange([])}
                                  className="inline-flex items-center gap-1 rounded-none border border-gray-800 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                              >
                                  <ResetIcon className="h-3.5 w-3.5" />
                                  選択をクリア
                              </button>
                          </div>
                      ) : null}
                  </div>,
                  document.body,
              )
            : null;

    return (
        <div ref={rootRef} className={`relative ${open ? "z-[80]" : "z-0"}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                className={`inline-flex w-full items-center justify-between rounded-none border-2 border-gray-800 bg-white px-3 py-2 text-left text-sm shadow-[2px_2px_0px_0px_rgba(31,41,55,0.7)] transition-all duration-150 ${
                    disabled
                        ? "cursor-not-allowed opacity-60 shadow-none"
                        : "hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(31,41,55,0.7)]"
                }`}
            >
                <span className="truncate text-gray-700">
                    {selectedLabels.length === 0
                        ? placeholder
                        : `${selectedLabels.slice(0, 2).join(", ")}${
                              selectedLabels.length > 2
                                  ? ` +${selectedLabels.length - 2}`
                                  : ""
                          }`}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            </button>

            {panel}
        </div>
    );
}

export function SingleSelectDropdown({
    options,
    groups,
    value,
    onChange,
    disabled = false,
    placeholder,
    optionColumns = 1,
    compact = false,
}: SingleSelectDropdownProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelPosition, setPanelPosition] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);

    const updatePanelPosition = useCallback(() => {
        if (!rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        const minWidth = groups && optionColumns === 2 ? 220 : rect.width;
        setPanelPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: Math.max(rect.width, compact && optionColumns === 2 ? 220 : minWidth),
        });
    }, [compact, groups, optionColumns]);

    useEffect(() => {
        const onDocumentClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!rootRef.current) return;
            if (rootRef.current.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDocumentClick);
        return () => document.removeEventListener("mousedown", onDocumentClick);
    }, []);

    useEffect(() => {
        if (!open) return;
        updatePanelPosition();
        const onWindowChange = () => updatePanelPosition();
        window.addEventListener("resize", onWindowChange);
        window.addEventListener("scroll", onWindowChange, true);
        return () => {
            window.removeEventListener("resize", onWindowChange);
            window.removeEventListener("scroll", onWindowChange, true);
        };
    }, [open, updatePanelPosition]);

    const selectedLabel = options.find((option) => option.value === value)?.label ?? "";

    const renderOptionButton = (option: Option) => {
        const selected = option.value === value;
        return (
            <button
                key={option.value}
                type="button"
                onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                }}
                className={`min-w-0 border-b border-gray-200 px-2 py-1.5 text-left text-xs hover:bg-gray-50 ${optionColumns === 2 ? "border-r even:border-r-0" : "last:border-b-0"} ${
                    selected ? "bg-gray-200 font-semibold text-gray-900" : "text-gray-700"
                }`}
            >
                <span className="block truncate">{option.label}</span>
            </button>
        );
    };

    const panel =
        typeof document !== "undefined" && open && !disabled && panelPosition
            ? createPortal(
                  <div
                      ref={panelRef}
                      className="overflow-hidden rounded-none border-2 border-gray-800 bg-white shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]"
                      style={{
                          position: "absolute",
                          top: panelPosition.top,
                          left: panelPosition.left,
                          width: panelPosition.width,
                          zIndex: 500,
                      }}
                  >
                      <div
                          className={`max-h-72 overflow-y-auto ${optionColumns === 2 ? "grid grid-cols-2" : ""}`}
                      >
                          {groups
                              ? groups.flatMap((group) => [
                                    <div
                                        key={`${group.id}-header`}
                                        className={`border-b border-gray-300 bg-slate-100 px-2 py-1 text-xs font-bold text-gray-800 ${optionColumns === 2 ? "col-span-2" : ""}`}
                                    >
                                        {group.label}
                                    </div>,
                                    ...group.options.map((option) => renderOptionButton(option)),
                                ])
                              : options.map((option) => renderOptionButton(option))}
                      </div>
                      {value ? (
                          <div className="border-t-2 border-gray-800 p-1.5">
                              <button
                                  type="button"
                                  onClick={() => {
                                      onChange("");
                                      setOpen(false);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-none border border-gray-800 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                              >
                                  <ResetIcon className="h-3.5 w-3.5" />
                                  選択をクリア
                              </button>
                          </div>
                      ) : null}
                  </div>,
                  document.body,
              )
            : null;

    return (
        <div ref={rootRef} className={`relative ${open ? "z-[80]" : "z-0"}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                className={`inline-flex w-full items-center justify-between rounded-none border border-gray-400 bg-white text-left text-xs transition-colors ${
                    compact ? "h-7 px-1 md:h-8 md:px-2 md:text-sm" : "px-3 py-2"
                } ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-gray-50"}`}
            >
                <span className="truncate text-gray-700">{selectedLabel || placeholder}</span>
                <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            </button>
            {panel}
        </div>
    );
}
