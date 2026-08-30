"use client";

import { useState } from "react";
import { MessageSquare, RefreshCw, TrendingUp, Truck, Check, ArrowRight, ShieldCheck, Zap, Sparkles, MapPin, Database } from "lucide-react";

export function FeatureShowcase() {
    const [activeTab, setActiveTab] = useState(0);

    const pillars = [
        {
            id: "whatsapp-ai",
            tabLabel: "💬 WhatsApp AI Ordering",
            title: "Turn WhatsApp Messages & Voice Notes into Verified Invoices",
            subtitle: "Your retailers don't need to download an app. They order in plain Hinglish on WhatsApp, and DistroAI handles the rest.",
            icon: MessageSquare,
            color: "#25D366",
            features: [
                "Understands Hinglish, Hindi, and regional slang (e.g., '10 peti Parle-G bhej do')",
                "Auto-calculates trade schemes (Buy 10 Get 1 Free, Cash discounts, Bundles)",
                "Instant PDF invoice dispatch with embedded Dynamic UPI QR codes",
                "Automated ledger balance inquiries & payment confirmation receipts",
            ],
            codePreview: {
                title: "Inbound Message NLP Parser",
                code: `// DistroAI NLP Engine (Hinglish ➔ Structured SKU Match)
Input: "Sharma ji, 15 peti Fortune Mustard 1L + 5 bori Basmati Rice"
Output: {
  retailer: "Sharma General Store (ID: RET-9284)",
  items: [
    { sku: "FORT-MUST-1L", qty: 15, unit: "cases", schemeApplied: "3% Cash Disc" },
    { sku: "DAAWAT-BASM-25K", qty: 5, unit: "bags", taxRate: 0.05 }
  ],
  invoiceStatus: "DRAFT_VERIFIED",
  tallySyncStatus: "QUEUED"
}`,
            },
        },
        {
            id: "tally-bridge",
            tabLabel: "📊 Real-Time Tally Bridge",
            title: "Zero Manual Accounting Entry — Everything in Tally Stays in Sync",
            subtitle: "DistroAI connects directly to desktop Tally Prime or Tally ERP 9 over secure local HTTP/XML, posting vouchers in seconds.",
            icon: RefreshCw,
            color: "var(--gold)",
            features: [
                "Bi-directional sync of Sales Vouchers, Receipts, and Credit Notes",
                "Automated GST tax split (CGST, SGST, IGST, Cess) with HSN verification",
                "Multi-warehouse inventory reservation and stock adjustment tracking",
                "Zero risk of duplicate entries or human data entry errors",
            ],
            codePreview: {
                title: "Tally XML Voucher Output",
                code: `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20260829</DATE>
            <PARTYLEDGERNAME>Sharma Kirana Store</PARTYLEDGERNAME>
            <VOUCHERNUMBER>INV-2026-0849</VOUCHERNUMBER>
            <AMOUNT>-39740.00</AMOUNT>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`,
            },
        },
        {
            id: "ml-forecast",
            tabLabel: "🧠 ML Forecasting & Credit Score",
            title: "Predict Demand with Prophet ML & Eliminate Bad Debts",
            subtitle: "Never run out of fast-moving SKUs during Diwali/Holi rush, and never deliver goods to high-risk chronic defaulters.",
            icon: TrendingUp,
            color: "#7B5EA7",
            features: [
                "Facebook Prophet 30-day stock prediction with Indian holiday regressors",
                "Automated Reorder Point & Safety Stock formula (95% Service Level)",
                "AI Credit Risk Scoring (0–100) based on historical payment velocity",
                "Automated AR Aging Alerts (30+, 60+, 90+ days) with 1-click WhatsApp reminders",
            ],
            codePreview: {
                title: "AI Credit Risk & Safety Stock Model",
                code: `# FastAPI Prophet Forecaster
Safety_Stock = 1.65 * std_dev * sqrt(lead_time_days)
Reorder_Point = (avg_daily_demand * lead_time_days) + Safety_Stock

# Credit Risk Scorer (0-100)
if overdue_invoices > 0:
    penalty = min(50, overdue_invoices * 10)
    score -= penalty
Result: "Score 94/100 • Low Risk • Approved for Credit"`,
            },
        },
        {
            id: "sfa-mobile",
            tabLabel: "📍 Field Sales Force (SFA)",
            title: "Track Sales Reps on Beat Routes with GPS & Selfie Attendance",
            subtitle: "Give your on-ground sales force a fast mobile app with offline catalog order taking, beat day planning, and shop check-ins.",
            icon: Truck,
            color: "#E07B39",
            features: [
                "Beat Day Route Planning on Google Maps with optimal store sequencing",
                "GPS Shop Check-In/Out with mandatory selfie and shelf audit photo",
                "Offline Catalog Order Taking in remote zero-network retail pockets",
                "Live Field Sales Commission & Monthly Target tracking",
            ],
            codePreview: {
                title: "Field SFA GPS Check-In State",
                code: `// Salesman Mobile Beat Check-In
{
  salesmanId: "SAL-409 (Vikram Singh)",
  customerId: "RET-9284 (Sharma Kirana)",
  checkInLat: 28.6139,
  checkInLng: 77.2090,
  distanceFromStore: "4.2 meters (Verified Inside)",
  ordersPlaced: 1,
  collectionAmount: 25000,
  syncStatus: "ONLINE_ACKNOWLEDGED"
}`,
            },
        },
    ];

    const currentPillar = pillars[activeTab];

    return (
        <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                <span className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wider bg-[var(--gold)]/10 px-3 py-1 rounded-full">
                    Built Exclusively for Indian Distribution
                </span>
                <h2
                    className="text-3xl sm:text-5xl font-bold text-[var(--text-primary)] tracking-tight"
                    style={{ fontFamily: "var(--font-playfair)" }}
                >
                    Everything you need to scale your wholesale & distribution business
                </h2>
                <p className="text-[var(--text-secondary)] text-base sm:text-lg">
                    Traditional ERPs were built for factories. DistroAI is built from day one for the Indian distributor's daily hustle.
                </p>
            </div>

            {/* Tab Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-12">
                {pillars.map((p, idx) => (
                    <button
                        key={p.id}
                        onClick={() => setActiveTab(idx)}
                        className={`px-4 sm:px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                            activeTab === idx
                                ? "bg-[var(--gold)] text-[#07070E] shadow-lg shadow-amber-500/20 scale-105"
                                : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)]"
                        }`}
                    >
                        <span>{p.tabLabel}</span>
                    </button>
                ))}
            </div>

            {/* Pillar Content Card */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 sm:p-10 shadow-2xl transition-all duration-300">
                <div className="grid lg:grid-cols-12 gap-8 items-center">
                    {/* Left Column: Feature Highlights */}
                    <div className="lg:col-span-6 space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-mono font-medium text-[var(--gold)]">
                            <currentPillar.icon size={15} />
                            <span>Pillar 0{activeTab + 1}</span>
                        </div>

                        <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight">
                            {currentPillar.title}
                        </h3>

                        <p className="text-[var(--text-secondary)] text-sm sm:text-base leading-relaxed">
                            {currentPillar.subtitle}
                        </p>

                        <div className="space-y-3 pt-2">
                            {currentPillar.features.map((feat, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="mt-1 p-0.5 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] shrink-0">
                                        <Check size={13} />
                                    </div>
                                    <span className="text-sm text-[var(--text-primary)] font-medium">
                                        {feat}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4">
                            <a
                                href="/register"
                                className="inline-flex items-center gap-2 text-sm font-bold text-[var(--gold)] hover:text-[var(--gold-light)] group transition"
                            >
                                <span>Try this feature free for 14 days</span>
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </a>
                        </div>
                    </div>

                    {/* Right Column: Code / Data Visualizer */}
                    <div className="lg:col-span-6 rounded-xl border border-[var(--border)] bg-[#07070E] overflow-hidden shadow-2xl">
                        <div className="bg-[var(--bg-secondary)] px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                                <span className="text-xs font-mono text-[var(--text-muted)] ml-2">
                                    {currentPillar.codePreview.title}
                                </span>
                            </div>
                            <span className="text-[10px] font-mono text-[var(--gold)] uppercase">Live Output</span>
                        </div>
                        <pre className="p-5 font-mono text-xs text-amber-200/90 leading-relaxed overflow-x-auto selection:bg-amber-500/30">
                            <code>{currentPillar.codePreview.code}</code>
                        </pre>
                    </div>
                </div>
            </div>
        </section>
    );
}
