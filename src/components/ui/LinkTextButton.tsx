import type { ButtonHTMLAttributes, ReactNode } from "react";

type LinkTextButtonProps = {
    children: ReactNode;
    className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const BASE_CLASS = "text-left text-blue-600 hover:underline";

export function LinkTextButton({
    children,
    className = "",
    type = "button",
    ...props
}: LinkTextButtonProps) {
    return (
        <button
            type={type}
            className={`${BASE_CLASS} ${className}`.trim()}
            {...props}
        >
            {children}
        </button>
    );
}

