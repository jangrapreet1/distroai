"use client";
import { formatINR } from "@/lib/utils";
import { use, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Package, Edit, X, RefreshCcw, Trash2, AlertTriangle } from "lucide-react";
import { useProduct, useUpdateProduct, useDeleteProduct, useRestoreProduct, useHardDeleteProduct, useUploadFile } from "@/hooks/api-hooks";
import { useRouter } from "next/navigation";
import { MultiImageUpload } from "@/components/ui/multi-image-upload";


export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data, isLoading } = useProduct(id);
    const product = data?.data ?? data;
    const updateProduct = useUpdateProduct();
    const deleteProduct = useDeleteProduct();
    const restoreProduct = useRestoreProduct();
    const hardDeleteProduct = useHardDeleteProduct();
    const upload = useUploadFile();
    const router = useRouter();

    const [isEditing, setIsEditing] = useState(false);
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);
    const [editImages, setEditImages] = useState<string[]>([]);
    const [mainImageIdx, setMainImageIdx] = useState(0);
    const [fullScreenIdx, setFullScreenIdx] = useState<number | null>(null);
    const parsedImages = useMemo(() => {
        if (product?.imageUrls?.length > 0) return product.imageUrls;
        if (!product?.imageUrl) return [];
        try {
            const parsed = JSON.parse(product.imageUrl);
            return Array.isArray(parsed) ? parsed : [product.imageUrl];
        } catch {
            return [product.imageUrl];
        }
    }, [product?.imageUrl, product?.imageUrls]);

    const [editData, setEditData] = useState({
        name: "", sku: "", brand: "", category: "", description: "",
        purchasePrice: 0, sellingPrice: 0, mrp: 0, gstRate: 0,
        unit: "", secondaryUnit: "", conversionFactor: 1, minStockLevel: 0,
        commissionType: null as string | null, commissionValue: 0,
    });

    const handleEditOpen = () => {
        if (product) {
            setEditData({
                name: product.name || "",
                sku: product.sku || "",
                brand: product.brand || "",
                category: product.category || "",
                description: product.description || "",
                purchasePrice: product.purchasePrice || 0,
                sellingPrice: product.sellingPrice || 0,
                mrp: product.mrp || 0,
                gstRate: product.gstRate || 0,
                unit: product.unit || "",
                secondaryUnit: product.secondaryUnit || "",
                conversionFactor: product.conversionFactor || 1,
                minStockLevel: product.minStockLevel || 0,
                commissionType: product.commissionType || null,
                commissionValue: product.commissionValue || 0,
            });
            setEditImages(parsedImages);
            setIsEditing(true);
        }
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProduct.mutate({
            id: product.id,
            data: {
                ...editData,
                imageUrl: editImages[0] || "",
                imageUrls: editImages
            }
        }, {
            onSuccess: () => setIsEditing(false)
        });
    };

    const handleArchive = () => {
        deleteProduct.mutate(product.id, {
            onSuccess: () => {
                setShowArchiveModal(false);
                router.push("/inventory");
            }
        });
    };

    const handleRestore = () => {
        restoreProduct.mutate(product.id, {
            onSuccess: () => {
                router.push("/inventory");
            }
        });
    };

    const handleHardDelete = () => {
        hardDeleteProduct.mutate(product.id, {
            onSuccess: () => {
                setShowHardDeleteModal(false);
                router.push("/inventory");
            }
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
                <div className="flex gap-2">
                    <button
                        onClick={handleEditOpen}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] hover:bg-[var(--border)] transition font-medium"
                    >
                        <Edit size={16} /> Edit Product
                    </button>
                    {product.isActive ? (
                        <button
                            onClick={() => setShowArchiveModal(true)}
                            disabled={deleteProduct.isPending}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--red)]/10 border border-[var(--red)]/20 text-[var(--red)] rounded-[var(--radius-md)] hover:bg-[var(--red)]/20 transition font-medium disabled:opacity-50"
                        >
                            <X size={16} /> {deleteProduct.isPending ? "Archiving..." : "Archive"}
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleRestore}
                                disabled={restoreProduct.isPending}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--green)]/10 border border-[var(--green)]/20 text-[var(--green-bright)] rounded-[var(--radius-md)] hover:bg-[var(--green)]/20 transition font-medium disabled:opacity-50"
                            >
                                <RefreshCcw size={16} /> {restoreProduct.isPending ? "Restoring..." : "Restore"}
                            </button>
                            <button
                                onClick={() => setShowHardDeleteModal(true)}
                                disabled={hardDeleteProduct.isPending}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--red)]/10 border border-[var(--red)]/20 text-[var(--red)] rounded-[var(--radius-md)] hover:bg-[var(--red)]/20 transition font-medium disabled:opacity-50"
                            >
                                <Trash2 size={16} /> {hardDeleteProduct.isPending ? "Deleting..." : "Permanently Delete"}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 flex flex-col md:flex-row items-start gap-6">
                {parsedImages.length > 0 ? (
                    <div className="flex flex-col gap-3 shrink-0 mx-auto md:mx-0">
                        <img
                            src={parsedImages[mainImageIdx] || parsedImages[0]}
                            alt={product.name}
                            onClick={() => setFullScreenIdx(mainImageIdx)}
                            className="w-32 h-32 md:w-40 md:h-40 rounded-lg object-contain border border-[var(--border)] bg-[var(--bg-secondary)] shadow-sm cursor-pointer hover:opacity-90 transition"
                        />
                        {parsedImages.length > 1 && (
                            <div className="flex gap-2 w-32 md:w-40 overflow-x-auto pb-1 scrollbar-hide">
                                {parsedImages.map((url: string, i: number) => (
                                    <button key={i} type="button" onClick={() => setMainImageIdx(i)} className={`w-12 h-12 shrink-0 rounded-md border ${i === mainImageIdx ? 'border-[var(--gold)]' : 'border-[var(--border)] opacity-60 hover:opacity-100'} transition overflow-hidden`}>
                                        <img src={url} className="w-full h-full object-cover bg-[var(--bg-secondary)]" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 mx-auto md:mx-0 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] opacity-50">
                        <Package size={48} />
                    </div>
                )}
                <div className="text-center md:text-left w-full mt-2 md:mt-0">
                    <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-playfair)" }}>{product.name}</h1>
                    <p className="text-sm text-[var(--text-muted)] mb-4">{product.sku} • {product.brand || "No Brand"}</p>
                    <div className="flex justify-center md:justify-start gap-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${product.isActive ? 'bg-[var(--green)]/15 text-[var(--green-bright)]' : 'bg-[var(--red)]/15 text-[var(--red)]'}`}>
                            {product.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className="inline-block px-3 py-1 bg-[var(--bg-secondary)] rounded-full text-xs font-semibold text-[var(--text-secondary)]">
                            {product.category || "Uncategorized"}
                        </span>
                    </div>
                </div>
            </div>

            {product.description && (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                    <h2 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-playfair)" }}>Product Description</h2>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{product.description}</p>
                </div>
            )}

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
                        <div className="flex justify-between border-b border-[var(--border)] pb-2 text-sm">
                            <dt className="text-[var(--text-muted)]">GST Rate</dt>
                            <dd className="text-right" style={{ fontFamily: "var(--font-mono)" }}>{product.gstRate || 0}%</dd>
                        </div>
                        <div className="flex justify-between text-sm">
                            <dt className="text-[var(--text-muted)]">Commission</dt>
                            <dd className="text-right" style={{ fontFamily: "var(--font-mono)" }}>
                                {product.commissionType === 'FIXED' ? `₹${product.commissionValue}/unit` :
                                    product.commissionType === 'PERCENTAGE' ? `${product.commissionValue}%` :
                                        <span className="text-[var(--text-muted)]">None</span>}
                            </dd>
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
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 sm:p-8 overflow-y-auto">
                    <div className="bg-[var(--bg-primary)] rounded-[var(--radius-lg)] border border-[var(--border)] w-full max-w-4xl shadow-2xl animate-in fade-in zoom-in duration-200 relative">
                        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-secondary)] sticky top-0 rounded-t-[var(--radius-lg)] z-10">
                            <h3 className="font-bold text-[var(--text-primary)] text-lg">Edit Product: {product.name}</h3>
                            <button onClick={() => setIsEditing(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition bg-[var(--bg-primary)] p-1 rounded-full"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Product Images */}
                                <div className="space-y-4 lg:col-span-3">
                                    <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">Product Images</h4>
                                    <MultiImageUpload
                                        value={editImages}
                                        onChange={setEditImages}
                                        onUpload={(file) => upload.mutateAsync(file)}
                                        disabled={updateProduct.isPending || upload.isPending}
                                    />
                                </div>
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
                                        <div className="col-span-1 md:col-span-3">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Product Description</span>
                                            <textarea value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} placeholder="Enter rich product details to show up in the customer storefront..." rows={3} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none resize-vertical" />
                                        </div>
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

                                {/* Commission (Owner/Admin only) */}
                                <div className="space-y-4 lg:col-span-3">
                                    <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">Commission Setup <span className="text-[10px] text-[var(--gold)] ml-1">(Owner Only)</span></h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <span className="text-xs text-[var(--text-muted)] mb-2 block">Commission Type</span>
                                            <div className="flex gap-1">
                                                {[{ label: 'None', value: null }, { label: 'Fixed ₹', value: 'FIXED' }, { label: 'Percentage %', value: 'PERCENTAGE' }].map(opt => (
                                                    <button key={String(opt.value)} type="button"
                                                        onClick={() => setEditData({ ...editData, commissionType: opt.value, commissionValue: opt.value ? editData.commissionValue : 0 })}
                                                        className={`flex-1 px-2 py-1.5 text-xs rounded-[var(--radius-md)] border transition ${editData.commissionType === opt.value
                                                            ? 'bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30 font-medium'
                                                            : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}
                                                    >{opt.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                        {editData.commissionType && (
                                            <label className="block">
                                                <span className="text-xs text-[var(--text-muted)] mb-1 block">
                                                    {editData.commissionType === 'FIXED' ? 'Amount per unit (₹)' : 'Percentage (%)'}
                                                </span>
                                                <input type="number" step="0.01" min="0"
                                                    value={editData.commissionValue}
                                                    onChange={(e) => setEditData({ ...editData, commissionValue: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none" />
                                            </label>
                                        )}
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

            {/* Full Screen Image Modal */}
            {fullScreenIdx !== null && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setFullScreenIdx(null)}
                >
                    <button
                        onClick={() => setFullScreenIdx(null)}
                        className="absolute top-4 right-4 text-white/70 hover:text-white transition bg-black/50 p-2 rounded-full"
                    >
                        <X size={24} />
                    </button>

                    {parsedImages.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); setFullScreenIdx(prev => prev! > 0 ? prev! - 1 : parsedImages.length - 1); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition bg-black/50 p-3 rounded-full"
                            >
                                <ArrowLeft size={24} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setFullScreenIdx(prev => prev! < parsedImages.length - 1 ? prev! + 1 : 0); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition bg-black/50 p-3 rounded-full transform rotate-180"
                            >
                                <ArrowLeft size={24} />
                            </button>
                        </>
                    )}

                    <img
                        src={parsedImages[fullScreenIdx]}
                        alt="Full screen"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Archive Confirmation Modal */}
            {showArchiveModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[var(--bg-primary)] rounded-[var(--radius-lg)] border border-[var(--border)] w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <h3 className="font-bold text-xl text-[var(--text-primary)] mb-2" style={{ fontFamily: "var(--font-playfair)" }}>Archive Product?</h3>
                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                Are you sure you want to archive <strong className="text-[var(--text-primary)]">{product.name}</strong>? 
                                This will hide the product from all future inventory lists and purchase orders. 
                                <br/><br/>
                                <span className="text-[var(--gold)]">Note: Historical invoices and orders containing this product will remain unaffected.</span>
                            </p>
                            
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={() => setShowArchiveModal(false)}
                                    disabled={deleteProduct.isPending}
                                    className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleArchive}
                                    disabled={deleteProduct.isPending}
                                    className="px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--red)] text-white hover:bg-[var(--red)]/90 transition font-bold disabled:opacity-50 flex items-center gap-2"
                                >
                                    {deleteProduct.isPending ? "Archiving..." : "Yes, Archive Product"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hard Delete Confirmation Modal */}
            {showHardDeleteModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[var(--bg-primary)] rounded-[var(--radius-lg)] border border-[var(--border)] w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-l-4 border-[var(--red)]">
                            <h3 className="font-bold text-xl text-[var(--text-primary)] mb-2 flex items-center gap-2" style={{ fontFamily: "var(--font-playfair)" }}><AlertTriangle size={20} className="text-[var(--red)]" /> Permanently Delete?</h3>
                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                Are you sure you want to <strong>permanently delete</strong> <strong className="text-[var(--text-primary)]">{product.name}</strong>? 
                                <br/><br/>
                                <span className="text-[var(--red)] block">Warning: This action cannot be undone. If this product has ANY historical orders, invoices, or purchase orders, the database will block this deletion to protect your ledgers.</span>
                            </p>
                            
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={() => setShowHardDeleteModal(false)}
                                    disabled={hardDeleteProduct.isPending}
                                    className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleHardDelete}
                                    disabled={hardDeleteProduct.isPending}
                                    className="px-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--red)] text-white hover:bg-[var(--red)]/90 transition font-bold disabled:opacity-50 flex items-center gap-2"
                                >
                                    {hardDeleteProduct.isPending ? "Deleting..." : "Permanently Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
