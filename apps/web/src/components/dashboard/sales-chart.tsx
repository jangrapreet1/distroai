"use client";

import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "./kpi-card";

interface SalesChartProps {
    chartData: { day: string; revenue: number; orders: number }[];
    chartRange: "7D" | "30D" | "90D";
    onRangeChange: (range: "7D" | "30D" | "90D") => void;
    isLoading: boolean;
    t: (key: string) => string;
}

export function SalesChart({ chartData, chartRange, onRangeChange, isLoading, t }: SalesChartProps) {
    const chartTotalRevenue = useMemo(() => chartData.reduce((sum, d) => sum + d.revenue, 0), [chartData]);

    return (
        <div className="lg:col-span-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 flex flex-col">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="font-semibold text-[var(--text-secondary)] mb-2">{t('sales_trend')}</h3>
                    <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-[var(--gold)]"></div>
                            <span className="text-[var(--text-muted)]">Revenue</span>
                        </div>
                        <span className="font-mono font-medium text-[var(--text-primary)]">{formatINR(chartTotalRevenue)} (+)</span>
                    </div>
                </div>
                <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-full border border-[var(--border)] shadow-inner">
                    {(["7D", "30D", "90D"] as const).map((r) => (
                        <button key={r} onClick={() => onRangeChange(r)} className={`px-4 py-1.5 text-xs rounded-full transition ${chartRange === r ? "bg-[var(--gold)] text-[#1a1625] font-semibold shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                            {r}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 min-h-[220px]">
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
    );
}
