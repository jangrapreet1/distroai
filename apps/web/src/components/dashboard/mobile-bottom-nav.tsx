"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { triggerHaptic } from "@/lib/utils";
import {
    LayoutDashboard,
    ShoppingCart,
    BookOpen,
    Package,
    Plus,
    X,
    Receipt,
    CreditCard,
    UserPlus,
    FileSpreadsheet,
    SlidersHorizontal,
    Settings,
    Sparkles,
    Megaphone,
} from "lucide-react";

export function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);

    const NAV_ITEMS = [
        { label: "Home", href: "/dashboard", icon: LayoutDashboard },
        { label: "Orders", href: "/orders", icon: ShoppingCart },
        { label: "Khata", href: "/customers", icon: BookOpen },
        { label: "Inventory", href: "/inventory", icon: Package },
    ];

    // Hide mobile bottom nav on AI chat page to avoid blocking message input and viewport
    if (pathname.startsWith("/ai")) {
        return null;
    }

    const isCurrentActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
        return pathname.startsWith(href);
    };

    return (
        <>
            {/* ─── Bottom Navigation Bar ─── */}
            <nav
                className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-secondary)]/95 backdrop-blur-md border-t border-[var(--border)] px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_25px_rgba(0,0,0,0.4)]"
                aria-label="Mobile Bottom Navigation"
            >
                <div className="flex items-center justify-around relative max-w-md mx-auto">
                    {/* Item 1: Home */}
                    <Link
                        href={NAV_ITEMS[0].href}
                        onClick={() => triggerHaptic(10)}
                        className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] transition active:scale-95 ${
                            isCurrentActive(NAV_ITEMS[0].href)
                                ? "text-blue-600 dark:text-blue-400 font-semibold"
                                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                    >
                        <LayoutDashboard size={20} />
                        <span className="text-[10px] mt-1 tracking-tight">{NAV_ITEMS[0].label}</span>
                        {isCurrentActive(NAV_ITEMS[0].href) && (
                            <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
                        )}
                    </Link>

                    {/* Item 2: Orders */}
                    <Link
                        href={NAV_ITEMS[1].href}
                        onClick={() => triggerHaptic(10)}
                        className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] transition active:scale-95 ${
                            isCurrentActive(NAV_ITEMS[1].href)
                                ? "text-blue-600 dark:text-blue-400 font-semibold"
                                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                    >
                        <ShoppingCart size={20} />
                        <span className="text-[10px] mt-1 tracking-tight">{NAV_ITEMS[1].label}</span>
                        {isCurrentActive(NAV_ITEMS[1].href) && (
                            <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
                        )}
                    </Link>

                    {/* Center Action FAB (+ button) */}
                    <div className="flex flex-col items-center justify-center px-1">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic(18);
                                setQuickActionsOpen(true);
                            }}
                            aria-label="Open Quick Action Menu"
                            className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 -translate-y-3 border-2 border-[var(--bg-secondary)] active:scale-90 transition-transform duration-150"
                        >
                            <Plus size={24} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Item 3: Khata / Customers */}
                    <Link
                        href={NAV_ITEMS[2].href}
                        onClick={() => triggerHaptic(10)}
                        className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] transition active:scale-95 ${
                            isCurrentActive(NAV_ITEMS[2].href)
                                ? "text-blue-600 dark:text-blue-400 font-semibold"
                                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                    >
                        <BookOpen size={20} />
                        <span className="text-[10px] mt-1 tracking-tight">{NAV_ITEMS[2].label}</span>
                        {isCurrentActive(NAV_ITEMS[2].href) && (
                            <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
                        )}
                    </Link>

                    {/* Item 4: Inventory */}
                    <Link
                        href={NAV_ITEMS[3].href}
                        onClick={() => triggerHaptic(10)}
                        className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] transition active:scale-95 ${
                            isCurrentActive(NAV_ITEMS[3].href)
                                ? "text-blue-600 dark:text-blue-400 font-semibold"
                                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                    >
                        <Package size={20} />
                        <span className="text-[10px] mt-1 tracking-tight">{NAV_ITEMS[3].label}</span>
                        {isCurrentActive(NAV_ITEMS[3].href) && (
                            <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
                        )}
                    </Link>
                </div>
            </nav>

            {/* ─── Quick Actions Bottom Sheet Modal ─── */}
            {quickActionsOpen && (
                <div className="fixed inset-0 z-50 lg:hidden flex items-end">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
                        onClick={() => setQuickActionsOpen(false)}
                    />
                    <div className="relative w-full bg-[var(--bg-card)] border-t border-[var(--border)] rounded-t-3xl p-5 pb-8 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
                        <div className="flex items-center justify-between border-b border-[var(--border)]/50 pb-3">
                            <div>
                                <h3 className="font-bold text-base text-[var(--text-primary)]">Quick Actions</h3>
                                <p className="text-xs text-[var(--text-muted)]">Instant operations for mobile</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQuickActionsOpen(false)}
                                className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic(12);
                                    setQuickActionsOpen(false);
                                    router.push("/orders/new");
                                }}
                                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-blue-500/40 text-left transition active:scale-95"
                            >
                                <div className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                    <ShoppingCart size={17} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">New Order</p>
                                    <p className="text-[10px] text-[var(--text-muted)] truncate">B2B / B2C bill</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic(12);
                                    setQuickActionsOpen(false);
                                    router.push("/customers");
                                }}
                                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-emerald-500/40 text-left transition active:scale-95"
                            >
                                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                                    <CreditCard size={17} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">Payment / Khata</p>
                                    <p className="text-[10px] text-[var(--text-muted)] truncate">Record receipt</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic(12);
                                    setQuickActionsOpen(false);
                                    router.push("/ai");
                                }}
                                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-purple-500/40 text-left transition active:scale-95"
                            >
                                <div className="w-9 h-9 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                                    <Sparkles size={17} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">AI Copilot</p>
                                    <p className="text-[10px] text-[var(--text-muted)] truncate">Ask questions</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic(12);
                                    setQuickActionsOpen(false);
                                    router.push("/ads");
                                }}
                                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-blue-500/40 text-left transition active:scale-95"
                            >
                                <div className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                                    <Megaphone size={17} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">Meta Ads</p>
                                    <p className="text-[10px] text-[var(--text-muted)] truncate">Run campaigns</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic(12);
                                    setQuickActionsOpen(false);
                                    router.push("/customers");
                                }}
                                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-amber-500/40 text-left transition active:scale-95"
                            >
                                <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                                    <UserPlus size={17} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">Add Customer</p>
                                    <p className="text-[10px] text-[var(--text-muted)] truncate">New khata account</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic(12);
                                    setQuickActionsOpen(false);
                                    router.push("/inventory");
                                }}
                                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-cyan-500/40 text-left transition active:scale-95"
                            >
                                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 text-cyan-500 flex items-center justify-center shrink-0">
                                    <Package size={17} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">Check Stock</p>
                                    <p className="text-[10px] text-[var(--text-muted)] truncate">View inventory</p>
                                </div>
                            </button>
                        </div>

                        {/* Direct Preferences & Settings shortcut */}
                        <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs px-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setQuickActionsOpen(false);
                                    router.push("/settings/preferences");
                                }}
                                className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                            >
                                <SlidersHorizontal size={14} /> App Preferences
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setQuickActionsOpen(false);
                                    router.push("/settings/org");
                                }}
                                className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                            >
                                <Settings size={13} /> Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
