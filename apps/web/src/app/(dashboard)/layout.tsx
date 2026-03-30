"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard, ShoppingCart, FileText, Package, Users, Truck,
    CreditCard, ClipboardList, Map, MapPin, Eye, BarChart3, Bot,
    Settings, Receipt, LogOut, Menu, X, ChevronDown, Bell, Search, Command,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import clsx from "clsx";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { useSyncOfflineData } from "@/hooks/useSyncOfflineData";
import { Logo } from "@/components/Logo";

interface NavItem { label: string; href: string; icon: React.ElementType; roles?: string[] }
interface NavGroup { title: string; items: NavItem[]; roles?: string[] }

const NAV_GROUPS: NavGroup[] = [
    {
        title: "operations_title",
        items: [
            { label: "dashboard", href: "/", icon: LayoutDashboard },
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
        ],
    },
    /*
    {
        title: "FIELD",
        items: [
            { label: "field_force", href: "/field", icon: MapPin },
            { label: "routes", href: "/field/routes", icon: Map },
            { label: "visits", href: "/field/visits", icon: Eye },
        ],
    },
    */
    {
        title: "intelligence_title",
        roles: ['OWNER', 'ADMIN', 'MANAGER'],
        items: [
            { label: "analytics", href: "/analytics", icon: BarChart3 },
            { label: "AI Chat", href: "/ai", icon: Bot },
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

function getFilteredNav(role: string): NavGroup[] {
    return NAV_GROUPS
        .filter(g => !g.roles || g.roles.includes(role))
        .map(g => ({
            ...g,
            items: g.items.filter(i => !i.roles || i.roles.includes(role)),
        }))
        .filter(g => g.items.length > 0);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, org, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const router = useRouter();
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        };
        if (notifOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [notifOpen]);

    // Start background offline sync
    useSyncOfflineData();

    // Real notifications from dashboard data
    const { data: dashData } = useQuery({
        queryKey: ["analytics", "dashboard"],
        queryFn: () => apiClient.get("/api/v1/analytics/dashboard").then((r) => r.data),
        retry: false, staleTime: 60_000,
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

    // Unread tracking via localStorage
    const [lastReadTs, setLastReadTs] = useState(() => {
        if (typeof window === 'undefined') return 0;
        return Number(localStorage.getItem('notif-read-ts') || '0');
    });
    const unreadCount = useMemo(() => notifications.filter(n => n.ts > lastReadTs).length, [notifications, lastReadTs]);
    const markAllRead = () => {
        const now = Date.now();
        localStorage.setItem('notif-read-ts', String(now));
        setLastReadTs(now);
    };

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

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    const SidebarContent = () => {
        const { t } = useLanguage();
        return (
            <>
                {/* Logo */}
                <div className="px-5 pt-6 pb-4 border-b border-[var(--border)]">
                    <Logo className="w-8 h-8" textCls="text-xl" />
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-[var(--text-secondary)] truncate">{org?.name ?? "My Organization"}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] font-medium uppercase">
                            {org?.plan ?? "FREE"}
                        </span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    {getFilteredNav(user?.role ?? 'VIEWER').map((group) => (
                        <div key={group.title} className="mb-5">
                            <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider px-3 mb-2 uppercase">{t(group.title as any)}</p>
                            {group.items.map((item) => {
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setSidebarOpen(false)}
                                        className={clsx(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all mb-0.5",
                                            active
                                                ? "bg-[var(--gold)]/8 text-[var(--gold)] border-l-2 border-[var(--gold)]"
                                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                                        )}
                                    >
                                        <item.icon size={18} />
                                        {t(item.label)}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* User */}
                <div className="px-4 py-4 border-t border-[var(--border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--gold)]/15 flex items-center justify-center text-sm font-semibold text-[var(--gold)]">
                            {user?.firstName?.[0] ?? "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.firstName ?? "User"}</p>
                            <p className="text-xs text-[var(--text-muted)] capitalize">{user?.role?.toLowerCase() ?? "viewer"}</p>
                        </div>
                        <button onClick={logout} className="text-[var(--text-muted)] hover:text-[var(--red)] transition" title="Logout">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </>
        );
    };

    return (
        <LanguageProvider>
            <div className="min-h-screen flex bg-[var(--bg-primary)]">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:flex flex-col w-60 bg-[var(--bg-secondary)] border-r border-[var(--border)] h-screen sticky top-0">
                    <SidebarContent />
                </aside>

                {/* Mobile Sidebar Drawer */}
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                        <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col animate-in slide-in-from-left">
                            <div className="absolute right-3 top-3">
                                <button onClick={() => setSidebarOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={20} /></button>
                            </div>
                            <SidebarContent />
                        </aside>
                    </div>
                )}

                {/* Main content */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Topbar */}
                    <header className="h-14 border-b border-[var(--border)] flex items-center justify-between px-4 lg:px-6 bg-[var(--bg-secondary)]/50 backdrop-blur-lg sticky top-0 z-30">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-[var(--text-secondary)]">
                                <Menu size={20} />
                            </button>
                            <nav className="hidden sm:flex items-center gap-1 text-sm text-[var(--text-muted)]">
                                <Link href="/" className="hover:text-[var(--text-secondary)] transition">Home</Link>
                                {pathname !== "/" && (
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

                        <div className="flex items-center gap-3">
                            <div className="relative" ref={notifRef}>
                                <button onClick={() => setNotifOpen(!notifOpen)} className="relative text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
                                    <Bell size={18} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--red)] text-[9px] flex items-center justify-center text-white font-bold">{unreadCount}</span>
                                    )}
                                </button>
                                {notifOpen && (
                                    <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-xl z-50">
                                        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
                                            <span className="text-sm font-semibold">Notifications</span>
                                            <div className="flex items-center gap-2">
                                                {unreadCount > 0 && <button onClick={markAllRead} className="text-[10px] text-[var(--gold)] hover:underline">Mark all read</button>}
                                                <button onClick={() => setNotifOpen(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
                                            </div>
                                        </div>
                                        {notifications.length > 0 ? notifications.map((n, i) => (
                                            <Link key={i} href={n.href} onClick={() => setNotifOpen(false)}
                                                className={`block p-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card-hover)] transition cursor-pointer ${n.ts > lastReadTs ? 'bg-[var(--gold)]/[0.03]' : ''}`}>
                                                <p className="text-sm text-[var(--text-primary)]">{n.msg}</p>
                                                <p className="text-[10px] mt-0.5" style={{ color: n.color }}>{n.t}</p>
                                            </Link>
                                        )) : (
                                            <div className="p-4 text-center text-sm text-[var(--text-muted)]">No notifications</div>
                                        )}
                                        <div className="p-2 text-center">
                                            <Link href="/settings" onClick={() => setNotifOpen(false)} className="text-xs text-[var(--gold)] hover:underline">Notification Settings</Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-[var(--gold)]/15 flex items-center justify-center text-xs font-semibold text-[var(--gold)]">
                                {user?.firstName?.[0] ?? "U"}
                            </div>
                        </div>
                    </header>

                    {/* Page content */}
                    <main className="flex-1 p-4 lg:p-6">
                        {children}
                    </main>
                </div>

                {/* ⌘K Search Modal */}
                {searchOpen && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
                                <Search size={16} className="text-[var(--text-muted)]" />
                                <input autoFocus placeholder="Search pages, actions..." className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                                    onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}
                                    onChange={(e) => {
                                        const qEl = document.querySelectorAll('[data-search-item]');
                                        qEl.forEach((el) => {
                                            const match = el.textContent?.toLowerCase().includes(e.target.value.toLowerCase());
                                            (el as HTMLElement).style.display = match || !e.target.value ? '' : 'none';
                                        });
                                    }}
                                />
                                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)]">ESC</kbd>
                            </div>
                            <div className="max-h-72 overflow-y-auto py-2">
                                {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
                                    <button key={item.href} data-search-item onClick={() => { router.push(item.href); setSearchOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition">
                                        <item.icon size={16} /> {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </LanguageProvider>
    );
}
