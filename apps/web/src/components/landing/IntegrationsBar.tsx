"use client";

import { ShieldCheck, Database, CheckCircle2, Zap, Smartphone, Layers, TrendingUp } from "lucide-react";

export function IntegrationsBar() {
    const stats = [
        { label: "B2B GMV Processed", value: "₹500 Cr+" },
        { label: "WhatsApp Orders Auto-Processed", value: "150,000+" },
        { label: "SKU Catalog Matching Accuracy", value: "99.4%" },
        { label: "Tally Bridge Sync Latency", value: "< 3 Sec" },
    ];

    const integrations = [
        { name: "Tally Prime & 9", desc: "Bi-directional Ledger Sync", icon: "📊" },
        { name: "Meta WhatsApp Cloud", desc: "Official Business Webhooks", icon: "💬" },
        { name: "GST E-Way & E-Invoice", desc: "Automated IRN & QR Generation", icon: "🏛️" },
        { name: "UPI & NPCI QR", desc: "Instant Retailer Settlement", icon: "⚡" },
        { name: "Google Maps SFA", desc: "Salesmen GPS Route Tracking", icon: "📍" },
        { name: "pgvector & Prophet", desc: "ML Demand Forecasting", icon: "🧠" },
    ];

    return (
        <section className="py-14 border-y border-[var(--border)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Stats Counters */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pb-12 border-b border-[var(--border)]">
                    {stats.map((stat, i) => (
                        <div key={i} className="text-center sm:text-left">
                            <p className="text-2xl sm:text-4xl font-extrabold text-[var(--gold)] font-mono tracking-tight">
                                {stat.value}
                            </p>
                            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 font-medium">
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Ecosystem Trust Logos & Integrations */}
                <div className="pt-10">
                    <p className="text-center text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-8">
                        Native Integrations for the Indian Distribution Ecosystem
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        {integrations.map((item, i) => (
                            <div
                                key={i}
                                className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-accent)] hover:bg-[var(--bg-card-hover)] transition-all duration-200 text-center flex flex-col items-center justify-center space-y-1.5 group"
                            >
                                <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                                    {item.icon}
                                </span>
                                <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                                    {item.name}
                                </h4>
                                <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                                    {item.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
