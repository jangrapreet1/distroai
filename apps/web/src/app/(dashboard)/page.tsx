"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, ShoppingCart, IndianRupee, AlertTriangle, Package, RefreshCw, ArrowRight, Clock } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { greeting } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

function formatINR(n: number): string {
    return "₹" + n.toLocaleString("en-IN");
}

function KPICard({ title, value, change, changeLabel, icon: Icon, accentColor, sparkData }: {
    title: string; value: string; change: number; changeLabel: string;
    icon: React.ElementType; accentColor: string; sparkData: number[];
}) {
    const isUp = change >= 0;
    const chartPoints = useMemo(() => {
        const today = new Date();
        return sparkData.map((v, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() - (sparkData.length - 1 - i));
            return { date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), v };
        });
    }, [sparkData]);

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5 hover:border-opacity-30 transition group" style={{ "--accent": accentColor } as React.CSSProperties}>
            <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 duration-300" style={{ background: `${accentColor}15` }}>
                    <Icon size={18} style={{ color: accentColor }} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? "text-[var(--green-bright)]" : "text-[var(--red)]"}`}>
                    {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(change)}%
                </div>
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-1">{title}</h3>
            <p className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-mono)" }}>{value}</p>
            <p className="text-xs text-[var(--text-muted)]">{changeLabel}</p>
            <div className="h-8 mt-3 opacity-50 group-hover:opacity-80 transition">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartPoints}>
                        <defs>
                            <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={accentColor} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip
                            cursor={false}
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const p = payload[0].payload;
                                return (
                                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 11 }}>
                                        <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{p.date}</div>
                                        <div style={{ color: accentColor, fontWeight: 700 }}>{typeof p.v === "number" && title === "Revenue" ? formatINR(p.v) : typeof p.v === "number" && title === "Outstanding" ? formatINR(p.v) : p.v}</div>
                                    </div>
                                );
                            }}
                        />
                        <Area dataKey="v" stroke={accentColor} fill={`url(#spark-${title})`} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: accentColor, stroke: "var(--bg-card)", strokeWidth: 2 }} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function ScoreRing({ score, size = 32 }: { score: number; size?: number }) {
    const color = score >= 80 ? "var(--green-bright)" : score >= 60 ? "var(--gold)" : score >= 40 ? "var(--orange)" : "var(--red)";
    const r = size / 2 - 3;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
    );
}

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

    const topProducts: { productId: string; _sum: { totalAmount: number } }[] = d?.topProducts ?? [];
    const topCustomers: { id: string; name: string; outstandingAmount: number; paymentScore: number }[] = d?.topCustomers ?? [];
    const recentOrders: { id: string; orderNumber: string; netAmount: number; status: string; createdAt: string; customer: { name: string } | null }[] = d?.recentOrders ?? [];

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

    // Build alerts from real data
    const alerts = useMemo(() => {
        const items: { type: string; message: string; action: string; color: string; href?: string }[] = [];
        if (lowStock > 0) items.push({ type: "stockout", message: `${lowStock} ${t('products_below_reorder')}`, action: t('view'), color: "var(--red)", href: "/inventory" });
        if (outstanding > 0) items.push({ type: "overdue", message: `${formatINR(outstanding)} ${t('total_outstanding_from_customers')}`, action: t('collect'), color: "var(--warning)", href: "/customers" });
        recentOrders.slice(0, 3).forEach((o) => {
            items.push({ type: "order", message: `${o.orderNumber} — ${formatINR(o.netAmount)} from ${o.customer?.name ?? t('unknown')}`, action: t('view'), color: "var(--gold)", href: `/orders/${o.id}` });
        });
        if (items.length === 0) items.push({ type: "info", message: t('no_alerts'), action: "", color: "var(--green-bright)" });
        return items;
    }, [lowStock, outstanding, recentOrders]);

    // Use real sales data for sparklines (last 7 days from chartData)
    const sparkRevenue = useMemo(() => {
        if (chartData.length > 0) return chartData.slice(-7).map((d: { revenue: number }) => d.revenue);
        return Array(7).fill(0);
    }, [chartData]);
    const sparkOrders = useMemo(() => {
        if (chartData.length > 0) return chartData.slice(-7).map((d: { orders: number }) => d.orders);
        return Array(7).fill(0);
    }, [chartData]);
    const sparkOutstanding = useMemo(() => Array(7).fill(outstanding), [outstanding]);
    const sparkLowStock = useMemo(() => Array(7).fill(lowStock), [lowStock]);

    const daysElapsed = new Date().getDate(); // days elapsed this month
    const revenueChange = monthRevenue > 0 && todayRevenue > 0 ? Math.round((todayRevenue / (monthRevenue / daysElapsed)) * 100 - 100) : 0;
    const ordersChange = monthOrders > 0 && todayOrders > 0 ? Math.round((todayOrders / (monthOrders / daysElapsed)) * 100 - 100) : 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
            {/* AI Briefing Card */}
            <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-accent)] bg-gradient-to-r from-[var(--bg-secondary)] via-[var(--bg-card)] to-[var(--bg-secondary)] p-6">
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
                <KPICard title={t('orders')} value={String(todayOrders)} change={ordersChange} changeLabel={t('today')} icon={ShoppingCart} accentColor="var(--gold)" sparkData={sparkOrders} />
                <KPICard title={t('outstanding')} value={formatINR(outstanding)} change={0} changeLabel={credit > 0 ? `+ ${formatINR(credit)} credit` : t('total_due')} icon={AlertTriangle} accentColor="var(--red)" sparkData={sparkOutstanding} />
                <Link href="/inventory">
                    <KPICard title={t('low_stock')} value={String(lowStock)} change={0} changeLabel={t('products_below_min')} icon={Package} accentColor="var(--orange)" sparkData={sparkLowStock} />
                </Link>
            </div>

            {/* Sales Chart + Alerts */}
            <div className="grid lg:grid-cols-5 gap-4">
                {/* Sales Chart */}
                <div className="lg:col-span-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">{t('sales_trend')}</h3>
                        <div className="flex gap-1">
                            {(["7D", "30D", "90D"] as const).map((r) => (
                                <button key={r} onClick={() => setChartRange(r)} className={`px-3 py-1 text-xs rounded-full transition ${chartRange === r ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-56">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.2} />
                                            <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#5A5040" }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 'auto']} tick={{ fontSize: 11, fill: "#5A5040" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        contentStyle={{ background: "#1a1625", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, fontSize: 12, color: "#F0E8D5" }}
                                        labelStyle={{ color: "var(--text-muted)", marginBottom: 4 }}
                                        formatter={(value: number | undefined) => [<span className="font-semibold text-[var(--gold)]">{formatINR(value ?? 0)}</span>, "Revenue"]}
                                        labelFormatter={(label) => `Date: ${label}`}
                                    />
                                    <Area dataKey="revenue" stroke="var(--gold)" fill="url(#salesGrad)" strokeWidth={2} dot={{ fill: "var(--gold)", r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
                                {isLoading ? t('loading_sales') : t('no_sales_data')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Alerts Feed */}
                <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">{t('alerts')}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--red)]/15 text-[var(--red)]">{alerts.length}</span>
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {alerts.map((alert, i) => (
                            <Link key={i} href={alert.href ?? "#"}>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: alert.color }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-[var(--text-primary)] mb-1">{alert.message}</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1"><Clock size={10} />{t('now')}</span>
                                            {alert.action && <span className="text-xs font-medium hover:underline transition" style={{ color: alert.color }}>{alert.action}</span>}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Portal Orders — incoming from B2B storefront ── */}
            {(() => {
                const portalOrders: { id: string; orderNumber: string; netAmount: number; status: string; createdAt: string; customer: { name: string } | null }[] =
                    recentOrders.filter((o: any) => o.source === "PORTAL");

                if (portalOrders.length === 0 && recentOrders.length > 0) return null; // only show when there are portal orders

                return (
                    <div className="bg-gradient-to-br from-[#7C3AED]/5 via-[var(--bg-card)] to-[var(--bg-card)] border border-[#7C3AED]/15 rounded-[var(--radius-md)] p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
                                <h3 className="font-semibold">{t('portal_orders')}</h3>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#7C3AED]/15 text-[#A78BFA] font-semibold">{portalOrders.length}</span>
                            </div>
                            <Link href="/orders?source=PORTAL" className="text-xs text-[#A78BFA] hover:underline flex items-center gap-1 transition">{t('view_all')} <ArrowRight size={12} /></Link>
                        </div>
                        {portalOrders.length > 0 ? (
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
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-sm text-[var(--text-muted)] mb-2">{t('no_portal_orders')}</p>
                                <p className="text-xs text-[var(--text-muted)]">{t('share_portal_link')}</p>
                            </div>
                        )}
                    </div>
                );
            })()}
            <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <h3 className="font-semibold mb-4">{t('top_products')}</h3>
                    <div className="space-y-3">
                        {topProducts.length > 0 ? topProducts.map((p, i) => {
                            const maxRev = topProducts[0]._sum?.totalAmount ?? 1;
                            const rev = p._sum?.totalAmount ?? 0;
                            return (
                                <div key={p.productId} className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-[var(--text-muted)] w-5">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{(p as any).productName ?? p.productId}</p>
                                        <div className="h-1.5 rounded-full bg-[var(--border)] mt-1">
                                            <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${(rev / maxRev) * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(rev)}</p>
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="text-sm text-[var(--text-muted)]">{t('no_product_data')}</p>
                        )}
                    </div>
                </div>

                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <h3 className="font-semibold mb-4">{t('top_customers')}</h3>
                    <div className="space-y-3">
                        {topCustomers.length > 0 ? topCustomers.map((c, i) => (
                            <Link key={c.id} href={`/customers/${c.id}`}>
                                <div className="flex items-center gap-3 hover:bg-[var(--bg-card-hover)] rounded-lg p-1 -m-1 transition">
                                    <span className="text-sm font-bold text-[var(--text-muted)] w-5">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{c.name}</p>
                                        <p className="text-xs text-[var(--text-muted)]">{t('outstanding')}: {formatINR(c.outstandingAmount ?? 0)}</p>
                                    </div>
                                    <div className="relative shrink-0">
                                        <ScoreRing score={c.paymentScore ?? 50} />
                                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ fontFamily: "var(--font-mono)" }}>{c.paymentScore ?? 50}</span>
                                    </div>
                                </div>
                            </Link>
                        )) : (
                            <p className="text-sm text-[var(--text-muted)]">{t('no_customer_data')}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
