"use client";

import { Check, X, Sparkles } from "lucide-react";

export function ComparisonTable() {
    const rows = [
        {
            feature: "WhatsApp AI Bot Order Taking (Hinglish/Voice)",
            distro: true,
            legacy: false,
            generic: false,
        },
        {
            feature: "Real-Time Bi-Directional Tally Bridge",
            distro: true,
            legacy: true, // Native Tally only, not bi-directional auto sync
            generic: false,
        },
        {
            feature: "Salesman GPS Beat Route & Selfie Attendance",
            distro: true,
            legacy: false,
            generic: false,
        },
        {
            feature: "ML 30-Day Demand Forecasting (Prophet)",
            distro: true,
            legacy: false,
            generic: false,
        },
        {
            feature: "Retailer Credit Scoring & AR Aging WhatsApp Alerts",
            distro: true,
            legacy: false,
            generic: false,
        },
        {
            feature: "Dynamic NPCI UPI QR Codes on PDF Invoices",
            distro: true,
            legacy: false,
            generic: true,
        },
        {
            feature: "Meta Ad Campaign Attribution for B2B Retailers",
            distro: true,
            legacy: false,
            generic: false,
        },
        {
            feature: "Setup & Onboarding Time",
            distroText: "15 Minutes",
            legacyText: "2-4 Weeks",
            genericText: "3-6 Months",
        },
    ];

    return (
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
                <span className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wider bg-[var(--gold)]/10 px-3 py-1 rounded-full">
                    How We Compare
                </span>
                <h2
                    className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]"
                    style={{ fontFamily: "var(--font-playfair)" }}
                >
                    Why Modern Distributors Switch to DistroAI
                </h2>
                <p className="text-[var(--text-secondary)] text-sm sm:text-base">
                    See how DistroAI stacks up against legacy desktop billing software and generic enterprise ERPs.
                </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
                <table className="w-full text-left border-collapse min-w-[640px]">
                    <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                            <th className="py-5 px-6 text-sm font-semibold text-[var(--text-secondary)] w-2/5">
                                Feature / Capability
                            </th>
                            <th className="py-5 px-6 text-sm font-bold text-[var(--gold)] w-1/5 bg-[var(--gold)]/5 border-x border-[var(--gold)]/20 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                    <Sparkles size={15} />
                                    <span>DistroAI</span>
                                </div>
                            </th>
                            <th className="py-5 px-6 text-sm font-semibold text-[var(--text-secondary)] w-1/5 text-center">
                                Legacy Desktop <br />
                                <span className="text-[11px] font-normal text-[var(--text-muted)]">(Tally / Busy / Marg)</span>
                            </th>
                            <th className="py-5 px-6 text-sm font-semibold text-[var(--text-secondary)] w-1/5 text-center">
                                Generic Cloud ERP <br />
                                <span className="text-[11px] font-normal text-[var(--text-muted)]">(Zoho / SAP / Odoo)</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-sm">
                        {rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[var(--bg-card-hover)] transition">
                                <td className="py-4 px-6 font-medium text-[var(--text-primary)]">
                                    {row.feature}
                                </td>

                                {/* DistroAI Column */}
                                <td className="py-4 px-6 text-center bg-[var(--gold)]/5 border-x border-[var(--gold)]/20">
                                    {row.distroText ? (
                                        <span className="font-bold text-[var(--gold)] font-mono">{row.distroText}</span>
                                    ) : (
                                        <div className="inline-flex p-1 rounded-full bg-[var(--green-bright)]/20 text-[var(--green-bright)]">
                                            <Check size={16} />
                                        </div>
                                    )}
                                </td>

                                {/* Legacy Software */}
                                <td className="py-4 px-6 text-center text-[var(--text-muted)]">
                                    {row.legacyText ? (
                                        <span className="font-mono">{row.legacyText}</span>
                                    ) : row.legacy ? (
                                        <div className="inline-flex p-1 rounded-full bg-yellow-500/20 text-yellow-400">
                                            <Check size={16} />
                                        </div>
                                    ) : (
                                        <div className="inline-flex p-1 rounded-full bg-red-500/10 text-red-400">
                                            <X size={16} />
                                        </div>
                                    )}
                                </td>

                                {/* Generic Cloud ERP */}
                                <td className="py-4 px-6 text-center text-[var(--text-muted)]">
                                    {row.genericText ? (
                                        <span className="font-mono">{row.genericText}</span>
                                    ) : row.generic ? (
                                        <div className="inline-flex p-1 rounded-full bg-yellow-500/20 text-yellow-400">
                                            <Check size={16} />
                                        </div>
                                    ) : (
                                        <div className="inline-flex p-1 rounded-full bg-red-500/10 text-red-400">
                                            <X size={16} />
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
