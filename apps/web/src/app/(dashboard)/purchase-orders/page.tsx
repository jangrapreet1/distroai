"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, X, ShoppingBag, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { usePurchaseOrders } from "@/hooks/api-hooks";
import { formatDate, formatINR } from "@/lib/utils";

const STATUS_TABS = ["All", "DRAFT", "SENT", "PARTIAL", "RECEIVED", "CANCELLED"];
const statusClass: Record<string, string> = { DRAFT: "badge-draft", SENT: "badge-sent", PARTIAL: "badge-partial", RECEIVED: "badge-delivered", CANCELLED: "badge-cancelled" };

export default function PurchaseOrdersPage() {
    const [status, setStatus] = useState("All");
    const [search, setSearch] = useState("");
    const [selectedPOs, setSelectedPOs] = useState<string[]>([]);
    const { data, isLoading } = usePurchaseOrders();
    const pos: Record<string, any>[] = data?.data ?? [];

    // Filter by status + search
    const filtered = useMemo(() => {
        let result = pos;
        if (status !== "All") result = result.filter((po) => po.status === status);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter((po) =>
                (po.poNumber as string)?.toLowerCase().includes(q) ||
                (po.supplier as any)?.name?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [pos, status, search]);

    // KPI summaries
    const totalPOs = pos.length;
    const totalValue = pos.reduce((s, po) => s + ((po.totalAmount as number) || 0), 0);
    const pendingCount = pos.filter((po) => ["DRAFT", "SENT", "PARTIAL"].includes(po.status as string)).length;
    const receivedCount = pos.filter((po) => po.status === "RECEIVED").length;

    const kpis = [
        { label: "Total POs", value: totalPOs, icon: ShoppingBag, color: "var(--gold)" },
        { label: "Total Value", value: formatINR(totalValue), icon: ShoppingBag, color: "var(--purple)" },
        { label: "Pending", value: pendingCount, icon: Clock, color: "var(--orange)" },
        { label: "Received", value: receivedCount, icon: CheckCircle, color: "var(--green-bright)" },
    ];

    const toggleSelection = (id: string) => setSelectedPOs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => setSelectedPOs(e.target.checked ? filtered.map(po => po.id as string) : []);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Purchase Orders</h1>
                <Link href="/purchase-orders/new" className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] transition"><Plus size={16} /> New PO</Link>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {kpis.map((k) => (
                    <div key={k.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                        <div className="flex items-center gap-2 mb-2"><k.icon size={14} style={{ color: k.color }} /><span className="text-xs text-[var(--text-muted)]">{k.label}</span></div>
                        <p className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* Status Tabs + Search */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex flex-wrap gap-1">
                    {STATUS_TABS.map((s) => (
                        <button key={s} onClick={() => { setStatus(s); }} className={`px-3 py-1.5 text-xs rounded-full transition ${status === s ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>{s}</button>
                    ))}
                </div>
                <div className="relative max-w-xs flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                        placeholder="Search PO # or supplier…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-9 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition placeholder:text-[var(--text-muted)]"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={14} /></button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                        <th className="text-left p-4 w-12">
                            <input type="checkbox" onChange={handleSelectAll} checked={filtered.length > 0 && selectedPOs.length === filtered.length} className="w-4 h-4 rounded border-[var(--border)] bg-transparent accent-[var(--gold)] cursor-pointer" />
                        </th>
                        <th className="text-left p-4">PO #</th><th className="text-left p-4">Supplier</th><th className="text-left p-4">Date</th><th className="text-right p-4">Amount</th><th className="text-center p-4">Status</th><th className="text-right p-4">Actions</th>
                    </tr></thead>
                    <tbody>
                        {isLoading ? Array.from({ length: 4 }).map((_, i) => <tr key={i} className="border-b border-[var(--border)]"><td colSpan={7} className="p-4"><div className="skeleton h-5 rounded" /></td></tr>) :
                            filtered.length === 0 ? (
                                <tr><td colSpan={7} className="p-0">
                                    <div className="text-center py-16">
                                        <div className="w-16 h-16 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-4">
                                            <ShoppingBag size={28} className="text-[var(--gold)]" />
                                        </div>
                                        <h3 className="text-base font-medium mb-1">{search || status !== "All" ? "No matching purchase orders" : "No purchase orders yet"}</h3>
                                        <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto mb-5">
                                            {search || status !== "All" ? "Try adjusting your filters." : "Create your first purchase order to manage inventory procurement."}
                                        </p>
                                        {!search && status === "All" && (
                                            <Link href="/purchase-orders/new" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition">
                                                <Plus size={14} /> New PO
                                            </Link>
                                        )}
                                    </div>
                                </td></tr>
                            ) : filtered.map((po) => (
                                <tr key={po.id as string} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                    <td className="p-4"><input type="checkbox" checked={selectedPOs.includes(po.id as string)} onChange={() => toggleSelection(po.id as string)} className="w-4 h-4 rounded border-[var(--border)] bg-transparent accent-[var(--gold)] cursor-pointer" /></td>
                                    <td className="p-4 font-medium" style={{ fontFamily: "var(--font-mono)" }}><Link href={`/purchase-orders/${po.id}`} className="text-[var(--gold)] hover:underline">{po.poNumber as string}</Link></td>
                                    <td className="p-4">{(po.supplier as any)?.name ?? "—"}</td>
                                    <td className="p-4 text-[var(--text-secondary)]">{formatDate(po.createdAt as string)}</td>
                                    <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(po.totalAmount as number)}</td>
                                    <td className="p-4 text-center"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass[po.status as string] ?? "badge-draft"}`}>{po.status as string}</span></td>
                                    <td className="p-4 text-right"><Link href={`/purchase-orders/${po.id}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">View →</Link></td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {selectedPOs.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--bg-primary)] border border-[var(--gold)]/30 shadow-[0_8px_30px_rgba(0,0,0,0.2)] rounded-full px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center bg-[var(--gold)]/20 text-[var(--gold)] w-6 h-6 rounded-full text-xs font-bold">{selectedPOs.length}</span>
                        <span className="text-sm font-medium">Orders selected</span>
                    </div>
                    <div className="w-px h-6 bg-[var(--border)]"></div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => toast("Bulk sync to inventory coming soon!", { icon: "📦" })} className="text-sm px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] transition text-[var(--text-secondary)]">Mark Received</button>
                        <button onClick={() => setSelectedPOs([])} className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={16} /></button>
                    </div>
                </div>
            )}
        </div>
    );
}
