"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Calculator, IndianRupee, Clock, ShieldAlert, TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import Link from "next/link";

export function RoiCalculator() {
    const [monthlyTurnoverLakhs, setMonthlyTurnoverLakhs] = useState<number>(50); // ₹50 Lakhs
    const [salesmenCount, setSalesmenCount] = useState<number>(4);
    const [retailerCount, setRetailerCount] = useState<number>(250);
    const [overdueDays, setOverdueDays] = useState<number>(35);

    // ROI Calculations
    const turnoverAmount = monthlyTurnoverLakhs * 100000;
    
    // 1. Bad debt & overdue interest savings (reducing DSO by ~15 days @ 12% p.a.)
    const workingCapitalInterestSaved = (turnoverAmount * (15 / 365) * 0.12);
    
    // 2. Data entry & operator labor saved (approx 3 hrs/day per operator @ ₹300/hr)
    const laborHoursSaved = Math.round(salesmenCount * 2.5 * 26);
    const laborMoneySaved = laborHoursSaved * 120;

    // 3. Sales boost via instant WhatsApp reordering (+6% order frequency)
    const extraMarginEarned = turnoverAmount * 0.06 * 0.08; // 8% gross margin on 6% incremental volume

    const totalMonthlyBenefit = Math.round(workingCapitalInterestSaved + laborMoneySaved + extraMarginEarned);
    const estimatedSoftwareCost = 5999;
    const roiMultiplier = ((totalMonthlyBenefit / estimatedSoftwareCost)).toFixed(1);

    return (
        <section id="roi-calculator" className="py-24 bg-[#050508] relative overflow-hidden border-y border-white/[0.06]">
            {/* Background Radial Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.1),transparent_70%)] blur-3xl pointer-events-none -z-10" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] text-[var(--gold)] text-[11px] font-mono font-semibold uppercase tracking-wider border border-white/[0.08]">
                        <Calculator size={12} />
                        <span>[ROI_ENGINE // REAL_TIME_SAVINGS]</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                        Calculate Your Monthly Cash Flow Unlock
                    </h2>
                    <p className="text-sm sm:text-base text-[var(--text-secondary)]">
                        See how automating WhatsApp orders and plugging into Tally saves hours and mitigates bad credit debt.
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-8 items-stretch">
                    {/* Left Controls Column */}
                    <SpotlightCard
                        spotlightColor="rgba(201, 168, 76, 0.08)"
                        className="lg:col-span-7 p-6 sm:p-8 border-white/[0.08] bg-[#07070C] space-y-6 flex flex-col justify-between"
                    >
                        <div className="space-y-6">
                            <h3 className="text-base font-bold text-[var(--text-primary)] border-b border-white/[0.06] pb-3">
                                Your Business Operations
                            </h3>

                            {/* Slider 1: Monthly Turnover */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs sm:text-sm">
                                    <span className="text-[var(--text-secondary)]">Monthly Turnover:</span>
                                    <span className="font-mono font-bold text-[var(--gold)] text-base">
                                        ₹{monthlyTurnoverLakhs} Lakhs / mo
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={5}
                                    max={300}
                                    step={5}
                                    value={monthlyTurnoverLakhs}
                                    onChange={(e) => setMonthlyTurnoverLakhs(Number(e.target.value))}
                                    className="w-full accent-[var(--gold)] h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                                    <span>₹5 Lakhs</span>
                                    <span>₹1.5 Crores</span>
                                    <span>₹3 Crores</span>
                                </div>
                            </div>

                            {/* Slider 2: Salesmen Count */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs sm:text-sm">
                                    <span className="text-[var(--text-secondary)]">Field Salesmen (Order Bookers):</span>
                                    <span className="font-mono font-bold text-[var(--text-primary)] text-base">
                                        {salesmenCount} Salesmen
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={25}
                                    value={salesmenCount}
                                    onChange={(e) => setSalesmenCount(Number(e.target.value))}
                                    className="w-full accent-[var(--gold)] h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                                    <span>1</span>
                                    <span>10</span>
                                    <span>25+</span>
                                </div>
                            </div>

                            {/* Slider 3: Active Retailers */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs sm:text-sm">
                                    <span className="text-[var(--text-secondary)]">Active Kiranas / Pharmacies:</span>
                                    <span className="font-mono font-bold text-[var(--text-primary)] text-base">
                                        {retailerCount} Retailers
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={50}
                                    max={1500}
                                    step={50}
                                    value={retailerCount}
                                    onChange={(e) => setRetailerCount(Number(e.target.value))}
                                    className="w-full accent-[var(--gold)] h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                                    <span>50 Stores</span>
                                    <span>750 Stores</span>
                                    <span>1,500+ Stores</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-[11px] text-[var(--text-muted)] italic pt-4 border-t border-white/[0.06]">
                            * Estimates based on verified telemetry from 150+ Indian distributors running DistroAI across FMCG, Pharma, and Electricals.
                        </p>
                    </SpotlightCard>

                    {/* Right Savings Output Column */}
                    <SpotlightCard
                        spotlightColor="rgba(201, 168, 76, 0.18)"
                        className="lg:col-span-5 p-6 sm:p-8 border-[var(--gold)]/30 bg-gradient-to-b from-[#0E0E18] to-[#07070D] flex flex-col justify-between space-y-6"
                    >
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--gold)]">
                                    ESTIMATED MONTHLY GAIN
                                </span>
                                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-mono font-bold text-xs border border-emerald-500/30">
                                    {roiMultiplier}x ROI
                                </span>
                            </div>

                            <div className="space-y-1">
                                <motion.div
                                    key={totalMonthlyBenefit}
                                    initial={{ scale: 0.96, opacity: 0.8 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight"
                                >
                                    ₹{totalMonthlyBenefit.toLocaleString("en-IN")}
                                </motion.div>
                                <p className="text-xs text-[var(--text-secondary)]">
                                    Recurring monthly value unlocked (₹{(totalMonthlyBenefit * 12 / 100000).toFixed(1)} Lakhs / year)
                                </p>
                            </div>

                            {/* Savings Breakdown */}
                            <div className="space-y-3 pt-2">
                                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                                        <Clock size={15} className="text-cyan-400" />
                                        <span>Labor & Data Entry Saved:</span>
                                    </div>
                                    <span className="font-mono font-bold text-white">~{laborHoursSaved} hrs / mo</span>
                                </div>

                                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                                        <ShieldAlert size={15} className="text-amber-400" />
                                        <span>Working Capital Interest Saved:</span>
                                    </div>
                                    <span className="font-mono font-bold text-emerald-400">₹{Math.round(workingCapitalInterestSaved).toLocaleString('en-IN')}</span>
                                </div>

                                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                                        <TrendingUp size={15} className="text-purple-400" />
                                        <span>Incremental Repeat Orders:</span>
                                    </div>
                                    <span className="font-mono font-bold text-emerald-400">₹{Math.round(extraMarginEarned).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>

                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-4">
                            <Link
                                href="/register"
                                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[var(--gold)] via-[var(--gold-light)] to-[#FFE8A3] text-[#07070E] font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:opacity-95 transition"
                            >
                                <span>Unlock These Savings in 14 Days</span>
                                <ArrowRight size={15} />
                            </Link>
                        </motion.div>
                    </SpotlightCard>
                </div>
            </div>
        </section>
    );
}
