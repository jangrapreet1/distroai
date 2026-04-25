"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, X, FileText, ArrowRight } from "lucide-react";
import { formatDate, formatINR } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";

const STATUS_TABS = ["All", "ISSUED", "APPLIED", "VOID"] as const;
const statusClass: Record<string, string> = {
    ISSUED: "badge-sent",
    APPLIED: "badge-delivered",
    VOID: "badge-cancelled",
};

export default function ReturnsPage() {
    const [status, setStatus] = useState<typeof STATUS_TABS[number]>("All");
    const [search, setSearch] = useState("");

    const { data, isLoading } = useQuery({
        queryKey: ["credit-notes", status, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (status !== "All") params.set("status", status);
            if (search) params.set("search", search);
            const res = await api.get(`/api/v1/credit-notes?${params.toString()}`);
            return res.data;
        },
    });

    const creditNotes: Record<string, any>[] = data?.data ?? [];

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
                    Returns & Credit Notes
                </h1>
            </div>

            {/* Status Tabs */}
            <div className="flex flex-wrap gap-1 mb-4">
                {STATUS_TABS.map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`px-4 py-2 text-sm whitespace-nowrap transition-colors ${status === s
                            ? "border-b-2 border-[var(--gold)] text-[var(--gold)] font-medium"
                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] border-b-2 border-transparent"
                            }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by credit note # or customer..."
                        className="w-full pl-9 pr-9 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                <th className="text-left p-4">Credit Note #</th>
                                <th className="text-left p-4">Customer</th>
                                <th className="text-left p-4">Date</th>
                                <th className="text-left p-4">Reason</th>
                                <th className="text-right p-4">Amount</th>
                                <th className="text-center p-4">Status</th>
                                <th className="text-right p-4">Original Order</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i} className="border-b border-[var(--border)]">
                                        <td colSpan={7} className="p-4"><div className="skeleton h-5 rounded" /></td>
                                    </tr>
                                ))
                            ) : creditNotes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <FileText size={36} className="mx-auto mb-3 opacity-20 text-[var(--text-muted)]" />
                                        <p className="text-[var(--text-muted)] font-medium mb-2">No credit notes found</p>
                                        <p className="text-sm text-[var(--text-muted)]">
                                            Credit notes are created when you initiate a return from a delivered order.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                creditNotes.map((cn) => (
                                    <tr key={cn.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                        <td className="p-4 font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                                            {cn.creditNoteNumber}
                                        </td>
                                        <td className="p-4">{cn.customer?.name ?? "—"}</td>
                                        <td className="p-4 text-[var(--text-secondary)]">
                                            {formatDate(cn.creditNoteDate)}
                                        </td>
                                        <td className="p-4 text-[var(--text-secondary)] max-w-[200px] truncate">
                                            {cn.reason}
                                        </td>
                                        <td className="p-4 text-right font-medium text-[var(--red)]" style={{ fontFamily: "var(--font-mono)" }}>
                                            -{formatINR(cn.totalAmount)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass[cn.status] ?? "badge-draft"}`}>
                                                {cn.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {cn.returnOrderId && (
                                                <Link
                                                    href={`/orders/${cn.returnOrderId}`}
                                                    className="inline-flex items-center gap-1 text-xs text-[var(--gold)] hover:underline transition"
                                                >
                                                    View Order <ArrowRight size={12} />
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
