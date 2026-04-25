"use client";

import { Check } from "lucide-react";

interface Creative {
    headline: string;
    body: string;
    cta: string;
    language: string;
}

interface Props {
    creative: Creative;
    selected: boolean;
    onSelect: () => void;
}

export function CreativePreview({ creative, selected, onSelect }: Props) {
    return (
        <div
            onClick={onSelect}
            style={{
                position: "relative",
                padding: "1.25rem", borderRadius: 14,
                border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                background: selected ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                cursor: "pointer",
                transition: "border-color .2s, background .2s, transform .15s",
                transform: selected ? "scale(1.02)" : "scale(1)",
            }}
            onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = "var(--text-muted)"; }}
            onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
        >
            {/* Selection indicator */}
            {selected && (
                <div style={{
                    position: "absolute", top: -8, right: -8,
                    width: 24, height: 24, borderRadius: "50%",
                    background: "var(--primary)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                }}>
                    <Check size={14} color="#fff" />
                </div>
            )}

            {/* Language badge */}
            <span style={{
                display: "inline-block", padding: ".15rem .5rem", borderRadius: 8,
                background: creative.language === "hi" ? "#FF9933" : "#0D6EFD",
                color: "#fff", fontSize: ".65rem", fontWeight: 600,
                textTransform: "uppercase", marginBottom: ".75rem",
            }}>
                {creative.language === "hi" ? "हिंदी" : "English"}
            </span>

            <h4 style={{
                fontSize: "1rem", fontWeight: 700,
                color: "var(--text-primary)", margin: "0 0 .5rem",
                lineHeight: 1.3,
            }}>{creative.headline}</h4>

            <p style={{
                fontSize: ".85rem", color: "var(--text-secondary)",
                lineHeight: 1.5, margin: "0 0 .75rem",
                display: "-webkit-box", WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>{creative.body}</p>

            <span style={{
                display: "inline-block", padding: ".35rem .8rem",
                borderRadius: 8, background: "var(--primary)",
                color: "#fff", fontSize: ".75rem", fontWeight: 600,
            }}>{creative.cta}</span>
        </div>
    );
}
