"use client";

import { Users, MapPin, ShoppingCart, IndianRupee, Clock } from "lucide-react";

const salesmen = [
    { name: "Rajiv Kumar", territory: "Andheri-Bandra", checkIn: "9:15 AM", visits: { done: 5, planned: 8 }, orders: 3, collections: 45000, active: true },
    { name: "Suresh Patel", territory: "Dadar-Parel", checkIn: "9:30 AM", visits: { done: 3, planned: 6 }, orders: 2, collections: 28000, active: true },
    { name: "Amit Sharma", territory: "Thane", checkIn: null, visits: { done: 0, planned: 7 }, orders: 0, collections: 0, active: false },
    { name: "Priya Nair", territory: "Navi Mumbai", checkIn: "10:00 AM", visits: { done: 2, planned: 5 }, orders: 1, collections: 15000, active: true },
];

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
            <div className="mb-6 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)]/8 border border-[var(--gold)]/20 text-sm text-[var(--gold)] flex items-center gap-2">
                <span>📋</span> Showing demo data — connect your field team to see live tracking
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {kpis.map((k) => (
                    <div key={k.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4">
                        <div className="flex items-center gap-2 mb-2"><k.icon size={14} style={{ color: k.color }} /><span className="text-xs text-[var(--text-muted)]">{k.label}</span></div>
                        <p className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>{k.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {salesmen.map((s) => (
                    <div key={s.name} className={`bg-[var(--bg-card)] border rounded-[var(--radius-md)] p-5 ${s.active ? "border-[var(--green)]/20" : "border-[var(--border)] opacity-60"}`}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${s.active ? "bg-[var(--green)]/15 text-[var(--green-bright)]" : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"}`}>
                                {s.name.split(" ").map(n => n[0]).join("")}
                            </div>
                            <div>
                                <p className="font-semibold text-sm">{s.name}</p>
                                <p className="text-xs text-[var(--text-muted)]">{s.territory}</p>
                            </div>
                            <div className={`ml-auto w-2 h-2 rounded-full ${s.active ? "bg-[var(--green-bright)]" : "bg-[var(--text-muted)]"}`} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-[var(--bg-secondary)] rounded p-2">
                                <p className="text-[10px] text-[var(--text-muted)]">Check-in</p>
                                <p className="font-medium flex items-center gap-1" style={{ fontFamily: "var(--font-mono)" }}><Clock size={10} />{s.checkIn ?? "—"}</p>
                            </div>
                            <div className="bg-[var(--bg-secondary)] rounded p-2">
                                <p className="text-[10px] text-[var(--text-muted)]">Visits</p>
                                <p className="font-medium" style={{ fontFamily: "var(--font-mono)" }}>{s.visits.done}/{s.visits.planned}</p>
                            </div>
                            <div className="bg-[var(--bg-secondary)] rounded p-2">
                                <p className="text-[10px] text-[var(--text-muted)]">Orders</p>
                                <p className="font-medium" style={{ fontFamily: "var(--font-mono)" }}>{s.orders}</p>
                            </div>
                            <div className="bg-[var(--bg-secondary)] rounded p-2">
                                <p className="text-[10px] text-[var(--text-muted)]">Collections</p>
                                <p className="font-medium" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(s.collections)}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
