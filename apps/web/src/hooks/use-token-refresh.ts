"use client";

import { useEffect, useRef } from "react";
import axios from "axios";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Proactive token refresh hook.
 *
 * Instead of waiting for a 401 to trigger a refresh (which races with the
 * Next.js middleware cookie check), this hook silently refreshes the access
 * token ~2 minutes before it expires.
 *
 * Security model:
 *  - Access token: 15 min (short-lived, per security guidelines)
 *  - Refresh token: 30 days (long-lived, rotated on each use)
 *  - This hook renews at 13 min so the cookie never goes stale
 */

const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 minutes

export function useTokenRefresh() {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const doRefresh = async () => {
            const { refreshToken, setTokens, logout, isAuthenticated } =
                useAuthStore.getState();

            if (!isAuthenticated || !refreshToken) return;

            try {
                const res = await axios.post(
                    `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/auth/refresh`,
                    { refreshToken }
                );
                const { accessToken: newAccess, refreshToken: newRefresh } =
                    res.data?.data ?? res.data;

                setTokens({ accessToken: newAccess, refreshToken: newRefresh });

                // Keep the middleware cookie alive
                document.cookie = `accessToken=${newAccess};path=/;max-age=900;SameSite=Lax`;
            } catch {
                // Refresh failed — token is likely revoked or expired
                logout();
                document.cookie =
                    "accessToken=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT";
                if (typeof window !== "undefined") window.location.href = "/login";
            }
        };

        // Run immediately on mount if authenticated (covers tab-restore after idle)
        const { isAuthenticated } = useAuthStore.getState();
        if (isAuthenticated) {
            doRefresh();
        }

        // Then run every 13 minutes
        intervalRef.current = setInterval(doRefresh, REFRESH_INTERVAL_MS);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);
}
