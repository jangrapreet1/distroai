"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, Check, Rocket } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import { useUpgradeStore } from "@/stores/upgrade.store";
import { useSubscription } from "@/hooks/api-hooks";

export function UpgradeModal() {
    const pathname = usePathname();
    const router = useRouter();
    const { isOpen, featureRequested, closeModal } = useUpgradeStore();
    const { data: subData, refetch: refetchSub } = useSubscription();
    const sub = subData?.data ?? subData ?? {};
    const [upgrading, setUpgrading] = useState<string | null>(null);
    const accessToken = useAuthStore((s) => s.accessToken);
    const [isAnnual, setIsAnnual] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const loadRazorpay = () => {
            if ((window as any).Razorpay) return;
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            document.body.appendChild(script);
        };
        loadRazorpay();
    }, [isOpen]);

    if (!isOpen) return null;

    const plans = [
        { name: "STARTER", price: isAnnual ? "₹4,990" : "₹499", priceNum: isAnnual ? 4990 : 499, period: isAnnual ? "/yr" : "/mo", features: ["5 users", "500 products", "B2B Customer Portal", "Tally Sync", "AI queries"], recommended: false },
        { name: "GROWTH", price: isAnnual ? "₹8,990" : "₹899", priceNum: isAnnual ? 8990 : 899, period: isAnnual ? "/yr" : "/mo", features: ["10 users", "Unlimited products", "Advanced Analytics", "Salesman App", "WhatsApp Bot"], recommended: true },
        { name: "ENTERPRISE", price: "Custom", priceNum: 2999, period: "", features: ["Unlimited users", "Dedicated support", "Custom integrations"], recommended: false },
    ];

    const currentPlan = (sub?.plan ?? "FREE").toUpperCase();

    const handleClose = () => {
        closeModal();
        // If they cancelled the modal while on a strictly gated page that loads nothing, gracefully exit to Dashboard
        const STRICT_PAGES = ["/analytics", "/ai", "/settings/portal"];
        if (STRICT_PAGES.some(p => pathname.startsWith(p))) {
            router.push("/");
        }
    };

    const handleUpgrade = async (planName: string) => {
        if (planName === "ENTERPRISE") { toast("Contact sales at sales@distroai.in", { icon: "📧" }); return; }
        setUpgrading(planName);
        try {
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
                        if (verifyRes.ok) { toast.success(`Upgraded to ${planName}! 🎉`); refetchSub(); closeModal(); }
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
                <button onClick={handleClose} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                    <X size={20} />
                </button>
                <div className="p-6 md:p-8">
                    <div className="text-center max-w-xl mx-auto mb-8">
                        <div className="mx-auto w-12 h-12 bg-[var(--purple)]/20 rounded-full flex items-center justify-center mb-4">
                            <Rocket className="text-[var(--purple)]" size={24} />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Upgrade your plan</h2>
                        <p className="text-[var(--text-secondary)]">
                            You need a higher plan to unlock <span className="text-[var(--gold)] font-medium capitalize">{featureRequested}</span>.
                            Upgrade now to instantly unlock premium features and scale your distribution business.
                        </p>
                    </div>

                    <div className="flex justify-center items-center gap-4 mb-8">
                        <span className={`text-sm font-medium ${!isAnnual ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>Monthly</span>
                        <button type="button" onClick={() => setIsAnnual(!isAnnual)} className="w-12 h-6 rounded-full bg-[var(--purple)] p-1 relative transition-colors focus:outline-none">
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${isAnnual ? "left-[26px]" : "left-1"}`} />
                        </button>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isAnnual ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>Annually</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--purple)]/20 text-[var(--purple)]">2 Months Free</span>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        {plans.map((p) => {
                            const isCurrent = currentPlan === p.name;
                            const isDowngrade = ["FREE", "STARTER", "GROWTH", "ENTERPRISE"].indexOf(currentPlan) > ["FREE", "STARTER", "GROWTH", "ENTERPRISE"].indexOf(p.name);
                            return (
                                <div key={p.name} className={`bg-[var(--bg-primary)] border rounded-xl p-5 relative ${p.recommended ? "border-[var(--gold)] ring-1 ring-[var(--gold)]/20 shadow-[0_0_20px_rgba(251,191,36,0.1)]" : "border-[var(--border)]"}`}>
                                    {p.recommended && <p className="text-[10px] text-[var(--gold)] font-semibold mb-2 tracking-wider">⭐ RECOMMENDED</p>}
                                    <h3 className="font-bold text-lg mb-1">{p.name}</h3>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-mono)" }}>{p.price}</span>
                                        {p.period && <span className="text-sm text-[var(--text-muted)]">{p.period}</span>}
                                    </div>
                                    <ul className="space-y-2 mb-6">
                                        {p.features.map((f) => (
                                            <li key={f} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                                                <Check size={16} className="text-[var(--green-bright)] shrink-0 mt-0.5" />
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button onClick={() => !isCurrent && handleUpgrade(p.name)} disabled={isCurrent || isDowngrade || upgrading === p.name}
                                        className={`w-full py-3 text-sm rounded-lg transition-all font-medium border ${isCurrent ? "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] cursor-default" : isDowngrade ? "border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed opacity-50" : p.recommended ? "bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] border-transparent" : "border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"}`}>
                                        {isCurrent ? "Current Plan" : upgrading === p.name ? "Processing..." : isDowngrade ? "Downgrade" : "Upgrade to " + p.name}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
