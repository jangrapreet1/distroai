"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingCart, Package, CreditCard, Users, LineChart, CheckCircle2, Terminal, Sparkles, Shield, Cpu, Layers } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface FeaturePillar {
    id: string;
    tag: string;
    title: string;
    description: string;
    icon: any;
    bullets: string[];
    terminalPreview: {
        title: string;
        codeLines: { line: string; color?: string }[];
    };
}

const FEATURES: FeaturePillar[] = [
    {
        id: "order-manager",
        tag: "Core Product #1",
        title: "AI Order Manager: Zero-Error WhatsApp & Voice Ordering",
        description: "Eliminate manual clerk order punching. Retailers send WhatsApp voice notes, Hinglish messages, or photo slips. DistroAI parses them with 99.4% SKU accuracy and queues a draft for 1-click Tally sync.",
        icon: ShoppingCart,
        bullets: [
            "Transcribes regional Hindi, Hinglish, Marathi & Gujarati voice notes",
            "Human-in-the-Loop Safeguard: 1-click review & approve before anything touches Tally or GST",
            "Auto-calculates quantity slabs, dealer schemes, and tax brackets",
            "Dispatches instant PDF invoice with scannable Dynamic UPI QR directly in WhatsApp",
        ],
        terminalPreview: {
            title: "ai_order_manager.py",
            codeLines: [
                { line: "# Inbound audio stream from Kirana / Dealer", color: "text-gray-500" },
                { line: "audio = fetch_voice_note(msg.media_url)", color: "text-cyan-400" },
                { line: ">> 'Bhaiya, 20 carton Maggi aur 10 carton Parle-G bhej dena'", color: "text-amber-300" },
                { line: "matched_skus = catalog_embedder.match_items(audio)", color: "text-purple-400" },
                { line: "confidence = 0.994 # Verified against Tally catalog", color: "text-emerald-400" },
                { line: "draft = create_draft_order(customer_id, matched_skus)", color: "text-cyan-400" },
                { line: ">> 'Draft #ORD-8492 ready for 1-click Tally dispatch'", color: "text-emerald-400" },
            ],
        },
    },
    {
        id: "credit-manager",
        tag: "Core Product #2",
        title: "AI Credit Manager: Khata Aging & Dynamic UPI Collections",
        description: "Recover working capital locked in delayed market credit. Real-time aging buckets (0-30, 31-60, 60-90+ days), smart payment scoring, and automated respectful WhatsApp payment nudges.",
        icon: CreditCard,
        bullets: [
            "NPCI Dynamic UPI QR printed on every invoice with exact pre-filled balance",
            "Automated payment reminders sent via WhatsApp with 1-tap PhonePe/GPay deep links",
            "Credit scoring (0–100) auto-locks billing for chronic defaulters",
            "Bidirectional Tally bank reconciliation: marks receipts instantly without manual ledger voucher entry",
        ],
        terminalPreview: {
            title: "ai_credit_manager.py",
            codeLines: [
                { line: "# Real-time Khata aging & risk evaluation", color: "text-gray-500" },
                { line: "overdue = evaluate_aging_buckets(customer.ledger_id)", color: "text-purple-400" },
                { line: ">> Overdue > 45 days: ₹1,42,800 across 3 invoices", color: "text-rose-400" },
                { line: "payment_link = generate_dynamic_upi_link(overdue.total)", color: "text-cyan-400" },
                { line: "whatsapp.send_gentle_nudge(customer.phone, payment_link)", color: "text-amber-300" },
                { line: ">> 'Payment received ₹1,42,800 via PhonePe - Tally ledger reconciled'", color: "text-emerald-400" },
            ],
        },
    },
    {
        id: "inventory-manager",
        tag: "Core Product #3",
        title: "AI Inventory Manager: Landed Cost & Dead-Stock Protection",
        description: "Tailored for tiles, sanitaryware, hardware, and FMCG distributors. Track landed cost vs wholesale selling rate, manage multi-units (Boxes, Sq.Ft, Cartons, Bags), and prevent costly stockouts.",
        icon: Package,
        bullets: [
            "Dual-unit support: native Boxes + Sq.Ft calculation for tiles, Cartons + Pieces for FMCG",
            "Landed Cost Margin Guardrail: warns salesmen if quoting below minimum floor margin",
            "Prophet ML seasonal replenishment: predicts Diwali & monsoon demand spikes 14 days early",
            "Automated Supplier Purchase Orders generated when stock dips below reorder thresholds",
        ],
        terminalPreview: {
            title: "ai_inventory_manager.py",
            codeLines: [
                { line: "# Landed cost & multi-unit stock monitoring", color: "text-gray-500" },
                { line: "stock = get_stock_profile('TILE-2X2-10010')", color: "text-cyan-400" },
                { line: ">> 106 Boxes (1,696 Sq.Ft) in godown | Landed Cost: ₹233/box", color: "text-amber-300" },
                { line: "if order_quote.rate < stock.min_floor_rate: alert_margin()", color: "text-rose-400" },
                { line: "prophet_forecast = predict_runout_days(stock)", color: "text-purple-400" },
                { line: ">> 'Stockout projected in 8 days - Draft PO auto-created'", color: "text-emerald-400" },
            ],
        },
    },
    {
        id: "sales-manager",
        tag: "Core Product #4",
        title: "AI Sales Manager: Field SFA Beat Route Tracking",
        description: "Equip your sales reps with an offline-first mobile app that operates even in rural basements. Geo-fenced store check-ins, spot order booking, Bluetooth receipt printing, and commission tracking.",
        icon: Users,
        bullets: [
            "Live GPS beat route plan with geotagged kirana / dealer check-ins",
            "100% Offline-First SFA: records orders with local SQLite caching and auto-syncs when online",
            "Spot Bluetooth thermal printing for immediate delivery chalans and bill slips",
            "Real-time sales target vs achievement gamification and commission leaderboards",
        ],
        terminalPreview: {
            title: "ai_sales_manager.ts",
            codeLines: [
                { line: "// Geo-fenced beat check-in & offline catalog sync", color: "text-gray-500" },
                { line: "const distance = calculateHaversine(repGps, storeCoords);", color: "text-purple-400" },
                { line: "if (distance <= 50 /* meters */) {", color: "text-cyan-400" },
                { line: "  recordCheckin({ repId, storeId, verified: true });", color: "text-emerald-400" },
                { line: "  syncOfflineCatalogToHandset(storeId);", color: "text-amber-300" },
                { line: "  printBluetoothSlip({ orderId, thermalPrinter: true });", color: "text-emerald-400" },
                { line: "}", color: "text-cyan-400" },
            ],
        },
    },
    {
        id: "business-analyst",
        tag: "Core Product #5",
        title: "AI Business Analyst: Conversational Intelligence for Owners",
        description: "Your 24/7 AI Chief Financial Officer. Ask questions in plain English or Hindi about margins, top defaulters, dead stock, and month-over-month revenue without waiting for your accountant.",
        icon: LineChart,
        bullets: [
            "Instant answers: 'Which 5 customers have the highest overdue balance?'",
            "Margin breakdown: compares gross vs net margin across product categories and salesmen",
            "Dead stock audit: identifies slow-moving capital sitting idle in your warehouse > 60 days",
            "Natural language reports exportable directly to Excel, PDF, or Tally XML",
        ],
        terminalPreview: {
            title: "ai_business_analyst.py",
            codeLines: [
                { line: "# Natural language analytical reasoning", color: "text-gray-500" },
                { line: "query = 'Show top 5 overdue customers and average DSO'", color: "text-cyan-400" },
                { line: "analysis = pgvector_financial_engine.analyze(query)", color: "text-purple-400" },
                { line: ">> Identified 5 debtors with ₹8.4L overdue (Avg DSO: 52 days)", color: "text-amber-300" },
                { line: "export_report_pdf(analysis, destination='whatsapp_owner')", color: "text-emerald-400" },
            ],
        },
    },
];

export function FeatureShowcase() {
    const [activeTab, setActiveTab] = useState("order-manager");
    const feature = FEATURES.find((f) => f.id === activeTab) || FEATURES[0];
    const Icon = feature.icon;

    return (
        <section id="features" className="py-24 relative overflow-hidden scroll-mt-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                {/* Section Header */}
                <div className="text-center max-w-3xl mx-auto space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider border border-blue-500/20">
                        <Layers size={12} />
                        <span>Core Platform Capabilities</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
                        Engineered for High-Volume Indian Trade
                    </h2>
                    <p className="text-sm sm:text-base text-[var(--text-secondary)]">
                        Everything you need to scale from ₹10 Lakhs to ₹100 Crores monthly turnover with zero friction.
                    </p>
                </div>

                {/* Pillar Tab Bar with Spring Indicator */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto p-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] backdrop-blur-md">
                    {FEATURES.map((item) => {
                        const ItemIcon = item.icon;
                        const isSelected = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 ${
                                    isSelected
                                        ? "text-[#07070E]"
                                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                }`}
                            >
                                {isSelected && (
                                    <motion.div
                                        layoutId="activeFeaturePill"
                                        transition={{ type: "spring", stiffness: 450, damping: 30 }}
                                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-[var(--gold)] via-[var(--gold-light)] to-[#FFE8A3] shadow-md shadow-amber-500/20"
                                    />
                                )}
                                <ItemIcon size={15} className="relative z-10" />
                                <span className="relative z-10">{item.title.split(" ")[0]} {item.title.split(" ")[1]}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Selected Pillar Card */}
                <SpotlightCard
                    spotlightColor="rgba(201, 168, 76, 0.12)"
                    className="p-6 sm:p-10 border-white/[0.08] bg-[#07070C]"
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={feature.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.25 }}
                            className="grid lg:grid-cols-12 gap-8 items-center"
                        >
                            {/* Left Description Column */}
                            <div className="lg:col-span-6 space-y-6">
                                <div className="space-y-2">
                                    <span className="text-xs font-mono font-bold text-[var(--gold)] tracking-widest uppercase">
                                        {feature.tag}
                                    </span>
                                    <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
                                        {feature.title}
                                    </h3>
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>

                                <div className="space-y-3 pt-2">
                                    {feature.bullets.map((b, i) => (
                                        <div key={i} className="flex items-start gap-3 text-xs sm:text-sm text-[var(--text-primary)]">
                                            <CheckCircle2 size={16} className="text-[var(--gold)] shrink-0 mt-0.5" />
                                            <span>{b}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Code/Terminal Column */}
                            <div className="lg:col-span-6">
                                <div className="rounded-2xl border border-white/[0.08] bg-[#050509] overflow-hidden shadow-2xl">
                                    {/* Terminal Header */}
                                    <div className="bg-white/[0.03] px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                                            <span className="text-[11px] font-mono text-[var(--text-muted)] ml-2">
                                                {feature.terminalPreview.title}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono text-emerald-400">ENGINE // RUNNING</span>
                                    </div>

                                    {/* Terminal Code Body */}
                                    <div className="p-5 font-mono text-xs space-y-2 overflow-x-auto leading-relaxed bg-[#030306]">
                                        {feature.terminalPreview.codeLines.map((lineObj, idx) => (
                                            <div key={idx} className="flex gap-4">
                                                <span className="text-gray-600 select-none text-[11px] w-4 text-right shrink-0">{idx + 1}</span>
                                                <span className={lineObj.color ?? "text-gray-300"}>{lineObj.line}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </SpotlightCard>
            </div>
        </section>
    );
}
