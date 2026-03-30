"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
    product: {
        id: string;
        name: string;
        price: number;
        originalPrice?: number;
        imageUrl?: string;
        category?: string;
        isB2B?: boolean;
        unit?: string;
    };
    quantity: number;
}

interface PortalCartState {
    items: Record<string, CartItem>;
    addItem: (product: CartItem["product"]) => void;
    updateQuantity: (productId: string, delta: number) => void;
    removeItem: (productId: string) => void;
    clearCart: () => void;
    getItems: () => CartItem[];
    getTotal: () => number;
    getItemCount: () => number;
}

export const createPortalCartStore = (orgId: string) =>
    create<PortalCartState>()(
        persist(
            (set, get) => ({
                items: {},
                addItem: (product) =>
                    set((state) => {
                        const current = state.items[product.id]?.quantity || 0;
                        return {
                            items: {
                                ...state.items,
                                [product.id]: { product, quantity: current + 1 },
                            },
                        };
                    }),
                updateQuantity: (productId, delta) =>
                    set((state) => {
                        const next = { ...state.items };
                        if (!next[productId]) return state;
                        const newQty = next[productId].quantity + delta;
                        if (newQty <= 0) delete next[productId];
                        else next[productId] = { ...next[productId], quantity: newQty };
                        return { items: next };
                    }),
                removeItem: (productId) =>
                    set((state) => {
                        const next = { ...state.items };
                        delete next[productId];
                        return { items: next };
                    }),
                clearCart: () => set({ items: {} }),
                getItems: () => Object.values(get().items),
                getTotal: () =>
                    Object.values(get().items).reduce(
                        (acc, item) => acc + item.product.price * item.quantity,
                        0
                    ),
                getItemCount: () =>
                    Object.values(get().items).reduce(
                        (acc, item) => acc + item.quantity,
                        0
                    ),
            }),
            { name: `portal-cart-${orgId}` }
        )
    );
