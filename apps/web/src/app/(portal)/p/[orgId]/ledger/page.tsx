"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

export default function LedgerPage({ params }: { params: Promise<{ orgId: string }> | { orgId: string } }) {
    const resolvedParams = params as any;
    const orgId = resolvedParams.then ? use(resolvedParams as Promise<{ orgId: string }>).orgId : resolvedParams.orgId;
    const router = useRouter();
    const [token, setToken] = useState<string | null>(null);

    // Retrieve token from local storage or context (We stored it in memory in the storefront, 
    // but in a real app we'd use cookies/localStorage. For this demo, let's assume it's passed or stored).
    // To make this simple, if there's no token, we redirect to the storefront.
    useEffect(() => {
        // Ideally fetch from localStorage. We'll add a quick check.
        // For Phase 8 demo, we assume the user just logged in on the storefront.
        // Actually, since we didn't persist the token in localStorage in the storefront page, 
        // let's just show an error if they land here without auth, or we'll allow them to go back.
        const storedToken = localStorage.getItem(`portal_token_${orgId}`);
        if (storedToken) {
            setToken(storedToken);
        }
    }, [orgId]);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['portal-ledger', orgId, token],
        queryFn: async () => {
            if (!token) throw new Error("Not logged in");
            const res = await fetch(`/api/v1/portal/${orgId}/ledger`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch ledger");
            const json = await res.json();
            return json.data !== undefined ? json.data : json;
        },
        enabled: !!token,
        retry: false
    });

    if (!token && typeof window !== 'undefined') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
                <p className="text-zinc-400 mb-6">You must be logged in as a registered retailer to view your ledger.</p>
                <button
                    onClick={() => router.push(`/p/${orgId}`)}
                    className="bg-[var(--gold)] text-black px-6 py-2 rounded-lg font-semibold hover:bg-[#eab308] transition-colors"
                >
                    Return to Storefront
                </button>
            </div>
        );
    }

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" /></div>;
    }

    if (isError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 px-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-lg">Failed to load ledger. Your session might have expired.</p>
                <button onClick={() => router.push(`/p/${orgId}`)} className="mt-4 underline text-[var(--gold)]">Back to Store</button>
            </div>
        );
    }

    const { outstandingAmount, creditLimit, recentOrders } = data.data || data;

    return (
        <div className="min-h-screen bg-[#050505] text-[#f4f4f5]">
            <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#050505]/80 border-b border-[#222]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
                    <button onClick={() => router.push(`/p/${orgId}`)} className="p-2 -ml-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-bold tracking-tight text-white">Your Ledger</h1>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8 py-8">
                {/* Outstanding Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#222] rounded-xl p-6">
                        <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Total Outstanding</p>
                        <h2 className="text-4xl font-bold font-mono text-[var(--gold)]">₹{outstandingAmount.toLocaleString('en-IN')}</h2>
                        <p className="text-xs text-zinc-500 mt-2">Please clear dues within 15 days to avoid account hold.</p>
                    </div>
                    <div className="bg-[#111] border border-[#222] rounded-xl p-6">
                        <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Available Credit Limit</p>
                        <h2 className="text-4xl font-bold font-mono text-white">₹{Math.max(0, creditLimit - outstandingAmount).toLocaleString('en-IN')}</h2>
                        <div className="w-full bg-black h-2 rounded-full mt-4 overflow-hidden border border-[#333]">
                            <div
                                className="h-full bg-[var(--gold)]"
                                style={{ width: `${Math.min(100, (outstandingAmount / (creditLimit || 1)) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Recent Orders */}
                <div>
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-[#222] pb-2">Recent Orders</h3>
                    <div className="bg-[#111] border border-[#222] rounded-[var(--radius-lg)] overflow-hidden">
                        {recentOrders.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">No recent orders found on this ledger.</div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-black/50 text-zinc-400 uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4 font-medium tracking-wider">Date</th>
                                        <th className="px-6 py-4 font-medium tracking-wider">Order ID</th>
                                        <th className="px-6 py-4 font-medium tracking-wider text-right">Amount</th>
                                        <th className="px-6 py-4 font-medium tracking-wider text-center">Status</th>
                                        <th className="px-6 py-4 font-medium tracking-wider text-center">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#222]">
                                    {recentOrders.map((order: any) => (
                                        <tr key={order.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-zinc-300">
                                                {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 text-white font-medium">{order.orderNumber}</td>
                                            <td className="px-6 py-4 font-medium text-right font-mono text-[var(--gold)]">
                                                ₹{order.totalAmount.toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-white/10 text-white`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button className="p-1.5 text-zinc-400 hover:text-[var(--gold)] hover:bg-[var(--gold)]/10 rounded transition">
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
