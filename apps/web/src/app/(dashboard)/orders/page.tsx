"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, Package, Send } from "lucide-react";
import { useOrders, useOrderAction } from "@/hooks/api-hooks";
import { formatDate, buildWhatsAppInvoiceLink } from "@/lib/utils";

const STATUS_TABS = ["All", "DRAFT", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED", "CANCELLED"];
const statusClass: Record<string, string> = {
    DRAFT: "badge-draft", CONFIRMED: "badge-confirmed", PACKED: "badge-packed",
    DISPATCHED: "badge-dispatched", DELIVERED: "badge-delivered", CANCELLED: "badge-cancelled", RETURNED: "badge-cancelled",
};

function formatINR(n: number): string { return "₹" + n.toLocaleString("en-IN"); }

export default function OrdersPage() {
    const [status, setStatus] = useState("All");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const filters = { ...(status !== "All" && { status }), ...(search && { search }), page, limit: 20 };
    const { data, isLoading } = useOrders(filters);
    const orderAction = useOrderAction();

    const orders = data?.data ?? [];
    const meta = data?.meta ?? { total: 0, pages: 0 };

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Orders</h1>
                <Link href="/orders/new" className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] transition">
                    <Plus size={16} /> New Order
                </Link>
            </div>

            {/* Status tabs */}
            <div className="flex flex-wrap gap-1 mb-4">
                {STATUS_TABS.map((s) => (
                    <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`px-3 py-1.5 text-xs rounded-full transition ${status === s ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
                        {s}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by customer or order #" className="w-full pl-9 pr-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                <th className="text-left p-4">Order #</th>
                                <th className="text-left p-4">Customer</th>
                                <th className="text-left p-4">Date</th>
                                <th className="text-right p-4">Amount</th>
                                <th className="text-center p-4">Status</th>
                                <th className="text-right p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-[var(--border)]">
                                        <td colSpan={6} className="p-4"><div className="skeleton h-5 rounded" /></td>
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center">
                                        <Package size={36} className="mx-auto mb-3 opacity-20 text-[var(--text-muted)]" />
                                        <p className="text-[var(--text-muted)] font-medium mb-2">No orders found</p>
                                        <Link href="/orders/new" className="text-sm text-[var(--gold)] hover:underline">Create your first order →</Link>
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order: Record<string, unknown>) => (
                                    <tr key={order.id as string} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                        <td className="p-4 font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                                            <Link href={`/orders/${order.id}`} className="text-[var(--gold)] hover:underline">{order.orderNumber as string}</Link>
                                        </td>
                                        <td className="p-4">{(order.customer as Record<string, string>)?.name ?? "—"}</td>
                                        <td className="p-4 text-[var(--text-secondary)]">{formatDate(order.createdAt as string)}</td>
                                        <td className="p-4 text-right font-medium" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(order.netAmount as number)}</td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass[(order.status as string)] ?? "badge-draft"}`}>
                                                {order.status as string}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {(order as any).invoiceId && (order.customer as any)?.phone && (
                                                    <a href={buildWhatsAppInvoiceLink({
                                                        customerPhone: (order.customer as any).phone,
                                                        customerName: (order.customer as any).name ?? "Customer",
                                                        invoiceNumber: order.orderNumber as string,
                                                        invoiceAmount: order.netAmount as number,
                                                        invoiceId: (order as any).invoiceId,
                                                    })} target="_blank" rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-[var(--whatsapp)] hover:underline transition">
                                                        <Send size={12} /> Send Invoice
                                                    </a>
                                                )}
                                                <Link href={`/orders/${order.id}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">View</Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {meta.pages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-[var(--border)]">
                        <p className="text-xs text-[var(--text-muted)]">{meta.total} orders total</p>
                        <div className="flex gap-1">
                            {Array.from({ length: Math.min(meta.pages, 5) }, (_, i) => (
                                <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded text-xs transition ${page === i + 1 ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]"}`}>
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
