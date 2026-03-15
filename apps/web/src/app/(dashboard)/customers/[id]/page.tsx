"use client";

import { use } from "react";
import { useCustomer, useCustomerCreditScore, useSendInvoiceWhatsApp } from "@/hooks/api-hooks";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin, TrendingUp, CreditCard, ShieldCheck, AlertTriangle, Clock, Package, Send, MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatINR(n: number): string { return "₹" + n.toLocaleString("en-IN"); }

function PaymentScoreGauge({ score, band }: { score: number; band: string }) {
    const color = band === "GREEN" ? "var(--green-bright)" : band === "YELLOW" ? "var(--warning)" : band === "ORANGE" ? "var(--orange)" : "var(--red)";
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    return (
        <div className="flex flex-col items-center">
            <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="45" fill="none" stroke="var(--border)" strokeWidth="10" />
                <circle cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 60 60)" className="transition-all duration-1000 ease-out" />
                <text x="60" y="55" textAnchor="middle" fill={color} fontSize="28" fontWeight="bold" fontFamily="var(--font-mono)">{score}</text>
                <text x="60" y="72" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="500">/ 100</text>
            </svg>
            <span className="text-xs font-semibold mt-1 px-3 py-1 rounded-full" style={{ backgroundColor: `${color}20`, color }}>{band}</span>
        </div>
    );
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: customerData, isLoading } = useCustomer(id);
    const { data: creditData } = useCustomerCreditScore(id);
    const sendWhatsApp = useSendInvoiceWhatsApp();

    const customer = customerData?.customer;
    const stats = customerData?.stats;
    const recentOrders = customerData?.recentOrders ?? [];
    const recentPayments = customerData?.recentPayments ?? [];
    const paymentSummary = customerData?.paymentSummary;
    const creditScore = creditData?.data ?? creditData;

    if (isLoading) return <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
    if (!customer) return <div className="p-8 text-center text-red-500">Customer not found</div>;

    const tierColors: Record<string, string> = { GOLD: "var(--gold)", SILVER: "var(--text-muted)", BRONZE: "var(--orange)" };

    return (
        <div className="space-y-6">
            <Link href="/customers" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--gold)] transition">
                <ArrowLeft size={16} /> Back to Customers
            </Link>

            {/* Quick Actions Bar */}
            {customer.phone && (
                <div className="flex flex-wrap gap-2">
                    <a href={`https://wa.me/91${customer.phone}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--whatsapp)] hover:bg-[var(--whatsapp)]/10 transition">
                        <MessageCircle size={14} /> WhatsApp
                    </a>
                    <a href={`tel:${customer.phone}`}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition">
                        <Phone size={14} /> Call
                    </a>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {/* LEFT SIDEBAR — Customer Info + Payment Score */}
                <div className="w-full lg:w-1/3 space-y-6">
                    {/* Contact Card */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>{customer.name}</h1>
                            <div className="flex gap-2">
                                <span className="px-2 py-1 text-xs font-medium rounded" style={{ backgroundColor: `${tierColors[customer.tier] || "var(--gold)"}20`, color: tierColors[customer.tier] || "var(--gold)" }}>
                                    {customer.tier}
                                </span>
                                <span className="px-2 py-1 bg-[var(--gold)]/10 text-[var(--gold)] text-xs font-medium rounded">{customer.type}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {customer.phone && <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]"><Phone size={16} className="text-[var(--text-muted)]" />{customer.phone}</div>}
                            {customer.email && <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]"><Mail size={16} className="text-[var(--text-muted)]" />{customer.email}</div>}
                            {(customer.city || customer.state) && <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]"><MapPin size={16} className="text-[var(--text-muted)]" />{customer.city}{customer.state ? `, ${customer.state}` : ""}</div>}
                            {customer.gstNumber && <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]"><ShieldCheck size={16} className="text-[var(--text-muted)]" />GSTIN: {customer.gstNumber}</div>}
                        </div>
                    </div>

                    {/* Payment Score Card */}
                    {creditScore && (
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                            <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 font-semibold">Payment Score</h3>
                            <PaymentScoreGauge score={creditScore.score ?? customer.paymentScore ?? 0} band={creditScore.band ?? "GREEN"} />
                            <p className="text-xs text-[var(--text-muted)] mt-4 text-center leading-relaxed">{creditScore.recommendation}</p>
                        </div>
                    )}

                    {/* Financial Snapshot */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                        <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-4 font-semibold">Financial Snapshot</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-[var(--text-muted)] flex items-center gap-2"><AlertTriangle size={14} /> Outstanding</span>
                                <span className="text-lg font-bold text-[var(--red)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(customer.outstandingAmount ?? 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-[var(--text-muted)] flex items-center gap-2"><CreditCard size={14} /> Credit Limit</span>
                                <span className="text-sm font-medium" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(customer.creditLimit ?? 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-[var(--text-muted)] flex items-center gap-2"><Clock size={14} /> Credit Days</span>
                                <span className="text-sm font-medium">{customer.creditDays ?? 0} days</span>
                            </div>
                            <div className="border-t border-[var(--border)] pt-3 mt-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-[var(--text-muted)] flex items-center gap-2"><TrendingUp size={14} /> Lifetime Revenue</span>
                                    <span className="text-sm font-bold text-[var(--green-bright)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(stats?.totalRevenue ?? 0)}</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-sm text-[var(--text-muted)]">Total Orders</span>
                                    <span className="text-sm font-medium">{stats?.totalOrders ?? 0}</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-sm text-[var(--text-muted)]">Avg Order Value</span>
                                    <span className="text-sm font-medium" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(stats?.avgOrderValue ?? 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT MAIN CONTENT */}
                <div className="w-full lg:w-2/3 space-y-6">
                    {/* Payment Ageing */}
                    {paymentSummary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: "Current", amount: paymentSummary.current, color: "var(--green-bright)" },
                                { label: "30+ Days", amount: paymentSummary.overdue30, color: "var(--warning)" },
                                { label: "60+ Days", amount: paymentSummary.overdue60, color: "var(--orange)" },
                                { label: "90+ Days", amount: paymentSummary.overdue90, color: "var(--red)" },
                            ].map((a) => (
                                <div key={a.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: a.color }}>{a.label}</p>
                                    <p className="text-lg font-bold" style={{ fontFamily: "var(--font-mono)", color: a.amount > 0 ? a.color : "var(--text-muted)" }}>{formatINR(a.amount ?? 0)}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Recent Orders */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
                            <h2 className="font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>Recent Orders</h2>
                            <Link href={`/orders/new?customer=${customer.id}`} className="px-3 py-1.5 bg-[var(--gold)] text-[var(--bg-primary)] text-xs font-semibold rounded hover:bg-[var(--gold-light)] transition">
                                New Order
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                        <th className="text-left p-4">Order #</th>
                                        <th className="text-left p-4">Date</th>
                                        <th className="text-right p-4">Amount</th>
                                        <th className="text-center p-4">Status</th>
                                        <th className="text-right p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentOrders.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">
                                            <Package size={32} className="mx-auto mb-2 opacity-30" />No orders yet
                                        </td></tr>
                                    ) : (
                                        recentOrders.map((order: any) => (
                                            <tr key={order.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                                <td className="p-4 font-medium"><Link href={`/orders/${order.id}`} className="text-[var(--gold)] hover:underline">{order.orderNumber}</Link></td>
                                                <td className="p-4 text-[var(--text-secondary)]">{formatDate(order.createdAt)}</td>
                                                <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(order.netAmount)}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-block px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider ${order.status === 'DELIVERED' ? 'bg-[var(--green-bright)]/10 text-[var(--green-bright)]' :
                                                        order.status === 'CANCELLED' ? 'bg-red-500/10 text-red-500' :
                                                            order.status === 'DRAFT' ? 'bg-[var(--text-muted)]/10 text-[var(--text-secondary)]' :
                                                                'bg-[var(--gold)]/10 text-[var(--gold)]'
                                                        }`}>{order.status}</span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {order.invoiceId && (
                                                        <button
                                                            onClick={() => sendWhatsApp.mutate(order.invoiceId)}
                                                            disabled={sendWhatsApp.isPending}
                                                            className="inline-flex items-center gap-1 text-xs text-[var(--whatsapp)] hover:underline transition disabled:opacity-50"
                                                        >
                                                            <Send size={12} /> Send Invoice
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent Payments */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                        <div className="p-4 border-b border-[var(--border)]">
                            <h2 className="font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>Recent Payments</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                        <th className="text-left p-4">Date</th>
                                        <th className="text-left p-4">Method</th>
                                        <th className="text-right p-4">Amount</th>
                                        <th className="text-left p-4">Reference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentPayments.length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">
                                            <CreditCard size={32} className="mx-auto mb-2 opacity-30" />No payments recorded
                                        </td></tr>
                                    ) : (
                                        recentPayments.map((p: any) => (
                                            <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                                <td className="p-4 text-[var(--text-secondary)]">{formatDate(p.paidAt ?? p.createdAt)}</td>
                                                <td className="p-4"><span className="px-2 py-0.5 rounded-full text-xs bg-[var(--gold)]/15 text-[var(--gold)]">{p.method?.replace("_", " ")}</span></td>
                                                <td className="p-4 text-right text-[var(--green-bright)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(p.amount ?? 0)}</td>
                                                <td className="p-4 text-[var(--text-muted)]">{p.referenceNumber ?? "—"}</td>
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
    );
}
