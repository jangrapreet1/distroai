"use client";

import { useSuppliers, usePurchaseOrders } from "@/hooks/api-hooks";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Package, Mail, Phone, MapPin } from "lucide-react";
import { formatDate, formatINR } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SupplierDetailPage() {
    const params = useParams();
    const supplierId = params?.id as string;
    const { t } = useLanguage();

    const { data: sData, isLoading: sLoading } = useSuppliers(1, 100);
    const suppliers = sData?.data?.data ?? sData?.data ?? [];
    const supplier = suppliers.find((s: any) => s.id === supplierId);

    const { data: poData, isLoading: poLoading } = usePurchaseOrders(1, 100);
    const allPos = poData?.data?.data ?? poData?.data ?? [];
    const pos = allPos.filter((po: any) => po.supplierId === supplierId);

    if (sLoading) return <div className="p-12 text-center">Loading supplier...</div>;
    if (!supplier) return <div className="p-12 text-center text-[var(--red)]">Supplier not found</div>;

    const totalPos = Array.isArray(pos) ? pos.length : 0;
    const totalSpent = Array.isArray(pos) ? pos.reduce((s: number, po: any) => s + (po.netAmount || 0), 0) : 0;
    const itemsPending = Array.isArray(pos) ? pos.filter(po => po.status === "ISSUED").length : 0;

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/suppliers" className="p-2 rounded-lg hover:bg-[var(--bg-card)] transition border border-[var(--border)]">
                    <ArrowLeft size={18} className="text-[var(--text-muted)]" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-playfair)" }}>
                        <Building2 className="text-[var(--text-muted)] opacity-50" size={24} />
                        {supplier.name}
                    </h1>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Supplier Detail Card */}
                <div className="md:col-span-1 space-y-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 shadow-sm">
                        <h2 className="text-md font-semibold text-[var(--text-secondary)] mb-4 border-b border-[var(--border)] pb-2 flex items-center gap-2">Contact Info</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <Phone size={14} className="text-[var(--text-muted)] mt-0.5" />
                                <div>
                                    <p className="text-[var(--text-muted)] text-xs mb-0.5">Phone</p>
                                    <p className="font-medium text-[var(--text-primary)]">{supplier.phone || "—"}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Mail size={14} className="text-[var(--text-muted)] mt-0.5" />
                                <div>
                                    <p className="text-[var(--text-muted)] text-xs mb-0.5">Email</p>
                                    <p className="font-medium text-[var(--text-primary)]">{supplier.email || "—"}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin size={14} className="text-[var(--text-muted)] mt-0.5" />
                                <div>
                                    <p className="text-[var(--text-muted)] text-xs mb-0.5">Address</p>
                                    <p className="font-medium text-[var(--text-primary)]">{supplier.address || "—"}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Purchase Orders Table */}
                <div className="md:col-span-2">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-md font-semibold text-[var(--text-secondary)]">Purchase Orders</h2>
                            <Link href="/purchase-orders/new" className="text-xs bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20 px-3 py-1.5 rounded-full transition font-medium">Create PO</Link>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                        <th className="text-left py-3 px-2">PO Number</th>
                                        <th className="text-left py-3 px-2">Date</th>
                                        <th className="text-left py-3 px-2">Status</th>
                                        <th className="text-right py-3 px-2">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {poLoading ? (
                                        <tr><td colSpan={4} className="py-8 text-center text-[var(--text-muted)] animate-pulse">Loading orders...</td></tr>
                                    ) : pos.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-12 text-center text-[var(--text-muted)]">
                                                <Package size={24} className="mx-auto mb-2 opacity-30" />
                                                <p>No purchase orders found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        pos.map((po: any) => (
                                            <tr key={po.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition cursor-pointer" onClick={() => window.location.href = `/purchase-orders/${po.id}`}>
                                                <td className="py-3 px-2 font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                                                    <span className="text-[var(--gold)]">{po.poNumber}</span>
                                                </td>
                                                <td className="py-3 px-2 text-[var(--text-secondary)]">{formatDate(po.createdAt)}</td>
                                                <td className="py-3 px-2">
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider ${po.status === "RECEIVED" ? "bg-[var(--green)]/10 text-[var(--green)]" : po.status === "ISSUED" ? "bg-[var(--orange)]/10 text-[var(--orange)]" : "bg-[var(--text-muted)]/10 text-[var(--text-muted)]"}`}>
                                                        {po.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-right font-medium" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(po.netAmount)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
