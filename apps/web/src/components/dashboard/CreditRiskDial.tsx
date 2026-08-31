"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { ShieldCheck, AlertCircle, ArrowUpRight, Clock, Users, Zap } from "lucide-react";
import Link from "next/link";
import { formatINR } from "./kpi-card";

interface CreditRiskDialProps {
    score?: number; // 0 to 100
    totalOutstanding: number;
    totalCreditLimit?: number;
    highRiskCount?: number;
    avgDsoDays?: number;
}

export function CreditRiskDial({
    score = 88,
    totalOutstanding,
    totalCreditLimit = 1500000,
    highRiskCount = 2,
    avgDsoDays = 22,
}: CreditRiskDialProps) {
    const { status, color, bgColor, label } = useMemo(() => {
        if (score >= 80) {
            return {
                status: "OPTIMAL",
                color: "#10B981",
                bgColor: "rgba(16, 185, 129, 0.12)",
                label: "Healthy Settlement Velocity",
            };
        } else if (score >= 55) {
            return {
                status: "WATCHLIST",
                color: "#F59E0B",
                bgColor: "rgba(245, 158, 11, 0.12)",
                label: "Moderate Aging Exposure",
            };
        } else {
            return {
                status: "HIGH RISK",
                color: "#EF4444",
                bgColor: "rgba(239, 68, 68, 0.12)",
                label: "High Default Vulnerability",
            };
        }
    }, [score]);

    // Gauge geometry (Semi-circle 180 deg)
    const radius = 64;
    const strokeWidth = 9;
    const circumference = Math.PI * radius; // Half circumference
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const utilizationPct = totalCreditLimit > 0 ? Math.round((totalOutstanding / totalCreditLimit) * 100) : 0;

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 flex flex-col justify-between relative overflow-hidden group">
            {/* Ambient Background Glow */}
            <div
                className="absolute top-0 right-0 w-48 h-48 blur-3xl pointer-events-none -z-0 opacity-20 transition-opacity group-hover:opacity-30"
                style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
            />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bgColor }}>
                        <ShieldCheck size={18} style={{ color }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Credit & Risk Velocity</h3>
                        <p className="text-[11px] text-[var(--text-muted)] font-mono">Bklit Health Metric</p>
                    </div>
                </div>
                <span
                    className="text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border"
                    style={{
                        backgroundColor: bgColor,
                        color: color,
                        borderColor: `${color}30`,
                    }}
                >
                    {status}
                </span>
            </div>

            {/* Gauge Dial Visual */}
            <div className="relative z-10 my-2 flex flex-col items-center justify-center">
                <div className="relative w-44 h-24 flex items-end justify-center overflow-hidden">
                    <svg className="w-44 h-44 absolute -top-0" viewBox="0 0 160 160">
                        {/* Background Track Arc */}
                        <path
                            d="M 16 80 A 64 64 0 0 1 144 80"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.08)"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                        />
                        {/* Animated Value Arc */}
                        <motion.path
                            d="M 16 80 A 64 64 0 0 1 144 80"
                            fill="none"
                            stroke={color}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                        />
                    </svg>

                    {/* Dial Score Display */}
                    <div className="text-center z-10 pb-1">
                        <motion.span
                            className="text-3xl font-bold font-mono tracking-tight text-[var(--text-primary)]"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            {score}
                        </motion.span>
                        <span className="text-xs font-mono text-[var(--text-muted)]">/100</span>
                        <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">{label}</p>
                    </div>
                </div>
            </div>

            {/* Micro-telemetry Breakdown Grid */}
            <div className="relative z-10 grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[var(--border)] text-xs">
                <div className="p-2 rounded-lg bg-[var(--bg-secondary)]/60 border border-white/[0.04]">
                    <div className="flex items-center gap-1 text-[var(--text-muted)] mb-1">
                        <Clock size={12} />
                        <span>Avg DSO</span>
                    </div>
                    <p className="font-mono font-semibold text-[var(--text-primary)]">{avgDsoDays} Days</p>
                    <span className="text-[10px] text-[var(--green-bright)]">14d faster than avg</span>
                </div>

                <div className="p-2 rounded-lg bg-[var(--bg-secondary)]/60 border border-white/[0.04]">
                    <div className="flex items-center gap-1 text-[var(--text-muted)] mb-1">
                        <Users size={12} />
                        <span>Watchlist</span>
                    </div>
                    <p className="font-mono font-semibold text-[var(--text-primary)]">{highRiskCount} Retailers</p>
                    <span className="text-[10px] text-[var(--gold)]">₹42k at risk</span>
                </div>
            </div>

            {/* Footer Action Link */}
            <div className="relative z-10 mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                <div className="text-[11px] text-[var(--text-muted)]">
                    Limit Utilized: <span className="font-mono font-semibold text-[var(--text-primary)]">{utilizationPct}%</span>
                </div>
                <Link
                    href="/customers?tab=credit"
                    className="text-xs text-[var(--gold)] hover:text-[var(--gold-light)] font-medium flex items-center gap-1 transition"
                >
                    Risk Matrix <ArrowUpRight size={13} />
                </Link>
            </div>
        </div>
    );
}
