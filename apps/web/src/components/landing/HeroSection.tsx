"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Sparkles, CheckCircle2, Play, Terminal, ShieldCheck } from "lucide-react";
import { InteractiveDemo } from "./InteractiveDemo";

export function HeroSection() {
    return (
        <section className="relative pt-32 pb-24 overflow-hidden">
            {/* Background Grid Texture with Radial Fade */}
            <div
                className="absolute inset-0 opacity-25 pointer-events-none -z-20"
                style={{
                    backgroundImage: "radial-gradient(rgba(201, 168, 76, 0.22) 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                    maskImage: "radial-gradient(ellipse 70% 55% at 50% 15%, #000 65%, transparent 100%)",
                    WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 15%, #000 65%, transparent 100%)",
                }}
            />

            {/* Ambient Animated Glow Spotlights */}
            <motion.div
                animate={{
                    scale: [1, 1.12, 1],
                    opacity: [0.15, 0.25, 0.15],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.35),transparent_70%)] blur-3xl pointer-events-none -z-10"
            />
            <div className="absolute top-44 right-1/4 w-[350px] h-[250px] bg-[radial-gradient(ellipse_at_center,rgba(123,94,167,0.2),transparent_70%)] blur-3xl pointer-events-none -z-10" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Center Hero Copy */}
                <div className="text-center max-w-4xl mx-auto space-y-7">
                    {/* Glowing Tech Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl shadow-inner shadow-white/[0.03]"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-[var(--gold)] shadow-[0_0_8px_rgba(201,168,76,0.8)] animate-pulse" />
                        <span className="text-[11px] font-mono font-semibold text-[var(--gold)] tracking-widest uppercase">
                            [01 // AI_DISTRIBUTION_ENGINE_INDIA]
                        </span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                        className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.08]"
                        style={{ fontFamily: "var(--font-playfair)" }}
                    >
                        Automate WhatsApp Orders, <br />
                        <span className="bg-gradient-to-r from-[var(--gold)] via-[var(--gold-light)] to-[#FFE8A3] bg-clip-text text-transparent drop-shadow-sm">
                            Sync with Tally in Real-Time.
                        </span>
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                        className="text-base sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed font-normal"
                    >
                        The AI-native distribution platform for Indian FMCG, Pharma, and Hardware traders. Eliminate manual order typing, prevent bad debt with ML credit scoring, and track salesmen beat routes.
                    </motion.p>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2"
                    >
                        <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                            <Link
                                href="/register"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-[var(--gold)] via-[var(--gold-light)] to-[#FFE8A3] text-[#07070E] font-bold text-sm shadow-xl shadow-amber-500/20 hover:opacity-95 transition duration-200"
                            >
                                <span>Start 14-Day Free Trial</span>
                                <ArrowRight size={17} />
                            </Link>
                        </motion.div>

                        <motion.a
                            href="#interactive-demo"
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[var(--text-primary)] font-semibold text-sm hover:border-[var(--border-accent)] hover:bg-white/[0.04] backdrop-blur-md transition duration-200"
                        >
                            <Play size={15} className="text-[var(--gold)] fill-[var(--gold)]" />
                            <span>Try WhatsApp Simulator</span>
                        </motion.a>
                    </motion.div>

                    {/* Trust Indicators */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-3 text-xs text-[var(--text-secondary)]"
                    >
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-[var(--green-bright)]" />
                            <span>No Credit Card Required</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-[var(--green-bright)]" />
                            <span>15-Min Desktop Tally Setup</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-[var(--green-bright)]" />
                            <span>GST E-Way Bill & Dynamic UPI Ready</span>
                        </div>
                    </motion.div>
                </div>

                {/* Interactive Demo Section */}
                <motion.div
                    id="interactive-demo"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="mt-16 sm:mt-20 scroll-mt-28"
                >
                    <InteractiveDemo />
                </motion.div>
            </div>
        </section>
    );
}
