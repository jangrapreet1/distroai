"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, FileText, X, Truck, Sliders } from "lucide-react";
import toast from "react-hot-toast";
import { useInvoices, useDashboard, useBulkMarkInvoicesPaid } from "@/hooks/api-hooks";
import { formatDate, formatINR } from "@/lib/utils";
import { CreateCustomInvoiceModal } from "@/components/modals/CreateCustomInvoiceModal";


const STATUS_TABS = ["All", "DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE"];
const statusClass: Record<string, string> = { DRAFT: "badge-draft", SENT: "badge-sent", PARTIAL: "badge-partial", PAID: "badge-paid", OVERDUE: "badge-overdue", CANCELLED: "badge-cancelled" };

export default function InvoicesPage() {
    const router = useRouter();
    const [status, setStatus] = useState("All");
    const [page, setPage] = useState(1);
    const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const bulkPay = useBulkMarkInvoicesPaid();
    const filters = { ...(status !== "All" && { status }), page, limit: 20 };
    const { data, isLoading, refetch } = useInvoices(filters);
    const invoices = data?.data?.data ?? data?.data ?? [];
    const meta = data?.data?.meta ?? data?.meta ?? { total: 0 };
    const currentInvoices = Array.isArray(invoices) ? invoices : [];

    const { data: dashboard } = useDashboard();
    const d = dashboard?.data ?? dashboard ?? {};

    const handleBulkPaid = () => {
        const selectedData = currentInvoices
            .filter((i: any) => selectedInvoices.includes(i.id))
            .map((i: any) => ({
                id: i.id,
                customerId: i.customerId,
                balanceAmount: i.balanceAmount
            }))
            .filter((i: any) => i.balanceAmount > 0);

        if (selectedData.length === 0) {
            toast.error("No unpaid invoices selected");
            return;
        }

        bulkPay.mutate(selectedData, {
            onSuccess: () => setSelectedInvoices([])
        });
    };

    // Compute real summaries from dashboard / invoice data
    const totalOutstanding = useMemo(() => {
        if (Array.isArray(invoices)) return invoices.reduce((s: number, inv: Record<string, unknown>) => s + ((inv.balanceAmount as number) ?? 0), 0);
        return 0;
    }, [invoices]);

    const overdueCount = useMemo(() => {
        if (Array.isArray(invoices)) return invoices.filter((inv: Record<string, unknown>) => (inv.status as string) === "OVERDUE").length;
        return 0;
    }, [invoices]);

    const paidCount = useMemo(() => {
        if (Array.isArray(invoices)) return invoices.filter((inv: Record<string, unknown>) => (inv.status as string) === "PAID").length;
        return 0;
    }, [invoices]);

    const summary = [
        { label: "Total Outstanding", value: formatINR(totalOutstanding), color: "var(--red)" },
        { label: "Overdue", value: `${overdueCount} invoices`, color: "var(--orange)" },
        { label: "Paid This Page", value: `${paidCount} invoices`, color: "var(--green-bright)" },
        { label: "Total Invoices", value: meta.total ?? 0, color: "var(--gold)" },
    ];

    const toggleSelection = (id: string) => setSelectedInvoices(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => setSelectedInvoices(e.target.checked ? currentInvoices.map((inv: any) => inv.id as string) : []);

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>Invoices</h1>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage tax invoices, bills of supply, and customer billing</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-bold hover:bg-[var(--gold-light)] transition cursor-pointer shadow-sm"
                    >
                        <Plus size={16} /> Create Custom Invoice
                    </button>
                    <Link href="/orders/new" className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-card)] transition">
                        New Order
                    </Link>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {summary.map((s) => (
                    <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                        <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
                        <p className="text-lg font-bold" style={{ color: s.color, fontFamily: "var(--font-mono)" }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Status tabs */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-nowrap pb-1 mb-4">
                {STATUS_TABS.map((s) => (
                    <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`px-3 py-1.5 text-xs rounded-full transition whitespace-nowrap shrink-0 ${status === s ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>{s}</button>
                ))}
            </div>

            {/* Mobile Invoice Cards (< md) */}
            <div className="block md:hidden space-y-3 mb-6">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] skeleton h-28" />
                    ))
                ) : (Array.isArray(invoices) ? invoices : []).length === 0 ? (
                    <div className="p-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
                        No invoices found.
                    </div>
                ) : (
                    (Array.isArray(invoices) ? invoices : []).map((inv: Record<string, unknown>) => {
                        const balance = (inv.balanceAmount as number) ?? 0;
                        const total = (inv.totalAmount as number) ?? 0;
                        return (
                            <div key={inv.id as string} className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                    <Link href={`/invoices/${inv.id}`} className="font-mono font-bold text-[var(--gold)] hover:underline">
                                        {inv.invoiceNumber as string}
                                    </Link>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClass[inv.status as string] ?? "badge-draft"}`}>
                                        {inv.status as string}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-xs">
                                    <p className="font-semibold text-sm text-[var(--text-primary)]">
                                        {(inv.customer as Record<string, string>)?.name ?? "Customer"}
                                    </p>
                                    {Boolean(inv.eWayBillNumber) && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                                            <Truck size={10} /> EWB: {String(inv.eWayBillNumber)}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                                    <span>Date: {formatDate(inv.invoiceDate as string)}</span>
                                    <span>Due: {formatDate(inv.dueDate as string)}</span>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/60 text-xs">
                                    <div>
                                        <span className="text-[10px] text-[var(--text-muted)] block">Total / Balance</span>
                                        <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                                            {formatINR(total)}
                                        </span>
                                        {balance > 0 && (
                                            <span className="font-mono text-xs font-semibold text-[var(--orange)] ml-1.5">
                                                (Due: {formatINR(balance)})
                                            </span>
                                        )}
                                    </div>
                                    <Link
                                        href={`/invoices/${inv.id}`}
                                        className="px-2.5 py-1.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-semibold hover:bg-[var(--gold)]/25 transition"
                                    >
                                        View Invoice →
                                    </Link>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Desktop Table (md+) */}
            <div className="hidden md:block bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                            <th className="text-left p-4 w-12"><input type="checkbox" onChange={handleSelectAll} checked={currentInvoices.length > 0 && selectedInvoices.length === currentInvoices.length} className="w-4 h-4 rounded border-[var(--border)] bg-transparent accent-[var(--gold)] cursor-pointer" /></th>
                            <th className="text-left p-4">Invoice #</th>
                            <th className="text-left p-4">Customer</th>
                            <th className="text-left p-4">Date</th>
                            <th className="text-left p-4">Due</th>
                            <th className="text-right p-4">Amount</th>
                            <th className="text-right p-4">Balance</th>
                            <th className="text-center p-4">Status</th>
                            <th className="text-right p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="border-b border-[var(--border)]"><td colSpan={9} className="p-4"><div className="skeleton h-5 rounded" /></td></tr>
                        )) : (Array.isArray(invoices) ? invoices : []).length === 0 ? (
                            <tr><td colSpan={9} className="p-12 text-center text-[var(--text-muted)]">No invoices found. Create an order and dispatch it to auto-generate invoices.</td></tr>
                        ) : (Array.isArray(invoices) ? invoices : []).map((inv: Record<string, unknown>) => (
                            <tr key={inv.id as string} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                <td className="p-4"><input type="checkbox" checked={selectedInvoices.includes(inv.id as string)} onChange={() => toggleSelection(inv.id as string)} className="w-4 h-4 rounded border-[var(--border)] bg-transparent accent-[var(--gold)] cursor-pointer" /></td>
                                <td className="p-4 font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                                    <Link href={`/invoices/${inv.id}`} className="text-[var(--gold)] hover:underline">{inv.invoiceNumber as string}</Link>
                                    {Boolean(inv.eWayBillNumber) && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                                                <Truck size={10} /> EWB: {String(inv.eWayBillNumber)}
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td className="p-4">{(inv.customer as Record<string, string>)?.name ?? "—"}</td>
                                <td className="p-4 text-[var(--text-secondary)]">{formatDate(inv.invoiceDate as string)}</td>
                                <td className="p-4 text-[var(--text-secondary)]">{formatDate(inv.dueDate as string)}</td>
                                <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)" }}>{formatINR((inv.totalAmount as number) ?? 0)}</td>
                                <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)", color: ((inv.balanceAmount as number) ?? 0) > 0 ? "var(--orange)" : "var(--green-bright)" }}>
                                    {formatINR((inv.balanceAmount as number) ?? 0)}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass[inv.status as string] ?? "badge-draft"}`}>{inv.status as string}</span>
                                </td>
                                <td className="p-4 text-right">
                                    <Link href={`/invoices/${inv.id}`} className="text-xs text-[var(--gold)] hover:underline">View</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedInvoices.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--bg-card)] border border-[var(--gold)]/30 shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-full px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center bg-[var(--gold)]/20 text-[var(--gold)] w-6 h-6 rounded-full text-xs font-bold">{selectedInvoices.length}</span>
                        <span className="text-sm font-medium">Invoices selected</span>
                    </div>
                    <div className="w-px h-6 bg-[var(--border)]"></div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleBulkPaid} disabled={bulkPay.isPending} className="text-sm px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] transition text-[var(--border-accent)]">{bulkPay.isPending ? "..." : "Mark Paid"}</button>
                        <button onClick={() => setSelectedInvoices([])} className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={16} /></button>
                    </div>
                </div>
            )}

            <CreateCustomInvoiceModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreated={(newId) => {
                    refetch();
                    router.push(`/invoices/${newId}`);
                }}
            />
        </div>
    );
}
