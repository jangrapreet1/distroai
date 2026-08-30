"use client";

import { motion } from "motion/react";
import { Check, X, Sparkles, Scale } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

export function ComparisonTable() {
    const rows = [
        {
            feature: "WhatsApp Multi-Lingual & Voice Ordering",
            distro: true,
            distroText: "Native AI with 99.4% SKU match",
            legacy: false,
            legacyText: "Manual clerk re-typing",
            cloudErp: false,
            cloudErpText: "Complex retail login app only",
        },
        {
            feature: "Real-Time Local Tally Prime XML Sync",
            distro: true,
            distroText: "Instant (<2.5s) bidirectional",
            legacy: true,
            legacyText: "Manual batch file export/import",
            cloudErp: false,
            cloudErpText: "Forces replacing Tally entirely",
        },
        {
            feature: "Prophet ML Demand Forecasting",
            distro: true,
            distroText: "Automated festival & seasonal POs",
            legacy: false,
            legacyText: "Gut feeling & manual registers",
            cloudErp: false,
            cloudErpText: "Requires ₹50k/mo enterprise add-on",
        },
        {
            feature: "Dynamic NPCI UPI QR on Invoices",
            distro: true,
            distroText: "1-scan payment & auto ledger recon",
            legacy: false,
            legacyText: "Static QR / Cheque collection",
            cloudErp: false,
            cloudErpText: "Standard payment gateway (2% fee)",
        },
        {
            feature: "Field Sales Rep GPS Geo-Fencing & SFA",
            distro: true,
            distroText: "Offline-first mobile app + Bluetooth print",
            legacy: false,
            legacyText: "Paper order pads & end-of-day tally",
            cloudErp: true,
            cloudErpText: "Basic web form (needs internet)",
        },
        {
            feature: "GST E-Invoice IRN & E-Way Bill in 1 Click",
            distro: true,
            distroText: "Direct NIC API integration",
            legacy: false,
            legacyText: "Manual NIC portal JSON upload",
            cloudErp: true,
            cloudErpText: "Standard GSP connector",
        },
    ];

    return (
        <section className="py-24 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] text-[var(--gold)] text-[11px] font-mono font-semibold uppercase tracking-wider border border-white/[0.08]">
                        <Scale size={12} />
                        <span>[BENCHMARK // MARKET_COMPARISON]</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                        Why Traditional Software Falls Short
                    </h2>
                    <p className="text-sm sm:text-base text-[var(--text-secondary)]">
                        See how DistroAI contrasts against legacy desktop tools and heavyweight cloud ERPs.
                    </p>
                </div>

                {/* Comparison Card / Table */}
                <SpotlightCard
                    spotlightColor="rgba(201, 168, 76, 0.08)"
                    className="p-4 sm:p-8 border-white/[0.08] bg-[#07070C] overflow-x-auto"
                >
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="border-b border-white/[0.08] text-xs">
                                <th className="py-4 px-4 font-mono uppercase tracking-wider text-[var(--text-secondary)] w-2/5">
                                    Capability / Feature
                                </th>
                                <th className="py-4 px-4 font-bold text-[var(--gold)] bg-[var(--gold)]/10 rounded-t-xl w-1/5 border-x border-t border-[var(--gold)]/30">
                                    <div className="flex items-center gap-1.5 font-mono">
                                        <Sparkles size={14} className="text-[var(--gold)]" />
                                        <span>DISTROAI (AI-Native)</span>
                                    </div>
                                </th>
                                <th className="py-4 px-4 font-mono uppercase tracking-wider text-[var(--text-secondary)] w-1/5">
                                    Legacy Desktop (Tally / Busy)
                                </th>
                                <th className="py-4 px-4 font-mono uppercase tracking-wider text-[var(--text-secondary)] w-1/5">
                                    Generic Cloud ERP (Zoho / SAP)
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] text-xs">
                            {rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="py-4 px-4 font-medium text-[var(--text-primary)]">
                                        {row.feature}
                                    </td>
                                    {/* DistroAI Column Highlight */}
                                    <td className="py-4 px-4 bg-[var(--gold)]/5 border-x border-[var(--gold)]/20 font-semibold text-white">
                                        <div className="flex items-start gap-2">
                                            <div className="p-1 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] shrink-0 mt-0.5">
                                                <Check size={12} />
                                            </div>
                                            <span>{row.distroText}</span>
                                        </div>
                                    </td>
                                    {/* Legacy Column */}
                                    <td className="py-4 px-4 text-[var(--text-secondary)]">
                                        <div className="flex items-start gap-2">
                                            {row.legacy ? (
                                                <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                                                    <Check size={12} />
                                                </div>
                                            ) : (
                                                <div className="p-1 rounded-full bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                                                    <X size={12} />
                                                </div>
                                            )}
                                            <span>{row.legacyText}</span>
                                        </div>
                                    </td>
                                    {/* Cloud ERP Column */}
                                    <td className="py-4 px-4 text-[var(--text-secondary)]">
                                        <div className="flex items-start gap-2">
                                            {row.cloudErp ? (
                                                <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                                                    <Check size={12} />
                                                </div>
                                            ) : (
                                                <div className="p-1 rounded-full bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                                                    <X size={12} />
                                                </div>
                                            )}
                                            <span>{row.cloudErpText}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </SpotlightCard>
            </div>
        </section>
    );
}
