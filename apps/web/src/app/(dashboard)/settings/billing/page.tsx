"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useSubscription } from "@/hooks/api-hooks";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import { SettingsLayout } from "@/components/ui/settings-layout";

const loadRazorpay = () => {
    return new Promise((resolve) => {
        if ((window as any).Razorpay) return resolve(true);
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

function BillingTab() {
    const { data: subData, refetch: refetchSub } = useSubscription();
    const sub = subData?.data ?? subData ?? {};
    const [upgrading, setUpgrading] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const accessToken = useAuthStore((s) => s.accessToken);
    const [isAnnual, setIsAnnual] = useState(false);

    const plans = [
        { name: "FREE", price: "₹0", priceNum: 0, period: "forever", features: ["1 user", "50 products", "Basic dashboard"], recommended: false },
        { name: "STARTER", price: isAnnual ? "₹4,990" : "₹499", priceNum: isAnnual ? 4990 : 499, period: isAnnual ? "/yr" : "/mo", features: ["5 users", "500 products", "Tally Sync", "AI queries"], recommended: false },
        { name: "GROWTH", price: isAnnual ? "₹8,990" : "₹899", priceNum: isAnnual ? 8990 : 899, period: isAnnual ? "/yr" : "/mo", features: ["10 users", "Unlimited products", "Advanced Analytics", "Salesman App", "WhatsApp Bot"], recommended: true },
        { name: "ENTERPRISE", price: "Starts at ₹2,999", priceNum: 2999, period: "/mo", features: ["Unlimited users", "Dedicated support", "Custom integrations", "SLA guarantee"], recommended: false },
    ];

    const currentPlan = (sub?.plan ?? "FREE").toUpperCase();

    const handleUpgrade = async (planName: string) => {
        if (planName === "ENTERPRISE") { toast("Contact sales at sales@distroai.in", { icon: "📧" }); return; }
        if (planName === "FREE") return;
        setUpgrading(planName);
        try {
            const loaded = await loadRazorpay();
            if (!loaded) { toast.error("Failed to load payment gateway."); return; }
            const res = await fetch("/api/v1/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ plan: planName, isAnnual }),
            });
            const json = await res.json();
            const data = json.data ?? json;
            if (!res.ok) { toast.error(data?.message || "Failed to create checkout"); return; }

            const options = {
                key: data.razorpayKeyId, amount: data.amount, currency: data.currency,
                name: "DistroAI", description: data.planLabel, order_id: data.orderId,
                handler: async (response: any) => {
                    try {
                        const verifyRes = await fetch("/api/v1/billing/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                            body: JSON.stringify({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, plan: planName, isAnnual }),
                        });
                        const verifyJson = await verifyRes.json();
                        if (verifyRes.ok) { toast.success(`Upgraded to ${planName}! 🎉`); refetchSub(); }
                        else { toast.error(verifyJson?.data?.message || "Payment verification failed"); }
                    } catch { toast.error("Payment verification failed"); }
                },
                prefill: { email: sub?.email || "" },
                theme: { color: "#a855f7" },
                modal: { ondismiss: () => setUpgrading(null) },
            };
            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch { toast.error("Failed to initiate checkout"); }
        finally { setUpgrading(null); }
    };

    const handleCancel = async () => {
        if (!confirm("Are you sure you want to cancel your subscription? You'll be downgraded to the Free plan.")) return;
        setCancelling(true);
        try {
            const res = await fetch("/api/v1/billing/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            });
            if (res.ok) { toast.success("Subscription cancelled."); refetchSub(); }
            else { const json = await res.json(); toast.error(json?.data?.message || "Failed to cancel"); }
        } catch { toast.error("Failed to cancel subscription"); }
        finally { setCancelling(false); }
    };

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border-accent)] rounded-[var(--radius-md)] p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="font-semibold text-lg">Current Plan: <span className="text-[var(--gold)]">{currentPlan}</span></h2>
                        <p className="text-sm text-[var(--text-muted)]">Status: {sub?.subscription?.status ?? "Active"}</p>
                        {sub?.subscription?.currentPeriodEnd && (
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                Renews: {new Date(sub.subscription.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                        )}
                    </div>
                    {currentPlan !== "FREE" && (
                        <button onClick={handleCancel} disabled={cancelling}
                            className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-red-500/30 text-red-400 hover:bg-red-500/10 transition disabled:opacity-50">
                            {cancelling ? "Cancelling..." : "Cancel Subscription"}
                        </button>
                    )}
                </div>
                {sub?.limits && Object.entries(sub.limits as Record<string, { current: number; max: number }>).map(([k, v]) => (
                    <div key={k} className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-secondary)] capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                            <span style={{ fontFamily: "var(--font-mono)" }}>{v.current}/{v.max === 999999 ? "∞" : v.max}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--border)]">
                            <div className="h-full rounded-full transition-all"
                                style={{ width: `${v.max === 999999 ? 5 : Math.min((v.current / v.max) * 100, 100)}%`, backgroundColor: (v.current / v.max) > 0.8 ? 'var(--red)' : 'var(--gold)' }} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-center items-center gap-4 mb-4 mt-8">
                <span className={`text-sm font-medium ${!isAnnual ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>Monthly</span>
                <button type="button" onClick={() => setIsAnnual(!isAnnual)} className="w-12 h-6 rounded-full bg-[var(--purple)] p-1 relative transition-colors focus:outline-none">
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${isAnnual ? "left-[26px]" : "left-1"}`} />
                </button>
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isAnnual ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>Annually</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--purple)]/15 text-[var(--purple)]">2 Months Free</span>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((p) => {
                    const isCurrent = currentPlan === p.name;
                    const isDowngrade = plans.findIndex(pl => pl.name === currentPlan) > plans.findIndex(pl => pl.name === p.name);
                    return (
                        <div key={p.name} className={`bg-[var(--bg-card)] border rounded-[var(--radius-md)] p-5 relative ${p.recommended ? "border-[var(--gold)] ring-1 ring-[var(--gold)]/20" : "border-[var(--border)]"} ${isCurrent ? "ring-2 ring-[var(--purple)]/30" : ""}`}>
                            {p.recommended && <p className="text-[10px] text-[var(--gold)] font-semibold mb-2 tracking-wider">⭐ RECOMMENDED</p>}
                            {isCurrent && <p className="text-[10px] text-[var(--purple)] font-semibold mb-2 tracking-wider">✓ CURRENT PLAN</p>}
                            <h3 className="font-bold mb-1">{p.name}</h3>
                            <div className="flex items-baseline gap-1 mb-3">
                                <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>{p.price}</span>
                                {p.period && <span className="text-xs text-[var(--text-muted)]">{p.period}</span>}
                            </div>
                            <ul className="space-y-1.5 mb-5">
                                {p.features.map((f) => (
                                    <li key={f} className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                                        <Check size={12} className="text-[var(--green-bright)] shrink-0" />{f}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => !isCurrent && handleUpgrade(p.name)} disabled={isCurrent || isDowngrade || upgrading === p.name}
                                className={`w-full py-2.5 text-sm rounded-[var(--radius-md)] transition font-medium ${isCurrent ? "bg-[var(--purple)]/15 text-[var(--purple)] border border-[var(--purple)]/20 cursor-default" : isDowngrade ? "border border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed opacity-50" : p.recommended ? "bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)]" : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"}`}>
                                {isCurrent ? "Current Plan" : upgrading === p.name ? "Processing..." : p.name === "ENTERPRISE" ? "Contact Sales" : isDowngrade ? "Downgrade" : "Upgrade"}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function BillingSettingsPage() {
    return (
        <SettingsLayout title="Billing & Plans" description="Manage your subscription, compare plans, and upgrade or downgrade your account.">
            <BillingTab />
        </SettingsLayout>
    );
}
