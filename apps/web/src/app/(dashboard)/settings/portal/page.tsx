"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Store, Copy, QrCode, ExternalLink, Download, Lock } from "lucide-react";
import { useOrg, useUpdateOrg, useSubscription } from "@/hooks/api-hooks";
import { useUpgradeStore } from "@/stores/upgrade.store";
import toast from "react-hot-toast";
import { SettingsLayout } from "@/components/ui/settings-layout";
import { QRCodeCanvas } from "qrcode.react";

function Toggle({ enabled, onToggle, label, description }: { enabled: boolean; onToggle: () => void; label: string; description?: string }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
            <div>
                <p className="text-sm font-medium">{label}</p>
                {description && <p className="text-xs text-[var(--text-muted)]">{description}</p>}
            </div>
            <button onClick={onToggle} className={`w-10 h-6 rounded-full relative transition ${enabled ? "bg-[var(--green)]/30" : "bg-[var(--border)]"}`}>
                <div className={`w-4 h-4 rounded-full absolute top-1 transition-all ${enabled ? "right-1 bg-[var(--green-bright)]" : "left-1 bg-[var(--text-muted)]"}`} />
            </button>
        </div>
    );
}

/* ─── Portal / Storefront Tab ─── */
function PortalTab() {
    const { data: orgData } = useOrg();
    const { data: subData } = useSubscription();
    const updateOrg = useUpdateOrg();
    const { openModal } = useUpgradeStore();

    const org = orgData?.data ?? orgData ?? {};
    const sub = subData?.data ?? subData ?? {};
    const hasPortal = sub?.features?.customerPortal === true;
    const bType = (org as any)?.businessType;
    const isRetailShop = bType === 'Retailer';
    const portalLabel = isRetailShop ? 'Online Shop' : 'B2B Portal';
    const audienceLabel = isRetailShop ? 'customers' : 'retailers';

    const [slug, setSlug] = useState("");
    const [portalEnabled, setPortalEnabled] = useState(true);
    const qrRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (org?.slug) setSlug(org.slug);
        else if (org?.id) setSlug(org.id);
    }, [org?.slug, org?.id]);

    const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${slug || org?.id || ""}` : "";

    const handleSaveSlug = () => {
        if (!slug.trim()) return;
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-|-$/g, "");
        setSlug(cleanSlug);
        updateOrg.mutate({ slug: cleanSlug });
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(portalUrl);
        toast.success("Portal link copied!", { icon: "🔗" });
    };

    const handleDownloadQr = () => {
        const canvas = document.getElementById("portal-qr-code") as HTMLCanvasElement;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = `portal-qr-${slug || "distroai"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast.success("QR code downloaded");
    };

    if (!hasPortal) {
        return (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 bg-[var(--gold)]/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <Lock className="text-[var(--gold)]" size={32} />
                </div>
                <h2 className="text-2xl font-bold mb-2">Customer Portal Locked</h2>
                <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
                    {isRetailShop
                        ? 'Launch your own branded online shop. Allow customers to browse your catalog and place orders directly. Available on the Starter plan.'
                        : 'Launch your own branded B2B storefront. Allow retailers to browse your catalog and place orders directly to your dashboard. Available on the Starter plan.'
                    }
                </p>
                <button onClick={() => openModal("B2B Customer Portal")} className="px-6 py-3 rounded-[var(--radius-md)] bg-[var(--gold)] text-black font-semibold hover:bg-[var(--gold-light)] transition">
                    Upgrade to Unlock
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Portal URL & Toggle */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold text-lg flex items-center gap-2"><Store size={20} className="text-[var(--gold)]" /> {portalLabel}</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-0.5">Configure your online storefront for {audienceLabel}</p>
                    </div>
                    <Toggle label="" enabled={portalEnabled} onToggle={() => setPortalEnabled(!portalEnabled)} description="" />
                </div>

                {/* Slug Editor */}
                <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">Portal Slug</label>
                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-0 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
                            <span className="px-3 text-sm text-[var(--text-muted)] bg-[var(--bg-primary)] border-r border-[var(--border)] py-2.5 shrink-0">{typeof window !== "undefined" ? window.location.origin : ""}/p/</span>
                            <input
                                value={slug}
                                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                                placeholder="my-store"
                                className="flex-1 px-3 py-2.5 text-sm bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                            />
                        </div>
                        <button onClick={handleSaveSlug} disabled={updateOrg.isPending} className="px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] disabled:opacity-50 transition shrink-0">
                            {updateOrg.isPending ? "Saving..." : "Save"}
                        </button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">Letters, numbers, and hyphens only. This is the URL your {audienceLabel} will use.</p>
                </div>

                {/* Full URL + Actions */}
                <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">Your Portal URL</label>
                    <div className="flex gap-2">
                        <input type="text" readOnly value={portalUrl} className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none cursor-text" onClick={(e) => (e.target as HTMLInputElement).select()} />
                        <button onClick={handleCopy} className="px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20 transition" title="Copy link">
                            <Copy size={16} />
                        </button>
                        <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition" title="Open portal">
                            <ExternalLink size={16} />
                        </a>
                    </div>
                </div>
            </div>

            {/* QR Code Card */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6">
                <h3 className="font-semibold mb-1 flex items-center gap-2"><QrCode size={18} className="text-[var(--gold)]" /> Storefront QR Code</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">Print this and keep it at your counter. {isRetailShop ? 'Customers' : 'Retailers'} can scan to open your catalog instantly.</p>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="bg-white p-4 rounded-xl shadow-lg">
                        <QRCodeCanvas
                            id="portal-qr-code"
                            value={portalUrl || "https://distroai.in"}
                            size={200}
                            fgColor="#000000"
                            bgColor="#ffffff"
                            level="Q"
                            includeMargin={false}
                        />
                    </div>
                    <div className="flex flex-col gap-3 flex-1">
                        <button onClick={handleDownloadQr} className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] transition">
                            <Download size={16} /> Download QR Code
                        </button>
                        <p className="text-xs text-[var(--text-muted)] text-center sm:text-left">
                            Tip: Print this on visiting cards, invoices, or shop signage. {isRetailShop ? 'Customers' : 'Retailers'} simply scan → browse → order!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PortalSettingsPage() {
    return (
        <SettingsLayout title="Customer Portal" description="Configure your storefront URL, toggle access, and download your store's QR code.">
            <PortalTab />
        </SettingsLayout>
    );
}
