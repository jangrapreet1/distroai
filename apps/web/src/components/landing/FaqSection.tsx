"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, HelpCircle, MessageSquare } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface FaqItem {
    q: string;
    a: string;
}

const FAQS: FaqItem[] = [
    {
        q: "Do I need to replace or stop using Tally Prime?",
        a: "No, absolutely not. DistroAI works alongside your existing Tally installation. Your accountant continues working in Tally as usual. Our lightweight desktop bridge syncs vouchers, sales entries, payments, and ledger balances in real-time in both directions.",
    },
    {
        q: "How does the AI understand messy Hinglish, spelling mistakes, or voice notes?",
        a: "We train our NLP models specifically on Indian trade vernacular and FMCG/pharma brand abbreviations (e.g. '20 peti Maggi', 'Dettol 100ml 2 dzn', 'Parle G bada packet'). The model uses vector embeddings with pgvector to match informal retailer phrasing to your exact Tally SKU codes with over 99.4% precision.",
    },
    {
        q: "Can my field salesmen use the app in rural areas without 4G mobile internet?",
        a: "Yes. The DistroAI Field SFA mobile app is built offline-first with local SQLite caching. Sales reps can view catalog items, record orders, calculate schemes, and print Bluetooth slips with zero connectivity. Orders automatically queue and sync the moment internet reconnects.",
    },
    {
        q: "How does the Dynamic UPI QR code improve collections?",
        a: "Every generated invoice includes an NPCI-compliant dynamic UPI QR code containing your UPI ID, the exact balance due amount, and the invoice number. When a kirana owner scans with PhonePe, Google Pay, or Paytm, the amount is pre-filled, preventing partial or mismatched payments.",
    },
    {
        q: "Is my business financial data secure and isolated?",
        a: "Yes. DistroAI enforces absolute multi-tenant database isolation using PostgreSQL Row-Level Security (RLS). Every query is strictly isolated by your distributor ID. We use AES-256 encryption at rest, TLS 1.3 in transit, and continuous WAL-G offsite backups.",
    },
    {
        q: "How long does setup take?",
        a: "Most distributors are up and running in under 15 minutes. Connect your WhatsApp Business number, install the 1-click Tally bridge agent on your desktop, and your catalog & ledgers sync automatically.",
    },
];

export function FaqSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggle = (idx: number) => {
        setOpenIndex(openIndex === idx ? null : idx);
    };

    return (
        <section id="faq" className="py-24 relative overflow-hidden scroll-mt-28">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] text-[var(--gold)] text-[11px] font-mono font-semibold uppercase tracking-wider border border-white/[0.08]">
                        <HelpCircle size={12} />
                        <span>[KNOWLEDGE_BASE // FREQUENTLY_ASKED]</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                        Frequently Asked Questions
                    </h2>
                    <p className="text-sm sm:text-base text-[var(--text-secondary)]">
                        Everything you need to know about integrating DistroAI with your distribution business.
                    </p>
                </div>

                {/* FAQ Accordion List */}
                <div className="space-y-3.5">
                    {FAQS.map((faq, idx) => {
                        const isOpen = openIndex === idx;
                        return (
                            <SpotlightCard
                                key={idx}
                                spotlightColor="rgba(201, 168, 76, 0.08)"
                                className={`border-white/[0.08] bg-[#07070C] transition-colors duration-200 ${
                                    isOpen ? "border-[var(--gold)]/30 bg-[#090912]" : ""
                                }`}
                            >
                                <button
                                    onClick={() => toggle(idx)}
                                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                                >
                                    <span className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                                        {faq.q}
                                    </span>
                                    <motion.div
                                        animate={{ rotate: isOpen ? 180 : 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="text-[var(--gold)] shrink-0"
                                    >
                                        <ChevronDown size={18} />
                                    </motion.div>
                                </button>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed border-t border-white/[0.04] pt-4">
                                                {faq.a}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </SpotlightCard>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
