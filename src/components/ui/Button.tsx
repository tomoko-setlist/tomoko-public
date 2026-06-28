import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  loading?: boolean
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-red-600 hover:bg-red-700 text-white border-2 border-red-600',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 border-2 border-gray-800',
  danger: 'bg-red-600 hover:bg-red-700 text-white border-2 border-red-600',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white border-2 border-amber-600',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 border-2 border-gray-800',
}

const sizeStyles: Record<ButtonSize, { button: string; icon: string }> = {
  sm: { button: 'px-3 py-1.5 text-sm', icon: 'w-4 h-4' },
  md: { button: 'px-4 py-2 text-sm', icon: 'w-5 h-5' },
  lg: { button: 'px-6 py-3 text-base', icon: 'w-6 h-6' },
}

const LoadingIcon = ({ size }: { size: ButtonSize }) => (
  <svg className={`animate-spin ${sizeStyles[size].icon}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

const joinClasses = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      loading = false,
      fullWidth = false,
      disabled,
      className = '',
      title,
      'aria-label': ariaLabel,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading
    const iconElement = loading ? <LoadingIcon size={size} /> : icon

    return (
      <button
        ref={ref}
        className={joinClasses(
          'inline-flex items-center justify-center gap-2 rounded-none font-medium transition-all duration-200',
          'disabled:cursor-not-allowed disabled:opacity-50',
          variantStyles[variant],
          sizeStyles[size].button,
          fullWidth && 'w-full',
          className,
        )}
        disabled={isDisabled}
        title={title ?? ariaLabel}
        aria-label={ariaLabel}
        {...props}
      >
        {iconElement && iconPosition === 'left' && <span className={`flex-shrink-0 ${sizeStyles[size].icon}`}>{iconElement}</span>}
        {children}
        {iconElement && iconPosition === 'right' && <span className={`flex-shrink-0 ${sizeStyles[size].icon}`}>{iconElement}</span>}
      </button>
    )
  },
)

Button.displayName = 'Button'

export default Button
