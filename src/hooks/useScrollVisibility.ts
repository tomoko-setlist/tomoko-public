import { useCallback, useEffect, useState } from "react";

export function useScrollVisibility(
    targetRef: React.RefObject<HTMLElement | null>,
    enabled: boolean,
    isExpanded: boolean,
    visibilityBottomThresholdPx = 0,
) {
    const [showButton, setShowButton] = useState(false);

    const isElementInViewport = useCallback((element: HTMLElement): boolean => {
        const rect = element.getBoundingClientRect();
        return (
            rect.bottom > visibilityBottomThresholdPx &&
            rect.top < window.innerHeight
        );
    }, [visibilityBottomThresholdPx]);

    const isAtBottomOfPage = useCallback((threshold = 100): boolean => {
        return (
            window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - threshold
        );
    }, []);

    const handleScroll = useCallback(() => {
        if (!targetRef.current) {
            setShowButton(false);
            return;
        }
        const inViewport = isElementInViewport(targetRef.current);
        const isTargetVisible = inViewport && isExpanded;
        const atBottom = isAtBottomOfPage();
        setShowButton(!isTargetVisible && enabled && !atBottom);
    }, [enabled, isAtBottomOfPage, isElementInViewport, isExpanded, targetRef]);

    useEffect(() => {
        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", handleScroll, { passive: true });
        window.requestAnimationFrame(() => {
            window.dispatchEvent(new Event("scroll"));
        });
        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleScroll);
        };
    }, [handleScroll]);

    return showButton;
}
