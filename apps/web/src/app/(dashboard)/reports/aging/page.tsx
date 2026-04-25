"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Clock } from "lucide-react";
import apiClient from "@/lib/api-client";
import { formatINR } from "@/lib/utils";
import { useState } from "react";

const BUCKET_COLORS: Record<string, string> = {
    current: "var(--green-bright)",
    "1-30": "var(--gold)",
    "31-60": "var(--orange)",
    "61-90": "#ef4444",
    "90+": "#dc2626",
};

const BUCKET_LABELS: Record<string, string> = {
    current: "Current",
    "1-30": "1-30 Days",
    "31-60": "31-60 Days",
    "61-90": "61-90 Days",
    "90+": "90+ Days",
};

export default function AgingReportPage() {
    const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['aging-report'],
        queryFn: async () => {
            const res = await apiClient.get('/api/v1/reports/aging');
            return res.data?.data || res.data;
        },
    });

    const summary = data?.summary;
    const customers = data?.customers || [];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Aging Report</h1>
                <p className="text-[var(--text-muted)] text-sm mt-1">Outstanding invoice balances bucketed by days overdue.</p>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" /></div>
            ) : !summary ? (
                <div className="text-center py-20 text-[var(--text-muted)]">No data available.</div>
            ) : (
                <>
                    {/* Bucket Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        {Object.entries(BUCKET_LABELS).map(([key, label]) => (
                            <div key={key} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BUCKET_COLORS[key] }} />
                                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">{label}</span>
                                </div>
                                <p className="text-lg font-bold font-mono" style={{ color: BUCKET_COLORS[key] }}>
                                    {formatINR(summary[key] || 0)}
                                </p>
                            </div>
                        ))}
                        <div className="bg-[var(--bg-card)] border border-[var(--gold)]/30 rounded-[var(--radius-lg)] p-4 ring-1 ring-[var(--gold)]/10">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={12} className="text-[var(--gold)]" />
                                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Total</span>
                            </div>
                            <p className="text-lg font-bold font-mono text-[var(--gold)]">{formatINR(summary.totalOutstanding)}</p>
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">{summary.invoiceCount} invoices</p>
                        </div>
                    </div>

                    {/* Customer Table */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                        <div className="p-5 border-b border-[var(--border)]">
                            <h2 className="font-semibold">Per-Customer Breakdown</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                        <th className="text-left p-4">Customer</th>
                                        {Object.values(BUCKET_LABELS).map(label => (
                                            <th key={label} className="text-right p-4">{label}</th>
                                        ))}
                                        <th className="text-right p-4 font-bold">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customers.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-12 text-[var(--text-muted)]">
                                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                            No outstanding invoices. All caught up!
                                        </td></tr>
                                    ) : customers.map((c: any) => (
                                        <>
                                            <tr key={c.customerId}
                                                onClick={() => setExpandedCustomer(expandedCustomer === c.customerId ? null : c.customerId)}
                                                className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors">
                                                <td className="p-4 font-medium">
                                                    <span className="mr-1 text-[var(--text-muted)]">{expandedCustomer === c.customerId ? '▾' : '▸'}</span>
                                                    {c.customerName}
                                                </td>
                                                {Object.keys(BUCKET_LABELS).map(key => (
                                                    <td key={key} className="p-4 text-right font-mono">
                                                        {c[key] > 0 ? (
                                                            <span style={{ color: BUCKET_COLORS[key] }}>{formatINR(c[key])}</span>
                                                        ) : <span className="text-[var(--text-muted)]">—</span>}
                                                    </td>
                                                ))}
                                                <td className="p-4 text-right font-mono font-bold text-[var(--gold)]">{formatINR(c.total)}</td>
                                            </tr>
                                            {expandedCustomer === c.customerId && c.invoices?.map((inv: any) => (
                                                <tr key={inv.id} className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border)]/50">
                                                    <td className="pl-10 pr-4 py-2 text-xs text-[var(--text-muted)]">
                                                        {inv.invoiceNumber}
                                                        <span className="ml-2 text-[10px]">
                                                            Due: {new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                            {inv.daysOverdue > 0 && <span className="text-red-400 ml-1">({inv.daysOverdue}d overdue)</span>}
                                                        </span>
                                                    </td>
                                                    <td colSpan={5} />
                                                    <td className="p-2 text-right font-mono text-xs">{formatINR(inv.balanceAmount)}</td>
                                                </tr>
                                            ))}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
