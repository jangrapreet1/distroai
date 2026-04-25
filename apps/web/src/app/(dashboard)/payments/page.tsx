"use client";

import { useState, useMemo, useEffect } from "react";
import { IndianRupee, CreditCard, X, Send, ChevronDown } from "lucide-react";
import { useOutstanding, usePayments, useRecordPayment, useCustomers } from "@/hooks/api-hooks";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { formatDate, formatINR } from "@/lib/utils";
import Link from "next/link";


const PAYMENT_METHODS = ["CASH", "UPI", "CHEQUE", "BANK_TRANSFER", "CREDIT"] as const;

function cleanPhone(phone: string): string {
    return phone.replace(/[^0-9]/g, "");
}

function buildPaymentReminderLink(phone: string, customerName: string, amount: number): string {
    const clean = cleanPhone(phone);
    const message = `Hello ${customerName},

This is a friendly reminder regarding your outstanding balance of *${formatINR(amount)}*.

Please let us know when you can arrange the payment.

Thank you!
— Sent via DistroAI`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/* ─── Record Payment Modal ─── */
function RecordPaymentModal({ open, onClose, prefillCustomerId, prefillCustomerName }: {
    open: boolean; onClose: () => void; prefillCustomerId?: string; prefillCustomerName?: string;
}) {
    const recordPayment = useRecordPayment();
    const [customerSearch, setCustomerSearch] = useState("");
    const [customerId, setCustomerId] = useState("");
    const [amount, setAmount] = useState(0);
    const [method, setMethod] = useState<string>("CASH");
    const [referenceNumber, setReferenceNumber] = useState("");
    const [notes, setNotes] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [error, setError] = useState("");

    const { data: customersData } = useCustomers({ search: customerSearch.trim() || undefined, limit: 10 });
    const customers = customersData?.data?.data ?? customersData?.data ?? [];

    // Pre-fill customer when modal opens with a prefillCustomerId
    useEffect(() => {
        if (open && prefillCustomerId && prefillCustomerName) {
            setCustomerId(prefillCustomerId);
            setCustomerSearch(prefillCustomerName);
        }
    }, [open, prefillCustomerId, prefillCustomerName]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId) { setError("Please select a valid customer from the list."); return; }
        if (amount <= 0) { setError("Amount must be greater than ₹0."); return; }
        setError("");

        recordPayment.mutate({ customerId, amount, method, referenceNumber: referenceNumber || undefined, notes: notes || undefined }, {
            onSuccess: () => {
                onClose();
                setCustomerSearch(""); setCustomerId(""); setAmount(0); setMethod("CASH"); setReferenceNumber(""); setNotes(""); setError("");
            },
            onError: (err: any) => {
                setError(err?.response?.data?.message || err.message || "Failed to record payment. Please try again.");
            }
        });
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Record Payment</h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <div className="relative">
                        <label className="block mb-1">
                            <span className="text-xs text-[var(--text-muted)]">Customer</span>
                        </label>
                        <div className="relative">
                            <input
                                value={customerSearch}
                                onChange={(e) => { setCustomerSearch(e.target.value); setCustomerId(""); setDropdownOpen(true); setError(""); }}
                                onFocus={() => setDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                                placeholder="Search customer..."
                                className="w-full px-3 py-2 pr-10 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition"
                            />
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={16} />
                        </div>

                        {dropdownOpen && (
                            <div className="absolute z-20 w-full mt-1 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)] max-h-48 overflow-y-auto shadow-xl">
                                {customers.length === 0 ? (
                                    <div className="px-3 py-4 text-sm text-[var(--text-muted)] text-center">No customers found</div>
                                ) : (
                                    (Array.isArray(customers) ? customers : []).map((c: Record<string, unknown>) => (
                                        <button key={c.id as string} type="button"
                                            onMouseDown={(e) => { e.preventDefault(); setCustomerId(c.id as string); setCustomerSearch(c.name as string); setDropdownOpen(false); setError(""); }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-card-hover)] transition">
                                            {c.name as string}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                        {customerId && <p className="text-xs text-[var(--green-bright)] mt-1">✓ Customer selected</p>}
                    </div>

                    <label className="block">
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Amount (₹)</span>
                        <input type="number" min={0.01} step="1" value={amount || ''} onChange={(e) => { setAmount(Number(e.target.value)); setError(""); }} placeholder="0.00" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                    </label>
                    <label className="block">
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Method</span>
                        <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Reference</span>
                        <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="UPI Ref / Cheque No." className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                    </label>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">Cancel</button>
                        <button type="submit" disabled={recordPayment.isPending} className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--green-bright)] text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-50 transition">
                            {recordPayment.isPending ? "..." : "Record"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Page ─── */
export default function PaymentsPage() {
    const [tab, setTab] = useState<"outstanding" | "history">("outstanding");
    const [showRecord, setShowRecord] = useState(false);
    const [recordCustomerId, setRecordCustomerId] = useState<string | undefined>();
    const [recordCustomerName, setRecordCustomerName] = useState<string | undefined>();
    const { data: outstanding } = useOutstanding();
    const { data: paymentsData } = usePayments({ page: 1, limit: 50 });

    const customerList: Record<string, unknown>[] = outstanding?.data ?? outstanding ?? [];
    const paymentsList: Record<string, unknown>[] = paymentsData?.data?.data ?? paymentsData?.data ?? [];

    const openRecordForCustomer = (custId: string, custName: string) => {
        setRecordCustomerId(custId);
        setRecordCustomerName(custName);
        setShowRecord(true);
    };

    const openRecordGeneral = () => {
        setRecordCustomerId(undefined);
        setRecordCustomerName(undefined);
        setShowRecord(true);
    };

    // Compute real summary from outstanding data
    const totalOutstanding = useMemo(() => {
        if (Array.isArray(customerList)) return customerList.reduce((s, c) => s + ((c.total as number) ?? 0), 0);
        return 0;
    }, [customerList]);

    const collectedThisMonth = useMemo(() => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        if (!Array.isArray(paymentsList)) return 0;
        return paymentsList
            .filter((p) => new Date(p.paidAt as string ?? p.createdAt as string) >= monthStart)
            .reduce((s, p) => s + ((p.amount as number) ?? 0), 0);
    }, [paymentsList]);

    // Build ageing from outstanding data
    const ageingData = useMemo(() => {
        const buckets = [
            { label: "0-30 days", value: 0, color: "var(--green-bright)" },
            { label: "31-60 days", value: 0, color: "var(--warning)" },
            { label: "61-90 days", value: 0, color: "var(--orange)" },
            { label: "90+ days", value: 0, color: "var(--red)" },
        ];

        let hasData = false;
        if (Array.isArray(customerList)) {
            customerList.forEach((c) => {
                const days = (c.avgDaysOverdue as number) ?? 0;
                const amount = (c.total as number) ?? 0;
                if (amount > 0) hasData = true;

                if (days <= 30) buckets[0].value += amount;
                else if (days <= 60) buckets[1].value += amount;
                else if (days <= 90) buckets[2].value += amount;
                else buckets[3].value += amount;
            });
        }

        // If there's outstanding money but it somehow wasn't bucketed (e.g. no invoices attached),
        // or if totalOutstanding > 0 but buckets are empty, force it into 0-30 days.
        const bucketTotal = buckets.reduce((sum, b) => sum + b.value, 0);
        if (bucketTotal === 0 && totalOutstanding > 0) {
            buckets[0].value = totalOutstanding;
        }
        return buckets;
    }, [customerList, totalOutstanding]);

    const summary = [
        { label: "Total Outstanding", value: formatINR(totalOutstanding), color: "var(--red)" },
        { label: "Collected This Month", value: formatINR(collectedThisMonth), color: "var(--green-bright)" },
        { label: "Customers", value: Array.isArray(customerList) ? customerList.length : 0, color: "var(--gold)" },
        { label: "Payments", value: Array.isArray(paymentsList) ? paymentsList.length : 0, color: "var(--purple)" },
    ];

    return (
        <div>
            {/* Header — stacks on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Payments &amp; Collections</h1>
                <div className="flex items-center gap-2">
                    <button onClick={() => setTab("outstanding")} className={`px-4 py-2 text-sm rounded-[var(--radius-md)] transition ${tab === "outstanding" ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)]"}`}>Outstanding</button>
                    <button onClick={() => setTab("history")} className={`px-4 py-2 text-sm rounded-[var(--radius-md)] transition ${tab === "history" ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)]"}`}>History</button>
                    <button onClick={openRecordGeneral} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--green-bright)] text-[var(--bg-primary)] hover:opacity-90 transition whitespace-nowrap">
                        <CreditCard size={14} /> <span className="hidden sm:inline">Record Payment</span><span className="sm:hidden">Record</span>
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {summary.map((s) => (
                    <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                        <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
                        <p className="text-lg font-bold" style={{ fontFamily: "var(--font-mono)", color: s.color }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {tab === "outstanding" ? (
                <>
                    {/* Ageing Chart */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5 mb-6">
                        <h3 className="font-semibold mb-4 text-[var(--text-primary)]">Payment Ageing</h3>
                        {ageingData.every(d => d.value === 0) ? (
                            <div className="h-32 flex items-center justify-center text-sm text-[var(--text-muted)]">No outstanding balances to display</div>
                        ) : (
                            <div className="h-40 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={ageingData} layout="vertical" barSize={20} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                        <XAxis type="number" tick={{ fontSize: 11, fill: "#5A5040" }} axisLine={false} tickLine={false} tickFormatter={(v) => {
                                            if (v === 0) return '₹0';
                                            if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
                                            if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
                                            return `₹${v}`;
                                        }} />
                                        <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#9A9080" }} axisLine={false} tickLine={false} width={80} />
                                        <Tooltip cursor={{ fill: 'var(--bg-card-hover)' }} contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: 10, fontSize: 12, color: "var(--tooltip-text)" }} formatter={(v: number | undefined) => [formatINR(v ?? 0)]} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {ageingData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Outstanding — Desktop table, Mobile cards */}
                    {/* Desktop table */}
                    <div className="hidden sm:block bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                    <th className="text-left p-4">Customer</th><th className="text-right p-4">Outstanding</th><th className="text-center p-4">Score</th><th className="text-right p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.isArray(customerList) && customerList.length > 0 ? customerList.map((c, i) => {
                                    const cust = c.customer as Record<string, unknown>;
                                    const custName = cust?.name as string ?? "Customer";
                                    const custPhone = cust?.phone as string ?? "";
                                    const custId = cust?.id as string ?? "";
                                    const total = (c.total as number) ?? 0;
                                    return (
                                        <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                            <td className="p-4">
                                                <p className="font-medium">{custName}</p>
                                                <p className="text-xs text-[var(--text-muted)]">{custPhone}</p>
                                            </td>
                                            <td className="p-4 text-right font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--orange)" }}>{formatINR(total)}</td>
                                            <td className="p-4 text-center text-sm" style={{ fontFamily: "var(--font-mono)" }}>{Number(cust?.paymentScore ?? 50)}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => openRecordForCustomer(custId, custName)} className="text-xs text-[var(--gold)] hover:underline mr-3">Record Payment</button>
                                                {custPhone && (
                                                    <a href={buildPaymentReminderLink(custPhone, custName, total)} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--whatsapp)] hover:underline">WhatsApp</a>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No outstanding payments</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-3">
                        {Array.isArray(customerList) && customerList.length > 0 ? customerList.map((c, i) => {
                            const cust = c.customer as Record<string, unknown>;
                            const custName = cust?.name as string ?? "Customer";
                            const custPhone = cust?.phone as string ?? "";
                            const custId = cust?.id as string ?? "";
                            const total = (c.total as number) ?? 0;
                            return (
                                <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="font-medium text-sm">{custName}</p>
                                            <p className="text-xs text-[var(--text-muted)]">{custPhone}</p>
                                        </div>
                                        <p className="text-base font-bold" style={{ fontFamily: "var(--font-mono)", color: "var(--orange)" }}>{formatINR(total)}</p>
                                    </div>
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
                                        <span className="text-xs text-[var(--text-muted)]">Score: <span style={{ fontFamily: "var(--font-mono)" }}>{Number(cust?.paymentScore ?? 50)}</span></span>
                                        <div className="flex gap-3">
                                            <button onClick={() => openRecordForCustomer(custId, custName)} className="text-xs text-[var(--gold)] hover:underline">Record</button>
                                            {custPhone && (
                                                <a href={buildPaymentReminderLink(custPhone, custName, total)} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--whatsapp)] hover:underline">WhatsApp</a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-8 text-center text-[var(--text-muted)]">No outstanding payments</div>
                        )}
                    </div>

                    {/* Recent Transactions */}
                    {Array.isArray(paymentsList) && paymentsList.length > 0 && (
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto mt-6">
                            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                                <h3 className="font-semibold text-[var(--text-primary)]">Recent Transactions</h3>
                                <button onClick={() => setTab("history")} className="text-xs text-[var(--gold)] hover:underline">View All</button>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                        <th className="text-left p-3 pl-4">Date</th>
                                        <th className="text-left p-3">Customer</th>
                                        <th className="text-left p-3">Method</th>
                                        <th className="text-right p-3">Amount</th>
                                        <th className="text-left p-3 pr-4">Reference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paymentsList.slice(0, 5).map((p, i) => (
                                        <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card-hover)] transition">
                                            <td className="p-3 pl-4 text-[var(--text-secondary)]">{formatDate(p.paidAt as string ?? p.createdAt as string)}</td>
                                            <td className="p-3 font-medium">{(p.customer as Record<string, unknown>)?.name as string ?? "—"}</td>
                                            <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs bg-[var(--gold)]/15 text-[var(--gold)]">{(p.method as string)?.replace("_", " ")}</span></td>
                                            <td className="p-3 text-right text-[var(--green-bright)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR((p.amount as number) ?? 0)}</td>
                                            <td className="p-3 pr-4 text-[var(--text-muted)]">{(p.referenceNumber as string) ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            ) : (
                /* Payment History */
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                <th className="text-left p-4">Date</th><th className="text-left p-4">Customer</th><th className="text-left p-4">Method</th><th className="text-right p-4">Amount</th><th className="text-left p-4">Reference</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(Array.isArray(paymentsList) ? paymentsList : []).length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No payments recorded</td></tr>
                            ) : (Array.isArray(paymentsList) ? paymentsList : []).map((p, i) => (
                                <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                    <td className="p-4 text-[var(--text-secondary)]">{formatDate(p.paidAt as string ?? p.createdAt as string)}</td>
                                    <td className="p-4 font-medium">{(p.customer as Record<string, unknown>)?.name as string ?? "—"}</td>
                                    <td className="p-4"><span className="px-2 py-0.5 rounded-full text-xs bg-[var(--gold)]/15 text-[var(--gold)]">{(p.method as string)?.replace("_", " ")}</span></td>
                                    <td className="p-4 text-right text-[var(--green-bright)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR((p.amount as number) ?? 0)}</td>
                                    <td className="p-4 text-[var(--text-muted)]">{(p.referenceNumber as string) ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <RecordPaymentModal open={showRecord} onClose={() => setShowRecord(false)} prefillCustomerId={recordCustomerId} prefillCustomerName={recordCustomerName} />
        </div>
    );
}

