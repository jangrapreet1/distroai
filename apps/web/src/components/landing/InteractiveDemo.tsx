"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, CheckCheck, Sparkles, ShoppingCart, IndianRupee, FileText, CheckCircle2, Mic, Volume2 } from "lucide-react";

interface PresetItem {
    id: string;
    label: string;
    badge: string;
    isVoice?: boolean;
    userPrompt: string;
    botReply: string;
    invoice?: {
        invoiceNumber: string;
        amount: number;
        itemsCount: number;
    };
    erpStatus: {
        orderNumber: string;
        retailer: string;
        status: string;
        items: string;
        amount: string;
        riskScore: number;
    };
}

const PRESETS: PresetItem[] = [
    {
        id: "order",
        label: "📦 20 Cases Maggi + 10 Cases Parle-G",
        badge: "Hinglish Order",
        userPrompt: "Bhai 20 peti Maggi 70g & 10 peti Parle-G Gold bhej do kal tak, urgent hai!",
        botReply: "✅ Order Confirmed! (Order #ORD-8492)\n\n• 20x Maggi 70g (₹1,440/case) = ₹28,800\n• 10x Parle-G Gold (₹720/case) = ₹7,200\n\n💰 Subtotal: ₹36,000\n🏷️ Gold Dealer Scheme (3%): -₹1,080\n📊 GST (18% / 12%): ₹4,820\n━━━━━━━━━━━━━━━━━━━━\n💵 Total Bill: ₹39,740\n\nStock reserved in Warehouse-1. Dispatch scheduled for tomorrow 10:00 AM.",
        invoice: {
            invoiceNumber: "INV-2026-0849",
            amount: 39740,
            itemsCount: 2,
        },
        erpStatus: {
            orderNumber: "ORD-8492",
            retailer: "Sharma Kirana Store (Gold Tier)",
            status: "TALLY_SYNC_QUEUED",
            items: "Maggi 70g (20), Parle-G (10)",
            amount: "₹39,740",
            riskScore: 94,
        },
    },
    {
        id: "voice",
        label: "🎙️ Hindi Voice Note Order",
        badge: "Voice Transcription",
        isVoice: true,
        userPrompt: "Voice Note (0:08): \"Bhaiya 15 carton Fortune Sunlite oil aur 5 bori Dawat Basmati dispatch karwao\"",
        botReply: "🎙️ *Voice Note Transcribed & Verified:*\n\n1. Fortune Sunlite 1L (15 Cases) — ₹24,000\n2. Dawat Basmati 25kg (5 Bags) — ₹12,500\n\n💰 Net Total: ₹36,500 (Taxes Included)\n📄 Invoice PDF & Dynamic UPI QR dispatched below.",
        invoice: {
            invoiceNumber: "INV-2026-0850",
            amount: 36500,
            itemsCount: 2,
        },
        erpStatus: {
            orderNumber: "ORD-8493",
            retailer: "Gupta Traders (Wholesale)",
            status: "VOICE_PROCESSED",
            items: "Fortune Oil (15), Basmati (5)",
            amount: "₹36,500",
            riskScore: 88,
        },
    },
    {
        id: "ledger",
        label: "🧾 Outstanding Ledger Inquiry",
        badge: "Auto Statement",
        userPrompt: "Mera purana balance kitna baki hai aur last payment receive hui kya?",
        botReply: "Namaste Sharma ji! 🙏\n\n📊 *Ledger Summary for Sharma Kirana:*\n• Total Outstanding: ₹18,400\n• Overdue (>30 Days): ₹0 (Nil)\n• Last Payment: ₹25,000 via UPI on 24 Aug\n\n📄 Detailed Ledger PDF statement sent above.",
        invoice: {
            invoiceNumber: "LEDGER-AUG-2026",
            amount: 18400,
            itemsCount: 1,
        },
        erpStatus: {
            orderNumber: "STATEMENT-REQ",
            retailer: "Sharma Kirana Store",
            status: "STATEMENT_DISPATCHED",
            items: "Ledger PDF via Tally Bridge",
            amount: "₹18,400 Due",
            riskScore: 94,
        },
    },
];

export function InteractiveDemo() {
    const [activePresetIndex, setActivePresetIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const active = PRESETS[activePresetIndex];

    const handleSelectPreset = (idx: number) => {
        if (idx === activePresetIndex) return;
        setIsTyping(true);
        setActivePresetIndex(idx);
        setTimeout(() => setIsTyping(false), 900);
    };

    return (
        <div className="relative rounded-3xl border border-white/[0.08] bg-[#07070B] p-4 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-2xl overflow-hidden">
            {/* Top Luminous Bar */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--gold)]/60 to-transparent" />

            {/* Header / Preset Picker */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] text-[11px] font-mono font-semibold uppercase tracking-wider mb-2">
                        <Sparkles size={12} />
                        <span>[DEMO // LIVE_SIMULATOR]</span>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-bold text-[var(--text-primary)]">
                        Experience the WhatsApp ➔ Tally Invoicing Pipeline
                    </h3>
                </div>

                {/* Preset Tabs with Layout Animation */}
                <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset, idx) => (
                        <button
                            key={preset.id}
                            onClick={() => handleSelectPreset(idx)}
                            className={`relative px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-200 ${
                                activePresetIndex === idx
                                    ? "text-[#07070E]"
                                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-white/[0.02] border border-white/[0.06]"
                            }`}
                        >
                            {activePresetIndex === idx && (
                                <motion.div
                                    layoutId="activePresetPill"
                                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-[var(--gold)] via-[var(--gold-light)] to-[#FFE8A3] shadow-md shadow-amber-500/20"
                                />
                            )}
                            <span className="relative z-10">{preset.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Split Screen Simulator */}
            <div className="grid lg:grid-cols-12 gap-6 mt-6">
                {/* Left Side: WhatsApp Interface */}
                <div className="lg:col-span-6 flex flex-col rounded-2xl border border-emerald-500/20 bg-[#0B141A] overflow-hidden shadow-2xl">
                    {/* WhatsApp Top Bar */}
                    <div className="bg-[#1F2C34] px-4 py-3 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                D
                            </div>
                            <div>
                                <h4 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5">
                                    DistroAI Inbound Assistant
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                </h4>
                                <p className="text-[10px] text-emerald-400/80 font-mono">META_CLOUD_API // ACTIVE</p>
                            </div>
                        </div>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/30">
                            Verified Bot
                        </span>
                    </div>

                    {/* Chat Messages Body */}
                    <div className="p-4 space-y-4 flex-1 bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px] min-h-[330px] flex flex-col justify-end">
                        {/* Retailer Inbound Message */}
                        <motion.div
                            key={`user-${active.id}`}
                            initial={{ opacity: 0, y: 10, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.25 }}
                            className="flex justify-end"
                        >
                            <div className="max-w-[85%] bg-[#005C4B] text-emerald-50 p-3.5 rounded-2xl rounded-tr-none shadow-sm text-xs sm:text-sm">
                                {active.isVoice ? (
                                    <div className="flex items-center gap-3 py-1">
                                        <div className="p-2 rounded-full bg-emerald-700 text-emerald-200">
                                            <Mic size={16} />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1">
                                                <div className="h-3 w-1 bg-cyan-400 rounded-full animate-pulse"></div>
                                                <div className="h-5 w-1 bg-cyan-400 rounded-full animate-pulse"></div>
                                                <div className="h-2 w-1 bg-cyan-400 rounded-full animate-pulse"></div>
                                                <div className="h-6 w-1 bg-cyan-400 rounded-full animate-pulse"></div>
                                                <div className="h-4 w-1 bg-cyan-400 rounded-full animate-pulse"></div>
                                                <div className="h-5 w-1 bg-cyan-400 rounded-full animate-pulse"></div>
                                            </div>
                                            <p className="text-[11px] text-emerald-100 italic">{active.userPrompt}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="leading-relaxed">{active.userPrompt}</p>
                                )}
                                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-emerald-200/70">
                                    <span>10:42 AM</span>
                                    <CheckCheck size={13} className="text-cyan-400" />
                                </div>
                            </div>
                        </motion.div>

                        {/* Bot Response (or typing dots) */}
                        {isTyping ? (
                            <div className="flex justify-start">
                                <div className="bg-[#202C33] px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5 border border-white/5">
                                    <motion.span
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ repeat: Infinity, duration: 0.6 }}
                                        className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                    />
                                    <motion.span
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                                        className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                    />
                                    <motion.span
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                                        className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                    />
                                </div>
                            </div>
                        ) : (
                            <motion.div
                                key={`bot-${active.id}`}
                                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.3 }}
                                className="flex justify-start"
                            >
                                <div className="max-w-[90%] bg-[#202C33] text-gray-100 p-4 rounded-2xl rounded-tl-none shadow-md text-xs sm:text-sm border border-white/5 space-y-3">
                                    <p className="whitespace-pre-line leading-relaxed">{active.botReply}</p>

                                    {active.invoice && (
                                        <div className="p-3 rounded-xl bg-[#111B21] border border-emerald-500/30 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <FileText size={20} className="text-emerald-400" />
                                                <div>
                                                    <p className="text-xs font-bold text-white">{active.invoice.invoiceNumber}.pdf</p>
                                                    <p className="text-[10px] text-gray-400 font-mono">Dynamic UPI QR • Instant Recon</p>
                                                </div>
                                            </div>
                                            <span className="text-[11px] bg-emerald-500 text-[#07070E] font-extrabold px-3 py-1 rounded-lg shadow-sm">
                                                Pay ₹{active.invoice.amount.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-end gap-1 text-[10px] text-gray-400">
                                        <span>10:42 AM</span>
                                        <Sparkles size={11} className="text-[var(--gold)]" />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* WhatsApp Input Bar */}
                    <div className="bg-[#1F2C34] px-4 py-2.5 flex items-center justify-between border-t border-white/5 text-gray-400 text-xs font-mono">
                        <span>💬 NLP PARSER // READY</span>
                        <span className="text-emerald-400 text-[11px]">⚡ 2.4s Latency</span>
                    </div>
                </div>

                {/* Right Side: Live ERP Console */}
                <div className="lg:col-span-6 flex flex-col rounded-2xl border border-white/[0.08] bg-[#0A0B10] overflow-hidden shadow-2xl">
                    {/* ERP Header */}
                    <div className="bg-white/[0.02] px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_rgba(201,168,76,0.6)]" />
                            <h4 className="text-xs font-mono font-bold text-[var(--text-primary)]">
                                [CONSOLE // REAL_TIME_OPS]
                            </h4>
                        </div>
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/25 flex items-center gap-1">
                            <CheckCircle2 size={11} /> TALLY_SYNC_CONNECTED
                        </span>
                    </div>

                    {/* Live Order Card */}
                    <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                        <motion.div
                            key={`erp-${active.id}`}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.35 }}
                            className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4 shadow-inner"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-[var(--gold)]">
                                    {active.erpStatus.orderNumber}
                                </span>
                                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {active.erpStatus.status}
                                </span>
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--text-secondary)]">Customer Account:</span>
                                    <span className="font-semibold text-[var(--text-primary)]">{active.erpStatus.retailer}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--text-secondary)]">Catalog SKUs:</span>
                                    <span className="font-medium text-[var(--text-primary)]">{active.erpStatus.items}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--text-secondary)]">Bill Net Value:</span>
                                    <span className="font-bold text-[var(--gold)] font-mono text-base">{active.erpStatus.amount}</span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                                <span className="text-[var(--text-secondary)]">AI Credit Risk Velocity:</span>
                                <span className="text-emerald-400 font-bold font-mono flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    {active.erpStatus.riskScore}/100 (Optimal Credit)
                                </span>
                            </div>
                        </motion.div>

                        {/* Completed Pipelines */}
                        <div className="space-y-2">
                            <p className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                                [AUTOMATED_PIPELINES_COMPLETED]
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2 text-[var(--text-secondary)]">
                                    <CheckCircle2 size={14} className="text-[var(--green-bright)] shrink-0" />
                                    <span>Stock Reserved (W-1)</span>
                                </div>
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2 text-[var(--text-secondary)]">
                                    <CheckCircle2 size={14} className="text-[var(--green-bright)] shrink-0" />
                                    <span>Tally Voucher Synced</span>
                                </div>
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2 text-[var(--text-secondary)]">
                                    <CheckCircle2 size={14} className="text-[var(--green-bright)] shrink-0" />
                                    <span>GST Taxes Auto-Split</span>
                                </div>
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2 text-[var(--text-secondary)]">
                                    <CheckCircle2 size={14} className="text-[var(--green-bright)] shrink-0" />
                                    <span>Dynamic UPI QR Created</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
