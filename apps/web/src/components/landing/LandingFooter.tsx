"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Sparkles, Shield, Heart, ExternalLink, Terminal } from "lucide-react";
import { Logo } from "@/components/Logo";

export function LandingFooter() {
    return (
        <footer className="relative bg-[#030306] border-t border-white/[0.08] pt-20 pb-12 overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.15),transparent_70%)] blur-3xl pointer-events-none -z-10" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
                {/* Final Pre-Footer High-Converting CTA Banner */}
                <div className="relative rounded-3xl border border-[var(--gold)]/30 bg-gradient-to-b from-[#121220] via-[#090912] to-[#040408] p-8 sm:p-14 text-center space-y-6 shadow-2xl shadow-amber-500/10 overflow-hidden">
                    {/* Top Luminous Glow Bar */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent" />

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] text-[11px] font-mono font-semibold uppercase tracking-wider border border-[var(--gold)]/20">
                        <Sparkles size={12} />
                        <span>[ONBOARDING // 14_DAY_TRIAL]</span>
                    </div>

                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-3xl mx-auto leading-tight" style={{ fontFamily: "var(--font-playfair)" }}>
                        Transform Your Distribution Business with AI Today
                    </h2>

                    <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto">
                        Join 150+ leading Indian distributors automating orders, synchronizing Tally, and speeding up cash collection.
                    </p>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                        <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                            <Link
                                href="/register"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-[var(--gold)] via-[var(--gold-light)] to-[#FFE8A3] text-[#07070E] font-bold text-sm shadow-xl shadow-amber-500/20 hover:opacity-95 transition"
                            >
                                <span>Start 14-Day Free Trial</span>
                                <ArrowRight size={17} />
                            </Link>
                        </motion.div>
                        <a
                            href="https://wa.me/919999999999?text=Hi%2C%20I%20would%20like%20a%20demo%20of%20DistroAI"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[var(--text-primary)] font-semibold text-sm hover:border-[var(--border-accent)] transition"
                        >
                            <span>Chat with an Expert on WhatsApp</span>
                            <ExternalLink size={14} />
                        </a>
                    </div>
                </div>

                {/* Footer Navigation Columns */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pt-8 border-t border-white/[0.06]">
                    {/* Brand Col */}
                    <div className="col-span-2 space-y-4">
                        <Logo className="w-8 h-8" textCls="text-2xl font-bold tracking-tight text-white" />
                        <p className="text-xs text-[var(--text-secondary)] max-w-sm leading-relaxed">
                            The AI-native distribution operating system designed specifically for Indian FMCG, Pharma, and Hardware traders.
                        </p>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>STATUS // ALL_SYSTEMS_OPERATIONAL</span>
                        </div>
                    </div>

                    {/* Product Links */}
                    <div className="space-y-3 text-xs">
                        <h4 className="font-mono uppercase tracking-wider text-[var(--gold)] font-bold">Product</h4>
                        <ul className="space-y-2 text-[var(--text-secondary)]">
                            <li><a href="#features" className="hover:text-white transition">WhatsApp AI Ordering</a></li>
                            <li><a href="#tally-bridge" className="hover:text-white transition">Tally Prime XML Bridge</a></li>
                            <li><a href="#features" className="hover:text-white transition">Prophet Demand Forecasting</a></li>
                            <li><a href="#features" className="hover:text-white transition">Field SFA Beat Tracking</a></li>
                            <li><a href="#roi-calculator" className="hover:text-white transition">ROI Calculator</a></li>
                        </ul>
                    </div>

                    {/* Solutions Links */}
                    <div className="space-y-3 text-xs">
                        <h4 className="font-mono uppercase tracking-wider text-[var(--gold)] font-bold">Verticals</h4>
                        <ul className="space-y-2 text-[var(--text-secondary)]">
                            <li><span className="hover:text-white transition cursor-default">FMCG & Packaged Foods</span></li>
                            <li><span className="hover:text-white transition cursor-default">Pharma & Healthcare</span></li>
                            <li><span className="hover:text-white transition cursor-default">Hardware & Electricals</span></li>
                            <li><span className="hover:text-white transition cursor-default">Lubricants & Auto Parts</span></li>
                            <li><span className="hover:text-white transition cursor-default">Paints & Chemicals</span></li>
                        </ul>
                    </div>

                    {/* Security & Legal */}
                    <div className="space-y-3 text-xs">
                        <h4 className="font-mono uppercase tracking-wider text-[var(--gold)] font-bold">Security</h4>
                        <ul className="space-y-2 text-[var(--text-secondary)]">
                            <li><span className="hover:text-white transition cursor-default">Postgres Row-Level Security</span></li>
                            <li><span className="hover:text-white transition cursor-default">AES-256 Cloud Encryption</span></li>
                            <li><span className="hover:text-white transition cursor-default">Continuous WAL-G Backups</span></li>
                            <li><span className="hover:text-white transition cursor-default">NPCI UPI Spec Compliant</span></li>
                            <li><span className="hover:text-white transition cursor-default">Privacy Policy & Terms</span></li>
                        </ul>
                    </div>
                </div>

                {/* Copyright Line */}
                <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
                    <p>© {new Date().getFullYear()} DistroAI Technologies Private Limited. All rights reserved.</p>
                    <p className="flex items-center gap-1">
                        Crafted for Indian Traders with <Heart size={12} className="text-rose-500 fill-rose-500" />
                    </p>
                </div>
            </div>
        </footer>
    );
}
