"use client";

import { useState } from "react";
import { Pause, Play, Trash2, AlertCircle, Loader2, Megaphone } from "lucide-react";
import { useUpdateCampaign, useDeleteCampaign } from "@/hooks/api-hooks";

interface Campaign {
    id: string;
    utmCampaignId: string;
    objective: string;
    platform: string[];
    status: string;
    dailyBudget: number;
    totalSpend: number;
    errorReason?: string | null;
    metrics?: { impressions: number; clicks: number; messagesStarted: number; ordersGenerated: number }[];
}

interface Props {
    campaigns: Campaign[];
    onNewCampaign: () => void;
}

const statusColors: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: "rgba(34,197,94,.15)", text: "#22c55e" },
    PAUSED: { bg: "rgba(234,179,8,.15)", text: "#eab308" },
    ERROR: { bg: "rgba(239,68,68,.15)", text: "#ef4444" },
    DELETED: { bg: "rgba(107,114,128,.15)", text: "#6b7280" },
};

const fmtINR = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n);

export function CampaignTable({ campaigns, onNewCampaign }: Props) {
    const updateCampaign = useUpdateCampaign();
    const deleteCampaign = useDeleteCampaign();
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    if (campaigns.length === 0) {
        return (
            <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: "1.5rem", padding: "4rem 2rem", textAlign: "center",
            }}>
                <div style={{
                    width: 80, height: 80, borderRadius: "50%",
                    background: "var(--bg-tertiary)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                }}>
                    <Megaphone size={36} color="var(--text-muted)" />
                </div>
                <div>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 .4rem" }}>
                        No campaigns yet
                    </h3>
                    <p style={{ fontSize: ".9rem", color: "var(--text-secondary)", maxWidth: 360 }}>
                        Launch your first ad to reach retailers and consumers across Facebook, Instagram & WhatsApp.
                    </p>
                </div>
                <button
                    onClick={onNewCampaign}
                    style={{
                        padding: ".65rem 1.5rem", borderRadius: 10,
                        background: "var(--primary)", color: "#fff",
                        fontWeight: 600, border: "none", cursor: "pointer",
                        fontSize: ".9rem",
                    }}
                >Launch your first ad</button>
            </div>
        );
    }

    return (
        <div style={{ overflowX: "auto" }}>
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "1rem",
            }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    Campaigns ({campaigns.length})
                </h3>
                <button
                    onClick={onNewCampaign}
                    style={{
                        padding: ".5rem 1.2rem", borderRadius: 10,
                        background: "var(--primary)", color: "#fff",
                        fontWeight: 600, border: "none", cursor: "pointer",
                        fontSize: ".85rem",
                    }}
                >+ New Campaign</button>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".85rem" }}>
                <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Name", "Platform", "Status", "Daily Budget", "Spent", "Impressions", "WA Chats", "Orders", "Actions"].map((h) => (
                            <th key={h} style={{
                                padding: ".6rem .5rem", textAlign: "left",
                                color: "var(--text-muted)", fontWeight: 500, fontSize: ".75rem",
                                textTransform: "uppercase", letterSpacing: ".04em",
                                whiteSpace: "nowrap",
                            }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {campaigns.map((c) => {
                        const m = c.metrics?.[0];
                        const sc = statusColors[c.status] || statusColors.DELETED;
                        return (
                            <tr key={c.id} style={{
                                borderBottom: "1px solid var(--border)",
                                transition: "background .15s",
                            }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                                <td style={{ padding: ".7rem .5rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                                    {c.utmCampaignId}
                                </td>
                                <td style={{ padding: ".7rem .5rem", color: "var(--text-secondary)" }}>
                                    {c.platform.join(", ")}
                                </td>
                                <td style={{ padding: ".7rem .5rem" }}>
                                    <span
                                        style={{
                                            display: "inline-flex", alignItems: "center", gap: ".3rem",
                                            padding: ".2rem .6rem", borderRadius: 8,
                                            background: sc.bg, color: sc.text,
                                            fontSize: ".75rem", fontWeight: 600,
                                        }}
                                        title={c.status === "ERROR" && c.errorReason ? c.errorReason : undefined}
                                    >
                                        {c.status === "ERROR" && <AlertCircle size={12} />}
                                        {c.status}
                                    </span>
                                </td>
                                <td style={{ padding: ".7rem .5rem", color: "var(--text-secondary)" }}>
                                    {fmtINR(Number(c.dailyBudget))}
                                </td>
                                <td style={{ padding: ".7rem .5rem", color: "var(--text-secondary)" }}>
                                    {fmtINR(Number(c.totalSpend))}
                                </td>
                                <td style={{ padding: ".7rem .5rem", color: "var(--text-secondary)" }}>
                                    {(m?.impressions ?? 0).toLocaleString("en-IN")}
                                </td>
                                <td style={{ padding: ".7rem .5rem", color: "var(--text-secondary)" }}>
                                    {m?.messagesStarted ?? 0}
                                </td>
                                <td style={{ padding: ".7rem .5rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                    {m?.ordersGenerated ?? 0}
                                </td>
                                <td style={{ padding: ".7rem .5rem", whiteSpace: "nowrap" }}>
                                    <div style={{ display: "flex", gap: ".4rem" }}>
                                        {c.status !== "DELETED" && (
                                            <button
                                                onClick={() => updateCampaign.mutate({
                                                    id: c.id,
                                                    action: c.status === "ACTIVE" ? "pause" : "resume",
                                                })}
                                                disabled={updateCampaign.isPending}
                                                style={{
                                                    padding: ".3rem .5rem", borderRadius: 6,
                                                    border: "1px solid var(--border)",
                                                    background: "transparent", cursor: "pointer",
                                                    color: "var(--text-secondary)", display: "inline-flex",
                                                    alignItems: "center",
                                                }}
                                                title={c.status === "ACTIVE" ? "Pause" : "Resume"}
                                            >
                                                {updateCampaign.isPending ? <Loader2 size={14} className="animate-spin" /> :
                                                    c.status === "ACTIVE" ? <Pause size={14} /> : <Play size={14} />}
                                            </button>
                                        )}
                                        {deleteConfirm === c.id ? (
                                            <div style={{ display: "flex", gap: ".3rem", alignItems: "center" }}>
                                                <button
                                                    onClick={() => { deleteCampaign.mutate(c.id); setDeleteConfirm(null); }}
                                                    style={{
                                                        padding: ".3rem .5rem", borderRadius: 6,
                                                        background: "#ef4444", color: "#fff", border: "none",
                                                        fontSize: ".7rem", fontWeight: 600, cursor: "pointer",
                                                    }}
                                                >Yes</button>
                                                <button
                                                    onClick={() => setDeleteConfirm(null)}
                                                    style={{
                                                        padding: ".3rem .5rem", borderRadius: 6,
                                                        border: "1px solid var(--border)", background: "transparent",
                                                        color: "var(--text-secondary)", fontSize: ".7rem", cursor: "pointer",
                                                    }}
                                                >No</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setDeleteConfirm(c.id)}
                                                style={{
                                                    padding: ".3rem .5rem", borderRadius: 6,
                                                    border: "1px solid var(--border)",
                                                    background: "transparent", cursor: "pointer",
                                                    color: "var(--text-muted)", display: "inline-flex",
                                                    alignItems: "center",
                                                }}
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
