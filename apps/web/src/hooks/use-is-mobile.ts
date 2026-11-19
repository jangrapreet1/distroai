"use client";

import { useState, useEffect } from "react";

export function useIsMobile(breakpoint: number = 768): boolean {
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        setIsMobile(mediaQuery.matches);

        const handler = (e: MediaQueryListEvent) => {
            setIsMobile(e.matches);
        };

        mediaQuery.addEventListener?.("change", handler);
        return () => {
            mediaQuery.removeEventListener?.("change", handler);
        };
    }, [breakpoint]);

    return isMobile;
}
