"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, Package, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { useOrders, useOrderAction, useBulkOrderAction } from "@/hooks/api-hooks";
import { formatDate, buildWhatsAppInvoiceLink, formatINR, exportToCSV } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const STATUS_TABS = ["All", "Portal", "DRAFT", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED", "CANCELLED"] as const;
const statusClass: Record<string, string> = {
    DRAFT: "badge-draft", CONFIRMED: "badge-confirmed", PACKED: "badge-packed",
    DISPATCHED: "badge-dispatched", DELIVERED: "badge-delivered", CANCELLED: "badge-cancelled", RETURNED: "badge-cancelled",
};

export default function OrdersPage() {
    const [status, setStatus] = useState<typeof STATUS_TABS[number]>("All");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const { t } = useLanguage();
    const bulkOrder = useBulkOrderAction();

    const STATUS_TAB_LABELS: Record<string, string> = {
        All: t('all'), Portal: t('portal'), DRAFT: t('draft'), CONFIRMED: t('confirmed'),
        PACKED: t('packed'), DISPATCHED: t('dispatched'), DELIVERED: t('delivered'), CANCELLED: t('cancelled')
    };

    const handleBulkDispatch = () => {
        bulkOrder.mutate({ ids: selectedOrders, action: 'dispatch', data: { vehicleNumber: 'BULK DISPATCH' } }, {
            onSuccess: () => setSelectedOrders([])
        });
    };

    const handleBulkCancel = () => {
        bulkOrder.mutate({ ids: selectedOrders, action: 'cancel' }, {
            onSuccess: () => setSelectedOrders([])
        });
    };

    const handleBulkMarkPaid = () => {
        const unpaidIds = selectedOrders.filter(id => {
            const order = orders.find((o: any) => o.id === id);
            if (!order) return false;
            const invBalance = (order as any).invoice?.balanceAmount;
            // Skip already-paid orders
            if (invBalance != null && invBalance <= 0) return false;
            return true;
        });

        if (unpaidIds.length === 0) {
            toast.error('All selected orders are already paid');
            return;
        }

        bulkOrder.mutate({ ids: unpaidIds, action: 'mark-paid' }, {
            onSuccess: () => setSelectedOrders([])
        });
    };

    const filters = {
        ...(status !== "All" && status !== "Portal" && { status }),
        ...(status === "Portal" && { source: "PORTAL" }),
        ...(search && { search }),
        page,
        limit: 20
    };
    const { data, isLoading } = useOrders(filters);
    const orderAction = useOrderAction();

    const orders = data?.data ?? [];
    const meta = data?.meta ?? { total: 0, pages: 0 };

    const toggleSelection = (id: string) => {
        setSelectedOrders(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const canDispatch = selectedOrders.length > 0 && selectedOrders.every(id => {
        const order = Array.isArray(orders) ? orders.find((o: any) => o.id === id) : null;
        return order && !["DISPATCHED", "DELIVERED", "CANCELLED", "RETURNED"].includes(order.status as string);
    });

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedOrders(orders.map((o: any) => o.id as string));
        else setSelectedOrders([]);
    };

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>{t('orders')}</h1>
                <div className="flex items-center gap-2">
                    <button onClick={() => exportToCSV("orders-export", orders)} className="flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition">
                        Export CSV
                    </button>
                    <Link href="/orders/new" className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] transition">
                        <Plus size={16} /> {t('new_order')}
                    </Link>
                </div>
            </div>

            {/* Status tabs */}
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
                        {STATUS_TAB_LABELS[s] || s}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_by_customer_or_order')} className="w-full pl-9 pr-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                <th className="text-left p-4 w-12">
                                    <input type="checkbox" onChange={handleSelectAll} checked={orders.length > 0 && selectedOrders.length === orders.length} className="w-4 h-4 rounded border-[var(--border)] bg-transparent accent-[var(--gold)] cursor-pointer" />
                                </th>
                                <th className="text-left p-4">{t('order_hash')}</th>
                                <th className="text-left p-4">{t('customer')}</th>
                                <th className="text-left p-4">{t('date')}</th>
                                <th className="text-right p-4">{t('amount')}</th>
                                <th className="text-center p-4">Payment</th>
                                <th className="text-center p-4">Source</th>
                                <th className="text-center p-4">{t('status')}</th>
                                <th className="text-right p-4">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-[var(--border)]">
                                        <td colSpan={9} className="p-4"><div className="skeleton h-5 rounded" /></td>
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center">
                                        <Package size={36} className="mx-auto mb-3 opacity-20 text-[var(--text-muted)]" />
                                        <p className="text-[var(--text-muted)] font-medium mb-2">{t('no_orders_found')}</p>
                                        <Link href="/orders/new" className="text-sm text-[var(--gold)] hover:underline">{t('create_first_order')}</Link>
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order: Record<string, unknown>) => (
                                    <tr key={order.id as string} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                        <td className="p-4">
                                            <input type="checkbox" checked={selectedOrders.includes(order.id as string)} onChange={() => toggleSelection(order.id as string)} className="w-4 h-4 rounded border-[var(--border)] bg-transparent accent-[var(--gold)] cursor-pointer" />
                                        </td>
                                        <td className="p-4 font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                                            <Link href={`/orders/${order.id}`} className="text-[var(--gold)] hover:underline">{order.orderNumber as string}</Link>
                                        </td>
                                        <td className="p-4">{(order.customer as Record<string, string>)?.name ?? "—"}</td>
                                        <td className="p-4 text-[var(--text-secondary)]">{formatDate(order.createdAt as string)}</td>
                                        <td className="p-4 text-right font-medium" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(order.netAmount as number)}</td>
                                        <td className="p-4 text-center">
                                            {(() => {
                                                const net = (order.netAmount as number) ?? 0;
                                                const paid = (order.paidAmount as number) ?? 0;
                                                const invoiceBalance = (order as any).invoice?.balanceAmount;
                                                if (net === 0) return <span className="text-[var(--text-muted)]">—</span>;
                                                // Per-order check: use the linked invoice's balance (most accurate)
                                                if (invoiceBalance != null) {
                                                    if (invoiceBalance <= 0) return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider bg-[var(--green)]/10 text-[var(--green)]">PAID</span>;
                                                    if (invoiceBalance < net) return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider bg-[var(--orange)]/10 text-[var(--orange)]">PARTIAL</span>;
                                                }
                                                // Fallback: check order's own paidAmount
                                                if (paid >= net) return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider bg-[var(--green)]/10 text-[var(--green)]">PAID</span>;
                                                if (paid > 0) return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider bg-[var(--orange)]/10 text-[var(--orange)]">PARTIAL</span>;
                                                return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider bg-[var(--red)]/10 text-[var(--red)]">UNPAID</span>;
                                            })()}
                                        </td>
                                        <td className="p-4 text-center">
                                            {(() => {
                                                const src = (order as any).source ?? "MANUAL";
                                                const srcStyle: Record<string, string> = {
                                                    PORTAL: "bg-[#7C3AED]/15 text-[#A78BFA]",
                                                    WHATSAPP: "bg-[var(--whatsapp)]/15 text-[var(--whatsapp)]",
                                                    MANUAL: "bg-[var(--text-muted)]/10 text-[var(--text-muted)]",
                                                };
                                                return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${srcStyle[src] ?? srcStyle.MANUAL}`}>{src}</span>;
                                            })()}
                                        </td>
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
                                                        <Send size={12} /> {t('send_invoice')}
                                                    </a>
                                                )}
                                                <Link href={`/orders/${order.id}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">{t('view')}</Link>
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
                        <p className="text-xs text-[var(--text-muted)]">{meta.total} {t('orders_total')}</p>
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

            {selectedOrders.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--bg-primary)] border border-[var(--gold)]/30 shadow-[0_8px_30px_rgba(0,0,0,0.2)] rounded-full px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center bg-[var(--gold)]/20 text-[var(--gold)] w-6 h-6 rounded-full text-xs font-bold">{selectedOrders.length}</span>
                        <span className="text-sm font-medium">Orders selected</span>
                    </div>
                    <div className="w-px h-6 bg-[var(--border)]"></div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleBulkDispatch} disabled={!canDispatch || bulkOrder.isPending} className="text-sm px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] focus:outline-none transition text-[var(--gold)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-card-hover)]">{bulkOrder.isPending ? "..." : "Mark Dispatched"}</button>
                        <button onClick={handleBulkMarkPaid} disabled={bulkOrder.isPending} className="text-sm px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--green-bright)]/15 text-[var(--green-bright)] hover:bg-[var(--green-bright)]/25 transition disabled:opacity-30">{bulkOrder.isPending ? "..." : "Mark Paid"}</button>
                        <button onClick={handleBulkCancel} disabled={bulkOrder.isPending} className="text-sm px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--red)] hover:bg-[var(--red)]/10 transition">{bulkOrder.isPending ? "..." : "Cancel"}</button>
                        <button onClick={() => setSelectedOrders([])} className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={16} /></button>
                    </div>
                </div>
            )}
        </div>
    );
}
