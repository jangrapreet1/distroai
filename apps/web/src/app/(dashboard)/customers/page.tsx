"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Upload, X } from "lucide-react";
import { useCustomers } from "@/hooks/api-hooks";
import toast from "react-hot-toast";
import { AddCustomerModal } from "@/components/AddCustomerModal";

function formatINR(n: number): string { return "₹" + n.toLocaleString("en-IN"); }

const TABS = ["All", "GOLD", "SILVER", "BRONZE", "High Risk", "Dormant"];
const CUSTOMER_TYPES = ["RETAILER", "WHOLESALER", "INSTITUTION"];
const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi",
];

function ScoreRing({ score, size = 28 }: { score: number; size?: number }) {
    const color = score >= 80 ? "var(--green-bright)" : score >= 60 ? "var(--gold)" : score >= 40 ? "var(--orange)" : "var(--red)";
    const r = size / 2 - 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return (
        <div className="relative inline-block">
            <svg width={size} height={size} className="transform -rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2.5} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ fontFamily: "var(--font-mono)", color }}>{score}</span>
        </div>
    );
}

export default function CustomersPage() {
    const [tab, setTab] = useState("All");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [showAdd, setShowAdd] = useState(false);

    const filters = { search: search || undefined, page, limit: 100 }; // Increase limit to fetch enough for client-side filtering
    const { data, isLoading } = useCustomers(filters);
    const customers = data?.data?.data ?? data?.data ?? [];
    const meta = data?.data?.meta ?? data?.meta ?? { total: 0 };

    const displayCustomers = customers.filter((c: any) => {
        if (tab === "All") return true;
        const score = c.paymentScore ?? 100;
        if (tab === "GOLD") return score >= 90;
        if (tab === "SILVER") return score >= 70 && score < 90;
        if (tab === "BRONZE") return score >= 50 && score < 70;
        if (tab === "High Risk") return score < 50 && score > 0;
        if (tab === "Dormant") return score === 0 || c.outstandingAmount === 0;
        return true;
    });

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Customers</h1>
                <div className="flex gap-2">
                    <button onClick={() => toast("CSV import coming soon!", { icon: "📁" })} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition"><Upload size={14} /> Import</button>
                    <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] transition"><Plus size={16} /> Add Customer</button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                    { label: "Total", value: meta.total, color: "var(--gold)" },
                    { label: "Active", value: meta.total, color: "var(--green-bright)" },
                    { label: "Retailers", value: customers.filter((c: Record<string, unknown>) => c.type === "RETAILER").length, color: "var(--purple)" },
                    { label: "Wholesalers", value: customers.filter((c: Record<string, unknown>) => c.type === "WHOLESALER").length, color: "var(--orange)" },
                ].map((s) => (
                    <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                        <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
                        <p className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)", color: s.color }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 mb-4">
                {TABS.map((t) => (
                    <button key={t} onClick={() => { setTab(t); setPage(1); }} className={`px-3 py-1.5 text-xs rounded-full transition ${tab === t ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>{t}</button>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
            </div>

            {/* Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                            <th className="text-left p-4">Name</th><th className="text-left p-4">City</th><th className="text-left p-4">Phone</th>
                            <th className="text-right p-4">Outstanding</th><th className="text-center p-4">Score</th><th className="text-right p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="border-b border-[var(--border)]"><td colSpan={6} className="p-4"><div className="skeleton h-5 rounded" /></td></tr>
                        )) : displayCustomers.length === 0 ? (
                            <tr><td colSpan={6} className="p-12 text-center text-[var(--text-muted)]">
                                <Search size={36} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium">No customers found</p>
                                <p className="text-xs mt-1">Try adjusting your search or filters</p>
                            </td></tr>
                        ) : displayCustomers.map((c: Record<string, unknown>) => (
                            <tr key={c.id as string} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                <td className="p-4 font-medium"><Link href={`/customers/${c.id}`} className="text-[var(--gold)] hover:underline">{c.name as string}</Link></td>
                                <td className="p-4 text-[var(--text-secondary)]">{c.city as string ?? "—"}</td>
                                <td className="p-4 text-[var(--text-secondary)]">{c.phone as string ?? "—"}</td>
                                <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)", color: (c.outstandingAmount as number) > 0 ? "var(--orange)" : "var(--text-secondary)" }}>
                                    {formatINR(c.outstandingAmount as number ?? 0)}
                                </td>
                                <td className="p-4 text-center"><ScoreRing score={(c.paymentScore as number) ?? 50} /></td>
                                <td className="p-4 text-right">
                                    <Link href={`/customers/${c.id}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition mr-3">View</Link>
                                    {!!c.phone && <a href={`https://wa.me/91${c.phone as string}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--whatsapp)] hover:underline">WhatsApp</a>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AddCustomerModal open={showAdd} onClose={() => setShowAdd(false)} />
        </div>
    );
}
