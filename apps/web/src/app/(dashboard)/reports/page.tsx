"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt as ReceiptIcon, ArrowDownRight, ArrowUpRight } from "lucide-react";
import apiClient from "@/lib/api-client";
import { formatINR } from "@/lib/utils";

export default function PnLReportPage() {
    const now = new Date();
    const [startDate, setStartDate] = useState(
        new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

    const { data, isLoading } = useQuery({
        queryKey: ['pnl-report', startDate, endDate],
        queryFn: async () => {
            const res = await apiClient.get(`/api/v1/reports/pnl?startDate=${startDate}&endDate=${endDate}`);
            return res.data?.data || res.data;
        },
        enabled: !!startDate && !!endDate,
    });

    const expenseCategories = useMemo(() => {
        if (!data?.expenses?.byCategory) return [];
        return Object.entries(data.expenses.byCategory)
            .map(([cat, amount]) => ({ category: cat, amount: amount as number }))
            .sort((a, b) => b.amount - a.amount);
    }, [data]);

    const maxExpense = expenseCategories.length > 0 ? expenseCategories[0].amount : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Profit & Loss</h1>
                    <p className="text-[var(--text-muted)] text-sm mt-1">Revenue, costs, and net profit for the selected period.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="input-field text-sm" />
                    <span className="text-[var(--text-muted)]">to</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="input-field text-sm" />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" /></div>
            ) : !data ? (
                <div className="text-center py-20 text-[var(--text-muted)]">Select a date range to view the report.</div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard label="Revenue" value={data.revenue} icon={<TrendingUp size={18} />} color="var(--green-bright)" />
                        <SummaryCard label="COGS" value={data.cogs} icon={<ShoppingCart size={18} />} color="var(--orange)" subtitle="Cost of goods sold" />
                        <SummaryCard label="Gross Profit" value={data.grossProfit} icon={<DollarSign size={18} />}
                            color={data.grossProfit >= 0 ? "var(--green-bright)" : "var(--red)"}
                            subtitle={`${data.grossMargin.toFixed(1)}% margin`} />
                        <SummaryCard label="Net Profit" value={data.netProfit} icon={data.netProfit >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                            color={data.netProfit >= 0 ? "var(--green-bright)" : "var(--red)"}
                            subtitle={`${data.netMargin.toFixed(1)}% margin`} highlight />
                    </div>

                    {/* Waterfall breakdown */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                        <div className="p-5 border-b border-[var(--border)]">
                            <h2 className="font-semibold">P&L Breakdown</h2>
                        </div>
                        <div className="divide-y divide-[var(--border)]">
                            <Row label="Revenue (Invoices)" value={data.revenue} positive />
                            <Row label="Less: Cost of Goods Sold" value={-data.cogs} />
                            <Row label="Gross Profit" value={data.grossProfit} bold positive={data.grossProfit >= 0} />
                            <Row label="Less: Operating Expenses" value={-data.expenses.total} />
                            <Row label="Net Profit / (Loss)" value={data.netProfit} bold positive={data.netProfit >= 0} highlight />
                        </div>
                    </div>

                    {/* Expense Breakdown */}
                    {expenseCategories.length > 0 && (
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                            <div className="p-5 border-b border-[var(--border)]">
                                <h2 className="font-semibold">Expense Breakdown by Category</h2>
                            </div>
                            <div className="p-5 space-y-3">
                                {expenseCategories.map(({ category, amount }) => (
                                    <div key={category} className="flex items-center gap-3">
                                        <span className="text-sm w-28 text-[var(--text-secondary)] shrink-0">{category}</span>
                                        <div className="flex-1 h-6 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-light)] rounded-full transition-all duration-500"
                                                style={{ width: `${maxExpense > 0 ? (amount / maxExpense) * 100 : 0}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-mono font-medium w-24 text-right">{formatINR(amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function SummaryCard({ label, value, icon, color, subtitle, highlight }: {
    label: string; value: number; icon: React.ReactNode; color: string; subtitle?: string; highlight?: boolean;
}) {
    return (
        <div className={`bg-[var(--bg-card)] border rounded-[var(--radius-lg)] p-5 ${highlight ? 'border-[var(--gold)]/40 ring-1 ring-[var(--gold)]/20' : 'border-[var(--border)]'}`}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">{label}</span>
                <div style={{ color }} className="opacity-70">{icon}</div>
            </div>
            <p className="text-2xl font-bold font-mono" style={{ color }}>{formatINR(value)}</p>
            {subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>}
        </div>
    );
}

function Row({ label, value, bold, positive, highlight }: {
    label: string; value: number; bold?: boolean; positive?: boolean; highlight?: boolean;
}) {
    return (
        <div className={`flex items-center justify-between px-5 py-3 ${highlight ? 'bg-[var(--bg-secondary)]' : ''}`}>
            <span className={`text-sm ${bold ? 'font-semibold' : 'text-[var(--text-secondary)]'}`}>{label}</span>
            <span className={`font-mono text-sm ${bold ? 'font-bold text-base' : ''} ${value >= 0 && positive !== false ? 'text-[var(--green-bright)]' : value < 0 ? 'text-red-400' : ''}`}>
                {value < 0 ? `(${formatINR(Math.abs(value))})` : formatINR(value)}
            </span>
        </div>
    );
}
