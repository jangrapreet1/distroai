"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag, CreditCard, RotateCcw, ArrowRight, LogIn } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePortalOrgId, usePortalAuth, usePortalCart, portalApi } from "@/contexts/portal-context";

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "text-zinc-400 bg-zinc-800",
    CONFIRMED: "text-blue-400 bg-blue-900/40",
    PACKED: "text-purple-400 bg-purple-900/40",
    DISPATCHED: "text-orange-400 bg-orange-900/40",
    DELIVERED: "text-green-400 bg-green-900/40",
    CANCELLED: "text-red-400 bg-red-900/40",
    RETURNED: "text-red-400 bg-red-900/40",
};

export default function AccountPage() {
    const orgId = usePortalOrgId();
    const auth = usePortalAuth();
    const cart = usePortalCart();
    const router = useRouter();

    const { data: ledger, isLoading: isLoadingLedger } = useQuery({
        queryKey: ["portal-ledger", orgId],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/ledger`, auth.token),
        enabled: auth.isAuthenticated,
    });

    const { data: orders, isLoading: isLoadingOrders } = useQuery({
        queryKey: ["portal-orders", orgId],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/orders`, auth.token),
        enabled: auth.isAuthenticated,
    });

    const reorderMutation = useMutation({
        mutationFn: (orderId: string) =>
            portalApi.get(`/api/v1/portal/${orgId}/reorder/${orderId}`, auth.token),
        onSuccess: (items: any[]) => {
            items.forEach((item) => {
                for (let i = 0; i < item.quantity; i++) {
                    cart.addItem({
                        id: item.productId,
                        name: item.name,
                        price: item.price,
                        originalPrice: item.originalPrice,
                        imageUrl: item.imageUrl,
                        category: item.category,
                        unit: item.unit,
                        isB2B: true,
                    });
                }
            });
            toast.success("Items added to cart!");
            router.push(`/p/${orgId}/cart`);
        },
        onError: () => toast.error("Failed to reorder"),
    });

    if (!auth.isAuthenticated) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center text-center">
                <LogIn className="w-12 h-12 text-zinc-600 mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
                <p className="text-sm text-zinc-500">Login as a registered retailer to access your account</p>
            </div>
        );
    }

    const creditUsedPercent = ledger ? Math.min((ledger.outstandingAmount / Math.max(ledger.creditLimit, 1)) * 100, 100) : 0;
    const recentOrders = orders?.slice(0, 5) || [];

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* Welcome */}
            <div>
                <h1 className="text-2xl font-bold text-white">Welcome, {auth.customer?.name}</h1>
                <p className="text-sm text-zinc-500 mt-1">Manage your orders, ledger, and reorder easily</p>
            </div>

            {/* Credit & Balance Cards */}
            {isLoadingLedger || isLoadingOrders ? (
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#222] rounded-xl p-5 animate-pulse min-h-[140px]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-[#222]" />
                            <div className="space-y-2">
                                <div className="h-3 w-24 bg-[#222] rounded" />
                                <div className="h-6 w-32 bg-[#222] rounded" />
                            </div>
                        </div>
                        <div className="mt-6 space-y-2">
                            <div className="flex justify-between"><div className="h-3 w-16 bg-[#222] rounded" /><div className="h-3 w-16 bg-[#222] rounded" /></div>
                            <div className="h-2 w-full bg-[#222] rounded-full" />
                        </div>
                    </div>
                    <div className="bg-[#111] border border-[#222] rounded-xl p-5 animate-pulse min-h-[140px]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#222]" />
                            <div className="space-y-2">
                                <div className="h-3 w-20 bg-[#222] rounded" />
                                <div className="h-6 w-12 bg-[#222] rounded" />
                            </div>
                        </div>
                        <div className="mt-6 pt-3 border-t border-[#222] space-y-2">
                            <div className="h-3 w-24 bg-[#222] rounded" />
                            <div className="h-10 w-full bg-[#222] rounded-lg mt-2" />
                        </div>
                    </div>
                </div>
            ) : ledger && (
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Outstanding Balance</p>
                                <p className="text-2xl font-bold font-mono text-white">₹{ledger.outstandingAmount.toLocaleString("en-IN")}</p>
                            </div>
                        </div>
                        {/* Credit Gauge */}
                        {ledger.creditLimit > 0 && (
                            <div>
                                <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                                    <span>Credit Used</span>
                                    <span>₹{ledger.creditLimit.toLocaleString("en-IN")} limit</span>
                                </div>
                                <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${creditUsedPercent}%`,
                                            background: creditUsedPercent > 80 ? "#ef4444" : creditUsedPercent > 50 ? "#f59e0b" : "var(--gold)",
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center">
                                <ShoppingBag className="w-5 h-5 text-[var(--gold)]" />
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Orders</p>
                                <p className="text-2xl font-bold font-mono text-white">{orders?.length ?? "—"}</p>
                            </div>
                        </div>
                        {recentOrders[0] && (
                            <div className="mt-4 pt-3 border-t border-[#222]">
                                <p className="text-xs text-zinc-500 mb-2">Quick Reorder</p>
                                <button
                                    onClick={() => reorderMutation.mutate(recentOrders[0].id)}
                                    disabled={reorderMutation.isPending}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[var(--gold)] rounded-lg text-sm font-medium hover:bg-[var(--gold)]/20 transition-colors"
                                >
                                    {reorderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                    Reorder Last Order
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Recent Orders */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">Recent Orders</h2>
                    <Link href={`/p/${orgId}/account/orders`} className="text-sm text-[var(--gold)] hover:underline flex items-center gap-1">
                        View All <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                {isLoadingOrders ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-[#111] border border-[#222] rounded-xl p-4 animate-pulse">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-2">
                                        <div className="h-4 w-24 bg-[#222] rounded" />
                                        <div className="h-3 w-32 bg-[#222] rounded" />
                                    </div>
                                    <div className="space-y-2 text-right">
                                        <div className="h-4 w-20 bg-[#222] rounded ml-auto" />
                                        <div className="h-4 w-16 bg-[#222] rounded-full ml-auto" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : recentOrders.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">No orders yet. Start shopping!</div>
                ) : (
                    <div className="space-y-3">
                        {recentOrders.map((order: any) => (
                            <Link
                                key={order.id}
                                href={`/p/${orgId}/account/orders/${order.id}`}
                                className="block bg-[#111] border border-[#222] hover:border-[#333] rounded-xl p-4 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-white">{order.orderNumber}</p>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                            {" · "}{order.itemCount} items
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold font-mono text-white">₹{order.totalAmount.toLocaleString("en-IN")}</p>
                                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${STATUS_COLORS[order.status] || "text-zinc-400 bg-zinc-800"}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
