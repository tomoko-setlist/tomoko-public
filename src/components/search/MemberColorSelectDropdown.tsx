import { useMemo } from "react";

import { MultiSelectDropdown } from "./MultiSelectDropdown";
import { buildMemberColorOptionGroups } from "../../lib/memberColorFamilies";

type MemberColorMultiSelectDropdownProps = {
    colorNames: string[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    disabled?: boolean;
    placeholder: string;
};

export function MemberColorMultiSelectDropdown({
    colorNames,
    ...rest
}: MemberColorMultiSelectDropdownProps) {
    const groups = useMemo(() => buildMemberColorOptionGroups(colorNames), [colorNames]);

    return (
        <MultiSelectDropdown
            {...rest}
            groups={groups}
            optionColumns={2}
        />
    );
}
