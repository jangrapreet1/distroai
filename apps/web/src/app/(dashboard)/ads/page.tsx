"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle, Megaphone, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMarketingStatus, useCampaigns, useMetaConnect } from "@/hooks/api-hooks";
import { MetaConnectBanner } from "./components/MetaConnectBanner";
import { CampaignTable } from "./components/CampaignTable";
import { CampaignWizard } from "./components/CampaignWizard";
import { ROIDashboard } from "./components/ROIDashboard";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "";

export default function AdsPage() {
    const { org } = useAuth();
    const { data: status, isLoading: statusLoading } = useMarketingStatus();
    const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();
    const connectMeta = useMetaConnect();
    const searchParams = useSearchParams();
    const [wizardOpen, setWizardOpen] = useState(false);

    // ── Plan Gate (Growth+ only) ──
    const plan = (org as any)?.plan || "FREE";
    const hasAdsAccess = plan === "GROWTH" || plan === "ENTERPRISE";
    if (!hasAdsAccess) {
        return (
            <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", minHeight: "60vh", gap: "1.5rem",
                padding: "2rem", textAlign: "center",
            }}>
                <div style={{
                    width: 80, height: 80, borderRadius: "50%",
                    background: "linear-gradient(135deg, #1877F2, #E1306C)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0.3,
                }}>
                    <Megaphone size={36} color="#fff" />
                </div>
                <div>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 .5rem" }}>
                        Ads & Marketing
                    </h2>
                    <p style={{ fontSize: ".95rem", color: "var(--text-secondary)", maxWidth: 400, lineHeight: 1.6 }}>
                        Launch Meta ads directly from DistroAI. Upgrade to the Growth plan to unlock AI-powered ad campaigns with closed-loop ROI tracking.
                    </p>
                </div>
                <a
                    href="/settings/billing"
                    style={{
                        display: "inline-flex", alignItems: "center", gap: ".4rem",
                        padding: ".7rem 1.5rem", borderRadius: 10,
                        background: "linear-gradient(135deg, #f59e0b, #d97706)",
                        color: "#fff", fontWeight: 600, fontSize: ".95rem",
                        textDecoration: "none",
                        boxShadow: "0 4px 16px rgba(245,158,11,.3)",
                    }}
                >
                    Upgrade to Growth — ₹1,999/mo <ArrowUpRight size={16} />
                </a>
            </div>
        );
    }

    // Handle Meta OAuth callback (code in query string)
    const code = searchParams.get("code");
    useEffect(() => {
        if (code && !connectMeta.isPending && !connectMeta.isSuccess) {
            const redirectUri = `${window.location.origin}/ads`;
            connectMeta.mutate({ code, redirectUri });
            // Clean the URL after extracting the code
            window.history.replaceState({}, "", "/ads");
        }
    }, [code]);

    const isConnected = status?.connected === true;
    const isExpired = status?.isExpired === true;

    const handleConnect = () => {
        const redirectUri = `${window.location.origin}/ads`;
        const oauthUrl =
            `https://www.facebook.com/v19.0/dialog/oauth?` +
            `client_id=${META_APP_ID}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=ads_management,ads_read,business_management` +
            `&response_type=code`;
        window.location.href = oauthUrl;
    };

    // Loading state
    if (statusLoading) {
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: "60vh", gap: ".75rem", color: "var(--text-muted)",
            }}>
                <Loader2 size={24} className="animate-spin" />
                <span>Loading ad settings...</span>
            </div>
        );
    }

    // Not connected — show connect banner
    if (!isConnected) {
        return (
            <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
                <MetaConnectBanner onConnect={handleConnect} loading={connectMeta.isPending} />
            </div>
        );
    }

    // Connected — show dashboard
    const campaignList = Array.isArray(campaigns) ? campaigns : [];

    return (
        <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
            {/* Page header */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "1.75rem",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: ".65rem" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: "linear-gradient(135deg, #1877F2, #E1306C)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <Megaphone size={20} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                            Ads & Marketing
                        </h1>
                        <p style={{ fontSize: ".8rem", color: "var(--text-muted)", margin: 0 }}>
                            Manage your Facebook, Instagram & WhatsApp ads
                        </p>
                    </div>
                </div>
            </div>

            {/* Token expired alert */}
            {isExpired && (
                <div style={{
                    display: "flex", alignItems: "center", gap: ".75rem",
                    padding: ".75rem 1rem", borderRadius: 12,
                    background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)",
                    marginBottom: "1.25rem",
                }}>
                    <AlertTriangle size={18} color="#ef4444" />
                    <span style={{ flex: 1, fontSize: ".85rem", color: "var(--text-primary)" }}>
                        Your Facebook connection has expired. Reconnect to resume your ads.
                    </span>
                    <button
                        onClick={handleConnect}
                        style={{
                            padding: ".4rem .8rem", borderRadius: 8,
                            background: "#ef4444", color: "#fff",
                            fontWeight: 600, fontSize: ".8rem",
                            border: "none", cursor: "pointer",
                        }}
                    >Reconnect</button>
                </div>
            )}

            {/* ROI Dashboard */}
            {campaignList.length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                    <ROIDashboard campaigns={campaignList} />
                </div>
            )}

            {/* Campaign Table */}
            {campaignsLoading ? (
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "3rem", gap: ".5rem", color: "var(--text-muted)",
                }}>
                    <Loader2 size={20} className="animate-spin" />
                    Loading campaigns...
                </div>
            ) : (
                <CampaignTable campaigns={campaignList} onNewCampaign={() => setWizardOpen(true)} />
            )}

            {/* Campaign Wizard Modal */}
            {wizardOpen && <CampaignWizard onClose={() => setWizardOpen(false)} />}
        </div>
    );
}
