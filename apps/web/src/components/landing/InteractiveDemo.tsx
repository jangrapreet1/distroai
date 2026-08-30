"use client";

import { useState } from "react";
import { MessageSquare, Check, CheckCheck, ArrowRight, Sparkles, RefreshCw, ShoppingCart, IndianRupee, FileText, CheckCircle2, ShieldAlert } from "lucide-react";

interface ChatMessage {
    id: string;
    sender: "retailer" | "bot";
    text: string;
    time: string;
    invoicePreview?: {
        invoiceNumber: string;
        amount: number;
        itemsCount: number;
        upiLink: boolean;
    };
}

const PRESETS = [
    {
        id: "order",
        label: "📦 Order 20 Cases Maggi + 10 Cases Parle-G",
        userPrompt: "Bhai 20 peti Maggi 70g & 10 peti Parle-G Gold bhej do kal tak, urgent hai!",
        botReply: "✅ Order Confirmed! (Order #ORD-8492)\n\n• 20x Maggi 70g (₹1,440/case) = ₹28,800\n• 10x Parle-G Gold (₹720/case) = ₹7,200\n\n💰 Subtotal: ₹36,000\n🏷️ Gold Dealer Discount (3%): -₹1,080\n📊 GST (18% / 12%): ₹4,820\n━━━━━━━━━━━━━━━━━━━━\n💵 Total Bill: ₹39,740\n\nStock reserved in Warehouse-1. Dispatch scheduled for tomorrow 10:00 AM.",
        invoice: {
            invoiceNumber: "INV-2026-0849",
            amount: 39740,
            itemsCount: 2,
            upiLink: true,
        },
        erpStatus: {
            orderNumber: "ORD-8492",
            retailer: "Sharma Kirana Store (Gold Tier)",
            status: "CONFIRMED & TALLY QUEUED",
            items: "Maggi 70g (20), Parle-G (10)",
            amount: "₹39,740",
            riskScore: 94,
        },
    },
    {
        id: "ledger",
        label: "🧾 Check Outstanding Ledger Balance",
        userPrompt: "Mera purana balance kitna baki hai aur last payment receive hui kya?",
        botReply: "Namaste Sharma ji! 🙏\n\n📊 *Ledger Summary for Sharma Kirana:*\n• Total Outstanding: ₹18,400\n• Overdue (>30 Days): ₹0 (Nil)\n• Last Payment: ₹25,000 via UPI on 24 Aug\n\n📄 Detailed Ledger PDF statement sent above.",
        invoice: {
            invoiceNumber: "LEDGER-AUG-2026",
            amount: 18400,
            itemsCount: 1,
            upiLink: true,
        },
        erpStatus: {
            orderNumber: "LEDGER-REQ-102",
            retailer: "Sharma Kirana Store",
            status: "STATEMENT DISPATCHED",
            items: "Ledger PDF generated via Tally Bridge",
            amount: "₹18,400 Due",
            riskScore: 94,
        },
    },
    {
        id: "schemes",
        label: "🎁 Ask for Active Trade Schemes & Cashback",
        userPrompt: "Is mahine Dabur ya Fortune oil pe koi scheme ya cash discount hai kya?",
        botReply: "🔥 *Active Distributor Schemes for Today:*\n\n1. *Fortune Sunlite 1L Pouch*: Buy 25 cases, get 1 case FREE + ₹500 instant UPI cashback.\n2. *Dabur Red Paste 150g*: Extra 4.5% trade discount on bill value > ₹15,000.\n\nType *'Book Fortune 25'* to lock your scheme price now!",
        erpStatus: {
            orderNumber: "SCHEME-INQUIRY",
            retailer: "Sharma Kirana Store",
            status: "AI RECOMMENDATION SENT",
            items: "Dabur & Fortune Trade Schemes",
            amount: "Active Cashback Applied",
            riskScore: 94,
        },
    },
];

export function InteractiveDemo() {
    const [activePresetIndex, setActivePresetIndex] = useState(0);
    const active = PRESETS[activePresetIndex];

    return (
        <div className="rounded-2xl border border-[var(--border-accent)] bg-gradient-to-b from-[var(--bg-secondary)]/90 via-[var(--bg-card)] to-[var(--bg-primary)] p-4 sm:p-7 shadow-2xl backdrop-blur-xl">
            {/* Header / Preset Picker */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] text-xs font-semibold uppercase tracking-wider mb-1.5">
                        <Sparkles size={13} />
                        <span>Interactive Live Simulator</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                        See how DistroAI turns WhatsApp messages into automated Tally invoices
                    </h3>
                </div>

                {/* Preset Tabs */}
                <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset, idx) => (
                        <button
                            key={preset.id}
                            onClick={() => setActivePresetIndex(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition duration-200 ${
                                activePresetIndex === idx
                                    ? "bg-[var(--gold)] text-[#07070E] font-semibold shadow-md"
                                    : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)]"
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Split Screen Container */}
            <div className="grid lg:grid-cols-12 gap-6 mt-6">
                {/* Left Side: WhatsApp Simulator */}
                <div className="lg:col-span-6 flex flex-col rounded-xl border border-emerald-500/20 bg-[#0B141A] overflow-hidden shadow-xl">
                    {/* WhatsApp Top Bar */}
                    <div className="bg-[#1F2C34] px-4 py-3 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                                D
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                                    DistroAI Smart Assistant
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                </h4>
                                <p className="text-[11px] text-emerald-400/80">Automated Bot • Active 24/7</p>
                            </div>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                            Meta Verified
                        </span>
                    </div>

                    {/* Chat Messages Body */}
                    <div className="p-4 space-y-4 flex-1 bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px] min-h-[320px]">
                        {/* Retailer Message (Right) */}
                        <div className="flex justify-end">
                            <div className="max-w-[85%] bg-[#005C4B] text-emerald-50 p-3 rounded-lg rounded-tr-none shadow-sm text-xs sm:text-sm">
                                <p className="leading-relaxed">{active.userPrompt}</p>
                                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-emerald-200/70">
                                    <span>10:42 AM</span>
                                    <CheckCheck size={13} className="text-cyan-400" />
                                </div>
                            </div>
                        </div>

                        {/* Bot Response (Left) */}
                        <div className="flex justify-start">
                            <div className="max-w-[90%] bg-[#202C33] text-gray-100 p-3.5 rounded-lg rounded-tl-none shadow-md text-xs sm:text-sm border border-white/5">
                                <p className="whitespace-pre-line leading-relaxed">{active.botReply}</p>

                                {active.invoice && (
                                    <div className="mt-3 p-2.5 rounded-md bg-[#111B21] border border-emerald-500/30 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText size={18} className="text-emerald-400" />
                                            <div>
                                                <p className="text-[11px] font-semibold text-white">{active.invoice.invoiceNumber}.pdf</p>
                                                <p className="text-[10px] text-gray-400">₹{active.invoice.amount.toLocaleString('en-IN')} • Dynamic UPI QR</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] bg-emerald-500 text-[#07070E] font-bold px-2 py-1 rounded">
                                            Pay ₹{active.invoice.amount.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-gray-400">
                                    <span>10:42 AM</span>
                                    <Sparkles size={11} className="text-[var(--gold)]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* WhatsApp Input Footer */}
                    <div className="bg-[#1F2C34] px-4 py-2.5 flex items-center justify-between border-t border-white/5 text-gray-400 text-xs">
                        <span>💬 Retailer typing simulated in Hinglish/English...</span>
                        <span className="text-emerald-400 font-mono text-[11px]">Instant NLP Response</span>
                    </div>
                </div>

                {/* Right Side: Distributor Live ERP Sync View */}
                <div className="lg:col-span-6 flex flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden shadow-xl">
                    {/* ERP Top Bar */}
                    <div className="bg-[var(--bg-primary)] px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-[var(--gold)]"></div>
                            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                                Live Distributor Operations Console
                            </h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--green)]/20 text-[var(--green-bright)] font-semibold flex items-center gap-1">
                            <CheckCircle2 size={11} /> Tally ERP Sync Active
                        </span>
                    </div>

                    {/* ERP Content Dashboard */}
                    <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                        {/* Live Sync Card */}
                        <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-accent)] space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-[var(--gold)]">
                                    {active.erpStatus.orderNumber}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {active.erpStatus.status}
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-[var(--text-secondary)]">Customer / Store:</span>
                                    <span className="font-semibold text-[var(--text-primary)]">{active.erpStatus.retailer}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-[var(--text-secondary)]">Items & Qty:</span>
                                    <span className="font-medium text-[var(--text-primary)]">{active.erpStatus.items}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-[var(--text-secondary)]">Net Value:</span>
                                    <span className="font-bold text-[var(--gold)] font-mono text-sm">{active.erpStatus.amount}</span>
                                </div>
                            </div>

                            {/* Credit Risk Score Indicator */}
                            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs">
                                <span className="text-[var(--text-secondary)] flex items-center gap-1">
                                    AI Payment Score:
                                </span>
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                    {active.erpStatus.riskScore}/100 (Low Risk)
                                </span>
                            </div>
                        </div>

                        {/* Automated Actions Taken by DistroAI */}
                        <div className="space-y-2">
                            <h5 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                                Automated Actions Completed:
                            </h5>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] flex items-center gap-2 text-[var(--text-secondary)]">
                                    <Check size={14} className="text-[var(--green-bright)] shrink-0" />
                                    <span>Stock Reserved in W-1</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] flex items-center gap-2 text-[var(--text-secondary)]">
                                    <Check size={14} className="text-[var(--green-bright)] shrink-0" />
                                    <span>Tally Voucher Queued</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] flex items-center gap-2 text-[var(--text-secondary)]">
                                    <Check size={14} className="text-[var(--green-bright)] shrink-0" />
                                    <span>GST Taxes Auto-Split</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] flex items-center gap-2 text-[var(--text-secondary)]">
                                    <Check size={14} className="text-[var(--green-bright)] shrink-0" />
                                    <span>Dynamic UPI QR Created</span>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Metric highlight */}
                        <div className="p-3 rounded-lg bg-gradient-to-r from-[var(--gold)]/10 to-transparent border border-[var(--border-accent)] flex items-center justify-between text-xs">
                            <span className="text-[var(--text-secondary)]">Time from WhatsApp message to Ready Invoice:</span>
                            <span className="font-bold text-[var(--gold)] font-mono text-sm">2.4 seconds</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
