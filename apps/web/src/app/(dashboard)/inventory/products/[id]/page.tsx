"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Package, Edit, X } from "lucide-react";
import { useProduct, useUpdateProduct } from "@/hooks/api-hooks";

function formatINR(n: number): string { return "₹" + n.toLocaleString("en-IN"); }

export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data, isLoading } = useProduct(id);
    const product = data?.data ?? data;
    const updateProduct = useUpdateProduct();

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: "", sku: "", brand: "", category: "",
        purchasePrice: 0, sellingPrice: 0, mrp: 0, gstRate: 0,
        unit: "", secondaryUnit: "", conversionFactor: 1, minStockLevel: 0
    });

    const handleEditOpen = () => {
        if (product) {
            setEditData({
                name: product.name || "",
                sku: product.sku || "",
                brand: product.brand || "",
                category: product.category || "",
                purchasePrice: product.purchasePrice || 0,
                sellingPrice: product.sellingPrice || 0,
                mrp: product.mrp || 0,
                gstRate: product.gstRate || 0,
                unit: product.unit || "",
                secondaryUnit: product.secondaryUnit || "",
                conversionFactor: product.conversionFactor || 1,
                minStockLevel: product.minStockLevel || 0,
            });
            setIsEditing(true);
        }
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProduct.mutate({ id: product.id, data: editData }, {
            onSuccess: () => setIsEditing(false)
        });
    };

    if (isLoading) {
        return <div className="p-8 text-center text-[var(--text-muted)]">Loading product details...</div>;
    }

    if (!product) {
        return <div className="p-8 text-center text-[var(--text-muted)]">Product not found.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <div className="flex justify-between items-center mb-4">
                <Link href="/inventory" className="inline-flex items-center gap-2 text-sm text-[var(--gold)] hover:underline">
                    <ArrowLeft size={16} /> Back to Inventory
                </Link>
                <button
                    onClick={handleEditOpen}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] hover:bg-[var(--border)] transition font-medium"
                >
                    <Edit size={16} /> Edit Product
                </button>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 flex items-start gap-5">
                <div className="w-16 h-16 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--gold)] shrink-0">
                    <Package size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-playfair)" }}>{product.name}</h1>
                    <p className="text-sm text-[var(--text-muted)] mb-4">{product.sku} • {product.brand || "No Brand"}</p>
                    <div className="flex gap-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${product.isActive ? 'bg-[var(--green)]/15 text-[var(--green-bright)]' : 'bg-[var(--red)]/15 text-[var(--red)]'}`}>
                            {product.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className="inline-block px-3 py-1 bg-[var(--bg-secondary)] rounded-full text-xs font-semibold text-[var(--text-secondary)]">
                            {product.category || "Uncategorized"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                    <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-playfair)" }}>Pricing Details</h2>
                    <dl className="space-y-3">
                        <div className="flex justify-between border-b border-[var(--border)] pb-2 text-sm">
                            <dt className="text-[var(--text-muted)]">Selling Price</dt>
                            <dd className="font-semibold text-[var(--gold)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(product.sellingPrice || 0)}</dd>
                        </div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-2 text-sm">
                            <dt className="text-[var(--text-muted)]">MRP</dt>
                            <dd className="text-right" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(product.mrp || 0)}</dd>
                        </div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-2 text-sm">
                            <dt className="text-[var(--text-muted)]">Purchase Price</dt>
                            <dd className="text-right" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(product.purchasePrice || 0)}</dd>
                        </div>
                        <div className="flex justify-between text-sm">
                            <dt className="text-[var(--text-muted)]">GST Rate</dt>
                            <dd className="text-right" style={{ fontFamily: "var(--font-mono)" }}>{product.gstRate || 0}%</dd>
                        </div>
                    </dl>
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                    <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-playfair)" }}>Stock Details</h2>
                    <dl className="space-y-3">
                        <div className="flex justify-between border-b border-[var(--border)] pb-2 text-sm">
                            <dt className="text-[var(--text-muted)]">Total Stock</dt>
                            <dd className="font-semibold" style={{ fontFamily: "var(--font-mono)", color: product.totalQuantity <= product.minStockLevel ? "var(--red)" : "var(--green-bright)" }}>
                                {product.totalQuantity || 0} {product.unit}
                            </dd>
                        </div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-2 text-sm">
                            <dt className="text-[var(--text-muted)]">Minimum Stock Level</dt>
                            <dd className="text-right" style={{ fontFamily: "var(--font-mono)" }}>{product.minStockLevel || 0}</dd>
                        </div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-2 text-sm">
                            <dt className="text-[var(--text-muted)]">Unit Type</dt>
                            <dd className="text-right">
                                {product.unit || "Pieces"}
                                {product.secondaryUnit && <span className="text-[var(--text-muted)] block text-xs mt-0.5">1 {product.unit} = {product.conversionFactor} {product.secondaryUnit}</span>}
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>

            {/* Edit Product Modal */}
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
                    <div className="bg-[var(--bg-primary)] rounded-[var(--radius-lg)] border border-[var(--border)] w-full max-w-4xl shadow-2xl animate-in fade-in zoom-in duration-200 my-8">
                        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-secondary)] sticky top-0 rounded-t-[var(--radius-lg)] z-10">
                            <h3 className="font-bold text-[var(--text-primary)] text-lg">Edit Product: {product.name}</h3>
                            <button onClick={() => setIsEditing(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition bg-[var(--bg-primary)] p-1 rounded-full"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Basic Info */}
                                <div className="space-y-4 lg:col-span-3">
                                    <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">Basic Info</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Product Name *</span>
                                            <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" required />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">SKU / Code</span>
                                            <input type="text" value={editData.sku} onChange={(e) => setEditData({ ...editData, sku: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Brand</span>
                                            <input type="text" value={editData.brand} onChange={(e) => setEditData({ ...editData, brand: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Category</span>
                                            <input type="text" value={editData.category} onChange={(e) => setEditData({ ...editData, category: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" />
                                        </label>
                                    </div>
                                </div>

                                {/* Units */}
                                <div className="space-y-4 lg:col-span-3">
                                    <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">Units & Conversions</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Primary Unit *</span>
                                            <input type="text" value={editData.unit} onChange={(e) => setEditData({ ...editData, unit: e.target.value })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" required />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Secondary Unit</span>
                                            <input type="text" value={editData.secondaryUnit} onChange={(e) => setEditData({ ...editData, secondaryUnit: e.target.value })} placeholder="Optional" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Conv. Factor (1 Primary = X Secondary)</span>
                                            <input type="number" step="0.01" min="0" value={editData.conversionFactor} onChange={(e) => setEditData({ ...editData, conversionFactor: Number(e.target.value) })} disabled={!editData.secondaryUnit} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none disabled:opacity-50" />
                                        </label>
                                    </div>
                                </div>

                                {/* Pricing */}
                                <div className="space-y-4 lg:col-span-3">
                                    <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">Pricing & Stock</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Purchase Price *</span>
                                            <input type="number" step="0.01" min="0" value={editData.purchasePrice} onChange={(e) => setEditData({ ...editData, purchasePrice: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" required />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Selling Price *</span>
                                            <input type="number" step="0.01" min="0" value={editData.sellingPrice} onChange={(e) => setEditData({ ...editData, sellingPrice: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" required />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">MRP *</span>
                                            <input type="number" step="0.01" min="0" value={editData.mrp} onChange={(e) => setEditData({ ...editData, mrp: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" required />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">GST Rate (%) *</span>
                                            <input type="number" step="0.01" min="0" value={editData.gstRate} onChange={(e) => setEditData({ ...editData, gstRate: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" required />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Min. Stock Level</span>
                                            <input type="number" min="0" value={editData.minStockLevel} onChange={(e) => setEditData({ ...editData, minStockLevel: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-[var(--border)] flex justify-end gap-3 sticky bottom-0 bg-[var(--bg-card)] pb-2 z-10">
                                <button type="button" onClick={() => setIsEditing(false)} className="px-5 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition font-medium">Cancel</button>
                                <button type="submit" disabled={updateProduct.isPending} className="px-5 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-bold disabled:opacity-50 hover:opacity-90 transition">
                                    {updateProduct.isPending ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
