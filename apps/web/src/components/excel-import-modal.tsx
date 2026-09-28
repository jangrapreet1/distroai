"use client";

import React, { useState, useRef } from "react";
import {
    X,
    Upload,
    FileSpreadsheet,
    Download,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    ArrowRight,
    ArrowLeft,
    Check,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

export interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    type: "customers" | "orders";
    title?: string;
    description?: string;
}

export function ExcelImportModal({
    isOpen,
    onClose,
    onSuccess,
    type,
    title,
    description,
}: ExcelImportModalProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showMapping, setShowMapping] = useState(false);

    // Preview data from server
    const [previewData, setPreviewData] = useState<any>(null);
    const [customMapping, setCustomMapping] = useState<Record<string, string>>({});
    const [editedRows, setEditedRows] = useState<any[]>([]);

    // Import options
    const [updateExisting, setUpdateExisting] = useState(true);
    const [createOpeningBalance, setCreateOpeningBalance] = useState(true);
    const [skipErrors, setSkipErrors] = useState(true);

    // Execution results
    const [importResult, setImportResult] = useState<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const modalTitle =
        title || (type === "customers" ? "Import Customers from Excel" : "Import Orders from Excel");
    const modalDesc =
        description ||
        (type === "customers"
            ? "Upload Excel or CSV sheets from Tally, Marg, Busy, or custom files to bulk create customers and ledger balances."
            : "Upload multi-item order sheets from Tally, Marg, Busy, or custom files to bulk create orders and allocate ledger entries.");

    const handleFileSelect = (selectedFile: File) => {
        const ext = selectedFile.name.split(".").pop()?.toLowerCase();
        if (!["xlsx", "xls", "csv"].includes(ext || "")) {
            toast.error("Please upload a valid .xlsx, .xls, or .csv file");
            return;
        }
        setFile(selectedFile);
    };

    const handleDownloadTemplate = async () => {
        try {
            toast.loading("Downloading template...", { id: "template-dl" });
            const endpoint = `/api/v1/${type}/import/template`;
            const response = await apiClient.get(endpoint, {
                responseType: "blob",
                headers: { "x-suppress-upgrade-modal": "true" },
            });

            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = type === "customers" ? "distroai_customers_template.xlsx" : "distroai_orders_template.xlsx";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
            toast.success("Sample template downloaded!", { id: "template-dl" });
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to download sample template", {
                id: "template-dl",
            });
        }
    };

    const handleUploadAndPreview = async () => {
        if (!file) {
            toast.error("Please select a file to import");
            return;
        }

        try {
            setIsLoading(true);
            const formData = new FormData();
            formData.append("file", file);

            const endpoint = `/api/v1/${type}/import/preview`;
            const response = await apiClient.post(endpoint, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            // If apiClient unwraps response.data:
            const data = response.data?.data ?? response.data;
            setPreviewData(data);
            setCustomMapping(data.mapping || data.detectedMapping || {});
            setEditedRows(data.validationResults || data.rows || []);
            setStep(2);
        } catch (err: any) {
            toast.error(
                err.response?.data?.message || err.message || "Failed to parse and validate spreadsheet"
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleExecuteImport = async () => {
        try {
            setIsLoading(true);
            const endpoint = `/api/v1/${type}/import/execute`;

            // Extract rows: if skipErrors is true, only send rows where isValid is true
            const rowsToImport = skipErrors
                ? editedRows.filter((r) => r.isValid).map((r) => r.data)
                : editedRows.map((r) => r.data);

            if (rowsToImport.length === 0) {
                toast.error("No valid rows available to import");
                setIsLoading(false);
                return;
            }

            const payload = {
                rows: rowsToImport,
                options: {
                    updateExisting,
                    createOpeningBalance,
                    autoCreateCustomers: true,
                    skipErrors,
                },
            };

            const response = await apiClient.post(endpoint, payload);
            const result = response.data?.data ?? response.data;
            setImportResult(result);
            setStep(3);
            const processedCount = result.createdCount ?? result.createdOrders ?? result.created ?? 0;
            toast.success(
                `Successfully processed ${processedCount + (result.updatedCount || 0)} records!`
            );
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to execute import");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCellChange = (rowIndex: number, field: string, value: any) => {
        setEditedRows((prev) =>
            prev.map((row, idx) => {
                if (idx !== rowIndex) return row;
                const updatedData = { ...row.data, [field]: value };
                // Simple validation recalculation for non-empty phone and name
                const hasErrors =
                    type === "customers"
                        ? !updatedData.name?.toString().trim()
                        : !updatedData.customerPhone?.toString().trim() ||
                          !updatedData.productNameOrSku?.toString().trim();
                return {
                    ...row,
                    data: updatedData,
                    isValid: !hasErrors,
                };
            })
        );
    };

    const handleClose = () => {
        setStep(1);
        setFile(null);
        setPreviewData(null);
        setEditedRows([]);
        setImportResult(null);
        onClose();
    };

    const handleFinish = () => {
        handleClose();
        onSuccess();
    };

    const validCount = editedRows.filter((r) => r.isValid).length;
    const errorCount = editedRows.filter((r) => !r.isValid).length;
    const existingCount = editedRows.filter((r) => r.isExisting).length;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={handleClose}
        >
            <div
                className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
                    <div>
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="text-[var(--gold)]" size={22} />
                            <h2
                                className="text-xl font-bold text-[var(--text-primary)]"
                                style={{ fontFamily: "var(--font-playfair)" }}
                            >
                                {modalTitle}
                            </h2>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{modalDesc}</p>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md hover:bg-[var(--bg-card)] transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Stepper Wizard Bar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] text-xs">
                    <div className="flex items-center gap-2">
                        <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                step >= 1
                                    ? "bg-[var(--gold)] text-[var(--bg-primary)]"
                                    : "bg-[var(--bg-card)] text-[var(--text-muted)]"
                            }`}
                        >
                            1
                        </span>
                        <span className={step === 1 ? "font-semibold text-[var(--gold)]" : "text-[var(--text-muted)]"}>
                            Upload File
                        </span>
                    </div>
                    <div className="h-[1px] w-12 bg-[var(--border)] hidden sm:block" />
                    <div className="flex items-center gap-2">
                        <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                step >= 2
                                    ? "bg-[var(--gold)] text-[var(--bg-primary)]"
                                    : "bg-[var(--bg-card)] text-[var(--text-muted)]"
                            }`}
                        >
                            2
                        </span>
                        <span className={step === 2 ? "font-semibold text-[var(--gold)]" : "text-[var(--text-muted)]"}>
                            Preview & Validate
                        </span>
                    </div>
                    <div className="h-[1px] w-12 bg-[var(--border)] hidden sm:block" />
                    <div className="flex items-center gap-2">
                        <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                step === 3
                                    ? "bg-[var(--green-bright)] text-black"
                                    : "bg-[var(--bg-card)] text-[var(--text-muted)]"
                            }`}
                        >
                            3
                        </span>
                        <span className={step === 3 ? "font-semibold text-[var(--green-bright)]" : "text-[var(--text-muted)]"}>
                            Completed
                        </span>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* STEP 1: Upload File */}
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* Download Sample Template Banner */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                                        Need the official DistroAI format?
                                    </h4>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Download pre-formatted Excel template with sample rows and column guidelines.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] text-xs font-medium text-[var(--gold)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/10 transition"
                                >
                                    <Download size={14} /> Download Sample .XLSX
                                </button>
                            </div>

                            {/* Dropzone */}
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    if (e.dataTransfer.files?.[0]) {
                                        handleFileSelect(e.dataTransfer.files[0]);
                                    }
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-[var(--radius-lg)] p-8 text-center cursor-pointer transition ${
                                    isDragging
                                        ? "border-[var(--gold)] bg-[var(--gold)]/5"
                                        : "border-[var(--border)] hover:border-[var(--gold)]/50 bg-[var(--bg-secondary)]/30"
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            handleFileSelect(e.target.files[0]);
                                        }
                                    }}
                                />

                                <div className="flex flex-col items-center justify-center space-y-3">
                                    <div className="w-12 h-12 rounded-full bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
                                        <Upload size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                                            {file ? file.name : "Drag & drop your Excel or CSV file here"}
                                        </p>
                                        <p className="text-xs text-[var(--text-muted)] mt-1">
                                            {file
                                                ? `${(file.size / 1024).toFixed(1)} KB — Click or drag to change`
                                                : "Supports .xlsx, .xls, .csv files exported from Tally, Marg, Busy, Vyapar or custom sheets"}
                                        </p>
                                    </div>
                                    {file && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--green-bright)]/10 text-[var(--green-bright)]">
                                            <Check size={13} /> Ready to parse
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Intelligent Features Notice */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)]">
                                    <div className="font-semibold text-[var(--text-primary)] mb-1">
                                        ✨ Indian ERP Auto-Detection
                                    </div>
                                    <p className="text-[var(--text-muted)]">
                                        Automatic matching for Party Name, Mobile No, GSTIN, Station, Cr Limit, Op Bal.
                                    </p>
                                </div>
                                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)]">
                                    <div className="font-semibold text-[var(--text-primary)] mb-1">
                                        ⚡ Ledger & Balance Sync
                                    </div>
                                    <p className="text-[var(--text-muted)]">
                                        Opening balances and orders immediately sync to Date-Wise RTK Customer Statements.
                                    </p>
                                </div>
                                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)]">
                                    <div className="font-semibold text-[var(--text-primary)] mb-1">
                                        🛡️ Smart Deduplication
                                    </div>
                                    <p className="text-[var(--text-muted)]">
                                        Matches existing records by Phone or GSTIN. Choose whether to update or keep existing.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Preview & Validate */}
                    {step === 2 && previewData && (
                        <div className="space-y-5">
                            {/* Summary Metrics Banner */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-3">
                                    <p className="text-xs text-[var(--text-muted)]">Total Rows</p>
                                    <p
                                        className="text-xl font-bold text-[var(--text-primary)] mt-1"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        {previewData.totalRows ?? previewData.totalOrders ?? previewData.rows?.length ?? 0}
                                    </p>
                                </div>
                                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-3">
                                    <p className="text-xs text-[var(--green-bright)]">Ready to Import</p>
                                    <p
                                        className="text-xl font-bold text-[var(--green-bright)] mt-1"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        {validCount}
                                    </p>
                                </div>
                                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-3">
                                    <p className="text-xs text-[var(--gold)]">Existing / Updates</p>
                                    <p
                                        className="text-xl font-bold text-[var(--gold)] mt-1"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        {existingCount}
                                    </p>
                                </div>
                                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-3">
                                    <p className="text-xs text-[var(--red)]">Issues / Incomplete</p>
                                    <p
                                        className="text-xl font-bold text-[var(--red)] mt-1"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        {errorCount}
                                    </p>
                                </div>
                            </div>

                            {/* Column Mapping Collapsible */}
                            <div className="border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)] overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowMapping(!showMapping)}
                                    className="w-full flex items-center justify-between p-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                                >
                                    <span>
                                        Column Header Mapping (
                                        {Object.keys(customMapping).length} detected columns)
                                    </span>
                                    {showMapping ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>

                                {showMapping && (
                                    <div className="p-4 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-[var(--bg-primary)]">
                                        {Object.entries(customMapping).map(([targetKey, sourceCol]) => (
                                             <div key={targetKey} className="text-xs">
                                                 <span className="text-[var(--text-muted)] block capitalize mb-1">
                                                     {targetKey.replace(/([A-Z])/g, " $1")}:
                                                 </span>
                                                 <select
                                                     value={sourceCol}
                                                     onChange={(e) =>
                                                         setCustomMapping((prev) => ({
                                                             ...prev,
                                                             [targetKey]: e.target.value,
                                                         }))
                                                     }
                                                     className="w-full px-2 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs focus:border-[var(--gold)] outline-none"
                                                 >
                                                     <option value="">(Not Mapped)</option>
                                                     {(previewData.availableHeaders || previewData.rawHeaders)?.map((h: string) => (
                                                         <option key={h} value={h}>
                                                             {h}
                                                         </option>
                                                     ))}
                                                 </select>
                                             </div>
                                         ))}
                                    </div>
                                )}
                            </div>

                            {/* Options Toggles */}
                            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] space-y-3 text-xs">
                                <div className="font-semibold text-[var(--text-secondary)] mb-2">Import Settings</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={updateExisting}
                                            onChange={(e) => setUpdateExisting(e.target.checked)}
                                            className="rounded border-[var(--border)] text-[var(--gold)] focus:ring-[var(--gold)] bg-[var(--bg-primary)]"
                                        />
                                        <span className="text-[var(--text-primary)]">
                                            Update existing records if found (by Phone/GSTIN)
                                        </span>
                                    </label>

                                    {type === "customers" && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={createOpeningBalance}
                                                onChange={(e) => setCreateOpeningBalance(e.target.checked)}
                                                className="rounded border-[var(--border)] text-[var(--gold)] focus:ring-[var(--gold)] bg-[var(--bg-primary)]"
                                            />
                                            <span className="text-[var(--text-primary)]">
                                                Create Opening Balance ledger entry in Date-Wise Ledger
                                            </span>
                                        </label>
                                    )}

                                    <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
                                        <input
                                            type="checkbox"
                                            checked={skipErrors}
                                            onChange={(e) => setSkipErrors(e.target.checked)}
                                            className="rounded border-[var(--border)] text-[var(--gold)] focus:ring-[var(--gold)] bg-[var(--bg-primary)]"
                                        />
                                        <span className="text-[var(--text-primary)]">
                                            Import valid rows only (skip {errorCount} rows with errors)
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Interactive Data Table Preview */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                                        Data Preview (First 50 Rows — click cells to edit)
                                    </h4>
                                    <span className="text-xs text-[var(--text-muted)]">
                                        Showing {editedRows.slice(0, 50).length} of {editedRows.length} rows
                                    </span>
                                </div>

                                <div className="border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg-card)] overflow-x-auto max-h-[360px] text-xs">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-[var(--bg-secondary)] sticky top-0 border-b border-[var(--border)] text-[var(--text-muted)]">
                                            <tr>
                                                <th className="p-2.5 w-12 text-center">#</th>
                                                <th className="p-2.5 w-24">Status</th>
                                                {type === "customers" ? (
                                                    <>
                                                        <th className="p-2.5 min-w-[140px]">Customer Name</th>
                                                        <th className="p-2.5 min-w-[110px]">Phone</th>
                                                        <th className="p-2.5 min-w-[90px]">Type</th>
                                                        <th className="p-2.5 min-w-[100px]">City</th>
                                                        <th className="p-2.5 min-w-[110px]">GSTIN</th>
                                                        <th className="p-2.5 min-w-[100px] text-right">Opening Bal</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="p-2.5 min-w-[100px]">Order No</th>
                                                        <th className="p-2.5 min-w-[110px]">Phone</th>
                                                        <th className="p-2.5 min-w-[120px]">Party Name</th>
                                                        <th className="p-2.5 min-w-[140px]">Item / Product</th>
                                                        <th className="p-2.5 min-w-[60px] text-right">Qty</th>
                                                        <th className="p-2.5 min-w-[80px] text-right">Rate</th>
                                                        <th className="p-2.5 min-w-[80px]">Status</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border)]">
                                            {editedRows.slice(0, 50).map((row, idx) => (
                                                <tr
                                                    key={idx}
                                                    className={`hover:bg-[var(--bg-secondary)]/50 transition ${
                                                        !row.isValid ? "bg-[var(--red)]/5" : ""
                                                    }`}
                                                >
                                                    <td className="p-2 text-center text-[var(--text-muted)]">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="p-2">
                                                        {row.isValid ? (
                                                            row.isExisting ? (
                                                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--gold)] font-medium">
                                                                    <RefreshCw size={11} /> Existing
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--green-bright)] font-medium">
                                                                    <CheckCircle2 size={11} /> Valid
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span
                                                                className="inline-flex items-center gap-1 text-[11px] text-[var(--red)] font-medium"
                                                                title={row.errors?.map((e: any) => e.message).join(", ")}
                                                            >
                                                                <AlertCircle size={11} /> Error
                                                            </span>
                                                        )}
                                                    </td>

                                                    {type === "customers" ? (
                                                        <>
                                                            <td className="p-1.5">
                                                                <input
                                                                    value={row.data.name || ""}
                                                                    onChange={(e) =>
                                                                        handleCellChange(idx, "name", e.target.value)
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-1.5">
                                                                <input
                                                                    value={row.data.phone || ""}
                                                                    onChange={(e) =>
                                                                        handleCellChange(idx, "phone", e.target.value)
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none font-mono text-[11px]"
                                                                />
                                                            </td>
                                                            <td className="p-1.5">
                                                                <select
                                                                    value={row.data.type || "RETAILER"}
                                                                    onChange={(e) =>
                                                                        handleCellChange(idx, "type", e.target.value)
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none text-[11px]"
                                                                >
                                                                    <option value="RETAILER">RETAILER</option>
                                                                    <option value="WHOLESALER">WHOLESALER</option>
                                                                    <option value="INSTITUTION">INSTITUTION</option>
                                                                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                                                                </select>
                                                            </td>
                                                            <td className="p-1.5">
                                                                <input
                                                                    value={row.data.city || ""}
                                                                    onChange={(e) =>
                                                                        handleCellChange(idx, "city", e.target.value)
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-1.5">
                                                                <input
                                                                    value={row.data.gstNumber || ""}
                                                                    onChange={(e) =>
                                                                        handleCellChange(
                                                                            idx,
                                                                            "gstNumber",
                                                                            e.target.value.toUpperCase()
                                                                        )
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none font-mono text-[11px]"
                                                                />
                                                            </td>
                                                            <td className="p-1.5 text-right">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.openingBalance || ""}
                                                                    onChange={(e) =>
                                                                        handleCellChange(
                                                                            idx,
                                                                            "openingBalance",
                                                                            Number(e.target.value)
                                                                        )
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none text-right font-mono"
                                                                />
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="p-1.5">
                                                                <input
                                                                    value={row.data.orderNumber || ""}
                                                                    onChange={(e) =>
                                                                        handleCellChange(
                                                                            idx,
                                                                            "orderNumber",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none font-mono text-[11px]"
                                                                />
                                                            </td>
                                                            <td className="p-1.5">
                                                                <input
                                                                    value={row.data.customerPhone || ""}
                                                                    onChange={(e) =>
                                                                        handleCellChange(
                                                                            idx,
                                                                            "customerPhone",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none font-mono text-[11px]"
                                                                />
                                                            </td>
                                                            <td className="p-1.5">
                                                                <input
                                                                    value={row.data.customerName || ""}
                                                                    onChange={(e) =>
                                                                        handleCellChange(
                                                                            idx,
                                                                            "customerName",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-1.5">
                                                                <input
                                                                    value={row.data.productNameOrSku || ""}
                                                                    onChange={(e) =>
                                                                        handleCellChange(
                                                                            idx,
                                                                            "productNameOrSku",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-1.5 text-right">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.quantity || 1}
                                                                    onChange={(e) =>
                                                                        handleCellChange(
                                                                            idx,
                                                                            "quantity",
                                                                            Number(e.target.value)
                                                                        )
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none text-right font-mono"
                                                                />
                                                            </td>
                                                            <td className="p-1.5 text-right">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.price || 0}
                                                                    onChange={(e) =>
                                                                        handleCellChange(
                                                                            idx,
                                                                            "price",
                                                                            Number(e.target.value)
                                                                        )
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none text-right font-mono"
                                                                />
                                                            </td>
                                                            <td className="p-1.5">
                                                                <select
                                                                    value={row.data.status || "CONFIRMED"}
                                                                    onChange={(e) =>
                                                                        handleCellChange(idx, "status", e.target.value)
                                                                    }
                                                                    className="w-full px-2 py-1 bg-transparent hover:bg-[var(--bg-secondary)] rounded text-[var(--text-primary)] focus:bg-[var(--bg-primary)] focus:border-[var(--gold)] outline-none text-[11px]"
                                                                >
                                                                    <option value="CONFIRMED">CONFIRMED</option>
                                                                    <option value="DRAFT">DRAFT</option>
                                                                    <option value="DELIVERED">DELIVERED</option>
                                                                </select>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Completed Results */}
                    {step === 3 && importResult && (
                        <div className="py-6 space-y-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-[var(--green-bright)]/10 text-[var(--green-bright)] mx-auto flex items-center justify-center">
                                <CheckCircle2 size={36} />
                            </div>

                            <div>
                                <h3
                                    className="text-2xl font-bold text-[var(--text-primary)]"
                                    style={{ fontFamily: "var(--font-playfair)" }}
                                >
                                    Import Completed Successfully!
                                </h3>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    All valid records have been allocated to the database and linked to their customer
                                    ledgers.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-left">
                                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)]">
                                    <p className="text-xs text-[var(--text-muted)]">Total Processed</p>
                                    <p
                                        className="text-xl font-bold text-[var(--text-primary)] mt-1"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        {importResult.totalProcessed ?? importResult.totalOrders ?? importResult.total ?? 0}
                                    </p>
                                </div>
                                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)]">
                                    <p className="text-xs text-[var(--green-bright)]">Created New</p>
                                    <p
                                        className="text-xl font-bold text-[var(--green-bright)] mt-1"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        {importResult.createdCount ?? importResult.createdOrders ?? importResult.created ?? 0}
                                    </p>
                                </div>
                                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)]">
                                    <p className="text-xs text-[var(--gold)]">Updated</p>
                                    <p
                                        className="text-xl font-bold text-[var(--gold)] mt-1"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        {importResult.updatedCount || 0}
                                    </p>
                                </div>
                                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)]">
                                    <p className="text-xs text-[var(--text-muted)]">Skipped</p>
                                    <p
                                        className="text-xl font-bold text-[var(--text-muted)] mt-1"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        {importResult.skippedCount || 0}
                                    </p>
                                </div>
                            </div>

                            {type === "customers" && createOpeningBalance && (
                                <p className="text-xs text-[var(--gold)] font-medium">
                                    ✓ Customer opening balances have been recorded in the Date-Wise Customer Statement &
                                    RTK Ledger.
                                </p>
                            )}

                            {type === "orders" && (
                                <p className="text-xs text-[var(--gold)] font-medium">
                                    ✓ Confirmed orders have been booked and posted as Sale entries to each customer's
                                    account statement.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]/50">
                    {step === 1 && (
                        <>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 text-xs font-medium rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!file || isLoading}
                                onClick={handleUploadAndPreview}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" /> Analyzing Sheet...
                                    </>
                                ) : (
                                    <>
                                        Next: Preview & Map <ArrowRight size={14} />
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition"
                            >
                                <ArrowLeft size={14} /> Back
                            </button>
                            <button
                                type="button"
                                disabled={isLoading || (skipErrors ? validCount === 0 : errorCount > 0)}
                                onClick={handleExecuteImport}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" /> Importing Records...
                                    </>
                                ) : (
                                    <>
                                        Import {skipErrors ? validCount : editedRows.length} Records <Check size={14} />
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {step === 3 && (
                        <div className="w-full flex justify-end">
                            <button
                                type="button"
                                onClick={handleFinish}
                                className="flex items-center gap-2 px-6 py-2 text-xs font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition"
                            >
                                Done & Refresh Table
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
