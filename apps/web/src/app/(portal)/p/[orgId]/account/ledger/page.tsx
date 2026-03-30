"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, ArrowLeft, CreditCard, ArrowUpRight, ArrowDownLeft, LogIn } from "lucide-react";
import { usePortalOrgId, usePortalAuth, portalApi } from "@/contexts/portal-context";

export default function LedgerPage() {
    const orgId = usePortalOrgId();
    const auth = usePortalAuth();

    const { data: ledger, isLoading } = useQuery({
        queryKey: ["portal-ledger", orgId],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/ledger`, auth.token),
        enabled: auth.isAuthenticated,
    });

    if (!auth.isAuthenticated) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center text-center">
                <LogIn className="w-12 h-12 text-zinc-600 mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
                <p className="text-sm text-zinc-500">Login to view your ledger</p>
            </div>
        );
    }

    if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" /></div>;
    if (!ledger) return <div className="text-center py-16 text-zinc-500">Could not load ledger data</div>;

    const creditUsedPercent = Math.min((ledger.outstandingAmount / Math.max(ledger.creditLimit, 1)) * 100, 100);

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            <Link href={`/p/${orgId}/account`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[var(--gold)] mb-4 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Account
            </Link>

            <h1 className="text-xl font-bold text-white mb-6">Ledger & Credit</h1>

            {/* Balance Card */}
            <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#222] rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Outstanding Balance</p>
                        <p className="text-3xl font-bold font-mono text-white">₹{ledger.outstandingAmount.toLocaleString("en-IN")}</p>
                    </div>
                </div>

                {ledger.creditLimit > 0 && (
                    <div>
                        <div className="flex justify-between text-xs text-zinc-500 mb-2">
                            <span>₹{ledger.outstandingAmount.toLocaleString("en-IN")} used</span>
                            <span>₹{ledger.creditLimit.toLocaleString("en-IN")} limit</span>
                        </div>
                        <div className="h-3 bg-[#222] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${creditUsedPercent}%`,
                                    background: creditUsedPercent > 80
                                        ? "linear-gradient(90deg, #ef4444, #dc2626)"
                                        : creditUsedPercent > 50
                                            ? "linear-gradient(90deg, #f59e0b, #d97706)"
                                            : "linear-gradient(90deg, var(--gold), #ca8a04)",
                                }}
                            />
                        </div>
                        <p className="text-xs text-zinc-400 mt-2">
                            Available credit: <span className="text-white font-mono font-medium">₹{(ledger.creditLimit - ledger.outstandingAmount).toLocaleString("en-IN")}</span>
                        </p>
                    </div>
                )}
            </div>

            {/* Transaction History */}
            <h2 className="text-lg font-bold text-white mb-4">Recent Transactions</h2>
            {ledger.recentOrders.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">No transactions yet</div>
            ) : (
                <div className="space-y-2">
                    {ledger.recentOrders.map((order: any) => (
                        <Link
                            key={order.id}
                            href={`/p/${orgId}/account/orders/${order.id}`}
                            className="flex items-center gap-4 p-4 bg-[#111] border border-[#222] rounded-xl hover:border-[#333] transition-colors"
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${order.status === "CANCELLED" || order.status === "RETURNED" ? "bg-green-900/20" : "bg-red-900/20"}`}>
                                {order.status === "CANCELLED" || order.status === "RETURNED" ? (
                                    <ArrowDownLeft className="w-5 h-5 text-green-400" />
                                ) : (
                                    <ArrowUpRight className="w-5 h-5 text-red-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-200">{order.orderNumber}</p>
                                <p className="text-xs text-zinc-500">
                                    {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                    {" · "}{order.status}
                                </p>
                            </div>
                            <span className={`text-sm font-bold font-mono ${order.status === "CANCELLED" || order.status === "RETURNED" ? "text-green-400" : "text-red-400"}`}>
                                {order.status === "CANCELLED" || order.status === "RETURNED" ? "+" : "-"}₹{order.totalAmount.toLocaleString("en-IN")}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
