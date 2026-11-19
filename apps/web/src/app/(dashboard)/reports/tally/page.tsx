"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Loader2,
    Download,
    FileSpreadsheet,
    FileText,
    CheckCircle2,
    RotateCcw,
    Settings,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    Building2,
    Layers,
    Receipt,
    ShoppingCart,
    ExternalLink,
    AlertCircle,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { formatINR } from "@/lib/utils";

type RangePreset = "UNSYNCED" | "MTD" | "30D" | "CUSTOM";

export default function TallyExportPage() {
    const queryClient = useQueryClient();
    const [preset, setPreset] = useState<RangePreset>("UNSYNCED");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [includeSynced, setIncludeSynced] = useState(false);
    const [showGuide, setShowGuide] = useState(true);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [tallyCompanyNameInput, setTallyCompanyNameInput] = useState("");
    const [downloading, setDownloading] = useState<string | null>(null);

    // Fetch summary
    const { data: summaryData, isLoading: summaryLoading } = useQuery({
        queryKey: ["tally-summary"],
        queryFn: async () => {
            const res = await apiClient.get("/api/v1/tally/summary");
            return res.data?.data || res.data;
        },
    });

    // Fetch config
    const { data: configData } = useQuery({
        queryKey: ["tally-config"],
        queryFn: async () => {
            const res = await apiClient.get("/api/v1/tally/config");
            const data = res.data?.data || res.data;
            if (data?.companyName && !tallyCompanyNameInput) {
                setTallyCompanyNameInput(data.companyName);
            }
            return data;
        },
    });

    // Save config mutation
    const saveConfigMutation = useMutation({
        mutationFn: async (companyName: string) => {
            await apiClient.post("/api/v1/tally/config", {
                companyName,
                tallySyncEnabled: true,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tally-summary"] });
            queryClient.invalidateQueries({ queryKey: ["tally-config"] });
            setShowConfigModal(false);
        },
    });

    // Mark as synced mutation
    const markSyncedMutation = useMutation({
        mutationFn: async () => {
            // Fetch current pending list to get IDs
            const pendingRes = await apiClient.get("/api/v1/tally/pending-sync");
            const pending = pendingRes.data?.data || pendingRes.data;
            const invoiceIds = (pending?.invoices || []).map((i: any) => i.id);
            const paymentIds = (pending?.payments || []).map((p: any) => p.id);
            if (invoiceIds.length === 0 && paymentIds.length === 0) {
                throw new Error("No pending vouchers to mark as synced.");
            }
            return apiClient.post("/api/v1/tally/mark-synced", { invoiceIds, paymentIds });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tally-summary"] });
            alert("Vouchers marked as synced successfully!");
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || err.message || "Failed to mark as synced");
        },
    });

    // Reset sync mutation
    const resetSyncMutation = useMutation({
        mutationFn: async () => {
            if (!confirm("Are you sure you want to reset sync status? This will make previously exported vouchers available for export again.")) {
                return;
            }
            // Fetch recent synced vouchers
            return apiClient.post("/api/v1/tally/reset-sync", {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tally-summary"] });
        },
    });

    // Trigger file download via authenticated API
    const handleDownload = async (endpoint: string, fallbackFilename: string) => {
        try {
            setDownloading(endpoint);
            const params = new URLSearchParams();
            if (preset === "UNSYNCED") {
                params.set("onlyUnsynced", "true");
            } else {
                params.set("onlyUnsynced", includeSynced ? "false" : "true");
                if (preset === "MTD") {
                    const d = new Date();
                    d.setDate(1);
                    params.set("startDate", d.toISOString().split("T")[0]);
                    params.set("endDate", new Date().toISOString().split("T")[0]);
                } else if (preset === "30D") {
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    params.set("startDate", d.toISOString().split("T")[0]);
                    params.set("endDate", new Date().toISOString().split("T")[0]);
                } else if (preset === "CUSTOM" && customStart && customEnd) {
                    params.set("startDate", customStart);
                    params.set("endDate", customEnd);
                }
            }

            const url = `${endpoint}?${params.toString()}`;
            const res = await apiClient.get(url, { responseType: "blob" });

            // Extract filename from header if present
            let filename = fallbackFilename;
            const disposition = res.headers["content-disposition"];
            if (disposition && disposition.indexOf("filename=") !== -1) {
                const matches = disposition.match(/filename="?([^"]+)"?/);
                if (matches?.[1]) filename = matches[1];
            }

            // Create temporary link to trigger download
            const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        } catch (err: any) {
            console.error("Export download failed:", err);
            alert("Export failed: " + (err.response?.data?.message || err.message || "Unknown error"));
        } finally {
            setDownloading(null);
        }
    };

    const companyName = summaryData?.companyName || configData?.companyName || "My Company";
    const pendingInvoices = summaryData?.invoices?.unsyncedCount ?? 0;
    const pendingInvoiceTotal = summaryData?.invoices?.unsyncedTotal ?? 0;
    const pendingPayments = summaryData?.payments?.unsyncedCount ?? 0;
    const pendingPaymentTotal = summaryData?.payments?.unsyncedTotal ?? 0;
    const totalCustomers = summaryData?.masters?.customerCount ?? 0;
    const totalProducts = summaryData?.masters?.productCount ?? 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                        Tally Prime & ERP 9 Export
                    </h1>
                    <p className="text-[var(--text-muted)] text-sm mt-1">
                        Export sales vouchers, receipts, party ledgers, and stock items with 100% compliant Tally XML.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setTallyCompanyNameInput(companyName);
                            setShowConfigModal(true);
                        }}
                        className="btn-ghost flex items-center gap-2 text-xs border border-[var(--border)] px-3 py-2 rounded-lg hover:bg-[var(--bg-secondary)]"
                    >
                        <Settings size={14} className="text-[var(--gold)]" />
                        <span>Company: <strong>{companyName}</strong></span>
                    </button>
                </div>
            </div>

            {/* Summary KPI Cards */}
            {summaryLoading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Pending Sales */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
                                Unsynced Sales Vouchers
                            </span>
                            <div className="p-2 rounded-lg bg-[var(--gold)]/10 text-[var(--gold)]">
                                <ShoppingCart size={18} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold font-mono text-[var(--gold)]">
                            {formatINR(pendingInvoiceTotal)}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            <strong className="text-[var(--text-primary)]">{pendingInvoices}</strong> invoices ready to export
                        </p>
                    </div>

                    {/* Card 2: Pending Receipts */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
                                Unsynced Receipts
                            </span>
                            <div className="p-2 rounded-lg bg-[var(--green-bright)]/10 text-[var(--green-bright)]">
                                <Receipt size={18} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold font-mono text-[var(--green-bright)]">
                            {formatINR(pendingPaymentTotal)}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            <strong className="text-[var(--text-primary)]">{pendingPayments}</strong> collections ready to export
                        </p>
                    </div>

                    {/* Card 3: Masters */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
                                Tally Masters
                            </span>
                            <div className="p-2 rounded-lg bg-[var(--orange)]/10 text-[var(--orange)]">
                                <Layers size={18} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold font-mono">
                            {totalCustomers + totalProducts}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            {totalCustomers} customers &bull; {totalProducts} items
                        </p>
                    </div>

                    {/* Card 4: Historical Synced */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
                                Total Synced
                            </span>
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <CheckCircle2 size={18} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold font-mono text-blue-400">
                            {formatINR((summaryData?.invoices?.syncedTotal || 0) + (summaryData?.payments?.syncedTotal || 0))}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            {(summaryData?.invoices?.syncedCount || 0) + (summaryData?.payments?.syncedCount || 0)} vouchers synced to date
                        </p>
                    </div>
                </div>
            )}

            {/* Filter & Scope Toolbar */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase mr-1">Scope:</span>
                    <button
                        onClick={() => setPreset("UNSYNCED")}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                            preset === "UNSYNCED"
                                ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30 font-medium"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                        }`}
                    >
                        Unsynced Only ({pendingInvoices + pendingPayments})
                    </button>
                    <button
                        onClick={() => setPreset("MTD")}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                            preset === "MTD"
                                ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30 font-medium"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                        }`}
                    >
                        This Month
                    </button>
                    <button
                        onClick={() => setPreset("30D")}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                            preset === "30D"
                                ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30 font-medium"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                        }`}
                    >
                        Last 30 Days
                    </button>
                    <button
                        onClick={() => setPreset("CUSTOM")}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                            preset === "CUSTOM"
                                ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30 font-medium"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                        }`}
                    >
                        Custom Dates
                    </button>

                    {preset === "CUSTOM" && (
                        <div className="flex items-center gap-2 ml-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="input-field text-xs py-1 px-2 border rounded"
                            />
                            <span className="text-xs text-[var(--text-muted)]">to</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="input-field text-xs py-1 px-2 border rounded"
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {preset !== "UNSYNCED" && (
                        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeSynced}
                                onChange={(e) => setIncludeSynced(e.target.checked)}
                                className="rounded border-[var(--border)] accent-[var(--gold)]"
                            />
                            Include already synced
                        </label>
                    )}

                    <button
                        onClick={() => markSyncedMutation.mutate()}
                        disabled={markSyncedMutation.isPending || (pendingInvoices === 0 && pendingPayments === 0)}
                        className="btn-ghost flex items-center gap-1.5 text-xs text-[var(--green-bright)] border border-[var(--green-bright)]/30 px-3 py-1.5 rounded-lg hover:bg-[var(--green-bright)]/10 disabled:opacity-40"
                    >
                        <CheckCircle2 size={14} />
                        <span>{markSyncedMutation.isPending ? "Marking..." : "Mark as Synced"}</span>
                    </button>
                </div>
            </div>

            {/* Export Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Step 1: Masters XML */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 flex flex-col justify-between hover:border-[var(--gold)]/30 transition-all">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-[var(--gold)] uppercase tracking-wider bg-[var(--gold)]/10 px-2 py-0.5 rounded">
                                Step 1 &bull; Masters
                            </span>
                            <Layers size={18} className="text-[var(--text-muted)]" />
                        </div>
                        <h3 className="font-semibold text-base mb-1">Tally Masters XML</h3>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            Imports party accounts under <strong>Sundry Debtors</strong> (with GSTIN, State & address) and stock items (with HSN codes & GST rates). Run this first when setting up Tally or adding new products.
                        </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-[var(--border)]">
                        <button
                            onClick={() => handleDownload("/api/v1/tally/export/masters-xml", "tally-masters.xml")}
                            disabled={downloading !== null}
                            className="w-full flex items-center justify-center gap-2 bg-[var(--gold)] hover:bg-[var(--gold-dark)] text-black font-semibold text-xs py-2.5 px-4 rounded-lg transition-all shadow-sm"
                        >
                            {downloading === "/api/v1/tally/export/masters-xml" ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Download size={14} />
                            )}
                            <span>Download Masters XML</span>
                        </button>
                    </div>
                </div>

                {/* Step 2: Sales Vouchers XML */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 flex flex-col justify-between hover:border-[var(--gold)]/30 transition-all">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-[var(--gold)] uppercase tracking-wider bg-[var(--gold)]/10 px-2 py-0.5 rounded">
                                Step 2 &bull; Sales
                            </span>
                            <ShoppingCart size={18} className="text-[var(--text-muted)]" />
                        </div>
                        <h3 className="font-semibold text-base mb-1">Sales Vouchers XML</h3>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            Complete sales daybook with item-level quantities, selling rates, CGST, SGST, IGST tax splits, and automatic ledger entries. Matches Tally Prime Sales Voucher format.
                        </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-[var(--border)]">
                        <button
                            onClick={() => handleDownload("/api/v1/tally/export/sales-xml", "tally-sales.xml")}
                            disabled={downloading !== null || (preset === "UNSYNCED" && pendingInvoices === 0)}
                            className="w-full flex items-center justify-center gap-2 bg-[var(--gold)] hover:bg-[var(--gold-dark)] text-black font-semibold text-xs py-2.5 px-4 rounded-lg transition-all shadow-sm disabled:opacity-40"
                        >
                            {downloading === "/api/v1/tally/export/sales-xml" ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Download size={14} />
                            )}
                            <span>Download Sales XML ({pendingInvoices})</span>
                        </button>
                    </div>
                </div>

                {/* Step 3: Receipt Vouchers XML */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 flex flex-col justify-between hover:border-[var(--gold)]/30 transition-all">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-[var(--green-bright)] uppercase tracking-wider bg-[var(--green-bright)]/10 px-2 py-0.5 rounded">
                                Step 3 &bull; Receipts
                            </span>
                            <Receipt size={18} className="text-[var(--text-muted)]" />
                        </div>
                        <h3 className="font-semibold text-base mb-1">Receipt Vouchers XML</h3>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            Payment receipts collected via Cash, Bank Transfer, Cheque, or UPI credited to Bank/Cash and debited to respective customer ledgers.
                        </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-[var(--border)]">
                        <button
                            onClick={() => handleDownload("/api/v1/tally/export/receipts-xml", "tally-receipts.xml")}
                            disabled={downloading !== null || (preset === "UNSYNCED" && pendingPayments === 0)}
                            className="w-full flex items-center justify-center gap-2 bg-[var(--green-bright)] hover:brightness-110 text-black font-semibold text-xs py-2.5 px-4 rounded-lg transition-all shadow-sm disabled:opacity-40"
                        >
                            {downloading === "/api/v1/tally/export/receipts-xml" ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Download size={14} />
                            )}
                            <span>Download Receipts XML ({pendingPayments})</span>
                        </button>
                    </div>
                </div>

                {/* Step 4: Combined All-in-One XML */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 flex flex-col justify-between hover:border-[var(--gold)]/30 transition-all">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded">
                                All-in-One
                            </span>
                            <FileText size={18} className="text-[var(--text-muted)]" />
                        </div>
                        <h3 className="font-semibold text-base mb-1">Combined Vouchers XML</h3>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            Contains both Sales and Receipt vouchers bundled together in a single XML file. One-click import for fast daily closing.
                        </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-[var(--border)]">
                        <button
                            onClick={() => handleDownload("/api/v1/tally/export/combined-xml", "tally-all-vouchers.xml")}
                            disabled={downloading !== null || (preset === "UNSYNCED" && pendingInvoices === 0 && pendingPayments === 0)}
                            className="w-full flex items-center justify-center gap-2 border border-[var(--border)] hover:bg-[var(--bg-secondary)] font-semibold text-xs py-2.5 px-4 rounded-lg transition-all disabled:opacity-40"
                        >
                            {downloading === "/api/v1/tally/export/combined-xml" ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Download size={14} />
                            )}
                            <span>Download All Vouchers ({pendingInvoices + pendingPayments})</span>
                        </button>
                    </div>
                </div>

                {/* Step 5: Sales CSV for Excel */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 flex flex-col justify-between hover:border-[var(--gold)]/30 transition-all">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded">
                                Excel / Spreadsheet
                            </span>
                            <FileSpreadsheet size={18} className="text-[var(--text-muted)]" />
                        </div>
                        <h3 className="font-semibold text-base mb-1">Sales Daybook CSV</h3>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            Item-wise sales register formatted for Microsoft Excel, Google Sheets, or custom Excel-to-Tally utility tools.
                        </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-[var(--border)]">
                        <button
                            onClick={() => handleDownload("/api/v1/tally/export/csv?type=sales", "sales-daybook.csv")}
                            disabled={downloading !== null}
                            className="w-full flex items-center justify-center gap-2 border border-[var(--border)] hover:bg-[var(--bg-secondary)] font-semibold text-xs py-2.5 px-4 rounded-lg transition-all"
                        >
                            {downloading?.includes("type=sales") ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Download size={14} />
                            )}
                            <span>Download Sales CSV</span>
                        </button>
                    </div>
                </div>

                {/* Step 6: Receipts CSV for Excel */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 flex flex-col justify-between hover:border-[var(--gold)]/30 transition-all">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded">
                                Excel / Spreadsheet
                            </span>
                            <FileSpreadsheet size={18} className="text-[var(--text-muted)]" />
                        </div>
                        <h3 className="font-semibold text-base mb-1">Receipts Daybook CSV</h3>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            Collection daybook with payment mode, reference numbers, customer names, and bank accounts formatted for spreadsheets.
                        </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-[var(--border)]">
                        <button
                            onClick={() => handleDownload("/api/v1/tally/export/csv?type=receipts", "receipts-daybook.csv")}
                            disabled={downloading !== null}
                            className="w-full flex items-center justify-center gap-2 border border-[var(--border)] hover:bg-[var(--bg-secondary)] font-semibold text-xs py-2.5 px-4 rounded-lg transition-all"
                        >
                            {downloading?.includes("type=receipts") ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Download size={14} />
                            )}
                            <span>Download Receipts CSV</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Step-by-Step Tally Prime Import Guide */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                <button
                    onClick={() => setShowGuide(!showGuide)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-[var(--bg-secondary)]/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--gold)]/10 text-[var(--gold)]">
                            <HelpCircle size={18} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-base">How to Import into Tally Prime (3 Easy Steps)</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">Quick guide to import these XML files without errors.</p>
                        </div>
                    </div>
                    {showGuide ? <ChevronUp size={18} className="text-[var(--text-muted)]" /> : <ChevronDown size={18} className="text-[var(--text-muted)]" />}
                </button>

                {showGuide && (
                    <div className="p-5 pt-0 border-t border-[var(--border)] divide-y divide-[var(--border)] text-sm">
                        <div className="py-4 flex gap-4 items-start">
                            <span className="w-6 h-6 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                1
                            </span>
                            <div>
                                <h4 className="font-medium text-[var(--text-primary)]">Import Masters First</h4>
                                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                                    In Tally Prime, press <strong>Alt + O</strong> (or click <strong>Import</strong> on top) &rarr; select <strong>Masters</strong> &rarr; enter file path to <code>tally-masters.xml</code>.
                                    This creates all your retailer ledgers under <em>Sundry Debtors</em> and stock items under <em>Primary</em> with their GST rates.
                                </p>
                            </div>
                        </div>

                        <div className="py-4 flex gap-4 items-start">
                            <span className="w-6 h-6 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                2
                            </span>
                            <div>
                                <h4 className="font-medium text-[var(--text-primary)]">Import Vouchers (Transactions)</h4>
                                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                                    In Tally Prime, press <strong>Alt + O</strong> &rarr; select <strong>Transactions</strong> &rarr; enter file path to <code>tally-sales.xml</code> (or <code>tally-all-vouchers.xml</code>).
                                    Tally will import all invoices with inventory, tax, and customer debit entries.
                                </p>
                            </div>
                        </div>

                        <div className="py-4 flex gap-4 items-start">
                            <span className="w-6 h-6 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                                3
                            </span>
                            <div>
                                <h4 className="font-medium text-[var(--text-primary)]">Verify in Daybook</h4>
                                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                                    Press <strong>Alt + G</strong> (Go To) &rarr; type <strong>Daybook</strong> &rarr; choose your date range. All imported vouchers will appear with exact amounts and GST splits.
                                </p>
                            </div>
                        </div>

                        <div className="pt-3 text-xs text-[var(--text-muted)] flex items-center gap-2">
                            <AlertCircle size={14} className="text-[var(--gold)]" />
                            <span>
                                Make sure the Company Name in Tally matches <strong>&quot;{companyName}&quot;</strong> configured above.
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Config Modal */}
            {showConfigModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 max-w-md w-full space-y-4 shadow-xl animate-in zoom-in-95">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Building2 size={18} className="text-[var(--gold)]" />
                                <h3 className="font-semibold text-lg">Tally Company Name</h3>
                            </div>
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                &times;
                            </button>
                        </div>

                        <p className="text-xs text-[var(--text-muted)]">
                            Enter the exact name of your company as created in Tally Prime. Tally uses this name to verify vouchers during XML import.
                        </p>

                        <div>
                            <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                                Company Name in Tally
                            </label>
                            <input
                                type="text"
                                value={tallyCompanyNameInput}
                                onChange={(e) => setTallyCompanyNameInput(e.target.value)}
                                placeholder="e.g. Radha Kishan Traders (2026-27)"
                                className="input-field w-full text-sm py-2 px-3 border rounded-lg"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="px-4 py-2 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--bg-secondary)]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => saveConfigMutation.mutate(tallyCompanyNameInput)}
                                disabled={saveConfigMutation.isPending || !tallyCompanyNameInput.trim()}
                                className="bg-[var(--gold)] hover:bg-[var(--gold-dark)] text-black font-semibold px-4 py-2 text-xs rounded-lg disabled:opacity-50"
                            >
                                {saveConfigMutation.isPending ? "Saving..." : "Save Company"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
