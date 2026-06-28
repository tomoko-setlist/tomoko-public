import { PlusIcon } from "./Icons";

type ConditionAddButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
};

export function ConditionAddButton({
  onClick,
  disabled = false,
  title = "条件を追加",
  ariaLabel = "条件を追加",
  className = "",
}: ConditionAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-none border-2 border-gray-800 bg-white text-gray-800 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.82)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-[4px_4px_0px_0px_rgba(31,41,55,0.9)] active:translate-y-[1px] active:shadow-[2px_2px_0px_0px_rgba(31,41,55,0.78)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-40 disabled:shadow-[1px_1px_0px_0px_rgba(31,41,55,0.45)] ${className}`}
    >
      <PlusIcon className="h-[18px] w-[18px]" />
    </button>
  );
}
