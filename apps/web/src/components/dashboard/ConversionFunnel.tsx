"use client";

import { motion } from "motion/react";
import { MessageSquare, Cpu, Truck, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface FunnelStep {
    id: string;
    label: string;
    sublabel: string;
    count: number;
    totalAmount?: string;
    conversionPct: number;
    color: string;
    icon: React.ElementType;
}

interface ConversionFunnelProps {
    totalVisits?: number;
    totalOrders?: number;
    totalDispatched?: number;
    totalReconciled?: number;
}

export function ConversionFunnel({
    totalVisits = 184,
    totalOrders = 162,
    totalDispatched = 154,
    totalReconciled = 148,
}: ConversionFunnelProps) {
    const steps: FunnelStep[] = [
        {
            id: "inbound",
            label: "Inbound Demands",
            sublabel: "WhatsApp Voice + SFA Beats",
            count: totalVisits,
            conversionPct: 100,
            color: "#3B82F6", // Blue
            icon: MessageSquare,
        },
        {
            id: "ai_transcribe",
            label: "AI Transcribed",
            sublabel: "SKUs Auto-Matched",
            count: totalOrders,
            totalAmount: "₹2.45L",
            conversionPct: Math.round((totalOrders / totalVisits) * 100),
            color: "#C9A84C", // Gold
            icon: Cpu,
        },
        {
            id: "dispatched",
            label: "Dispatched + UPI QR",
            sublabel: "PDF Invoice Dispatched",
            count: totalDispatched,
            totalAmount: "₹2.31L",
            conversionPct: Math.round((totalDispatched / totalOrders) * 100),
            color: "#8B5CF6", // Purple
            icon: Truck,
        },
        {
            id: "reconciled",
            label: "Tally Reconciled",
            sublabel: "Auto-Posted to Ledger",
            count: totalReconciled,
            totalAmount: "₹2.24L",
            conversionPct: Math.round((totalReconciled / totalDispatched) * 100),
            color: "#10B981", // Emerald
            icon: CheckCircle2,
        },
    ];

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--gold)] bg-[var(--gold)]/10 px-2 py-0.5 rounded border border-[var(--gold)]/20">
                            [PIPELINE // VELOCITY]
                        </span>
                        <h3 className="font-semibold text-[var(--text-primary)] text-sm">
                            Distribution & Settlement Conversion Funnel
                        </h3>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                        End-to-end retail order intake to Tally Prime automated settlement
                    </p>
                </div>
                <Link
                    href="/orders"
                    className="text-xs text-[var(--gold)] hover:text-[var(--gold-light)] font-medium flex items-center gap-1 self-start sm:self-auto transition"
                >
                    View Pipeline <ArrowRight size={13} />
                </Link>
            </div>

            {/* Funnel Visual Horizontal Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative">
                {steps.map((step, idx) => {
                    const Icon = step.icon;
                    return (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: idx * 0.1 }}
                            className="p-4 rounded-lg bg-[var(--bg-secondary)]/50 border border-white/[0.05] hover:border-white/[0.12] transition-colors relative group flex flex-col justify-between"
                        >
                            {/* Top Step Badge */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
                                        style={{ backgroundColor: `${step.color}18` }}
                                    >
                                        <Icon size={16} style={{ color: step.color }} />
                                    </div>
                                    <span
                                        className="text-[11px] font-mono font-bold px-2 py-0.5 rounded"
                                        style={{
                                            backgroundColor: `${step.color}15`,
                                            color: step.color,
                                        }}
                                    >
                                        {idx === 0 ? "100% Volume" : `${step.conversionPct}% Yield`}
                                    </span>
                                </div>

                                <h4 className="text-xs font-semibold text-[var(--text-primary)]">{step.label}</h4>
                                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{step.sublabel}</p>
                            </div>

                            {/* Metrics & Progress Bar */}
                            <div className="mt-4 pt-3 border-t border-white/[0.04]">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-xl font-bold font-mono text-[var(--text-primary)]">
                                        {step.count}
                                    </span>
                                    {step.totalAmount && (
                                        <span className="text-xs font-mono font-medium text-[var(--text-muted)]">
                                            {step.totalAmount}
                                        </span>
                                    )}
                                </div>

                                {/* Custom Progress Fill */}
                                <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden mt-2">
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: step.color }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${step.conversionPct}%` }}
                                        transition={{ duration: 0.8, delay: 0.2 + idx * 0.1, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Bottom Quick Metric Ticker */}
            <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--green-bright)] animate-pulse" />
                    <span>Average AI order transcription time: <strong className="font-mono text-[var(--text-primary)]">2.4s</strong></span>
                </div>
                <div className="flex items-center gap-2">
                    <span>UPI instant payment capture: <strong className="font-mono text-[var(--green-bright)]">98.2%</strong></span>
                </div>
            </div>
        </div>
    );
}
