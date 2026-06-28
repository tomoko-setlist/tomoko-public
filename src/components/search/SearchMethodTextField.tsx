import { AutocompleteTextInput } from "./AutocompleteTextInput";
import { FieldSearchMethodDropdown } from "./FieldSearchMethodDropdown";

import type {
    SearchMethod,
    SearchSuggestField,
    SearchSuggestVariant,
    SearchSuggestion,
} from "../../lib/setlistSearchDb/types";

type SearchMethodTextFieldProps = {
    label: string;
    value: string;
    method: SearchMethod;
    onChange: (value: string) => void;
    onMethodChange: (value: SearchMethod) => void;
    disabled?: boolean;
    placeholder?: string;
    inputClassName?: string;
    onFetchSuggestions?: (term: string) => Promise<SearchSuggestion[]>;
    suggestField?: SearchSuggestField;
    suggestVariant?: SearchSuggestVariant;
    suggestEnabled?: boolean;
};

export function SearchMethodTextField({
    label,
    value,
    method,
    onChange,
    onMethodChange,
    disabled = false,
    placeholder,
    inputClassName = "w-full rounded-none border-2 border-gray-800 px-3 py-2 pr-8 text-sm focus:outline-none",
    onFetchSuggestions,
    suggestField,
    suggestVariant,
    suggestEnabled = false,
}: SearchMethodTextFieldProps) {
    return (
        <label className="text-xs font-semibold text-slate-600">
            {label}
            <div className="mt-1 grid grid-cols-[1fr_40px] items-center gap-2">
                <AutocompleteTextInput
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    placeholder={placeholder}
                    ariaLabel={label}
                    inputClassName={inputClassName}
                    onFetchSuggestions={onFetchSuggestions}
                    suggestField={suggestField}
                    suggestVariant={suggestVariant}
                    suggestEnabled={suggestEnabled}
                />
                <div className="justify-self-end">
                    <FieldSearchMethodDropdown
                        value={method}
                        onChange={onMethodChange}
                        disabled={disabled}
                    />
                </div>
            </div>
        </label>
    );
}
