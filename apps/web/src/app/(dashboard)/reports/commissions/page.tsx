"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronDown, ChevronUp, Lock } from "lucide-react";
import apiClient from "@/lib/api-client";
import { formatINR } from "@/lib/utils";

export default function CommissionsPage() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [expandedSalesman, setExpandedSalesman] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['commissions-report', month, year],
        queryFn: async () => {
            const res = await apiClient.get(`/api/v1/reports/commissions?month=${month}&year=${year}`);
            return res.data?.data || res.data;
        },
    });

    // If user is not OWNER/ADMIN, the API will 403
    if (error) {
        return (
            <div className="text-center py-20">
                <Lock className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
                <h2 className="text-lg font-medium mb-1">Access Restricted</h2>
                <p className="text-sm text-[var(--text-muted)]">Commission data is only available to Owners and Admins.</p>
            </div>
        );
    }

    const salesmen = data?.salesmen || [];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Salesman Commissions</h1>
                    <p className="text-[var(--text-muted)] text-sm mt-1">
                        Per-product commission calculation for delivered orders. <span className="text-[var(--gold)]">Owner/Admin only.</span>
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <select value={month} onChange={e => setMonth(+e.target.value)}
                        className="input-field text-sm">
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                    <select value={year} onChange={e => setYear(+e.target.value)}
                        className="input-field text-sm">
                        {Array.from({ length: 5 }, (_, i) => {
                            const y = now.getFullYear() - 2 + i;
                            return <option key={y} value={y}>{y}</option>;
                        })}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" /></div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Total Sales</span>
                            <p className="text-2xl font-bold font-mono text-[var(--green-bright)] mt-2">{formatINR(data?.totalSales || 0)}</p>
                        </div>
                        <div className="bg-[var(--bg-card)] border border-[var(--gold)]/30 rounded-[var(--radius-lg)] p-5 ring-1 ring-[var(--gold)]/10">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Total Commissions Payable</span>
                            <p className="text-2xl font-bold font-mono text-[var(--gold)] mt-2">{formatINR(data?.totalCommissions || 0)}</p>
                        </div>
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Active Salesmen</span>
                            <p className="text-2xl font-bold font-mono mt-2">{salesmen.length}</p>
                        </div>
                    </div>

                    {/* Salesman Table */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                        <th className="text-left p-4">Salesman</th>
                                        <th className="text-left p-4">Territory</th>
                                        <th className="text-right p-4">Orders</th>
                                        <th className="text-right p-4">Sales</th>
                                        <th className="text-right p-4">Target</th>
                                        <th className="text-center p-4">Achievement</th>
                                        <th className="text-right p-4">Commission</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesmen.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-12 text-[var(--text-muted)]">
                                            No commission data for this period. Ensure products have commission rates set.
                                        </td></tr>
                                    ) : salesmen.map((s: any) => (
                                        <>
                                            <tr key={s.salesmanId}
                                                onClick={() => setExpandedSalesman(expandedSalesman === s.salesmanId ? null : s.salesmanId)}
                                                className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors">
                                                <td className="p-4 font-medium flex items-center gap-2">
                                                    {expandedSalesman === s.salesmanId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    {s.name}
                                                </td>
                                                <td className="p-4 text-[var(--text-secondary)]">{s.territory || '—'}</td>
                                                <td className="p-4 text-right font-mono">{s.orderCount}</td>
                                                <td className="p-4 text-right font-mono">{formatINR(s.totalSales)}</td>
                                                <td className="p-4 text-right font-mono text-[var(--text-muted)]">{formatINR(s.targetMonthly)}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider border
                                                        ${s.achievement >= 100
                                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                            : s.achievement >= 75
                                                                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                        }`}>
                                                        {s.achievement.toFixed(0)}%
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-[var(--gold)]">{formatINR(s.totalCommission)}</td>
                                            </tr>
                                            {expandedSalesman === s.salesmanId && s.productBreakdown?.length > 0 && (
                                                <tr key={`${s.salesmanId}-breakdown`}>
                                                    <td colSpan={7} className="bg-[var(--bg-secondary)]/50 p-0">
                                                        <div className="px-8 py-3">
                                                            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Product Commission Breakdown</p>
                                                            <div className="space-y-1">
                                                                {s.productBreakdown.map((p: any, idx: number) => (
                                                                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border)]/30 last:border-0">
                                                                        <span className="text-[var(--text-secondary)]">{p.productName}</span>
                                                                        <div className="flex gap-6">
                                                                            <span className="text-[var(--text-muted)]">{p.quantity} units</span>
                                                                            <span className="text-[var(--text-muted)]">Sales: {formatINR(p.lineTotal)}</span>
                                                                            <span className="font-mono font-medium text-[var(--gold)]">{formatINR(p.commission)}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
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
