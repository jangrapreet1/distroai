"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Check, Sparkles, ArrowRight, Zap, Shield, HelpCircle } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

export function PricingSection() {
    const [isAnnual, setIsAnnual] = useState(true);

    const plans = [
        {
            name: "Starter Distributor",
            tag: "FOR SINGLE-BRANCH TRADERS",
            priceMonthly: 2999,
            priceAnnualMonthly: 2499,
            popular: false,
            description: "Automate inbound WhatsApp orders and eliminate manual Tally punching.",
            features: [
                "Up to 250 Active Kirana Accounts",
                "1 Connected WhatsApp Business Number",
                "Real-Time Tally Prime XML Sync Bridge",
                "Automated PDF Invoices & Dynamic UPI QR",
                "Basic Credit Score Limits",
                "Email & WhatsApp Support",
            ],
            cta: "Start 14-Day Free Trial",
            ctaLink: "/register?plan=starter",
        },
        {
            name: "Growth Enterprise",
            tag: "MOST POPULAR FOR FMCG & PHARMA",
            priceMonthly: 7499,
            priceAnnualMonthly: 5999,
            popular: true,
            description: "Complete AI distribution suite with SFA field tracking & Prophet forecasting.",
            features: [
                "Unlimited Kiranas & Retailers",
                "3 WhatsApp Numbers (Inbound + Field Sales)",
                "Real-Time Bidirectional Tally Sync",
                "Prophet ML Seasonal Stock Forecasting",
                "Salesmen GPS Beat Route & Geo-Fencing SFA",
                "Automated GST E-Invoice & E-Way Bill",
                "Dynamic NPCI UPI Instant Recon",
                "Dedicated WhatsApp Account Manager",
            ],
            cta: "Start 14-Day Free Trial",
            ctaLink: "/register?plan=growth",
        },
        {
            name: "Custom Enterprise / Super Stockist",
            tag: "MULTI-GODOWN & C&F AGENTS",
            priceCustom: true,
            popular: false,
            description: "Custom ERP integrations (SAP, Busy, Marg) with SLA & private cloud hosting.",
            features: [
                "Multi-Branch & Multi-Godown Architecture",
                "Custom ERP Bridge (SAP, Marg ERP, Busy, Custom SQL)",
                "Voice AI Ordering in 12+ Indian Dialects",
                "White-Labeled Retailer Web Ordering Portal",
                "99.9% Uptime Guarantee & Custom SLA",
                "On-Premise or Dedicated VPC Deployment",
            ],
            cta: "Speak with Sales",
            ctaLink: "https://wa.me/919999999999?text=Interested%20in%20DistroAI%20Enterprise",
        },
    ];

    return (
        <section id="pricing" className="py-24 bg-[#050508] relative overflow-hidden border-t border-white/[0.06]">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.12),transparent_70%)] blur-3xl pointer-events-none -z-10" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] text-[var(--gold)] text-[11px] font-mono font-semibold uppercase tracking-wider border border-white/[0.08]">
                        <Zap size={12} />
                        <span>[PRICING // TRANSPARENT_INR_TIERS]</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                        Transparent Pricing with 14-Day Free Trial
                    </h2>
                    <p className="text-sm sm:text-base text-[var(--text-secondary)]">
                        No hidden setup fees. No per-invoice commission charges. Cancel anytime.
                    </p>

                    {/* Annual / Monthly Toggle */}
                    <div className="flex items-center justify-center gap-3 pt-4">
                        <div className="relative p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-1">
                            <button
                                onClick={() => setIsAnnual(false)}
                                className={`relative px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                                    !isAnnual ? "text-[#07070E]" : "text-[var(--text-secondary)] hover:text-white"
                                }`}
                            >
                                {!isAnnual && (
                                    <motion.div
                                        layoutId="pricingToggle"
                                        transition={{ type: "spring", stiffness: 450, damping: 30 }}
                                        className="absolute inset-0 rounded-lg bg-[var(--gold)] shadow-md shadow-amber-500/20"
                                    />
                                )}
                                <span className="relative z-10">Monthly Billing</span>
                            </button>
                            <button
                                onClick={() => setIsAnnual(true)}
                                className={`relative px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors duration-200 ${
                                    isAnnual ? "text-[#07070E]" : "text-[var(--text-secondary)] hover:text-white"
                                }`}
                            >
                                {isAnnual && (
                                    <motion.div
                                        layoutId="pricingToggle"
                                        transition={{ type: "spring", stiffness: 450, damping: 30 }}
                                        className="absolute inset-0 rounded-lg bg-[var(--gold)] shadow-md shadow-amber-500/20"
                                    />
                                )}
                                <span className="relative z-10">Annual Billing</span>
                                <span className="relative z-10 text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#07070E] text-[var(--gold)]">
                                    SAVE 20%
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Plans Grid */}
                <div className="grid lg:grid-cols-3 gap-8 items-stretch">
                    {plans.map((plan) => {
                        const price = isAnnual ? plan.priceAnnualMonthly : plan.priceMonthly;
                        return (
                            <SpotlightCard
                                key={plan.name}
                                spotlightColor={plan.popular ? "rgba(201, 168, 76, 0.22)" : "rgba(201, 168, 76, 0.08)"}
                                className={`p-8 rounded-3xl flex flex-col justify-between space-y-8 ${
                                    plan.popular
                                        ? "border-[var(--gold)]/50 bg-gradient-to-b from-[#11111E] to-[#07070D] shadow-2xl shadow-amber-500/10 relative"
                                        : "border-white/[0.08] bg-[#07070C]"
                                }`}
                            >
                                <div className="space-y-6">
                                    {/* Header */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-mono font-bold tracking-wider text-[var(--gold)] uppercase">
                                                {plan.tag}
                                            </span>
                                            {plan.popular && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold)] text-[#07070E] text-[10px] font-extrabold uppercase shadow-sm">
                                                    <Sparkles size={11} /> Recommended
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-bold text-[var(--text-primary)]">{plan.name}</h3>
                                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{plan.description}</p>
                                    </div>

                                    {/* Price */}
                                    <div className="py-2 border-y border-white/[0.06]">
                                        {plan.priceCustom ? (
                                            <div>
                                                <span className="text-3xl font-extrabold text-white font-mono">Custom</span>
                                                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Based on volume & integrations</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-4xl font-black text-white font-mono">
                                                        ₹{price?.toLocaleString("en-IN")}
                                                    </span>
                                                    <span className="text-xs text-[var(--text-muted)] font-medium">/ month</span>
                                                </div>
                                                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                                                    {isAnnual ? "Billed annually (₹" + ((price ?? 0) * 12).toLocaleString("en-IN") + "/yr)" : "Billed monthly"}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Feature Checklist */}
                                    <div className="space-y-3">
                                        <p className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                                            [INCLUDED_CAPABILITIES]
                                        </p>
                                        <div className="space-y-2.5">
                                            {plan.features.map((feat, i) => (
                                                <div key={i} className="flex items-start gap-2.5 text-xs text-[var(--text-primary)]">
                                                    <div className="p-0.5 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] shrink-0 mt-0.5">
                                                        <Check size={12} />
                                                    </div>
                                                    <span>{feat}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* CTA Button */}
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                    <Link
                                        href={plan.ctaLink}
                                        className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition duration-150 ${
                                            plan.popular
                                                ? "bg-gradient-to-r from-[var(--gold)] via-[var(--gold-light)] to-[#FFE8A3] text-[#07070E] shadow-lg shadow-amber-500/25 hover:opacity-95"
                                                : "border border-white/[0.1] bg-white/[0.03] text-white hover:border-[var(--border-accent)] hover:bg-white/[0.06]"
                                        }`}
                                    >
                                        <span>{plan.cta}</span>
                                        <ArrowRight size={15} />
                                    </Link>
                                </motion.div>
                            </SpotlightCard>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
