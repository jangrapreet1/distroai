"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, X } from "lucide-react";
import { useCreatePurchaseOrder, useSuppliers, useProducts, useCreateSupplier, useCreateProduct } from "@/hooks/api-hooks";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function NewPurchaseOrderPage() {
    const router = useRouter();
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
    const [items, setItems] = useState<{ productId: string; quantity: number; price: number }[]>([
        { productId: "", quantity: 1, price: 0 }
    ]);

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

    const handleAddItem = () => {
        setItems([...items, { productId: "", quantity: 1, price: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleItemChange = (index: number, field: keyof typeof items[0], value: string | number) => {
        if (field === "productId" && value === "ADD_NEW") {
            setProductIndexToUpdate(index);
            setShowProductModal(true);
            return;
        }

        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Auto-fill price when product changes
        if (field === "productId") {
            const prod = products.find((p: any) => p.id === value);
            if (prod) newItems[index].price = prod.purchasePrice || (prod.mrp * 0.7); // Guessing 30% margin if no purchase price
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

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Details Card */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
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
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
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
                            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end md:items-center py-2 relative">
                                <div className="md:col-span-6">
                                    <span className="md:hidden text-xs text-[var(--text-muted)] mb-1 block">Product</span>
                                    <select
                                        value={item.productId}
                                        onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                        required
                                    >
                                        <option value="">Select Product...</option>
                                        <option value="ADD_NEW" className="font-semibold text-[var(--gold)]">+ Create New Product</option>
                                        {products.map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 md:contents gap-3">
                                    <div className="md:col-span-2">
                                        <span className="md:hidden text-xs text-[var(--text-muted)] mb-1 block">Quantity</span>
                                        <input
                                            type="number" min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                                            className="w-full px-3 py-2 text-sm md:text-right rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="md:hidden text-xs text-[var(--text-muted)] mb-1 block">Unit Price (₹)</span>
                                        <input
                                            type="number" min="0" step="0.01"
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
                                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--red)] disabled:opacity-30 transition rounded p-2"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="md:hidden flex justify-between w-full pt-2 border-t border-[var(--border)] mt-2">
                                    <span className="text-xs text-[var(--text-muted)]">Subtotal</span>
                                    <span className="font-mono text-sm">₹{(item.quantity * item.price).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:text-[var(--gold-light)] mt-4 transition"
                        >
                            <Plus size={16} /> Add Another Item
                        </button>
                    </div>

                    <div className="mt-8 border-t border-[var(--border)] pt-4 flex justify-end">
                        <div className="w-full md:w-1/3 space-y-2">
                            <div className="flex justify-between font-bold text-lg text-[var(--text-primary)]">
                                <span>Total Amount</span>
                                <span className="font-mono text-[var(--gold)]">₹{totalAmount.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                    <Link href="/purchase-orders" className="px-5 py-2.5 text-sm font-semibold rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={createPo.isPending}
                        className="px-6 py-2.5 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-50 transition"
                    >
                        {createPo.isPending ? "Creating PO..." : "Save Purchase Order"}
                    </button>
                </div>
            </form>

            {/* Supplier Modal */}
            {showSupplierModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[var(--bg-primary)] rounded-[var(--radius-lg)] border border-[var(--border)] w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[var(--bg-primary)] rounded-[var(--radius-lg)] border border-[var(--border)] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-secondary)]">
                            <h3 className="font-bold text-[var(--text-primary)]">New Product</h3>
                            <button onClick={() => setShowProductModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleProductCreate} className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="block col-span-2">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Product Name *</span>
                                    <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required autoFocus />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">SKU / Code</span>
                                    <input type="text" value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" />
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
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Conversion (1 {newProduct.unit || 'Primary'} = X {newProduct.secondaryUnit || 'Secondary'})</span>
                                    <input type="number" min="0" step="0.01" value={newProduct.conversionFactor} onChange={(e) => setNewProduct({ ...newProduct, conversionFactor: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" disabled={!newProduct.secondaryUnit} />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Purchase Price (/ {newProduct.unit || 'Primary'}) *</span>
                                    <input type="number" min="0" step="0.01" value={newProduct.purchasePrice} onChange={(e) => setNewProduct({ ...newProduct, purchasePrice: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">Selling Price (/ {newProduct.secondaryUnit ? newProduct.secondaryUnit : newProduct.unit || 'Primary'}) *</span>
                                    <input type="number" min="0" step="0.01" value={newProduct.sellingPrice} onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">MRP (/ {newProduct.secondaryUnit ? newProduct.secondaryUnit : newProduct.unit || 'Primary'}) *</span>
                                    <input type="number" min="0" step="0.01" value={newProduct.mrp} onChange={(e) => setNewProduct({ ...newProduct, mrp: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-[var(--text-muted)] mb-1 block">GST Rate (%) *</span>
                                    <input type="number" min="0" max="100" value={newProduct.gstRate} onChange={(e) => setNewProduct({ ...newProduct, gstRate: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)]" required />
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
