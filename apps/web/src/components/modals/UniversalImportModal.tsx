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
    Layers,
    Receipt,
    Users,
    ClipboardPaste,
    FileText,
    Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";
import { formatINR } from "@/lib/utils";

export interface UniversalImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    type: "products" | "customers" | "customer-transactions" | "supplier-transactions";
    customerId?: string;
    customerName?: string;
    supplierId?: string;
    supplierName?: string;
    title?: string;
    description?: string;
}

export function UniversalImportModal({
    isOpen,
    onClose,
    onSuccess,
    type,
    customerId,
    customerName,
    supplierId,
    supplierName,
    title,
    description,
}: UniversalImportModalProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [inputMode, setInputMode] = useState<"file" | "paste">("file");
    const [pastedText, setPastedText] = useState("");
    const [pastedHtml, setPastedHtml] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showMapping, setShowMapping] = useState(false);

    // Preview data from server
    const [previewData, setPreviewData] = useState<any>(null);
    const [customMapping, setCustomMapping] = useState<Record<string, string>>({});
    const [editedRows, setEditedRows] = useState<any[]>([]);
    const [filterStatus, setFilterStatus] = useState<"all" | "valid" | "errors">("all");

    // Import options
    const [updateExisting, setUpdateExisting] = useState(true);
    const [createOpeningStock, setCreateOpeningStock] = useState(true);
    const [updateInventory, setUpdateInventory] = useState(false);
    const [skipErrors, setSkipErrors] = useState(true);

    // Execution results
    const [importResult, setImportResult] = useState<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const modalTitle =
        title ||
        (type === "products"
            ? "Import Products & Variations"
            : type === "customer-transactions"
            ? `Import Khata / Ledger for ${customerName || "Customer"}`
            : type === "supplier-transactions"
            ? `Import Purchases & Payments for ${supplierName || "Supplier"}`
            : "Import Customers from Spreadsheet");

    const modalDesc =
        description ||
        (type === "products"
            ? "Upload Excel or CSV sheets to bulk create products, variations (20kg/50kg), and default warehouse stock."
            : type === "customer-transactions"
            ? "Upload previous transaction statements (Date, Goods Given/Sale, Returned, Payment Received) to reconstruct full ledger history."
            : type === "supplier-transactions"
            ? "Upload supplier statements (Date, Bill No, Item Description, Quantity, Rate, Purchase Amount, Payment Made) to track vendor purchases and balances."
            : "Upload Excel or CSV sheets from Tally, Marg, Busy, or Vyapar to bulk create customers and ledger balances.");

    const getTemplateEndpoint = () => {
        if (type === "products") return `/api/v1/products/import/template`;
        if (type === "customer-transactions") return `/api/v1/customers/${customerId}/transactions/import/template`;
        if (type === "supplier-transactions") return `/api/v1/suppliers/${supplierId}/import/template`;
        return `/api/v1/customers/import/template`;
    };

    const getPreviewEndpoint = () => {
        if (type === "products") return `/api/v1/products/import/preview`;
        if (type === "customer-transactions") return `/api/v1/customers/${customerId}/transactions/import/preview`;
        if (type === "supplier-transactions") return `/api/v1/suppliers/${supplierId}/import/preview`;
        return `/api/v1/customers/import/preview`;
    };

    const getExecuteEndpoint = () => {
        if (type === "products") return `/api/v1/products/import/execute`;
        if (type === "customer-transactions") return `/api/v1/customers/${customerId}/transactions/import/execute`;
        if (type === "supplier-transactions") return `/api/v1/suppliers/${supplierId}/import/execute`;
        return `/api/v1/customers/import/execute`;
    };

    const getTemplateFilename = () => {
        if (type === "products") return "distroai_products_template.xlsx";
        if (type === "customer-transactions") return `khata_${customerName || "statement"}_template.xlsx`;
        if (type === "supplier-transactions") return `supplier_purchases_${supplierName || "vendor"}.xlsx`;
        return "distroai_customers_template.xlsx";
    };

    const handleFileSelect = (selectedFile: File) => {
        const ext = selectedFile.name.split(".").pop()?.toLowerCase();
        if (!["xlsx", "xls", "csv", "docx", "txt"].includes(ext || "")) {
            toast.error("Please upload a valid .xlsx, .xls, .csv, .docx, or .txt file");
            return;
        }
        setFile(selectedFile);
    };

    const handleDownloadTemplate = async () => {
        try {
            toast.loading("Downloading template...", { id: "template-dl" });
            const response = await apiClient.get(getTemplateEndpoint(), {
                responseType: "blob",
                headers: { "x-suppress-upgrade-modal": "true" },
            });

            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = getTemplateFilename();
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
        let fileToUpload = file;
        if (inputMode === "paste") {
            if (!pastedText.trim()) {
                toast.error("Please paste your table or statement text first");
                return;
            }
            if (pastedHtml && pastedHtml.includes("<table")) {
                const blob = new Blob([pastedHtml], { type: "text/html;charset=utf-8" });
                fileToUpload = new File([blob], "pasted_statement.html", { type: "text/html" });
            } else {
                const blob = new Blob([pastedText.trim()], { type: "text/plain;charset=utf-8" });
                fileToUpload = new File([blob], "pasted_statement.txt", { type: "text/plain" });
            }
            setFile(fileToUpload);
        }

        if (!fileToUpload) {
            toast.error("Please select a file or paste data to import");
            return;
        }

        try {
            setIsLoading(true);
            const formData = new FormData();
            formData.append("file", fileToUpload);

            const response = await apiClient.post(getPreviewEndpoint(), formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const data = response.data?.data ?? response.data;
            setPreviewData(data);
            setCustomMapping(data.mapping || {});
            setEditedRows(data.validationResults || []);
            setStep(2);
        } catch (err: any) {
            toast.error(
                err.response?.data?.message || err.message || "Failed to parse and validate data"
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleExecuteImport = async () => {
        try {
            setIsLoading(true);
            const rowsToImport = skipErrors
                ? editedRows.filter((r) => r.isValid).map((r) => r.data)
                : editedRows.map((r) => r.data);

            if (rowsToImport.length === 0) {
                toast.error("No valid rows available to import");
                setIsLoading(false);
                return;
            }

            let payload: any = { rows: rowsToImport };

            if (type === "products") {
                payload.options = { updateExisting, createOpeningStock };
            } else if (type === "customers") {
                payload.options = { updateExisting, createOpeningBalance: true, autoCreateCustomers: true, skipErrors };
            } else if (type === "supplier-transactions") {
                payload.options = { updateInventory, skipErrors };
            }

            const response = await apiClient.post(getExecuteEndpoint(), payload);
            const result = response.data?.data ?? response.data;
            setImportResult(result);
            setStep(3);

            const processedCount =
                result.created ??
                result.createdCount ??
                result.importedTransactionsCount ??
                result.totalProcessed ??
                rowsToImport.length;

            toast.success(`Successfully imported ${processedCount} records!`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to execute import");
        } finally {
            setIsLoading(false);
        }
    };

    const recalculateBalances = (rows: any[]) => {
        if (type === "customer-transactions") {
            const startBal = Number(previewData?.startingBalance ?? 0);
            let currentBal = startBal;
            const updated = rows.map((r) => {
                const sale = Number(r.data?.saleAmount) || 0;
                const ret = Number(r.data?.returnedAmount) || 0;
                const pay = Number(r.data?.paymentReceivedAmount) || 0;
                currentBal = Math.round((currentBal + sale - ret - pay) * 100) / 100;
                return {
                    ...r,
                    projectedRunningBalance: currentBal,
                };
            });
            setPreviewData((prev: any) => (prev ? { ...prev, projectedBalance: currentBal } : prev));
            return updated;
        } else if (type === "supplier-transactions") {
            const startBal = Number(previewData?.startingBalance ?? 0);
            let currentBal = startBal;
            const updated = rows.map((r) => {
                const pur = Number(r.data?.purchaseAmount) || 0;
                const ret = Number(r.data?.returnedAmount) || 0;
                const pay = Number(r.data?.paymentMadeAmount) || 0;
                currentBal = Math.round((currentBal + pur - ret - pay) * 100) / 100;
                return {
                    ...r,
                    projectedRunningBalance: currentBal,
                };
            });
            setPreviewData((prev: any) => (prev ? { ...prev, projectedBalance: currentBal } : prev));
            return updated;
        }
        return rows;
    };

    const handleCellChange = (rowIndex: number, field: string, value: any) => {
        setEditedRows((prev) => {
            const updatedRows = prev.map((row) => {
                if (row.rowIndex !== rowIndex) return row;
                const updatedData = { ...row.data, [field]: value };
                let isValid = true;
                const errors = [...(row.errors || [])].filter((e: any) => e.field !== field && e.field !== "amount");

                if (type === "products") {
                    if (field === "name" && !value?.toString().trim()) {
                        errors.push({ field: "name", message: "Product Name is required" });
                        isValid = false;
                    }
                    if (field === "sellingPrice") {
                        const n = Number(value);
                        if (isNaN(n) || n < 0) {
                            errors.push({ field: "sellingPrice", message: "Selling Price must be a positive number" });
                            isValid = false;
                        }
                    }
                    if (field === "gstRate") {
                        const n = Number(value);
                        if (isNaN(n) || n < 0) {
                            errors.push({ field: "gstRate", message: "GST rate must be a valid number" });
                            isValid = false;
                        }
                    }
                } else if (type === "customer-transactions") {
                    if (field === "date" && !value?.toString().trim()) {
                        errors.push({ field: "date", message: "Valid date is required" });
                        isValid = false;
                    }
                    const sale = Number(updatedData.saleAmount) || 0;
                    const ret = Number(updatedData.returnedAmount) || 0;
                    const pay = Number(updatedData.paymentReceivedAmount) || 0;
                    if (sale <= 0 && ret <= 0 && pay <= 0) {
                        errors.push({ field: "amount", message: "Row must have at least one non-zero Amount, Returned, or Payment" });
                        isValid = false;
                    }
                } else if (type === "supplier-transactions") {
                    if (field === "date" && !value?.toString().trim()) {
                        errors.push({ field: "date", message: "Valid date is required" });
                        isValid = false;
                    }
                    const pur = Number(updatedData.purchaseAmount) || 0;
                    const ret = Number(updatedData.returnedAmount) || 0;
                    const pay = Number(updatedData.paymentMadeAmount) || 0;
                    if (pur <= 0 && ret <= 0 && pay <= 0) {
                        errors.push({ field: "amount", message: "Row must have at least one non-zero Purchase, Returned, or Payment" });
                        isValid = false;
                    }
                } else if (type === "customers") {
                    if (field === "name" && !value?.toString().trim()) {
                        errors.push({ field: "name", message: "Customer Name is required" });
                        isValid = false;
                    }
                }

                return {
                    ...row,
                    data: updatedData,
                    isValid: errors.length === 0,
                    errors,
                };
            });

            return recalculateBalances(updatedRows);
        });
    };

    const handleDeleteRow = (rowIndex: number) => {
        setEditedRows((prev) => {
            const filtered = prev.filter((r) => r.rowIndex !== rowIndex);
            return recalculateBalances(filtered);
        });
        toast.success("Row removed from import");
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

    const displayedRows = editedRows.filter((r) => {
        if (filterStatus === "valid") return r.isValid;
        if (filterStatus === "errors") return !r.isValid;
        return true;
    });

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={handleClose}
        >
            <div
                className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
                    <div>
                        <div className="flex items-center gap-2">
                            {type === "products" ? (
                                <Layers className="text-[var(--gold)]" size={22} />
                            ) : type === "customer-transactions" ? (
                                <Receipt className="text-[var(--gold)]" size={22} />
                            ) : (
                                <Users className="text-[var(--gold)]" size={22} />
                            )}
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
                        onClick={handleClose}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Stepper Bar */}
                <div className="flex items-center justify-between px-6 py-2.5 bg-[var(--bg-tertiary)]/40 border-b border-[var(--border)] text-xs font-medium">
                    <div className="flex items-center gap-2">
                        <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                step >= 1
                                    ? "bg-[var(--gold)] text-black"
                                    : "bg-[var(--border)] text-[var(--text-muted)]"
                            }`}
                        >
                            1
                        </span>
                        <span className={step >= 1 ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-muted)]"}>
                            Upload File
                        </span>
                    </div>
                    <div className="w-8 h-px bg-[var(--border)]" />
                    <div className="flex items-center gap-2">
                        <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                step >= 2
                                    ? "bg-[var(--gold)] text-black"
                                    : "bg-[var(--border)] text-[var(--text-muted)]"
                            }`}
                        >
                            2
                        </span>
                        <span className={step >= 2 ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-muted)]"}>
                            Preview & Validate
                        </span>
                    </div>
                    <div className="w-8 h-px bg-[var(--border)]" />
                    <div className="flex items-center gap-2">
                        <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                step === 3
                                    ? "bg-[var(--gold)] text-black"
                                    : "bg-[var(--border)] text-[var(--text-muted)]"
                            }`}
                        >
                            3
                        </span>
                        <span className={step === 3 ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-muted)]"}>
                            Summary
                        </span>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* STEP 1: UPLOAD & TEMPLATE */}
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* Download Template Banner */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5">
                                <div className="flex items-start gap-3">
                                    <FileSpreadsheet className="text-[var(--gold)] shrink-0 mt-0.5" size={24} />
                                    <div>
                                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                                            Need the standard template?
                                        </h4>
                                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                            {type === "products"
                                                ? "Download sample Excel file with multi-row variations (20kg/50kg) and opening stock."
                                                : type === "customer-transactions"
                                                ? `Download Khata sheet pre-filled with sample entries for ${customerName || "Customer"}.`
                                                : type === "supplier-transactions"
                                                ? `Download Purchases & Payments statement template pre-filled for ${supplierName || "Supplier"}.`
                                                : "Download sample customer import sheet with opening balances and credit limits."}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-[var(--gold)]/50 text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-colors shrink-0"
                                >
                                    <Download size={14} />
                                    Download Template (.xlsx)
                                </button>
                            </div>

                            {/* Mode Selector Tab Bar */}
                            <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setInputMode("file")}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                        inputMode === "file"
                                            ? "bg-[var(--gold)] text-black shadow-sm"
                                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    }`}
                                >
                                    <Upload size={14} />
                                    Upload File (.xlsx, .csv, .docx)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInputMode("paste")}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                        inputMode === "paste"
                                            ? "bg-[var(--gold)] text-black shadow-sm"
                                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    }`}
                                >
                                    <ClipboardPaste size={14} />
                                    Paste Table from Docs / WhatsApp
                                </button>
                            </div>

                            {inputMode === "file" ? (
                                /* Drag & Drop Zone */
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
                                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[220px] ${
                                        isDragging
                                            ? "border-[var(--gold)] bg-[var(--gold)]/5"
                                            : file
                                            ? "border-[var(--green-bright)]/60 bg-[var(--green-bright)]/5"
                                            : "border-[var(--border)] hover:border-[var(--gold)]/60 hover:bg-[var(--bg-secondary)]"
                                    }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx, .xls, .csv, .docx, .txt"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                handleFileSelect(e.target.files[0]);
                                            }
                                        }}
                                    />

                                    {file ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 rounded-full bg-[var(--green-bright)]/20 flex items-center justify-center text-[var(--green-bright)]">
                                                <CheckCircle2 size={24} />
                                            </div>
                                            <p className="text-sm font-semibold text-[var(--text-primary)]">{file.name}</p>
                                            <p className="text-xs text-[var(--text-muted)]">
                                                {(file.size / 1024).toFixed(1)} KB • Click or drag to replace
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--gold)]">
                                                <Upload size={22} />
                                            </div>
                                            <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                                                Drag & drop your file here, or{" "}
                                                <span className="text-[var(--gold)] underline">browse</span>
                                            </p>
                                            <p className="text-xs text-[var(--text-muted)]">
                                                Supports Excel (.xlsx, .xls), CSV (.csv), Word (.docx), and Text (.txt) up to 20MB
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Smart Paste Zone */
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-[var(--text-muted)]">
                                            Copy your table from Google Docs, MS Word, WhatsApp, or ChatGPT and paste here:
                                        </span>
                                        {pastedText && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPastedText("");
                                                    setPastedHtml("");
                                                }}
                                                className="text-xs text-[var(--red)] hover:underline"
                                            >
                                                Clear Text
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]/40 overflow-hidden focus-within:border-[var(--gold)] transition-colors">
                                        <textarea
                                            value={pastedText}
                                            onChange={(e) => {
                                                setPastedText(e.target.value);
                                                if (!e.target.value) setPastedHtml("");
                                            }}
                                            onPaste={(e) => {
                                                const html = e.clipboardData?.getData("text/html");
                                                if (html && html.includes("<table")) {
                                                    setPastedHtml(html);
                                                }
                                            }}
                                            rows={9}
                                            placeholder={`Paste table copied directly from Google Docs or Word (Tab-separated):\n\nDATE\tGOODS GIVEN\tAMOUNT\tRETURNED\tPAYMENT RECEIVED\n04/08/26\t4 Packet Leveler\t₹22,098\t\t\n10/08/26\t13 Box 2×4\t₹10,814\t\t\n\nOr Markdown Table format:\n| DATE | GOODS GIVEN TO SUNNY BHAI | AMOUNT | RETURNED | PAYMENT RECEIVED |\n| 04/08/26 | 4 Packet Leveler — ₹210 | ₹22,098 | | |`}
                                            className="w-full p-4 bg-transparent text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none resize-none leading-relaxed"
                                        />
                                        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border)]/50 bg-[var(--bg-primary)]/50 text-[11px] text-[var(--text-muted)]">
                                            <span>
                                                {pastedText.trim()
                                                    ? `${pastedText.trim().split(/\r?\n/).length} lines detected • Format: ${
                                                          pastedText.includes("|")
                                                              ? "Markdown Table"
                                                              : pastedText.includes("\t")
                                                              ? "Tab-Separated Table (Google Docs/Word)"
                                                              : "CSV / Plain Text"
                                                      }`
                                                    : "Ready for paste (Ctrl+V)"}
                                            </span>
                                            <span className="text-[var(--gold)] font-medium">Auto-parses dates & INR amounts</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Help tips */}
                            <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/40 border border-[var(--border)] space-y-2 text-xs text-[var(--text-muted)]">
                                <p className="font-semibold text-[var(--text-primary)]">Supported Columns & Tips:</p>
                                {type === "products" && (
                                    <ul className="list-disc list-inside space-y-1">
                                        <li><strong>Multi-Row Variations:</strong> Repeat the same Product Name on consecutive rows with different Variant Names (e.g. 20kg, 50kg) and prices.</li>
                                        <li><strong>Mandatory:</strong> Product Name, Selling Price, and GST Rate % (0, 5, 12, 18, 28).</li>
                                        <li><strong>Opening Stock:</strong> Quantities are automatically credited to your Default Warehouse with an audit trail.</li>
                                    </ul>
                                )}
                                {type === "customer-transactions" && (
                                    <ul className="list-disc list-inside space-y-1">
                                        <li><strong>Date:</strong> Supports standard date formats (YYYY-MM-DD, DD/MM/YYYY).</li>
                                        <li><strong>Goods Given / Amount:</strong> Increases customer balance (+Debit).</li>
                                        <li><strong>Returned & Payment Received:</strong> Decreases customer balance (-Credit).</li>
                                    </ul>
                                )}
                                {type === "supplier-transactions" && (
                                    <ul className="list-disc list-inside space-y-1">
                                        <li><strong>Bill / PO No & Date:</strong> Matches vendor invoice reference and purchase date.</li>
                                        <li><strong>Item Description, Quantity & Cost:</strong> Automatically records line items and purchase totals.</li>
                                        <li><strong>Purchase Amount (+Cr):</strong> Increases balance owed to supplier.</li>
                                        <li><strong>Payment Made & Returns (-Dr):</strong> Reduces balance owed to supplier.</li>
                                        <li><strong>Inventory:</strong> Optionally adds purchased quantities directly into your Default Warehouse stock.</li>
                                    </ul>
                                )}
                                {type === "customers" && (
                                    <ul className="list-disc list-inside space-y-1">
                                        <li><strong>Customer Name & Phone:</strong> Primary identifiers used to match and prevent duplicates.</li>
                                        <li><strong>Opening Balance:</strong> Automatically creates an initial ledger entry.</li>
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PREVIEW & VALIDATE */}
                    {step === 2 && (
                        <div className="space-y-5">
                            {/* Stats bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                                    <span className="text-xs text-[var(--text-muted)]">Total Rows</span>
                                    <p className="text-lg font-bold text-[var(--text-primary)] mt-0.5">{editedRows.length}</p>
                                </div>
                                <div className="p-3 rounded-xl border border-[var(--green-bright)]/30 bg-[var(--green-bright)]/5">
                                    <span className="text-xs text-[var(--green-bright)]">Valid Rows</span>
                                    <p className="text-lg font-bold text-[var(--green-bright)] mt-0.5">{validCount}</p>
                                </div>
                                <div className="p-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red)]/5">
                                    <span className="text-xs text-[var(--red)]">Errors</span>
                                    <p className="text-lg font-bold text-[var(--red)] mt-0.5">{errorCount}</p>
                                </div>
                                {type === "customer-transactions" || type === "supplier-transactions" ? (
                                    <div className="p-3 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5">
                                        <span className="text-xs text-[var(--gold)]">Projected Balance</span>
                                        <p className="text-lg font-bold text-[var(--gold)] mt-0.5">
                                            {formatINR(previewData?.projectedBalance ?? 0)}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/5">
                                        <span className="text-xs text-[var(--warning)]">Existing Items</span>
                                        <p className="text-lg font-bold text-[var(--warning)] mt-0.5">{existingCount}</p>
                                    </div>
                                )}
                            </div>

                            {/* Column Mapping Collapsible */}
                            <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-secondary)]/30">
                                <button
                                    onClick={() => setShowMapping(!showMapping)}
                                    className="w-full flex items-center justify-between p-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/60 transition-colors"
                                >
                                    <span>Detected Column Mapping ({Object.keys(customMapping).length} fields matched)</span>
                                    {showMapping ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                                {showMapping && (
                                    <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-primary)] grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                        {Object.entries(customMapping).map(([key, val]) => (
                                            <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]/50">
                                                <span className="text-[var(--text-muted)] font-mono text-[11px]">{key}</span>
                                                <span className="font-semibold text-[var(--gold)] truncate max-w-[120px]">{val || "Not mapped"}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Filter tabs */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--border)] text-xs">
                                    <button
                                        onClick={() => setFilterStatus("all")}
                                        className={`px-3 py-1 rounded-md font-medium transition-colors ${
                                            filterStatus === "all"
                                                ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm"
                                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                        }`}
                                    >
                                        All ({editedRows.length})
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus("valid")}
                                        className={`px-3 py-1 rounded-md font-medium transition-colors ${
                                            filterStatus === "valid"
                                                ? "bg-[var(--green-bright)]/20 text-[var(--green-bright)]"
                                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                        }`}
                                    >
                                        Valid ({validCount})
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus("errors")}
                                        className={`px-3 py-1 rounded-md font-medium transition-colors ${
                                            filterStatus === "errors"
                                                ? "bg-[var(--red)]/20 text-[var(--red)]"
                                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                        }`}
                                    >
                                        Errors ({errorCount})
                                    </button>
                                </div>

                                <span className="text-[11px] text-[var(--text-muted)] italic">
                                    Double-click any cell to edit inline before importing
                                </span>
                            </div>

                            {/* Interactive Data Table */}
                            <div className="border border-[var(--border)] rounded-xl overflow-hidden max-h-[340px] overflow-y-auto overflow-x-auto bg-[var(--bg-secondary)]/20">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] sticky top-0 z-10 border-b border-[var(--border)]">
                                        <tr>
                                            <th className="py-2.5 px-3 font-semibold w-12 text-center">#</th>
                                            <th className="py-2.5 px-3 font-semibold">Status</th>
                                            {type === "products" && (
                                                <>
                                                    <th className="py-2.5 px-3 font-semibold min-w-[160px]">Product Name*</th>
                                                    <th className="py-2.5 px-3 font-semibold min-w-[130px]">Variant / Size</th>
                                                    <th className="py-2.5 px-3 font-semibold">Selling Price*</th>
                                                    <th className="py-2.5 px-3 font-semibold">Cost Price</th>
                                                    <th className="py-2.5 px-3 font-semibold">GST %*</th>
                                                    <th className="py-2.5 px-3 font-semibold">Opening Stock</th>
                                                </>
                                            )}
                                            {type === "customer-transactions" && (
                                                <>
                                                    <th className="py-2.5 px-3 font-semibold min-w-[110px]">Date*</th>
                                                    <th className="py-2.5 px-3 font-semibold min-w-[180px]">Goods Given / Particulars</th>
                                                    <th className="py-2.5 px-3 font-semibold">Sale (+Dr)</th>
                                                    <th className="py-2.5 px-3 font-semibold">Return (-Cr)</th>
                                                    <th className="py-2.5 px-3 font-semibold">Payment (-Cr)</th>
                                                    <th className="py-2.5 px-3 font-semibold">Projected Bal</th>
                                                </>
                                            )}
                                            {type === "supplier-transactions" && (
                                                <>
                                                    <th className="py-2.5 px-3 font-semibold min-w-[95px]">Date*</th>
                                                    <th className="py-2.5 px-3 font-semibold min-w-[100px]">Bill / PO No</th>
                                                    <th className="py-2.5 px-3 font-semibold min-w-[160px]">Item Description*</th>
                                                    <th className="py-2.5 px-3 font-semibold">Qty</th>
                                                    <th className="py-2.5 px-3 font-semibold">Unit Cost</th>
                                                    <th className="py-2.5 px-3 font-semibold">Purchase (+Cr)</th>
                                                    <th className="py-2.5 px-3 font-semibold">Return (-Dr)</th>
                                                    <th className="py-2.5 px-3 font-semibold">Payment (-Dr)</th>
                                                    <th className="py-2.5 px-3 font-semibold">Projected Bal</th>
                                                </>
                                            )}
                                            {type === "customers" && (
                                                <>
                                                    <th className="py-2.5 px-3 font-semibold min-w-[150px]">Customer Name*</th>
                                                    <th className="py-2.5 px-3 font-semibold">Phone*</th>
                                                    <th className="py-2.5 px-3 font-semibold">GSTIN</th>
                                                    <th className="py-2.5 px-3 font-semibold">Credit Limit</th>
                                                    <th className="py-2.5 px-3 font-semibold">Opening Balance</th>
                                                </>
                                            )}
                                            <th className="py-2.5 px-2 font-semibold w-9 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]/60 bg-[var(--bg-primary)]">
                                        {displayedRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={12} className="py-8 text-center text-xs text-[var(--text-muted)]">
                                                    No rows match the selected filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedRows.map((row) => (
                                                <tr
                                                    key={row.rowIndex}
                                                    className={`hover:bg-[var(--bg-secondary)]/50 transition-colors ${
                                                        !row.isValid ? "bg-[var(--red)]/5" : ""
                                                    }`}
                                                >
                                                    <td className="py-2 px-3 text-center text-[var(--text-muted)] text-[11px]">
                                                        {row.rowIndex}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        {row.isValid ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--green-bright)] bg-[var(--green-bright)]/10 px-2 py-0.5 rounded-full">
                                                                <Check size={10} /> Valid
                                                            </span>
                                                        ) : (
                                                            <span
                                                                title={row.errors?.map((e: any) => e.message).join(", ")}
                                                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--red)] bg-[var(--red)]/10 px-2 py-0.5 rounded-full cursor-help"
                                                            >
                                                                <AlertCircle size={10} /> Error
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* PRODUCTS COLUMNS */}
                                                    {type === "products" && (
                                                        <>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="text"
                                                                    value={row.data.name || ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "name", e.target.value)}
                                                                    className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="text"
                                                                    value={row.data.variantName || ""}
                                                                    placeholder="Single Item"
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "variantName", e.target.value)}
                                                                    className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs text-[var(--text-muted)]"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.sellingPrice ?? ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "sellingPrice", Number(e.target.value))}
                                                                    className="w-24 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono font-medium"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.purchasePrice ?? ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "purchasePrice", Number(e.target.value))}
                                                                    className="w-24 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono text-[var(--text-muted)]"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.gstRate ?? ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "gstRate", Number(e.target.value))}
                                                                    className="w-16 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.openingStock ?? ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "openingStock", Number(e.target.value))}
                                                                    className="w-20 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono"
                                                                />
                                                            </td>
                                                        </>
                                                    )}

                                                    {/* CUSTOMER TRANSACTIONS COLUMNS */}
                                                    {type === "customer-transactions" && (
                                                        <>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="text"
                                                                    value={row.data.date || ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "date", e.target.value)}
                                                                    className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="text"
                                                                    value={row.data.description || ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "description", e.target.value)}
                                                                    className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.saleAmount ?? ""}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "saleAmount", e.target.value === "" ? undefined : Number(e.target.value))}
                                                                    className="w-24 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono font-medium text-[var(--red)]"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.returnedAmount ?? ""}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "returnedAmount", e.target.value === "" ? undefined : Number(e.target.value))}
                                                                    className="w-24 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono text-[var(--warning)]"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.paymentReceivedAmount ?? ""}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "paymentReceivedAmount", e.target.value === "" ? undefined : Number(e.target.value))}
                                                                    className="w-24 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono font-medium text-[var(--green-bright)]"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2 font-mono text-xs font-semibold text-[var(--gold)]">
                                                                {formatINR(row.projectedRunningBalance ?? 0)}
                                                            </td>
                                                        </>
                                                    )}

                                                    {/* SUPPLIER TRANSACTIONS COLUMNS */}
                                                    {type === "supplier-transactions" && (
                                                        <>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="text"
                                                                    value={row.data.date || ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "date", e.target.value)}
                                                                    className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="text"
                                                                    value={row.data.billNumber || ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "billNumber", e.target.value)}
                                                                    className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono text-[var(--text-muted)]"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="text"
                                                                    value={row.data.itemDescription || ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "itemDescription", e.target.value)}
                                                                    className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.quantity ?? ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "quantity", Number(e.target.value))}
                                                                    className="w-16 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.unitCost ?? ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "unitCost", Number(e.target.value))}
                                                                    className="w-20 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.purchaseAmount ?? ""}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "purchaseAmount", e.target.value === "" ? undefined : Number(e.target.value))}
                                                                    className="w-24 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono font-medium text-[var(--red)]"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.returnedAmount ?? ""}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "returnedAmount", e.target.value === "" ? undefined : Number(e.target.value))}
                                                                    className="w-24 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono text-[var(--warning)]"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.paymentMadeAmount ?? ""}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "paymentMadeAmount", e.target.value === "" ? undefined : Number(e.target.value))}
                                                                    className="w-24 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono font-medium text-[var(--green-bright)]"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2 font-mono text-xs font-semibold text-[var(--gold)]">
                                                                {formatINR(row.projectedRunningBalance ?? 0)}
                                                            </td>
                                                        </>
                                                    )}

                                                    {/* CUSTOMERS COLUMNS */}
                                                    {type === "customers" && (
                                                        <>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="text"
                                                                    value={row.data.name || ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "name", e.target.value)}
                                                                    className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-medium"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="text"
                                                                    value={row.data.phone || ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "phone", e.target.value)}
                                                                    className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="text"
                                                                    value={row.data.gstNumber || ""}
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "gstNumber", e.target.value)}
                                                                    className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono text-[var(--text-muted)]"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.creditLimit ?? ""}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "creditLimit", e.target.value === "" ? undefined : Number(e.target.value))}
                                                                    className="w-24 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={row.data.openingBalance ?? ""}
                                                                    placeholder="0"
                                                                    onChange={(e) => handleCellChange(row.rowIndex, "openingBalance", e.target.value === "" ? undefined : Number(e.target.value))}
                                                                    className="w-24 bg-transparent px-2 py-1 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--gold)] focus:bg-[var(--bg-secondary)] outline-none text-xs font-mono font-medium text-[var(--gold)]"
                                                                />
                                                            </td>
                                                        </>
                                                    )}

                                                    {/* ROW ACTION: DELETE */}
                                                    <td className="py-1 px-2 text-center">
                                                        <button
                                                            onClick={() => handleDeleteRow(row.rowIndex)}
                                                            title="Delete row"
                                                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[var(--red)]/10 transition-colors"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Import Options Checkboxes */}
                            <div className="flex flex-wrap items-center gap-6 p-3 rounded-xl bg-[var(--bg-secondary)]/40 border border-[var(--border)] text-xs">
                                {type === "products" && (
                                    <>
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={updateExisting}
                                                onChange={(e) => setUpdateExisting(e.target.checked)}
                                                className="rounded border-[var(--border)] text-[var(--gold)] focus:ring-[var(--gold)]"
                                            />
                                            <span>Update existing products if SKU / Name matches</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={createOpeningStock}
                                                onChange={(e) => setCreateOpeningStock(e.target.checked)}
                                                className="rounded border-[var(--border)] text-[var(--gold)] focus:ring-[var(--gold)]"
                                            />
                                            <span>Credit opening stock into Default Warehouse</span>
                                        </label>
                                    </>
                                )}
                                {type === "supplier-transactions" && (
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={updateInventory}
                                            onChange={(e) => setUpdateInventory(e.target.checked)}
                                            className="rounded border-[var(--border)] text-[var(--gold)] focus:ring-[var(--gold)]"
                                        />
                                        <span>Add received item quantities to Default Warehouse stock</span>
                                    </label>
                                )}
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={skipErrors}
                                        onChange={(e) => setSkipErrors(e.target.checked)}
                                        className="rounded border-[var(--border)] text-[var(--gold)] focus:ring-[var(--gold)]"
                                    />
                                    <span>Skip invalid rows and import valid rows ({validCount})</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: RESULT SUMMARY */}
                    {step === 3 && (
                        <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-16 h-16 rounded-full bg-[var(--green-bright)]/20 border border-[var(--green-bright)]/40 flex items-center justify-center text-[var(--green-bright)] animate-bounce-once">
                                <CheckCircle2 size={36} />
                            </div>

                            <div>
                                <h3
                                    className="text-2xl font-bold text-[var(--text-primary)]"
                                    style={{ fontFamily: "var(--font-playfair)" }}
                                >
                                    Import Completed Successfully!
                                </h3>
                                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md">
                                    Your data has been securely processed and written to the database with active multi-tenant isolation.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg">
                                {type === "customer-transactions" ? (
                                    <>
                                        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                                            <span className="text-xs text-[var(--text-muted)]">Transactions Created</span>
                                            <p className="text-xl font-bold text-[var(--green-bright)] mt-1">
                                                {importResult?.importedTransactionsCount ?? validCount}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 col-span-2 sm:col-span-2">
                                            <span className="text-xs text-[var(--gold)]">Updated Outstanding Balance</span>
                                            <p className="text-xl font-bold text-[var(--gold)] mt-1">
                                                {formatINR(importResult?.newOutstandingAmount ?? 0)}
                                            </p>
                                        </div>
                                    </>
                                ) : type === "supplier-transactions" ? (
                                    <>
                                        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                                            <span className="text-xs text-[var(--text-muted)]">Purchases / POs Created</span>
                                            <p className="text-xl font-bold text-[var(--green-bright)] mt-1">
                                                {importResult?.createdOrdersCount ?? 0}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                                            <span className="text-xs text-[var(--text-muted)]">Payments Recorded</span>
                                            <p className="text-xl font-bold text-[var(--gold)] mt-1">
                                                {importResult?.createdPaymentsCount ?? 0}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 col-span-2 sm:col-span-1">
                                            <span className="text-xs text-[var(--gold)]">Supplier Balance</span>
                                            <p className="text-xl font-bold text-[var(--gold)] mt-1">
                                                {formatINR(importResult?.newOutstandingBalance ?? 0)}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                                            <span className="text-xs text-[var(--text-muted)]">Created</span>
                                            <p className="text-xl font-bold text-[var(--green-bright)] mt-1">
                                                {importResult?.created ?? importResult?.createdCount ?? 0}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                                            <span className="text-xs text-[var(--text-muted)]">Updated</span>
                                            <p className="text-xl font-bold text-[var(--gold)] mt-1">
                                                {importResult?.updated ?? importResult?.updatedCount ?? 0}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] col-span-2 sm:col-span-1">
                                            <span className="text-xs text-[var(--text-muted)]">Errors / Skipped</span>
                                            <p className="text-xl font-bold text-[var(--text-muted)] mt-1">
                                                {importResult?.failed ?? importResult?.errors?.length ?? 0}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]/30">
                    {step === 1 && (
                        <>
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadAndPreview}
                                disabled={isLoading || (inputMode === "file" ? !file : !pastedText.trim())}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-[var(--gold)] text-black hover:bg-[var(--gold)]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                {isLoading ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Parsing {inputMode === "paste" ? "Table" : "File"}...
                                    </>
                                ) : (
                                    <>
                                        Continue to Preview
                                        <ArrowRight size={14} />
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <button
                                onClick={() => setStep(1)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                <ArrowLeft size={14} /> Back
                            </button>
                            <button
                                onClick={handleExecuteImport}
                                disabled={isLoading || validCount === 0}
                                className="flex items-center gap-2 px-6 py-2 text-xs font-semibold rounded-lg bg-[var(--gold)] text-black hover:bg-[var(--gold)]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                {isLoading ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Importing Data...
                                    </>
                                ) : (
                                    <>
                                        <Check size={14} />
                                        Confirm & Import ({validCount} Records)
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {step === 3 && (
                        <div className="w-full flex justify-end">
                            <button
                                onClick={handleFinish}
                                className="px-6 py-2 text-xs font-semibold rounded-lg bg-[var(--gold)] text-black hover:bg-[var(--gold)]/90 transition-all shadow-md"
                            >
                                Done & View Records
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
