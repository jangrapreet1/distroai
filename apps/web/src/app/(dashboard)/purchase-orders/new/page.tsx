"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, ArrowLeft, X, Sparkles } from "lucide-react";
import { useCreatePurchaseOrder, useSuppliers, useProducts, useCreateSupplier, useCreateProduct } from "@/hooks/api-hooks";
import Link from "next/link";
import { toast } from "react-hot-toast";
import apiClient from "@/lib/api-client";

function NewPurchaseOrderForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const reorderParam = searchParams?.get("reorder");
    const supplierParam = searchParams?.get("supplierId");

    const createPo = useCreatePurchaseOrder();
    const createSupplier = useCreateSupplier();
    const createProduct = useCreateProduct();

    // Data
    const { data: supData } = useSuppliers(1, 100);
    const { data: prodData } = useProducts({ limit: 100 });
    const suppliers = supData?.data?.data ?? supData?.data ?? [];
    const products = prodData?.data?.data ?? prodData?.data ?? [];

    // State
    const [supplierId, setSupplierId] = useState("");
    const [expectedDate, setExpectedDate] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<{ productId: string; variantId?: string; quantity: number; price: number }[]>([
        { productId: "", quantity: 1, price: 0 }
    ]);
    const [autoLoadedCount, setAutoLoadedCount] = useState<number>(0);
    const [isLoadingLowStock, setIsLoadingLowStock] = useState<boolean>(false);

    // Modals State
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState("");

    // Product Modal State
    const [showProductModal, setShowProductModal] = useState(false);
    const [productIndexToUpdate, setProductIndexToUpdate] = useState<number | null>(null);
    const [newProduct, setNewProduct] = useState({
        name: "", sku: "", unit: "box", secondaryUnit: "", conversionFactor: 1,
        purchasePrice: 0, sellingPrice: 0, mrp: 0, gstRate: 0
    });

    useEffect(() => {
        if (supplierParam) {
            setSupplierId(supplierParam);
        }
    }, [supplierParam]);

    useEffect(() => {
        if (reorderParam === "low-stock" && products.length > 0 && items.length === 1 && !items[0].productId && !isLoadingLowStock) {
            setIsLoadingLowStock(true);
            apiClient.get("/api/v1/inventory/low-stock")
                .then(res => {
                    const lowItems = res.data?.data?.items || res.data?.items || [];
                    if (Array.isArray(lowItems) && lowItems.length > 0) {
                        const populated = lowItems.map((it: any) => {
                            const prod = products.find((p: any) => p.id === it.productId);
                            const purchasePrice = prod?.purchasePrice || (prod?.mrp ? prod.mrp * 0.7 : 0);
                            const qty = Math.max(1, it.deficit || (it.minStockLevel - it.currentStock) || 1);
                            return {
                                productId: it.productId,
                                quantity: qty,
                                price: purchasePrice
                            };
                        });
                        setItems(populated);
                        setAutoLoadedCount(populated.length);
                        toast.success(`Loaded ${populated.length} low-stock items with suggested quantities`, { id: "low-stock-loaded" });
                    }
                })
                .catch(() => {})
                .finally(() => setIsLoadingLowStock(false));
        }
    }, [reorderParam, products, items, isLoadingLowStock]);

    const handleAddItem = () => {
        setItems([...items, { productId: "", quantity: 1, price: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleItemChange = (index: number, field: string, value: string | number) => {
        if (field === "productId" && value === "ADD_NEW") {
            setProductIndexToUpdate(index);
            setShowProductModal(true);
            return;
        }

        const newItems = [...items];

        if (field === "productId") {
            const rawVal = String(value);
            if (rawVal.includes("|")) {
                const [pid, vid] = rawVal.split("|");
                newItems[index] = { ...newItems[index], productId: pid, variantId: vid };
                const prod = products.find((p: any) => p.id === pid);
                const variant = prod?.variants?.find((v: any) => v.id === vid);
                if (variant) {
                    newItems[index].price = variant.purchasePrice ?? prod?.purchasePrice ?? (variant.mrp ? variant.mrp * 0.7 : 0);
                }
            } else {
                newItems[index] = { ...newItems[index], productId: rawVal, variantId: undefined };
                const prod = products.find((p: any) => p.id === rawVal);
                if (prod) newItems[index].price = prod.purchasePrice || (prod.mrp * 0.7);
            }
        } else {
            newItems[index] = { ...newItems[index], [field]: value };
        }

        setItems(newItems);
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        if (!supplierId) return toast.error("Please select a supplier");
        if (items.some(i => !i.productId || i.quantity <= 0 || i.price < 0)) {
            return toast.error("Please fill all item fields properly");
        }

        const payload = {
            supplierId,
            expectedDate: expectedDate || undefined,
            notes: notes || undefined,
            items: items.map(i => ({
                productId: i.productId,
                variantId: i.variantId || undefined,
                quantity: i.quantity,
                unit: products.find((p: any) => p.id === i.productId)?.unit || "pcs",
                price: i.price
            }))
        };

        createPo.mutate(payload, {
            onSuccess: () => {
                router.push("/purchase-orders");
            }
        });
    };

    const handleSupplierCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSupplierName.trim()) return;
        createSupplier.mutate({ name: newSupplierName }, {
            onSuccess: (res) => {
                setSupplierId(res.id);
                setShowSupplierModal(false);
                setNewSupplierName("");
            }
        });
    };

    const handleProductCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProduct.name.trim()) return;
        createProduct.mutate(newProduct, {
            onSuccess: (res) => {
                if (productIndexToUpdate !== null) {
                    const newItems = [...items];
                    newItems[productIndexToUpdate].productId = res.id;
                    newItems[productIndexToUpdate].price = res.purchasePrice;
                    setItems(newItems);
                }
                setShowProductModal(false);
                setProductIndexToUpdate(null);
                setNewProduct({ name: "", sku: "", unit: "box", secondaryUnit: "", conversionFactor: 1, purchasePrice: 0, sellingPrice: 0, mrp: 0, gstRate: 0 });
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <div className="flex items-center gap-3 mb-6">
                <Link href="/purchase-orders" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Create Purchase Order</h1>
            </div>

            {/* Smart Reorder Banner */}
            {autoLoadedCount > 0 && (
                <div className="flex items-center justify-between p-3.5 mb-6 bg-[var(--gold)]/10 border border-[var(--gold)]/30 rounded-xl text-xs text-[var(--gold)] animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-[var(--gold)] shrink-0" />
                        <span>
                            <strong>{autoLoadedCount} low-stock products</strong> auto-loaded with suggested replenishment quantities. Select your supplier to finalize.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setItems([{ productId: "", quantity: 1, price: 0 }]);
                            setAutoLoadedCount(0);
                        }}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] underline ml-2 shrink-0 font-medium cursor-pointer"
                    >
                        Reset
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Details Card */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-6">
                    <h2 className="font-semibold text-[var(--text-primary)] mb-4">Order Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-sm text-[var(--text-muted)] mb-1 block">Supplier *</span>
                            <select
                                value={supplierId}
                                onChange={(e) => {
                                    if (e.target.value === "ADD_NEW") {
                                        setShowSupplierModal(true);
                                    } else {
                                        setSupplierId(e.target.value);
                                    }
                                }}
                                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                required
                            >
                                <option value="">Select Supplier</option>
                                <option value="ADD_NEW" className="font-semibold text-[var(--gold)]">+ Create New Supplier</option>
                                {suppliers.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-sm text-[var(--text-muted)] mb-1 block">Expected Delivery Date</span>
                            <input
                                type="date"
                                value={expectedDate}
                                onChange={(e) => setExpectedDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                            />
                        </label>

                        <label className="block md:col-span-2">
                            <span className="text-sm text-[var(--text-muted)] mb-1 block">Notes / Instructions</span>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Terms, shipping instructions..."
                                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition resize-none"
                            />
                        </label>
                    </div>
                </div>

                {/* Items Card */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-[var(--text-primary)]">Order Items</h2>
                    </div>

                    <div className="space-y-3">
                        {/* Header */}
                        <div className="hidden md:grid grid-cols-12 gap-3 pb-2 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            <div className="col-span-6">Product</div>
                            <div className="col-span-2 text-right">Quantity</div>
                            <div className="col-span-2 text-right">Price (₹)</div>
                            <div className="col-span-2 text-right">Total</div>
                            <div className="col-span-1"></div>
                        </div>

                        {/* Rows */}
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end md:items-center py-2 relative border-b border-[var(--border)]/40 md:border-b-0 pb-3 md:pb-2">
                                <div className="md:col-span-6">
                                    <span className="md:hidden text-xs text-[var(--text-muted)] mb-1 block">Product</span>
                                    <select
                                        value={item.variantId ? `${item.productId}|${item.variantId}` : item.productId}
                                        onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                        required
                                    >
                                        <option value="">Select Product...</option>
                                        <option value="ADD_NEW" className="font-semibold text-[var(--gold)]">+ Create New Product</option>
                                        {products.map((p: any) => {
                                            const hasVars = Boolean(p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0);
                                            if (hasVars) {
                                                return (
                                                    <optgroup key={p.id} label={`${p.name} (Variations)`}>
                                                        {p.variants.map((v: any) => (
                                                            <option key={v.id} value={`${p.id}|${v.id}`}>
                                                                {p.name} — {v.name} ({v.sku})
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                );
                                            }
                                            return (
                                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                            );
                                        })}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 md:contents gap-3">
                                    <div className="md:col-span-2">
                                        <span className="md:hidden text-xs text-[var(--text-muted)] mb-1 block">Quantity</span>
                                        <input
                                            type="number" min="1" inputMode="numeric"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                                            className="w-full px-3 py-2 text-sm md:text-right rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="md:hidden text-xs text-[var(--text-muted)] mb-1 block">Unit Price (₹)</span>
                                        <input
                                            type="number" min="0" step="0.01" inputMode="decimal"
                                            value={item.price}
                                            onChange={(e) => handleItemChange(index, "price", Number(e.target.value))}
                                            className="w-full px-3 py-2 text-sm md:text-right rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-1 text-right font-medium font-mono text-sm hidden md:block">
                                    ₹{(item.quantity * item.price).toLocaleString('en-IN')}
                                </div>

                                <div className="md:col-span-1 flex justify-end absolute top-1 right-0 md:relative md:top-auto">
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(index)}
                                        disabled={items.length === 1}
                                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--red)] disabled:opacity-30 transition rounded"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="md:hidden flex justify-between w-full pt-2 border-t border-[var(--border)] mt-2">
                                    <span className="text-xs text-[var(--text-muted)]">Subtotal</span>
                                    <span className="font-mono text-sm font-semibold">₹{(item.quantity * item.price).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:underline"
                        >
                            <Plus size={16} /> Add Another Item
                        </button>

                        <div className="w-full sm:w-auto bg-[var(--bg-secondary)] px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border)] text-right">
                            <span className="text-xs text-[var(--text-muted)] mr-2">Estimated Total:</span>
                            <span className="font-mono text-base font-bold text-[var(--gold)]">₹{totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Link href="/purchase-orders" className="px-5 py-2.5 text-sm font-semibold rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={createPo.isPending}
                        className="px-6 py-2.5 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-50 transition shadow-sm"
                    >
                        {createPo.isPending ? "Creating PO..." : "Save Purchase Order"}
                    </button>
                </div>
            </form>

            {/* Supplier Modal */}
            {showSupplierModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 pb-safe">
                    <div className="bg-[var(--bg-primary)] rounded-t-2xl sm:rounded-[var(--radius-lg)] border border-[var(--border)] w-full max-w-sm overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-200">
                        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-secondary)]">
                            <h3 className="font-bold text-[var(--text-primary)]">New Supplier</h3>
                            <button onClick={() => setShowSupplierModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSupplierCreate} className="p-4 space-y-4">
                            <label className="block">
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Supplier Name *</span>
                                <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]" required autoFocus />
                            </label>
                            <div className="pt-2 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowSupplierModal(false)} className="px-3 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--text-secondary)]">Cancel</button>
                                <button type="submit" disabled={createSupplier.isPending} className="px-3 py-1.5 text-sm rounded bg-[var(--gold)] text-[var(--bg-primary)] font-semibold disabled:opacity-50">{createSupplier.isPending ? "Saving..." : "Save Supplier"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Product Modal */}
            {showProductModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 pb-safe">
                    <div className="bg-[var(--bg-primary)] rounded-t-2xl sm:rounded-[var(--radius-lg)] border border-[var(--border)] w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in duration-200">
                        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-secondary)]">
                            <h3 className="font-bold text-[var(--text-primary)]">Create Fast Product</h3>
                            <button onClick={() => setShowProductModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleProductCreate} className="p-4 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="block sm:col-span-2">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Product Name *</span>
                                    <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required autoFocus />
                                </label>
                                <label className="block sm:col-span-2">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">SKU Code (Auto-generated if empty)</span>
                                    <input type="text" value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] uppercase" placeholder="e.g. ROFF-BOND-20KG" />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Primary Unit (e.g. Box) *</span>
                                    <input type="text" value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Secondary Unit (e.g. sqft)</span>
                                    <input type="text" value={newProduct.secondaryUnit} onChange={(e) => setNewProduct({ ...newProduct, secondaryUnit: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" placeholder="Optional" />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Conversion Factor</span>
                                    <input type="number" min="0" step="0.01" inputMode="decimal" value={newProduct.conversionFactor} onChange={(e) => setNewProduct({ ...newProduct, conversionFactor: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" disabled={!newProduct.secondaryUnit} />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Purchase Price (/ {newProduct.unit || 'Primary'}) *</span>
                                    <input type="number" min="0" step="0.01" inputMode="decimal" value={newProduct.purchasePrice} onChange={(e) => setNewProduct({ ...newProduct, purchasePrice: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Selling Price (/ {newProduct.secondaryUnit ? newProduct.secondaryUnit : newProduct.unit || 'Primary'}) *</span>
                                    <input type="number" min="0" step="0.01" inputMode="decimal" value={newProduct.sellingPrice} onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">MRP (/ {newProduct.secondaryUnit ? newProduct.secondaryUnit : newProduct.unit || 'Primary'}) *</span>
                                    <input type="number" min="0" step="0.01" inputMode="decimal" value={newProduct.mrp} onChange={(e) => setNewProduct({ ...newProduct, mrp: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required />
                                </label>
                                <label className="block sm:col-span-2">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">GST Rate (%) *</span>
                                    <input type="number" min="0" max="100" inputMode="numeric" value={newProduct.gstRate} onChange={(e) => setNewProduct({ ...newProduct, gstRate: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required />
                                </label>
                            </div>
                            <div className="pt-2 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowProductModal(false)} className="px-3 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--text-secondary)]">Cancel</button>
                                <button type="submit" disabled={createProduct.isPending} className="px-3 py-1.5 text-sm rounded bg-[var(--gold)] text-[var(--bg-primary)] font-semibold disabled:opacity-50">{createProduct.isPending ? "Saving..." : "Save Product"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function NewPurchaseOrderPage() {
    return (
        <Suspense fallback={<div className="max-w-4xl mx-auto p-12 text-center text-sm text-[var(--text-muted)]">Loading purchase order form...</div>}>
            <NewPurchaseOrderForm />
        </Suspense>
    );
}
