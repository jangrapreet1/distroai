"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, ScanLine, UploadCloud, Trash2, X } from "lucide-react";
import apiClient from "@/lib/api-client";
import { toast } from "react-hot-toast";

export default function ExpensesPage() {
    const queryClient = useQueryClient();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);

    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState("ALL");

    const { data, isLoading } = useQuery({
        queryKey: ['expenses', page, statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            if (statusFilter !== "ALL") params.append("status", statusFilter);
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

    return (
        <div className="space-y-6 animate-in fade-in duration-300 relative">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Expenses</h1>
                    <p className="text-[var(--text-muted)] text-sm mt-1">
                        Track operational expenses and scan physical receipts with AI.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsScanModalOpen(true)}
                        className="btn-secondary bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/30 hover:bg-[var(--gold)]/20 flex items-center gap-2"
                    >
                        <ScanLine className="w-4 h-4" />
                        AI Scan Receipt
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Manual
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 text-xs font-semibold tracking-wider rounded-full transition-colors ${statusFilter === s
                            ? "bg-[var(--gold)] text-[var(--bg-primary)]"
                            : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-primary)]"
                            }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* Data Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-[var(--radius-lg)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4 font-medium tracking-wider">Date</th>
                                <th className="px-6 py-4 font-medium tracking-wider">Vendor</th>
                                <th className="px-6 py-4 font-medium tracking-wider">Category</th>
                                <th className="px-6 py-4 font-medium tracking-wider text-right">Amount</th>
                                <th className="px-6 py-4 font-medium tracking-wider text-center">Status</th>
                                <th className="px-6 py-4 font-medium tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-primary)]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading expenses...
                                    </td>
                                </tr>
                            ) : expenses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-0">
                                        <div className="text-center py-16">
                                            <div className="w-16 h-16 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-4">
                                                <ScanLine className="w-7 h-7 text-[var(--gold)]" />
                                            </div>
                                            <h3 className="text-base font-medium mb-1">{statusFilter !== "ALL" ? "No matching expenses" : "No expenses yet"}</h3>
                                            <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto mb-5">
                                                {statusFilter !== "ALL" ? "Try changing the status filter." : "Start tracking expenses by scanning a receipt or adding one manually."}
                                            </p>
                                            {statusFilter === "ALL" && (
                                                <div className="flex items-center justify-center gap-3">
                                                    <button onClick={() => setIsScanModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition">
                                                        <ScanLine className="w-4 h-4" /> AI Scan Receipt
                                                    </button>
                                                    <button onClick={() => setIsAddModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
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
                                        <td className="px-6 py-4 text-[var(--text-secondary)] whitespace-nowrap">
                                            {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 font-medium">{exp.vendorName}</td>
                                        <td className="px-6 py-4 text-[var(--text-secondary)]">{exp.category || "OTHER"}</td>
                                        <td className="px-6 py-4 font-medium text-right font-mono">
                                            ₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider border
                                                ${exp.status === 'PAID' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                    exp.status === 'APPROVED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                        exp.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                            'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}
                                            `}>
                                                {exp.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {exp.status !== 'PAID' && exp.status !== 'REJECTED' && (
                                                    <select
                                                        className="text-xs bg-transparent border border-[var(--border-accent)] rounded px-2 py-1 cursor-pointer"
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
            {isAddModalOpen && <AddExpenseModal onClose={() => setIsAddModalOpen(false)} initialData={null} />}
        </div>
    );
}

// ─── AI Scan Modal ───
function AIScanModal({ onClose }: { onClose: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [scannedData, setScannedData] = useState<any>(null);

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
            setScannedData(data);
            toast.success("Receipt parsed successfully!");
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to scan receipt");
            setFile(null);
            setPreview(null);
        }
    });

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            setPreview(URL.createObjectURL(f));
            scanMutation.mutate(f);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-accent)] w-full max-w-lg rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-[var(--border-primary)] bg-[var(--bg-card)]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--gold)]/10 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-[var(--gold)]" />
                        </div>
                        <h2 className="text-lg font-semibold tracking-tight">AI Receipt Scanner</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-card-hover)] transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {!file ? (
                        <div className="relative border-2 border-dashed border-[var(--border-accent)] rounded-lg p-10 flex flex-col items-center justify-center text-center hover:bg-[var(--bg-card-hover)] transition group cursor-pointer">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFile}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="w-12 h-12 bg-[var(--bg-card)] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                                <UploadCloud className="w-6 h-6 text-[var(--gold)]" />
                            </div>
                            <p className="font-semibold text-[var(--text-primary)]">Click or Drag a receipt</p>
                            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-[250px]">
                                Upload a photo of your physical bill. Gemini Vision will extract the details.
                            </p>
                        </div>
                    ) : scanMutation.isPending ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center">
                            <div className="relative w-24 h-32 rounded-lg bg-[var(--bg-card)] mb-6 overflow-hidden flex items-center justify-center">
                                {preview && <img src={preview} alt="preview" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
                                <div className="absolute inset-0 bg-gradient-to-t from-[var(--gold)]/20 to-transparent animate-pulse" />
                                <ScanLine className="w-8 h-8 text-[var(--gold)] animate-bounce relative z-10" />
                            </div>
                            <h3 className="text-lg font-medium text-[var(--gold)]">Scanning Receipt...</h3>
                            <p className="text-sm text-[var(--text-muted)] mt-2">Our AI is parsing the vendor, amount and dates.</p>
                        </div>
                    ) : scannedData ? (
                        <AddExpenseForm initialData={scannedData} onSuccess={onClose} />
                    ) : null}
                </div>
            </div>
        </div>
    );
}

// ─── Add Manual Modal ───
function AddExpenseModal({ onClose, initialData }: { onClose: () => void, initialData: any }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-accent)] w-full max-w-lg rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-[var(--border-primary)] bg-[var(--bg-card)]">
                    <h2 className="text-lg font-semibold tracking-tight">{initialData ? 'Confirm Expense' : 'Add Expense'}</h2>
                    <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-card-hover)] transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto w-full">
                    <AddExpenseForm initialData={initialData} onSuccess={onClose} />
                </div>
            </div>
        </div>
    );
}

// ─── Expense Form (Shared) ───
import { Sparkles } from "lucide-react";
function AddExpenseForm({ initialData, onSuccess }: { initialData: any, onSuccess: () => void }) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        vendorName: initialData?.vendorName || "",
        amount: initialData?.amount || "",
        taxAmount: initialData?.taxAmount || "",
        date: initialData?.date || new Date().toISOString().split('T')[0],
        category: initialData?.category || "OTHER",
        notes: "",
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => apiClient.post('/api/v1/expenses', data),
        onSuccess: () => {
            toast.success("Expense saved successfully!");
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            onSuccess();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to save expense");
        }
    });

    const categories = ['TRAVEL', 'FOOD', 'FUEL', 'UTILITIES', 'SUPPLIES', 'MAINTENANCE', 'SOFTWARE', 'OTHER'];

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }}
            className="space-y-4 w-full"
        >
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
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Total Amount (₹)</label>
                    <input
                        type="number"
                        step="0.01"
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
                        step="0.01"
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
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
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
