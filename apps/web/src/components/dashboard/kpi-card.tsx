"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

export function formatINR(n: number): string {
    return "₹" + n.toLocaleString("en-IN");
}

export function KPICard({
    title,
    value,
    change,
    changeLabel,
    icon: Icon,
    accentColor,
    sparkData,
    actionNode,
    children,
}: {
    title: string;
    value: string;
    change: number;
    changeLabel: React.ReactNode;
    icon: React.ElementType;
    accentColor: string;
    sparkData: number[];
    actionNode?: React.ReactNode;
    children?: React.ReactNode;
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
        <SpotlightCard
            spotlightColor={`${accentColor}25`}
            className="p-5 flex flex-col justify-between h-full group"
        >
            <div>
                {/* Top Row: Icon + Badge / Action */}
                <div className="flex items-start justify-between mb-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 duration-300 border"
                        style={{
                            backgroundColor: `${accentColor}15`,
                            borderColor: `${accentColor}25`,
                        }}
                    >
                        <Icon size={20} style={{ color: accentColor }} />
                    </div>
                    {actionNode ? (
                        actionNode
                    ) : (
                        <div
                            className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                                isUp
                                    ? "text-[var(--green-bright)] bg-[var(--green-bright)]/10 border-[var(--green-bright)]/20"
                                    : "text-[var(--red)] bg-[var(--red)]/10 border-[var(--red)]/20"
                            }`}
                        >
                            {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {Math.abs(change)}%
                        </div>
                    )}
                </div>

                {/* Title & Value */}
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    {title}
                </h3>
                <p
                    className="text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-1 truncate"
                    title={value}
                    style={{ fontFamily: "var(--font-mono)" }}
                >
                    {value}
                </p>
                <div className="text-xs text-[var(--text-muted)]">{changeLabel}</div>
            </div>

            {children && <div className="mt-4 pt-3 border-t border-white/[0.05]">{children}</div>}

            {/* Sparkline mini chart */}
            {!children && sparkData && sparkData.length > 0 && (
                <div className="h-9 mt-4 opacity-40 group-hover:opacity-80 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartPoints}>
                            <defs>
                                <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={accentColor} stopOpacity={0.4} />
                                    <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const p = payload[0].payload;
                                    return (
                                        <div
                                            style={{
                                                background: "rgba(10, 10, 15, 0.95)",
                                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                                borderRadius: 6,
                                                padding: "4px 8px",
                                                fontSize: 10,
                                                color: "#fff",
                                            }}
                                        >
                                            <div style={{ color: "#71717A" }}>{p.date}</div>
                                            <div style={{ color: accentColor, fontWeight: 700 }}>
                                                {typeof p.v === "number" && (title === "Revenue" || title === "Outstanding")
                                                    ? formatINR(p.v)
                                                    : p.v}
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                            <Area
                                dataKey="v"
                                stroke={accentColor}
                                fill={`url(#spark-${title})`}
                                strokeWidth={1.5}
                                dot={false}
                                activeDot={{ r: 3, fill: accentColor, stroke: "#000", strokeWidth: 1.5 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </SpotlightCard>
    );
}
