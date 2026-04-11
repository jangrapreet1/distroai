"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, X, Truck, Clock, Star, MapPin } from "lucide-react";
import { useSuppliers, useCreateSupplier } from "@/hooks/api-hooks";

/* ─── Add Supplier Modal ─── */
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

/* ─── Main Page ─── */
export default function SuppliersPage() {
    const [showAdd, setShowAdd] = useState(false);
    const [search, setSearch] = useState("");
    const { data, isLoading } = useSuppliers();
    const suppliers: Record<string, any>[] = data?.data ?? [];

    const filtered = useMemo(() => {
        if (!search.trim()) return suppliers;
        const q = search.toLowerCase();
        return suppliers.filter((s) =>
            (s.name as string)?.toLowerCase().includes(q) ||
            (s.city as string)?.toLowerCase().includes(q) ||
            (s.phone as string)?.includes(q)
        );
    }, [suppliers, search]);

    // KPI summaries
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter((s) => s.isActive !== false).length;
    const avgLeadTime = totalSuppliers > 0
        ? Math.round(suppliers.reduce((sum, s) => sum + ((s.leadTimeDays as number) || 0), 0) / totalSuppliers)
        : 0;
    const avgScore = totalSuppliers > 0
        ? Math.round(suppliers.reduce((sum, s) => sum + ((s.performanceScore as number) || 0), 0) / totalSuppliers)
        : 0;

    const kpis = [
        { label: "Total Suppliers", value: totalSuppliers, icon: Truck, color: "var(--gold)" },
        { label: "Active", value: activeSuppliers, icon: Star, color: "var(--green-bright)" },
        { label: "Avg Lead Time", value: `${avgLeadTime}d`, icon: Clock, color: "var(--purple)" },
        { label: "Avg Score", value: avgScore ? `${avgScore}/100` : "—", icon: Star, color: "var(--orange)" },
    ];

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Suppliers</h1>
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] transition"><Plus size={16} /> Add Supplier</button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {kpis.map((k) => (
                    <div key={k.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                        <div className="flex items-center gap-2 mb-2"><k.icon size={14} style={{ color: k.color }} /><span className="text-xs text-[var(--text-muted)]">{k.label}</span></div>
                        <p className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative mb-4 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                    placeholder="Search by name, city, or phone…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition placeholder:text-[var(--text-muted)]"
                />
                {search && (
                    <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={14} /></button>
                )}
            </div>

            {/* Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                        <th className="text-left p-4">Name</th><th className="text-left p-4">City</th><th className="text-left p-4">Phone</th><th className="text-left p-4">Lead Time</th><th className="text-center p-4">Score</th><th className="text-right p-4">Actions</th>
                    </tr></thead>
                    <tbody>
                        {isLoading ? Array.from({ length: 4 }).map((_, i) => <tr key={i} className="border-b border-[var(--border)]"><td colSpan={6} className="p-4"><div className="skeleton h-5 rounded" /></td></tr>) :
                            filtered.length === 0 ? (
                                <tr><td colSpan={6} className="p-0">
                                    <div className="text-center py-16">
                                        <div className="w-16 h-16 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-4">
                                            <Truck size={28} className="text-[var(--gold)]" />
                                        </div>
                                        <h3 className="text-base font-medium mb-1">{search ? "No matching suppliers" : "No suppliers yet"}</h3>
                                        <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto mb-5">
                                            {search ? "Try a different search term." : "Add your first supplier to start managing purchases and track lead times."}
                                        </p>
                                        {!search && (
                                            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] transition">
                                                <Plus size={14} /> Add Supplier
                                            </button>
                                        )}
                                    </div>
                                </td></tr>
                            ) : filtered.map((s) => (
                                <tr key={s.id as string} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                    <td className="p-4 font-medium"><Link href={`/suppliers/${s.id}`} className="text-[var(--gold)] hover:underline">{s.name as string}</Link></td>
                                    <td className="p-4 text-[var(--text-secondary)]">{(s.city as string) ?? "—"}</td>
                                    <td className="p-4 text-[var(--text-secondary)]">{(s.phone as string) ?? "—"}</td>
                                    <td className="p-4 text-[var(--text-secondary)]">{(s.leadTimeDays as number) ?? "—"} days</td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(s.performanceScore as number) >= 80 ? "bg-[var(--green-bright)]/15 text-[var(--green-bright)]" :
                                                (s.performanceScore as number) >= 50 ? "bg-[var(--orange)]/15 text-[var(--orange)]" :
                                                    "bg-[var(--text-muted)]/15 text-[var(--text-muted)]"
                                            }`}>{(s.performanceScore as number) || "—"}</span>
                                    </td>
                                    <td className="p-4 text-right"><Link href={`/suppliers/${s.id}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">View →</Link></td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
            <AddSupplierModal open={showAdd} onClose={() => setShowAdd(false)} />
        </div>
    );
}
