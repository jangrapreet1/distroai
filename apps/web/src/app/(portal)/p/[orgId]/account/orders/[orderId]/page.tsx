"use client";

import { use } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, RotateCcw, CheckCircle2, Circle, Package, LogIn } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePortalOrgId, usePortalAuth, usePortalCart, portalApi } from "@/contexts/portal-context";

const STATUS_ORDER = ["DRAFT", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"];

const STATUS_ICONS: Record<string, string> = {
    CONFIRMED: "🛒",
    PACKED: "📦",
    DISPATCHED: "🚚",
    DELIVERED: "✅",
    CANCELLED: "❌",
};

export default function OrderDetailPage({
    params,
}: {
    params: Promise<{ orgId: string; orderId: string }> | { orgId: string; orderId: string };
}) {
    const resolvedParams = params as any;
    const orderId = resolvedParams.then
        ? use(resolvedParams as Promise<{ orderId: string }>).orderId
        : resolvedParams.orderId;

    const orgId = usePortalOrgId();
    const auth = usePortalAuth();
    const cart = usePortalCart();
    const router = useRouter();

    const { data: order, isLoading } = useQuery({
        queryKey: ["portal-order-detail", orgId, orderId],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/orders/${orderId}`, auth.token),
        enabled: auth.isAuthenticated,
    });

    const reorderMutation = useMutation({
        mutationFn: () => portalApi.get(`/api/v1/portal/${orgId}/reorder/${orderId}`, auth.token),
        onSuccess: (items: any[]) => {
            items.forEach((item) => {
                for (let i = 0; i < item.quantity; i++) {
                    cart.addItem({
                        id: item.productId, name: item.name, price: item.price,
                        originalPrice: item.originalPrice, imageUrl: item.imageUrl,
                        category: item.category, unit: item.unit, isB2B: true,
                    });
                }
            });
            toast.success("Items added to cart!");
            router.push(`/p/${orgId}/cart`);
        },
    });

    if (!auth.isAuthenticated) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center text-center">
                <LogIn className="w-12 h-12 text-zinc-600 mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
            </div>
        );
    }

    if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" /></div>;
    if (!order) return <div className="text-center py-16 text-zinc-500">Order not found</div>;

    const currentStatusIndex = STATUS_ORDER.indexOf(order.status);

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            <Link href={`/p/${orgId}/account/orders`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[var(--gold)] mb-4 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Orders
            </Link>

            {/* Order Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-white">{order.orderNumber}</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">
                        Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                </div>
                <button
                    onClick={() => reorderMutation.mutate()}
                    disabled={reorderMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[var(--gold)] rounded-lg text-sm font-medium hover:bg-[var(--gold)]/20 transition-colors shrink-0"
                >
                    {reorderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    Reorder
                </button>
            </div>

            {/* Status Timeline */}
            {order.status !== "CANCELLED" && order.status !== "RETURNED" && (
                <div className="bg-[#111] border border-[#222] rounded-xl p-5 mb-6">
                    <h3 className="text-sm font-semibold text-white mb-4">Order Status</h3>
                    <div className="flex items-center justify-between relative">
                        {/* Progress bar */}
                        <div className="absolute left-0 right-0 top-4 h-0.5 bg-[#333]" />
                        <div
                            className="absolute left-0 top-4 h-0.5 bg-[var(--gold)] transition-all duration-500"
                            style={{ width: `${(currentStatusIndex / (STATUS_ORDER.length - 1)) * 100}%` }}
                        />

                        {STATUS_ORDER.map((status, idx) => {
                            const isPast = idx <= currentStatusIndex;
                            const isCurrent = idx === currentStatusIndex;
                            return (
                                <div key={status} className="relative flex flex-col items-center z-10 w-16">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all ${isCurrent ? "bg-[var(--gold)] border-[var(--gold)] text-black scale-110 shadow-[0_0_15px_rgba(234,179,8,0.4)]" : isPast ? "bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)]" : "bg-[#111] border-[#333] text-zinc-600"}`}>
                                        {isPast ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                    </div>
                                    <span className={`text-[10px] mt-2 font-medium ${isCurrent ? "text-[var(--gold)]" : isPast ? "text-zinc-300" : "text-zinc-600"}`}>
                                        {status}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* History */}
                    {order.statusHistory?.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-[#222] space-y-2">
                            {order.statusHistory.map((h: any) => (
                                <div key={h.id} className="flex items-center gap-3 text-xs">
                                    <span className="text-base">{STATUS_ICONS[h.toStatus] || "📋"}</span>
                                    <span className="text-zinc-400">
                                        {new Date(h.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{" "}
                                        {new Date(h.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    <span className="text-zinc-300 font-medium">{h.toStatus}</span>
                                    {h.note && <span className="text-zinc-500">— {h.note}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Order Items */}
            <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden mb-6">
                <div className="p-4 border-b border-[#222]">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-[var(--gold)]" /> Items ({order.items.length})
                    </h3>
                </div>
                <div className="divide-y divide-[#222]">
                    {order.items.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-4 p-4">
                            <div className="w-12 h-12 bg-[#0a0a0a] rounded-lg border border-[#222] p-1 flex items-center justify-center shrink-0">
                                {item.product.imageUrl ? (
                                    <img src={item.product.imageUrl} className="max-w-full max-h-full object-contain" alt="" />
                                ) : (
                                    <span className="text-zinc-600 font-bold text-xs">{item.product.name.charAt(0)}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-200 truncate">{item.product.name}</p>
                                <p className="text-xs text-zinc-500">{item.product.category} · {item.product.unit}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-mono text-white">₹{item.totalAmount.toLocaleString("en-IN")}</p>
                                <p className="text-xs text-zinc-500">{item.quantity} × ₹{item.price.toLocaleString("en-IN")}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total */}
                <div className="p-4 border-t border-[#333] bg-[#0a0a0a]">
                    <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-medium">Total</span>
                        <span className="text-xl font-bold font-mono text-[var(--gold)]">₹{order.totalAmount.toLocaleString("en-IN")}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
