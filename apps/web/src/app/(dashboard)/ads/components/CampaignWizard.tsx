"use client";

import { useState, useRef } from "react";
import { X, MessageCircle, Package, MapPin, Loader2, ChevronLeft, ChevronRight, Rocket, Upload, Image, Film, Trash2 } from "lucide-react";
import { useProducts, useCreateCampaign, useGenerateCreatives, useUploadAudience, useUploadFile } from "@/hooks/api-hooks";
import { CreativePreview } from "./CreativePreview";

interface Props {
    onClose: () => void;
}

const STEPS = ["Goal", "Audience", "Creative", "Budget & Schedule"];

const PLATFORMS = [
    { id: "facebook", label: "Facebook", icon: "📘", color: "#1877F2" },
    { id: "instagram", label: "Instagram", icon: "📸", color: "#E1306C" },
    { id: "whatsapp", label: "WhatsApp", icon: "💬", color: "#25D366" },
] as const;

export function CampaignWizard({ onClose }: Props) {
    const [step, setStep] = useState(0);

    // Step 1 — Goal
    const [objective, setObjective] = useState("");
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["facebook", "instagram"]);

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
    const [aiLanguage, setAiLanguage] = useState("English");
    const [mediaFiles, setMediaFiles] = useState<{ url: string; type: "image" | "video"; name: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step 4 — Budget
    const [dailyBudget, setDailyBudget] = useState(500);
    const [duration, setDuration] = useState(7);

    const { data: productsData } = useProducts({ isActive: true, limit: 100 });
    // Products API returns { data: [...], meta: {...} } — drill into nested .data.data or .data
    const productsRaw = productsData?.data;
    const products: any[] = Array.isArray(productsRaw)
        ? productsRaw
        : (productsRaw?.data ?? productsRaw?.products ?? []);
    const generateCreatives = useGenerateCreatives();
    const createCampaign = useCreateCampaign();
    const uploadAudience = useUploadAudience();
    const uploadFile = useUploadFile();

    const togglePlatform = (id: string) => {
        setSelectedPlatforms((prev) =>
            prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
        );
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        for (const file of Array.from(files)) {
            const isVideo = file.type.startsWith("video/");
            const isImage = file.type.startsWith("image/");
            if (!isVideo && !isImage) continue;
            try {
                const res = await uploadFile.mutateAsync(file);
                setMediaFiles((prev) => [
                    ...prev,
                    { url: res.url || res.path, type: isVideo ? "video" : "image", name: file.name },
                ]);
            } catch { /* toast shown by hook */ }
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeMedia = (idx: number) => setMediaFiles((prev) => prev.filter((_, i) => i !== idx));

    const canNext = () => {
        if (step === 0) return !!objective && selectedPlatforms.length > 0;
        if (step === 1) return !!city;
        if (step === 2) return !!editedHeadline && !!editedBody;
        if (step === 3) return dailyBudget >= 100;
        return true;
    };

    const handleGenerateCreatives = () => {
        if (!selectedProductId) return;
        generateCreatives.mutate(
            { productId: selectedProductId, userType, language: aiLanguage },
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
                platform: selectedPlatforms,
                userType,
                dailyBudget,
                startDate,
                endDate,
                adCreative: {
                    headline: editedHeadline || creative?.headline || "",
                    body: editedBody || creative?.body || "",
                    cta: creative?.cta || "Learn More",
                    mediaUrls: mediaFiles.map((m) => m.url),
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
                        {/* Platform Selection */}
                        <div style={{ marginTop: ".5rem" }}>
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: ".5rem", display: "block" }}>
                                Where do you want to run this ad?
                            </label>
                            <div style={{ display: "flex", gap: ".5rem" }}>
                                {PLATFORMS.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => togglePlatform(p.id)}
                                        style={{
                                            flex: 1, padding: ".65rem .5rem", borderRadius: 10,
                                            border: `2px solid ${selectedPlatforms.includes(p.id) ? p.color : "var(--border)"}`,
                                            background: selectedPlatforms.includes(p.id) ? `${p.color}15` : "transparent",
                                            color: "var(--text-primary)", fontWeight: 600, fontSize: ".8rem",
                                            cursor: "pointer", transition: "all .2s",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: ".3rem",
                                        }}
                                    >
                                        <span>{p.icon}</span> {p.label}
                                    </button>
                                ))}
                            </div>
                            {selectedPlatforms.length === 0 && (
                                <p style={{ fontSize: ".75rem", color: "#ef4444", margin: ".3rem 0 0" }}>Select at least one platform</p>
                            )}
                        </div>
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
                        {/* Product selector (optional) */}
                        <div>
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: ".4rem", display: "block" }}>
                                Link a product <span style={{ fontWeight: 400 }}>(optional — helps AI generate copy)</span>
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
                                <option value="">No product selected</option>
                                {products.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} — ₹{p.sellingPrice ?? p.mrp ?? "N/A"}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Manual ad copy inputs — PRIMARY */}
                        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "-.2rem" }}>
                                Ad Headline <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <input
                                value={editedHeadline}
                                onChange={(e) => setEditedHeadline(e.target.value)}
                                placeholder="e.g. Premium Quality Products at Best Prices"
                                style={{
                                    padding: ".65rem .9rem", borderRadius: 10,
                                    border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                    color: "var(--text-primary)", fontSize: ".9rem",
                                }}
                            />
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginTop: ".4rem", marginBottom: "-.2rem" }}>
                                Ad Body <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <textarea
                                value={editedBody}
                                onChange={(e) => setEditedBody(e.target.value)}
                                placeholder="Write your ad text here. Describe your product, offer, or promotion..."
                                rows={3}
                                style={{
                                    padding: ".65rem .9rem", borderRadius: 10,
                                    border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                    color: "var(--text-primary)", fontSize: ".9rem", resize: "vertical",
                                }}
                            />
                        </div>

                        {/* Media Upload */}
                        <div>
                            <label style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: ".5rem", display: "block" }}>
                                Ad Media <span style={{ fontWeight: 400 }}>(images or videos)</span>
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                onChange={handleMediaUpload}
                                style={{ display: "none" }}
                            />
                            {mediaFiles.length > 0 && (
                                <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: ".5rem" }}>
                                    {mediaFiles.map((m, i) => (
                                        <div key={i} style={{
                                            position: "relative", width: 80, height: 80, borderRadius: 10,
                                            overflow: "hidden", border: "1px solid var(--border)",
                                            background: "var(--bg-secondary)",
                                        }}>
                                            {m.type === "image" ? (
                                                <img src={m.url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: ".2rem" }}>
                                                    <Film size={20} color="var(--text-muted)" />
                                                    <span style={{ fontSize: ".6rem", color: "var(--text-muted)" }}>Video</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removeMedia(i)}
                                                style={{
                                                    position: "absolute", top: 2, right: 2,
                                                    width: 20, height: 20, borderRadius: "50%",
                                                    background: "rgba(239,68,68,.9)", border: "none",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <X size={12} color="#fff" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadFile.isPending}
                                style={{
                                    width: "100%", padding: ".75rem", borderRadius: 10,
                                    border: "2px dashed var(--border)", background: "transparent",
                                    color: "var(--text-secondary)", fontSize: ".85rem", fontWeight: 500,
                                    cursor: "pointer", display: "flex", alignItems: "center",
                                    justifyContent: "center", gap: ".5rem", transition: "all .2s",
                                }}
                            >
                                {uploadFile.isPending ? (
                                    <><Loader2 size={16} className="animate-spin" /> Uploading...</>
                                ) : (
                                    <><Upload size={16} /> Upload Images or Videos</>
                                )}
                            </button>
                        </div>

                        {/* AI Assist — SECONDARY, collapsible */}
                        <details style={{
                            borderRadius: 10, border: "1px dashed var(--border)",
                            background: "var(--bg-card)",
                        }}>
                            <summary style={{
                                padding: ".75rem 1rem", cursor: "pointer",
                                display: "flex", alignItems: "center", gap: ".4rem",
                                fontSize: ".85rem", fontWeight: 600, color: "var(--text-secondary)",
                                listStyle: "none",
                            }}>
                                ✨ Need ideas? Generate copy with AI
                            </summary>
                            <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: ".75rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                                    <span style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>Language:</span>
                                    <select
                                        value={aiLanguage}
                                        onChange={(e) => setAiLanguage(e.target.value)}
                                        style={{
                                            padding: ".3rem .6rem", borderRadius: 6,
                                            border: "1px solid var(--border)", background: "var(--bg-secondary)",
                                            fontSize: ".8rem", color: "var(--text-primary)",
                                        }}
                                    >
                                        <option value="English">English</option>
                                        <option value="Hindi">Hindi</option>
                                        <option value="Hinglish">Hinglish</option>
                                        <option value="Tamil">Tamil</option>
                                        <option value="Telugu">Telugu</option>
                                        <option value="Marathi">Marathi</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleGenerateCreatives}
                                    disabled={!selectedProductId || generateCreatives.isPending}
                                    style={{
                                        padding: ".6rem 1rem", borderRadius: 8,
                                        background: "var(--bg-secondary)", color: "var(--text-primary)",
                                        fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer",
                                        fontSize: ".85rem", opacity: !selectedProductId ? 0.5 : 1,
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: ".4rem",
                                    }}
                                >
                                    {generateCreatives.isPending ? <Loader2 size={16} className="animate-spin" /> : "✨"}
                                    {generateCreatives.isPending ? "Generating ideas..." : `Generate in ${aiLanguage}`}
                                </button>
                                {!selectedProductId && (
                                    <p style={{ fontSize: ".75rem", color: "var(--text-muted)", margin: 0 }}>
                                        Select a product above to use AI generation
                                    </p>
                                )}
                                {creatives.length > 0 && (
                                    <div style={{
                                        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                        gap: ".5rem", marginTop: ".25rem",
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
                                )}
                            </div>
                        </details>
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

                        {/* Model C: Facebook Page Creation Walkthrough */}
                        {createCampaign.error && (createCampaign.error as any).response?.data?.message?.includes("No Facebook Page") && (
                            <div style={{
                                padding: "1.5rem", borderRadius: 12, border: "1px solid #ef444450",
                                background: "#ef444410", marginTop: "1rem", textAlign: "center"
                            }}>
                                <div style={{ 
                                    width: 48, height: 48, borderRadius: 24, background: "#ef444420", 
                                    display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" 
                                }}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="#ef4444" strokeWidth="2" fill="none">
                                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                                    </svg>
                                </div>
                                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: ".5rem" }}>
                                    You need a Facebook Page
                                </h3>
                                <p style={{ fontSize: ".85rem", color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.5 }}>
                                    Meta requires a business page to act as the sender for your ads. We will automatically create your ad account once your page is linked!
                                </p>
                                
                                <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
                                    <button 
                                        type="button"
                                        onClick={() => window.open("https://www.facebook.com/pages/create", "_blank")}
                                        style={{
                                            padding: ".75rem", borderRadius: 8, background: "#1877F2", 
                                            color: "white", fontWeight: 600, border: "none", cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: ".5rem"
                                        }}
                                    >
                                        1. Create a Page in 2 mins
                                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                            <polyline points="15 3 21 3 21 9"></polyline>
                                            <line x1="10" y1="14" x2="21" y2="3"></line>
                                        </svg>
                                    </button>
                                    
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            // Trigger Facebook OAuth again to fetch the newly created page
                                            window.location.href = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/auth/facebook/connect`;
                                        }}
                                        style={{
                                            padding: ".75rem", borderRadius: 8, background: "var(--bg-card)", 
                                            color: "var(--text-primary)", fontWeight: 600, border: "1px solid var(--border)", 
                                            cursor: "pointer"
                                        }}
                                    >
                                        2. I've created it, reconnect my account
                                    </button>
                                </div>
                            </div>
                        )}
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
