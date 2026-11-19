"use client";
import { formatINR } from "@/lib/utils";
import { use, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Package, Edit, X, RefreshCcw, Trash2, AlertTriangle, CheckCircle2, Layers, Info } from "lucide-react";
import { useProduct, useUpdateProduct, useDeleteProduct, useRestoreProduct, useHardDeleteProduct, useUploadFile, usePublishProduct } from "@/hooks/api-hooks";
import { useRouter } from "next/navigation";
import { MultiImageUpload } from "@/components/ui/multi-image-upload";
import toast from "react-hot-toast";


export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data, isLoading } = useProduct(id);
    const product = data?.data ?? data;
    const updateProduct = useUpdateProduct();
    const publishProduct = usePublishProduct();
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
    const [editVariants, setEditVariants] = useState<any[]>([]);
    const [newVariantName, setNewVariantName] = useState("");
    const [newVariantSku, setNewVariantSku] = useState("");
    const [newVariantStock, setNewVariantStock] = useState<number>(0);

    const handleEditOpen = () => {
        if (product) {
            const primaryVar = (product.variants || []).find((v: any) => v.isActive !== false) || product.variants?.[0];
            setEditData({
                name: product.name || "",
                sku: product.sku || "",
                brand: product.brand || "",
                category: product.category || "",
                description: product.description || "",
                purchasePrice: (primaryVar?.purchasePrice ?? product.purchasePrice) || 0,
                sellingPrice: (primaryVar?.sellingPrice ?? product.sellingPrice) || 0,
                mrp: (primaryVar?.mrp ?? product.mrp) || 0,
                gstRate: product.gstRate || 0,
                unit: product.unit || "",
                secondaryUnit: product.secondaryUnit || "",
                conversionFactor: product.conversionFactor || 1,
                minStockLevel: product.minStockLevel || 0,
                commissionType: product.commissionType || null,
                commissionValue: product.commissionValue || 0,
            });
            setEditImages(parsedImages);
            setEditVariants((product.variants || []).map((v: any) => ({
                id: v.id,
                name: v.name,
                sku: v.sku,
                attributes: v.attributes || {},
                sellingPrice: v.sellingPrice ?? product.sellingPrice,
                mrp: v.mrp ?? product.mrp,
                purchasePrice: v.purchasePrice ?? product.purchasePrice,
                stock: (v.inventories || []).reduce((sum: number, inv: any) => sum + (inv.quantity - inv.reservedQty), 0),
                isActive: v.isActive !== false,
            })));
            setIsEditing(true);
        }
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Ensure all variant SKUs are unique within the product and non-empty
        const seenSkus = new Set<string>();
        const sanitizedVariants = editVariants.map((v, i) => {
            let sku = (v.sku || "").trim();
            if (!sku) {
                const nameSuffix = (v.name || `VAR${i + 1}`).trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                sku = `${editData.sku?.trim() || product?.sku?.trim() || "PRD"}-${nameSuffix}`;
            }
            let uniqueSku = sku;
            let counter = 1;
            while (seenSkus.has(uniqueSku.toLowerCase())) {
                counter++;
                uniqueSku = `${sku}-${counter}`;
            }
            seenSkus.add(uniqueSku.toLowerCase());
            return {
                ...v,
                sku: uniqueSku,
            };
        });

        setEditVariants(sanitizedVariants);

        // Keep base product prices in sync with the primary (first active) variant
        const primary = sanitizedVariants.find(v => v.isActive !== false) || sanitizedVariants[0];
        const updatedEditData = sanitizedVariants.length > 0 && primary ? {
            ...editData,
            sellingPrice: primary.sellingPrice !== undefined ? Number(primary.sellingPrice) : editData.sellingPrice,
            mrp: primary.mrp !== undefined ? Number(primary.mrp) : editData.mrp,
            purchasePrice: primary.purchasePrice !== undefined ? Number(primary.purchasePrice) : editData.purchasePrice,
        } : editData;

        updateProduct.mutate({
            id: product.id,
            data: {
                ...updatedEditData,
                imageUrl: editImages[0] || "",
                imageUrls: editImages,
                ...(sanitizedVariants.length > 0 ? {
                    hasVariants: true,
                    variants: sanitizedVariants
                } : {})
            }
        }, {
            onSuccess: () => {
                toast.success("Product updated successfully");
                setIsEditing(false);
            },
            onError: (err: any) => {
                const msg = err?.response?.data?.message || err?.message || "Failed to update product";
                toast.error(msg);
            }
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
                    {product.isDraft && (
                        <button
                            onClick={() => publishProduct.mutate(product.id)}
                            disabled={publishProduct.isPending}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-[var(--radius-md)] transition shadow-sm disabled:opacity-50"
                        >
                            <CheckCircle2 size={16} /> {publishProduct.isPending ? "Publishing..." : "Publish Product"}
                        </button>
                    )}
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

            {product.isDraft && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={20} className="shrink-0 text-amber-400" />
                        <div>
                            <p className="text-sm font-semibold text-amber-300">Draft Product</p>
                            <p className="text-xs text-amber-300/80">This product is saved as a draft. It is hidden from your customer storefront and catalog until published.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => publishProduct.mutate(product.id)}
                        disabled={publishProduct.isPending}
                        className="px-4 py-2 text-xs font-semibold rounded-[var(--radius-md)] bg-amber-500 text-black hover:bg-amber-400 transition whitespace-nowrap shadow-sm disabled:opacity-50"
                    >
                        {publishProduct.isPending ? "Publishing..." : "Publish Product"}
                    </button>
                </div>
            )}

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
                    <div className="w-28 h-28 md:w-32 md:h-32 shrink-0 mx-auto md:mx-0 rounded-xl border border-dashed border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-zinc-500">
                        <Package size={28} />
                        <span className="text-[10px] font-medium">No Image</span>
                    </div>
                )}
                <div className="text-center md:text-left w-full mt-2 md:mt-0">
                    <h1 className="text-2xl font-bold tracking-tight mb-1 text-[var(--text-primary)]">{product.name}</h1>
                    <p className="text-sm text-[var(--text-muted)] mb-4">{product.sku} • {product.brand || "No Brand"}</p>
                    <div className="flex justify-center md:justify-start gap-2.5">
                        {product.isDraft ? (
                            <span className="inline-block px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-semibold text-amber-500">
                                Draft
                            </span>
                        ) : (
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${product.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                                {product.isActive ? "Active" : "Inactive"}
                            </span>
                        )}
                        <span className="inline-block px-2.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded-full text-xs font-medium text-slate-600 dark:text-zinc-400">
                            {product.category || "Uncategorized"}
                        </span>
                    </div>
                </div>
            </div>

            {product.description && (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3">Product Description</h2>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{product.description}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-4">Pricing Details</h2>
                    <dl className="space-y-3">
                        <div className="flex justify-between border-b border-[var(--border)] pb-2 text-sm">
                            <dt className="text-[var(--text-muted)]">Selling Price</dt>
                            <dd className="font-semibold text-blue-600 dark:text-blue-400" style={{ fontFamily: "var(--font-mono)" }}>
                                {product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0 ? (() => {
                                    const prices = product.variants.map((v: any) => Number(v.sellingPrice)).filter((p: number) => !isNaN(p) && p > 0);
                                    if (prices.length === 0) return formatINR(product.sellingPrice || 0);
                                    const min = Math.min(...prices);
                                    const max = Math.max(...prices);
                                    return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
                                })() : formatINR(product.sellingPrice || 0)}
                            </dd>
                        </div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-2 text-sm">
                            <dt className="text-[var(--text-muted)]">MRP</dt>
                            <dd className="text-right" style={{ fontFamily: "var(--font-mono)" }}>
                                {product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0 ? (() => {
                                    const mrps = product.variants.map((v: any) => Number(v.mrp)).filter((m: number) => !isNaN(m) && m > 0);
                                    if (mrps.length === 0) return formatINR(product.mrp || 0);
                                    const min = Math.min(...mrps);
                                    const max = Math.max(...mrps);
                                    return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
                                })() : formatINR(product.mrp || 0)}
                            </dd>
                        </div>
                        <div className="flex justify-between border-b border-[var(--border)] pb-2 text-sm">
                            <dt className="text-[var(--text-muted)]">Purchase Price</dt>
                            <dd className="text-right" style={{ fontFamily: "var(--font-mono)" }}>
                                {product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0 ? (() => {
                                    const buys = product.variants.map((v: any) => Number(v.purchasePrice)).filter((b: number) => !isNaN(b) && b > 0);
                                    if (buys.length === 0) return formatINR(product.purchasePrice || 0);
                                    const min = Math.min(...buys);
                                    const max = Math.max(...buys);
                                    return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
                                })() : formatINR(product.purchasePrice || 0)}
                            </dd>
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
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-4">Stock Details</h2>
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

            {/* Product Variations Card */}
            {(product.hasVariants || (product.variants && product.variants.length > 0)) && (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Product Variations</h2>
                            <p className="text-xs text-[var(--text-muted)]">Independent stock, pricing, and SKU per variant</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/20">
                            {product.variants?.length || 0} Variations
                        </span>
                    </div>

                    <div className="overflow-x-auto border border-[var(--border)] rounded-[var(--radius-md)]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-3">Variant</th>
                                    <th className="p-3">SKU</th>
                                    <th className="p-3 text-right">Selling Price</th>
                                    <th className="p-3 text-right">MRP</th>
                                    <th className="p-3 text-right">In Stock</th>
                                    <th className="p-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {(product.variants || []).map((v: any) => {
                                    const vStock = (v.inventories || []).reduce((sum: number, inv: any) => sum + (inv.quantity - inv.reservedQty), 0);
                                    return (
                                        <tr key={v.id} className="hover:bg-[var(--bg-secondary)]/30">
                                            <td className="p-3 font-medium text-[var(--text-primary)]">
                                                <div>{v.name}</div>
                                                {v.attributes && typeof v.attributes === "object" && (
                                                    <div className="flex gap-1 mt-1">
                                                        {Object.entries(v.attributes).map(([k, val]) => (
                                                            <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]">
                                                                {k}: {String(val)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">{v.sku}</td>
                                            <td className="p-3 text-right font-mono font-medium">{formatINR(v.sellingPrice ?? product.sellingPrice)}</td>
                                            <td className="p-3 text-right font-mono text-[var(--text-muted)]">{formatINR(v.mrp ?? product.mrp)}</td>
                                            <td className="p-3 text-right font-mono font-semibold" style={{ color: vStock > 0 ? "var(--green-bright)" : "var(--red)" }}>
                                                {vStock} {product.unit}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${v.isActive !== false ? "bg-[var(--green)]/15 text-[var(--green-bright)]" : "bg-[var(--red)]/15 text-[var(--red)]"}`}>
                                                    {v.isActive !== false ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
                                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                                        <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Pricing & Stock</h4>
                                        {editVariants.length > 0 && (
                                            <span className="text-xs text-[var(--gold)] bg-[var(--gold)]/10 px-2.5 py-1 rounded-full border border-[var(--gold)]/20 font-medium flex items-center gap-1.5">
                                                <Layers size={13} /> Managed by Variations ({editVariants.length})
                                            </span>
                                        )}
                                    </div>

                                    {editVariants.length > 0 && (
                                        <div className="p-3 bg-[var(--bg-secondary)]/70 rounded-[var(--radius-md)] border border-[var(--gold)]/25 text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
                                            <Info size={15} className="text-[var(--gold)] shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-semibold text-[var(--text-primary)]">Variation Pricing Active:</span> This product has {editVariants.length} variations. Purchase Price, Selling Price, and MRP are defined per variant in the table below. Base prices are blurred/disabled and automatically reflect your primary variant.
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Purchase Price {editVariants.length === 0 ? "*" : ""}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={editVariants.length > 0 ? (editVariants.find(v => v.isActive !== false)?.purchasePrice ?? editData.purchasePrice) : editData.purchasePrice}
                                                onChange={(e) => setEditData({ ...editData, purchasePrice: Number(e.target.value) })}
                                                disabled={editVariants.length > 0}
                                                className={`w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] outline-none ${editVariants.length > 0 ? "opacity-50 blur-[0.4px] bg-[var(--bg-secondary)]/50 cursor-not-allowed select-none" : "focus:border-[var(--gold)]"}`}
                                                required={editVariants.length === 0}
                                            />
                                            {editVariants.length > 0 && (
                                                <span className="text-[10px] text-[var(--gold)] mt-1 block">From primary variant</span>
                                            )}
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Selling Price {editVariants.length === 0 ? "*" : ""}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={editVariants.length > 0 ? (editVariants.find(v => v.isActive !== false)?.sellingPrice ?? editData.sellingPrice) : editData.sellingPrice}
                                                onChange={(e) => setEditData({ ...editData, sellingPrice: Number(e.target.value) })}
                                                disabled={editVariants.length > 0}
                                                className={`w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] outline-none ${editVariants.length > 0 ? "opacity-50 blur-[0.4px] bg-[var(--bg-secondary)]/50 cursor-not-allowed select-none" : "focus:border-[var(--gold)]"}`}
                                                required={editVariants.length === 0}
                                            />
                                            {editVariants.length > 0 && (
                                                <span className="text-[10px] text-[var(--gold)] mt-1 block">From primary variant</span>
                                            )}
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">MRP {editVariants.length === 0 ? "*" : ""}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={editVariants.length > 0 ? (editVariants.find(v => v.isActive !== false)?.mrp ?? editData.mrp) : editData.mrp}
                                                onChange={(e) => setEditData({ ...editData, mrp: Number(e.target.value) })}
                                                disabled={editVariants.length > 0}
                                                className={`w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] outline-none ${editVariants.length > 0 ? "opacity-50 blur-[0.4px] bg-[var(--bg-secondary)]/50 cursor-not-allowed select-none" : "focus:border-[var(--gold)]"}`}
                                                required={editVariants.length === 0}
                                            />
                                            {editVariants.length > 0 && (
                                                <span className="text-[10px] text-[var(--gold)] mt-1 block">From primary variant</span>
                                            )}
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">GST Rate (%) *</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={editData.gstRate}
                                                onChange={(e) => setEditData({ ...editData, gstRate: Number(e.target.value) })}
                                                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none"
                                                required
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Min. Stock Level</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editData.minStockLevel}
                                                onChange={(e) => setEditData({ ...editData, minStockLevel: Number(e.target.value) })}
                                                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--border)] focus:border-[var(--gold)] outline-none"
                                            />
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

                                {/* Variations Management in Edit Modal */}
                                <div className="space-y-4 lg:col-span-3 border-t border-[var(--border)] pt-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                            Product Variations ({editVariants.length})
                                        </h4>
                                    </div>

                                    {editVariants.length > 0 && (
                                        <div className="overflow-x-auto border border-[var(--border)] rounded-[var(--radius-md)]">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                                    <tr>
                                                        <th className="p-2.5">Variant Name</th>
                                                        <th className="p-2.5">SKU</th>
                                                        <th className="p-2.5">Selling Price (₹)</th>
                                                        <th className="p-2.5">MRP (₹)</th>
                                                        <th className="p-2.5">Purchase Price (₹)</th>
                                                        <th className="p-2.5">In Stock ({editData.unit || product.unit || 'Units'})</th>
                                                        <th className="p-2.5 text-center">Active</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border)]">
                                                    {editVariants.map((v, idx) => (
                                                        <tr key={idx} className="hover:bg-[var(--bg-secondary)]/20">
                                                            <td className="p-2 font-medium text-[var(--text-primary)]">
                                                                <input
                                                                    value={v.name}
                                                                    onChange={(e) => {
                                                                        const next = [...editVariants];
                                                                        next[idx] = { ...next[idx], name: e.target.value };
                                                                        setEditVariants(next);
                                                                    }}
                                                                    className="w-full px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)]"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    value={v.sku}
                                                                    onChange={(e) => {
                                                                        const next = [...editVariants];
                                                                        next[idx] = { ...next[idx], sku: e.target.value };
                                                                        setEditVariants(next);
                                                                    }}
                                                                    className="w-28 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-[11px]"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={v.sellingPrice}
                                                                    onChange={(e) => {
                                                                        const next = [...editVariants];
                                                                        next[idx] = { ...next[idx], sellingPrice: Number(e.target.value) };
                                                                        setEditVariants(next);
                                                                    }}
                                                                    className="w-20 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-right"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={v.mrp}
                                                                    onChange={(e) => {
                                                                        const next = [...editVariants];
                                                                        next[idx] = { ...next[idx], mrp: Number(e.target.value) };
                                                                        setEditVariants(next);
                                                                    }}
                                                                    className="w-20 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-right"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={v.purchasePrice}
                                                                    onChange={(e) => {
                                                                        const next = [...editVariants];
                                                                        next[idx] = { ...next[idx], purchasePrice: Number(e.target.value) };
                                                                        setEditVariants(next);
                                                                    }}
                                                                    className="w-20 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-right"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="1"
                                                                    value={v.stock ?? 0}
                                                                    onChange={(e) => {
                                                                        const next = [...editVariants];
                                                                        next[idx] = { ...next[idx], stock: Math.max(0, Number(e.target.value)) };
                                                                        setEditVariants(next);
                                                                    }}
                                                                    className="w-20 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-right font-mono font-medium text-[var(--gold)]"
                                                                />
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={v.isActive !== false}
                                                                    onChange={(e) => {
                                                                        const next = [...editVariants];
                                                                        next[idx] = { ...next[idx], isActive: e.target.checked };
                                                                        setEditVariants(next);
                                                                    }}
                                                                    className="w-4 h-4 rounded text-[var(--gold)]"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Add New Variant Inline Form */}
                                    <div className="bg-[var(--bg-secondary)]/40 p-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] space-y-2">
                                        <span className="text-xs font-semibold text-[var(--text-secondary)] block">+ Add Another Variation</span>
                                        <div className="flex gap-2 items-center flex-wrap">
                                            <input
                                                placeholder="Variant Name (e.g. Blue / L)"
                                                value={newVariantName}
                                                onChange={(e) => setNewVariantName(e.target.value)}
                                                className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs rounded bg-[var(--bg-primary)] border border-[var(--border)]"
                                            />
                                            <input
                                                placeholder="SKU (optional)"
                                                value={newVariantSku}
                                                onChange={(e) => setNewVariantSku(e.target.value)}
                                                className="w-32 px-2.5 py-1.5 text-xs rounded bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-[11px]"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="Stock"
                                                value={newVariantStock || ""}
                                                onChange={(e) => setNewVariantStock(Number(e.target.value))}
                                                className="w-20 px-2.5 py-1.5 text-xs rounded bg-[var(--bg-primary)] border border-[var(--border)] text-right font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!newVariantName.trim()) return;
                                                    const cleanSuffix = newVariantName.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                                                    const prefix = editData.sku?.trim() || product?.sku?.trim() || "PRD";
                                                    let candidateSku = newVariantSku.trim() || `${prefix}-${cleanSuffix || "VAR"}`;
                                                    let uniqueSku = candidateSku;
                                                    let counter = 1;
                                                    while (editVariants.some(v => (v.sku || "").trim().toLowerCase() === uniqueSku.toLowerCase())) {
                                                        counter++;
                                                        uniqueSku = `${candidateSku}-${counter}`;
                                                    }
                                                    setEditVariants([
                                                        ...editVariants,
                                                        {
                                                            name: newVariantName.trim(),
                                                            sku: uniqueSku,
                                                            sellingPrice: Number(editData.sellingPrice) || 0,
                                                            mrp: Number(editData.mrp) || Number(editData.sellingPrice) || 0,
                                                            purchasePrice: Number(editData.purchasePrice) || 0,
                                                            stock: Math.max(0, Number(newVariantStock) || 0),
                                                            isActive: true,
                                                            attributes: { Option: newVariantName.trim() },
                                                        }
                                                    ]);
                                                    setNewVariantName("");
                                                    setNewVariantSku("");
                                                    setNewVariantStock(0);
                                                }}
                                                className="px-3 py-1.5 text-xs bg-[var(--gold)] text-[var(--bg-primary)] font-semibold rounded hover:opacity-90 transition"
                                            >
                                                Add Variant
                                            </button>
                                        </div>
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
