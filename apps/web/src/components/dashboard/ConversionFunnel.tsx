"use client";

import { motion } from "motion/react";
import { MessageSquare, Cpu, Truck, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatINR } from "./kpi-card";

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

export interface ConversionFunnelProps {
    totalVisits?: number;
    totalVisitsAmount?: number;
    totalOrders?: number;
    totalOrdersAmount?: number;
    totalDispatched?: number;
    totalDispatchedAmount?: number;
    totalReconciled?: number;
    totalReconciledAmount?: number;
    avgAiTranscriptionTime?: number;
    upiInstantCaptureRate?: number;
}

export function ConversionFunnel({
    totalVisits = 0,
    totalVisitsAmount = 0,
    totalOrders = 0,
    totalOrdersAmount = 0,
    totalDispatched = 0,
    totalDispatchedAmount = 0,
    totalReconciled = 0,
    totalReconciledAmount = 0,
    avgAiTranscriptionTime = 0,
    upiInstantCaptureRate,
}: ConversionFunnelProps) {
    const aiTranscribePct = totalVisits > 0 ? Math.min(100, Math.round((totalOrders / totalVisits) * 100)) : 0;
    const dispatchPct = totalOrders > 0 ? Math.min(100, Math.round((totalDispatched / totalOrders) * 100)) : 0;
    const reconcilePct = totalDispatched > 0 ? Math.min(100, Math.round((totalReconciled / totalDispatched) * 100)) : 0;

    const steps: FunnelStep[] = [
        {
            id: "inbound",
            label: "Inbound Demands",
            sublabel: "WhatsApp Voice + SFA Beats",
            count: totalVisits,
            totalAmount: formatINR(totalVisitsAmount),
            conversionPct: totalVisits > 0 ? 100 : 0,
            color: "#3B82F6", // Blue
            icon: MessageSquare,
        },
        {
            id: "ai_transcribe",
            label: "AI Transcribed",
            sublabel: "SKUs Auto-Matched",
            count: totalOrders,
            totalAmount: formatINR(totalOrdersAmount),
            conversionPct: aiTranscribePct,
            color: "#C9A84C", // Gold
            icon: Cpu,
        },
        {
            id: "dispatched",
            label: "Dispatched + UPI QR",
            sublabel: "PDF Invoice Dispatched",
            count: totalDispatched,
            totalAmount: formatINR(totalDispatchedAmount),
            conversionPct: dispatchPct,
            color: "#8B5CF6", // Purple
            icon: Truck,
        },
        {
            id: "reconciled",
            label: "Tally Reconciled",
            sublabel: "Auto-Posted to Ledger",
            count: totalReconciled,
            totalAmount: formatINR(totalReconciledAmount),
            conversionPct: reconcilePct,
            color: "#10B981", // Emerald
            icon: CheckCircle2,
        },
    ];

    const hasPipelineData = totalVisits > 0 || totalOrders > 0 || totalDispatched > 0 || totalReconciled > 0;

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
                        {hasPipelineData
                            ? "End-to-end retail order intake to Tally Prime automated settlement"
                            : "No pipeline records detected yet for current tenant. Stage yields will compute dynamically as orders are processed."}
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
                                        {idx === 0
                                            ? `${step.conversionPct}% Volume`
                                            : `${step.conversionPct}% Yield`}
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
                    <span>Average AI order transcription time: <strong className="font-mono text-[var(--text-primary)]">{avgAiTranscriptionTime > 0 ? `${avgAiTranscriptionTime}s` : "—"}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                    <span>UPI instant payment capture: <strong className="font-mono text-[var(--green-bright)]">{upiInstantCaptureRate !== undefined ? `${upiInstantCaptureRate}%` : "—"}</strong></span>
                </div>
            </div>
        </div>
    );
}
