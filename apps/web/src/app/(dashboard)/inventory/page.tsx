"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Package, Warehouse, AlertTriangle, Clock, Search, List, Grid, Plus, ArrowRightLeft, ArrowUpRight, ArrowDownRight, ArrowRight, X, Filter, FileText, Upload, SlidersHorizontal, ArrowLeft, MoreHorizontal, FileDown, Eye, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useProducts, useInventoryValuation, useAdjustInventory, useTransferInventory, useInventoryTransactions, useCreateProduct, useWarehouses, useUploadFile } from "@/hooks/api-hooks";
import { formatDate, getPrimaryImageUrl, formatINR } from "@/lib/utils";
import { ImageUpload } from "@/components/ui/image-upload";
import { MultiImageUpload } from "@/components/ui/multi-image-upload";
import { useLanguage } from "@/contexts/LanguageContext";


const STANDARD_UNITS = [
    "Pieces", "Boxes", "Cartons", "Packs", "Dozen", "Sets", "Bags", "Bundles", "Rolls",
    "Kg", "Grams", "Quintal", "Tonne",
    "Litres", "Millilitres", "Bottles", "Tins", "Drums", "Jars", "Buckets",
    "Meters", "Feet", "Sq Feet", "Sq Meter"
];

/* ─── Add Product Modal ─── */
function AddProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const create = useCreateProduct();
    const upload = useUploadFile();
    const [name, setName] = useState("");
    const [sku, setSku] = useState("");
    const [description, setDescription] = useState("");
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [unit, setUnit] = useState("Pieces");
    const [isCustomUnit, setIsCustomUnit] = useState(false);
    const [customUnit, setCustomUnit] = useState("");
    const [sellingPrice, setSellingPrice] = useState("");
    const [mrp, setMrp] = useState("");
    const [purchasePrice, setPurchasePrice] = useState("");
    const [minStockLevel, setMinStockLevel] = useState("10");
    const [gstRate, setGstRate] = useState("18");
    const [initialQuantity, setInitialQuantity] = useState("0");
    const [draftRestored, setDraftRestored] = useState(false);
    const DRAFT_STORAGE_KEY = "distroai_new_product_draft";

    // Variation State (strictly product-specific)
    const [hasVariants, setHasVariants] = useState(false);
    const [attributes, setAttributes] = useState<{ name: string; valInput: string; values: string[] }[]>([
        { name: "Color", valInput: "", values: [] }
    ]);
    const [variants, setVariants] = useState<{
        name: string;
        sku: string;
        attributes: Record<string, string>;
        sellingPrice: number;
        mrp: number;
        purchasePrice: number;
        initialQuantity: number;
    }[]>([]);

    const resetForm = () => {
        try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
        setName("");
        setSku("");
        setDescription("");
        setImageUrls([]);
        setUnit("Pieces");
        setIsCustomUnit(false);
        setCustomUnit("");
        setSellingPrice("");
        setMrp("");
        setPurchasePrice("");
        setMinStockLevel("10");
        setGstRate("18");
        setInitialQuantity("0");
        setHasVariants(false);
        setAttributes([{ name: "Color", valInput: "", values: [] }]);
        setVariants([]);
        setDraftRestored(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    // Restore draft from localStorage when modal opens
    useEffect(() => {
        if (!open) return;
        try {
            const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.name || parsed.sku || parsed.sellingPrice || parsed.description) {
                    setName(parsed.name || "");
                    setSku(parsed.sku || "");
                    setDescription(parsed.description || "");
                    setImageUrls(Array.isArray(parsed.imageUrls) ? parsed.imageUrls : []);
                    if (parsed.unit) {
                        if (STANDARD_UNITS.includes(parsed.unit)) {
                            setUnit(parsed.unit);
                            setIsCustomUnit(false);
                            setCustomUnit("");
                        } else {
                            setUnit(parsed.unit);
                            setIsCustomUnit(true);
                            setCustomUnit(parsed.unit);
                        }
                    } else {
                        setUnit("Pieces");
                        setIsCustomUnit(false);
                        setCustomUnit("");
                    }
                    setSellingPrice(parsed.sellingPrice || "");
                    setMrp(parsed.mrp || "");
                    setPurchasePrice(parsed.purchasePrice || "");
                    setMinStockLevel(parsed.minStockLevel || "10");
                    setGstRate(parsed.gstRate || "18");
                    setInitialQuantity(parsed.initialQuantity || "0");
                    if (parsed.hasVariants) {
                        setHasVariants(true);
                        if (parsed.attributes) setAttributes(parsed.attributes);
                        if (parsed.variants) setVariants(parsed.variants);
                    }
                    setDraftRestored(true);
                    return;
                }
            }
        } catch (e) {
            console.error("Failed to restore draft product", e);
        }
        // If no draft found, ensure form is clean
        resetForm();
    }, [open]);

    // Auto-save draft changes to localStorage
    useEffect(() => {
        if (!open) return;
        if (!name && !sku && !description && imageUrls.length === 0 && !sellingPrice) return;
        const timer = setTimeout(() => {
            try {
                const effectiveUnit = (isCustomUnit ? customUnit.trim() : unit) || "Pieces";
                localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
                    name, sku, description, imageUrls, unit: effectiveUnit, sellingPrice, mrp,
                    purchasePrice, minStockLevel, gstRate, initialQuantity,
                    hasVariants, attributes, variants,
                }));
            } catch {}
        }, 500);
        return () => clearTimeout(timer);
    }, [open, name, sku, description, imageUrls, unit, isCustomUnit, customUnit, sellingPrice, mrp, purchasePrice, minStockLevel, gstRate, initialQuantity, hasVariants, attributes, variants]);

    const discardDraft = () => {
        resetForm();
        toast.success("Draft discarded");
    };

    const addAttribute = () => {
        setAttributes([...attributes, { name: "", valInput: "", values: [] }]);
    };

    const removeAttribute = (idx: number) => {
        const next = attributes.filter((_, i) => i !== idx);
        setAttributes(next);
        generateVariantsFromAttrs(next);
    };

    const addAttrValue = (attrIdx: number) => {
        const attr = attributes[attrIdx];
        const val = attr.valInput.trim();
        if (!val || attr.values.includes(val)) return;
        const nextValues = [...attr.values, val];
        const nextAttrs = attributes.map((a, i) => i === attrIdx ? { ...a, valInput: "", values: nextValues } : a);
        setAttributes(nextAttrs);
        generateVariantsFromAttrs(nextAttrs);
    };

    const removeAttrValue = (attrIdx: number, valIdx: number) => {
        const nextAttrs = attributes.map((a, i) => {
            if (i !== attrIdx) return a;
            return { ...a, values: a.values.filter((_, vi) => vi !== valIdx) };
        });
        setAttributes(nextAttrs);
        generateVariantsFromAttrs(nextAttrs);
    };

    const generateVariantsFromAttrs = (attrsList: typeof attributes) => {
        const validAttrs = attrsList.filter(a => a.name.trim() && a.values.length > 0);
        if (validAttrs.length === 0) {
            setVariants([]);
            return;
        }

        // Cartesian product
        const cartesian = (lists: { name: string; values: string[] }[]): Record<string, string>[] => {
            return lists.reduce<Record<string, string>[]>((acc, curr) => {
                const res: Record<string, string>[] = [];
                for (const existing of acc) {
                    for (const v of curr.values) {
                        res.push({ ...existing, [curr.name.trim()]: v });
                    }
                }
                return res;
            }, [{}]);
        };

        const combinations = cartesian(validAttrs);
        const baseSku = sku.trim() || "PRD";
        const baseSell = Number(sellingPrice) || 0;
        const baseMrp = Number(mrp) || baseSell;
        const baseBuy = Number(purchasePrice) || 0;

        const generated = combinations.map(combo => {
            const variantName = Object.values(combo).join(" / ");
            const skuSuffix = Object.values(combo)
                .map(v => v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4))
                .join("-");
            return {
                name: variantName,
                sku: `${baseSku}-${skuSuffix}`,
                attributes: combo,
                sellingPrice: baseSell,
                mrp: baseMrp,
                purchasePrice: baseBuy,
                initialQuantity: 0,
            };
        });

        setVariants(generated);
    };

    const updateVariantRow = (idx: number, key: string, val: any) => {
        setVariants(variants.map((v, i) => i === idx ? { ...v, [key]: val } : v));
    };

    const removeVariantRow = (idx: number) => {
        setVariants(variants.filter((_, i) => i !== idx));
    };

    const handleSave = (isDraftMode: boolean) => {
        const effectiveUnit = (isCustomUnit ? customUnit.trim() : unit) || "Pieces";

        if (isDraftMode) {
            if (!name.trim()) {
                toast.error("Please enter a Product Name to save as draft");
                return;
            }

            const payload: Record<string, any> = {
                name: name.trim(),
                sku: sku.trim() || undefined,
                unit: effectiveUnit,
                description: description.trim() || undefined,
                imageUrl: imageUrls[0] || "",
                imageUrls,
                sellingPrice: Number(sellingPrice) || 0,
                mrp: Number(mrp) || (Number(sellingPrice) || 0),
                purchasePrice: Number(purchasePrice) || 0,
                minStockLevel: Number(minStockLevel) || 0,
                gstRate: Number(gstRate) || 0,
                initialQuantity: hasVariants ? 0 : (Number(initialQuantity) || 0),
                hasVariants,
                isDraft: true,
            };

            if (hasVariants && variants.length > 0) {
                payload.variantAttributes = attributes
                    .filter(a => a.name.trim() && a.values.length > 0)
                    .map(a => ({ name: a.name.trim(), values: a.values }));
                payload.variants = variants;
            }

            create.mutate(payload as any, {
                onSuccess: () => {
                    resetForm();
                    onClose();
                    toast.success("Product draft saved successfully");
                }
            });
        } else {
            if (!name.trim() || !sku.trim() || !sellingPrice || !gstRate) {
                toast.error("Name, SKU, Selling Price, and GST Rate are required");
                return;
            }

            const payload: Record<string, any> = {
                name: name.trim(),
                sku: sku.trim(),
                unit: effectiveUnit,
                description: description.trim() || undefined,
                imageUrl: imageUrls[0] || "",
                imageUrls,
                sellingPrice: Number(sellingPrice),
                mrp: Number(mrp) || Number(sellingPrice),
                purchasePrice: Number(purchasePrice) || 0,
                minStockLevel: Number(minStockLevel) || 0,
                gstRate: Number(gstRate),
                initialQuantity: hasVariants ? 0 : Number(initialQuantity),
                hasVariants,
                isDraft: false,
            };

            if (hasVariants && variants.length > 0) {
                payload.variantAttributes = attributes
                    .filter(a => a.name.trim() && a.values.length > 0)
                    .map(a => ({ name: a.name.trim(), values: a.values }));
                payload.variants = variants;
            }

            create.mutate(payload as any, {
                onSuccess: () => {
                    resetForm();
                    onClose();
                    toast.success("Product added successfully");
                }
            });
        }
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
            <div className={`bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full ${hasVariants ? 'max-w-3xl' : 'max-w-md'} shadow-2xl max-h-[92vh] overflow-y-auto transition-all`} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-primary)] z-10">
                    <h2 className="text-base font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Add Product</h2>
                    <button onClick={handleClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={18} /></button>
                </div>
                {draftRestored && (
                    <div className="mx-4 mt-3 p-2.5 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            Unsaved draft auto-restored
                        </span>
                        <button
                            type="button"
                            onClick={discardDraft}
                            className="underline hover:text-amber-200 font-medium"
                        >
                            Discard Draft
                        </button>
                    </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); handleSave(false); }} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Product Images</span>
                            <MultiImageUpload value={imageUrls} onChange={setImageUrls} onUpload={(file) => upload.mutateAsync(file)} disabled={create.isPending || upload.isPending} />
                        </div>
                        <label className="col-span-2">
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Product Name *</span>
                            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Parle G 250g" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Base SKU *</span>
                            <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="PARLE-G-250 (auto-generated if blank)" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <div className="space-y-1">
                            <span className="text-xs text-[var(--text-muted)] block">Unit</span>
                            <select
                                value={isCustomUnit ? "__custom__" : unit}
                                onChange={(e) => {
                                    if (e.target.value === "__custom__") {
                                        setIsCustomUnit(true);
                                    } else {
                                        setIsCustomUnit(false);
                                        setUnit(e.target.value);
                                    }
                                }}
                                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                            >
                                <optgroup label="Packaging / Count">
                                    <option value="Pieces">Pieces</option>
                                    <option value="Boxes">Boxes</option>
                                    <option value="Cartons">Cartons</option>
                                    <option value="Packs">Packs</option>
                                    <option value="Dozen">Dozen</option>
                                    <option value="Sets">Sets</option>
                                    <option value="Bags">Bags</option>
                                    <option value="Bundles">Bundles</option>
                                    <option value="Rolls">Rolls</option>
                                </optgroup>
                                <optgroup label="Weight">
                                    <option value="Kg">Kg (Kilograms)</option>
                                    <option value="Grams">Grams</option>
                                    <option value="Quintal">Quintal</option>
                                    <option value="Tonne">Metric Tonne</option>
                                </optgroup>
                                <optgroup label="Volume / Liquid">
                                    <option value="Litres">Litres</option>
                                    <option value="Millilitres">Millilitres</option>
                                    <option value="Bottles">Bottles</option>
                                    <option value="Tins">Tins</option>
                                    <option value="Drums">Drums</option>
                                    <option value="Jars">Jars</option>
                                    <option value="Buckets">Buckets</option>
                                </optgroup>
                                <optgroup label="Length / Area">
                                    <option value="Meters">Meters</option>
                                    <option value="Feet">Feet</option>
                                    <option value="Sq Feet">Sq Feet</option>
                                    <option value="Sq Meter">Sq Meter</option>
                                </optgroup>
                                <optgroup label="Custom">
                                    <option value="__custom__">+ Custom Unit...</option>
                                </optgroup>
                            </select>
                            {isCustomUnit && (
                                <div className="pt-1">
                                    <input
                                        type="text"
                                        placeholder="Enter custom unit (e.g. Sachet, Can, Pair)"
                                        value={customUnit}
                                        onChange={(e) => setCustomUnit(e.target.value)}
                                        autoFocus
                                        className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--bg-primary)] border border-[var(--gold)] text-[var(--text-primary)] focus:outline-none transition placeholder:text-[var(--text-muted)]"
                                    />
                                </div>
                            )}
                        </div>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Base Selling Price (₹) *</span>
                            <input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Base MRP (₹)</span>
                            <input type="number" step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Base Purchase Price (₹)</span>
                            <input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>
                        <label>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">GST Rate (%) *</span>
                            <input type="number" step="1" min="0" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>

                        {!hasVariants && (
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Initial Stock Qty</span>
                                <input type="number" min="0" value={initialQuantity} onChange={(e) => setInitialQuantity(e.target.value)} placeholder="0" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                        )}
                        <label className={hasVariants ? "col-span-2" : ""}>
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Min Stock Level</span>
                            <input type="number" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </label>

                        {/* Product Variations Toggle */}
                        <div className="col-span-2 pt-2 pb-1 border-t border-[var(--border)]">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={hasVariants}
                                    onChange={(e) => {
                                        setHasVariants(e.target.checked);
                                        if (e.target.checked && attributes[0]?.values.length > 0) {
                                            generateVariantsFromAttrs(attributes);
                                        }
                                    }}
                                    className="w-4 h-4 rounded text-[var(--gold)] focus:ring-[var(--gold)]"
                                />
                                <div>
                                    <span className="text-sm font-semibold text-[var(--text-primary)]">This product has multiple variations</span>
                                    <p className="text-xs text-[var(--text-muted)]">e.g. Multiple colors, sizes, or packs under the same product</p>
                                </div>
                            </label>
                        </div>

                        {/* Variation Builder */}
                        {hasVariants && (
                            <div className="col-span-2 space-y-4 bg-[var(--bg-secondary)]/50 p-3 rounded-[var(--radius-md)] border border-[var(--border)]">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">1. Define Attributes & Options</span>
                                        <button
                                            type="button"
                                            onClick={addAttribute}
                                            className="text-xs text-[var(--gold)] hover:underline flex items-center gap-1 font-medium"
                                        >
                                            <Plus size={13} /> Add another attribute
                                        </button>
                                    </div>

                                    {attributes.map((attr, aIdx) => (
                                        <div key={aIdx} className="bg-[var(--bg-primary)] p-3 rounded border border-[var(--border)] space-y-2">
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    placeholder="Attribute name (e.g. Color, Size)"
                                                    value={attr.name}
                                                    onChange={(e) => {
                                                        const next = attributes.map((a, i) => i === aIdx ? { ...a, name: e.target.value } : a);
                                                        setAttributes(next);
                                                    }}
                                                    className="w-1/3 px-2.5 py-1.5 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                                                />
                                                <div className="flex-1 flex gap-1.5">
                                                    <input
                                                        placeholder="Type option and press Add (e.g. Red)"
                                                        value={attr.valInput}
                                                        onChange={(e) => {
                                                            const next = attributes.map((a, i) => i === aIdx ? { ...a, valInput: e.target.value } : a);
                                                            setAttributes(next);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                addAttrValue(aIdx);
                                                            }
                                                        }}
                                                        className="flex-1 px-2.5 py-1.5 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => addAttrValue(aIdx)}
                                                        className="px-3 py-1.5 text-xs bg-[var(--gold)] text-[var(--bg-primary)] font-semibold rounded hover:opacity-90 transition"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                                {attributes.length > 1 && (
                                                    <button type="button" onClick={() => removeAttribute(aIdx)} className="text-[var(--red)] hover:opacity-80 p-1">
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Attribute Value Pills */}
                                            {attr.values.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {attr.values.map((val, vIdx) => (
                                                        <span key={vIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]">
                                                            {val}
                                                            <button type="button" onClick={() => removeAttrValue(aIdx, vIdx)} className="text-[var(--text-muted)] hover:text-[var(--red)]">
                                                                <X size={12} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Generated Combinations Table */}
                                {variants.length > 0 && (
                                    <div className="space-y-2 pt-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                                                2. Variant Combination Rows ({variants.length})
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => generateVariantsFromAttrs(attributes)}
                                                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                            >
                                                Regenerate
                                            </button>
                                        </div>

                                        <div className="overflow-x-auto border border-[var(--border)] rounded max-h-56 overflow-y-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] sticky top-0">
                                                    <tr>
                                                        <th className="p-2">Variant</th>
                                                        <th className="p-2">SKU</th>
                                                        <th className="p-2">Price (₹)</th>
                                                        <th className="p-2">MRP (₹)</th>
                                                        <th className="p-2">Buy Price (₹)</th>
                                                        <th className="p-2">Stock</th>
                                                        <th className="p-2 w-8"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border)]">
                                                    {variants.map((v, idx) => (
                                                        <tr key={idx} className="hover:bg-[var(--bg-secondary)]/30">
                                                            <td className="p-2 font-medium text-[var(--text-primary)] whitespace-nowrap">{v.name}</td>
                                                            <td className="p-2">
                                                                <input
                                                                    value={v.sku}
                                                                    onChange={(e) => updateVariantRow(idx, "sku", e.target.value)}
                                                                    className="w-24 px-1.5 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)]"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={v.sellingPrice}
                                                                    onChange={(e) => updateVariantRow(idx, "sellingPrice", Number(e.target.value))}
                                                                    className="w-16 px-1.5 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)]"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={v.mrp}
                                                                    onChange={(e) => updateVariantRow(idx, "mrp", Number(e.target.value))}
                                                                    className="w-16 px-1.5 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)]"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={v.purchasePrice}
                                                                    onChange={(e) => updateVariantRow(idx, "purchasePrice", Number(e.target.value))}
                                                                    className="w-16 px-1.5 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)]"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={v.initialQuantity}
                                                                    onChange={(e) => updateVariantRow(idx, "initialQuantity", Number(e.target.value))}
                                                                    className="w-14 px-1.5 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)]"
                                                                />
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <button type="button" onClick={() => removeVariantRow(idx)} className="text-[var(--red)] hover:opacity-80">
                                                                    <X size={13} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="col-span-2">
                            <span className="text-xs text-[var(--text-muted)] mb-1 block">Product Description</span>
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter rich product details to show up in the customer storefront..." rows={3} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition resize-vertical" />
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[var(--border)]">
                        <button
                            type="button"
                            onClick={() => handleSave(true)}
                            disabled={create.isPending || !name.trim()}
                            className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 transition font-medium text-center"
                        >
                            {create.isPending ? "Saving..." : "Save as Draft"}
                        </button>
                        <div className="flex items-center justify-end gap-3">
                            <button type="button" onClick={handleClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                                Cancel
                            </button>
                            <button type="submit" disabled={create.isPending} className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                                {create.isPending ? "Saving..." : "Save Product"}
                            </button>
                        </div>
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
                        <select value={reason} onChange={(e) => setReason(e.target.value)} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                            <option value="">Select reason...</option>
                            <option value="Damaged/Expired">Damaged / Expired</option>
                            <option value="Count Correction">Count Correction</option>
                            <option value="Returned by Customer">Returned by Customer</option>
                            <option value="Opening Stock">Opening Stock</option>
                            <option value="Sample/Promo">Sample / Promo</option>
                            <option value="Theft/Loss">Theft / Loss</option>
                            <option value="Transfer">Transfer (Inter-Warehouse)</option>
                            <option value="Other">Other</option>
                        </select>
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
    const [tab, setTab] = useState<"all" | "active" | "drafts" | "low" | "archived">("all");
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [showAdd, setShowAdd] = useState(false);
    const [showAdjust, setShowAdjust] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);
    const { t } = useLanguage();

    const { data, isLoading } = useProducts({
        search,
        page,
        limit: 20,
        ...(tab === "archived" ? { isActive: false } : {}),
        ...(tab === "active" ? { isActive: true, isDraft: false } : {}),
        ...(tab === "drafts" ? { isDraft: true } : {}),
    });
    const products = data?.data?.data ?? data?.data ?? [];
    const meta = data?.data?.meta ?? data?.meta ?? { total: 0 };

    const { data: valuation } = useInventoryValuation();
    const val = valuation?.data ?? valuation ?? {};

    const { data: txnData } = useInventoryTransactions({ page: 1, limit: 30 });
    const transactions = txnData?.data?.data ?? txnData?.data ?? [];

    const lowStockCount = Array.isArray(products) ? products.filter((p: Record<string, unknown>) => ((p.totalQuantity as number) ?? 0) <= ((p.minStockLevel as number) ?? 10)).length : 0;

    const displayProducts = Array.isArray(products) ? products.filter((p: Record<string, unknown>) => {
        if (tab === "low") return ((p.totalQuantity as number) ?? 0) <= ((p.minStockLevel as number) ?? 10);
        return true;
    }) : [];

    const summary = [
        { label: t('total_products'), value: meta.total ?? 0, icon: Package, color: "var(--gold)" },
        { label: t('total_value'), value: formatINR(val.grandTotal ?? 0), icon: Warehouse, color: "var(--green-bright)" },
        { label: t('low_stock'), value: lowStockCount, icon: AlertTriangle, color: "var(--red)" },
        { label: t('total_units'), value: val.totalUnits ?? 0, icon: Clock, color: "var(--orange)" },
    ];

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>{t('inventory')}</h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition whitespace-nowrap"><Plus size={14} /> <span className="hidden sm:inline">{t('add_product')}</span><span className="sm:hidden">{t('add_product').split(' ')[0]}</span></button>
                    <button onClick={() => setShowAdjust(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition whitespace-nowrap"><Plus size={14} /> {t('adjust')}</button>
                    <button onClick={() => setShowTransfer(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition whitespace-nowrap"><ArrowRightLeft size={14} /> <span className="hidden sm:inline">{t('transfer')}</span></button>
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
                <button onClick={() => setMainTab("products")} className={`px-4 py-2 text-sm rounded-[var(--radius-md)] transition ${mainTab === "products" ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)]"}`}>{t('products_tab')}</button>
                <button onClick={() => setMainTab("transactions")} className={`px-4 py-2 text-sm rounded-[var(--radius-md)] transition ${mainTab === "transactions" ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)]"}`}>{t('transactions_tab')}</button>
            </div>

            {mainTab === "products" ? (
                <>
                    {/* Filters */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-1 overflow-x-auto no-scrollbar">
                            {(["all", "active", "drafts", "low", "archived"] as const).map((f) => (
                                <button key={f} onClick={() => { setTab(f); setPage(1); }} className={`px-4 py-1.5 text-sm rounded ${tab === f ? "bg-[var(--gold)]/10 text-[var(--gold)] font-medium" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                                    {f === "all" ? t('all') : f === "active" ? "Active" : f === "drafts" ? "Drafts" : f === "low" ? t('low_stock_tab') : "Archived"}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_products')} className="w-full pl-9 pr-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
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
                                                <p className="text-sm font-medium mb-0.5 truncate flex items-center gap-1.5">
                                                    {p.name as string}
                                                    {Boolean(p.isDraft) && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold shrink-0">
                                                            Draft
                                                        </span>
                                                    )}
                                                    {p.embeddingStatus === 'PENDING' && <span title="AI Indexing" className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse shadow-[0_0_8px_var(--gold)] inline-block shrink-0" />}
                                                </p>
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
                                                {Boolean(p.isDraft) && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold shrink-0">
                                                        Draft
                                                    </span>
                                                )}
                                                {Boolean(p.hasVariants) && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gold)]/15 text-[var(--gold)] font-semibold shrink-0">
                                                        {Array.isArray(p.variants) && p.variants.length > 0 ? `${p.variants.length} Variants` : 'Variants'}
                                                    </span>
                                                )}
                                                {p.embeddingStatus === 'PENDING' && <span title="AI Indexing" className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse shadow-[0_0_8px_var(--gold)] inline-block shrink-0 ml-1.5" />}
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
