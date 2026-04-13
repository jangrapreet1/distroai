"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, LogIn, Search, X, User, LogOut, FileText, LayoutDashboard } from "lucide-react";
import { usePortalCart, usePortalAuth, usePortalOrgId, usePortalBusinessType } from "@/contexts/portal-context";
import { PortalAuthModal } from "./portal-auth-modal";
import { SlideOverCart } from "./slide-over-cart";

interface StoreInfo {
    id: string;
    name: string;
    logoUrl?: string;
    phone?: string;
}

export function PortalHeader({ storeInfo }: { storeInfo: StoreInfo | undefined }) {
    const orgId = usePortalOrgId();
    const cart = usePortalCart();
    const auth = usePortalAuth();
    const businessType = usePortalBusinessType();
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);

    const itemCount = cart.getItemCount();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            window.location.href = `/p/${orgId}?q=${encodeURIComponent(searchQuery)}`;
        }
    };

    return (
        <>
            <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#000000]/80 border-b border-[#222]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                    {/* Brand */}
                    <Link href={`/p/${orgId}`} className="flex items-center gap-3 shrink-0">
                        {storeInfo?.logoUrl ? (
                            <img src={storeInfo.logoUrl} alt="" className="w-8 h-8 rounded-md object-cover" />
                        ) : (
                            <div className="w-8 h-8 rounded-md bg-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] font-bold text-sm">
                                {storeInfo?.name?.charAt(0) || "S"}
                            </div>
                        )}
                        <div className="hidden sm:block">
                            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">
                                {storeInfo?.name || "Store"}
                            </h1>
                            <span className="text-[10px] text-[var(--gold)] font-medium px-1.5 py-0.5 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 uppercase tracking-wider">
                                {businessType === 'Retailer' ? 'Shop' : businessType === 'Distributor' || businessType === 'Manufacturer' ? 'B2B Portal' : 'Store'}
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Search */}
                    <form onSubmit={handleSearch} className="relative hidden md:block flex-1 max-w-md">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full pl-9 pr-4 py-2 bg-[#111] border border-[#333] rounded-full text-sm focus:outline-none focus:border-[var(--gold)] transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </form>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Mobile Search Toggle */}
                        <button
                            onClick={() => setShowSearch(!showSearch)}
                            className="md:hidden p-2 text-zinc-400 hover:text-white"
                        >
                            <Search className="w-5 h-5" />
                        </button>

                        {/* Auth — hidden for Retailer orgs (B2C consumers don't need accounts) */}
                        {auth.isAuthenticated && auth.customer ? (
                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 text-sm font-medium text-white hover:text-[var(--gold)] transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] text-xs font-bold">
                                        {auth.customer.name.charAt(0)}
                                    </div>
                                    <span className="hidden lg:inline max-w-[120px] truncate">{auth.customer.name}</span>
                                </button>

                                {showUserMenu && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                                        <div className="absolute right-0 top-full mt-2 w-56 bg-[#111] border border-[#333] rounded-xl shadow-2xl z-50 overflow-hidden">
                                            <div className="p-3 border-b border-[#222]">
                                                <p className="text-sm font-semibold text-white truncate">{auth.customer.name}</p>
                                                <p className="text-xs text-zinc-500 mt-0.5">
                                                    Balance: <span className="text-[var(--gold)] font-mono">₹{auth.customer.outstandingAmount.toLocaleString("en-IN")}</span>
                                                </p>
                                            </div>
                                            <Link
                                                href={`/p/${orgId}/account`}
                                                onClick={() => setShowUserMenu(false)}
                                                className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                                            >
                                                <LayoutDashboard className="w-4 h-4" /> My Account
                                            </Link>
                                            <Link
                                                href={`/p/${orgId}/account/orders`}
                                                onClick={() => setShowUserMenu(false)}
                                                className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                                            >
                                                <FileText className="w-4 h-4" /> Order History
                                            </Link>
                                            <button
                                                onClick={() => { auth.logout(); setShowUserMenu(false); }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                            >
                                                <LogOut className="w-4 h-4" /> Logout
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : businessType !== 'Retailer' ? (
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="flex items-center gap-2 text-sm font-medium text-white hover:text-[var(--gold)] transition-colors"
                            >
                                <LogIn className="w-4 h-4" />
                                <span className="hidden sm:inline">{businessType === 'Manufacturer' ? 'Partner Login' : 'Retailer Login'}</span>
                            </button>
                        ) : null}

                        {/* Cart */}
                        <button
                            onClick={() => setIsCartOpen(true)}
                            className="relative p-2 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                        >
                            <ShoppingCart className="w-6 h-6" />
                            {itemCount > 0 && (
                                <span className="absolute top-0 right-0 w-5 h-5 bg-[var(--gold)] text-black text-[10px] font-bold flex items-center justify-center rounded-full transform translate-x-1 -translate-y-1">
                                    {itemCount > 99 ? "99+" : itemCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Search Bar */}
                {showSearch && (
                    <form onSubmit={handleSearch} className="md:hidden px-4 pb-3 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                className="w-full pl-9 pr-4 py-2 bg-[#111] border border-[#333] rounded-full text-sm focus:outline-none focus:border-[var(--gold)]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <button type="button" onClick={() => setShowSearch(false)} className="p-2 text-zinc-400">
                            <X className="w-4 h-4" />
                        </button>
                    </form>
                )}
            </header>

            {showAuthModal && (
                <PortalAuthModal
                    onClose={() => setShowAuthModal(false)}
                />
            )}

            <SlideOverCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        </>
    );
}
