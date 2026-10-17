"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowLeft, CheckCircle, Package, Truck, MapPin, XCircle,
    RotateCcw, Clock, Send, Edit, Plus, Trash2, Search, AlertCircle
} from "lucide-react";
import { useOrder, useOrderAction, useUpdateDraftOrder, useProducts } from "@/hooks/api-hooks";
import { formatDate, formatDateTime, buildWhatsAppInvoiceLink, formatINR } from "@/lib/utils";
import toast from "react-hot-toast";

const statusClass: Record<string, string> = {
    DRAFT: "badge-draft",
    CONFIRMED: "badge-confirmed",
    PACKED: "badge-packed",
    DISPATCHED: "badge-dispatched",
    PARTIALLY_DELIVERED: "badge-partial",
    DELIVERED: "badge-delivered",
    COMPLETED: "badge-delivered",
    PARTIALLY_RETURNED: "badge-partial",
    RETURNED: "badge-cancelled",
    CANCELLED: "badge-cancelled",
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

    const { data: productsData } = useProducts({ search: productSearch || undefined, limit: 20, isActive: true }) || {};
    const products = productsData?.data?.data ?? productsData?.data ?? [];

    useEffect(() => {
        if (order && open) {
            setItems((order.items ?? []).map((item: any) => ({
                productId: item.productId,
                productName: item.product?.name ?? item.productId,
                quantity: item.orderedQty ?? item.quantity,
                unit: item.unit,
                price: item.price,
                discount: item.discount ?? 0,
                taxRate: item.taxRate ?? 0,
            })));
            setNotes(order.notes ?? "");
        }
    }, [order, open]);

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
                                            <td className="p-3"><input type="number" min={0} step="1" value={item.price} onChange={(e) => updateItem(idx, "price", Number(e.target.value))} className="w-full text-right px-2 py-1 text-sm rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none" /></td>
                                            <td className="p-3"><input type="number" min={0} step="1" value={item.discount} onChange={(e) => updateItem(idx, "discount", Number(e.target.value))} className="w-full text-right px-2 py-1 text-sm rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none" /></td>
                                            <td className="p-3 text-right" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(lineTotal + lineTax)}</td>
                                            <td className="p-3"><button onClick={() => removeItem(idx)} className="text-[var(--red)] hover:bg-[var(--red)]/10 rounded p-1 transition"><Trash2 size={14} /></button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

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

                    <div className="text-sm text-right space-y-1 pt-2 border-t border-[var(--border)]">
                        <p className="text-[var(--text-secondary)]">Subtotal: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(subtotal)}</span></p>
                        <p className="text-[var(--text-secondary)]">Discount: <span style={{ fontFamily: "var(--font-mono)" }}>-{formatINR(totalDiscount)}</span></p>
                        <p className="text-[var(--text-secondary)]">GST: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(totalTax)}</span></p>
                        <p className="font-bold text-base">Total: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(grandTotal)}</span></p>
                    </div>

                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Notes</span>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none resize-none" />
                    </label>

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

/* ─── Granular Dispatch / Partial Delivery Modal ─── */
function DispatchModal({ order, open, onClose }: { order: any; open: boolean; onClose: () => void }) {
    const orderAction = useOrderAction();
    const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({});
    const [trackingNumber, setTrackingNumber] = useState("");
    const [vehicleNumber, setVehicleNumber] = useState("");

    // Initialize quantities with remaining pending quantities
    useEffect(() => {
        if (order && open) {
            const initial: Record<string, number> = {};
            (order.items ?? []).forEach((item: any) => {
                const ordered = item.orderedQty ?? item.quantity;
                const delivered = item.deliveredQty ?? 0;
                const cancelled = item.cancelledQty ?? 0;
                const pending = item.pendingQty !== undefined ? item.pendingQty : Math.max(0, ordered - delivered - cancelled);
                if (pending > 0) {
                    initial[item.id] = pending; // default to full pending for convenience
                }
            });
            setDispatchQuantities(initial);
        }
    }, [order, open]);

    if (!open) return null;

    const pendingItems = (order.items ?? []).filter((item: any) => {
        const ordered = item.orderedQty ?? item.quantity;
        const delivered = item.deliveredQty ?? 0;
        const cancelled = item.cancelledQty ?? 0;
        const pending = item.pendingQty !== undefined ? item.pendingQty : Math.max(0, ordered - delivered - cancelled);
        return pending > 0;
    });

    const totalToDispatch = Object.values(dispatchQuantities).reduce((s, q) => s + (Number(q) || 0), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const itemsToDispatch = Object.entries(dispatchQuantities)
            .filter(([_, qty]) => Number(qty) > 0)
            .map(([orderItemId, dispatchQty]) => ({
                orderItemId,
                dispatchQty: Number(dispatchQty),
            }));

        if (itemsToDispatch.length === 0) {
            toast.error("Please enter a dispatch quantity greater than 0 for at least one item.");
            return;
        }

        // Validate over-delivery guard on the client
        for (const it of itemsToDispatch) {
            const item = order.items.find((i: any) => i.id === it.orderItemId);
            const ordered = item.orderedQty ?? item.quantity;
            const delivered = item.deliveredQty ?? 0;
            const cancelled = item.cancelledQty ?? 0;
            const maxAllowed = item.pendingQty !== undefined ? item.pendingQty : Math.max(0, ordered - delivered - cancelled);
            if (it.dispatchQty > maxAllowed) {
                toast.error(`Cannot dispatch ${it.dispatchQty} for ${item.product?.name ?? 'item'}. Max pending is ${maxAllowed}.`);
                return;
            }
        }

        orderAction.mutate({
            id: order.id,
            action: "dispatch",
            data: {
                items: itemsToDispatch,
                trackingNumber: trackingNumber || undefined,
                vehicleNumber: vehicleNumber || undefined,
            },
        }, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)] z-10">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-playfair)" }}>
                            <Truck size={18} className="text-[var(--gold)]" /> Dispatch Batch / Partial Delivery
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">Order {order.orderNumber} • Select SKU quantities to fulfill</p>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition text-xl">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {pendingItems.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-muted)]">
                            <CheckCircle size={32} className="mx-auto text-[var(--green-bright)] mb-2" />
                            All items for this order have already been dispatched or delivered.
                        </div>
                    ) : (
                        <>
                            <div className="border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-[var(--bg-secondary)] text-[var(--text-muted)] text-xs uppercase">
                                            <th className="text-left p-3">Product</th>
                                            <th className="text-center p-3">Ordered</th>
                                            <th className="text-center p-3">Fulfilled</th>
                                            <th className="text-center p-3">Pending</th>
                                            <th className="text-right p-3 w-28">Dispatch Now</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingItems.map((item: any) => {
                                            const ordered = item.orderedQty ?? item.quantity;
                                            const delivered = item.deliveredQty ?? 0;
                                            const cancelled = item.cancelledQty ?? 0;
                                            const pending = item.pendingQty !== undefined ? item.pendingQty : Math.max(0, ordered - delivered - cancelled);
                                            const currentVal = dispatchQuantities[item.id] ?? 0;

                                            return (
                                                <tr key={item.id} className="border-t border-[var(--border)]">
                                                    <td className="p-3 font-medium">
                                                        {item.product?.name ?? item.productId}
                                                        <span className="text-xs text-[var(--text-muted)] block">{item.unit}</span>
                                                    </td>
                                                    <td className="p-3 text-center text-[var(--text-secondary)] font-mono">{ordered}</td>
                                                    <td className="p-3 text-center text-[var(--green-bright)] font-mono">{delivered}</td>
                                                    <td className="p-3 text-center font-bold text-[var(--orange)] font-mono">{pending}</td>
                                                    <td className="p-3">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={pending}
                                                            value={currentVal}
                                                            onChange={(e) => {
                                                                const val = Math.min(pending, Math.max(0, Number(e.target.value) || 0));
                                                                setDispatchQuantities({ ...dispatchQuantities, [item.id]: val });
                                                            }}
                                                            className="w-full text-right px-2.5 py-1.5 text-sm font-semibold rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none font-mono"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="text-xs text-[var(--text-muted)] block mb-1">Vehicle / Courier Details</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. MH-12-AB-1234 or BlueDart"
                                        value={vehicleNumber}
                                        onChange={(e) => setVehicleNumber(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--text-muted)] block mb-1">Tracking / Docket No.</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. TRK987654"
                                        value={trackingNumber}
                                        onChange={(e) => setTrackingNumber(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none"
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-[var(--bg-secondary)]/60 rounded-[var(--radius-md)] border border-[var(--border)] text-xs text-[var(--text-muted)] flex items-start gap-2">
                                <AlertCircle size={14} className="text-[var(--gold)] mt-0.5 shrink-0" />
                                <div>
                                    If any items have pending balance after this dispatch, the order will transition to <strong className="text-[var(--gold)]">PARTIALLY_DELIVERED</strong>. Once all items are fully dispatched, status transitions to <strong className="text-[var(--green-bright)]">DELIVERED</strong>.
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
                                <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={orderAction.isPending || totalToDispatch <= 0}
                                    className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition flex items-center gap-2"
                                >
                                    <Truck size={14} />
                                    {orderAction.isPending ? "Dispatching..." : `Confirm Dispatch (${totalToDispatch} Units)`}
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}

/* ─── Granular Customer Return Modal ─── */
function ReturnModal({ order, open, onClose }: { order: any; open: boolean; onClose: () => void }) {
    const orderAction = useOrderAction();
    const [returnItems, setReturnItems] = useState<Record<string, { qty: number; condition: 'RESTOCKABLE' | 'DAMAGED' }>>({});
    const [reason, setReason] = useState("");

    // Initialize with returnable items: deliveredQty - returnedQty
    useEffect(() => {
        if (order && open) {
            const initial: Record<string, { qty: number; condition: 'RESTOCKABLE' | 'DAMAGED' }> = {};
            (order.items ?? []).forEach((item: any) => {
                const delivered = item.deliveredQty ?? 0;
                const returned = item.returnedQty ?? 0;
                const maxReturnable = Math.max(0, delivered - returned);
                if (maxReturnable > 0) {
                    initial[item.id] = { qty: 0, condition: 'RESTOCKABLE' };
                }
            });
            setReturnItems(initial);
            setReason("");
        }
    }, [order, open]);

    if (!open) return null;

    const returnableItems = (order.items ?? []).filter((item: any) => {
        const delivered = item.deliveredQty ?? 0;
        const returned = item.returnedQty ?? 0;
        return (delivered - returned) > 0;
    });

    const totalToReturn = Object.values(returnItems).reduce((s, i) => s + (Number(i.qty) || 0), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payloadItems = Object.entries(returnItems)
            .filter(([_, data]) => Number(data.qty) > 0)
            .map(([orderItemId, data]) => ({
                orderItemId,
                quantity: Number(data.qty),
                condition: data.condition,
            }));

        if (payloadItems.length === 0) {
            toast.error("Please enter a return quantity greater than 0 for at least one item.");
            return;
        }

        // Validate on client: returnQty <= (deliveredQty - returnedQty)
        for (const pi of payloadItems) {
            const item = order.items.find((i: any) => i.id === pi.orderItemId);
            const delivered = item.deliveredQty ?? 0;
            const returned = item.returnedQty ?? 0;
            const maxReturnable = Math.max(0, delivered - returned);
            if (pi.quantity > maxReturnable) {
                toast.error(`Return quantity (${pi.quantity}) exceeds delivered balance (${maxReturnable}) for ${item.product?.name ?? 'item'}.`);
                return;
            }
        }

        orderAction.mutate({
            id: order.id,
            action: "return",
            data: {
                reason: reason || "Customer Return",
                items: payloadItems,
            },
        }, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)] z-10">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-playfair)" }}>
                            <RotateCcw size={18} className="text-[var(--red)]" /> Create Customer Return & Credit Note
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">Order {order.orderNumber} • Return delivered stock and adjust ledger</p>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition text-xl">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {returnableItems.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-muted)]">
                            No delivered items available to return for this order.
                        </div>
                    ) : (
                        <>
                            <div className="border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-[var(--bg-secondary)] text-[var(--text-muted)] text-xs uppercase">
                                            <th className="text-left p-3">Product</th>
                                            <th className="text-center p-3">Delivered</th>
                                            <th className="text-center p-3">Returned</th>
                                            <th className="text-right p-3 w-24">Return Qty</th>
                                            <th className="text-center p-3 w-36">Condition</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {returnableItems.map((item: any) => {
                                            const delivered = item.deliveredQty ?? 0;
                                            const returned = item.returnedQty ?? 0;
                                            const maxReturnable = Math.max(0, delivered - returned);
                                            const current = returnItems[item.id] ?? { qty: 0, condition: 'RESTOCKABLE' };

                                            return (
                                                <tr key={item.id} className="border-t border-[var(--border)]">
                                                    <td className="p-3 font-medium">
                                                        {item.product?.name ?? item.productId}
                                                        <span className="text-xs text-[var(--text-muted)] block">{item.unit}</span>
                                                    </td>
                                                    <td className="p-3 text-center text-[var(--green-bright)] font-mono">{delivered}</td>
                                                    <td className="p-3 text-center text-[var(--red)] font-mono">{returned}</td>
                                                    <td className="p-3">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={maxReturnable}
                                                            value={current.qty}
                                                            onChange={(e) => {
                                                                const val = Math.min(maxReturnable, Math.max(0, Number(e.target.value) || 0));
                                                                setReturnItems({
                                                                    ...returnItems,
                                                                    [item.id]: { ...current, qty: val },
                                                                });
                                                            }}
                                                            className="w-full text-right px-2.5 py-1.5 text-sm font-semibold rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none font-mono"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <select
                                                            value={current.condition}
                                                            onChange={(e) => {
                                                                setReturnItems({
                                                                    ...returnItems,
                                                                    [item.id]: { ...current, condition: e.target.value as 'RESTOCKABLE' | 'DAMAGED' },
                                                                });
                                                            }}
                                                            className="px-2 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none"
                                                        >
                                                            <option value="RESTOCKABLE">Good (Restock)</option>
                                                            <option value="DAMAGED">Damaged (Quarantine)</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div>
                                <label className="text-xs text-[var(--text-muted)] block mb-1">Reason for Return</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={2}
                                    placeholder="e.g. Damaged during transit, wrong SKU, or customer cancelled partial delivery"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none resize-none"
                                />
                            </div>

                            <div className="p-3 bg-[var(--bg-secondary)]/60 rounded-[var(--radius-md)] border border-[var(--border)] text-xs text-[var(--text-muted)] flex items-start gap-2">
                                <AlertCircle size={14} className="text-[var(--gold)] mt-0.5 shrink-0" />
                                <div>
                                    Items marked <strong className="text-[var(--green-bright)]">Good (Restock)</strong> will immediately increment sellable inventory. Items marked <strong className="text-[var(--red)]">Damaged</strong> will be logged under quarantine stock. A Credit Note will be issued and deducted from the customer's outstanding balance.
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
                                <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={orderAction.isPending || totalToReturn <= 0}
                                    className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--red)] text-white hover:bg-[var(--red)]/90 disabled:opacity-50 transition flex items-center gap-2"
                                >
                                    <RotateCcw size={14} />
                                    {orderAction.isPending ? "Processing Return..." : `Confirm Return (${totalToReturn} Units)`}
                                </button>
                            </div>
                        </>
                    )}
                </form>
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
    const [showDispatch, setShowDispatch] = useState(false);
    const [showReturn, setShowReturn] = useState(false);

    if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-[var(--radius-md)]" />)}</div>;
    if (!order) return <div className="text-center py-20"><p className="text-[var(--text-muted)]">Order not found</p></div>;

    // Check line items state
    const items = order.items ?? [];
    const hasPendingItems = items.some((it: any) => {
        const ordered = it.orderedQty ?? it.quantity;
        const delivered = it.deliveredQty ?? 0;
        const cancelled = it.cancelledQty ?? 0;
        const pending = it.pendingQty !== undefined ? it.pendingQty : Math.max(0, ordered - delivered - cancelled);
        return pending > 0;
    });
    const hasDeliveredItems = items.some((it: any) => {
        const delivered = it.deliveredQty ?? 0;
        const returned = it.returnedQty ?? 0;
        return (delivered - returned) > 0;
    });

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
                <div className="flex gap-2 flex-wrap items-center">
                    {order.status === "DRAFT" && (
                        <>
                            <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10 font-semibold transition">
                                <Edit size={14} /> Edit Order
                            </button>
                            <button onClick={() => orderAction.mutate({ id, action: "confirm" })} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition">
                                <CheckCircle size={14} /> Confirm Order
                            </button>
                            <button onClick={() => { if (window.confirm("Cancel this draft order?")) orderAction.mutate({ id, action: "cancel" }); }} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--red)] hover:bg-[var(--red)]/10 transition">
                                <XCircle size={14} /> Cancel
                            </button>
                        </>
                    )}

                    {order.status === "CONFIRMED" && (
                        <>
                            <button onClick={() => orderAction.mutate({ id, action: "pack" })} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition">
                                <Package size={14} /> Mark Packed
                            </button>
                            <button onClick={() => setShowDispatch(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10 font-semibold transition">
                                <Truck size={14} /> Dispatch Batch
                            </button>
                            <button onClick={() => { if (window.confirm("Cancel this confirmed order and release reserved stock?")) orderAction.mutate({ id, action: "cancel" }); }} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--red)] hover:bg-[var(--red)]/10 transition">
                                <XCircle size={14} /> Cancel
                            </button>
                        </>
                    )}

                    {order.status === "PACKED" && (
                        <>
                            <button onClick={() => setShowDispatch(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition">
                                <Truck size={14} /> Dispatch Items
                            </button>
                            <button onClick={() => { if (window.confirm("Cancel this order?")) orderAction.mutate({ id, action: "cancel" }); }} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--red)] hover:bg-[var(--red)]/10 transition">
                                <XCircle size={14} /> Cancel
                            </button>
                        </>
                    )}

                    {order.status === "PARTIALLY_DELIVERED" && (
                        <>
                            {hasPendingItems && (
                                <button onClick={() => setShowDispatch(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition">
                                    <Truck size={14} /> Dispatch Remaining ({items.filter((it: any) => (it.pendingQty ?? 0) > 0).length} SKUs)
                                </button>
                            )}
                            {hasDeliveredItems && (
                                <button onClick={() => setShowReturn(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                                    <RotateCcw size={14} /> Create Return
                                </button>
                            )}
                        </>
                    )}

                    {order.status === "DISPATCHED" && (
                        <>
                            <button onClick={() => orderAction.mutate({ id, action: "deliver" })} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition">
                                <MapPin size={14} /> Mark Delivered
                            </button>
                            {hasDeliveredItems && (
                                <button onClick={() => setShowReturn(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                                    <RotateCcw size={14} /> Create Return
                                </button>
                            )}
                        </>
                    )}

                    {(order.status === "DELIVERED" || order.status === "COMPLETED" || order.status === "PARTIALLY_RETURNED") && (
                        <>
                            {hasPendingItems && (
                                <button onClick={() => setShowDispatch(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition">
                                    <Truck size={14} /> Dispatch Remaining
                                </button>
                            )}
                            {hasDeliveredItems && (
                                <button onClick={() => setShowReturn(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                                    <RotateCcw size={14} /> Create Return
                                </button>
                            )}
                        </>
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
                            <Send size={14} /> Send WhatsApp
                        </a>
                    )}
                </div>
            </div>

            {/* ── Order Fulfillment Stepper ── */}
            {(() => {
                const STEPS = ["DRAFT", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"];
                const isCancelled = order.status === "CANCELLED" || order.status === "RETURNED";
                const isPartiallyReturned = order.status === "PARTIALLY_RETURNED";

                let currentIdx = STEPS.indexOf(order.status as string);
                if (order.status === "PARTIALLY_DELIVERED") currentIdx = 3; // at dispatch/delivery stage
                if (order.status === "COMPLETED") currentIdx = 4; // completed is at delivered

                const stepIcons: Record<string, React.ElementType> = {
                    DRAFT: Clock,
                    CONFIRMED: CheckCircle,
                    PACKED: Package,
                    DISPATCHED: Truck,
                    DELIVERED: MapPin
                };

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
                        {isPartiallyReturned && (
                            <div className="mb-4 p-2.5 rounded bg-[var(--gold)]/10 border border-[var(--gold)]/20 text-xs text-[var(--gold)] flex items-center gap-2">
                                <AlertCircle size={14} /> This order has partial returns recorded. Credit notes have been issued.
                            </div>
                        )}
                        <div className="flex items-center justify-between relative">
                            <div className="absolute top-4 left-0 right-0 h-0.5 bg-[var(--border)]" style={{ left: '10%', right: '10%' }} />
                            <div className="absolute top-4 left-0 h-0.5 bg-[var(--gold)] transition-all duration-500" style={{ left: '10%', width: currentIdx >= 0 ? `${Math.min((currentIdx / (STEPS.length - 1)) * 80, 80)}%` : '0%' }} />

                            {STEPS.map((step, idx) => {
                                const StepIcon = stepIcons[step] ?? Clock;
                                const isComplete = idx < currentIdx;
                                const isCurrent = idx === currentIdx;

                                return (
                                    <div key={step} className="flex flex-col items-center z-10 relative" style={{ width: '20%' }}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isComplete ? 'bg-[var(--gold)] text-[var(--bg-primary)] shadow-[0_0_12px_rgba(234,179,8,0.3)]' :
                                            isCurrent ? 'bg-[var(--gold)]/20 text-[var(--gold)] border-2 border-[var(--gold)] shadow-[0_0_16px_rgba(234,179,8,0.25)]' :
                                                'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]'
                                            }`}>
                                            {isComplete ? <CheckCircle size={16} /> : <StepIcon size={14} />}
                                        </div>
                                        <span className={`mt-2 text-[10px] font-semibold uppercase tracking-wider ${isCurrent ? 'text-[var(--gold)]' : isComplete ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
                                            }`}>
                                            {step === "DISPATCHED" && order.status === "PARTIALLY_DELIVERED" ? "PARTIAL DISPATCH" : step}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            <div className="grid lg:grid-cols-10 gap-6">
                {/* Left: Granular Line Items */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                            <h3 className="font-semibold text-sm">Line Items & Fulfillment Balance</h3>
                            {hasPendingItems && order.status !== "DRAFT" && order.status !== "CANCELLED" && (
                                <button onClick={() => setShowDispatch(true)} className="text-xs text-[var(--gold)] hover:underline flex items-center gap-1 font-medium">
                                    <Truck size={12} /> Dispatch Partial Batch
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                        <th className="text-left p-3.5">Product</th>
                                        <th className="text-center p-3.5">Ordered</th>
                                        <th className="text-center p-3.5">Delivered</th>
                                        <th className="text-center p-3.5">Pending</th>
                                        <th className="text-right p-3.5">Rate</th>
                                        <th className="text-right p-3.5">Tax</th>
                                        <th className="text-right p-3.5">Total</th>
                                        <th className="text-center p-3.5">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item: any) => {
                                        const ordered = item.orderedQty ?? item.quantity;
                                        const delivered = item.deliveredQty ?? 0;
                                        const returned = item.returnedQty ?? 0;
                                        const cancelled = item.cancelledQty ?? 0;
                                        const pending = item.pendingQty !== undefined ? item.pendingQty : Math.max(0, ordered - delivered - cancelled);

                                        let lineStatusBadge = "badge-draft";
                                        let lineStatusLabel = "Pending";
                                        if (returned > 0 && returned >= delivered) {
                                            lineStatusBadge = "badge-cancelled";
                                            lineStatusLabel = "Returned";
                                        } else if (pending === 0 && delivered > 0) {
                                            lineStatusBadge = "badge-delivered";
                                            lineStatusLabel = "Fulfilled";
                                        } else if (delivered > 0 && pending > 0) {
                                            lineStatusBadge = "badge-partial";
                                            lineStatusLabel = "Partial";
                                        }

                                        return (
                                            <tr key={item.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                                <td className="p-3.5">
                                                    <p className="font-medium text-sm">{(item.product as any)?.name ?? item.productId}</p>
                                                    <p className="text-xs text-[var(--text-muted)]">{item.unit}</p>
                                                </td>
                                                <td className="p-3.5 text-center font-mono font-medium">{ordered}</td>
                                                <td className="p-3.5 text-center font-mono font-bold text-[var(--green-bright)]">
                                                    {delivered}
                                                    {returned > 0 && <span className="text-xs text-[var(--red)] block">(-{returned})</span>}
                                                </td>
                                                <td className="p-3.5 text-center font-mono font-bold text-[var(--orange)]">{pending}</td>
                                                <td className="p-3.5 text-right font-mono text-[var(--text-secondary)]">{formatINR(item.price)}</td>
                                                <td className="p-3.5 text-right font-mono text-[var(--text-muted)]">{formatINR(item.taxAmount ?? 0)}</td>
                                                <td className="p-3.5 text-right font-mono font-semibold">{formatINR(item.totalAmount)}</td>
                                                <td className="p-3.5 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${lineStatusBadge}`}>
                                                        {lineStatusLabel}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-[var(--border)] space-y-1 text-sm text-right bg-[var(--bg-secondary)]/20">
                            <p className="text-[var(--text-secondary)]">Subtotal: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(order.totalAmount)}</span></p>
                            <p className="text-[var(--text-secondary)]">Discount: <span style={{ fontFamily: "var(--font-mono)" }}>-{formatINR(order.discountAmount)}</span></p>
                            <p className="text-[var(--text-secondary)]">GST: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(order.taxAmount)}</span></p>
                            <p className="font-bold text-base">Net Total: <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(order.netAmount)}</span></p>
                            {order.balanceAmount !== undefined && (
                                <p className="text-xs text-[var(--text-muted)] pt-1">
                                    Invoice Balance: <strong className="font-mono text-[var(--gold)]">{formatINR(order.balanceAmount)}</strong>
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Customer + Activity Timeline */}
                <div className="lg:col-span-3 space-y-4">
                    {order.customer && (
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                            <h3 className="text-xs uppercase text-[var(--text-muted)] tracking-wider mb-3">Customer</h3>
                            <p className="font-semibold mb-1">{order.customer.name}</p>
                            <p className="text-sm text-[var(--text-secondary)]">{order.customer.phone}</p>
                            {order.customer.outstandingAmount > 0 && (
                                <div className="mt-3 p-2 rounded-md bg-[var(--red)]/8 border border-[var(--red)]/15 text-xs text-[var(--red)] font-mono">
                                    Outstanding: {formatINR(order.customer.outstandingAmount)}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                        <h3 className="text-xs uppercase text-[var(--text-muted)] tracking-wider mb-3">Audit Trail</h3>
                        <div className="space-y-3">
                            {(order.statusHistory ?? []).map((h: Record<string, unknown>, i: number) => (
                                <div key={i} className="flex gap-3 text-sm">
                                    <div className="flex flex-col items-center">
                                        <div className="w-2 h-2 rounded-full bg-[var(--gold)] mt-1.5" />
                                        {i < (order.statusHistory?.length ?? 0) - 1 && <div className="w-px flex-1 bg-[var(--border)]" />}
                                    </div>
                                    <div className="pb-3">
                                        <p className="font-medium text-xs">{h.toStatus as string}</p>
                                        {Boolean(h.note) && <p className="text-[11px] text-[var(--text-muted)] italic">{String(h.note)}</p>}
                                        <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                                            <Clock size={10} />{formatDateTime(h.createdAt as string)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <EditDraftModal order={order} open={showEdit} onClose={() => setShowEdit(false)} />
            <DispatchModal order={order} open={showDispatch} onClose={() => setShowDispatch(false)} />
            <ReturnModal order={order} open={showReturn} onClose={() => setShowReturn(false)} />
        </div>
    );
}
