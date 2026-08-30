"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, ArrowRight, Zap, ShieldCheck } from "lucide-react";

export function PricingSection() {
    const [annual, setAnnual] = useState(true);

    const plans = [
        {
            name: "Starter",
            tagline: "For single-depot traders & small wholesale distributors.",
            monthlyPrice: 2499,
            annualPrice: 1999,
            highlight: false,
            badge: null,
            features: [
                "1 Warehouse Depot",
                "Up to 100 Active Retailers",
                "WhatsApp AI Order Assistant",
                "Desktop Tally Prime / 9 Sync",
                "GST Invoicing & Dynamic UPI QR",
                "2 Field Salesman App Seats",
                "Basic Email & Chat Support",
            ],
            cta: "Start 14-Day Free Trial",
            href: "/register?plan=starter",
        },
        {
            name: "Growth",
            tagline: "For scaling FMCG, Pharma & Hardware super-stockists.",
            monthlyPrice: 5999,
            annualPrice: 4799,
            highlight: true,
            badge: "Most Popular",
            features: [
                "Up to 3 Multi-Warehouse Depots",
                "Unlimited Retailer Accounts",
                "Advanced WhatsApp NLP & Schemes",
                "Bi-Directional Real-Time Tally Bridge",
                "Prophet ML 30-Day Demand Forecasting",
                "Retailer Credit Scoring & AR Aging",
                "8 Salesman App Seats (GPS & Selfies)",
                "Meta Ads Campaign Attribution",
                "Priority WhatsApp Support",
            ],
            cta: "Start 14-Day Free Trial",
            href: "/register?plan=growth",
        },
        {
            name: "Enterprise",
            tagline: "For multi-city distribution networks & manufacturers.",
            monthlyPrice: 14999,
            annualPrice: 11999,
            highlight: false,
            badge: "Custom Scale",
            features: [
                "Unlimited Warehouses & Depots",
                "Unlimited Salesmen App Seats",
                "Custom ERP Connectors (SAP / Busy / Marg)",
                "Dedicated WAL-G Backup Node",
                "Custom ML Model Fine-Tuning",
                "Custom Domain & White-Label Portal",
                "Dedicated 24/7 Account Manager & SLA",
            ],
            cta: "Contact Enterprise Sales",
            href: "/register?plan=enterprise",
        },
    ];

    return (
        <section id="pricing" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
                <span className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wider bg-[var(--gold)]/10 px-3 py-1 rounded-full">
                    Transparent INR Pricing
                </span>
                <h2
                    className="text-3xl sm:text-5xl font-bold text-[var(--text-primary)]"
                    style={{ fontFamily: "var(--font-playfair)" }}
                >
                    Simple, Predictable Plans for Every Distributor
                </h2>
                <p className="text-[var(--text-secondary)] text-base sm:text-lg">
                    Every plan includes a 14-day full-access free trial. No credit card required to start.
                </p>

                {/* Billing Toggle */}
                <div className="pt-4 flex items-center justify-center gap-4">
                    <span className={`text-sm font-medium ${!annual ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                        Monthly Billing
                    </span>
                    <button
                        onClick={() => setAnnual(!annual)}
                        className="relative w-14 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border-accent)] p-1 transition-colors duration-200"
                        aria-label="Toggle annual billing"
                    >
                        <div
                            className={`w-6 h-6 rounded-full bg-[var(--gold)] shadow-md transform transition-transform duration-200 ${
                                annual ? "translate-x-6" : "translate-x-0"
                            }`}
                        />
                    </button>
                    <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-medium ${annual ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                            Annual Billing
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--green-bright)]/20 text-[var(--green-bright)] border border-[var(--green-bright)]/30">
                            Save 20%
                        </span>
                    </div>
                </div>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid lg:grid-cols-3 gap-8 items-stretch">
                {plans.map((plan) => {
                    const price = annual ? plan.annualPrice : plan.monthlyPrice;

                    return (
                        <div
                            key={plan.name}
                            className={`rounded-2xl flex flex-col justify-between p-8 transition-all duration-300 relative ${
                                plan.highlight
                                    ? "border-2 border-[var(--gold)] bg-gradient-to-b from-[var(--bg-secondary)] via-[var(--bg-card)] to-[var(--bg-secondary)] shadow-2xl shadow-amber-500/10 lg:-translate-y-2"
                                    : "border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-accent)]"
                            }`}
                        >
                            {plan.badge && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--gold)] text-[#07070E] text-xs font-bold uppercase tracking-wider shadow-md">
                                        <Sparkles size={12} />
                                        {plan.badge}
                                    </span>
                                </div>
                            )}

                            <div>
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                                    {plan.name}
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 min-h-[32px]">
                                    {plan.tagline}
                                </p>

                                <div className="mt-6 mb-8 pb-6 border-b border-[var(--border)]">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-sm font-bold text-[var(--text-secondary)]">₹</span>
                                        <span className="text-4xl sm:text-5xl font-extrabold text-[var(--gold)] font-mono">
                                            {price.toLocaleString('en-IN')}
                                        </span>
                                        <span className="text-xs text-[var(--text-muted)] font-medium">/ month</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                                        {annual ? "Billed annually (₹" + (price * 12).toLocaleString('en-IN') + "/year)" : "Billed monthly"}
                                    </p>
                                </div>

                                {/* Features List */}
                                <div className="space-y-3 mb-8">
                                    <p className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                                        Included Features:
                                    </p>
                                    {plan.features.map((feat, i) => (
                                        <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                                            <Check size={16} className="text-[var(--gold)] shrink-0 mt-0.5" />
                                            <span className="text-[var(--text-secondary)]">{feat}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Link
                                href={plan.href}
                                className={`w-full py-3.5 px-4 rounded-[var(--radius-md)] font-bold text-sm text-center flex items-center justify-center gap-2 transition duration-200 ${
                                    plan.highlight
                                        ? "bg-[var(--gold)] text-[#07070E] hover:bg-[var(--gold-light)] shadow-lg shadow-amber-500/20"
                                        : "border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-accent)]"
                                }`}
                            >
                                <span>{plan.cta}</span>
                                <ArrowRight size={15} />
                            </Link>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
