"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Loader2,
    Download,
    FileCode,
    FileSpreadsheet,
    ShieldCheck,
    CheckCircle2,
    Building2,
    Users,
    Layers,
    Receipt,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    AlertCircle,
    FileText,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { formatINR } from "@/lib/utils";
import toast from "react-hot-toast";

type GstPreset = "MTD" | "LAST_MONTH" | "Q1" | "Q2" | "Q3" | "Q4" | "CUSTOM";
type TabType = "b2b" | "b2cs" | "hsn" | "docs";

function getGstPeriodDates(preset: GstPreset): { start: string; end: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    switch (preset) {
        case "MTD": {
            const start = new Date(y, m, 1).toISOString().split("T")[0];
            const end = now.toISOString().split("T")[0];
            return { start, end };
        }
        case "LAST_MONTH": {
            const start = new Date(y, m - 1, 1).toISOString().split("T")[0];
            const end = new Date(y, m, 0).toISOString().split("T")[0];
            return { start, end };
        }
        case "Q1": {
            const fiscalYear = m < 3 ? y - 1 : y;
            return { start: `${fiscalYear}-04-01`, end: `${fiscalYear}-06-30` };
        }
        case "Q2": {
            const fiscalYear = m < 3 ? y - 1 : y;
            return { start: `${fiscalYear}-07-01`, end: `${fiscalYear}-09-30` };
        }
        case "Q3": {
            const fiscalYear = m < 3 ? y - 1 : y;
            return { start: `${fiscalYear}-10-01`, end: `${fiscalYear}-12-31` };
        }
        case "Q4": {
            const fiscalYear = m < 3 ? y : y + 1;
            return { start: `${fiscalYear}-01-01`, end: `${fiscalYear}-03-31` };
        }
        default: {
            const start = new Date(y, m, 1).toISOString().split("T")[0];
            const end = now.toISOString().split("T")[0];
            return { start, end };
        }
    }
}

export default function GstComplianceHubPage() {
    const [preset, setPreset] = useState<GstPreset>("MTD");
    const defaults = getGstPeriodDates("MTD");
    const [customStart, setCustomStart] = useState(defaults.start);
    const [customEnd, setCustomEnd] = useState(defaults.end);
    const [activeTab, setActiveTab] = useState<TabType>("b2b");
    const [showGuide, setShowGuide] = useState(true);
    const [downloading, setDownloading] = useState<string | null>(null);

    const { start: startDate, end: endDate } =
        preset === "CUSTOM"
            ? { start: customStart, end: customEnd }
            : getGstPeriodDates(preset);

    const { data: gstData, isLoading, refetch } = useQuery({
        queryKey: ["gstr1-report", startDate, endDate],
        queryFn: async () => {
            const res = await apiClient.get(
                `/api/v1/invoices/gstr1?from=${startDate}&to=${endDate}`
            );
            return res.data?.data || res.data;
        },
        enabled: !!startDate && !!endDate,
    });

    const summary = gstData?.summary || {
        totalTaxable: 0,
        totalTax: 0,
        totalInvoices: 0,
        b2bTaxable: 0,
        b2bTax: 0,
        b2bCount: 0,
        b2csTaxable: 0,
        b2csTax: 0,
        b2csCount: 0,
    };

    const handleDownloadJson = async () => {
        setDownloading("json");
        try {
            const res = await apiClient.get(
                `/api/v1/invoices/gstr1/json?from=${startDate}&to=${endDate}`,
                { responseType: "blob" }
            );
            const blob = new Blob([res.data], { type: "application/json" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const gstin = gstData?.supplierGstin || "URP";
            const fp = gstData?.fp || "RETURN";
            a.download = `GSTR1_${gstin}_${fp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("GSTR-1 JSON downloaded successfully!");
        } catch {
            toast.error("Failed to download GSTR-1 JSON");
        } finally {
            setDownloading(null);
        }
    };

    const handleDownloadCsv = async () => {
        setDownloading("csv");
        try {
            const res = await apiClient.get(
                `/api/v1/invoices/gstr1/csv?from=${startDate}&to=${endDate}`,
                { responseType: "blob" }
            );
            const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const gstin = gstData?.supplierGstin || "URP";
            const fp = gstData?.fp || "RETURN";
            a.download = `GSTR1_${gstin}_${fp}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("GSTR-1 CSV summary downloaded!");
        } catch {
            toast.error("Failed to download GSTR-1 CSV");
        } finally {
            setDownloading(null);
        }
    };

    const PRESETS: { label: string; value: GstPreset }[] = [
        { label: "This Month", value: "MTD" },
        { label: "Last Month", value: "LAST_MONTH" },
        { label: "Q1 (Apr–Jun)", value: "Q1" },
        { label: "Q2 (Jul–Sep)", value: "Q2" },
        { label: "Q3 (Oct–Dec)", value: "Q3" },
        { label: "Q4 (Jan–Mar)", value: "Q4" },
        { label: "Custom Dates", value: "CUSTOM" },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-[var(--gold)]/10 text-[var(--gold)]">
                            <ShieldCheck size={20} />
                        </span>
                        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                            GST Compliance & GSTR-1 Hub
                        </h1>
                    </div>
                    <p className="text-[var(--text-muted)] text-sm mt-1">
                        Outward supplies report, statutory tax breakdown, and government portal upload files.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleDownloadJson}
                        disabled={downloading !== null || isLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--gold)] text-black text-xs font-bold hover:bg-[var(--gold-light)] disabled:opacity-50 transition shadow-md shadow-amber-500/10"
                    >
                        {downloading === "json" ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <FileCode size={14} />
                        )}
                        <span>Download GSTR-1 JSON (Govt Portal)</span>
                    </button>

                    <button
                        onClick={handleDownloadCsv}
                        disabled={downloading !== null || isLoading}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--border)] text-xs font-semibold hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] disabled:opacity-50 transition"
                    >
                        {downloading === "csv" ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <FileSpreadsheet size={14} />
                        )}
                        <span>Export CSV for CA</span>
                    </button>
                </div>
            </div>

            {/* Period Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)] font-medium">Filing Period:</span>
                    <span className="text-xs font-mono font-bold text-[var(--gold)]">
                        {startDate} to {endDate}
                    </span>
                    {gstData?.fp && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)] text-[10px] font-mono font-bold">
                            Return Period: {gstData.fp}
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {PRESETS.map((p) => (
                        <button
                            key={p.value}
                            onClick={() => setPreset(p.value)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                                preset === p.value
                                    ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30 font-medium"
                                    : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {preset === "CUSTOM" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] w-fit">
                    <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="px-2 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">to</span>
                    <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="px-2 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                    />
                </div>
            )}

            {/* Quick Guide Card */}
            <div className="border border-[var(--border)] rounded-xl bg-[var(--bg-card)] overflow-hidden">
                <button
                    onClick={() => setShowGuide(!showGuide)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-secondary)]/50 transition"
                >
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                        <HelpCircle size={15} className="text-[var(--gold)]" />
                        <span>How to file your GSTR-1 using this downloaded JSON</span>
                    </div>
                    {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showGuide && (
                    <div className="p-4 pt-0 border-t border-[var(--border)] text-xs text-[var(--text-muted)] space-y-2">
                        <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                            <li>
                                Click <strong>Download GSTR-1 JSON</strong> above for your desired month or quarter.
                            </li>
                            <li>
                                Open the official <strong>GST Offline Tool</strong> (provided by GSTN) or log into{" "}
                                <a
                                    href="https://services.gst.gov.in"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[var(--gold)] underline inline-flex items-center gap-0.5"
                                >
                                    services.gst.gov.in <ExternalLink size={10} />
                                </a>
                                .
                            </li>
                            <li>
                                Navigate to <strong>Returns Dashboard → GSTR-1 → Prepare Offline → Upload</strong> and select the downloaded <code>.json</code> file.
                            </li>
                            <li>
                                The GST portal auto-populates <strong>Table 4A (B2B)</strong>, <strong>Table 7 (B2CS)</strong>, and <strong>Table 12 (HSN)</strong> in seconds.
                            </li>
                        </ol>
                    </div>
                )}
            </div>

            {/* Metric Summary Cards */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
                                Total Taxable Value
                            </span>
                            <p className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-1">
                                {formatINR(summary.totalTaxable)}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">
                                Across {summary.totalInvoices} active invoices
                            </p>
                        </div>

                        <div className="p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
                                Total Output GST
                            </span>
                            <p className="text-2xl font-bold font-mono text-[var(--green-bright)] mt-1">
                                {formatINR(summary.totalTax)}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">
                                CGST + SGST + IGST liability
                            </p>
                        </div>

                        <div className="p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
                                B2B Registered Sales
                            </span>
                            <p className="text-2xl font-bold font-mono text-[var(--gold)] mt-1">
                                {formatINR(summary.b2bTaxable)}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">
                                {summary.b2bCount} invoices • Tax: {formatINR(summary.b2bTax)}
                            </p>
                        </div>

                        <div className="p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
                                B2CS Retail / Unregistered
                            </span>
                            <p className="text-2xl font-bold font-mono text-purple-400 mt-1">
                                {formatINR(summary.b2csTaxable)}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">
                                {summary.b2csCount} tax rate lines • Tax: {formatINR(summary.b2csTax)}
                            </p>
                        </div>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="flex border-b border-[var(--border)]">
                        <button
                            onClick={() => setActiveTab("b2b")}
                            className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
                                activeTab === "b2b"
                                    ? "border-[var(--gold)] text-[var(--gold)]"
                                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            }`}
                        >
                            <Building2 size={14} />
                            <span>Table 4A: B2B Invoices ({gstData?.b2b?.length || 0})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab("b2cs")}
                            className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
                                activeTab === "b2cs"
                                    ? "border-[var(--gold)] text-[var(--gold)]"
                                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            }`}
                        >
                            <Users size={14} />
                            <span>Table 7: B2CS Small Supplies ({gstData?.b2cs?.length || 0})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab("hsn")}
                            className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
                                activeTab === "hsn"
                                    ? "border-[var(--gold)] text-[var(--gold)]"
                                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            }`}
                        >
                            <Layers size={14} />
                            <span>Table 12: HSN Summary ({gstData?.hsn?.length || 0})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab("docs")}
                            className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
                                activeTab === "docs"
                                    ? "border-[var(--gold)] text-[var(--gold)]"
                                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            }`}
                        >
                            <FileText size={14} />
                            <span>Table 13: Documents Summary</span>
                        </button>
                    </div>

                    {/* Tab Contents */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                        {/* ─── TAB 1: B2B INVOICES ─── */}
                        {activeTab === "b2b" && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-secondary)]/50">
                                            <th className="text-left p-3.5">Customer GSTIN</th>
                                            <th className="text-left p-3.5">Invoice #</th>
                                            <th className="text-left p-3.5">Date</th>
                                            <th className="text-center p-3.5">POS</th>
                                            <th className="text-right p-3.5">Rate</th>
                                            <th className="text-right p-3.5">Taxable Value</th>
                                            <th className="text-right p-3.5">CGST</th>
                                            <th className="text-right p-3.5">SGST</th>
                                            <th className="text-right p-3.5">Invoice Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                        {(!gstData?.b2b || gstData.b2b.length === 0) ? (
                                            <tr>
                                                <td colSpan={9} className="text-center py-10 text-[var(--text-muted)]">
                                                    No registered B2B invoices found in this period.
                                                </td>
                                            </tr>
                                        ) : (
                                            gstData.b2b.flatMap((b: any) =>
                                                b.inv.flatMap((inv: any) =>
                                                    inv.itms.map((itm: any, idx: number) => (
                                                        <tr key={`${inv.inum}-${idx}`} className="hover:bg-[var(--bg-secondary)]/30">
                                                            <td className="p-3.5 font-mono font-semibold text-[var(--gold)]">
                                                                {b.ctin}
                                                            </td>
                                                            <td className="p-3.5 font-medium">{inv.inum}</td>
                                                            <td className="p-3.5 text-[var(--text-muted)]">{inv.idt}</td>
                                                            <td className="p-3.5 text-center font-mono">{inv.pos}</td>
                                                            <td className="p-3.5 text-right font-mono">{itm.itm_det.rt}%</td>
                                                            <td className="p-3.5 text-right font-mono font-medium">
                                                                {formatINR(itm.itm_det.txval)}
                                                            </td>
                                                            <td className="p-3.5 text-right font-mono text-[var(--text-muted)]">
                                                                {formatINR(itm.itm_det.camt)}
                                                            </td>
                                                            <td className="p-3.5 text-right font-mono text-[var(--text-muted)]">
                                                                {formatINR(itm.itm_det.samt)}
                                                            </td>
                                                            <td className="p-3.5 text-right font-mono font-bold text-[var(--text-primary)]">
                                                                {formatINR(inv.val)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ─── TAB 2: B2CS SMALL SUPPLIES ─── */}
                        {activeTab === "b2cs" && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-secondary)]/50">
                                            <th className="text-left p-3.5">Supply Type</th>
                                            <th className="text-center p-3.5">Place of Supply (POS)</th>
                                            <th className="text-center p-3.5">Tax Rate (%)</th>
                                            <th className="text-right p-3.5">Taxable Value</th>
                                            <th className="text-right p-3.5">CGST</th>
                                            <th className="text-right p-3.5">SGST</th>
                                            <th className="text-right p-3.5">Total Tax</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                        {(!gstData?.b2cs || gstData.b2cs.length === 0) ? (
                                            <tr>
                                                <td colSpan={7} className="text-center py-10 text-[var(--text-muted)]">
                                                    No B2CS (unregistered/retail) outward supplies in this period.
                                                </td>
                                            </tr>
                                        ) : (
                                            gstData.b2cs.map((row: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-[var(--bg-secondary)]/30">
                                                    <td className="p-3.5 font-semibold text-purple-400">
                                                        {row.sply_ty}
                                                    </td>
                                                    <td className="p-3.5 text-center font-mono">{row.pos}</td>
                                                    <td className="p-3.5 text-center font-mono font-medium">{row.rt}%</td>
                                                    <td className="p-3.5 text-right font-mono font-bold">
                                                        {formatINR(row.txval)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono text-[var(--text-muted)]">
                                                        {formatINR(row.camt)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono text-[var(--text-muted)]">
                                                        {formatINR(row.samt)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono font-bold text-[var(--green-bright)]">
                                                        {formatINR(row.camt + row.samt + (row.csamt || 0))}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ─── TAB 3: HSN SUMMARY ─── */}
                        {activeTab === "hsn" && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-secondary)]/50">
                                            <th className="text-center p-3.5">#</th>
                                            <th className="text-left p-3.5">HSN Code</th>
                                            <th className="text-left p-3.5">Description</th>
                                            <th className="text-center p-3.5">UQC</th>
                                            <th className="text-right p-3.5">Total Qty</th>
                                            <th className="text-right p-3.5">Taxable Value</th>
                                            <th className="text-right p-3.5">CGST</th>
                                            <th className="text-right p-3.5">SGST</th>
                                            <th className="text-right p-3.5">Total Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                        {(!gstData?.hsn || gstData.hsn.length === 0) ? (
                                            <tr>
                                                <td colSpan={9} className="text-center py-10 text-[var(--text-muted)]">
                                                    No HSN summary data available for this period.
                                                </td>
                                            </tr>
                                        ) : (
                                            gstData.hsn.map((h: any) => (
                                                <tr key={h.num} className="hover:bg-[var(--bg-secondary)]/30">
                                                    <td className="p-3.5 text-center text-[var(--text-muted)]">{h.num}</td>
                                                    <td className="p-3.5 font-mono font-bold text-[var(--gold)]">
                                                        {h.hsn_sc}
                                                    </td>
                                                    <td className="p-3.5 font-medium">{h.desc}</td>
                                                    <td className="p-3.5 text-center font-mono">{h.uqc}</td>
                                                    <td className="p-3.5 text-right font-mono">{h.qty}</td>
                                                    <td className="p-3.5 text-right font-mono font-medium">
                                                        {formatINR(h.txval)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono text-[var(--text-muted)]">
                                                        {formatINR(h.camt)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono text-[var(--text-muted)]">
                                                        {formatINR(h.samt)}
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono font-bold text-[var(--text-primary)]">
                                                        {formatINR(h.val)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ─── TAB 4: DOCUMENTS SUMMARY ─── */}
                        {activeTab === "docs" && (
                            <div className="p-5 space-y-4">
                                <div className="p-4 rounded-lg bg-[var(--bg-secondary)]/40 border border-[var(--border)]">
                                    <h3 className="font-semibold text-sm mb-3">
                                        Table 13: Summary of Documents Issued during the Tax Period
                                    </h3>
                                    {gstData?.doc_issue?.doc_det?.[0]?.docs?.[0] ? (
                                        (() => {
                                            const doc = gstData.doc_issue.doc_det[0].docs[0];
                                            return (
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                                                    <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)]">
                                                        <span className="text-[var(--text-muted)] block">From Serial #</span>
                                                        <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                                                            {doc.from}
                                                        </span>
                                                    </div>
                                                    <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)]">
                                                        <span className="text-[var(--text-muted)] block">To Serial #</span>
                                                        <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                                                            {doc.to}
                                                        </span>
                                                    </div>
                                                    <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)]">
                                                        <span className="text-[var(--text-muted)] block">Total Issued</span>
                                                        <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                                                            {doc.totnum}
                                                        </span>
                                                    </div>
                                                    <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)]">
                                                        <span className="text-[var(--text-muted)] block">Cancelled</span>
                                                        <span className="font-mono font-bold text-sm text-rose-400">
                                                            {doc.canc}
                                                        </span>
                                                    </div>
                                                    <div className="p-3 rounded bg-[var(--bg-card)] border border-[var(--border)]">
                                                        <span className="text-[var(--text-muted)] block">Net Valid</span>
                                                        <span className="font-mono font-bold text-sm text-[var(--green-bright)]">
                                                            {doc.net_issue}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    ) : (
                                        <p className="text-xs text-[var(--text-muted)]">No invoice documents issued in this period.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
