"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePurchaseOrder, useReceivePurchaseOrder } from "@/hooks/api-hooks";
import { ArrowLeft, CheckCircle2, ChevronDown, Package } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { toast } from "react-hot-toast";

const statusClass: Record<string, string> = { DRAFT: "badge-draft", SENT: "badge-sent", ACKNOWLEDGED: "badge-partial", RECEIVED: "badge-delivered", CANCELLED: "badge-cancelled" };

function formatINR(n: number): string { return "₹" + n.toLocaleString("en-IN"); }

export default function PurchaseOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const poId = params.id as string;

    const { data: po, isLoading } = usePurchaseOrder(poId);
    const receivePo = useReceivePurchaseOrder();

    const [receiving, setReceiving] = useState(false);
    const [receiveData, setReceiveData] = useState<Record<string, { qty: number, batchNumber: string, expiryDate: string }>>({});

    if (isLoading) return <div className="p-12 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-[var(--gold)] border-t-transparent animate-spin"></div></div>;
    if (!po) return <div className="p-12 text-center text-[var(--test-muted)]">Purchase Order not found.</div>;

    const handleReceiveToggle = () => {
        if (!receiving) {
            // Initialize with remaining quantities
            const initial: typeof receiveData = {};
            po.items.forEach((item: any) => {
                const remaining = item.orderedQty - item.receivedQty;
                if (remaining > 0) {
                    initial[item.id] = { qty: remaining, batchNumber: "", expiryDate: "" };
                }
            });
            setReceiveData(initial);
        }
        setReceiving(!receiving);
    };

    const handleReceiveSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const items = Object.entries(receiveData)
            .filter(([_, data]) => data.qty > 0)
            .map(([poItemId, data]) => ({
                poItemId,
                receivedQty: data.qty,
                batchNumber: data.batchNumber || undefined,
                expiryDate: data.expiryDate || undefined
            }));

        if (items.length === 0) return toast.error("No quantities specified to receive");

        receivePo.mutate({ id: po.id, data: { items } }, {
            onSuccess: () => {
                setReceiving(false);
            }
        });
    };

    const allReceived = po.items.every((i: any) => i.receivedQty >= i.orderedQty);

    return (
        <div className="max-w-5xl mx-auto pb-12">
            <div className="flex items-center gap-3 mb-6">
                <Link href="/purchase-orders" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>PO {po.poNumber}</h1>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClass[po.status] ?? "badge-draft"}`}>
                        {po.status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Details & Items */}
                <div className="lg:col-span-2 space-y-6">
                    {/* General Details */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                        <h2 className="font-semibold text-[var(--text-primary)] mb-4">Order Details</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-xs text-[var(--text-muted)] mb-1">Date</p>
                                <p className="text-sm font-medium">{formatDate(po.createdAt)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--text-muted)] mb-1">Expected Delivery</p>
                                <p className="text-sm font-medium">{po.expectedDate ? formatDate(po.expectedDate) : "—"}</p>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-xs text-[var(--text-muted)] mb-1">Supplier</p>
                                <p className="text-sm font-medium">{po.supplier?.name}</p>
                            </div>
                        </div>
                        {po.notes && (
                            <div className="mt-4 pt-4 border-t border-[var(--border)]">
                                <p className="text-xs text-[var(--text-muted)] mb-1">Notes</p>
                                <p className="text-sm">{po.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Items List */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                        <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
                            <h2 className="font-semibold text-[var(--text-primary)]">Ordered Items</h2>
                            {!allReceived && po.status !== "CANCELLED" && (
                                <button
                                    onClick={handleReceiveToggle}
                                    className="text-sm font-medium text-[var(--gold)] hover:text-[var(--gold-light)] flex items-center gap-1.5 transition"
                                >
                                    <Package size={16} /> {receiving ? "Cancel Receiving" : "Receive Stock"}
                                </button>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                        <th className="text-left p-4">Product</th>
                                        <th className="text-right p-4">Price</th>
                                        <th className="text-center p-4">Ordered</th>
                                        <th className="text-center p-4">Received</th>
                                        <th className="text-right p-4">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {po.items.map((item: any) => {
                                        const p = item.product;
                                        const hasSecondary = p.secondaryUnit && p.conversionFactor;
                                        return (
                                            <tr key={item.id} className="border-b border-[var(--border)]">
                                                <td className="p-4">
                                                    <p className="font-medium">{p.name}</p>
                                                    <p className="text-xs text-[var(--text-muted)]">
                                                        SKU: {p.sku} {hasSecondary && `| 1 ${p.unit} = ${p.conversionFactor} ${p.secondaryUnit}`}
                                                    </p>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div>{formatINR(item.price)}<span className="text-xs text-[var(--text-muted)]">/{p.unit}</span></div>
                                                    {hasSecondary && <div className="text-xs text-[var(--text-muted)]">{formatINR(item.price / p.conversionFactor)}/{p.secondaryUnit}</div>}
                                                </td>
                                                <td className="p-4 text-center font-bold text-[var(--text-primary)]">
                                                    <div>{item.orderedQty} <span className="font-normal text-xs">{p.unit}</span></div>
                                                    {hasSecondary && <div className="text-xs font-normal text-[var(--text-muted)]">{(item.orderedQty * p.conversionFactor).toFixed(2)} {p.secondaryUnit}</div>}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className={`font-bold ${item.receivedQty >= item.orderedQty ? "text-[var(--green-bright)]" : item.receivedQty > 0 ? "text-[var(--orange)]" : "text-[var(--text-muted)]"}`}>
                                                        {item.receivedQty} <span className="font-normal text-xs">{p.unit}</span>
                                                    </div>
                                                    {hasSecondary && <div className="text-xs font-normal text-[var(--text-muted)]">{(item.receivedQty * p.conversionFactor).toFixed(2)} {p.secondaryUnit}</div>}
                                                </td>
                                                <td className="p-4 text-right font-mono font-medium">{formatINR(item.totalAmount)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-[var(--bg-secondary)] p-4 text-right">
                            <span className="text-[var(--text-muted)] text-sm mr-4">Total Amount:</span>
                            <span className="text-lg font-bold text-[var(--gold)] font-mono">{formatINR(po.totalAmount)}</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Receive Form (if active) */}
                <div className="lg:col-span-1">
                    {receiving && (
                        <div className="bg-[var(--bg-card)] border border-[var(--gold)] rounded-[var(--radius-lg)] p-5 sticky top-6">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ fontFamily: "var(--font-playfair)" }}>
                                <CheckCircle2 size={18} className="text-[var(--green-bright)]" />
                                Receive Items
                            </h3>

                            <form onSubmit={handleReceiveSubmit} className="space-y-5">
                                {po.items.map((item: any) => {
                                    const remaining = item.orderedQty - item.receivedQty;
                                    if (remaining <= 0) return null;

                                    return (
                                        <div key={item.id} className="p-3 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] border border-[var(--border)]">
                                            <p className="text-sm font-semibold mb-2 truncate" title={item.product.name}>{item.product.name}</p>
                                            <div className="grid grid-cols-2 flex-col gap-2">
                                                <div>
                                                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Qty (Max {remaining})</span>
                                                    <input
                                                        type="number" min="0" max={remaining}
                                                        value={receiveData[item.id]?.qty ?? 0}
                                                        onChange={(e) => setReceiveData({ ...receiveData, [item.id]: { ...receiveData[item.id], qty: Number(e.target.value) } })}
                                                        className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg-primary)] border border-[var(--border)]"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Batch No.</span>
                                                    <input
                                                        type="text"
                                                        placeholder="Opt"
                                                        value={receiveData[item.id]?.batchNumber ?? ""}
                                                        onChange={(e) => setReceiveData({ ...receiveData, [item.id]: { ...receiveData[item.id], batchNumber: e.target.value } })}
                                                        className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg-primary)] border border-[var(--border)]"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Expiry Date</span>
                                                    <input
                                                        type="date"
                                                        value={receiveData[item.id]?.expiryDate ?? ""}
                                                        onChange={(e) => setReceiveData({ ...receiveData, [item.id]: { ...receiveData[item.id], expiryDate: e.target.value } })}
                                                        className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg-primary)] border border-[var(--border)]"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="pt-2 flex gap-2">
                                    <button
                                        type="button" onClick={() => setReceiving(false)}
                                        className="flex-1 px-4 py-2 text-sm border border-[var(--border)] rounded-[var(--radius-md)] hover:bg-[var(--bg-secondary)] transition"
                                    >Cancel</button>
                                    <button
                                        type="submit" disabled={receivePo.isPending}
                                        className="flex-1 px-4 py-2 text-sm bg-[var(--green-bright)] text-[var(--bg-primary)] font-semibold rounded-[var(--radius-md)] hover:opacity-90 transition disabled:opacity-50"
                                    >
                                        {receivePo.isPending ? "Saving..." : "Confirm Receipt"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
