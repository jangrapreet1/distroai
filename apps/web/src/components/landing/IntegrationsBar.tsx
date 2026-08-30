"use client";

import { motion } from "motion/react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { Database, MessageSquare, Receipt, QrCode, Cpu, ShieldCheck, Zap, Server } from "lucide-react";

export function IntegrationsBar() {
    const metrics = [
        { label: "Total Platform GMV", value: "₹500Cr+", subtext: "Processed across Indian FMCG & Pharma" },
        { label: "Orders Automated", value: "150,000+", subtext: "Zero human data-entry errors" },
        { label: "Tally Sync Latency", value: "< 2.5s", subtext: "Real-time bidirectional voucher replication" },
        { label: "DSO Reduction", value: "18 Days", subtext: "Faster cash collections via automated reminders" },
    ];

    const integrations = [
        {
            name: "Tally Prime & 9",
            icon: Database,
            tag: "XML RPC BRIDGE",
            desc: "Sync stock, sales vouchers, payments & ledgers without changing your accountant's desktop workflow.",
        },
        {
            name: "WhatsApp Cloud API",
            icon: MessageSquare,
            tag: "META ENTERPRISE",
            desc: "Official green tick Meta cloud integration for high-throughput vernacular ordering.",
        },
        {
            name: "GST & E-Way Portal",
            icon: Receipt,
            tag: "NIC DIRECT API",
            desc: "1-click B2B E-Invoice IRN and E-Way Bill generation directly on invoice confirmation.",
        },
        {
            name: "Dynamic NPCI UPI",
            icon: QrCode,
            tag: "AUTO RECONCILIATION",
            desc: "Print scannable Dynamic UPI QR on invoices with automated real-time ledger settlement.",
        },
    ];

    return (
        <section className="py-20 border-y border-white/[0.06] bg-[#050508] relative overflow-hidden">
            {/* Background Grid Accent */}
            <div
                className="absolute inset-0 opacity-15 pointer-events-none -z-10"
                style={{
                    backgroundImage: "radial-gradient(rgba(201, 168, 76, 0.15) 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                }}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
                {/* Metrics Banner */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                    {metrics.map((m, i) => (
                        <SpotlightCard
                            key={m.label}
                            spotlightColor="rgba(201, 168, 76, 0.1)"
                            className="p-6 border-white/[0.08] bg-white/[0.02] text-center space-y-1.5"
                        >
                            <span className="text-3xl sm:text-4xl font-extrabold text-[var(--gold)] font-mono tracking-tight">
                                {m.value}
                            </span>
                            <h4 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                                {m.label}
                            </h4>
                            <p className="text-[11px] text-[var(--text-muted)]">
                                {m.subtext}
                            </p>
                        </SpotlightCard>
                    ))}
                </div>

                {/* Integrations Header */}
                <div className="text-center max-w-2xl mx-auto space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] text-[var(--gold)] text-[11px] font-mono font-semibold uppercase tracking-wider border border-white/[0.08]">
                        <Server size={12} />
                        <span>[INFRA // ECOSYSTEM_INTEGRATIONS]</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
                        Plugs Directly Into Your Existing Distribution Stack
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                        No hardware upgrades required. DistroAI operates alongside your current accounting software and WhatsApp phone numbers.
                    </p>
                </div>

                {/* Integrations Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {integrations.map((item) => {
                        const Icon = item.icon;
                        return (
                            <SpotlightCard
                                key={item.name}
                                spotlightColor="rgba(201, 168, 76, 0.15)"
                                className="p-6 border-white/[0.08] bg-white/[0.02] space-y-4 flex flex-col justify-between"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="p-2.5 rounded-xl bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 shadow-inner">
                                            <Icon size={20} />
                                        </div>
                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/[0.04] text-[var(--text-muted)] border border-white/[0.06]">
                                            {item.tag}
                                        </span>
                                    </div>
                                    <h4 className="text-base font-bold text-[var(--text-primary)]">{item.name}</h4>
                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
                                </div>
                            </SpotlightCard>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
