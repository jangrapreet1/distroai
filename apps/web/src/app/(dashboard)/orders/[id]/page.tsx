"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Package, Truck, MapPin, XCircle, RotateCcw, Clock, Send, Edit, Plus, Trash2, Search } from "lucide-react";
import { useOrder, useOrderAction, useUpdateDraftOrder, useProducts } from "@/hooks/api-hooks";
import { formatDate, formatDateTime, buildWhatsAppInvoiceLink , formatINR } from "@/lib/utils";


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

interface EditItem {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    price: number;
    discount: number;
    taxRate: number;
}

/* ─── Edit Draft Order Modal ─── */
function EditDraftModal({ order, open, onClose }: { order: any; open: boolean; onClose: () => void }) {
    const updateDraft = useUpdateDraftOrder();
    const [items, setItems] = useState<EditItem[]>([]);
    const [notes, setNotes] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [showPicker, setShowPicker] = useState(false);

    const { data: productsData } = useProducts({ search: productSearch || undefined, limit: 20, isActive: true });
    const products = productsData?.data?.data ?? productsData?.data ?? [];

    // Initialize state from order on open
    useState(() => {
        if (order) {
            setItems((order.items ?? []).map((item: any) => ({
                productId: item.productId,
                productName: item.product?.name ?? item.productId,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                discount: item.discount ?? 0,
                taxRate: item.taxRate ?? 0,
            })));
            setNotes(order.notes ?? "");
        }
    });

    const addProduct = (p: any) => {
        if (items.some((i) => i.productId === p.id)) return;
        setItems([...items, {
            productId: p.id, productName: p.name, quantity: 1,
            unit: p.unit ?? "Pieces", price: p.sellingPrice ?? 0, discount: 0, taxRate: p.gstRate ?? 0,
        }]);
        setShowPicker(false);
        setProductSearch("");
    };

    const updateItem = (idx: number, field: keyof EditItem, value: number | string) => {
        setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    };

    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity - i.discount, 0);
    const totalDiscount = items.reduce((s, i) => s + i.discount, 0);
    const totalTax = items.reduce((s, i) => s + ((i.price * i.quantity - i.discount) * i.taxRate / 100), 0);
    const grandTotal = subtotal + totalTax;

    const handleSave = () => {
        if (items.length === 0) return;
        updateDraft.mutate({
            id: order.id,
            data: {
                items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unit: i.unit, price: i.price, discount: i.discount })),
                notes: notes || undefined,
            },
        }, { onSuccess: () => onClose() });
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)] z-10">
                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Edit Order {order.orderNumber}</h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition text-xl">✕</button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Items Table */}
                    <div className="border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[var(--bg-secondary)] text-[var(--text-muted)] text-xs uppercase">
                                    <th className="text-left p-3">Product</th>
                                    <th className="text-right p-3 w-20">Qty</th>
                                    <th className="text-right p-3 w-24">Price</th>
                                    <th className="text-right p-3 w-20">Disc.</th>
                                    <th className="text-right p-3 w-24">Total</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => {
                                    const lineTotal = item.price * item.quantity - item.discount;
                                    const lineTax = (lineTotal * item.taxRate) / 100;
                                    return (
                                        <tr key={idx} className="border-t border-[var(--border)]">
                                            <td className="p-3 text-sm font-medium">{item.productName}</td>
                                            <td className="p-3"><input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} className="w-full text-right px-2 py-1 text-sm rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none" /></td>
                                            <td className="p-3"><input type="number" min={0} step={0.01} value={item.price} onChange={(e) => updateItem(idx, "price", Number(e.target.value))} className="w-full text-right px-2 py-1 text-sm rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none" /></td>
                                            <td className="p-3"><input type="number" min={0} step={0.01} value={item.discount} onChange={(e) => updateItem(idx, "discount", Number(e.target.value))} className="w-full text-right px-2 py-1 text-sm rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none" /></td>
                                            <td className="p-3 text-right" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(lineTotal + lineTax)}</td>
                                            <td className="p-3"><button onClick={() => removeItem(idx)} className="text-[var(--red)] hover:bg-[var(--red)]/10 rounded p-1 transition"><Trash2 size={14} /></button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Add Product */}
                    <div className="relative">
                        <button onClick={() => setShowPicker(!showPicker)} className="flex items-center gap-1.5 text-sm text-[var(--gold)] hover:underline">
                            <Plus size={14} /> Add Product
                        </button>
                        {showPicker && (
                            <div className="absolute left-0 top-8 z-20 w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-xl p-3 space-y-2">
                                <div className="relative">
                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products..." autoFocus className="w-full pl-8 pr-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] outline-none" />
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {(Array.isArray(products) ? products : []).map((p: any) => (
                                        <button key={p.id} type="button" onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-[var(--bg-secondary)] transition flex justify-between items-center">
                                            <span>{p.name}</span>
                                            <span className="text-xs text-[var(--text-muted)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(p.sellingPrice ?? 0)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Totals */}
                    <div className="text-sm text-right space-y-1 pt-2 border-t border-[var(--border)]">
                        <p className="text-[var(--text-secondary)]">Subtotal: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(subtotal)}</span></p>
                        <p className="text-[var(--text-secondary)]">Discount: <span style={{ fontFamily: "var(--font-mono)" }}>-{formatINR(totalDiscount)}</span></p>
                        <p className="text-[var(--text-secondary)]">GST: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(totalTax)}</span></p>
                        <p className="font-bold text-base">Total: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(grandTotal)}</span></p>
                    </div>

                    {/* Notes */}
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Notes</span>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none resize-none" />
                    </label>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">Cancel</button>
                        <button onClick={handleSave} disabled={updateDraft.isPending || items.length === 0} className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-50 transition">
                            {updateDraft.isPending ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Order Detail Page ─── */
export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: order, isLoading } = useOrder(id);
    const orderAction = useOrderAction();
    const [showEdit, setShowEdit] = useState(false);

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
                <div className="flex gap-2 flex-wrap">
                    {order.status === "DRAFT" && (
                        <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10 font-semibold transition">
                            <Edit size={14} /> Edit Order
                        </button>
                    )}
                    {order.invoiceId && order.customer?.phone && (
                        <a href={buildWhatsAppInvoiceLink({
                            customerPhone: order.customer.phone,
                            customerName: order.customer.name ?? "Customer",
                            invoiceNumber: order.orderNumber,
                            invoiceAmount: order.netAmount,
                            invoiceId: order.invoiceId,
                        })} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--whatsapp)] text-[var(--whatsapp)] hover:bg-[var(--whatsapp)]/10 font-semibold transition">
                            <Send size={14} /> Send Invoice
                        </a>
                    )}
                    {actions.map((a) => (
                        <button key={a.action} onClick={() => orderAction.mutate({ id, action: a.action })}
                            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] transition ${a.action === "cancel" ? "border border-[var(--border)] text-[var(--red)] hover:bg-[var(--red)]/10" : "bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)]"}`}>
                            <a.icon size={14} /> {a.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Order Fulfillment Stepper ── */}
            {(() => {
                const STEPS = ["DRAFT", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"];
                const isCancelled = order.status === "CANCELLED" || order.status === "RETURNED";
                const currentIdx = STEPS.indexOf(order.status as string);
                const stepIcons: Record<string, React.ElementType> = { DRAFT: Clock, CONFIRMED: CheckCircle, PACKED: Package, DISPATCHED: Truck, DELIVERED: MapPin };

                if (isCancelled) {
                    return (
                        <div className="bg-[var(--bg-card)] border border-[var(--red)]/20 rounded-[var(--radius-md)] p-4 mb-6 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--red)]/15 flex items-center justify-center"><XCircle size={18} className="text-[var(--red)]" /></div>
                            <div>
                                <p className="text-sm font-semibold text-[var(--red)]">Order {order.status === "RETURNED" ? "Returned" : "Cancelled"}</p>
                                <p className="text-xs text-[var(--text-muted)]">This order has been {order.status?.toLowerCase()}</p>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5 mb-6">
                        <div className="flex items-center justify-between relative">
                            {/* Connecting line */}
                            <div className="absolute top-4 left-0 right-0 h-0.5 bg-[var(--border)]" style={{ left: '10%', right: '10%' }} />
                            <div className="absolute top-4 left-0 h-0.5 bg-[var(--gold)] transition-all duration-500" style={{ left: '10%', width: currentIdx >= 0 ? `${Math.min((currentIdx / (STEPS.length - 1)) * 80, 80)}%` : '0%' }} />

                            {STEPS.map((step, idx) => {
                                const StepIcon = stepIcons[step] ?? Clock;
                                const isComplete = idx < currentIdx;
                                const isCurrent = idx === currentIdx;
                                const isFuture = idx > currentIdx;

                                return (
                                    <div key={step} className="flex flex-col items-center z-10 relative" style={{ width: '20%' }}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isComplete ? 'bg-[var(--gold)] text-[var(--bg-primary)] shadow-[0_0_12px_rgba(234,179,8,0.3)]' :
                                            isCurrent ? 'bg-[var(--gold)]/20 text-[var(--gold)] border-2 border-[var(--gold)] shadow-[0_0_16px_rgba(234,179,8,0.25)]' :
                                                'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]'
                                            }`}>
                                            {isComplete ? <CheckCircle size={16} /> : <StepIcon size={14} />}
                                        </div>
                                        <span className={`mt-2 text-[10px] font-semibold uppercase tracking-wider ${isCurrent ? 'text-[var(--gold)]' : isComplete ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
                                            }`}>{step}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

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

            {/* Edit Draft Modal */}
            <EditDraftModal order={order} open={showEdit} onClose={() => setShowEdit(false)} />
        </div >
    );
}
