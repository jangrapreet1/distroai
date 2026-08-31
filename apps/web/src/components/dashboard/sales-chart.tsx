"use client";

import { useState, useMemo } from "react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import { motion } from "motion/react";
import { formatINR } from "./kpi-card";
import { TrendingUp, Activity, MessageSquare, Layers } from "lucide-react";

interface SalesChartProps {
    chartData: { day: string; revenue: number; orders: number }[];
    chartRange: "7D" | "30D" | "90D";
    onRangeChange: (range: "7D" | "30D" | "90D") => void;
    isLoading: boolean;
    t: (key: string) => string;
}

type MetricMode = "revenue_orders" | "channel_sync" | "cash_credit";

export function SalesChart({ chartData, chartRange, onRangeChange, isLoading, t }: SalesChartProps) {
    const [metricMode, setMetricMode] = useState<MetricMode>("revenue_orders");

    const chartTotalRevenue = useMemo(
        () => chartData.reduce((sum, d) => sum + d.revenue, 0),
        [chartData]
    );
    const chartTotalOrders = useMemo(
        () => chartData.reduce((sum, d) => sum + d.orders, 0),
        [chartData]
    );

    // Simulated multi-stream data points for richer Bklit visualization
    const enhancedData = useMemo(() => {
        return chartData.map((d) => {
            const whatsappOrders = Math.max(1, Math.round(d.orders * 0.72));
            const tallySynced = Math.max(1, Math.round(d.orders * 0.94));
            const cashRevenue = Math.round(d.revenue * 0.65);
            const creditRevenue = d.revenue - cashRevenue;

            return {
                ...d,
                whatsappOrders,
                tallySynced,
                cashRevenue,
                creditRevenue,
            };
        });
    }, [chartData]);

    return (
        <div className="lg:col-span-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 flex flex-col relative overflow-hidden">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--gold)] bg-[var(--gold)]/10 px-2 py-0.5 rounded border border-[var(--gold)]/20">
                            [ANALYTICS // BKLIT_ENGINE]
                        </span>
                        <h3 className="font-semibold text-[var(--text-primary)] text-sm">{t("sales_trend")}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs mt-2">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded bg-[#C9A84C]" />
                            <span className="text-[var(--text-muted)]">Net Revenue:</span>
                            <span className="font-mono font-semibold text-[var(--text-primary)]">
                                {formatINR(chartTotalRevenue)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded bg-[#10B981]" />
                            <span className="text-[var(--text-muted)]">Orders:</span>
                            <span className="font-mono font-semibold text-[var(--text-primary)]">
                                {chartTotalOrders}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    {/* Metric View Switcher */}
                    <div className="flex bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--border)]">
                        <button
                            onClick={() => setMetricMode("revenue_orders")}
                            title="Revenue vs Orders"
                            className={`p-1.5 rounded text-xs transition ${
                                metricMode === "revenue_orders"
                                    ? "bg-white/[0.08] text-[var(--gold)]"
                                    : "text-[var(--text-muted)] hover:text-white"
                            }`}
                        >
                            <TrendingUp size={14} />
                        </button>
                        <button
                            onClick={() => setMetricMode("channel_sync")}
                            title="WhatsApp vs Tally Sync"
                            className={`p-1.5 rounded text-xs transition ${
                                metricMode === "channel_sync"
                                    ? "bg-white/[0.08] text-[#10B981]"
                                    : "text-[var(--text-muted)] hover:text-white"
                            }`}
                        >
                            <Activity size={14} />
                        </button>
                        <button
                            onClick={() => setMetricMode("cash_credit")}
                            title="Cash vs Credit Split"
                            className={`p-1.5 rounded text-xs transition ${
                                metricMode === "cash_credit"
                                    ? "bg-white/[0.08] text-[#8B5CF6]"
                                    : "text-[var(--text-muted)] hover:text-white"
                            }`}
                        >
                            <Layers size={14} />
                        </button>
                    </div>

                    {/* Range Pill Toggle with Motion */}
                    <div className="flex bg-[var(--bg-secondary)] p-1 rounded-full border border-[var(--border)] relative">
                        {(["7D", "30D", "90D"] as const).map((r) => {
                            const isSelected = chartRange === r;
                            return (
                                <button
                                    key={r}
                                    onClick={() => onRangeChange(r)}
                                    className={`relative px-3 py-1 text-xs font-medium rounded-full transition-colors z-10 ${
                                        isSelected ? "text-[var(--bg-primary)] font-semibold" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    }`}
                                >
                                    {isSelected && (
                                        <motion.div
                                            layoutId="activeChartRange"
                                            className="absolute inset-0 bg-[var(--gold)] rounded-full -z-10 shadow-sm"
                                            transition={{ type: "spring", stiffness: 380, damping: 28 }}
                                        />
                                    )}
                                    {r}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Chart Canvas */}
            <div className="flex-1 min-h-[260px]">
                {enhancedData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        {metricMode === "channel_sync" ? (
                            <BarChart data={enhancedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: "rgba(10, 10, 15, 0.95)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                        backdropFilter: "blur(12px)",
                                        borderRadius: 10,
                                        fontSize: 12,
                                    }}
                                />
                                <Bar dataKey="whatsappOrders" name="WhatsApp Inbound" fill="#10B981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="tallySynced" name="Tally XML Synced" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        ) : metricMode === "cash_credit" ? (
                            <AreaChart data={enhancedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                                <YAxis
                                    tick={{ fontSize: 11, fill: "#71717A" }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: "rgba(10, 10, 15, 0.95)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                        backdropFilter: "blur(12px)",
                                        borderRadius: 10,
                                        fontSize: 12,
                                    }}
                                    formatter={(v: any, name: any) => [formatINR(Number(v) || 0), name === "cashRevenue" ? "Instant UPI / Cash" : "Credit Inflow"]}
                                />
                                <Area type="monotone" dataKey="cashRevenue" name="cashRevenue" stroke="#10B981" fill="url(#cashGrad)" strokeWidth={2} />
                                <Area type="monotone" dataKey="creditRevenue" name="creditRevenue" stroke="#8B5CF6" fill="url(#creditGrad)" strokeWidth={2} />
                            </AreaChart>
                        ) : (
                            <AreaChart data={enhancedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                                <YAxis
                                    domain={[0, "auto"]}
                                    tick={{ fontSize: 11, fill: "#71717A" }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: "rgba(10, 10, 15, 0.95)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                        backdropFilter: "blur(12px)",
                                        borderRadius: 10,
                                        fontSize: 12,
                                    }}
                                    labelStyle={{ color: "#A1A1AA", marginBottom: 4 }}
                                    formatter={(value: any) => [
                                        <span key="val" className="font-semibold text-[var(--gold)] font-mono">
                                            {formatINR(Number(value) || 0)}
                                        </span>,
                                        "Revenue",
                                    ]}
                                    labelFormatter={(label) => `Date: ${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#C9A84C"
                                    fill="url(#salesGrad)"
                                    strokeWidth={2}
                                    dot={{ fill: "#C9A84C", r: 3 }}
                                    activeDot={{ r: 5, strokeWidth: 0, fill: "#FDE68A" }}
                                />
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
                        {isLoading ? t("loading_sales") : t("no_sales_data")}
                    </div>
                )}
            </div>
        </div>
    );
}
