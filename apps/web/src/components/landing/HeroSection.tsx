"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck, Zap, TrendingUp, CheckCircle, Play } from "lucide-react";
import { InteractiveDemo } from "./InteractiveDemo";

export function HeroSection() {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.15),transparent_70%)] pointer-events-none -z-10" />
            <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-[radial-gradient(ellipse_at_center,rgba(123,94,167,0.1),transparent_70%)] pointer-events-none -z-10" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Center Hero Copy */}
                <div className="text-center max-w-4xl mx-auto space-y-6">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--bg-card)] backdrop-blur-md shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <span className="flex h-2 w-2 rounded-full bg-[var(--gold)] animate-ping" />
                        <span className="text-xs font-semibold text-[var(--gold)] tracking-wide uppercase">
                            The AI-Native ERP for Indian Distribution & FMCG
                        </span>
                    </div>

                    {/* Headline */}
                    <h1
                        className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.1]"
                        style={{ fontFamily: "var(--font-playfair)" }}
                    >
                        Automate WhatsApp Orders, <br />
                        <span className="bg-gradient-to-r from-[var(--gold)] via-[var(--gold-light)] to-[#FFE8A3] bg-clip-text text-transparent">
                            Sync with Tally in Real-Time.
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
                        DistroAI empowers distributors, wholesalers, and super-stockists across India to eliminate manual order typing, recover bad debts with AI payment scoring, and track salesmen GPS beat routes.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
                        <Link
                            href="/register"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--gold)] to-[var(--gold-light)] text-[#07070E] font-bold text-base hover:opacity-95 shadow-xl shadow-amber-500/15 hover:shadow-amber-500/25 transform hover:-translate-y-0.5 transition duration-200"
                        >
                            <span>Start 14-Day Free Trial</span>
                            <ArrowRight size={18} />
                        </Link>

                        <a
                            href="#interactive-demo"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold text-base hover:border-[var(--border-accent)] hover:bg-[var(--bg-card-hover)] transition duration-200"
                        >
                            <Play size={16} className="text-[var(--gold)] fill-[var(--gold)]" />
                            <span>Try WhatsApp Demo Below</span>
                        </a>
                    </div>

                    {/* Key Highlights / Trust Checklist */}
                    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-4 text-xs sm:text-sm text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle size={16} className="text-[var(--green-bright)]" />
                            <span>No Credit Card Required</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckCircle size={16} className="text-[var(--green-bright)]" />
                            <span>15-Minute Tally Prime Setup</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckCircle size={16} className="text-[var(--green-bright)]" />
                            <span>GST E-Way Bill & Invoicing Ready</span>
                        </div>
                    </div>
                </div>

                {/* Interactive Demo Section */}
                <div id="interactive-demo" className="mt-16 sm:mt-20">
                    <InteractiveDemo />
                </div>
            </div>
        </section>
    );
}
