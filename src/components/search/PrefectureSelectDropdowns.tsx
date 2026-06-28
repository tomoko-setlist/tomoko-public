import { useMemo } from "react";

import { MultiSelectDropdown, SingleSelectDropdown } from "./MultiSelectDropdown";
import {
    buildPrefectureOptionGroups,
    flattenDropdownOptionGroups,
} from "../../lib/prefectureRegions";

import type { MasterOption } from "../../lib/setlistSearchDb/types";

type PrefectureMultiSelectDropdownProps = {
    prefectureOptions: MasterOption[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    disabled?: boolean;
    placeholder: string;
};

export function PrefectureMultiSelectDropdown({
    prefectureOptions,
    ...rest
}: PrefectureMultiSelectDropdownProps) {
    const groups = useMemo(
        () => buildPrefectureOptionGroups(prefectureOptions),
        [prefectureOptions],
    );

    return (
        <MultiSelectDropdown
            {...rest}
            groups={groups}
            optionColumns={2}
        />
    );
}

type PrefectureSingleSelectDropdownProps = {
    prefectureOptions: MasterOption[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder: string;
    compact?: boolean;
};

export function PrefectureSingleSelectDropdown({
    prefectureOptions,
    ...rest
}: PrefectureSingleSelectDropdownProps) {
    const groups = useMemo(
        () => buildPrefectureOptionGroups(prefectureOptions),
        [prefectureOptions],
    );
    const options = useMemo(() => flattenDropdownOptionGroups(groups), [groups]);

    return (
        <SingleSelectDropdown
            {...rest}
            options={options}
            groups={groups}
            optionColumns={2}
        />
    );
}
