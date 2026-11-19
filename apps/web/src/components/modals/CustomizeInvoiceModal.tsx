"use client";

import { useState } from "react";
import { X, Sliders, Download, Printer, Save, Check, FileText } from "lucide-react";
import apiClient from "@/lib/api-client";
import toast from "react-hot-toast";

export interface InvoiceCustomOptions {
    title?: string;
    subtitle?: string;
    showGstNumber?: boolean;
    showPanNumber?: boolean;
    showHsnCode?: boolean;
    showDiscountCol?: boolean;
    showTaxBreakup?: boolean;
    showUnit?: boolean;
    showPlaceOfSupply?: boolean;
    showShipTo?: boolean;
    showBankDetails?: boolean;
    showUpiQr?: boolean;
    showAmountInWords?: boolean;
    showTerms?: boolean;
    customTerms?: string;
    showSignatory?: boolean;
    customNotes?: string;
    accentColor?: string;
    buyerGstNumber?: string;
    isTaxInclusive?: boolean;
    targetAmount?: number;
    roundOffAmount?: number;
}

interface CustomizeInvoiceModalProps {
    open: boolean;
    onClose: () => void;
    invoice: any;
    onUpdated?: () => void;
}

const TITLE_OPTIONS = [
    { value: "TAX INVOICE", label: "Tax Invoice (Standard GST)" },
    { value: "BILL OF SUPPLY", label: "Bill of Supply (Composition / Non-GST)" },
    { value: "RETAIL INVOICE", label: "Retail Invoice / Cash Memo" },
    { value: "PROFORMA INVOICE", label: "Proforma Invoice" },
    { value: "ESTIMATE / QUOTATION", label: "Estimate / Quotation" },
];

export function CustomizeInvoiceModal({ open, onClose, invoice, onUpdated }: CustomizeInvoiceModalProps) {
    const existingOptions: InvoiceCustomOptions = invoice?.customOptions || {};

    const [showGstNumber, setShowGstNumber] = useState<boolean>(existingOptions.showGstNumber !== false);
    const [showPanNumber, setShowPanNumber] = useState<boolean>(existingOptions.showPanNumber !== false);
    const [showHsnCode, setShowHsnCode] = useState<boolean>(existingOptions.showHsnCode !== false);
    const [showDiscountCol, setShowDiscountCol] = useState<boolean>(existingOptions.showDiscountCol !== false);
    const [showTaxBreakup, setShowTaxBreakup] = useState<boolean>(existingOptions.showTaxBreakup !== false);
    const [showUnit, setShowUnit] = useState<boolean>(existingOptions.showUnit !== false);
    const [showPlaceOfSupply, setShowPlaceOfSupply] = useState<boolean>(existingOptions.showPlaceOfSupply !== false);
    const [showShipTo, setShowShipTo] = useState<boolean>(existingOptions.showShipTo !== false);
    const [showBankDetails, setShowBankDetails] = useState<boolean>(existingOptions.showBankDetails !== false);
    const [showUpiQr, setShowUpiQr] = useState<boolean>(existingOptions.showUpiQr !== false);
    const [showAmountInWords, setShowAmountInWords] = useState<boolean>(existingOptions.showAmountInWords !== false);
    const [showTerms, setShowTerms] = useState<boolean>(existingOptions.showTerms !== false);
    const [showSignatory, setShowSignatory] = useState<boolean>(existingOptions.showSignatory !== false);

    const [title, setTitle] = useState<string>(existingOptions.title || (showGstNumber ? "TAX INVOICE" : "BILL OF SUPPLY"));
    const [customTitle, setCustomTitle] = useState<string>("");
    const [isCustomTitle, setIsCustomTitle] = useState<boolean>(!TITLE_OPTIONS.some(t => t.value === (existingOptions.title || "TAX INVOICE")));
    const [subtitle, setSubtitle] = useState<string>(existingOptions.subtitle || "Original for Recipient");
    const [customTerms, setCustomTerms] = useState<string>(existingOptions.customTerms || "");
    const [customNotes, setCustomNotes] = useState<string>(existingOptions.customNotes || invoice?.notes || "");

    const [downloading, setDownloading] = useState(false);
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    const currentTitle = isCustomTitle ? customTitle : title;

    const buildOptions = (): InvoiceCustomOptions => ({
        title: currentTitle || (showGstNumber ? "TAX INVOICE" : "BILL OF SUPPLY"),
        subtitle: subtitle || undefined,
        showGstNumber,
        showPanNumber,
        showHsnCode,
        showDiscountCol,
        showTaxBreakup,
        showUnit,
        showPlaceOfSupply,
        showShipTo,
        showBankDetails,
        showUpiQr,
        showAmountInWords,
        showTerms,
        customTerms: customTerms || undefined,
        showSignatory,
        customNotes: customNotes || undefined,
    });

    // Handle Title Dropdown Change
    const handleTitleSelect = (val: string) => {
        if (val === "CUSTOM") {
            setIsCustomTitle(true);
        } else {
            setIsCustomTitle(false);
            setTitle(val);
        }
    };

    // Auto-suggest Bill of Supply when GST is turned off
    const handleGstToggle = (checked: boolean) => {
        setShowGstNumber(checked);
        if (!checked && title === "TAX INVOICE") {
            setTitle("BILL OF SUPPLY");
        } else if (checked && title === "BILL OF SUPPLY") {
            setTitle("TAX INVOICE");
        }
    };

    // Download PDF with custom options
    const handleDownload = async () => {
        setDownloading(true);
        try {
            const options = buildOptions();
            const response = await apiClient.post(`/api/v1/invoices/${invoice.id}/pdf/stream`, { options }, {
                responseType: "blob",
            });
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Invoice-${invoice.invoiceNumber || "custom"}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("Custom PDF downloaded successfully!");
        } catch (err) {
            toast.error("Failed to generate custom PDF");
        } finally {
            setDownloading(false);
        }
    };

    // Print / Preview in new browser window
    const handlePreview = async () => {
        try {
            const options = buildOptions();
            const response = await apiClient.post(`/api/v1/invoices/${invoice.id}/pdf/stream`, { options }, {
                responseType: "blob",
            });
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            window.open(url, "_blank");
        } catch (err) {
            toast.error("Failed to open print preview");
        }
    };

    // Save as Default for this invoice
    const handleSaveDefault = async () => {
        setSaving(true);
        try {
            const options = buildOptions();
            await apiClient.patch(`/api/v1/invoices/${invoice.id}/custom-options`, options);
            toast.success("Custom options saved as default for this invoice!");
            if (onUpdated) onUpdated();
            onClose();
        } catch (err) {
            toast.error("Failed to save custom options");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
            <div
                className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-[var(--gold)]/15 text-[var(--gold)]">
                            <Sliders size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                                Customize Invoice & PDF
                            </h2>
                            <p className="text-xs text-[var(--text-muted)]">
                                Configure visible tax numbers, sections, payment details, and terms for #{invoice?.invoiceNumber}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Document Type & Title */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            Document Heading & Type
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-[var(--text-secondary)] block mb-1">Invoice Title</label>
                                <select
                                    value={isCustomTitle ? "CUSTOM" : title}
                                    onChange={(e) => handleTitleSelect(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                >
                                    {TITLE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                    <option value="CUSTOM">Custom Title...</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-[var(--text-secondary)] block mb-1">Copy Subtitle</label>
                                <input
                                    value={subtitle}
                                    onChange={(e) => setSubtitle(e.target.value)}
                                    placeholder="e.g. Original for Recipient"
                                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </div>
                        </div>

                        {isCustomTitle && (
                            <div>
                                <label className="text-xs text-[var(--text-secondary)] block mb-1">Custom Title Text</label>
                                <input
                                    value={customTitle}
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    placeholder="e.g. COMMERCIAL INVOICE / CASH MEMO"
                                    className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </div>
                        )}
                    </div>

                    {/* Tax & Identifiers — The Core Requested Feature */}
                    <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            Tax & Registration Identifiers
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-2.5">
                            {/* GST Number Toggle */}
                            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${showGstNumber ? "bg-[var(--gold)]/5 border-[var(--gold)]/30" : "bg-[var(--bg-secondary)] border-[var(--border)] opacity-75"}`}>
                                <input
                                    type="checkbox"
                                    checked={showGstNumber}
                                    onChange={(e) => handleGstToggle(e.target.checked)}
                                    className="mt-0.5 rounded text-[var(--gold)] focus:ring-[var(--gold)]"
                                />
                                <div>
                                    <span className="text-sm font-medium text-[var(--text-primary)] block">
                                        Include GST Number (GSTIN)
                                    </span>
                                    <span className="text-xs text-[var(--text-muted)] block">
                                        Show Distributor & Retailer GSTIN. Turn off for composition dealers or retail sales.
                                    </span>
                                </div>
                            </label>

                            {/* PAN Number Toggle */}
                            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${showPanNumber ? "bg-[var(--gold)]/5 border-[var(--gold)]/30" : "bg-[var(--bg-secondary)] border-[var(--border)] opacity-75"}`}>
                                <input
                                    type="checkbox"
                                    checked={showPanNumber}
                                    onChange={(e) => setShowPanNumber(e.target.checked)}
                                    className="mt-0.5 rounded text-[var(--gold)] focus:ring-[var(--gold)]"
                                />
                                <div>
                                    <span className="text-sm font-medium text-[var(--text-primary)] block">
                                        Show PAN Number
                                    </span>
                                    <span className="text-xs text-[var(--text-muted)] block">
                                        Display company PAN number in the invoice header.
                                    </span>
                                </div>
                            </label>

                            {/* Place of Supply Toggle */}
                            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${showPlaceOfSupply ? "bg-[var(--gold)]/5 border-[var(--gold)]/30" : "bg-[var(--bg-secondary)] border-[var(--border)] opacity-75"}`}>
                                <input
                                    type="checkbox"
                                    checked={showPlaceOfSupply}
                                    onChange={(e) => setShowPlaceOfSupply(e.target.checked)}
                                    className="mt-0.5 rounded text-[var(--gold)] focus:ring-[var(--gold)]"
                                />
                                <div>
                                    <span className="text-sm font-medium text-[var(--text-primary)] block">
                                        Show Place of Supply
                                    </span>
                                    <span className="text-xs text-[var(--text-muted)] block">
                                        State of supply indicated in metadata.
                                    </span>
                                </div>
                            </label>

                            {/* Tax Breakup (CGST / SGST / IGST) */}
                            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${showTaxBreakup ? "bg-[var(--gold)]/5 border-[var(--gold)]/30" : "bg-[var(--bg-secondary)] border-[var(--border)] opacity-75"}`}>
                                <input
                                    type="checkbox"
                                    checked={showTaxBreakup}
                                    onChange={(e) => setShowTaxBreakup(e.target.checked)}
                                    className="mt-0.5 rounded text-[var(--gold)] focus:ring-[var(--gold)]"
                                />
                                <div>
                                    <span className="text-sm font-medium text-[var(--text-primary)] block">
                                        Show Tax Columns (CGST/SGST/IGST)
                                    </span>
                                    <span className="text-xs text-[var(--text-muted)] block">
                                        Break down line item tax amounts and percentages in the items table.
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Item Table Columns */}
                    <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            Table Columns & Formatting
                        </h3>
                        <div className="grid sm:grid-cols-3 gap-2.5">
                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={showHsnCode}
                                    onChange={(e) => setShowHsnCode(e.target.checked)}
                                    className="rounded text-[var(--gold)]"
                                />
                                <span className="text-[var(--text-primary)]">Show HSN / SAC Codes</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={showDiscountCol}
                                    onChange={(e) => setShowDiscountCol(e.target.checked)}
                                    className="rounded text-[var(--gold)]"
                                />
                                <span className="text-[var(--text-primary)]">Show Discount Column</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={showUnit}
                                    onChange={(e) => setShowUnit(e.target.checked)}
                                    className="rounded text-[var(--gold)]"
                                />
                                <span className="text-[var(--text-primary)]">Show Unit Column</span>
                            </label>
                        </div>
                    </div>

                    {/* Parties & Payment Sections */}
                    <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            Parties & Payment QR
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-2.5">
                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={showShipTo}
                                    onChange={(e) => setShowShipTo(e.target.checked)}
                                    className="rounded text-[var(--gold)]"
                                />
                                <span className="text-[var(--text-primary)]">Show Separate &quot;Ship To&quot; Address</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={showBankDetails}
                                    onChange={(e) => setShowBankDetails(e.target.checked)}
                                    className="rounded text-[var(--gold)]"
                                />
                                <span className="text-[var(--text-primary)]">Show Bank Account Details</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={showUpiQr}
                                    onChange={(e) => setShowUpiQr(e.target.checked)}
                                    className="rounded text-[var(--gold)]"
                                />
                                <span className="text-[var(--text-primary)]">Show Dynamic UPI QR Code</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={showAmountInWords}
                                    onChange={(e) => setShowAmountInWords(e.target.checked)}
                                    className="rounded text-[var(--gold)]"
                                />
                                <span className="text-[var(--text-primary)]">Show Amount in Words</span>
                            </label>
                        </div>
                    </div>

                    {/* Legal, Signature & Notes */}
                    <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            Signatures, Terms & Notes
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-2.5 mb-3">
                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={showSignatory}
                                    onChange={(e) => setShowSignatory(e.target.checked)}
                                    className="rounded text-[var(--gold)]"
                                />
                                <span className="text-[var(--text-primary)]">Show Authorized Signatory Box</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    checked={showTerms}
                                    onChange={(e) => setShowTerms(e.target.checked)}
                                    className="rounded text-[var(--gold)]"
                                />
                                <span className="text-[var(--text-primary)]">Show Terms & Conditions</span>
                            </label>
                        </div>

                        {showTerms && (
                            <div>
                                <label className="text-xs text-[var(--text-secondary)] block mb-1">
                                    Custom Terms & Conditions (One per line, leave blank for standard default terms)
                                </label>
                                <textarea
                                    value={customTerms}
                                    onChange={(e) => setCustomTerms(e.target.value)}
                                    rows={3}
                                    placeholder="1. Payment is due within 15 days.&#10;2. Goods once sold will not be returned.&#10;3. Subject to local jurisdiction."
                                    className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition resize-none"
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-xs text-[var(--text-secondary)] block mb-1">
                                Notes / Remarks (shown above footer)
                            </label>
                            <input
                                value={customNotes}
                                onChange={(e) => setCustomNotes(e.target.value)}
                                placeholder="e.g. Delivered via Vehicle DL-1A-9876. Thank you for your business!"
                                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-5 border-t border-[var(--border)] bg-[var(--bg-secondary)]/50">
                    <button
                        type="button"
                        onClick={handleSaveDefault}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/10 transition disabled:opacity-50 w-full sm:w-auto justify-center"
                        title="Persist these options for this invoice"
                    >
                        <Save size={14} />
                        {saving ? "Saving..." : "Save for this Invoice"}
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={handlePreview}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition w-full sm:w-auto justify-center"
                        >
                            <Printer size={14} /> Print / Preview
                        </button>
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={downloading}
                            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition disabled:opacity-50 w-full sm:w-auto justify-center"
                        >
                            <Download size={14} />
                            {downloading ? "Generating..." : "Download PDF"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
