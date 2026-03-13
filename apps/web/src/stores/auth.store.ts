import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
    role: string;
    avatarUrl?: string;
}

export interface AuthOrg {
    id: string;
    name: string;
    plan: string;
    gstNumber?: string;
}

interface AuthState {
    user: AuthUser | null;
    org: AuthOrg | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    setAuth: (user: AuthUser, org: AuthOrg, tokens: { accessToken: string; refreshToken: string }) => void;
    setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            org: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            setAuth: (user, org, tokens) =>
                set({ user, org, ...tokens, isAuthenticated: true }),
            setTokens: (tokens) => set(tokens),
            logout: () =>
                set({
                    user: null,
                    org: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                }),
        }),
        { name: "distroai-auth" }
    )
);
