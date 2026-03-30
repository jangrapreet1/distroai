"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, ArrowLeft, LogIn } from "lucide-react";
import { usePortalOrgId, usePortalAuth, portalApi } from "@/contexts/portal-context";

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "text-zinc-400 bg-zinc-800",
    CONFIRMED: "text-blue-400 bg-blue-900/40",
    PACKED: "text-purple-400 bg-purple-900/40",
    DISPATCHED: "text-orange-400 bg-orange-900/40",
    DELIVERED: "text-green-400 bg-green-900/40",
    CANCELLED: "text-red-400 bg-red-900/40",
    RETURNED: "text-red-400 bg-red-900/40",
};

export default function OrdersPage() {
    const orgId = usePortalOrgId();
    const auth = usePortalAuth();

    const { data: orders, isLoading } = useQuery({
        queryKey: ["portal-orders", orgId],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/orders`, auth.token),
        enabled: auth.isAuthenticated,
    });

    if (!auth.isAuthenticated) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center text-center">
                <LogIn className="w-12 h-12 text-zinc-600 mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
                <p className="text-sm text-zinc-500">Login to view your order history</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            <Link href={`/p/${orgId}/account`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[var(--gold)] mb-4 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Account
            </Link>

            <h1 className="text-xl font-bold text-white mb-6">Order History</h1>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" /></div>
            ) : !orders || orders.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                    <p className="mb-2">No orders yet</p>
                    <Link href={`/p/${orgId}`} className="text-[var(--gold)] text-sm hover:underline">Browse catalog →</Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {orders.map((order: any) => (
                        <Link
                            key={order.id}
                            href={`/p/${orgId}/account/orders/${order.id}`}
                            className="block bg-[#111] border border-[#222] hover:border-[var(--gold)]/30 rounded-xl p-4 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white">{order.orderNumber}</p>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                        {" · "}{order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                                    </p>
                                    {order.deliveryDate && (
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            Delivery: {new Date(order.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-base font-bold font-mono text-white">₹{order.totalAmount.toLocaleString("en-IN")}</p>
                                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 ${STATUS_COLORS[order.status] || "text-zinc-400 bg-zinc-800"}`}>
                                        {order.status}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
