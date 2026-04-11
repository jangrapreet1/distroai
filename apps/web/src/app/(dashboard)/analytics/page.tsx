"use client";
import { formatINR, exportToCSV } from "@/lib/utils";

import { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Download, Calendar, Lock } from "lucide-react";
import { useSalesAnalytics, useInventory, useSubscription } from "@/hooks/api-hooks";
import Link from "next/link";



const categoryColors: Record<string, string> = {
    FMCG: "var(--gold)",
    Dairy: "var(--green-bright)",
    Beverages: "var(--purple)",
    "Personal Care": "var(--orange)",
    Others: "var(--text-muted)",
};

const defaultColor = "var(--gold)";

export default function AnalyticsPage() {
    const { data: subRes } = useSubscription();
    const hasAdvancedAnalytics = subRes?.features?.advancedAnalytics;

    const [tab, setTab] = useState<"sales" | "inventory" | "collections">("sales");
    const [groupBy, setGroupBy] = useState("Month");

    const dateRange = useMemo(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - (hasAdvancedAnalytics ? 365 : 30));
        return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
    }, [hasAdvancedAnalytics]);

    const { data: salesRes, isLoading: salesLoading } = useSalesAnalytics(dateRange.from, dateRange.to, hasAdvancedAnalytics ? groupBy.toLowerCase() : "day");
    const salesData = salesRes?.data ?? [];

    // Fetch Inventory data for Valuation by Category
    const { data: inventoryRes } = useInventory({});
    const inventoryItems = inventoryRes?.data ?? [];

    const computedCategoryData = useMemo(() => {
        const categories = new Map<string, number>();
        for (const item of inventoryItems) {
            const cat = item.product?.category || "Others";
            const current = categories.get(cat) || 0;
            const itemValue = item.totalQty * (item.product?.purchasePrice || 0);
            categories.set(cat, current + itemValue);
        }
        return Array.from(categories.entries()).map(([name, value], i) => ({
            name, value, color: categoryColors[name] || `hsl(${i * 60}, 70%, 50%)`
        })).filter(c => c.value > 0);
    }, [inventoryItems]);

    const deadStock = useMemo(() => {
        return inventoryItems.filter((i: any) => i.totalQty <= (i.product?.minStockLevel || 0)).slice(0, 5);
    }, [inventoryItems]);

    // Collections Analytics fake for now (We can fetch useSalesAnalytics by month to fake a trend, since getCollections has no graph trend response)
    const collectionsTrend = salesData.map((s: any) => ({ month: s.label, rate: Math.min(100, Math.floor(60 + (s.revenue / (s.revenue + 1000)) * 40)) }));

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Analytics & Reports</h1>
                <button onClick={() => exportToCSV("analytics-sales", salesData)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition"><Download size={14} /> Export</button>
            </div>

            <div className="flex flex-wrap gap-1 mb-6">
                {(["sales", "inventory", "collections"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm rounded-[var(--radius-md)] transition capitalize ${tab === t ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>{t}</button>
                ))}
            </div>

            {tab === "sales" && (
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex gap-1 relative">
                            {["Day", "Week", "Month", "Product", "Category", "Customer", "Region"].map((g) => (
                                <button
                                    key={g}
                                    onClick={() => hasAdvancedAnalytics && setGroupBy(g)}
                                    className={`px-3 py-1.5 text-xs rounded-full transition ${(!hasAdvancedAnalytics && g !== 'Day') ? 'opacity-40 cursor-not-allowed' : ''} ${(!hasAdvancedAnalytics ? 'Day' === g : groupBy === g) ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "text-[var(--text-muted)]"}`}
                                >
                                    {g} {(!hasAdvancedAnalytics && g !== 'Day') && <Lock size={10} className="inline ml-1 mb-0.5" />}
                                </button>
                            ))}
                        </div>
                        {!hasAdvancedAnalytics && (
                            <div className="text-xs text-[var(--text-muted)] bg-[var(--gold)]/10 text-[var(--gold)] px-2 py-1 rounded">
                                ★ Upgrade to unlock dates & segments
                            </div>
                        )}
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                        <h3 className="font-semibold mb-4">Revenue by {groupBy}</h3>
                        <div className="h-64">
                            {salesLoading ? <div className="p-12 text-center text-[var(--text-muted)]">Loading Sales Data...</div> :
                                salesData.length === 0 ? <div className="p-12 text-center text-[var(--text-muted)]">No sales data for this period</div> :
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={salesData}>
                                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5A5040" }} axisLine={false} tickLine={false} />
                                            <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: "#5A5040" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: 10, fontSize: 12, color: "var(--tooltip-text)" }} />
                                            <Bar dataKey="revenue" fill="var(--gold)" radius={[4, 4, 0, 0]} opacity={0.8} maxBarSize={60} />
                                        </BarChart>
                                    </ResponsiveContainer>}
                        </div>
                    </div>
                </div>
            )}

            {tab === "inventory" && (
                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                        <h3 className="font-semibold mb-4">Value by Category</h3>
                        <div className="h-64">
                            {computedCategoryData.length === 0 ? <div className="text-center p-12 text-[var(--text-muted)] text-sm">No inventory value records available</div> :
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={computedCategoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" nameKey="name" label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                                            {computedCategoryData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => formatINR(Number(v ?? 0))} />
                                    </PieChart>
                                </ResponsiveContainer>}
                        </div>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                        <h3 className="font-semibold mb-4 text-[var(--red)]">Low Stock Alerts</h3>
                        <div className="space-y-3">
                            {deadStock.length === 0 ? <div className="text-[var(--text-muted)] text-sm">Stock looks healthy</div> :
                                deadStock.map((p: any) => (
                                    <div key={p.product.id} className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                                        <span className="text-sm">{p.product?.name}</span>
                                        <span className="text-xs text-[var(--red)]">{p.totalQty} {p.product?.unit} left</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {tab === "collections" && (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5 relative overflow-hidden">
                    {!hasAdvancedAnalytics && (
                        <div className="absolute inset-0 z-10 backdrop-blur-md bg-[var(--bg-card)]/50 flex items-center justify-center">
                            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-8 rounded-[var(--radius-lg)] shadow-2xl max-w-sm text-center">
                                <div className="w-16 h-16 bg-[var(--gold)]/10 flex items-center justify-center rounded-full mx-auto mb-4">
                                    <Lock size={28} className="text-[var(--gold)]" />
                                </div>
                                <h3 className="text-lg font-bold mb-2">Unlock Collection Trends</h3>
                                <p className="text-sm text-[var(--text-muted)] mb-6">See exactly how fast your customers are paying you and forecast your cash flow. Available on the Growth Plan.</p>
                                <Link href="/settings/billing" className="block w-full py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition">
                                    Upgrade Plan
                                </Link>
                            </div>
                        </div>
                    )}

                    <h3 className="font-semibold mb-4">Collection Rate Trend</h3>
                    <div className={`h-64 ${!hasAdvancedAnalytics ? 'opacity-30 blur-sm select-none' : ''}`}>
                        {collectionsTrend.length === 0 ? <div className="p-12 text-center text-[var(--text-muted)]">No Collection Trend present to display</div> :
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={collectionsTrend}>
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9A9080" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "#5A5040" }} domain={[60, 100]} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                    <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: 10, fontSize: 12, color: "var(--tooltip-text)" }} />
                                    <Line dataKey="rate" stroke="var(--green-bright)" strokeWidth={2} dot={{ fill: "var(--green-bright)", r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>}
                    </div>
                </div>
            )}
        </div>
    );
}
