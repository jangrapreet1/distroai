"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

export function formatINR(n: number): string {
    return "₹" + n.toLocaleString("en-IN");
}

export function KPICard({ title, value, change, changeLabel, icon: Icon, accentColor, sparkData, actionNode, children }: {
    title: string; value: string; change: number; changeLabel: React.ReactNode;
    icon: React.ElementType; accentColor: string; sparkData: number[];
    actionNode?: React.ReactNode; children?: React.ReactNode;
}) {
    const isUp = change >= 0;
    const chartPoints = useMemo(() => {
        const today = new Date();
        return sparkData.map((v, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() - (sparkData.length - 1 - i));
            return { date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), v };
        });
    }, [sparkData]);

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 hover:border-opacity-30 transition group flex flex-col" style={{ "--accent": accentColor } as React.CSSProperties}>
            <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 duration-300" style={{ background: `${accentColor}15` }}>
                    <Icon size={20} style={{ color: accentColor }} />
                </div>
                {actionNode ? actionNode : (
                    <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? "text-[var(--green-bright)]" : "text-[var(--red)]"}`}>
                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(change)}%
                    </div>
                )}
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-1.5">{title}</h3>
            <p className="text-2xl lg:text-3xl font-light mb-1.5 truncate" title={value} style={{ fontFamily: "var(--font-mono)" }}>{value}</p>
            <div className="text-xs text-[var(--text-muted)]">{changeLabel}</div>
            {children && <div className="mt-4 pt-4 border-t border-[var(--border)]">{children}</div>}

            {!children && sparkData && sparkData.length > 0 && (
                <div className="h-10 mt-4 opacity-50 group-hover:opacity-80 transition">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartPoints}>
                            <defs>
                                <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={accentColor} stopOpacity={0.3} />
                                    <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const p = payload[0].payload;
                                    return (
                                        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 11 }}>
                                            <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{p.date}</div>
                                            <div style={{ color: accentColor, fontWeight: 700 }}>{typeof p.v === "number" && title === "Revenue" ? formatINR(p.v) : typeof p.v === "number" && title === "Outstanding" ? formatINR(p.v) : p.v}</div>
                                        </div>
                                    );
                                }}
                            />
                            <Area dataKey="v" stroke={accentColor} fill={`url(#spark-${title})`} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: accentColor, stroke: "var(--bg-card)", strokeWidth: 2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
