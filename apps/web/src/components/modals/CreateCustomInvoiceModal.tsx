"use client";

import { useState, useMemo } from "react";
import { X, Plus, Trash2, FileText, Check, ChevronDown, ChevronUp, Sliders, Sparkles, Building2, Calculator } from "lucide-react";
import { useCustomers, useProducts } from "@/hooks/api-hooks";
import apiClient from "@/lib/api-client";
import toast from "react-hot-toast";
import { formatINR } from "@/lib/utils";
import { InvoiceCustomOptions } from "./CustomizeInvoiceModal";

const GST_STATE_MAP: Record<string, string> = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra & Nagar Haveli",
    "27": "Maharashtra",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
};

interface CreateCustomInvoiceModalProps {
    open: boolean;
    onClose: () => void;
    onCreated?: (invoiceId: string) => void;
}

interface InvoiceItemRow {
    productId: string;
    quantity: number;
    unit: string;
    price: number;
    discount: number;
    hsnCode: string;
    gstRate: number;
}

export function CreateCustomInvoiceModal({ open, onClose, onCreated }: CreateCustomInvoiceModalProps) {
    const { data: customerData } = useCustomers({ limit: 100 });
    const { data: productData } = useProducts({ limit: 100 });

    const rawCustomers = customerData?.data ?? customerData;
    const customers: any[] = Array.isArray(rawCustomers) ? rawCustomers : (rawCustomers?.data ?? []);

    const rawProducts = productData?.data ?? productData;
    const products: any[] = Array.isArray(rawProducts) ? rawProducts : (rawProducts?.data ?? []);

    const [customerId, setCustomerId] = useState("");
    const [buyerGstNumber, setBuyerGstNumber] = useState("");
    const [saveGstToCustomer, setSaveGstToCustomer] = useState(true);

    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
    const [dueDate, setDueDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split("T")[0];
    });

    // Tax Mode: Exclusive (default) vs Inclusive (MRP / Net Rate)
    const [isTaxInclusive, setIsTaxInclusive] = useState(false);

    // Target Final Amount / Round-Off
    const [roundMode, setRoundMode] = useState<"exact" | "round1" | "round10" | "round100" | "custom">("exact");
    const [targetAmount, setTargetAmount] = useState<string>("");

    const [items, setItems] = useState<InvoiceItemRow[]>([
        { productId: "", quantity: 1, unit: "pcs", price: 0, discount: 0, hsnCode: "", gstRate: 18 },
    ]);

    // Custom Invoice Layout Options
    const [showOptions, setShowOptions] = useState(false);
    const [title, setTitle] = useState("TAX INVOICE");
    const [showGstNumber, setShowGstNumber] = useState(true);
    const [showPanNumber, setShowPanNumber] = useState(true);
    const [showHsnCode, setShowHsnCode] = useState(true);
    const [showDiscountCol, setShowDiscountCol] = useState(true);
    const [showTaxBreakup, setShowTaxBreakup] = useState(true);
    const [showShipTo, setShowShipTo] = useState(true);
    const [showBankDetails, setShowBankDetails] = useState(true);
    const [showUpiQr, setShowUpiQr] = useState(true);
    const [showTerms, setShowTerms] = useState(true);
    const [showSignatory, setShowSignatory] = useState(true);
    const [customTerms, setCustomTerms] = useState("");
    const [notes, setNotes] = useState("");

    const [submitting, setSubmitting] = useState(false);

    // Customer Selection & Auto GSTIN Population
    const handleCustomerChange = (id: string) => {
        setCustomerId(id);
        const sel = customers.find((c) => c.id === id);
        if (sel?.gstNumber) {
            setBuyerGstNumber(sel.gstNumber);
            setSaveGstToCustomer(false); // Already saved on customer
        } else {
            setBuyerGstNumber("");
            setSaveGstToCustomer(true);
        }
    };

    // Auto-detect State from GSTIN (First 2 digits)
    const buyerState = useMemo(() => {
        const clean = buyerGstNumber.trim();
        if (clean.length < 2) return null;
        const code = clean.substring(0, 2);
        return GST_STATE_MAP[code] || null;
    }, [buyerGstNumber]);

    // GSTIN format validation (15 alphanumeric characters: 2 state + 5 PAN letters + 4 PAN digits + 1 entity + 1 'Z' + 1 checksum)
    const isGstinValid = useMemo(() => {
        const clean = buyerGstNumber.trim().toUpperCase();
        if (!clean) return null;
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean);
    }, [buyerGstNumber]);

    // Auto-update title when GST toggle changes
    const handleGstToggle = (checked: boolean) => {
        setShowGstNumber(checked);
        if (!checked && title === "TAX INVOICE") {
            setTitle("BILL OF SUPPLY");
        } else if (checked && title === "BILL OF SUPPLY") {
            setTitle("TAX INVOICE");
        }
    };

    // Row management
    const handleProductChange = (index: number, prodId: string) => {
        const prod = products.find((p) => p.id === prodId);
        setItems((prev) => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                productId: prodId,
                price: prod?.sellingPrice || prod?.price || 0,
                unit: prod?.unit || "pcs",
                hsnCode: prod?.hsnCode || "",
                gstRate: prod?.gstRate ?? 18,
            };
            return next;
        });
    };

    const handleRowUpdate = (index: number, field: keyof InvoiceItemRow, val: any) => {
        setItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: val };
            return next;
        });
    };

    const addRow = () => {
        setItems((prev) => [
            ...prev,
            { productId: "", quantity: 1, unit: "pcs", price: 0, discount: 0, hsnCode: "", gstRate: 18 },
        ]);
    };

    const removeRow = (index: number) => {
        if (items.length <= 1) return;
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    // Totals calculations with Tax-Inclusive & Target Rounding support
    const totals = useMemo(() => {
        let subtotal = 0;
        let totalDiscount = 0;
        let totalTaxable = 0;
        let totalTax = 0;

        items.forEach((it) => {
            const line = (it.price || 0) * (it.quantity || 0);
            const disc = it.discount || 0;
            const netLine = Math.max(0, line - disc);

            if (isTaxInclusive) {
                // Rate includes tax: netLine is the gross amount with GST
                const rate = showGstNumber ? (it.gstRate || 0) : 0;
                const taxable = netLine / (1 + rate / 100);
                const tax = netLine - taxable;

                subtotal += line;
                totalDiscount += disc;
                totalTaxable += taxable;
                totalTax += tax;
            } else {
                // Rate is exclusive of GST: GST added on top
                const taxable = netLine;
                const tax = showGstNumber ? (taxable * (it.gstRate || 0)) / 100 : 0;

                subtotal += line;
                totalDiscount += disc;
                totalTaxable += taxable;
                totalTax += tax;
            }
        });

        // Natural calculated total before any custom round-off
        const naturalTotal = Math.round((isTaxInclusive ? (subtotal - totalDiscount) : (totalTaxable + totalTax)) * 100) / 100;

        let targetPayable = naturalTotal;
        if (roundMode === "round1") {
            targetPayable = Math.round(naturalTotal);
        } else if (roundMode === "round10") {
            targetPayable = Math.round(naturalTotal / 10) * 10;
        } else if (roundMode === "round100") {
            targetPayable = Math.round(naturalTotal / 100) * 100;
        } else if (roundMode === "custom" && targetAmount !== "" && !isNaN(Number(targetAmount))) {
            targetPayable = Math.max(0, Number(targetAmount));
        }

        const roundOffAmount = Math.round((targetPayable - naturalTotal) * 100) / 100;
        const finalPayable = targetPayable;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            totalDiscount: Math.round(totalDiscount * 100) / 100,
            totalTaxable: Math.round(totalTaxable * 100) / 100,
            totalTax: Math.round(totalTax * 100) / 100,
            naturalTotal,
            roundOffAmount,
            finalPayable,
        };
    }, [items, showGstNumber, isTaxInclusive, roundMode, targetAmount]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId) {
            toast.error("Please select a customer");
            return;
        }

        const validItems = items.filter((it) => it.productId && it.quantity > 0);
        if (validItems.length === 0) {
            toast.error("Please add at least one valid product item");
            return;
        }

        const cleanBuyerGst = buyerGstNumber.trim().toUpperCase();

        setSubmitting(true);
        try {
            // If user checked "Save to customer profile", update customer GSTIN first
            if (saveGstToCustomer && cleanBuyerGst && customerId) {
                try {
                    await apiClient.patch(`/api/v1/customers/${customerId}`, {
                        gstNumber: cleanBuyerGst,
                    });
                } catch (updateErr) {
                    console.warn("Could not save GSTIN to customer profile:", updateErr);
                }
            }

            const customOptions: InvoiceCustomOptions = {
                title,
                showGstNumber,
                showPanNumber,
                showHsnCode,
                showDiscountCol,
                showTaxBreakup,
                showShipTo,
                showBankDetails,
                showUpiQr,
                showTerms,
                showSignatory,
                customTerms: customTerms || undefined,
                customNotes: notes || undefined,
                buyerGstNumber: cleanBuyerGst || undefined,
                isTaxInclusive,
                targetAmount: totals.roundOffAmount !== 0 ? totals.finalPayable : undefined,
                roundOffAmount: totals.roundOffAmount !== 0 ? totals.roundOffAmount : undefined,
            };

            const payload = {
                customerId,
                invoiceDate: new Date(invoiceDate).toISOString(),
                dueDate: new Date(dueDate).toISOString(),
                notes: notes || undefined,
                items: validItems.map((it) => {
                    let price = Number(it.price);
                    // In tax-inclusive mode, backend expects base price
                    if (isTaxInclusive && showGstNumber) {
                        price = Math.round((price / (1 + (it.gstRate || 0) / 100)) * 100) / 100;
                    }
                    return {
                        productId: it.productId,
                        quantity: Number(it.quantity),
                        unit: it.unit || "pcs",
                        price,
                        discount: Number(it.discount || 0),
                        hsnCode: it.hsnCode || undefined,
                    };
                }),
                customOptions,
            };

            const res = await apiClient.post("/api/v1/invoices", payload);
            const created = res.data?.data ?? res.data;
            toast.success(`Invoice ${created.invoiceNumber || ""} created successfully!`);
            if (onCreated) onCreated(created.id);
            onClose();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to create custom invoice");
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
            <div
                className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[var(--gold)]/15 text-[var(--gold)]">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                                Create Custom Invoice
                            </h2>
                            <p className="text-xs text-[var(--text-muted)]">
                                Tax invoice generator with Buyer GSTIN, tax-inclusive pricing, and target settlement rounding
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
                    {/* Customer & Dates Section */}
                    <div className="grid sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-1">
                            <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                                Customer / Retailer *
                            </label>
                            <select
                                value={customerId}
                                onChange={(e) => handleCustomerChange(e.target.value)}
                                required
                                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                            >
                                <option value="">Select Retailer / Customer...</option>
                                {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.gstNumber ? `(GST: ${c.gstNumber})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                                Invoice Date
                            </label>
                            <input
                                type="date"
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                                required
                                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                            />
                        </div>
                    </div>

                    {/* Buyer GSTIN Row with Live State Detection & Save Option */}
                    <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                                    <Building2 size={14} className="text-[var(--gold)]" />
                                    <span>Buyer GSTIN (Tax ID)</span>
                                    {buyerState && (
                                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            {buyerState}
                                        </span>
                                    )}
                                </label>
                                {buyerGstNumber && (
                                    <span className={`text-[10px] font-medium ${isGstinValid ? "text-emerald-400" : "text-amber-400"}`}>
                                        {isGstinValid ? "✓ Valid GSTIN format" : `${buyerGstNumber.trim().length}/15 chars`}
                                    </span>
                                )}
                            </div>
                            <input
                                type="text"
                                maxLength={15}
                                value={buyerGstNumber}
                                onChange={(e) => setBuyerGstNumber(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))}
                                placeholder="e.g. 07AAAAA0000A1Z5 (15-character GSTIN)"
                                className="w-full px-3 py-1.5 text-xs font-mono uppercase rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition tracking-wider"
                            />
                        </div>

                        {customerId && (
                            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer sm:self-end sm:mb-1.5 select-none">
                                <input
                                    type="checkbox"
                                    checked={saveGstToCustomer}
                                    onChange={(e) => setSaveGstToCustomer(e.target.checked)}
                                    className="rounded text-[var(--gold)]"
                                />
                                <span>Save GSTIN to customer profile</span>
                            </label>
                        )}
                    </div>

                    {/* Line Items Table & Pricing Mode */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                    Line Items
                                </h3>

                                {/* Tax Inclusive Toggle */}
                                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition select-none">
                                    <input
                                        type="checkbox"
                                        checked={isTaxInclusive}
                                        onChange={(e) => setIsTaxInclusive(e.target.checked)}
                                        className="rounded text-[var(--gold)]"
                                    />
                                    <span className={isTaxInclusive ? "text-[var(--gold)] font-bold" : "text-[var(--text-secondary)]"}>
                                        Rates Include GST (Tax-Inclusive / MRP)
                                    </span>
                                    {isTaxInclusive && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gold)]/20 text-[var(--gold)] font-mono">
                                            Auto Ex-GST
                                        </span>
                                    )}
                                </label>
                            </div>

                            <button
                                type="button"
                                onClick={addRow}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20 transition self-start sm:self-auto cursor-pointer"
                            >
                                <Plus size={14} /> Add Product
                            </button>
                        </div>

                        <div className="border border-[var(--border)] rounded-xl overflow-x-auto bg-[var(--bg-secondary)]/30">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-secondary)]">
                                        <th className="text-left p-3 min-w-[200px]">Product</th>
                                        <th className="text-center p-3 w-20">Qty</th>
                                        <th className="text-center p-3 w-20">Unit</th>
                                        <th className="text-right p-3 w-32">
                                            {isTaxInclusive ? "Rate (Incl. GST ₹)" : "Rate (₹)"}
                                        </th>
                                        <th className="text-right p-3 w-24">Disc (₹)</th>
                                        {showGstNumber && <th className="text-center p-3 w-20">GST %</th>}
                                        <th className="text-right p-3 w-28">Total (₹)</th>
                                        <th className="text-center p-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((row, idx) => {
                                        const line = (row.price || 0) * (row.quantity || 0);
                                        const disc = row.discount || 0;
                                        const netLine = Math.max(0, line - disc);

                                        let lineTotal = 0;
                                        let baseRate = row.price || 0;

                                        if (isTaxInclusive) {
                                            const gstRate = showGstNumber ? (row.gstRate || 0) : 0;
                                            baseRate = row.price / (1 + gstRate / 100);
                                            lineTotal = netLine;
                                        } else {
                                            const tax = showGstNumber ? (netLine * (row.gstRate || 0)) / 100 : 0;
                                            lineTotal = netLine + tax;
                                        }

                                        return (
                                            <tr key={idx} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)]/50">
                                                <td className="p-2.5">
                                                    <select
                                                        value={row.productId}
                                                        onChange={(e) => handleProductChange(idx, e.target.value)}
                                                        required
                                                        className="w-full px-2 py-1.5 text-xs rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                                                    >
                                                        <option value="">Select Product...</option>
                                                        {products.map((p) => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.name} (₹{p.sellingPrice || p.price || 0})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-2.5 text-center">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={row.quantity}
                                                        onChange={(e) => handleRowUpdate(idx, "quantity", Number(e.target.value))}
                                                        className="w-16 px-1.5 py-1 text-xs text-center rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                                                    />
                                                </td>
                                                <td className="p-2.5 text-center">
                                                    <input
                                                        value={row.unit}
                                                        onChange={(e) => handleRowUpdate(idx, "unit", e.target.value)}
                                                        className="w-16 px-1.5 py-1 text-xs text-center rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                                                    />
                                                </td>
                                                <td className="p-2.5 text-right">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={row.price}
                                                        onChange={(e) => handleRowUpdate(idx, "price", Number(e.target.value))}
                                                        className="w-28 px-1.5 py-1 text-xs text-right rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                                                    />
                                                    {isTaxInclusive && showGstNumber && row.price > 0 && (
                                                        <span className="block text-[10px] text-[var(--text-muted)] mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                                                            Ex-GST: ₹{baseRate.toFixed(2)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-right">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={row.discount}
                                                        onChange={(e) => handleRowUpdate(idx, "discount", Number(e.target.value))}
                                                        className="w-20 px-1.5 py-1 text-xs text-right rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                                                    />
                                                </td>
                                                {showGstNumber && (
                                                    <td className="p-2.5 text-center">
                                                        <select
                                                            value={row.gstRate}
                                                            onChange={(e) => handleRowUpdate(idx, "gstRate", Number(e.target.value))}
                                                            className="w-16 px-1 py-1 text-xs text-center rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                                                        >
                                                            <option value={0}>0%</option>
                                                            <option value={5}>5%</option>
                                                            <option value={12}>12%</option>
                                                            <option value={18}>18%</option>
                                                            <option value={28}>28%</option>
                                                        </select>
                                                    </td>
                                                )}
                                                <td className="p-2.5 text-right font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                                                    {formatINR(lineTotal)}
                                                </td>
                                                <td className="p-2.5 text-center">
                                                    {items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRow(idx)}
                                                            className="text-red-400 hover:text-red-600 transition cursor-pointer"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals & Target Final Amount Settlement Box */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        {/* Target Final Amount / Settlement Quick Adjustment */}
                        <div className="w-full sm:max-w-md p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/30 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                                    <Calculator size={14} className="text-[var(--gold)]" />
                                    Target Final Amount / Round-Off
                                </span>
                                <span className="text-[11px] text-[var(--text-muted)]">
                                    Quick settlement adjustment
                                </span>
                            </div>

                            {/* Rounding Action Pills */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => { setRoundMode("exact"); setTargetAmount(""); }}
                                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition cursor-pointer ${roundMode === "exact" ? "bg-[var(--gold)] text-black font-bold shadow-sm" : "bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"}`}
                                >
                                    Exact ({formatINR(totals.naturalTotal)})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setRoundMode("round1"); setTargetAmount(String(Math.round(totals.naturalTotal))); }}
                                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition cursor-pointer ${roundMode === "round1" ? "bg-[var(--gold)] text-black font-bold shadow-sm" : "bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"}`}
                                >
                                    Round ₹1 ({formatINR(Math.round(totals.naturalTotal))})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setRoundMode("round10"); setTargetAmount(String(Math.round(totals.naturalTotal / 10) * 10)); }}
                                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition cursor-pointer ${roundMode === "round10" ? "bg-[var(--gold)] text-black font-bold shadow-sm" : "bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"}`}
                                >
                                    Round ₹10 ({formatINR(Math.round(totals.naturalTotal / 10) * 10)})
                                </button>
                            </div>

                            {/* Custom Target Input */}
                            <div className="flex items-center gap-2 pt-1">
                                <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">Custom Target:</span>
                                <div className="relative flex-1">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">₹</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder={`e.g. ${Math.floor(totals.naturalTotal)}`}
                                        value={targetAmount}
                                        onChange={(e) => {
                                            setTargetAmount(e.target.value);
                                            setRoundMode("custom");
                                        }}
                                        className="w-full pl-6 pr-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                                    />
                                </div>
                                {targetAmount && (
                                    <button
                                        type="button"
                                        onClick={() => { setTargetAmount(""); setRoundMode("exact"); }}
                                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Totals Summary */}
                        <div className="w-full sm:w-80 space-y-2.5 text-xs bg-[var(--bg-secondary)]/50 p-4 rounded-xl border border-[var(--border)] shrink-0">
                            <div className="flex justify-between items-center text-[var(--text-secondary)]">
                                <span>Subtotal ({isTaxInclusive ? "Gross" : "Base"}):</span>
                                <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(totals.subtotal)}</span>
                            </div>
                            {totals.totalDiscount > 0 && (
                                <div className="flex justify-between items-center text-[var(--green-bright)]">
                                    <span>Discount:</span>
                                    <span style={{ fontFamily: "var(--font-mono)" }}>-{formatINR(totals.totalDiscount)}</span>
                                </div>
                            )}
                            {showGstNumber && (
                                <div className="flex justify-between items-center text-[var(--text-secondary)]">
                                    <span>Estimated GST:</span>
                                    <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(totals.totalTax)}</span>
                                </div>
                            )}
                            {totals.roundOffAmount !== 0 && (
                                <div className="flex justify-between items-center text-amber-500 font-medium pt-1 border-t border-[var(--border)]/50">
                                    <span>Round Off / Settlement:</span>
                                    <span style={{ fontFamily: "var(--font-mono)" }} className="whitespace-nowrap">
                                        {totals.roundOffAmount > 0 ? `+${formatINR(totals.roundOffAmount)}` : `-${formatINR(Math.abs(totals.roundOffAmount))}`}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center font-bold text-sm pt-2 border-t border-[var(--border)] text-[var(--text-primary)]">
                                <span>Final Payable:</span>
                                <span className="text-[var(--gold)] text-base" style={{ fontFamily: "var(--font-mono)" }}>
                                    {formatINR(totals.finalPayable)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Custom Invoice Options Accordion */}
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-secondary)]/30">
                        <button
                            type="button"
                            onClick={() => setShowOptions(!showOptions)}
                            className="w-full flex items-center justify-between p-4 bg-[var(--bg-secondary)]/60 text-left hover:bg-[var(--bg-secondary)] transition cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <Sliders size={16} className="text-[var(--gold)]" />
                                <span className="text-sm font-semibold text-[var(--text-primary)]">
                                    Invoice Customization & Display Settings
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] font-medium">
                                    {showGstNumber ? "GST Included" : "Non-GST / Bill of Supply"}
                                </span>
                            </div>
                            {showOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {showOptions && (
                            <div className="p-4 space-y-4 border-t border-[var(--border)]">
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-[var(--text-secondary)] block mb-1">Invoice Heading / Title</label>
                                        <select
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]"
                                        >
                                            <option value="TAX INVOICE">Tax Invoice (Standard GST)</option>
                                            <option value="BILL OF SUPPLY">Bill of Supply (Composition / Non-GST)</option>
                                            <option value="RETAIL INVOICE">Retail Invoice / Cash Memo</option>
                                            <option value="ESTIMATE / QUOTATION">Estimate / Quotation</option>
                                            <option value="PROFORMA INVOICE">Proforma Invoice</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--text-secondary)] block mb-1">Notes / Remarks</label>
                                        <input
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Optional notes or remarks"
                                            className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]"
                                        />
                                    </div>
                                </div>

                                {/* Custom Toggles */}
                                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                                    {/* Include GST Number */}
                                    <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer ${showGstNumber ? "bg-[var(--gold)]/5 border-[var(--gold)]/30" : "bg-[var(--bg-primary)] border-[var(--border)] opacity-70"}`}>
                                        <input
                                            type="checkbox"
                                            checked={showGstNumber}
                                            onChange={(e) => handleGstToggle(e.target.checked)}
                                            className="mt-0.5 rounded text-[var(--gold)]"
                                        />
                                        <div>
                                            <span className="font-medium text-[var(--text-primary)] block">Include GST Number (GSTIN)</span>
                                            <span className="text-[11px] text-[var(--text-muted)] block">Turn off to generate Non-GST / Composition Bill of Supply without GSTINs</span>
                                        </div>
                                    </label>

                                    {/* Show PAN */}
                                    <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showPanNumber}
                                            onChange={(e) => setShowPanNumber(e.target.checked)}
                                            className="rounded text-[var(--gold)]"
                                        />
                                        <span className="text-[var(--text-primary)] font-medium">Show PAN Number</span>
                                    </label>

                                    {/* Show HSN */}
                                    <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showHsnCode}
                                            onChange={(e) => setShowHsnCode(e.target.checked)}
                                            className="rounded text-[var(--gold)]"
                                        />
                                        <span className="text-[var(--text-primary)] font-medium">Show HSN / SAC Codes</span>
                                    </label>

                                    {/* Show Discount */}
                                    <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showDiscountCol}
                                            onChange={(e) => setShowDiscountCol(e.target.checked)}
                                            className="rounded text-[var(--gold)]"
                                        />
                                        <span className="text-[var(--text-primary)] font-medium">Show Discount Column</span>
                                    </label>

                                    {/* Show Bank Details */}
                                    <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showBankDetails}
                                            onChange={(e) => setShowBankDetails(e.target.checked)}
                                            className="rounded text-[var(--gold)]"
                                        />
                                        <span className="text-[var(--text-primary)] font-medium">Show Bank Details (A/C, IFSC)</span>
                                    </label>

                                    {/* Show UPI QR */}
                                    <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showUpiQr}
                                            onChange={(e) => setShowUpiQr(e.target.checked)}
                                            className="rounded text-[var(--gold)]"
                                        />
                                        <span className="text-[var(--text-primary)] font-medium">Show Scan & Pay UPI QR</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition disabled:opacity-50 cursor-pointer shadow-md"
                        >
                            {submitting ? "Creating Invoice..." : "Create Custom Invoice"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
