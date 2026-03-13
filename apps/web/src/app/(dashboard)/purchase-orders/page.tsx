"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { usePurchaseOrders } from "@/hooks/api-hooks";
import { formatDate } from "@/lib/utils";

function formatINR(n: number): string { return "₹" + n.toLocaleString("en-IN"); }
const statusClass: Record<string, string> = { DRAFT: "badge-draft", SENT: "badge-sent", PARTIAL: "badge-partial", RECEIVED: "badge-delivered", CANCELLED: "badge-cancelled" };

export default function PurchaseOrdersPage() {
    const { data, isLoading } = usePurchaseOrders();
    const pos = data?.data ?? [];

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Purchase Orders</h1>
                <Link href="/purchase-orders/new" className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] transition"><Plus size={16} /> New PO</Link>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                        <th className="text-left p-4">PO #</th><th className="text-left p-4">Supplier</th><th className="text-left p-4">Date</th><th className="text-right p-4">Amount</th><th className="text-center p-4">Status</th><th className="text-right p-4">Actions</th>
                    </tr></thead>
                    <tbody>
                        {isLoading ? Array.from({ length: 3 }).map((_, i) => <tr key={i} className="border-b border-[var(--border)]"><td colSpan={6} className="p-4"><div className="skeleton h-5 rounded" /></td></tr>) :
                            pos.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-[var(--text-muted)]">No purchase orders yet</td></tr> :
                                pos.map((po: Record<string, unknown>) => (
                                    <tr key={po.id as string} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                        <td className="p-4 font-medium" style={{ fontFamily: "var(--font-mono)" }}><Link href={`/purchase-orders/${po.id}`} className="text-[var(--gold)] hover:underline">{po.poNumber as string}</Link></td>
                                        <td className="p-4">{(po.supplier as Record<string, string>)?.name ?? "—"}</td>
                                        <td className="p-4 text-[var(--text-secondary)]">{formatDate(po.createdAt as string)}</td>
                                        <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(po.totalAmount as number)}</td>
                                        <td className="p-4 text-center"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass[po.status as string] ?? "badge-draft"}`}>{po.status as string}</span></td>
                                        <td className="p-4 text-right"><Link href={`/purchase-orders/${po.id}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">View</Link></td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
