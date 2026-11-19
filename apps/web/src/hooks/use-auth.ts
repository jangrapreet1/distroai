"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient, { getApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser, type AuthOrg } from "@/stores/auth.store";

interface LoginResponse {
    user: AuthUser;
    org: AuthOrg;
    accessToken: string;
    refreshToken: string;
}

export function useAuth() {
    const router = useRouter();
    const { user, org, isAuthenticated, setAuth, logout: clearAuth } = useAuthStore();

    const loginMutation = useMutation({
        mutationFn: async (data: { email: string; password: string }) => {
            const res = await apiClient.post<LoginResponse>("/api/v1/auth/login", data);
            return res.data;
        },
        onSuccess: (data) => {
            setAuth(data.user, data.org, {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
            });
            document.cookie = `accessToken=${data.accessToken};path=/;max-age=2592000;SameSite=Lax`;
            toast.success(`Welcome back, ${data.user.firstName}!`);
            // Redirect to the page user was trying to access, or dashboard
            const params = new URLSearchParams(window.location.search);
            const redirectTo = params.get('redirect') || '/dashboard';
            router.push(redirectTo);
        },
        onError: (error) => {
            const err = getApiError(error);
            toast.error(err.message);
        },
    });

    const registerMutation = useMutation({
        mutationFn: async (data: {
            orgName: string;
            gstNumber?: string;
            phone?: string;
            city?: string;
            state?: string;
            firstName: string;
            lastName?: string;
            email: string;
            password: string;
        }) => {
            const res = await apiClient.post<LoginResponse>("/api/v1/auth/register", data);
            return res.data;
        },
        onSuccess: (data) => {
            setAuth(data.user, data.org, {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
            });
            document.cookie = `accessToken=${data.accessToken};path=/;max-age=2592000;SameSite=Lax`;
            toast.success("Account created! Welcome to DistroAI.");
        },
        onError: (error) => {
            const err = getApiError(error);
            toast.error(err.message);
        },
    });

    const logout = useCallback(async () => {
        const { refreshToken } = useAuthStore.getState();
        // 1. Invalidate tokens on backend
        if (refreshToken) {
            try {
                await apiClient.post("/api/v1/auth/logout", { refreshToken }).catch(() => {});
            } catch {
                // Ignore network errors during logout
            }
        }

        // 2. Clear client auth store
        clearAuth();

        // 3. Clear auth cookies (root and domain scoped)
        document.cookie = "accessToken=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT";
        if (typeof window !== "undefined") {
            document.cookie = `accessToken=;path=/;domain=${window.location.hostname};expires=Thu, 01 Jan 1970 00:00:00 GMT`;

            // 4. Wipe localStorage and sessionStorage
            try {
                sessionStorage.clear();
                localStorage.removeItem("auth-storage");
                localStorage.removeItem("distroai-auth");
            } catch {}

            // 5. Clear CacheStorage (Service Worker cached pages/chunks)
            if ("caches" in window) {
                try {
                    const cacheKeys = await window.caches.keys();
                    await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
                } catch {}
            }

            // 6. Hard redirect to /login to flush React state and in-memory caches
            window.location.href = "/login";
        } else {
            router.push("/login");
        }
    }, [clearAuth, router]);

    const handleGoogleCallbackMutation = useMutation({
        mutationFn: async (tokens: { accessToken: string; refreshToken: string }) => {
            // Temporary token set to authenticate /me request
            useAuthStore.getState().setTokens(tokens);
            document.cookie = `accessToken=${tokens.accessToken};path=/;max-age=2592000;SameSite=Lax`;
            const res = await apiClient.get<any>("/api/v1/auth/me");
            return { user: res.data, org: res.data.organization, tokens };
        },
        onSuccess: (data) => {
            setAuth(data.user, data.org, data.tokens);
            toast.success(`Welcome, ${data.user.firstName}!`);
            if (!data.user.phone) {
                router.push("/onboarding");
            } else {
                router.push("/dashboard");
            }
        },
        onError: () => {
            logout();
            toast.error("Google sign-in failed");
        }
    });

    return {
        user,
        org,
        isAuthenticated,
        login: loginMutation.mutate,
        register: registerMutation.mutate,
        handleGoogleCallback: handleGoogleCallbackMutation.mutate,
        logout,
        isLoggingIn: loginMutation.isPending || handleGoogleCallbackMutation.isPending,
        isRegistering: registerMutation.isPending,
    };
}
