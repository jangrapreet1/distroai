"use client";
import { formatINR } from "@/lib/utils";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Search, Package, ArrowDownAZ, ArrowUpZA } from "lucide-react";
import Link from "next/link";
import { useCreateOrder, useCustomers, useProducts, useWarehouses } from "@/hooks/api-hooks";
import { AddCustomerModal } from "@/components/AddCustomerModal";


interface OrderItem {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    price: number;
    discount: number;
    taxRate: number;
    stock: number;
}

export default function NewOrderPage() {
    const router = useRouter();
    const createOrder = useCreateOrder();
    const [orderType, setOrderType] = useState<"B2B" | "B2C">("B2B");

    const [customerId, setCustomerId] = useState("");
    const [customerSearch, setCustomerSearch] = useState("");
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [customerSort, setCustomerSort] = useState<"asc" | "desc">("asc");

    const { data: whData } = useWarehouses();
    const warehouses = Array.isArray(whData) ? whData : (whData?.data ?? []);

    const [warehouseId, setWarehouseId] = useState("");
    const [notes, setNotes] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");
    const [items, setItems] = useState<OrderItem[]>([]);
    const [productSearch, setProductSearch] = useState("");
    const [showProductPicker, setShowProductPicker] = useState(false);

    // Only pass search if it has actual text, otherwise pass undefined so we fetch all customers
    const { data: customersData } = useCustomers({ search: customerSearch.trim() || undefined, limit: 100 });
    const customersRaw = customersData?.data ?? [];
    const customers = useMemo(() => {
        const list = [...customersRaw];
        list.sort((a: any, b: any) => {
            const nameA = (a.name as string ?? "").toLowerCase();
            const nameB = (b.name as string ?? "").toLowerCase();
            return customerSort === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
        return list;
    }, [customersRaw, customerSort]);

    const { data: prodData } = useProducts({ limit: 100, isActive: true });
    const products = prodData?.data?.data ?? prodData?.data ?? [];

    useEffect(() => {
        if (warehouses.length === 1 && !warehouseId) setWarehouseId(warehouses[0].id);
    }, [warehouses, warehouseId]);

    const handleAddItem = (product: Record<string, unknown>) => {
        const existing = items.find((i) => i.productId === product.id);
        if (existing) {
            setItems(items.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
            setItems([...items, {
                productId: product.id as string,
                productName: product.name as string,
                quantity: 1,
                unit: (product.unit as string) ?? "Pieces",
                price: (product.sellingPrice as number) ?? 0,
                discount: 0,
                taxRate: (product.gstRate as number) ?? 0,
                stock: (product.totalQuantity as number) ?? 0,
            }]);
        }
        setShowProductPicker(false);
        setProductSearch("");
    };

    const updateItem = (idx: number, key: keyof OrderItem, value: string | number) => {
        setItems(items.map((item, i) => i === idx ? { ...item, [key]: value } : item));
    };

    const removeItem = (idx: number) => {
        setItems(items.filter((_, i) => i !== idx));
    };

    // ── Price Math ──
    // B2B: price is the base taxable price → tax is added on top
    // B2C: price is what the end customer pays (inclusive of GST) → we back-calculate
    const subtotal = useMemo(() => {
        const raw = items.reduce((s, i) => {
            if (orderType === "B2C") {
                // Back-calculate taxable value: taxable = inclusive / (1 + rate/100)
                const taxable = i.price / (1 + i.taxRate / 100);
                return s + (taxable * i.quantity) - i.discount;
            }
            return s + (i.price * i.quantity) - i.discount;
        }, 0);
        return Math.round(raw * 100) / 100;
    }, [items, orderType]);

    const taxTotal = useMemo(() => {
        const raw = items.reduce((s, i) => {
            if (orderType === "B2C") {
                const taxable = i.price / (1 + i.taxRate / 100);
                const lineBase = (taxable * i.quantity) - i.discount;
                return s + (lineBase * i.taxRate / 100);
            }
            const lineTotal = (i.price * i.quantity) - i.discount;
            return s + (lineTotal * i.taxRate / 100);
        }, 0);
        return Math.round(raw * 100) / 100;
    }, [items, orderType]);

    // Grand Total:
    //   B2B → subtotal + taxTotal (base price + tax on top)
    //   B2C → simply the sum of what the customer pays (price × qty − discount)
    const grandTotal = useMemo(() => {
        if (orderType === "B2C") {
            return Math.round(items.reduce((s, i) => s + (i.price * i.quantity) - i.discount, 0) * 100) / 100;
        }
        return Math.round((subtotal + taxTotal) * 100) / 100;
    }, [items, orderType, subtotal, taxTotal]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId || items.length === 0) return;

        const payload: Record<string, unknown> = {
            customerId,
            warehouseId: warehouseId || undefined,
            source: "WEB",
            notes: notes || undefined,
            deliveryDate: deliveryDate || undefined,
            items: items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unit: i.unit,
                price: orderType === "B2C" ? parseFloat((i.price / (1 + i.taxRate / 100)).toFixed(2)) : i.price,
                discount: i.discount,
            })),
        };

        // Remove warehouseId if empty — let the backend pick the default
        if (!payload.warehouseId) delete payload.warehouseId;

        createOrder.mutate(payload, {
            onSuccess: () => router.push("/orders"),
        });
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <Link href="/orders" className="p-2 rounded-lg hover:bg-[var(--bg-card)] transition">
                        <ArrowLeft size={18} className="text-[var(--text-muted)]" />
                    </Link>
                    <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>New Order</h1>
                </div>

                <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-1 w-full sm:w-64">
                    <button
                        onClick={() => setOrderType("B2B")}
                        className={`flex-1 py-1.5 text-sm font-semibold rounded transition ${orderType === "B2B" ? "bg-[var(--gold)]/10 text-[var(--gold)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                    >
                        B2B (GST Breakup)
                    </button>
                    <button
                        onClick={() => setOrderType("B2C")}
                        className={`flex-1 py-1.5 text-sm font-semibold rounded transition ${orderType === "B2C" ? "bg-[var(--gold)]/10 text-[var(--gold)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                    >
                        B2C (Final Price)
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Selection */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Customer</h3>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            value={customerSearch}
                            onChange={(e) => { setCustomerSearch(e.target.value); setCustomerId(""); setShowCustomerDropdown(true); }}
                            onFocus={() => { if (!customerId) setShowCustomerDropdown(true); }}
                            placeholder="Click to browse or type to search customers..."
                            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition"
                        />
                    </div>
                    {showCustomerDropdown && !customerId && (
                        <div className="mt-2 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden max-h-72">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-card)]">
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">{customers.length} customers</span>
                                <button type="button" onClick={() => setCustomerSort(customerSort === "asc" ? "desc" : "asc")}
                                    className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--gold)] transition">
                                    {customerSort === "asc" ? <ArrowDownAZ size={14} /> : <ArrowUpZA size={14} />}
                                    {customerSort === "asc" ? "A → Z" : "Z → A"}
                                </button>
                            </div>
                            {customers.length === 0 ? (
                                <p className="p-3 text-sm text-[var(--text-muted)] text-center">No customers found</p>
                            ) : (
                                <div className="overflow-y-auto">
                                    {customers.map((c: Record<string, unknown>) => (
                                        <button
                                            key={c.id as string}
                                            type="button"
                                            onClick={() => {
                                                setCustomerId(c.id as string);
                                                setCustomerSearch(c.name as string);
                                                setShowCustomerDropdown(false);
                                                if (c.type === "INDIVIDUAL") {
                                                    setOrderType("B2C");
                                                } else {
                                                    setOrderType("B2B");
                                                }
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-card-hover)] transition flex items-center justify-between"
                                        >
                                            <span className="font-medium">{c.name as string}</span>
                                            <span className="text-xs text-[var(--text-muted)]">{c.phone as string ?? ""}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="p-2 border-t border-[var(--border)] bg-[var(--bg-card)]">
                                <button
                                    type="button"
                                    onClick={() => setShowAddCustomer(true)}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/10 rounded-[var(--radius-md)] transition"
                                >
                                    <Plus size={16} /> New Customer
                                </button>
                            </div>
                        </div>
                    )}
                    {customerId && (
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-xs text-[var(--green-bright)]">✓ Customer selected</p>
                            <button type="button" onClick={() => { setCustomerId(""); setCustomerSearch(""); setShowCustomerDropdown(true); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--red)] transition">Change</button>
                        </div>
                    )}
                </div>

                {/* Items */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Order Items</h3>
                        <button
                            type="button"
                            onClick={() => setShowProductPicker(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--gold)]/15 text-[var(--gold)] hover:bg-[var(--gold)]/25 transition font-medium"
                        >
                            <Plus size={14} /> Add Product
                        </button>
                    </div>

                    {/* Product Picker Modal */}
                    {showProductPicker && (
                        <div className="mb-4 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)] p-3">
                            <div className="relative mb-3">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                <input
                                    autoFocus
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    placeholder="Search products..."
                                    className="w-full pl-9 pr-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {(Array.isArray(products) ? products : []).filter((p: Record<string, unknown>) =>
                                    !productSearch || (p.name as string).toLowerCase().includes(productSearch.toLowerCase()) || (p.sku as string).toLowerCase().includes(productSearch.toLowerCase())
                                ).map((p: Record<string, unknown>) => (
                                    <button
                                        key={p.id as string}
                                        type="button"
                                        onClick={() => handleAddItem(p)}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-card-hover)] rounded-lg transition flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Package size={14} className="text-[var(--text-muted)]" />
                                            <span className="font-medium">{p.name as string}</span>
                                            <span className="text-xs text-[var(--text-muted)]">SKU: {p.sku as string}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${((p.totalQuantity as number) ?? 0) > 0 ? 'bg-[var(--green-bright)]/10 text-[var(--green-bright)]' : 'bg-[var(--red)]/10 text-[var(--red)]'}`}>
                                                {((p.totalQuantity as number) ?? 0)} in stock
                                            </span>
                                            <span className="text-sm font-medium" style={{ fontFamily: "var(--font-mono)" }}>{formatINR((p.sellingPrice as number) ?? 0)}</span>
                                        </div>
                                    </button>
                                ))}
                                {(Array.isArray(products) ? products : []).length === 0 && (
                                    <p className="p-3 text-sm text-[var(--text-muted)] text-center">No products found</p>
                                )}
                            </div>
                            <button type="button" onClick={() => { setShowProductPicker(false); setProductSearch(""); }} className="mt-2 w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition text-center py-1">
                                Close
                            </button>
                        </div>
                    )}

                    {/* Items Table */}
                    {items.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                        <th className="text-left py-2">Product</th>
                                        <th className="text-center py-2 w-24">Qty</th>
                                        <th className="text-right py-2 w-28">Price</th>
                                        <th className="text-right py-2 w-24">Discount</th>
                                        <th className="text-right py-2 w-28">Total</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={item.productId} className="border-b border-[var(--border)]">
                                            <td className="py-3 font-medium">{item.productName}</td>
                                            <td className="py-3 text-center">
                                                <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                                                    className="w-20 text-center px-2 py-1 text-sm rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none" />
                                            </td>
                                            <td className="py-3 text-right">
                                                <input type="number" min={0} step={0.01} value={item.price} onChange={(e) => updateItem(idx, "price", Number(e.target.value))}
                                                    className="w-24 text-right px-2 py-1 text-sm rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none" />
                                            </td>
                                            <td className="py-3 text-right">
                                                <input type="number" min={0} step={0.01} value={item.discount} onChange={(e) => updateItem(idx, "discount", Number(e.target.value))}
                                                    className="w-20 text-right px-2 py-1 text-sm rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none" />
                                            </td>
                                            <td className="py-3 text-right font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                                                {formatINR(item.price * item.quantity - item.discount)}
                                            </td>
                                            <td className="py-3 text-center">
                                                <button type="button" onClick={() => removeItem(idx)} className="text-[var(--red)] hover:text-[var(--red)]/80 transition">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="flex justify-end mt-3 pt-3 border-t border-[var(--border)]">
                                <div className="w-64 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--text-muted)]">Subtotal</span>
                                        <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--text-muted)]">Estimated Tax</span>
                                        <span className="text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(taxTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold pt-2 border-t border-[var(--border)]">
                                        <span>Grand Total</span>
                                        <span className="text-[var(--gold)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(grandTotal)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-[var(--text-muted)]">
                            <Package size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No items added yet</p>
                            <p className="text-xs mt-1">Click &quot;Add Product&quot; to start building the order</p>
                        </div>
                    )}
                </div>

                {/* Additional Details */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Additional Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Warehouse</span>
                            <select
                                value={warehouseId}
                                onChange={(e) => setWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition appearance-none"
                            >
                                <option value="">Select Warehouse</option>
                                {warehouses.map((w: any) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Delivery Date</span>
                            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label className="col-span-2">
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Notes</span>
                            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition resize-none" />
                        </label>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center">
                    <Link href="/orders" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
                        ← Back to Orders
                    </Link>
                    <div className="flex gap-3">
                        <button type="submit" disabled={!customerId || items.length === 0 || createOrder.isPending}
                            className="px-6 py-2.5 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition disabled:opacity-40">
                            {createOrder.isPending ? "Creating..." : "Create Order"}
                        </button>
                    </div>
                </div>
            </form>

            <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
        </div>
    );
}
