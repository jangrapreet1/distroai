"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Minus, Trash2, ShoppingCart, ArrowRight, ArrowLeft, X } from "lucide-react";
import { usePortalOrgId, usePortalCart, usePortalAuth } from "@/contexts/portal-context";
import { PortalAuthModal } from "./portal-auth-modal";
import { PortalCheckoutModal } from "./portal-checkout-modal";

interface SlideOverCartProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SlideOverCart({ isOpen, onClose }: SlideOverCartProps) {
    const orgId = usePortalOrgId();
    const cart = usePortalCart();
    const auth = usePortalAuth();
    const [showAuth, setShowAuth] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    const items = cart.getItems();
    const total = cart.getTotal();
    const itemCount = cart.getItemCount();

    const handleCheckout = () => {
        setShowCheckout(true);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Slide-over Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-[#0a0a0a] border-l border-[#222] shadow-[0_0_50px_rgba(0,0,0,0.5)] z-[70] transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] shrink-0 bg-[#0a0a0a] z-10 sticky top-0">
                    <div className="flex items-center gap-3">
                        <ShoppingCart className="w-5 h-5 text-[var(--gold)]" />
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            Cart <span className="text-zinc-500 font-normal text-sm ml-1">({itemCount})</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Cart Body */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                            <ShoppingCart className="w-16 h-16 text-zinc-700 mb-6" />
                            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Your cart is empty</h3>
                            <p className="text-sm text-zinc-500 mb-8 max-w-[250px] leading-relaxed">Browse the catalog to discover wholesale and premium products.</p>
                            <button
                                onClick={onClose}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black font-semibold rounded-full hover:bg-zinc-200 transition-colors shadow-lg active:scale-95"
                            >
                                <ArrowLeft className="w-4 h-4" /> Keep Shopping
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6 relative">
                            {/* Clear All Header */}
                            <div className="flex justify-end sticky top-0 bg-[#0a0a0a] pb-2 z-10">
                                <button
                                    onClick={() => cart.clearCart()}
                                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 bg-[#111] px-3 py-1 rounded-full border border-[#222]"
                                >
                                    <Trash2 className="w-3 h-3" /> Clear All
                                </button>
                            </div>

                            <div className="space-y-4">
                                {items.map((item) => (
                                    <div
                                        key={item.product.id}
                                        className="flex gap-4 p-3 bg-[#111] rounded-2xl border border-[#222] group hover:border-[#333] transition-colors"
                                    >
                                        <Link href={`/p/${orgId}/product/${item.product.id}`} className="shrink-0 block" onClick={onClose}>
                                            <div className="w-20 h-20 bg-[#000] rounded-xl border border-[#222] p-2 flex items-center justify-center shadow-inner overflow-hidden">
                                                {item.product.imageUrl ? (
                                                    <img src={item.product.imageUrl} className="max-w-full max-h-full object-contain mix-blend-screen group-hover:scale-110 transition-transform duration-500" alt="" />
                                                ) : (
                                                    <div className="text-zinc-600 font-bold text-lg">{item.product.name.charAt(0)}</div>
                                                )}
                                            </div>
                                        </Link>

                                        <div className="flex-1 min-w-0 py-1 flex flex-col">
                                            <div className="flex items-start justify-between gap-2">
                                                <Link href={`/p/${orgId}/product/${item.product.id}`} onClick={onClose}>
                                                    <h3 className="text-sm font-semibold text-zinc-200 hover:text-[var(--gold)] transition-colors line-clamp-2 leading-tight">
                                                        {item.product.name}
                                                    </h3>
                                                </Link>
                                                <button
                                                    onClick={() => cart.removeItem(item.product.id)}
                                                    className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors shrink-0 -mt-1 -mr-1"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div className="mt-1 mb-auto">
                                                <p className="text-[13px] font-bold text-[var(--gold)] font-mono tracking-tight">
                                                    ₹{item.product.price.toLocaleString("en-IN")}
                                                    {item.product.unit && <span className="text-zinc-500 font-normal text-[10px] ml-1">/{item.product.unit}</span>}
                                                </p>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between">
                                                <div className="flex items-center border border-[#333] rounded-lg overflow-hidden bg-[#0a0a0a]">
                                                    <button
                                                        onClick={() => cart.updateQuantity(item.product.id, -1)}
                                                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors"
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="w-8 text-center text-[13px] font-mono select-none">{item.quantity}</span>
                                                    <button
                                                        onClick={() => cart.updateQuantity(item.product.id, 1)}
                                                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <span className="text-[15px] font-bold text-white font-mono">
                                                    ₹{(item.quantity * item.product.price).toLocaleString("en-IN")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Check Out */}
                {items.length > 0 && (
                    <div className="shrink-0 bg-[#0a0a0a] border-t border-[#222] p-6 pb-8 env(safe-area-inset-bottom)">
                        <div className="flex justify-between items-end mb-5">
                            <div className="flex flex-col gap-1">
                                <p className="text-zinc-400 text-sm font-medium tracking-tight">Estimated Total</p>
                                {auth.isAuthenticated ? (
                                    <span className="text-[10px] text-[var(--gold)] uppercase tracking-widest font-bold px-2 py-0.5 bg-[var(--gold)]/10 rounded-sm w-fit border border-[var(--gold)]/20">B2B Wholesale</span>
                                ) : (
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Taxes calculated at checkout</span>
                                )}
                            </div>
                            <span className="text-3xl font-bold font-mono text-white tracking-tighter">
                                ₹{total.toLocaleString("en-IN")}
                            </span>
                        </div>

                        <button
                            onClick={handleCheckout}
                            className="w-full bg-[var(--gold)] hover:bg-[#eab308] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_30px_rgba(234,179,8,0.15)] active:scale-[0.98] text-[15px] uppercase tracking-wide"
                        >
                            Checkout precisely <ArrowRight className="w-4 h-4" />
                        </button>

                        {!auth.isAuthenticated && (
                            <div className="text-center mt-4">
                                <button onClick={() => setShowAuth(true)} className="text-[var(--gold)] hover:underline text-xs font-medium">
                                    Login as partner
                                </button>
                                <span className="text-xs text-zinc-500"> for net-terms checkout</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals rendered on top */}
            {showAuth && <PortalAuthModal onClose={() => setShowAuth(false)} />}
            {showCheckout && (
                <PortalCheckoutModal
                    onClose={() => setShowCheckout(false)}
                    onSuccess={() => { setShowCheckout(false); onClose(); cart.clearCart(); }}
                />
            )}
        </>
    );
}
