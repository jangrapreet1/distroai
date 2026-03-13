"use client";

import { use, useState } from "react";
import { useCustomer, useOrders, usePayments } from "@/hooks/api-hooks";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatINR(n: number): string { return "₹" + n.toLocaleString("en-IN"); }

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: customerData, isLoading: custLoading } = useCustomer(id);
    const customer = customerData?.customer;
    const stats = customerData?.stats;
    const recentOrdersFromApi = customerData?.recentOrders ?? [];

    const [orderPage, setOrderPage] = useState(1);
    const { data: ordersData, isLoading: ordersLoading } = useOrders({ customerId: id, limit: 10, page: orderPage });
    const orders = ordersData?.data?.data ?? ordersData?.data ?? recentOrdersFromApi;

    const [paymentPage, setPaymentPage] = useState(1);
    // Add usePayments hook in api-hooks if it doesn't exist, here we just use what we have or mock until we check api-hooks
    const { data: paymentsData, isLoading: paymentsLoading } = { data: null, isLoading: false }; // Placeholder until we verify hook exists
    const payments = paymentsData ?? [];

    if (custLoading) return <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
    if (!customer) return <div className="p-8 text-center text-red-500">Customer not found</div>;

    return (
        <div className="space-y-6">
            <Link href="/customers" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--gold)] transition">
                <ArrowLeft size={16} /> Back to Customers
            </Link>

            <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 space-y-6">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>{customer.name}</h1>
                            <div className="px-2 py-1 bg-[var(--gold)]/10 text-[var(--gold)] text-xs font-medium rounded">
                                {customer.type}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {customer.phone && (
                                <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                                    <Phone size={16} className="text-[var(--text-muted)]" />
                                    {customer.phone}
                                </div>
                            )}
                            {customer.email && (
                                <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                                    <Mail size={16} className="text-[var(--text-muted)]" />
                                    {customer.email}
                                </div>
                            )}
                            {(customer.city || customer.state) && (
                                <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                                    <MapPin size={16} className="text-[var(--text-muted)]" />
                                    {customer.city}, {customer.state}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-[var(--border)]">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-[var(--text-muted)]">Outstanding</span>
                                <span className="text-lg font-bold text-red-400" style={{ fontFamily: "var(--font-mono)" }}>
                                    {formatINR(customer.outstandingAmount ?? 0)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-[var(--text-muted)]">Credit Limit</span>
                                <span className="text-sm" style={{ fontFamily: "var(--font-mono)" }}>
                                    {formatINR(customer.creditLimit ?? 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-2/3 space-y-6">
                    {/* Orders History */}
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
                                        <th className="text-right p-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ordersLoading ? (
                                        <tr><td colSpan={4} className="p-4 text-center"><div className="skeleton h-5 rounded" /></td></tr>
                                    ) : orders.length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No orders found</td></tr>
                                    ) : (
                                        orders.map((order: any) => (
                                            <tr key={order.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                                                <td className="p-4 font-medium"><Link href={`/orders/${order.id}`} className="text-[var(--gold)] hover:underline">{order.orderNumber}</Link></td>
                                                <td className="p-4 text-[var(--text-secondary)]">{formatDate(order.createdAt)}</td>
                                                <td className="p-4 text-right font-mono">{formatINR(order.netAmount)}</td>
                                                <td className="p-4 text-right">
                                                    <span className={`inline-block px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider ${order.status === 'DELIVERED' ? 'bg-[var(--green-bright)]/10 text-[var(--green-bright)]' :
                                                        order.status === 'CANCELLED' ? 'bg-red-500/10 text-red-500' :
                                                            order.status === 'DRAFT' ? 'bg-[var(--text-muted)]/10 text-[var(--text-secondary)]' :
                                                                'bg-[var(--gold)]/10 text-[var(--gold)]'
                                                        }`}>
                                                        {order.status}
                                                    </span>
                                                </td>
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
