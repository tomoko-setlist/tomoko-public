import { ChevronDownIcon } from "./Icons";

import type { SelectHTMLAttributes } from "react";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
    wrapperClassName?: string;
};

export function SelectField({
    className = "",
    wrapperClassName = "",
    children,
    ...props
}: SelectFieldProps) {
    return (
        <div className={`relative min-w-0 ${wrapperClassName}`.trim()}>
            <select
                {...props}
                className={`block h-7 w-full min-w-0 appearance-none rounded-none border border-gray-300 bg-white pl-1 pr-3 text-center ${className}`.trim()}
            >
                {children}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-gray-500">
                <ChevronDownIcon className="h-2.5 w-2.5" />
            </span>
        </div>
    );
}
