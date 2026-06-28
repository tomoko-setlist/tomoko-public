import { useScrollVisibility } from "../../hooks/useScrollVisibility";
import { EditIcon } from "../ui";

type FloatingEditButtonProps = {
    targetRef: React.RefObject<HTMLElement | null>;
    enabled: boolean;
    isFormExpanded: boolean;
    onClick: () => void;
    label?: string;
    visibilityBottomThresholdPx?: number;
};

export function FloatingEditButton({
    targetRef,
    enabled,
    isFormExpanded,
    onClick,
    label = "条件を編集",
    visibilityBottomThresholdPx = 0,
}: FloatingEditButtonProps) {
    const visible = useScrollVisibility(
        targetRef,
        enabled,
        isFormExpanded,
        visibilityBottomThresholdPx,
    );

    if (!visible) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            className="fixed bottom-5 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-none border-2 border-gray-800 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-[4px_4px_0px_0px_rgba(31,41,55,0.9)] active:translate-x-[-50%] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(31,41,55,0.8)] md:left-[calc(50%+8rem)]"
        >
            <EditIcon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
        </button>
    );
}
