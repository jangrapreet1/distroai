"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, RefreshCw, TrendingUp, MapPin, CheckCircle2, Terminal, Sparkles, Shield, Cpu, Layers } from "lucide-react";
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
        id: "whatsapp",
        tag: "PILLAR 01 // MULTILINGUAL_NLP",
        title: "AI WhatsApp Voice & Chat Order Taking",
        description: "Indian retailers place orders via voice notes, Hinglish text, and photo lists. DistroAI's custom-trained Llama/Gemini engine matches catalog SKUs with 99.4% accuracy.",
        icon: MessageSquare,
        bullets: [
            "Parses regional Hindi, Marathi, Gujarati, Telugu & Tamil voice notes",
            "Auto-calculates quantity slabs, schemes, discounts, and GST brackets",
            "Dispatches instant PDF invoice with Dynamic UPI QR in WhatsApp chat",
            "Automated payment reminders with 1-tap UPI payment deep links",
        ],
        terminalPreview: {
            title: "ai_order_engine.py",
            codeLines: [
                { line: "# Inbound audio stream (Hindi / Hinglish)", color: "text-gray-500" },
                { line: "audio = fetch_voice_note(msg.media_url)", color: "text-cyan-400" },
                { line: "transcript = whisper_indic.transcribe(audio)", color: "text-emerald-400" },
                { line: ">> 'Bhai 25 peti Parle-G aur 10 peti Marie dispatch kardo'", color: "text-amber-300" },
                { line: "matched_skus = catalog_embedder.match(transcript)", color: "text-purple-400" },
                { line: "order = create_sales_order(customer_id, matched_skus)", color: "text-emerald-400" },
                { line: "queue_tally_voucher(order.id) # Status: 200 OK", color: "text-cyan-400" },
            ],
        },
    },
    {
        id: "tally",
        tag: "PILLAR 02 // DESKTOP_BRIDGE",
        title: "Real-Time Tally Prime & 9 XML Bridge",
        description: "Zero change management for your accountant. Our lightweight local bridge runs in the background on your Tally computer, synchronizing inventory and sales vouchers in under 2.5 seconds.",
        icon: RefreshCw,
        bullets: [
            "Bidirectional ledger balance & payment sync without cloud export hassle",
            "Auto-creates Sales Vouchers and Credit Notes in correct Tally ledger",
            "Operates offline: queues mutations locally and flushes on reconnection",
            "Supports multi-company and multi-godown stock allocation",
        ],
        terminalPreview: {
            title: "tally_bridge_agent.rs",
            codeLines: [
                { line: "// Listening for Tally XML RPC on port 9000", color: "text-gray-500" },
                { line: "let payload = build_tally_envelope(&sales_voucher);", color: "text-purple-400" },
                { line: "let res = tally_client.post_xml(payload).await?;", color: "text-cyan-400" },
                { line: ">> <RESPONSE><CREATED>1</CREATED><VOUCHERID>8492</VOUCHERID></RESPONSE>", color: "text-emerald-400" },
                { line: "sync_godown_stock('Warehouse-1', skus).await;", color: "text-amber-300" },
                { line: "emit_event('TALLY_MUTATION_CONFIRMED');", color: "text-emerald-400" },
            ],
        },
    },
    {
        id: "forecasting",
        tag: "PILLAR 03 // PROPHET_ML",
        title: "Predictive Stock Replenishment & Credit Scoring",
        description: "Stop tying up capital in slow-moving inventory. Our ML models forecast demand spikes before Diwali & festivals while computing real-time payment risk scores for every kirana.",
        icon: TrendingUp,
        bullets: [
            "Prophet ML demand forecasting prevents stockouts on top 20% revenue SKUs",
            "Auto-generates Supplier Purchase Orders when stock reaches safety thresholds",
            "Dynamic credit limit scoring (0–100) blocks high-risk overdue defaulters",
            "Automated aging bucket reports (0-30, 31-60, 60-90, 90+ days)",
        ],
        terminalPreview: {
            title: "credit_risk_model.py",
            codeLines: [
                { line: "# Prophet ML Time-Series & Credit Scoring", color: "text-gray-500" },
                { line: "forecast = prophet.predict(sku_sales_history)", color: "text-purple-400" },
                { line: ">> Predicted Demand (Next 14D): 450 Cases (+28% MoM)", color: "text-emerald-400" },
                { line: "risk_score = evaluate_kirana_dso(customer.payment_history)", color: "text-cyan-400" },
                { line: "if risk_score > 80: approve_credit_order(order)", color: "text-amber-300" },
                { line: "else: require_advance_upi(order) # Risk Mitigation", color: "text-rose-400" },
            ],
        },
    },
    {
        id: "sfa",
        tag: "PILLAR 04 // FIELD_FORCE_SFA",
        title: "Sales Rep Mobile GPS Beat Route Tracking",
        description: "Give your field sales team a lightning-fast offline-first mobile app. Track daily beat visits, check-in geo-fencing, spot invoice printing, and commission leaderboards.",
        icon: MapPin,
        bullets: [
            "Live GPS beat plan routing with geotagged store check-ins",
            "Offline order entry: works in rural basements with zero mobile coverage",
            "Bluetooth thermal invoice printer support for immediate store slips",
            "Real-time sales target vs achievement gamification & commissions",
        ],
        terminalPreview: {
            title: "sfa_beat_tracker.ts",
            codeLines: [
                { line: "// Geo-fenced store check-in verification", color: "text-gray-500" },
                { line: "const distance = calculateHaversine(repGps, storeCoords);", color: "text-purple-400" },
                { line: "if (distance <= 50 /* meters */) {", color: "text-cyan-400" },
                { line: "  recordCheckin({ repId, storeId, verified: true });", color: "text-emerald-400" },
                { line: "  loadStorePromotionsAndSchemes(storeId);", color: "text-amber-300" },
                { line: "}", color: "text-cyan-400" },
            ],
        },
    },
];

export function FeatureShowcase() {
    const [activeTab, setActiveTab] = useState("whatsapp");
    const feature = FEATURES.find((f) => f.id === activeTab) || FEATURES[0];
    const Icon = feature.icon;

    return (
        <section id="features" className="py-24 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                {/* Section Header */}
                <div className="text-center max-w-3xl mx-auto space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] text-[var(--gold)] text-[11px] font-mono font-semibold uppercase tracking-wider border border-white/[0.08]">
                        <Layers size={12} />
                        <span>[CORE_ARCHITECTURE // 4_PILLARS]</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
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
