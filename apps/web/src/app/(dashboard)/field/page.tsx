"use client";

import { MapPin, Users, Construction } from "lucide-react";
import Link from "next/link";

export default function FieldPage() {
    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Field Force</h1>
            </div>

            <div className="text-center py-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)]">
                <div className="w-20 h-20 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-6">
                    <Construction size={36} className="text-[var(--gold)]" />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-playfair)" }}>Coming Soon</h2>
                <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-8 text-sm leading-relaxed">
                    Track your salesmen's visits, orders, and collections in real-time.
                    GPS beat tracking, visit proof, and productivity analytics — all in one place.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-muted)]">
                        <MapPin size={14} className="text-[var(--gold)]" /> GPS Beat Tracking
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-muted)]">
                        <Users size={14} className="text-[var(--green-bright)]" /> Team Management
                    </div>
                </div>
            </div>
        </div>
    );
}
