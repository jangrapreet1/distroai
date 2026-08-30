"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck, MessageSquare, Mail, Phone } from "lucide-react";
import { Logo } from "@/components/Logo";

export function LandingFooter() {
    return (
        <footer className="border-t border-[var(--border)] bg-[#05050A] text-[var(--text-secondary)]">
            {/* Final CTA Banner */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -translate-y-12">
                <div className="rounded-3xl border border-[var(--border-accent)] bg-gradient-to-r from-[var(--bg-secondary)] via-[var(--bg-card)] to-[var(--bg-secondary)] p-8 sm:p-14 shadow-2xl relative overflow-hidden text-center space-y-6">
                    <div className="absolute inset-0 bg-radial-gradient from-[var(--gold)]/10 to-transparent pointer-events-none" />

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold)]/15 text-[var(--gold)] text-xs font-semibold uppercase tracking-wider">
                        <Sparkles size={13} />
                        <span>Zero Risk • Instant Setup</span>
                    </div>

                    <h2
                        className="text-3xl sm:text-5xl font-extrabold text-[var(--text-primary)] tracking-tight max-w-3xl mx-auto"
                        style={{ fontFamily: "var(--font-playfair)" }}
                    >
                        Ready to Automate Your Distribution & Recover Lost Cashflow?
                    </h2>

                    <p className="text-[var(--text-secondary)] text-sm sm:text-base max-w-2xl mx-auto">
                        Join forward-thinking FMCG, Pharma, and Hardware distributors across India running their operations on DistroAI.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        <Link
                            href="/register"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--gold)] to-[var(--gold-light)] text-[#07070E] font-bold text-base hover:opacity-95 shadow-xl shadow-amber-500/20 transform hover:-translate-y-0.5 transition duration-200"
                        >
                            <span>Start 14-Day Free Trial</span>
                            <ArrowRight size={18} />
                        </Link>
                        <Link
                            href="/login"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold text-sm hover:border-[var(--border-accent)] transition"
                        >
                            <span>Sign In to Existing Account</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Footer Navigation Columns */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
                    {/* Brand Col */}
                    <div className="col-span-2 space-y-4">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="text-[var(--gold)]">
                                <Logo className="w-7 h-7" textCls="text-xl font-bold tracking-tight text-[var(--text-primary)]" />
                            </div>
                        </Link>
                        <p className="text-xs text-[var(--text-muted)] max-w-sm leading-relaxed">
                            DistroAI is the AI-native ERP, field sales force automation, and WhatsApp order processing platform built specifically for Indian distributors and traders.
                        </p>
                        <div className="flex items-center gap-2 text-xs text-[var(--gold)]">
                            <ShieldCheck size={16} />
                            <span>Enterprise PostgreSQL RLS & WAL-G Backups</span>
                        </div>
                    </div>

                    {/* Col 1: Product */}
                    <div className="space-y-3 text-xs">
                        <p className="font-semibold text-[var(--text-primary)] uppercase tracking-wider">Product</p>
                        <ul className="space-y-2 text-[var(--text-muted)]">
                            <li><a href="#whatsapp-ai" className="hover:text-[var(--gold)] transition">WhatsApp AI Bot</a></li>
                            <li><a href="#tally-bridge" className="hover:text-[var(--gold)] transition">Tally ERP Bridge</a></li>
                            <li><a href="#features" className="hover:text-[var(--gold)] transition">Field SFA App</a></li>
                            <li><a href="#features" className="hover:text-[var(--gold)] transition">Demand Forecasting</a></li>
                            <li><a href="#pricing" className="hover:text-[var(--gold)] transition">Pricing Plans</a></li>
                        </ul>
                    </div>

                    {/* Col 2: Integrations */}
                    <div className="space-y-3 text-xs">
                        <p className="font-semibold text-[var(--text-primary)] uppercase tracking-wider">Integrations</p>
                        <ul className="space-y-2 text-[var(--text-muted)]">
                            <li><span className="hover:text-[var(--gold)]">Tally Prime & 9</span></li>
                            <li><span className="hover:text-[var(--gold)]">Meta WhatsApp API</span></li>
                            <li><span className="hover:text-[var(--gold)]">GST Portal & E-Way Bill</span></li>
                            <li><span className="hover:text-[var(--gold)]">NPCI UPI Dynamic QR</span></li>
                            <li><span className="hover:text-[var(--gold)]">Razorpay Payments</span></li>
                        </ul>
                    </div>

                    {/* Col 3: Support & Contact */}
                    <div className="space-y-3 text-xs">
                        <p className="font-semibold text-[var(--text-primary)] uppercase tracking-wider">Contact & Help</p>
                        <ul className="space-y-2 text-[var(--text-muted)]">
                            <li className="flex items-center gap-1.5"><Mail size={13} className="text-[var(--gold)]" /> support@distroai.com</li>
                            <li className="flex items-center gap-1.5"><Phone size={13} className="text-[var(--gold)]" /> +91 (0) 800-DISTRO</li>
                            <li><a href="#faq" className="hover:text-[var(--gold)] transition">FAQ & Help Desk</a></li>
                            <li><Link href="/login" className="hover:text-[var(--gold)] transition">Distributor Portal</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-12 mt-12 border-t border-[var(--border)]/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
                    <p>© {new Date().getFullYear()} DistroAI Technologies Private Limited. All rights reserved.</p>
                    <div className="flex items-center gap-6">
                        <Link href="/privacy" className="hover:text-[var(--text-secondary)] transition">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-[var(--text-secondary)] transition">Terms of Service</Link>
                        <Link href="/security" className="hover:text-[var(--text-secondary)] transition">Security Guidelines</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
