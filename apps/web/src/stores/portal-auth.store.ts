"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PortalCustomer {
    id: string;
    name: string;
    type: string;
    outstandingAmount: number;
    creditLimit: number;
}

interface PortalAuthState {
    token: string | null;
    customer: PortalCustomer | null;
    isAuthenticated: boolean;
    setAuth: (token: string, customer: PortalCustomer) => void;
    logout: () => void;
}

export const createPortalAuthStore = (orgId: string) =>
    create<PortalAuthState>()(
        persist(
            (set) => ({
                token: null,
                customer: null,
                isAuthenticated: false,
                setAuth: (token, customer) =>
                    set({ token, customer, isAuthenticated: true }),
                logout: () =>
                    set({ token: null, customer: null, isAuthenticated: false }),
            }),
            { name: `portal-auth-${orgId}` }
        )
    );
