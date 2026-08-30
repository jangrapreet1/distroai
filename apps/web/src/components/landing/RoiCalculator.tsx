"use client";

import { useState } from "react";
import { Calculator, IndianRupee, Clock, TrendingUp, ShieldAlert, Sparkles, ArrowRight } from "lucide-react";

export function RoiCalculator() {
    const [turnover, setTurnover] = useState(5000000); // 50 Lakhs
    const [salesmen, setSalesmen] = useState(6);
    const [retailers, setRetailers] = useState(250);
    const [overdueDays, setOverdueDays] = useState(35);

    // ROI Calculations
    // 1. Bad debt & overdue reduction (~1.5% - 2.5% of turnover recovered)
    const badDebtRecovered = Math.round(turnover * (overdueDays / 30) * 0.012);

    // 2. Accounting & Salesman Hours Saved (hours/mo)
    const hoursSaved = Math.round(salesmen * 22 + (retailers * 0.35));

    // 3. Stockout & Overstock Prevention (~2.2% of turnover)
    const inventorySavings = Math.round(turnover * 0.022);

    // Total monthly financial benefit
    const totalBenefit = badDebtRecovered + inventorySavings;

    // DistroAI Growth plan cost
    const distroCost = 5999;
    const roiMultiplier = Math.max(5, Math.round(totalBenefit / distroCost));

    const formatCurrency = (val: number) => {
        if (val >= 10000000) {
            return `₹${(val / 10000000).toFixed(2)} Cr`;
        }
        if (val >= 100000) {
            return `₹${(val / 100000).toFixed(1)} Lakh`;
        }
        return `₹${val.toLocaleString('en-IN')}`;
    };

    return (
        <section id="roi-calculator" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-[var(--border-accent)] bg-gradient-to-br from-[var(--bg-secondary)] via-[var(--bg-card)] to-[var(--bg-primary)] p-6 sm:p-12 shadow-2xl">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] text-xs font-semibold uppercase tracking-wider">
                        <Calculator size={14} />
                        <span>Interactive ROI Estimator</span>
                    </div>
                    <h2
                        className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]"
                        style={{ fontFamily: "var(--font-playfair)" }}
                    >
                        Calculate How Much Money & Time DistroAI Saves You
                    </h2>
                    <p className="text-[var(--text-secondary)] text-sm sm:text-base">
                        Adjust the sliders below to match your distribution business volume.
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-10 items-center">
                    {/* Left: Input Sliders */}
                    <div className="lg:col-span-6 space-y-6">
                        {/* Slider 1: Monthly Turnover */}
                        <div className="space-y-2 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span className="text-[var(--text-secondary)]">Monthly Sales Turnover:</span>
                                <span className="text-[var(--gold)] font-mono font-bold text-base">
                                    {formatCurrency(turnover)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={500000}
                                max={50000000}
                                step={500000}
                                value={turnover}
                                onChange={(e) => setTurnover(Number(e.target.value))}
                                className="w-full accent-[var(--gold)] cursor-pointer"
                            />
                            <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                                <span>₹5 Lakh</span>
                                <span>₹2.5 Cr</span>
                                <span>₹5 Cr+</span>
                            </div>
                        </div>

                        {/* Slider 2: Number of Salesmen */}
                        <div className="space-y-2 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span className="text-[var(--text-secondary)]">Field Sales Reps on Beat Routes:</span>
                                <span className="text-[var(--gold)] font-mono font-bold text-base">
                                    {salesmen} Salesmen
                                </span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={30}
                                step={1}
                                value={salesmen}
                                onChange={(e) => setSalesmen(Number(e.target.value))}
                                className="w-full accent-[var(--gold)] cursor-pointer"
                            />
                            <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                                <span>1 Rep</span>
                                <span>15 Reps</span>
                                <span>30 Reps</span>
                            </div>
                        </div>

                        {/* Slider 3: Number of Retailers */}
                        <div className="space-y-2 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span className="text-[var(--text-secondary)]">Active Retailers & Kirana Counters:</span>
                                <span className="text-[var(--gold)] font-mono font-bold text-base">
                                    {retailers} Retailers
                                </span>
                            </div>
                            <input
                                type="range"
                                min={25}
                                max={1000}
                                step={25}
                                value={retailers}
                                onChange={(e) => setRetailers(Number(e.target.value))}
                                className="w-full accent-[var(--gold)] cursor-pointer"
                            />
                            <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                                <span>25</span>
                                <span>500</span>
                                <span>1,000+</span>
                            </div>
                        </div>

                        {/* Slider 4: Average Overdue Days */}
                        <div className="space-y-2 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span className="text-[var(--text-secondary)]">Average Days to Collect Payment:</span>
                                <span className="text-[var(--red)] font-mono font-bold text-base">
                                    {overdueDays} Days
                                </span>
                            </div>
                            <input
                                type="range"
                                min={15}
                                max={75}
                                step={5}
                                value={overdueDays}
                                onChange={(e) => setOverdueDays(Number(e.target.value))}
                                className="w-full accent-[var(--red)] cursor-pointer"
                            />
                            <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                                <span>15 Days</span>
                                <span>45 Days</span>
                                <span>75 Days</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Real-time ROI Dashboard Card */}
                    <div className="lg:col-span-6 rounded-2xl border border-[var(--border-accent)] bg-[#0A0B12] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <Sparkles size={160} className="text-[var(--gold)]" />
                        </div>

                        <div>
                            <span className="text-xs font-semibold text-[var(--green-bright)] uppercase tracking-wider">
                                Projected Monthly Value Unlocked
                            </span>
                            <div className="flex items-baseline gap-3 mt-1">
                                <h3 className="text-3xl sm:text-5xl font-extrabold text-[var(--gold)] font-mono">
                                    {formatCurrency(totalBenefit)}
                                </h3>
                                <span className="text-sm text-[var(--text-secondary)]">/ Month Saved</span>
                            </div>
                        </div>

                        {/* Breakdown Metrics */}
                        <div className="space-y-3 pt-4 border-t border-[var(--border)]">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                                <div className="flex items-center gap-2.5">
                                    <ShieldAlert size={18} className="text-[var(--red)]" />
                                    <span className="text-xs sm:text-sm text-[var(--text-primary)]">Bad Debt & Overdue Recovered:</span>
                                </div>
                                <span className="text-sm font-bold font-mono text-[var(--green-bright)]">
                                    +{formatCurrency(badDebtRecovered)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                                <div className="flex items-center gap-2.5">
                                    <TrendingUp size={18} className="text-[var(--gold)]" />
                                    <span className="text-xs sm:text-sm text-[var(--text-primary)]">Dead Stock & Stockouts Avoided:</span>
                                </div>
                                <span className="text-sm font-bold font-mono text-[var(--green-bright)]">
                                    +{formatCurrency(inventorySavings)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                                <div className="flex items-center gap-2.5">
                                    <Clock size={18} className="text-[var(--purple)]" />
                                    <span className="text-xs sm:text-sm text-[var(--text-primary)]">Admin & Salesman Time Saved:</span>
                                </div>
                                <span className="text-sm font-bold font-mono text-cyan-400">
                                    {hoursSaved} Hours / mo
                                </span>
                            </div>
                        </div>

                        {/* ROI Badge */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--gold)]/15 via-amber-500/10 to-transparent border border-[var(--border-accent)] flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-[var(--text-secondary)]">Estimated Net ROI:</p>
                                <p className="text-xl font-bold text-[var(--gold)] font-mono">{roiMultiplier}x Return</p>
                            </div>
                            <a
                                href="/register"
                                className="inline-flex items-center gap-2 py-2.5 px-5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[#07070E] font-bold text-xs hover:bg-[var(--gold-light)] shadow-md transition"
                            >
                                <span>Claim Your Savings</span>
                                <ArrowRight size={14} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
