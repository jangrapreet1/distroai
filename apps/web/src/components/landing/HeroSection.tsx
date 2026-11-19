"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Play, ShieldCheck, Zap } from "lucide-react";
import { InteractiveDemo } from "./InteractiveDemo";

export function HeroSection() {
    return (
        <section className="relative pt-24 sm:pt-32 pb-20 sm:pb-24 overflow-hidden border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950">
            {/* Subtle, Crisp Neutral Grid Background (Linear/Stripe standard) */}
            <div
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none -z-10"
                style={{
                    backgroundImage: "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                    maskImage: "radial-gradient(ellipse 60% 50% at 50% 20%, #000 70%, transparent 100%)",
                    WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 20%, #000 70%, transparent 100%)",
                }}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Center Hero Copy */}
                <div className="text-center max-w-4xl mx-auto space-y-6">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300"
                    >
                        <span className="flex h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                        <span className="text-[11px] font-medium tracking-wide uppercase">
                            AI-Native Distribution & Tally Sync Engine
                        </span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                        className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.08]"
                    >
                        Automate WhatsApp Orders, <br />
                        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
                            Sync with Tally in Real-Time.
                        </span>
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                        className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed font-normal"
                    >
                        The intelligent wholesale management platform for Indian FMCG, Pharma, and Hardware distributors. Eliminate manual order typing, prevent bad debt with automated credit scoring, and collect via dynamic UPI.
                    </motion.p>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
                    >
                        <Link
                            href="/register"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-medium text-sm transition-all duration-150"
                        >
                            <span>Start 14-Day Free Trial</span>
                            <ArrowRight size={16} />
                        </Link>

                        <a
                            href="#interactive-demo"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 font-medium text-sm transition-all duration-150"
                        >
                            <Play size={14} className="text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400" />
                            <span>Try WhatsApp Simulator</span>
                        </a>
                    </motion.div>

                    {/* Trust Indicators */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 text-xs text-zinc-500 dark:text-zinc-400"
                    >
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            <span>No Credit Card Required</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            <span>15-Minute Desktop Tally Sync</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            <span>GST E-Way Bill & Dynamic UPI</span>
                        </div>
                    </motion.div>
                </div>

                {/* Interactive Demo Section */}
                <motion.div
                    id="interactive-demo"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="mt-14 sm:mt-18 scroll-mt-24"
                >
                    <InteractiveDemo />
                </motion.div>
            </div>
        </section>
    );
}
