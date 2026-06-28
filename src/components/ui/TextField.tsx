import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement>;

export function TextField({ className = "", ...props }: TextFieldProps) {
    return (
        <input
            autoComplete="off"
            {...props}
            className={`block h-7 w-full min-w-0 rounded-none border border-gray-300 bg-white px-1.5 py-0 text-xs ${className}`.trim()}
        />
    );
}
