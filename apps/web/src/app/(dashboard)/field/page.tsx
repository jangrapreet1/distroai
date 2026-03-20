"use client";

import { Users, MapPin, ShoppingCart, IndianRupee, Clock } from "lucide-react";

// Mock data removed as per request
const salesmen: any[] = [];

function formatINR(n: number): string { return "₹" + n.toLocaleString("en-IN"); }

export default function FieldPage() {
    const kpis = [
        { label: "Active Salesmen", value: salesmen.filter(s => s.active).length, icon: Users, color: "var(--green-bright)" },
        { label: "Visits Today", value: salesmen.reduce((s, v) => s + v.visits.done, 0), icon: MapPin, color: "var(--gold)" },
        { label: "Orders Today", value: salesmen.reduce((s, v) => s + v.orders, 0), icon: ShoppingCart, color: "var(--purple)" },
        { label: "Collections Today", value: formatINR(salesmen.reduce((s, v) => s + v.collections, 0)), icon: IndianRupee, color: "var(--green-bright)" },
    ];

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4" style={{ fontFamily: "var(--font-playfair)" }}>Field Force</h1>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {kpis.map((k) => (
                    <div key={k.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                        <div className="flex items-center gap-2 mb-2"><k.icon size={14} style={{ color: k.color }} /><span className="text-xs text-[var(--text-muted)]">{k.label}</span></div>
                        <p className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>{k.value}</p>
                    </div>
                ))}
            </div>

            {salesmen.length === 0 ? (
                <div className="text-center py-16 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] mt-8">
                    <MapPin size={48} className="mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Field Force Data</h3>
                    <p className="text-[var(--text-muted)] max-w-md mx-auto">
                        Connect your field team's mobile devices to start tracking visits, orders, and collections in real-time.
                    </p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Salesmen cards would go here */}
                </div>
            )}
        </div>
    );
}
