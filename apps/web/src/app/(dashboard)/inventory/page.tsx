"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Package, Warehouse, AlertTriangle, Clock, Search, List, Grid, Plus, ArrowRightLeft, ArrowUpRight, ArrowDownRight, ArrowRight, X, Filter, FileText, Upload, SlidersHorizontal, ArrowLeft, MoreHorizontal, FileDown, Eye, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useProducts, useInventoryValuation, useAdjustInventory, useTransferInventory, useInventoryTransactions, useCreateProduct, useWarehouses, useUploadFile } from "@/hooks/api-hooks";
import { formatDate, getPrimaryImageUrl } from "@/lib/utils";
import { ImageUpload } from "@/components/ui/image-upload";

function formatINR(n: number): string { return "₹" + n.toLocaleString("en-IN"); }

/* ─── Add Product Modal ─── */
function AddProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const create = useCreateProduct();
    const upload = useUploadFile();
    const [name, setName] = useState("");
    const [sku, setSku] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [unit, setUnit] = useState("Pieces");
    const [sellingPrice, setSellingPrice] = useState("");
    const [mrp, setMrp] = useState("");
    const [purchasePrice, setPurchasePrice] = useState("");
    const [minStockLevel, setMinStockLevel] = useState("10");
    const [gstRate, setGstRate] = useState("18");
    const [initialQuantity, setInitialQuantity] = useState("0");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !sku || !sellingPrice || !gstRate) return;
        create.mutate({
            name, sku, unit, imageUrl,
            sellingPrice: Number(sellingPrice),
            mrp: Number(mrp),
            purchasePrice: Number(purchasePrice),
            minStockLevel: Number(minStockLevel),
            gstRate: Number(gstRate),
            initialQuantity: Number(initialQuantity),
        }, {
            onSuccess: () => {
                onClose();
                setName(""); setSku(""); setImageUrl(""); setSellingPrice(""); setMrp(""); setPurchasePrice(""); setGstRate("18"); setInitialQuantity("0");
            }
        });
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                    <h2 className="text-base font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Add Product</h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Product Image</span>
                            <ImageUpload value={imageUrl} onChange={setImageUrl} onUpload={(file) => upload.mutateAsync(file)} disabled={create.isPending || upload.isPending} />
                        </div>
                        <label className="col-span-2">
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Product Name *</span>
                            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Parle G 250g" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">SKU *</span>
                            <input value={sku} onChange={(e) => setSku(e.target.value)} required placeholder="PARLE-G-250" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Unit</span>
                            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                                <option value="Pieces">Pieces</option>
                                <option value="Boxes">Boxes</option>
                                <option value="Cartons">Cartons</option>
                                <option value="Kg">Kg</option>
                            </select>
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Selling Price (₹) *</span>
                            <input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">MRP (₹)</span>
                            <input type="number" step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Purchase Price (₹)</span>
                            <input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">GST Rate (%) *</span>
                            <input type="number" step="1" min="0" value={gstRate} onChange={(e) => setGstRate(e.target.value)} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Initial Stock Qty</span>
                            <input type="number" min="0" value={initialQuantity} onChange={(e) => setInitialQuantity(e.target.value)} placeholder="0" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Min Stock Level</span>
                            <input type="number" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                    </div>
                    <div className="flex justify-end gap-3 pt-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">Cancel</button>
                        <button type="submit" disabled={create.isPending} className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                            {create.isPending ? "Saving..." : "Save Product"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Stock Adjust Modal ─── */
function AdjustModal({ open, onClose, products }: { open: boolean; onClose: () => void; products: Record<string, unknown>[] }) {
    const adjust = useAdjustInventory();
    const { data: whData } = useWarehouses();
    const warehouses = Array.isArray(whData) ? whData : (whData?.data ?? []);

    const [productId, setProductId] = useState("");
    const [warehouseId, setWarehouseId] = useState("");
    const [quantity, setQuantity] = useState(0);
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (warehouses.length === 1 && !warehouseId) setWarehouseId(warehouses[0].id);
    }, [warehouses, warehouseId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!productId || !warehouseId || quantity === 0) return;
        adjust.mutate({ productId, warehouseId, quantity, reason }, {
            onSuccess: () => { onClose(); setProductId(""); setWarehouseId(""); setQuantity(0); setReason(""); },
        });
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Adjust Stock</h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Product</span>
                        <select value={productId} onChange={(e) => setProductId(e.target.value)} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                            <option value="">Select...</option>
                            {products.map((p) => <option key={p.id as string} value={p.id as string}>{p.name as string} ({p.sku as string})</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Warehouse</span>
                        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                            <option value="">Select warehouse...</option>
                            {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Quantity (+/-)</span>
                        <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">Use positive to add, negative to remove</p>
                    </label>
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Reason</span>
                        <input value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="e.g. Damaged goods, Count correction" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                    </label>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">Cancel</button>
                        <button type="submit" disabled={adjust.isPending} className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                            {adjust.isPending ? "Adjusting..." : "Adjust Stock"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Stock Transfer Modal ─── */
function TransferModal({ open, onClose, products }: { open: boolean; onClose: () => void; products: Record<string, unknown>[] }) {
    const transfer = useTransferInventory();
    const { data: whData } = useWarehouses();
    const warehouses = Array.isArray(whData) ? whData : (whData?.data ?? []);
    const [productId, setProductId] = useState("");
    const [fromWarehouseId, setFromWarehouseId] = useState("");
    const [toWarehouseId, setToWarehouseId] = useState("");
    const [quantity, setQuantity] = useState(1);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!productId || !fromWarehouseId || !toWarehouseId || quantity < 1) return;
        transfer.mutate({ productId, fromWarehouseId, toWarehouseId, quantity }, {
            onSuccess: () => { onClose(); setProductId(""); setFromWarehouseId(""); setToWarehouseId(""); setQuantity(1); },
        });
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Transfer Stock</h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Product</span>
                        <select value={productId} onChange={(e) => setProductId(e.target.value)} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                            <option value="">Select...</option>
                            {products.map((p) => <option key={p.id as string} value={p.id as string}>{p.name as string} ({p.sku as string})</option>)}
                        </select>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">From Warehouse</span>
                            <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                                <option value="">Select...</option>
                                {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">To Warehouse</span>
                            <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                                <option value="">Select...</option>
                                {warehouses.filter((w: any) => w.id !== fromWarehouseId).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </label>
                    </div>
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Quantity</span>
                        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                    </label>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">Cancel</button>
                        <button type="submit" disabled={transfer.isPending} className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--purple)] text-white hover:opacity-90 disabled:opacity-50 transition">
                            {transfer.isPending ? "Transferring..." : "Transfer"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Inventory Page ─── */
export default function InventoryPage() {
    const [mainTab, setMainTab] = useState<"products" | "transactions">("products");
    const [tab, setTab] = useState<"all" | "low" | "expiring">("all");
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [showAdd, setShowAdd] = useState(false);
    const [showAdjust, setShowAdjust] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);

    const { data, isLoading } = useProducts({ search, page, limit: 20, isActive: true });
    const products = data?.data?.data ?? data?.data ?? [];
    const meta = data?.data?.meta ?? data?.meta ?? { total: 0 };

    const { data: valuation } = useInventoryValuation();
    const val = valuation?.data ?? valuation ?? {};

    const { data: txnData } = useInventoryTransactions({ page: 1, limit: 30 });
    const transactions = txnData?.data?.data ?? txnData?.data ?? [];

    const lowStockCount = Array.isArray(products) ? products.filter((p: Record<string, unknown>) => ((p.totalQuantity as number) ?? 0) <= ((p.minStockLevel as number) ?? 10)).length : 0;

    const displayProducts = Array.isArray(products) ? products.filter((p: Record<string, unknown>) => {
        if (tab === "low") return ((p.totalQuantity as number) ?? 0) <= ((p.minStockLevel as number) ?? 10);
        if (tab === "expiring") return false; // Mock filtering logic if no expiry backend
        return true;
    }) : [];

    const summary = [
        { label: "Total Products", value: meta.total ?? 0, icon: Package, color: "var(--gold)" },
        { label: "Total Value", value: formatINR(val.grandTotal ?? 0), icon: Warehouse, color: "var(--green-bright)" },
        { label: "Low Stock", value: lowStockCount, icon: AlertTriangle, color: "var(--red)" },
        { label: "Total Units", value: val.totalUnits ?? 0, icon: Clock, color: "var(--orange)" },
    ];

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Inventory</h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition whitespace-nowrap"><Plus size={14} /> <span className="hidden sm:inline">Add Product</span><span className="sm:hidden">Add</span></button>
                    <button onClick={() => setShowAdjust(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition whitespace-nowrap"><Plus size={14} /> Adjust</button>
                    <button onClick={() => setShowTransfer(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition whitespace-nowrap"><ArrowRightLeft size={14} /> <span className="hidden sm:inline">Transfer</span></button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {summary.map((s) => (
                    <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <s.icon size={14} style={{ color: s.color }} />
                            <span className="text-xs text-[var(--text-muted)]">{s.label}</span>
                        </div>
                        <p className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Main Tabs */}
            <div className="flex gap-2 mb-4">
                <button onClick={() => setMainTab("products")} className={`px-4 py-2 text-sm rounded-[var(--radius-md)] transition ${mainTab === "products" ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)]"}`}>Products</button>
                <button onClick={() => setMainTab("transactions")} className={`px-4 py-2 text-sm rounded-[var(--radius-md)] transition ${mainTab === "transactions" ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)]"}`}>Transactions</button>
            </div>

            {mainTab === "products" ? (
                <>
                    {/* Filters */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex gap-1">
                            {(["all", "low", "expiring"] as const).map((t) => (
                                <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs rounded-full transition capitalize ${tab === t ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
                                    {t === "all" ? "All" : t === "low" ? "Low Stock" : "Expiring"}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full pl-9 pr-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </div>
                        <div className="flex border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                            <button onClick={() => setViewMode("grid")} className={`p-2 ${viewMode === "grid" ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "text-[var(--text-muted)]"}`}><Grid size={16} /></button>
                            <button onClick={() => setViewMode("table")} className={`p-2 ${viewMode === "table" ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "text-[var(--text-muted)]"}`}><List size={16} /></button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-36 rounded-[var(--radius-md)]" />)}
                        </div>
                    ) : viewMode === "grid" ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {displayProducts.map((p: Record<string, unknown>) => {
                                const qty = (p.totalQuantity as number) ?? 0;
                                const minStock = (p.minStockLevel as number) ?? 10;
                                const maxStock = (p.maxStockLevel as number) ?? 100;
                                const pct = Math.min((qty / maxStock) * 100, 100);
                                const stockColor = qty <= minStock ? "var(--red)" : qty <= minStock * 2 ? "var(--warning)" : "var(--green-bright)";
                                return (
                                    <Link key={p.id as string} href={`/inventory/products/${p.id}`} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4 hover:border-[var(--border-accent)] transition group flex flex-col h-full">
                                        <div className="flex gap-3 mb-3">
                                            {getPrimaryImageUrl(p.imageUrl) ? (
                                                <img src={getPrimaryImageUrl(p.imageUrl)} alt={p.name as string} className="w-12 h-12 rounded object-contain border border-[var(--border)] bg-[var(--bg-secondary)] shrink-0" />
                                            ) : (
                                                <div className="w-12 h-12 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] border border-[var(--border)] shrink-0"><Package size={20} /></div>
                                            )}
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-sm font-medium mb-0.5 truncate">{p.name as string}</p>
                                                <p className="text-xs text-[var(--text-muted)] truncate">{(p.brand as string) ?? ""} · {p.sku as string}</p>
                                            </div>
                                        </div>
                                        <div className="mt-auto">
                                            <p className="text-2xl font-bold mb-0.5 mt-2" style={{ fontFamily: "var(--font-mono)", color: stockColor }}>
                                                {qty} <span className="text-sm font-normal text-[var(--text-muted)]">{p.unit as string}</span>
                                            </p>
                                            {(p.secondaryUnit as string | null | undefined) && (
                                                <p className="text-xs text-[var(--text-muted)] mt-1 mb-2 font-mono">
                                                    ({qty * ((p.conversionFactor as number) || 1)} {p.secondaryUnit as string})
                                                </p>
                                            )}
                                        </div>
                                        <div className="h-1.5 rounded-full bg-[var(--border)] mb-1">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: stockColor }} />
                                        </div>
                                        <p className="text-[10px] text-[var(--text-muted)]">Min: {minStock}</p>
                                        {qty <= minStock && (
                                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="mt-2 w-full py-1.5 text-xs rounded bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/15 hover:bg-[var(--red)]/20 transition">Reorder</button>
                                        )}
                                    </Link>
                                );
                            })}
                            {displayProducts.length === 0 && (
                                <div className="col-span-4 text-center py-12 text-[var(--text-muted)]">No products found</div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase">
                                    <th className="text-left p-4">Product</th><th className="text-left p-4">SKU</th><th className="text-right p-4">Stock</th><th className="text-right p-4">Price</th><th className="text-right p-4">MRP</th>
                                </tr></thead>
                                <tbody>
                                    {displayProducts.map((p: Record<string, unknown>) => (
                                        <tr key={p.id as string} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                            <td className="p-4 font-medium flex items-center gap-3">
                                                {getPrimaryImageUrl(p.imageUrl) ? (
                                                    <img src={getPrimaryImageUrl(p.imageUrl)} alt={p.name as string} className="w-8 h-8 rounded object-contain border border-[var(--border)] bg-[var(--bg-secondary)] shrink-0" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] border border-[var(--border)] shrink-0"><Package size={14} /></div>
                                                )}
                                                <Link href={`/inventory/products/${p.id}`} className="text-[var(--gold)] hover:underline truncate">{p.name as string}</Link>
                                            </td>
                                            <td className="p-4 text-left">{(p.sku as string) || "-"}</td>
                                            <td className="p-4 text-right">
                                                <div style={{ fontFamily: "var(--font-mono)" }}>{(p.totalQuantity as number) ?? 0} {p.unit as string}</div>
                                                {(p.secondaryUnit as string | null | undefined) && (
                                                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                                        ({((p.totalQuantity as number) ?? 0) * ((p.conversionFactor as number) || 1)} {p.secondaryUnit as string})
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)" }}>{formatINR((p.sellingPrice as number) ?? 0)}</td>
                                            <td className="p-4 text-right text-[var(--text-muted)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR((p.mrp as number) ?? 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            ) : (
                /* Transactions Tab */
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                            <th className="text-left p-4">Date</th><th className="text-left p-4">Type</th><th className="text-right p-4">Qty</th><th className="text-left p-4">Reference</th>
                        </tr></thead>
                        <tbody>
                            {(Array.isArray(transactions) ? transactions : []).length === 0 ? (
                                <tr><td colSpan={4} className="p-12 text-center text-[var(--text-muted)]">No transactions yet</td></tr>
                            ) : (Array.isArray(transactions) ? transactions : []).map((t: Record<string, unknown>, i: number) => (
                                <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                    <td className="p-4 text-[var(--text-secondary)]">{formatDate(t.createdAt as string)}</td>
                                    <td className="p-4"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(t.type as string) === "IN" ? "bg-[var(--green)]/15 text-[var(--green-bright)]" : (t.type as string) === "OUT" ? "bg-[var(--red)]/15 text-[var(--red)]" : "bg-[var(--gold)]/15 text-[var(--gold)]"}`}>{t.type as string}</span></td>
                                    <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)", color: (t.quantity as number) >= 0 ? "var(--green-bright)" : "var(--red)" }}>{(t.quantity as number) > 0 ? "+" : ""}{t.quantity as number}</td>
                                    <td className="p-4 text-[var(--text-muted)]">{(t.referenceType as string) ?? ""} {(t.referenceId as string)?.slice(0, 8) ?? ""}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AddProductModal open={showAdd} onClose={() => setShowAdd(false)} />
            <AdjustModal open={showAdjust} onClose={() => setShowAdjust(false)} products={Array.isArray(products) ? products : []} />
            <TransferModal open={showTransfer} onClose={() => setShowTransfer(false)} products={Array.isArray(products) ? products : []} />
        </div>
    );
}
