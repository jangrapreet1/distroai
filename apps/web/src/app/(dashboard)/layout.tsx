"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard, ShoppingCart, FileText, Package, Users, Truck,
    CreditCard, ClipboardList, Receipt, BarChart3, Sparkles, Megaphone,
    Settings, Menu, X, Search, Command, Sun, Moon, Undo2, PieChart, Clock, Coins, FileSpreadsheet, ShieldCheck,
    SlidersHorizontal, Building2, LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth.store";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useSyncOfflineData } from "@/hooks/useSyncOfflineData";
import { SidebarContent, type NavGroup } from "@/components/dashboard/sidebar";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { SearchModal } from "@/components/dashboard/search-modal";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { useTheme } from "@/contexts/ThemeProvider";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";

const NAV_GROUPS: NavGroup[] = [
    {
        title: "operations_title",
        items: [
            { label: "dashboard", href: "/dashboard", icon: LayoutDashboard },
            { label: "orders", href: "/orders", icon: ShoppingCart },
            { label: "invoices", href: "/invoices", icon: FileText },
            { label: "inventory", href: "/inventory", icon: Package, roles: ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'] },
            { label: "customers", href: "/customers", icon: Users },
            { label: "suppliers", href: "/suppliers", icon: Truck, roles: ['OWNER', 'ADMIN', 'MANAGER'] },
        ],
    },
    {
        title: "finance_title",
        roles: ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
        items: [
            { label: "finance", href: "/payments", icon: CreditCard },
            { label: "purchase_orders", href: "/purchase-orders", icon: ClipboardList, roles: ['OWNER', 'ADMIN', 'MANAGER'] },
            { label: "expenses", href: "/expenses", icon: Receipt },
            { label: "Returns", href: "/returns", icon: Undo2 },
        ],
    },
    {
        title: "intelligence_title",
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
        items: [
            { label: "ai_assistant", href: "/ai", icon: Sparkles },
            { label: "analytics", href: "/analytics", icon: BarChart3 },
            { label: "ads", href: "/ads", icon: Megaphone, roles: ['OWNER', 'ADMIN', 'MANAGER'] },
        ],
    },
    {
        title: "reports_title",
        roles: ['OWNER', 'ADMIN', 'ACCOUNTANT'],
        items: [
            { label: "P&L", href: "/reports", icon: PieChart },
            { label: "Aging", href: "/reports/aging", icon: Clock },
            { label: "Commissions", href: "/reports/commissions", icon: Coins, roles: ['OWNER', 'ADMIN'] },
            { label: "Tally Export", href: "/reports/tally", icon: FileSpreadsheet, roles: ['OWNER', 'ADMIN', 'ACCOUNTANT'] },
            { label: "GST (GSTR-1)", href: "/reports/gst", icon: ShieldCheck, roles: ['OWNER', 'ADMIN', 'ACCOUNTANT'] },
        ],
    },
    {
        title: "settings_title",
        roles: ['OWNER', 'ADMIN'],
        items: [
            { label: "settings", href: "/settings", icon: Settings },
        ],
    },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, org, logout } = useAuth();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const accessToken = useAuthStore((s) => s.accessToken);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const [hydrated, setHydrated] = useState(false);

    useSyncOfflineData();

    // Wait for Zustand persist to hydrate from localStorage before deciding auth state
    useEffect(() => {
        // Zustand persist hydrates synchronously on first render in most cases,
        // but we add a small delay to be safe across environments
        const unsub = useAuthStore.persist.onFinishHydration?.(() => setHydrated(true));
        // If already hydrated (common case), set immediately
        if (useAuthStore.persist.hasHydrated?.()) setHydrated(true);
        return () => { if (typeof unsub === 'function') unsub(); };
    }, []);

    // Session recovery: if the Zustand store has tokens (from localStorage)
    // but the browser cookie is missing, re-set it so the middleware doesn't
    // redirect to /login on page reload.
    useEffect(() => {
        if (!hydrated) return;
        const token = useAuthStore.getState().accessToken;
        if (token && typeof document !== "undefined" && !document.cookie.includes('accessToken=')) {
            document.cookie = `accessToken=${token};path=/;max-age=2592000;SameSite=Lax`;
        }
    }, [hydrated]);

    // Auth gate: if store is hydrated and user is not authenticated, redirect to login
    useEffect(() => {
        if (!hydrated) return;
        const state = useAuthStore.getState();
        const hasToken = !!state.accessToken || (typeof document !== "undefined" && document.cookie.includes('accessToken='));
        if (!isAuthenticated && !hasToken) {
            router.replace(`/login${pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : ''}`);
        }
    }, [hydrated, isAuthenticated, router, pathname]);

    // ⌘K keyboard shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setSearchOpen((v) => !v);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    // Notifications from dashboard data
    const { data: dashData } = useQuery({
        queryKey: ["analytics", "dashboard"],
        queryFn: () => apiClient.get("/api/v1/analytics/dashboard").then((r) => r.data),
        retry: false, staleTime: 60_000,
        enabled: hydrated && isAuthenticated,
    });
    const dd = dashData?.data ?? dashData ?? {};

    const notifications = useMemo(() => {
        const items: { msg: string; t: string; color: string; href: string; ts: number }[] = [];
        const now = Date.now();
        const lowStock = dd?.inventory?.lowStockCount ?? 0;
        if (lowStock > 0) items.push({ msg: `Low stock: ${lowStock} product${lowStock > 1 ? 's' : ''} below reorder level`, t: 'Now', color: 'var(--orange)', href: '/inventory', ts: now });
        const outstanding = dd?.collections?.totalOutstanding ?? 0;
        if (outstanding > 0) items.push({ msg: `Outstanding: ₹${outstanding.toLocaleString('en-IN')} total due`, t: 'Now', color: 'var(--red)', href: '/payments', ts: now });
        const recent = dd?.recentOrders ?? [];
        recent.slice(0, 3).forEach((o: any) => {
            const createdTs = new Date(o.createdAt).getTime();
            const ago = Math.round((now - createdTs) / 60000);
            const t = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
            items.push({ msg: `Order ${o.orderNumber} from ${o.customer?.name ?? 'Unknown'} — ₹${(o.netAmount ?? 0).toLocaleString('en-IN')}`, t, color: 'var(--gold)', href: `/orders/${o.id}`, ts: createdTs });
        });
        const locs = dd?.recentLocationUpdates ?? [];
        locs.slice(0, 3).forEach((l: any) => {
            const updatedTs = new Date(l.updatedAt).getTime();
            const ago = Math.round((now - updatedTs) / 60000);
            const t = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
            items.push({ msg: `📍 Location shared by ${l.customer?.name ?? 'Unknown'}`, t, color: 'var(--whatsapp)', href: '/customers', ts: updatedTs });
        });
        return items;
    }, [dd]);

    const sidebarProps = {
        navGroups: NAV_GROUPS,
        userRole: user?.role ?? 'VIEWER',
        userName: user?.firstName,
        orgName: org?.name,
        orgPlan: org?.plan,
        pathname,
        onLogout: logout,
    };

    // Show loading skeleton while hydrating or if not authenticated (prevents flash)
    if (!hydrated || !isAuthenticated) {
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: "100vh", background: "var(--bg-primary)",
            }}>
                <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem",
                }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        border: "3px solid var(--border)",
                        borderTopColor: "var(--gold)",
                        animation: "spin 0.8s linear infinite",
                    }} />
                    <span style={{ fontSize: ".85rem", color: "var(--text-muted)" }}>Loading DistroAI...</span>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    return (
        <LanguageProvider>
            <div className="min-h-screen flex bg-[var(--bg-primary)]">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:flex flex-col w-60 bg-[var(--bg-secondary)] border-r border-[var(--border)] h-screen sticky top-0">
                    <SidebarContent {...sidebarProps} />
                </aside>

                {/* Mobile Sidebar Drawer */}
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                        <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col animate-in slide-in-from-left">
                            <div className="absolute right-3 top-3">
                                <button onClick={() => setSidebarOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={20} /></button>
                            </div>
                            <SidebarContent {...sidebarProps} onNavClick={() => setSidebarOpen(false)} />
                        </aside>
                    </div>
                )}

                {/* Main content */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Topbar */}
                    <header className="h-14 border-b border-[var(--border)] flex items-center justify-between px-3 sm:px-4 lg:px-6 bg-[var(--bg-secondary)]/80 backdrop-blur-lg sticky top-0 z-30">
                        <div className="flex items-center gap-2.5">
                            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-[var(--text-secondary)] p-1.5 rounded-lg hover:bg-[var(--bg-card)] transition">
                                <Menu size={20} />
                            </button>
                            <div className="lg:hidden flex items-center">
                                <span className="font-bold text-sm sm:text-base text-[var(--text-primary)] capitalize truncate max-w-[160px]">
                                    {pathname === "/dashboard" || pathname === "/"
                                        ? "Dashboard"
                                        : pathname.split("/").filter(Boolean)[0]?.replace(/-/g, " ")}
                                </span>
                            </div>
                            <nav className="hidden sm:flex items-center gap-1 text-sm text-[var(--text-muted)]">
                                <Link href="/dashboard" className="hover:text-[var(--text-secondary)] transition">Home</Link>
                                {pathname !== "/dashboard" && pathname !== "/" && (
                                    <>
                                        <span>/</span>
                                        <span className="text-[var(--text-primary)] capitalize">
                                            {pathname.split("/").filter(Boolean)[0]?.replace(/-/g, " ")}
                                        </span>
                                    </>
                                )}
                            </nav>
                        </div>

                        <div onClick={() => setSearchOpen(true)} className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-muted)] w-64 cursor-pointer hover:border-[var(--gold)]/30 transition">
                            <Search size={14} />
                            <span className="flex-1">Search...</span>
                            <kbd className="text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--border)]">⌘K</kbd>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <button
                                type="button"
                                onClick={() => setSearchOpen(true)}
                                className="md:hidden w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition"
                                title="Search"
                            >
                                <Search size={16} />
                            </button>
                            <button
                                onClick={toggleTheme}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition"
                                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                            >
                                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                            <NotificationBell notifications={notifications} />
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 active:scale-95 transition"
                                    title="Account & Preferences"
                                    aria-label="User Account Menu"
                                >
                                    {(user?.firstName?.[0] || "U").toUpperCase()}
                                </button>

                                {userMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                                            <div className="px-3.5 py-2 border-b border-[var(--border)]">
                                                <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                                                    {user?.firstName} {user?.lastName}
                                                </p>
                                                <p className="text-[10px] text-[var(--text-muted)] truncate">{user?.email}</p>
                                                <span className="inline-block mt-1 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                    {user?.role ?? "MEMBER"}
                                                </span>
                                            </div>

                                            <div className="py-1">
                                                <Link
                                                    href="/settings/preferences"
                                                    onClick={() => setUserMenuOpen(false)}
                                                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                                                >
                                                    <SlidersHorizontal size={14} className="text-blue-500" />
                                                    <span>Preferences & Defaults</span>
                                                </Link>
                                                <Link
                                                    href="/settings/org"
                                                    onClick={() => setUserMenuOpen(false)}
                                                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                                                >
                                                    <Building2 size={14} className="text-[var(--text-muted)]" />
                                                    <span>Organization Profile</span>
                                                </Link>
                                            </div>

                                            <div className="border-t border-[var(--border)] pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setUserMenuOpen(false);
                                                        logout();
                                                    }}
                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors text-left"
                                                >
                                                    <LogOut size={14} />
                                                    <span>Log out</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Page content */}
                    <main className="flex-1 p-3 pb-36 sm:p-4 sm:pb-36 lg:p-6 lg:pb-8 pb-safe">
                        {children}
                    </main>
                </div>

                {/* Mobile Bottom Navigation */}
                <MobileBottomNav />

                {/* ⌘K Search Modal */}
                <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} navGroups={NAV_GROUPS} />

                {/* Global Plan Upgrade Interceptor Modal */}
                <UpgradeModal />
            </div>
        </LanguageProvider>
    );
}
