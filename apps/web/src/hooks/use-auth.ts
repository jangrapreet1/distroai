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
            document.cookie = `accessToken=${data.accessToken};path=/;max-age=900;SameSite=Lax`;
            toast.success(`Welcome back, ${data.user.firstName}!`);
            router.push("/");
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
            document.cookie = `accessToken=${data.accessToken};path=/;max-age=900;SameSite=Lax`;
            toast.success("Account created! Welcome to DistroAI.");
        },
        onError: (error) => {
            const err = getApiError(error);
            toast.error(err.message);
        },
    });

    const logout = useCallback(() => {
        clearAuth();
        document.cookie = "accessToken=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push("/login");
    }, [clearAuth, router]);

    return {
        user,
        org,
        isAuthenticated,
        login: loginMutation.mutate,
        register: registerMutation.mutate,
        logout,
        isLoggingIn: loginMutation.isPending,
        isRegistering: registerMutation.isPending,
    };
}
