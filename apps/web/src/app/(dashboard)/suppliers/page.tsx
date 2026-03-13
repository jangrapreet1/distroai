"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { useSuppliers, useCreateSupplier } from "@/hooks/api-hooks";

function AddSupplierModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const create = useCreateSupplier();
    const [name, setName] = useState("");
    const [city, setCity] = useState("");
    const [phone, setPhone] = useState("");
    const [leadTimeDays, setLeadTimeDays] = useState("0");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        create.mutate({
            name,
            city,
            phone,
            leadTimeDays: parseInt(leadTimeDays) || 0
        }, {
            onSuccess: () => {
                onClose();
                setName(""); setCity(""); setPhone(""); setLeadTimeDays("0");
            }
        });
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Add Supplier</h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Supplier Name *</span>
                        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Acme Corp" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                    </label>
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">City</span>
                        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                    </label>
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Phone</span>
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                    </label>
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Lead Time (Days)</span>
                        <input type="number" min="0" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                    </label>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">Cancel</button>
                        <button type="submit" disabled={create.isPending} className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                            {create.isPending ? "Saving..." : "Save Supplier"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function SuppliersPage() {
    const [showAdd, setShowAdd] = useState(false);
    const { data, isLoading } = useSuppliers();
    const suppliers = data?.data ?? [];

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Suppliers</h1>
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] transition"><Plus size={16} /> Add Supplier</button>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                        <th className="text-left p-4">Name</th><th className="text-left p-4">City</th><th className="text-left p-4">Phone</th><th className="text-left p-4">Lead Time</th><th className="text-right p-4">Actions</th>
                    </tr></thead>
                    <tbody>
                        {isLoading ? Array.from({ length: 3 }).map((_, i) => <tr key={i} className="border-b border-[var(--border)]"><td colSpan={5} className="p-4"><div className="skeleton h-5 rounded" /></td></tr>) :
                            suppliers.length === 0 ? <tr><td colSpan={5} className="p-12 text-center text-[var(--text-muted)]">No suppliers yet</td></tr> :
                                suppliers.map((s: Record<string, unknown>) => (
                                    <tr key={s.id as string} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                        <td className="p-4 font-medium"><Link href={`/suppliers/${s.id}`} className="text-[var(--gold)] hover:underline">{s.name as string}</Link></td>
                                        <td className="p-4 text-[var(--text-secondary)]">{s.city as string ?? "—"}</td>
                                        <td className="p-4 text-[var(--text-secondary)]">{s.phone as string ?? "—"}</td>
                                        <td className="p-4 text-[var(--text-secondary)]">{s.leadTimeDays as number ?? "—"} days</td>
                                        <td className="p-4 text-right"><Link href={`/suppliers/${s.id}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">View</Link></td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div>
            <AddSupplierModal open={showAdd} onClose={() => setShowAdd(false)} />
        </div>
    );
}
