"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, ScanLine, UploadCloud, Trash2, X, ShoppingBag, Sparkles, ChevronDown } from "lucide-react";
import apiClient from "@/lib/api-client";
import { toast } from "react-hot-toast";
import { formatINR } from "@/lib/utils";

const TYPE_TABS = ["All", "OPERATIONAL", "PURCHASE"] as const;
const CATEGORIES = [
    'TRAVEL', 'FOOD', 'FUEL', 'UTILITIES', 'SUPPLIES', 'MAINTENANCE', 'SOFTWARE',
    'SALARY', 'WAGES', 'RENT', 'FREIGHT', 'LOADING', 'VEHICLE', 'COMMISSION',
    'PACKAGING', 'INSURANCE', 'INTEREST', 'WASTAGE', 'OTHER'
];
const PAYMENT_METHODS = ['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT'];

export default function ExpensesPage() {
    const queryClient = useQueryClient();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [prefillPOId, setPrefillPOId] = useState<string | undefined>();

    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [typeFilter, setTypeFilter] = useState<typeof TYPE_TABS[number]>("All");

    const { data, isLoading } = useQuery({
        queryKey: ['expenses', page, statusFilter, typeFilter],
        queryFn: async () => {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (statusFilter !== "ALL") params.append("status", statusFilter);
            if (typeFilter !== "All") params.append("type", typeFilter);
            const res = await apiClient.get(`/api/v1/expenses?${params.toString()}`);
            return res.data?.data || res.data;
        }
    });

    const expenses = data?.items || [];

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/api/v1/expenses/${id}`),
        onSuccess: () => {
            toast.success("Expense deleted");
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to delete expense");
        }
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string, status: string }) => apiClient.patch(`/api/v1/expenses/${id}/status`, { status }),
        onSuccess: () => {
            toast.success("Status updated");
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        }
    });

    const openAddForPO = (poId?: string) => {
        setPrefillPOId(poId);
        setIsAddModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 relative">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Expenses</h1>
                    <p className="text-[var(--text-muted)] text-sm mt-1">
                        Track operational and purchase order expenses. Scan receipts with AI.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsScanModalOpen(true)}
                        className="btn-secondary bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/30 hover:bg-[var(--gold)]/20 flex items-center gap-2"
                    >
                        <ScanLine className="w-4 h-4" />
                        AI Scan
                    </button>
                    <button
                        onClick={() => openAddForPO()}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Expense
                    </button>
                </div>
            </div>

            {/* Type Tabs */}
            <div className="flex flex-wrap gap-2">
                {TYPE_TABS.map((t) => (
                    <button
                        key={t}
                        onClick={() => { setTypeFilter(t); setPage(1); }}
                        className={`px-4 py-2 text-sm rounded-[var(--radius-md)] transition ${typeFilter === t
                            ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium"
                            : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                            }`}
                    >
                        {t === "All" ? "All" : t === "OPERATIONAL" ? "Daily / Operational" : "Purchase Orders"}
                    </button>
                ))}
            </div>

            {/* Status Filters */}
            <div className="flex gap-2">
                {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((s) => (
                    <button
                        key={s}
                        onClick={() => { setStatusFilter(s); setPage(1); }}
                        className={`px-3 py-1.5 text-xs font-semibold tracking-wider rounded-full transition-colors ${statusFilter === s
                            ? "bg-[var(--gold)] text-[var(--bg-primary)]"
                            : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)]"
                            }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* Data Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 font-medium tracking-wider">Date</th>
                                <th className="px-4 py-3 font-medium tracking-wider">Type</th>
                                <th className="px-4 py-3 font-medium tracking-wider">Vendor</th>
                                <th className="px-4 py-3 font-medium tracking-wider">Category</th>
                                <th className="px-4 py-3 font-medium tracking-wider">Payment</th>
                                <th className="px-4 py-3 font-medium tracking-wider text-right">Amount</th>
                                <th className="px-4 py-3 font-medium tracking-wider text-center">Status</th>
                                <th className="px-4 py-3 font-medium tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)]">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading expenses...
                                    </td>
                                </tr>
                            ) : expenses.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-0">
                                        <div className="text-center py-16">
                                            <div className="w-16 h-16 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-4">
                                                <ScanLine className="w-7 h-7 text-[var(--gold)]" />
                                            </div>
                                            <h3 className="text-base font-medium mb-1">
                                                {typeFilter !== "All" || statusFilter !== "ALL" ? "No matching expenses" : "No expenses yet"}
                                            </h3>
                                            <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto mb-5">
                                                {typeFilter !== "All" || statusFilter !== "ALL" ? "Try changing the filters." : "Start tracking expenses by scanning a receipt or adding one manually."}
                                            </p>
                                            {typeFilter === "All" && statusFilter === "ALL" && (
                                                <div className="flex items-center justify-center gap-3">
                                                    <button onClick={() => setIsScanModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition">
                                                        <ScanLine className="w-4 h-4" /> AI Scan Receipt
                                                    </button>
                                                    <button onClick={() => openAddForPO()} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                                                        <Plus className="w-4 h-4" /> Add Manual
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                expenses.map((exp: any) => (
                                    <tr key={exp.id} className="hover:bg-[var(--bg-card-hover)] transition-colors group">
                                        <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                                            {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wider ${exp.type === 'PURCHASE'
                                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                }`}>
                                                {exp.type === 'PURCHASE' ? <><ShoppingBag size={10} /> PO</> : 'OPS'}
                                            </span>
                                            {exp.purchaseOrder && (
                                                <span className="block text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">{exp.purchaseOrder.poNumber}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium">{exp.vendorName}</td>
                                        <td className="px-4 py-3 text-[var(--text-secondary)]">{exp.category || "OTHER"}</td>
                                        <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">
                                            {exp.paymentMethod ? exp.paymentMethod.replace('_', ' ') : '—'}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-right font-mono">
                                            {formatINR(exp.amount)}
                                            {exp.taxAmount > 0 && (
                                                <span className="block text-[10px] text-[var(--text-muted)]">+{formatINR(exp.taxAmount)} tax</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider border
                                                ${exp.status === 'PAID' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                    exp.status === 'APPROVED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                        exp.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                            'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}
                                            `}>
                                                {exp.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {exp.status !== 'PAID' && exp.status !== 'REJECTED' && (
                                                    <select
                                                        className="text-xs bg-transparent border border-[var(--border)] rounded px-2 py-1 cursor-pointer"
                                                        value={exp.status}
                                                        onChange={(e) => statusMutation.mutate({ id: exp.id, status: e.target.value })}
                                                    >
                                                        <option value="PENDING">PENDING</option>
                                                        <option value="APPROVED">APPROVE</option>
                                                        <option value="PAID">MARK PAID</option>
                                                        <option value="REJECTED">REJECT</option>
                                                    </select>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Delete expense?')) deleteMutation.mutate(exp.id);
                                                    }}
                                                    className="p-1 text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isScanModalOpen && <AIScanModal onClose={() => setIsScanModalOpen(false)} />}
            {isAddModalOpen && <AddExpenseModal onClose={() => { setIsAddModalOpen(false); setPrefillPOId(undefined); }} initialData={null} prefillPOId={prefillPOId} />}
        </div>
    );
}

/* ─── AI Scan Modal ─── */
function AIScanModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState("");
    const [result, setResult] = useState<any>(null);

    const scanMutation = useMutation({
        mutationFn: async (uploadFile: File) => {
            const formData = new FormData();
            formData.append('file', uploadFile);
            const res = await apiClient.post('/api/v1/expenses/scan', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res.data?.data || res.data;
        },
        onSuccess: (data) => {
            setResult(data);
            toast.success("Receipt scanned successfully!");
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to scan receipt. Try a clearer image.");
        }
    });

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setPreview(URL.createObjectURL(f));
            scanMutation.mutate(f);
        }
    };

    if (result) {
        return <AddExpenseModal onClose={() => { onClose(); }} initialData={result} />;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>AI Receipt Scanner</h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={20} /></button>
                </div>
                <div className="p-6 text-center space-y-4">
                    {scanMutation.isPending ? (
                        <div className="py-8">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[var(--gold)]" />
                            <p className="text-sm text-[var(--text-muted)]">Analyzing receipt with AI...</p>
                        </div>
                    ) : (
                        <>
                            {preview && <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg border border-[var(--border)]" />}
                            <label className="block cursor-pointer">
                                <div className="border-2 border-dashed border-[var(--border)] rounded-[var(--radius-md)] p-8 hover:border-[var(--gold)] transition">
                                    <UploadCloud className="w-10 h-10 mx-auto mb-2 text-[var(--text-muted)]" />
                                    <p className="text-sm text-[var(--text-secondary)]">Click or drag to upload a receipt image</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">JPG, PNG up to 5MB</p>
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                            </label>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Add Expense Modal ─── */
function AddExpenseModal({ onClose, initialData, prefillPOId }: { onClose: () => void, initialData: any, prefillPOId?: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)] z-10">
                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
                        {initialData ? <><Sparkles className="inline w-4 h-4 mr-1 text-[var(--gold)]" /> AI Scanned Expense</> : "Add Expense"}
                    </h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition text-xl">✕</button>
                </div>
                <div className="p-5">
                    <AddExpenseForm initialData={initialData} onSuccess={onClose} prefillPOId={prefillPOId} />
                </div>
            </div>
        </div>
    );
}

/* ─── Expense Form (Shared) ─── */
function AddExpenseForm({ initialData, onSuccess, prefillPOId }: { initialData: any, onSuccess: () => void, prefillPOId?: string }) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        vendorName: initialData?.vendorName || "",
        amount: initialData?.amount || "",
        taxAmount: initialData?.taxAmount || "",
        date: initialData?.date || new Date().toISOString().split('T')[0],
        category: initialData?.category || "OTHER",
        type: prefillPOId ? "PURCHASE" : "OPERATIONAL",
        paymentMethod: "",
        purchaseOrderId: prefillPOId || "",
        notes: "",
    });

    const [poSearch, setPoSearch] = useState("");
    const [showPoDropdown, setShowPoDropdown] = useState(false);

    // Fetch POs for the selector
    const { data: posData } = useQuery({
        queryKey: ['purchase-orders-for-expense', poSearch],
        queryFn: async () => {
            const res = await apiClient.get(`/api/v1/purchase-orders?limit=20`);
            return res.data?.data?.data || res.data?.data || [];
        },
        enabled: formData.type === "PURCHASE",
    });
    const purchaseOrders: any[] = Array.isArray(posData) ? posData : [];

    const createMutation = useMutation({
        mutationFn: (data: any) => apiClient.post('/api/v1/expenses', data),
        onSuccess: () => {
            toast.success("Expense saved successfully!");
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['purchase-order'] });
            onSuccess();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to save expense");
        }
    });

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }}
            noValidate
            className="space-y-4 w-full"
        >
            {/* Expense Type Toggle */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Expense Type</label>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setFormData(p => ({ ...p, type: "OPERATIONAL", purchaseOrderId: "" }))}
                        className={`flex-1 py-2 text-sm rounded-[var(--radius-md)] border transition ${formData.type === "OPERATIONAL"
                            ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30 font-medium"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"}`}>
                        Daily / Operational
                    </button>
                    <button type="button" onClick={() => setFormData(p => ({ ...p, type: "PURCHASE" }))}
                        className={`flex-1 py-2 text-sm rounded-[var(--radius-md)] border transition ${formData.type === "PURCHASE"
                            ? "bg-purple-500/15 text-purple-400 border-purple-500/30 font-medium"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"}`}>
                        Purchase Order Cost
                    </button>
                </div>
            </div>

            {/* PO Selector (only for PURCHASE type) */}
            {formData.type === "PURCHASE" && (
                <div className="relative">
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Linked Purchase Order</label>
                    <div className="relative">
                        <input
                            value={poSearch || (formData.purchaseOrderId ? purchaseOrders.find(p => p.id === formData.purchaseOrderId)?.poNumber || formData.purchaseOrderId : "")}
                            onChange={(e) => { setPoSearch(e.target.value); setFormData(p => ({ ...p, purchaseOrderId: "" })); setShowPoDropdown(true); }}
                            onFocus={() => setShowPoDropdown(true)}
                            onBlur={() => setTimeout(() => setShowPoDropdown(false), 200)}
                            placeholder="Search PO number..."
                            className="input-field w-full pr-10"
                        />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={16} />
                    </div>
                    {showPoDropdown && (
                        <div className="absolute z-20 w-full mt-1 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)] max-h-40 overflow-y-auto shadow-xl">
                            {purchaseOrders.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-[var(--text-muted)] text-center">No purchase orders found</div>
                            ) : purchaseOrders.filter(p => !poSearch || p.poNumber?.toLowerCase().includes(poSearch.toLowerCase())).map((po: any) => (
                                <button key={po.id} type="button"
                                    onMouseDown={(e) => { e.preventDefault(); setFormData(p => ({ ...p, purchaseOrderId: po.id })); setPoSearch(po.poNumber); setShowPoDropdown(false); }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-card-hover)] transition flex justify-between items-center">
                                    <span className="font-mono">{po.poNumber}</span>
                                    <span className="text-xs text-[var(--text-muted)]">{po.supplier?.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {formData.purchaseOrderId && <p className="text-xs text-[var(--green-bright)] mt-1">✓ PO linked</p>}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Vendor Name</label>
                    <input
                        type="text"
                        required
                        className="input-field w-full"
                        value={formData.vendorName}
                        onChange={(e) => setFormData(p => ({ ...p, vendorName: e.target.value }))}
                        placeholder="e.g. Shell Petrol Pump"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Amount (₹)</label>
                    <input
                        type="number"
                        step="1"
                        required
                        className="input-field w-full font-mono text-lg text-[var(--gold)]"
                        value={formData.amount}
                        onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Tax (Inc.)</label>
                    <input
                        type="number"
                        step="1"
                        className="input-field w-full"
                        value={formData.taxAmount}
                        onChange={(e) => setFormData(p => ({ ...p, taxAmount: e.target.value }))}
                        placeholder="0.00"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Date</label>
                    <input
                        type="date"
                        required
                        className="input-field w-full"
                        value={formData.date}
                        onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Category</label>
                    <select
                        className="input-field w-full"
                        value={formData.category}
                        onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                    >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Payment Method</label>
                    <select
                        className="input-field w-full"
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData(p => ({ ...p, paymentMethod: e.target.value }))}
                    >
                        <option value="">— Select —</option>
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                    </select>
                </div>

                <div className="col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Notes</label>
                    <textarea
                        className="input-field w-full resize-none"
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Optional notes..."
                    />
                </div>
            </div>

            <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={onSuccess} className="px-4 py-2 hover:bg-[var(--bg-card-hover)] rounded-md text-sm transition">
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn-primary min-w-[100px]"
                >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Expense'}
                </button>
            </div>
        </form>
    );
}
