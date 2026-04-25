"use client";

import { useState } from "react";
import { X, MessageCircle, Package, MapPin, Loader2, ChevronLeft, ChevronRight, Rocket } from "lucide-react";
import { useProducts, useCreateCampaign, useGenerateCreatives, useUploadAudience } from "@/hooks/api-hooks";
import { CreativePreview } from "./CreativePreview";

interface Props {
    onClose: () => void;
}

const STEPS = ["Goal", "Audience", "Creative", "Budget & Schedule"];

export function CampaignWizard({ onClose }: Props) {
    const [step, setStep] = useState(0);

    // Step 1 — Goal
    const [objective, setObjective] = useState("");

    // Step 2 — Audience
    const [userType, setUserType] = useState<"B2B" | "B2C">("B2B");
    const [city, setCity] = useState("");
    const [radius, setRadius] = useState(5);
    const [uploadAudienceChecked, setUploadAudienceChecked] = useState(false);

    // Step 3 — Creative
    const [selectedProductId, setSelectedProductId] = useState("");
    const [creatives, setCreatives] = useState<any[]>([]);
    const [selectedCreativeIdx, setSelectedCreativeIdx] = useState(0);
    const [editedHeadline, setEditedHeadline] = useState("");
    const [editedBody, setEditedBody] = useState("");

    // Step 4 — Budget
    const [dailyBudget, setDailyBudget] = useState(500);
    const [duration, setDuration] = useState(7);

    const { data: productsData } = useProducts({});
    const products: any[] = Array.isArray(productsData) ? productsData : productsData?.products ?? [];
    const generateCreatives = useGenerateCreatives();
    const createCampaign = useCreateCampaign();
    const uploadAudience = useUploadAudience();

    const canNext = () => {
        if (step === 0) return !!objective;
        if (step === 1) return !!city;
        if (step === 2) return creatives.length > 0;
        if (step === 3) return dailyBudget >= 100;
        return true;
    };

    const handleGenerateCreatives = () => {
        if (!selectedProductId) return;
        generateCreatives.mutate(
            { productId: selectedProductId, userType },
            {
                onSuccess: (data: any) => {
                    const combos = data?.combinations || [];
                    setCreatives(combos);
                    if (combos.length > 0) {
                        setSelectedCreativeIdx(0);
                        setEditedHeadline(combos[0].headline);
                        setEditedBody(combos[0].body);
                    }
                },
            },
        );
    };

    const handleLaunch = () => {
        const startDate = new Date().toISOString();
        const endDate = new Date(Date.now() + duration * 86400000).toISOString();
        const creative = creatives[selectedCreativeIdx];

        if (uploadAudienceChecked) {
            uploadAudience.mutate();
        }

        createCampaign.mutate(
            {
                objective,
                platform: ["facebook", "instagram"],
                userType,
                dailyBudget,
                startDate,
                endDate,
                adCreative: {
                    headline: editedHeadline || creative?.headline || "",
                    body: editedBody || creative?.body || "",
                    cta: creative?.cta || "Learn More",
                },
            },
            { onSuccess: () => onClose() },
        );
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
        }}>
            {/* Backdrop */}
            <div onClick={onClose} style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)",
            }} />

            {/* Modal */}
            <div style={{
                position: "relative", width: "100%", maxWidth: 640,
                maxHeight: "90vh", overflowY: "auto",
                background: "var(--bg-primary)", borderRadius: 20,
                boxShadow: "0 24px 80px rgba(0,0,0,.35)",
                padding: "1.75rem",
                margin: "1rem",
            }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                        New Campaign
                    </h2>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Step indicators */}
                <div style={{ display: "flex", gap: ".5rem", marginBottom: "1.75rem" }}>
                    {STEPS.map((s, i) => (
                        <div key={s} style={{
                            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: ".3rem",
                        }}>
                            <div style={{
                                height: 4, width: "100%", borderRadius: 4,
                                background: i <= step ? "var(--primary)" : "var(--border)",
                                transition: "background .3s",
                            }} />
                            <span style={{
                                fontSize: ".65rem", fontWeight: i === step ? 700 : 400,
                                color: i <= step ? "var(--text-primary)" : "var(--text-muted)",
                            }}>{s}</span>
                        </div>
                    ))}
                </div>

                {/* Step 1 — Goal */}
                {step === 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <p style={{ fontSize: ".9rem", color: "var(--text-secondary)", margin: 0 }}>
                            What do you want to achieve with this ad?
                        </p>
                        {[
                            { value: "MESSAGES", label: "Get WhatsApp enquiries", desc: "Drive conversations with potential buyers", icon: MessageCircle, color: "#25D366" },
                            { value: "CATALOG_SALES", label: "Promote my products", desc: "Show your catalog and drive orders", icon: Package, color: "#3b82f6" },
                            { value: "REACH", label: "Reach local retailers", desc: "Get your brand in front of shop owners nearby", icon: MapPin, color: "#f59e0b" },
                        ].map((g) => (
                            <div
                                key={g.value}
                                onClick={() => setObjective(g.value)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "1rem",
                                    padding: "1rem 1.25rem", borderRadius: 14,
                                    border: `2px solid ${objective === g.value ? "var(--primary)" : "var(--border)"}`,
                                    background: objective === g.value ? "var(--bg-tertiary)" : "transparent",
                                    cursor: "pointer", transition: "all .2s",
                                }}
                            >
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: `${g.color}20`, display: "flex",
                                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                                }}>
                                    <g.icon size={22} color={g.color} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: ".95rem", color: "var(--text-primary)" }}>{g.label}</div>
                                    <div style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>{g.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Step 2 — Audience */}
                {step === 1 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                        <div>
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: ".4rem", display: "block" }}>
                                Target User Type
                            </label>
                            <div style={{ display: "flex", gap: ".5rem" }}>
                                {(["B2B", "B2C"] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setUserType(t)}
                                        style={{
                                            flex: 1, padding: ".6rem", borderRadius: 10,
                                            border: `2px solid ${userType === t ? "var(--primary)" : "var(--border)"}`,
                                            background: userType === t ? "var(--bg-tertiary)" : "transparent",
                                            color: "var(--text-primary)", fontWeight: 600, fontSize: ".85rem",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {t === "B2B" ? "🏪 Shop Owners" : "🛒 Consumers"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: ".4rem", display: "block" }}>
                                City / Area
                            </label>
                            <input
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                placeholder="e.g. Jaipur, Rajkot, Indore..."
                                style={{
                                    width: "100%", padding: ".65rem .9rem", borderRadius: 10,
                                    border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                    color: "var(--text-primary)", fontSize: ".9rem", outline: "none",
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: ".4rem", display: "block" }}>
                                Radius: {radius} km
                            </label>
                            <div style={{ display: "flex", gap: ".4rem" }}>
                                {[1, 3, 5, 10].map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setRadius(r)}
                                        style={{
                                            flex: 1, padding: ".45rem", borderRadius: 8,
                                            border: `1px solid ${radius === r ? "var(--primary)" : "var(--border)"}`,
                                            background: radius === r ? "var(--primary)" : "transparent",
                                            color: radius === r ? "#fff" : "var(--text-secondary)",
                                            fontWeight: 500, fontSize: ".8rem", cursor: "pointer",
                                        }}
                                    >{r} km</button>
                                ))}
                            </div>
                        </div>

                        {userType === "B2B" && (
                            <label style={{
                                display: "flex", alignItems: "center", gap: ".6rem",
                                padding: ".75rem 1rem", borderRadius: 10,
                                background: "var(--bg-tertiary)", cursor: "pointer",
                            }}>
                                <input
                                    type="checkbox"
                                    checked={uploadAudienceChecked}
                                    onChange={(e) => setUploadAudienceChecked(e.target.checked)}
                                    style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                                />
                                <span style={{ fontSize: ".85rem", color: "var(--text-secondary)" }}>
                                    Upload my CRM customer list for better targeting
                                </span>
                            </label>
                        )}
                    </div>
                )}

                {/* Step 3 — Creative */}
                {step === 2 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                        <div>
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: ".4rem", display: "block" }}>
                                Pick a product to advertise
                            </label>
                            <select
                                value={selectedProductId}
                                onChange={(e) => setSelectedProductId(e.target.value)}
                                style={{
                                    width: "100%", padding: ".65rem .9rem", borderRadius: 10,
                                    border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                    color: "var(--text-primary)", fontSize: ".9rem",
                                }}
                            >
                                <option value="">Select a product...</option>
                                {products.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} — ₹{p.price ?? p.mrp ?? "N/A"}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={handleGenerateCreatives}
                            disabled={!selectedProductId || generateCreatives.isPending}
                            style={{
                                padding: ".65rem 1.2rem", borderRadius: 10,
                                background: "var(--primary)", color: "#fff",
                                fontWeight: 600, border: "none", cursor: "pointer",
                                fontSize: ".85rem", opacity: !selectedProductId ? 0.5 : 1,
                                display: "inline-flex", alignItems: "center", gap: ".4rem",
                                alignSelf: "flex-start",
                            }}
                        >
                            {generateCreatives.isPending ? <Loader2 size={16} className="animate-spin" /> : "✨"}
                            {generateCreatives.isPending ? "Claude is writing..." : "Generate Ad Copy with AI"}
                        </button>

                        {creatives.length > 0 && (
                            <>
                                <div style={{
                                    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                    gap: ".75rem",
                                }}>
                                    {creatives.map((c: any, i: number) => (
                                        <CreativePreview
                                            key={i}
                                            creative={c}
                                            selected={selectedCreativeIdx === i}
                                            onSelect={() => {
                                                setSelectedCreativeIdx(i);
                                                setEditedHeadline(c.headline);
                                                setEditedBody(c.body);
                                            }}
                                        />
                                    ))}
                                </div>

                                {/* Inline editing */}
                                <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
                                    <label style={{ fontSize: ".75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                                        Edit headline
                                    </label>
                                    <input
                                        value={editedHeadline}
                                        onChange={(e) => setEditedHeadline(e.target.value)}
                                        style={{
                                            padding: ".55rem .8rem", borderRadius: 8,
                                            border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                            color: "var(--text-primary)", fontSize: ".85rem",
                                        }}
                                    />
                                    <label style={{ fontSize: ".75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                                        Edit body
                                    </label>
                                    <textarea
                                        value={editedBody}
                                        onChange={(e) => setEditedBody(e.target.value)}
                                        rows={3}
                                        style={{
                                            padding: ".55rem .8rem", borderRadius: 8,
                                            border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                            color: "var(--text-primary)", fontSize: ".85rem", resize: "vertical",
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Step 4 — Budget & Schedule */}
                {step === 3 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                        <div>
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: ".4rem", display: "block" }}>
                                Daily Budget (₹)
                            </label>
                            <input
                                type="number"
                                min={100}
                                value={dailyBudget}
                                onChange={(e) => setDailyBudget(Math.max(100, Number(e.target.value)))}
                                style={{
                                    width: "100%", padding: ".65rem .9rem", borderRadius: 10,
                                    border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                    color: "var(--text-primary)", fontSize: "1.1rem", fontWeight: 700,
                                }}
                            />
                            <p style={{ fontSize: ".75rem", color: "var(--text-muted)", marginTop: ".3rem" }}>
                                Minimum ₹100/day · Total ≈ ₹{(dailyBudget * duration).toLocaleString("en-IN")} for {duration} days
                            </p>
                        </div>

                        <div>
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: ".4rem", display: "block" }}>
                                Duration
                            </label>
                            <div style={{ display: "flex", gap: ".4rem" }}>
                                {[7, 14, 30].map((d) => (
                                    <button
                                        key={d}
                                        onClick={() => setDuration(d)}
                                        style={{
                                            flex: 1, padding: ".6rem", borderRadius: 10,
                                            border: `2px solid ${duration === d ? "var(--primary)" : "var(--border)"}`,
                                            background: duration === d ? "var(--bg-tertiary)" : "transparent",
                                            color: "var(--text-primary)", fontWeight: 600, fontSize: ".85rem",
                                            cursor: "pointer",
                                        }}
                                    >{d} days</button>
                                ))}
                            </div>
                        </div>

                        {/* Cost preview */}
                        <div style={{
                            padding: "1rem 1.25rem", borderRadius: 12,
                            background: "linear-gradient(135deg, #22c55e15, #3b82f615)",
                            border: "1px solid var(--border)",
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", marginBottom: ".4rem" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Daily Budget</span>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>₹{dailyBudget}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", marginBottom: ".4rem" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Duration</span>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{duration} days</span>
                            </div>
                            <div style={{
                                display: "flex", justifyContent: "space-between", fontSize: "1rem",
                                paddingTop: ".5rem", borderTop: "1px solid var(--border)",
                            }}>
                                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>Max Total Spend</span>
                                <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "1.15rem" }}>
                                    ₹{(dailyBudget * duration).toLocaleString("en-IN")}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation footer */}
                <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginTop: "1.75rem", paddingTop: "1rem",
                    borderTop: "1px solid var(--border)",
                }}>
                    {step > 0 ? (
                        <button
                            onClick={() => setStep(step - 1)}
                            style={{
                                display: "inline-flex", alignItems: "center", gap: ".3rem",
                                padding: ".55rem 1rem", borderRadius: 10,
                                border: "1px solid var(--border)", background: "transparent",
                                color: "var(--text-secondary)", fontWeight: 500, fontSize: ".85rem",
                                cursor: "pointer",
                            }}
                        >
                            <ChevronLeft size={16} /> Back
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < 3 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={!canNext()}
                            style={{
                                display: "inline-flex", alignItems: "center", gap: ".3rem",
                                padding: ".55rem 1.2rem", borderRadius: 10,
                                background: canNext() ? "var(--primary)" : "var(--bg-tertiary)",
                                color: canNext() ? "#fff" : "var(--text-muted)",
                                fontWeight: 600, fontSize: ".85rem",
                                border: "none", cursor: canNext() ? "pointer" : "not-allowed",
                            }}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={handleLaunch}
                            disabled={!canNext() || createCampaign.isPending}
                            style={{
                                display: "inline-flex", alignItems: "center", gap: ".4rem",
                                padding: ".65rem 1.5rem", borderRadius: 10,
                                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                color: "#fff", fontWeight: 700, fontSize: ".95rem",
                                border: "none", cursor: createCampaign.isPending ? "wait" : "pointer",
                                boxShadow: "0 4px 16px rgba(34,197,94,.3)",
                                opacity: createCampaign.isPending ? 0.7 : 1,
                            }}
                        >
                            {createCampaign.isPending ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={18} />}
                            Launch Campaign
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
