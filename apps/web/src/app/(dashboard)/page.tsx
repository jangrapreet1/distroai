"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, IndianRupee, AlertTriangle, Package, RefreshCw, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { greeting } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { KPICard, formatINR } from "@/components/dashboard/kpi-card";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { AlertsFeed } from "@/components/dashboard/alerts-feed";
import { TopLists } from "@/components/dashboard/top-lists";

export default function DashboardPage() {
    const user = useAuthStore((s) => s.user);
    const [chartRange, setChartRange] = useState<"7D" | "30D" | "90D">("30D");
    const { t } = useLanguage();

    const { data: dashboard, refetch, isLoading } = useQuery({
        queryKey: ["analytics", "dashboard"],
        queryFn: () => apiClient.get("/api/v1/analytics/dashboard").then((r) => r.data),
        retry: false,
    });

    const daysBack = chartRange === "7D" ? 7 : chartRange === "30D" ? 30 : 90;
    const from = useMemo(() => {
        const d = new Date(); d.setDate(d.getDate() - daysBack); return d.toISOString().split("T")[0];
    }, [daysBack]);
    const to = useMemo(() => new Date().toISOString().split("T")[0], []);

    const { data: salesData } = useQuery({
        queryKey: ["analytics", "sales", from, to, "day"],
        queryFn: () => apiClient.get("/api/v1/analytics/sales", { params: { from, to, groupBy: "day" } }).then((r) => r.data),
        retry: false,
    });

    const d = dashboard?.data ?? dashboard ?? {};
    const todayRevenue = d?.today?.revenue ?? 0;
    const todayOrders = d?.today?.orders ?? 0;
    const monthRevenue = d?.thisMonth?.revenue ?? 0;
    const monthOrders = d?.thisMonth?.orders ?? 0;
    const outData = (d as any)?.collections ?? { totalOutstanding: 0, totalCredit: 0 };
    const outstanding = outData.totalOutstanding;
    const credit = outData.totalCredit;
    const lowStock = (d as any)?.inventory?.lowStockCount ?? 0;

    const topProducts = d?.topProducts ?? [];
    const topCustomers = d?.topCustomers ?? [];
    const recentOrders: { id: string; orderNumber: string; netAmount: number; status: string; createdAt: string; customer: { name: string } | null; source?: string }[] = d?.recentOrders ?? [];

    const chartData = useMemo(() => {
        const raw = salesData?.data ?? salesData?.data?.data ?? [];
        if (Array.isArray(raw) && raw.length > 0) {
            return raw.map((d: { label: string; revenue: number; orders: number }) => ({
                day: d.label.split("-").slice(1).join("/"),
                revenue: d.revenue,
                orders: d.orders,
            }));
        }
        return [];
    }, [salesData]);

    const alerts = useMemo(() => {
        const items: { type: string; message: string; action: string; color: string; href?: string }[] = [];
        if (lowStock > 0) items.push({ type: "stockout", message: `${lowStock} ${t('products_below_reorder')}`, action: t('view'), color: "var(--red)", href: "/inventory" });
        if (outstanding > 0) items.push({ type: "overdue", message: `${formatINR(outstanding)} ${t('total_outstanding_from_customers')}`, action: t('collect'), color: "var(--warning)", href: "/customers" });
        recentOrders.slice(0, 3).forEach((o) => {
            items.push({ type: "order", message: `${o.orderNumber} — ${formatINR(o.netAmount)} from ${o.customer?.name ?? t('unknown')}`, action: t('view'), color: "var(--gold)", href: `/orders/${o.id}` });
        });
        if (items.length === 0) items.push({ type: "info", message: t('no_alerts'), action: "", color: "var(--green-bright)" });
        return items;
    }, [lowStock, outstanding, recentOrders, t]);

    const sparkRevenue = useMemo(() => chartData.length > 0 ? chartData.slice(-7).map((d: { revenue: number }) => d.revenue) : Array(7).fill(0), [chartData]);
    const sparkOrders = useMemo(() => chartData.length > 0 ? chartData.slice(-7).map((d: { orders: number }) => d.orders) : Array(7).fill(0), [chartData]);
    const sparkOutstanding = useMemo(() => Array(7).fill(outstanding), [outstanding]);
    const sparkLowStock = useMemo(() => Array(7).fill(lowStock), [lowStock]);

    const daysElapsed = new Date().getDate();
    const revenueChange = monthRevenue > 0 && todayRevenue > 0 ? Math.round((todayRevenue / (monthRevenue / daysElapsed)) * 100 - 100) : 0;
    const ordersChange = monthOrders > 0 && todayOrders > 0 ? Math.round((todayOrders / (monthOrders / daysElapsed)) * 100 - 100) : 0;

    const portalOrders = recentOrders.filter((o) => o.source === "PORTAL");

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
            {/* AI Briefing Card */}
            <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-accent)] bg-gradient-to-r from-[var(--bg-secondary)] via-[var(--bg-card)] to-[var(--bg-secondary)] p-6">
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/3 via-transparent to-[var(--purple)]/3 animate-pulse" style={{ animationDuration: "4s" }} />
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 suppressHydrationWarning className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
                            {greeting()}, {user?.firstName ?? "there"}. {t('heres_your_day')}
                        </h2>
                        <button onClick={() => refetch()} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1 transition">
                            <RefreshCw size={12} /> {t('refresh')}
                        </button>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                        {[
                            { icon: "📦", text: `${todayOrders} ${t('orders_today_worth')} ${formatINR(todayRevenue)}`, action: t('view_orders'), href: "/orders" },
                            { icon: "💰", text: `${formatINR(outstanding)} ${t('outstanding_collections')}`, action: t('view_plan'), href: "/customers" },
                            { icon: "📊", text: `${formatINR(monthRevenue)} ${t('revenue_this_month')} ${monthOrders} ${t('from_orders')}`, action: t('see_report'), href: "/analytics" },
                        ].map((item, i) => (
                            <Link key={i} href={item.href}>
                                <div className="flex items-start gap-3 bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border)] hover:border-[var(--gold)]/30 transition">
                                    <span className="text-lg">{item.icon}</span>
                                    <div className="flex-1">
                                        <p className="text-sm text-[var(--text-primary)] mb-2">{item.text}</p>
                                        <span className="text-xs text-[var(--gold)] hover:text-[var(--gold-light)] font-medium flex items-center gap-1 transition">
                                            {item.action} <ArrowRight size={12} />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-500 delay-150 fill-mode-both">
                <KPICard title={t('revenue')} value={formatINR(todayRevenue)} change={revenueChange} changeLabel={t('vs_monthly_avg')} icon={IndianRupee} accentColor="var(--green-bright)" sparkData={sparkRevenue} />
                <KPICard
                    title={t('orders')} value={String(todayOrders)} change={ordersChange} changeLabel={t('today')}
                    icon={ShoppingCart} accentColor="var(--gold)" sparkData={sparkOrders}
                    actionNode={<Link href="/orders/new" className="text-xs font-semibold text-[var(--gold)] hover:text-[var(--gold-light)] flex items-center gap-1"><Plus size={14} /> New</Link>}
                />
                <KPICard
                    title={t('outstanding')} value={formatINR(outstanding)} change={0}
                    changeLabel={credit > 0 ? <span className="text-[var(--green)]">+ {formatINR(credit)} credit</span> : t('total_due')}
                    icon={AlertTriangle} accentColor="var(--red)" sparkData={sparkOutstanding}
                    actionNode={<Link href="/customers" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 uppercase tracking-wider"><ArrowRight size={14} /> View</Link>}
                >
                    <div className="flex flex-wrap items-center justify-between text-xs w-full gap-y-2">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[var(--blue-light, #3b82f6)]"></div>
                            <span className="text-[var(--text-secondary)]">Current:</span>
                            <span className="font-mono">{formatINR(outstanding)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[var(--orange)]"></div>
                            <span className="text-[var(--text-secondary)]">Overdue:</span>
                            <span className="font-mono">₹0.00</span>
                        </div>
                    </div>
                </KPICard>
                <Link href="/inventory">
                    <KPICard title={t('low_stock')} value={String(lowStock)} change={0} changeLabel={t('products_below_min')} icon={Package} accentColor="var(--orange)" sparkData={sparkLowStock} />
                </Link>
            </div>

            {/* Sales Chart + Alerts */}
            <div className="grid lg:grid-cols-5 gap-4">
                <SalesChart chartData={chartData} chartRange={chartRange} onRangeChange={setChartRange} isLoading={isLoading} t={t} />
                <AlertsFeed alerts={alerts} t={t} />
            </div>

            {/* Portal Orders */}
            {portalOrders.length > 0 && (
                <div className="bg-gradient-to-br from-[#7C3AED]/5 via-[var(--bg-card)] to-[var(--bg-card)] border border-[#7C3AED]/15 rounded-[var(--radius-md)] p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
                            <h3 className="font-semibold">{t('portal_orders')}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#7C3AED]/15 text-[#A78BFA] font-semibold">{portalOrders.length}</span>
                        </div>
                        <Link href="/orders?source=PORTAL" className="text-xs text-[#A78BFA] hover:underline flex items-center gap-1 transition">{t('view_all')} <ArrowRight size={12} /></Link>
                    </div>
                    <div className="space-y-2">
                        {portalOrders.slice(0, 5).map((o) => (
                            <Link key={o.id} href={`/orders/${o.id}`}>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{o.customer?.name ?? "Unknown"} — <span className="text-[var(--gold)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(o.netAmount)}</span></p>
                                        <p className="text-xs text-[var(--text-muted)]">{o.orderNumber} · {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}</p>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${o.status === "DRAFT" ? "badge-draft" : o.status === "CONFIRMED" ? "badge-confirmed" : "badge-packed"}`}>{o.status}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Products + Customers */}
            <TopLists topProducts={topProducts} topCustomers={topCustomers} t={t} />
        </div>
    );
}
