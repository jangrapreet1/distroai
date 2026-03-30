"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createPortalCartStore, type CartItem } from "@/stores/portal-cart.store";
import { createPortalAuthStore, type PortalCustomer } from "@/stores/portal-auth.store";
import type { StoreApi } from "zustand";
import { useStore } from "zustand";

type CartStore = ReturnType<typeof createPortalCartStore>;
type AuthStore = ReturnType<typeof createPortalAuthStore>;

interface PortalContextValue {
    orgId: string;
    cartStore: CartStore;
    authStore: AuthStore;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({
    orgId,
    children,
}: {
    orgId: string;
    children: ReactNode;
}) {
    const cartStore = useMemo(() => createPortalCartStore(orgId), [orgId]);
    const authStore = useMemo(() => createPortalAuthStore(orgId), [orgId]);

    return (
        <PortalContext.Provider value={{ orgId, cartStore, authStore }}>
            {children}
        </PortalContext.Provider>
    );
}

function usePortalContext() {
    const ctx = useContext(PortalContext);
    if (!ctx) throw new Error("usePortalContext must be used within PortalProvider");
    return ctx;
}

export function usePortalOrgId() {
    return usePortalContext().orgId;
}

// Cart hooks
export function usePortalCart() {
    const { cartStore } = usePortalContext();
    return useStore(cartStore);
}

// Auth hooks
export function usePortalAuth() {
    const { authStore } = usePortalContext();
    return useStore(authStore);
}

// Portal API utility
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export const portalApi = {
    get: async (url: string, token?: string | null) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}${url}`, { headers });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        return json.data !== undefined ? json.data : json;
    },
    post: async (url: string, body: unknown, token?: string | null) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}${url}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || "Request failed");
        }
        const json = await res.json();
        return json.data !== undefined ? json.data : json;
    },
};
