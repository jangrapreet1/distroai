"use client";
import { formatINR, exportToCSV } from "@/lib/utils";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Upload, X, FileSpreadsheet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCustomers } from "@/hooks/api-hooks";
import toast from "react-hot-toast";
import { AddCustomerModal } from "@/components/AddCustomerModal";
import { EditCustomerModal } from "@/components/modals/EditCustomerModal";
import { UniversalImportModal } from "@/components/modals/UniversalImportModal";
import { useLanguage } from "@/contexts/LanguageContext";


const TABS = ["All", "GOLD", "SILVER", "BRONZE", "High Risk", "Dormant"];
const CUSTOMER_TYPES = ["RETAILER", "WHOLESALER", "INSTITUTION"];

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
    const queryClient = useQueryClient();
    const [tab, setTab] = useState("All");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [showAdd, setShowAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<any>(null);
    const { t } = useLanguage();

    const TAB_LABELS: Record<string, string> = {
        All: t('all'), GOLD: t('gold'), SILVER: t('silver'), BRONZE: t('bronze'),
        'High Risk': t('high_risk'), Dormant: t('dormant'),
    };

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
                <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>{t('customers')}</h1>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0 flex-nowrap shrink-0">
                    <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm rounded-[var(--radius-md)] border border-[var(--gold)]/40 bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20 transition font-medium whitespace-nowrap"><FileSpreadsheet size={15} /> Import</button>
                    <button onClick={() => exportToCSV("customers", customers)} className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition whitespace-nowrap"><Upload size={14} /> Export</button>
                    <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-xs sm:text-sm font-semibold hover:bg-[var(--gold-light)] transition whitespace-nowrap"><Plus size={16} /> {t('add_customer')}</button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                    { label: t('total_label'), value: meta.total, color: "var(--gold)" },
                    { label: t('active'), value: meta.total, color: "var(--green-bright)" },
                    { label: t('retailers'), value: customers.filter((c: Record<string, unknown>) => c.type === "RETAILER").length, color: "var(--purple)" },
                    { label: t('wholesalers'), value: customers.filter((c: Record<string, unknown>) => c.type === "WHOLESALER").length, color: "var(--orange)" },
                ].map((s) => (
                    <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 sm:p-4">
                        <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
                        <p className="text-lg sm:text-xl font-bold" style={{ fontFamily: "var(--font-mono)", color: s.color }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-nowrap pb-1 mb-4">
                {TABS.map((tabKey) => (
                    <button key={tabKey} onClick={() => { setTab(tabKey); setPage(1); }} className={`px-3 py-1.5 text-xs rounded-full transition whitespace-nowrap shrink-0 ${tab === tabKey ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>{TAB_LABELS[tabKey] ?? tabKey}</button>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_customers')} className="w-full pl-9 pr-4 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
            </div>

            {/* Mobile Customer Cards (< md) */}
            <div className="block md:hidden space-y-3">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] skeleton h-24" />
                    ))
                ) : displayCustomers.length === 0 ? (
                    <div className="p-8 text-center text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
                        <Search size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-medium text-sm">{t('no_customers_found')}</p>
                    </div>
                ) : (
                    displayCustomers.map((c: Record<string, unknown>) => {
                        const outstanding = (c.outstandingAmount as number) ?? 0;
                        const isCredit = outstanding < 0;
                        return (
                            <div key={c.id as string} className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <Link href={`/customers/${c.id}`} className="font-semibold text-sm text-[var(--gold)] hover:underline truncate block">
                                            {c.name as string}
                                        </Link>
                                        <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                                            {c.city as string ?? "—"} • {c.type as string ?? "RETAILER"}
                                        </p>
                                    </div>
                                    <ScoreRing score={(c.paymentScore as number) ?? 50} size={26} />
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/60 text-xs">
                                    <div>
                                        <span className="text-[10px] text-[var(--text-muted)] block">Outstanding Balance</span>
                                        {isCredit ? (
                                            <span className="font-mono font-bold text-[var(--green-bright)] text-sm">
                                                {formatINR(Math.abs(outstanding))} <span className="text-[10px]">Cr</span>
                                            </span>
                                        ) : (
                                            <span className={`font-mono font-bold text-sm ${outstanding > 0 ? "text-[var(--red)]" : "text-[var(--text-secondary)]"}`}>
                                                {formatINR(outstanding)} <span className="text-[10px]">{outstanding > 0 ? "Dr" : "Nil"}</span>
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setEditingCustomer(c)}
                                            className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-medium hover:text-[var(--gold)] transition cursor-pointer"
                                            title="Edit Customer"
                                        >
                                            {t('edit') || "Edit"}
                                        </button>
                                        {!!c.phone && (
                                            <a
                                                href={`tel:${(c.phone as string).replace(/[^0-9+]/g, "")}`}
                                                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-medium hover:text-[var(--text-primary)] transition"
                                            >
                                                Call
                                            </a>
                                        )}
                                        {!!c.phone && (
                                            <a
                                                href={`https://wa.me/${(c.phone as string).replace(/[^0-9]/g, "")}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1.5 rounded-lg bg-[var(--whatsapp)]/15 border border-[var(--whatsapp)]/30 text-[var(--whatsapp)] text-xs font-semibold hover:bg-[var(--whatsapp)]/25 transition"
                                            >
                                                WhatsApp
                                            </a>
                                        )}
                                        <Link
                                            href={`/customers/${c.id}`}
                                            className="px-2.5 py-1.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-semibold hover:bg-[var(--gold)]/25 transition"
                                        >
                                            Ledger →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Desktop Table (md+) */}
            <div className="hidden md:block bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                            <th className="text-left p-4">{t('name')}</th><th className="text-left p-4">{t('city')}</th><th className="text-left p-4">{t('phone')}</th>
                            <th className="text-right p-4">{t('outstanding')}</th><th className="text-center p-4">{t('score')}</th><th className="text-right p-4">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="border-b border-[var(--border)]"><td colSpan={6} className="p-4"><div className="skeleton h-5 rounded" /></td></tr>
                        )) : displayCustomers.length === 0 ? (
                            <tr><td colSpan={6} className="p-12 text-center text-[var(--text-muted)]">
                                <Search size={36} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium">{t('no_customers_found')}</p>
                                <p className="text-xs mt-1">{t('try_adjusting')}</p>
                            </td></tr>
                        ) : displayCustomers.map((c: Record<string, unknown>) => (
                            <tr key={c.id as string} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                <td className="p-4 font-medium"><Link href={`/customers/${c.id}`} className="text-[var(--gold)] hover:underline">{c.name as string}</Link></td>
                                <td className="p-4 text-[var(--text-secondary)]">{c.city as string ?? "—"}</td>
                                <td className="p-4 text-[var(--text-secondary)]">{c.phone as string ?? "—"}</td>
                                <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)" }}>
                                    {(c.outstandingAmount as number) < 0 ? (
                                        <span className="text-[var(--green)]">{formatINR(Math.abs(c.outstandingAmount as number))} credit</span>
                                    ) : (
                                        <span style={{ color: (c.outstandingAmount as number) > 0 ? "var(--orange)" : "var(--text-secondary)" }}>
                                            {formatINR(c.outstandingAmount as number ?? 0)}
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-center"><ScoreRing score={(c.paymentScore as number) ?? 50} /></td>
                                <td className="p-4 text-right">
                                    <button
                                        type="button"
                                        onClick={() => setEditingCustomer(c)}
                                        className="text-xs text-[var(--gold)] hover:underline mr-3 cursor-pointer font-medium"
                                        title="Edit Customer Details"
                                    >
                                        {t('edit') || "Edit"}
                                    </button>
                                    <Link href={`/customers/${c.id}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition mr-3">{t('view')}</Link>
                                    {!!c.phone && <a href={`https://wa.me/${(c.phone as string).replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--whatsapp)] hover:underline">{t('whatsapp')}</a>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AddCustomerModal open={showAdd} onClose={() => setShowAdd(false)} />
            {editingCustomer && (
                <EditCustomerModal
                    open={Boolean(editingCustomer)}
                    onClose={() => setEditingCustomer(null)}
                    customer={editingCustomer}
                />
            )}
            <UniversalImportModal
                isOpen={showImport}
                onClose={() => setShowImport(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["customers"] });
                }}
                type="customers"
            />
        </div>
    );
}
