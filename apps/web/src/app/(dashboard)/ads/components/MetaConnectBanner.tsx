"use client";

import { Megaphone, ExternalLink, Loader2 } from "lucide-react";

interface Props {
    onConnect: () => void;
    loading?: boolean;
}

export function MetaConnectBanner({ onConnect, loading }: Props) {
    return (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            minHeight: "60vh", gap: "2rem", padding: "2rem", textAlign: "center",
        }}>
            {/* Gradient icon circle */}
            <div style={{
                width: 96, height: 96, borderRadius: "50%",
                background: "linear-gradient(135deg, #1877F2, #E1306C, #25D366)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(24,119,242,.25)",
            }}>
                <Megaphone size={44} color="#fff" />
            </div>

            <div>
                <h2 style={{
                    fontSize: "1.75rem", fontWeight: 700,
                    color: "var(--text-primary)", margin: "0 0 .5rem",
                }}>Launch Ads from DistroAI</h2>
                <p style={{
                    fontSize: "1rem", color: "var(--text-secondary)",
                    maxWidth: 440, lineHeight: 1.6, margin: "0 auto",
                }}>
                    Connect your Facebook Business account to run Facebook, Instagram & WhatsApp ads
                    directly from your dashboard. Track every order back to the ad that generated it.
                </p>
            </div>

            {/* Feature pills */}
            <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", justifyContent: "center" }}>
                {["AI-generated ad copy", "WhatsApp lead capture", "₹ ROI tracking", "1-click launch"].map((f) => (
                    <span key={f} style={{
                        padding: ".4rem .9rem", borderRadius: 20,
                        background: "var(--bg-tertiary)", color: "var(--text-secondary)",
                        fontSize: ".8rem", fontWeight: 500,
                    }}>{f}</span>
                ))}
            </div>

            <button
                onClick={onConnect}
                disabled={loading}
                style={{
                    display: "inline-flex", alignItems: "center", gap: ".5rem",
                    padding: ".75rem 2rem", borderRadius: 12,
                    background: "linear-gradient(135deg, #1877F2, #0D6EFD)",
                    color: "#fff", fontWeight: 600, fontSize: "1rem",
                    border: "none", cursor: loading ? "wait" : "pointer",
                    boxShadow: "0 4px 16px rgba(24,119,242,.3)",
                    transition: "transform .15s, box-shadow .15s",
                    opacity: loading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => { if (!loading) { (e.target as HTMLElement).style.transform = "translateY(-2px)"; } }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "translateY(0)"; }}
            >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ExternalLink size={18} />}
                Connect Facebook Account
            </button>

            <p style={{ fontSize: ".75rem", color: "var(--text-muted)", marginTop: "-.5rem" }}>
                Uses Meta Marketing API · Your data stays encrypted
            </p>
        </div>
    );
}
