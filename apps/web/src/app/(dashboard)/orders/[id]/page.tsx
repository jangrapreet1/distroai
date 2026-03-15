"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Package, Truck, MapPin, XCircle, RotateCcw, Clock, Send } from "lucide-react";
import { useOrder, useOrderAction, useSendInvoiceWhatsApp } from "@/hooks/api-hooks";
import { formatDate, formatDateTime } from "@/lib/utils";

function formatINR(n: number): string { return "₹" + n.toLocaleString("en-IN"); }

const statusClass: Record<string, string> = {
    DRAFT: "badge-draft", CONFIRMED: "badge-confirmed", PACKED: "badge-packed",
    DISPATCHED: "badge-dispatched", DELIVERED: "badge-delivered", CANCELLED: "badge-cancelled",
};

const statusFlow: Record<string, { label: string; action: string; icon: React.ElementType }[]> = {
    DRAFT: [{ label: "Confirm Order", action: "confirm", icon: CheckCircle }, { label: "Cancel", action: "cancel", icon: XCircle }],
    CONFIRMED: [{ label: "Mark Packed", action: "pack", icon: Package }, { label: "Cancel", action: "cancel", icon: XCircle }],
    PACKED: [{ label: "Mark Dispatched", action: "dispatch", icon: Truck }],
    DISPATCHED: [{ label: "Mark Delivered", action: "deliver", icon: MapPin }],
    DELIVERED: [{ label: "Create Return", action: "return", icon: RotateCcw }],
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: order, isLoading } = useOrder(id);
    const orderAction = useOrderAction();
    const sendWhatsApp = useSendInvoiceWhatsApp();

    if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-[var(--radius-md)]" />)}</div>;
    if (!order) return <div className="text-center py-20"><p className="text-[var(--text-muted)]">Order not found</p></div>;

    const actions = statusFlow[order.status as string] ?? [];

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/orders" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><ArrowLeft size={20} /></Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>{order.orderNumber}</h1>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass[order.status] ?? "badge-draft"}`}>{order.status}</span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">{formatDate(order.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                    {order.invoiceId && (
                        <button onClick={() => sendWhatsApp.mutate(order.invoiceId)} disabled={sendWhatsApp.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--whatsapp)] text-[var(--whatsapp)] hover:bg-[var(--whatsapp)]/10 font-semibold transition disabled:opacity-50">
                            <Send size={14} /> Send Invoice
                        </button>
                    )}
                    {actions.map((a) => (
                        <button key={a.action} onClick={() => orderAction.mutate({ id, action: a.action })}
                            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] transition ${a.action === "cancel" ? "border border-[var(--border)] text-[var(--red)] hover:bg-[var(--red)]/10" : "bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)]"}`}>
                            <a.icon size={14} /> {a.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid lg:grid-cols-10 gap-6">
                {/* Left: Items */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase">
                                    <th className="text-left p-4">Product</th>
                                    <th className="text-right p-4">Qty</th>
                                    <th className="text-right p-4">Price</th>
                                    <th className="text-right p-4">GST</th>
                                    <th className="text-right p-4">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(order.items ?? []).map((item: Record<string, unknown>) => (
                                    <tr key={item.id as string} className="border-b border-[var(--border)]">
                                        <td className="p-4">{(item.product as Record<string, string>)?.name ?? item.productId}</td>
                                        <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)" }}>{item.quantity as number} {item.unit as string}</td>
                                        <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(item.price as number)}</td>
                                        <td className="p-4 text-right text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(item.taxAmount as number ?? 0)}</td>
                                        <td className="p-4 text-right font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(item.totalAmount as number)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-4 border-t border-[var(--border)] space-y-1 text-sm text-right">
                            <p className="text-[var(--text-secondary)]">Subtotal: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(order.totalAmount)}</span></p>
                            <p className="text-[var(--text-secondary)]">Discount: <span style={{ fontFamily: "var(--font-mono)" }}>-{formatINR(order.discountAmount)}</span></p>
                            <p className="text-[var(--text-secondary)]">GST: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(order.taxAmount)}</span></p>
                            <p className="font-bold text-base">Total: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(order.netAmount)}</span></p>
                        </div>
                    </div>
                </div>

                {/* Right: Customer + Timeline */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Customer */}
                    {order.customer && (
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                            <h3 className="text-xs uppercase text-[var(--text-muted)] tracking-wider mb-3">Customer</h3>
                            <p className="font-semibold mb-1">{order.customer.name}</p>
                            <p className="text-sm text-[var(--text-secondary)]">{order.customer.phone}</p>
                            {order.customer.outstandingAmount > 0 && (
                                <div className="mt-3 p-2 rounded-md bg-[var(--red)]/8 border border-[var(--red)]/15 text-xs text-[var(--red)]">
                                    Outstanding: {formatINR(order.customer.outstandingAmount)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status Timeline */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                        <h3 className="text-xs uppercase text-[var(--text-muted)] tracking-wider mb-3">Activity</h3>
                        <div className="space-y-3">
                            {(order.statusHistory ?? []).map((h: Record<string, unknown>, i: number) => (
                                <div key={i} className="flex gap-3 text-sm">
                                    <div className="flex flex-col items-center">
                                        <div className="w-2 h-2 rounded-full bg-[var(--gold)] mt-1.5" />
                                        {i < (order.statusHistory?.length ?? 0) - 1 && <div className="w-px flex-1 bg-[var(--border)]" />}
                                    </div>
                                    <div className="pb-3">
                                        <p className="font-medium">{h.toStatus as string}</p>
                                        <p className="text-xs text-[var(--text-muted)] flex items-center gap-1"><Clock size={10} />{formatDateTime(h.createdAt as string)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
