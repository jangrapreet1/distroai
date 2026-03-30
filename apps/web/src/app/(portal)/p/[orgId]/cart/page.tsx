"use client";

import Link from "next/link";
import { Plus, Minus, Trash2, ShoppingCart, ArrowRight, ArrowLeft } from "lucide-react";
import { usePortalOrgId, usePortalCart, usePortalAuth } from "@/contexts/portal-context";
import { useState } from "react";
import { PortalAuthModal } from "../components/portal-auth-modal";
import { PortalCheckoutModal } from "../components/portal-checkout-modal";

export default function CartPage() {
    const orgId = usePortalOrgId();
    const cart = usePortalCart();
    const auth = usePortalAuth();
    const [showAuth, setShowAuth] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);

    const items = cart.getItems();
    const total = cart.getTotal();
    const itemCount = cart.getItemCount();

    const handleCheckout = () => {
        setShowCheckout(true);
    };

    if (items.length === 0) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center text-center">
                <ShoppingCart className="w-16 h-16 text-zinc-700 mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Your cart is empty</h2>
                <p className="text-sm text-zinc-500 mb-6">Browse the catalog and add products to get started</p>
                <Link
                    href={`/p/${orgId}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--gold)] text-black font-semibold rounded-lg hover:bg-[#eab308] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Browse Catalog
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-white">
                    Your Cart <span className="text-zinc-500 font-normal text-base">({itemCount} items)</span>
                </h1>
                <button
                    onClick={() => cart.clearCart()}
                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors underline underline-offset-2"
                >
                    Clear All
                </button>
            </div>

            {/* Cart Items */}
            <div className="space-y-3 mb-8">
                {items.map((item) => (
                    <div
                        key={item.product.id}
                        className="flex gap-4 p-4 bg-[#111] rounded-xl border border-[#222] hover:border-[#333] transition-colors"
                    >
                        <Link href={`/p/${orgId}/product/${item.product.id}`} className="shrink-0">
                            <div className="w-20 h-20 bg-[#0a0a0a] rounded-lg border border-[#222] p-2 flex items-center justify-center">
                                {item.product.imageUrl ? (
                                    <img src={item.product.imageUrl} className="max-w-full max-h-full object-contain" alt="" />
                                ) : (
                                    <div className="text-zinc-600 font-bold text-lg">{item.product.name.charAt(0)}</div>
                                )}
                            </div>
                        </Link>

                        <div className="flex-1 min-w-0">
                            <Link href={`/p/${orgId}/product/${item.product.id}`}>
                                <h3 className="text-sm font-semibold text-zinc-200 hover:text-[var(--gold)] transition-colors line-clamp-1">
                                    {item.product.name}
                                </h3>
                            </Link>
                            {item.product.category && (
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{item.product.category}</p>
                            )}
                            <p className="text-[var(--gold)] font-mono text-sm font-semibold mt-2">
                                ₹{item.product.price.toLocaleString("en-IN")}
                                {item.product.unit && <span className="text-zinc-500 font-normal text-xs"> / {item.product.unit}</span>}
                            </p>

                            <div className="mt-3 flex items-center justify-between">
                                <div className="flex items-center border border-[#333] rounded-lg overflow-hidden bg-[#0a0a0a]">
                                    <button
                                        onClick={() => cart.updateQuantity(item.product.id, -1)}
                                        className="w-8 h-8 flex items-center justify-center hover:bg-white/10"
                                    >
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="w-10 text-center text-sm font-mono">{item.quantity}</span>
                                    <button
                                        onClick={() => cart.updateQuantity(item.product.id, 1)}
                                        className="w-8 h-8 flex items-center justify-center hover:bg-white/10"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-white font-mono">
                                        ₹{(item.quantity * item.product.price).toLocaleString("en-IN")}
                                    </span>
                                    <button
                                        onClick={() => cart.removeItem(item.product.id)}
                                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary & Checkout */}
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6 sticky bottom-20 md:bottom-0">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <p className="text-zinc-400 text-sm">Subtotal ({itemCount} items)</p>
                        {auth.isAuthenticated && (
                            <p className="text-[10px] text-[var(--gold)] mt-0.5">Wholesale pricing applied</p>
                        )}
                    </div>
                    <span className="text-2xl font-bold font-mono text-white">
                        ₹{total.toLocaleString("en-IN")}
                    </span>
                </div>

                <button
                    onClick={handleCheckout}
                    className="w-full bg-[var(--gold)] hover:bg-[#eab308] text-black font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.2)] text-base"
                >
                    Proceed to Checkout <ArrowRight className="w-4 h-4" />
                </button>

                {!auth.isAuthenticated && (
                    <p className="text-center text-xs text-zinc-500 mt-3">
                        <button onClick={() => setShowAuth(true)} className="text-[var(--gold)] hover:underline">
                            Login as retailer
                        </button>{" "}
                        for wholesale pricing & pay-later
                    </p>
                )}
            </div>

            {showAuth && <PortalAuthModal onClose={() => setShowAuth(false)} />}
            {showCheckout && (
                <PortalCheckoutModal
                    onClose={() => setShowCheckout(false)}
                    onSuccess={() => { setShowCheckout(false); cart.clearCart(); }}
                />
            )}
        </div>
    );
}
