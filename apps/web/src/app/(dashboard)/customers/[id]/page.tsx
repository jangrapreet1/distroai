"use client";

import { use, useState } from "react";
import { useCustomer, useCustomerCreditScore, useCustomerActivity, useCreateLocationRequest } from "@/hooks/api-hooks";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin, TrendingUp, CreditCard, ShieldCheck, AlertTriangle, Clock, Package, Send, MessageCircle } from "lucide-react";
import { formatDate, buildWhatsAppInvoiceLink, formatINR } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import dynamic from "next/dynamic";

const CustomerMap = dynamic(() => import("@/components/ui/customer-map"), {
    ssr: false,
    loading: () => <div className="h-64 w-full bg-[var(--bg-secondary)] animate-pulse rounded-[var(--radius-lg)]" />
});


function PaymentScoreGauge({ score, band }: { score: number; band: string }) {
    const color = band === "GREEN" ? "var(--green-bright)" : band === "YELLOW" ? "var(--warning)" : band === "ORANGE" ? "var(--orange)" : "var(--red)";
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    return (
        <div className="flex flex-col items-center group">
            <svg width="120" height="120" viewBox="0 0 120 120" className="transition-transform duration-500 group-hover:scale-105" style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}>
                <circle cx="60" cy="60" r="45" fill="none" stroke="var(--border)" strokeWidth="10" className="opacity-50" />
                <circle cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 60 60)" className="transition-all duration-1000 ease-out animate-pulse" />
                <text x="60" y="55" textAnchor="middle" fill={color} fontSize="28" fontWeight="bold" fontFamily="var(--font-mono)">{score}</text>
                <text x="60" y="72" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="500">/ 100</text>
            </svg>
            <span className="text-[10px] uppercase font-bold mt-2 px-3 py-1 rounded-sm shadow-[inset_0_1px_rgba(255,255,255,0.1)] tracking-widest" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}>{band}</span>
        </div>
    );
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: customerData, isLoading } = useCustomer(id);
    const { data: creditData } = useCustomerCreditScore(id);
    const { data: activityData, isLoading: activityLoading } = useCustomerActivity(id, 1, 20);

    const activities = activityData?.data ?? [];

    const customer = customerData?.customer;
    const stats = customerData?.stats;
    const recentOrders = customerData?.recentOrders ?? [];
    const recentPayments = customerData?.recentPayments ?? [];
    const paymentSummary = customerData?.paymentSummary;
    const creditScore = creditData?.data ?? creditData;

    const [isRequestingLocation, setIsRequestingLocation] = useState(false);
    const { mutate: requestLocation } = useCreateLocationRequest(id);

    if (isLoading) return <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
    if (!customer) return <div className="p-8 text-center text-red-500">Customer not found</div>;

    const tierColors: Record<string, string> = { GOLD: "var(--gold)", SILVER: "var(--text-muted)", BRONZE: "var(--orange)" };

    const handleRequestLocation = () => {
        if (!customer?.phone) return;
        setIsRequestingLocation(true);
        requestLocation(undefined, {
            onSuccess: (data) => {
                const message = encodeURIComponent(`Hi ${customer.name}, to ensure your deliveries are always fast and accurate, please click this link to share your exact shop location: ${data.url}`);
                window.open(`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}?text=${message}`, '_blank');
                setIsRequestingLocation(false);
            },
            onError: () => {
                setIsRequestingLocation(false);
            }
        });
    };

    return (
        <div className="space-y-6">
            <Link href="/customers" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--gold)] transition">
                <ArrowLeft size={16} /> Back to Customers
            </Link>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap gap-3">
                {customer.phone && (
                    <>
                        <a href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 text-[var(--whatsapp)] hover:bg-[var(--whatsapp)]/10 hover:border-[var(--whatsapp)]/50 hover:shadow-[0_0_15px_rgba(37,211,102,0.15)] hover:-translate-y-0.5 transition-all duration-300">
                            <MessageCircle size={16} /> WhatsApp
                        </a>
                        <a href={`tel:${customer.phone}`}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 text-[var(--text-primary)] hover:bg-[var(--text-primary)]/10 hover:border-[var(--text-primary)]/20 hover:shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 transition-all duration-300">
                            <Phone size={16} /> Call
                        </a>
                        <button
                            onClick={handleRequestLocation}
                            disabled={isRequestingLocation}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 text-[var(--text-primary)] hover:border-[var(--gold)]/50 hover:shadow-[0_0_15px_rgba(251,191,36,0.15)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:transform-none"
                        >
                            <MapPin size={16} className={isRequestingLocation ? "text-[var(--text-muted)] animate-pulse" : "text-[var(--gold)]"} />
                            {isRequestingLocation ? "Generating..." : "Request Location"}
                        </button>
                    </>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* LEFT SIDEBAR — Customer Info + Payment Score */}
                <div className="w-full lg:w-1/3 space-y-6">
                    {/* Contact Card */}
                    <div className="relative overflow-hidden bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-[var(--radius-lg)] p-6">
                        <div className="absolute top-0 right-0 w-64 h-64 opacity-20 pointer-events-none blur-[60px]" style={{ background: `radial-gradient(circle, ${tierColors[customer.tier] || "var(--gold)"} 0%, transparent 70%)` }} />
                        <div className="relative z-10 flex items-center justify-between mb-4">
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-muted)]" style={{ fontFamily: "var(--font-playfair)" }}>{customer.name}</h1>
                            <div className="flex gap-2">
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-sm border" style={{ backgroundColor: `${tierColors[customer.tier] || "var(--gold)"}15`, color: tierColors[customer.tier] || "var(--gold)", borderColor: `${tierColors[customer.tier] || "var(--gold)"}30` }}>
                                    {customer.tier}
                                </span>
                                <span className="px-2 py-0.5 bg-[var(--text-primary)]/10 text-[var(--text-secondary)] border border-[var(--text-primary)]/20 text-[10px] font-bold rounded-sm">{customer.type}</span>
                            </div>
                        </div>
                        <div className="relative z-10 space-y-3">
                            {customer.phone && <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-default"><Phone size={16} className="text-[var(--gold)]/70" />{customer.phone}</div>}
                            {customer.email && <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-default"><Mail size={16} className="text-[var(--gold)]/70" />{customer.email}</div>}
                            {(customer.city || customer.state) && <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-default"><MapPin size={16} className="text-[var(--gold)]/70" />{customer.city}{customer.state ? `, ${customer.state}` : ""}</div>}
                            {customer.gstNumber && <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-default"><ShieldCheck size={16} className="text-[var(--gold)]/70" />GSTIN: {customer.gstNumber}</div>}
                        </div>
                    </div>

                    {/* Payment Score Card */}
                    {creditScore && (
                        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-lg rounded-[var(--radius-lg)] p-6">
                            <h3 className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase mb-4 font-bold">Payment Score</h3>
                            <PaymentScoreGauge score={creditScore.score ?? customer.paymentScore ?? 0} band={creditScore.band ?? "GREEN"} />
                            <p className="text-xs text-[var(--text-muted)] mt-5 text-center leading-relaxed px-2">{creditScore.recommendation}</p>
                        </div>
                    )}

                    {/* Financial Snapshot */}
                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-lg rounded-[var(--radius-lg)] p-6">
                        <h3 className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase mb-4 font-bold">Financial Snapshot</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center group">
                                <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition flex items-center gap-2"><AlertTriangle size={14} className="text-[var(--red)]/70" /> Outstanding</span>
                                <span className="text-lg font-bold text-[var(--red)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(customer.outstandingAmount ?? 0)}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition flex items-center gap-2"><CreditCard size={14} className="text-[var(--gold)]/70" /> Credit Limit</span>
                                <span className="text-sm font-medium" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(customer.creditLimit ?? 0)}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition flex items-center gap-2"><Clock size={14} className="text-[var(--gold)]/70" /> Credit Days</span>
                                <span className="text-sm font-medium">{customer.creditDays ?? 0} days</span>
                            </div>
                            <div className="border-t border-white/5 pt-3 mt-3">
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition flex items-center gap-2"><TrendingUp size={14} className="text-[var(--green-bright)]/70" /> Lifetime Revenue</span>
                                    <span className="text-sm font-bold text-[var(--green-bright)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(stats?.totalRevenue ?? 0)}</span>
                                </div>
                                <div className="flex justify-between items-center mt-2 group">
                                    <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition">Total Orders</span>
                                    <span className="text-sm font-medium">{stats?.totalOrders ?? 0}</span>
                                </div>
                                <div className="flex justify-between items-center mt-2 group">
                                    <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition">Avg Order Value</span>
                                    <span className="text-sm font-medium" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(stats?.avgOrderValue ?? 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* GPS Location Map */}
                    {customer.latitude && customer.longitude && (
                        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-lg rounded-[var(--radius-lg)] p-6">
                            <h3 className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase mb-4 font-bold flex items-center justify-between">
                                GPS Location
                                <span className="bg-[var(--green-bright)]/10 text-[var(--green-bright)] border border-[var(--green-bright)]/30 px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-[0_0_10px_rgba(0,255,100,0.1)]">
                                    <MapPin size={10} /> Verified
                                </span>
                            </h3>
                            <CustomerMap latitude={customer.latitude} longitude={customer.longitude} customerName={customer.name} />
                        </div>
                    )}
                </div>

                {/* RIGHT MAIN CONTENT */}
                <div className="w-full lg:w-2/3 space-y-6">
                    {/* Payment Ageing */}
                    {paymentSummary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Current", amount: paymentSummary.current, color: "var(--green-bright)" },
                                { label: "30+ Days", amount: paymentSummary.overdue30, color: "var(--warning)" },
                                { label: "60+ Days", amount: paymentSummary.overdue60, color: "var(--orange)" },
                                { label: "90+ Days", amount: paymentSummary.overdue90, color: "var(--red)" },
                            ].map((a) => (
                                <div key={a.label} className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-[var(--radius-md)] p-5 text-center group hover:-translate-y-1 hover:bg-white/[0.04] hover:shadow-xl transition-all duration-300">
                                    <p className="text-[10px] uppercase tracking-widest font-bold mb-2 group-hover:scale-105 transition-transform" style={{ color: a.color }}>{a.label}</p>
                                    <p className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-mono)", color: a.amount > 0 ? a.color : "var(--text-muted)" }}>{formatINR(a.amount ?? 0)}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Recent Orders */}
                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-[var(--radius-lg)] overflow-hidden">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-transparent to-white/[0.01]">
                            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-playfair)" }}>Recent Orders</h2>
                            <Link href={`/orders/new?customer=${customer.id}`} className="px-4 py-2 bg-[var(--gold)] text-black text-xs font-bold rounded-md hover:bg-[var(--gold-light)] hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:-translate-y-0.5 transition-all duration-300">
                                + New Order
                            </Link>
                        </div>
                        <div className="p-2 space-y-1">
                            {/* Header Row */}
                            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 p-3 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-white/5 mx-2">
                                <div>Order #</div>
                                <div>Date</div>
                                <div className="text-right">Amount</div>
                                <div className="text-center">Status</div>
                                <div className="text-right w-20">Actions</div>
                            </div>

                            {recentOrders.length === 0 ? (
                                <div className="p-10 text-center text-[var(--text-muted)] animate-in fade-in">
                                    <Package size={40} className="mx-auto mb-3 opacity-20" />
                                    <p>No orders yet</p>
                                </div>
                            ) : (
                                recentOrders.map((order: any) => (
                                    <div key={order.id} className="group grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 p-3 mx-2 items-center rounded-lg border border-transparent hover:bg-[var(--text-primary)]/5 hover:border-[var(--text-primary)]/10 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 cursor-default">
                                        <div className="font-medium">
                                            <Link href={`/orders/${order.id}`} className="text-[var(--gold)] hover:text-[var(--gold-light)] transition-colors">{order.orderNumber}</Link>
                                        </div>
                                        <div className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{formatDate(order.createdAt)}</div>
                                        <div className="text-sm text-right font-bold tracking-tight group-hover:text-[var(--green-bright)] transition-colors" style={{ fontFamily: "var(--font-mono)" }}>
                                            {formatINR(order.netAmount)}
                                        </div>
                                        <div className="text-center">
                                            <span className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase rounded-md tracking-widest border ${order.status === 'DELIVERED' ? 'bg-[var(--green-bright)]/10 text-[var(--green-bright)] border-[var(--green-bright)]/20 shadow-[inset_0_0_10px_rgba(0,255,100,0.1)]' :
                                                order.status === 'CANCELLED' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                    order.status === 'DRAFT' ? 'bg-[var(--text-primary)]/5 text-[var(--text-secondary)] border-[var(--text-primary)]/10' :
                                                        'bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/20 shadow-[inset_0_0_10px_rgba(251,191,36,0.1)]'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="text-right w-20 flex justify-end">
                                            {order.invoiceId && customer.phone && (
                                                <a href={buildWhatsAppInvoiceLink({
                                                    customerPhone: customer.phone, customerName: customer.name, invoiceNumber: order.orderNumber, invoiceAmount: order.netAmount, invoiceId: order.invoiceId,
                                                })} target="_blank" rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--whatsapp)]/10 text-[var(--whatsapp)] hover:bg-[var(--whatsapp)] hover:text-black hover:shadow-[0_0_12px_rgba(37,211,102,0.4)] hover:-translate-y-0.5 transition-all duration-300" title="Send Invoice">
                                                    <Send size={14} className="ml-[-1px]" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Recent Payments */}
                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-[var(--radius-lg)] overflow-hidden">
                        <div className="p-5 border-b border-white/5 bg-gradient-to-r from-transparent to-white/[0.01]">
                            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-playfair)" }}>Recent Payments</h2>
                        </div>
                        <div className="p-2 space-y-1">
                            <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr] gap-4 p-3 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-white/5 mx-2">
                                <div>Date</div>
                                <div>Method</div>
                                <div className="text-right">Amount</div>
                                <div className="text-right">Reference</div>
                            </div>
                            {recentPayments.length === 0 ? (
                                <div className="p-10 text-center text-[var(--text-muted)]">
                                    <CreditCard size={40} className="mx-auto mb-3 opacity-20" />
                                    <p>No payments recorded</p>
                                </div>
                            ) : (
                                recentPayments.map((p: any) => (
                                    <div key={p.id} className="group grid grid-cols-[1fr_1fr_1fr_1.5fr] gap-4 p-3 mx-2 items-center rounded-lg border border-transparent hover:bg-[var(--text-primary)]/5 hover:border-[var(--text-primary)]/10 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 cursor-default">
                                        <div className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{formatDate(p.paidAt ?? p.createdAt)}</div>
                                        <div><span className="px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">{p.method?.replace("_", " ")}</span></div>
                                        <div className="text-sm text-right font-bold tracking-tight text-[var(--green-bright)] group-hover:drop-shadow-[0_0_8px_rgba(0,255,100,0.3)] transition-all" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(p.amount ?? 0)}</div>
                                        <div className="text-sm text-right text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] truncate transition-colors">{p.referenceNumber ?? "—"}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Customer Activity Feed */}
                    <div className="bg-[var(--text-primary)]/5 backdrop-blur-xl border border-[var(--text-primary)]/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-[var(--radius-lg)] p-8 mt-8 relative overflow-hidden">
                        <div className="absolute top-0 right-1/4 w-96 h-96 opacity-10 pointer-events-none blur-[100px] bg-[var(--gold)] rounded-full mix-blend-screen" />
                        <h2 className="font-semibold text-lg mb-8 flex items-center gap-3 relative z-10" style={{ fontFamily: "var(--font-playfair)" }}>
                            <div className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center border border-[var(--gold)]/20 shadow-[0_0_15px_rgba(251,191,36,0.15)]">
                                <Clock className="text-[var(--gold)]" size={16} />
                            </div>
                            Activity Timeline
                        </h2>

                        <div className="space-y-6 relative z-10 max-h-[600px] overflow-y-auto pr-2">
                            {activityLoading ? (
                                <p className="text-sm text-[var(--text-muted)] animate-pulse">Loading activity trace...</p>
                            ) : activities.length === 0 ? (
                                <div className="text-center py-10 text-[var(--text-muted)]">
                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
                                        <Clock size={24} className="opacity-40" />
                                    </div>
                                    <p className="text-sm tracking-widest uppercase">No temporal traces found</p>
                                </div>
                            ) : (
                                <div className="relative before:absolute before:inset-0 before:ml-[1.125rem] before:-translate-x-px before:h-full before:w-[2px] before:bg-gradient-to-b before:from-[var(--gold)] before:via-[var(--gold)]/20 before:to-transparent">
                                    {activities.map((act: any, i: number) => {
                                        const isOrder = act.type.includes('ORDER');
                                        const isLocation = act.type === 'LOCATION_SHARED';
                                        const colorVar = isOrder ? (act.type === 'ORDER_RETURNED' ? 'var(--orange)' : 'var(--gold)') : isLocation ? 'var(--whatsapp)' : 'var(--green-bright)';
                                        return (
                                            <div key={act.id} className="group relative flex items-start gap-5 mb-8 last:mb-0">
                                                <div className="relative z-10 flex shrink-0 items-center justify-center w-9 h-9 rounded-full bg-[var(--bg-primary)] border-2 transition-transform duration-500 group-hover:scale-110" style={{ borderColor: `${colorVar}40`, boxShadow: `0 0 15px ${colorVar}40` }}>
                                                    {isOrder ? <Package size={14} style={{ color: colorVar }} /> : isLocation ? <MapPin size={14} style={{ color: colorVar }} /> : <CreditCard size={14} style={{ color: colorVar }} />}
                                                </div>
                                                <div className="flex-1 bg-[var(--bg-card)] rounded-[var(--radius-lg)] p-5 border border-[var(--border)] shadow-sm hover:bg-[var(--bg-card-hover)] hover:-translate-y-0.5 transition-all duration-300">
                                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                                                        <h4 className="font-semibold text-[var(--text-primary)] text-sm tracking-wide">{act.title}</h4>
                                                        <time className="text-[10px] uppercase tracking-widest text-[var(--gold)]/70 font-medium bg-[var(--gold)]/5 px-2 py-1 rounded border border-[var(--gold)]/10">
                                                            {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                                                        </time>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
                                                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{act.description}</p>
                                                        {(act.amount !== null && act.amount > 0) ? (
                                                            <div className="flex items-center gap-3 shrink-0">
                                                                <span className="text-[10px] font-bold px-2 py-1 rounded-sm bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 uppercase tracking-widest text-[var(--text-secondary)]">
                                                                    {act.status}
                                                                </span>
                                                                <span className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-mono)", color: colorVar, textShadow: `0 0 10px ${colorVar}40` }}>
                                                                    {act.type.includes('PAYMENT') ? '+' : ''}{formatINR(act.amount)}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-[10px] font-bold px-2 py-1 rounded-sm bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 uppercase tracking-widest" style={{ color: colorVar }}>
                                                                    {act.status}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
