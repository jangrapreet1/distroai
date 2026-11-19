"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

export function AuthRedirector() {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkAndRedirect = () => {
            try {
                const state = useAuthStore.getState();
                const hasCookie = typeof document !== "undefined" && document.cookie.includes("accessToken=");
                const hasStoreToken = Boolean(state.accessToken && state.isAuthenticated);

                if (hasStoreToken || hasCookie) {
                    const defaultHome = (typeof window !== "undefined" && localStorage.getItem("distroai_default_home")) || "/dashboard";
                    // Sync cookie in case it expired or wasn't set
                    if (typeof document !== "undefined" && !document.cookie.includes("defaultHome=")) {
                        document.cookie = `defaultHome=${defaultHome};path=/;max-age=31536000;SameSite=Lax`;
                    }
                    router.replace(defaultHome);
                    return;
                }
            } catch {
                // If anything fails, allow landing page to render
            }
            setIsChecking(false);
        };

        if (useAuthStore.persist?.hasHydrated?.()) {
            checkAndRedirect();
        } else {
            const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
                checkAndRedirect();
            });
            const timer = setTimeout(checkAndRedirect, 250);
            return () => {
                if (typeof unsub === "function") unsub();
                clearTimeout(timer);
            };
        }
    }, [router]);

    if (isChecking) {
        // Subtle non-intrusive checking state before landing page shows
        return null;
    }

    return null;
}
