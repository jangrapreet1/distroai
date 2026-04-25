"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, ShoppingCart, IndianRupee, Target } from "lucide-react";

interface MetricsRow {
    date: string;
    spend: number;
    revenueGenerated: number;
    ordersGenerated: number;
    impressions: number;
    clicks: number;
}

interface Campaign {
    id: string;
    metrics?: MetricsRow[];
}

interface Props {
    campaigns: Campaign[];
}

const fmtINR = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n);

export function ROIDashboard({ campaigns }: Props) {
    const { chartData, totalSpend, totalRevenue, totalOrders, roi } = useMemo(() => {
        const byDate = new Map<string, { date: string; spend: number; revenue: number }>();

        for (const c of campaigns) {
            for (const m of c.metrics ?? []) {
                const d = m.date?.split("T")[0] || m.date;
                const ex = byDate.get(d) || { date: d, spend: 0, revenue: 0 };
                ex.spend += Number(m.spend);
                ex.revenue += Number(m.revenueGenerated);
                byDate.set(d, ex);
            }
        }

        const today = new Date();
        const days: { date: string; spend: number; revenue: number }[] = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            days.push(byDate.get(key) || { date: key, spend: 0, revenue: 0 });
        }

        let tSpend = 0, tRev = 0, tOrders = 0;
        for (const c of campaigns) {
            for (const m of c.metrics ?? []) {
                tSpend += Number(m.spend);
                tRev += Number(m.revenueGenerated);
                tOrders += Number(m.ordersGenerated);
            }
        }

        return {
            chartData: days,
            totalSpend: tSpend,
            totalRevenue: tRev,
            totalOrders: tOrders,
            roi: tSpend > 0 ? ((tRev - tSpend) / tSpend) * 100 : 0,
        };
    }, [campaigns]);

    const statCards = [
        { label: "Total Ad Spend", value: fmtINR(totalSpend), icon: IndianRupee, color: "#ef4444" },
        { label: "Orders from Ads", value: totalOrders.toString(), icon: ShoppingCart, color: "#3b82f6" },
        { label: "Revenue from Ads", value: fmtINR(totalRevenue), icon: TrendingUp, color: "#22c55e" },
        { label: "Average ROI", value: `${roi.toFixed(1)}%`, icon: Target, color: roi >= 0 ? "#22c55e" : "#ef4444" },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Hindi-friendly summary */}
            {totalSpend > 0 && (
                <div style={{
                    padding: "1rem 1.25rem", borderRadius: 12,
                    background: "linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))",
                    border: "1px solid var(--border)",
                    fontSize: ".9rem", color: "var(--text-secondary)", lineHeight: 1.6,
                }}>
                    {"📊 Aapne "}
                    <strong style={{ color: "var(--text-primary)" }}>{fmtINR(totalSpend)}</strong>
                    {" kharch kiya, "}
                    <strong style={{ color: "#22c55e" }}>{fmtINR(totalRevenue)}</strong>
                    {" ka order aaya."}
                    {roi > 0 && (
                        <>
                            {" 🎯 Return: "}
                            <strong style={{ color: "#22c55e" }}>{roi.toFixed(0)}%</strong>
                        </>
                    )}
                </div>
            )}

            {/* Stat cards */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
            }}>
                {statCards.map((s) => (
                    <div key={s.label} style={{
                        padding: "1.1rem", borderRadius: 14,
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem" }}>
                            <span style={{ fontSize: ".75rem", color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: ".03em" }}>
                                {s.label}
                            </span>
                            <s.icon size={16} color={s.color} />
                        </div>
                        <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {s.value}
                        </span>
                    </div>
                ))}
            </div>

            {/* Chart: Spend vs Revenue */}
            <div style={{
                padding: "1.25rem", borderRadius: 14,
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
            }}>
                <h4 style={{ fontSize: ".9rem", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 1rem" }}>
                    Spend vs Revenue — Last 14 Days
                </h4>
                <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(d: string) => {
                                    const dt = new Date(d);
                                    return `${dt.getDate()}/${dt.getMonth() + 1}`;
                                }}
                                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                                axisLine={{ stroke: "var(--border)" }}
                            />
                            <YAxis
                                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                                axisLine={{ stroke: "var(--border)" }}
                                tickFormatter={(v: number) => `\u20B9${v}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "var(--bg-primary)", border: "1px solid var(--border)",
                                    borderRadius: 10, fontSize: ".8rem",
                                }}
                                formatter={(value: any, name: any) => [
                                    fmtINR(Number(value)),
                                    name === "spend" ? "Ad Spend" : "Revenue",
                                ]}
                                labelFormatter={(d: any) => {
                                    const dt = new Date(String(d));
                                    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                                }}
                            />
                            <Bar dataKey="spend" fill="#ef4444" radius={[4, 4, 0, 0]} name="spend" />
                            <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} name="revenue" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
