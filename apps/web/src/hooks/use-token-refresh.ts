"use client";

import { useEffect, useRef } from "react";
import axios from "axios";
import { useAuthStore } from "@/stores/auth.store";
import { getApiBaseUrl } from "@/lib/api-url";

/**
 * Proactive token refresh hook.
 *
 * Instead of waiting for a 401 to trigger a refresh (which races with the
 * Next.js middleware cookie check), this hook silently refreshes the access
 * token ~2 minutes before it expires.
 *
 * Security model:
 *  - Access token: 7 days
 *  - Refresh token: 30 days (long-lived, rotated on each use with 45s grace window)
 *  - This hook renews periodically (every 12 hours) and on tab visibility restore
 */

const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function useTokenRefresh() {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        let isRefreshingNow = false;

        const doRefresh = async () => {
            if (isRefreshingNow) return;
            const { refreshToken, setTokens, logout, isAuthenticated } =
                useAuthStore.getState();

            if (!isAuthenticated || !refreshToken) return;

            isRefreshingNow = true;
            try {
                const res = await axios.post(
                    `${getApiBaseUrl()}/api/v1/auth/refresh`,
                    { refreshToken }
                );
                const { accessToken: newAccess, refreshToken: newRefresh } =
                    res.data?.data ?? res.data;

                setTokens({ accessToken: newAccess, refreshToken: newRefresh });

                // Keep the middleware cookie alive
                document.cookie = `accessToken=${newAccess};path=/;max-age=2592000;SameSite=Lax`;
            } catch (err: any) {
                // Only log out if the refresh token was explicitly rejected as invalid/expired (401/403)
                // Do NOT log out on network disconnects, server reboots, or 429 limits
                if (err?.response?.status === 401 || err?.response?.status === 403) {
                    logout();
                    document.cookie =
                        "accessToken=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT";
                    if (typeof window !== "undefined") window.location.href = "/login";
                }
            } finally {
                isRefreshingNow = false;
            }
        };

        // Run on periodic interval (every 12 hours)
        intervalRef.current = setInterval(doRefresh, REFRESH_INTERVAL_MS);

        // Run when user re-focuses tab after long inactivity
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                doRefresh();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);
}
