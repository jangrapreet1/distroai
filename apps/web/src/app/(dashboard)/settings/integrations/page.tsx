"use client";

import { useState, useEffect, useCallback } from "react";
import { Plug, MessageSquare, Phone, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useOrgSettings, useUpdateOrgSettings, useWhatsAppStatus, useWhatsAppConnect, useWhatsAppDisconnect } from "@/hooks/api-hooks";
import toast from "react-hot-toast";
import { SettingsLayout } from "@/components/ui/settings-layout";

function InputField({ label, value, onChange, type = "text", placeholder }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
    return (
        <label>
            <span className="block text-sm text-[var(--text-secondary)] mb-1">{label}</span>
            <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition text-sm" />
        </label>
    );
}

function WhatsAppCard() {
    const { data: statusData, isLoading: statusLoading } = useWhatsAppStatus();
    const connectMutation = useWhatsAppConnect();
    const disconnectMutation = useWhatsAppDisconnect();
    const [connecting, setConnecting] = useState(false);

    const status = statusData?.data ?? {};
    const isConnected = !!status.connected;

    const handleConnect = useCallback(() => {
        const FB = (window as any).FB;
        if (!FB) {
            toast.error("Facebook SDK not loaded. Please refresh the page and try again.");
            return;
        }

        setConnecting(true);
        FB.login(
            (response: any) => {
                if (response.authResponse?.code) {
                    connectMutation.mutate(
                        { code: response.authResponse.code },
                        { onSettled: () => setConnecting(false) },
                    );
                } else {
                    setConnecting(false);
                    if (response.status !== "connected") {
                        toast.error("WhatsApp signup was cancelled.");
                    }
                }
            },
            {
                config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
                response_type: "code",
                override_default_response_type: true,
                extras: {
                    setup: {},
                    featureType: "",
                    sessionInfoVersion: 2,
                },
            },
        );
    }, [connectMutation]);

    const handleDisconnect = () => {
        if (!confirm("Are you sure you want to disconnect WhatsApp? This will stop all WhatsApp notifications and bot functionality.")) return;
        disconnectMutation.mutate();
    };

    const isProcessing = connecting || connectMutation.isPending || disconnectMutation.isPending;

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#25D366]/10">
                        <MessageSquare size={24} className="text-[#25D366]" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-base">WhatsApp Business</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {isConnected
                                ? "Connected via Meta Embedded Signup"
                                : "Connect your WhatsApp Business account with one click"}
                        </p>
                    </div>
                </div>

                {!statusLoading && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isConnected
                        ? "bg-[#25D366]/10 text-[#25D366]"
                        : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                        }`}>
                        {isConnected ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {isConnected ? "Connected" : "Not Connected"}
                    </span>
                )}
            </div>

            {isConnected ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border)] text-xs">
                        <div>
                            <span className="text-[var(--text-muted)] block">Phone Number</span>
                            <span className="font-mono font-medium flex items-center gap-1 mt-0.5">
                                <Phone size={12} className="text-[var(--text-muted)]" />
                                {status.displayPhoneNumber || status.phoneNumberId || "—"}
                            </span>
                        </div>
                        <div>
                            <span className="text-[var(--text-muted)] block">WABA ID</span>
                            <span className="font-mono font-medium truncate block mt-0.5">
                                {status.wabaId || "—"}
                            </span>
                        </div>
                        <div>
                            <span className="text-[var(--text-muted)] block">Quality Rating</span>
                            <span className="font-medium text-[#25D366] capitalize block mt-0.5">
                                {status.qualityRating?.toLowerCase() || "Good"}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-[var(--text-muted)]">
                            Bot is active. Orders received via WhatsApp are automatically transcribed.
                        </p>
                        <button
                            onClick={handleDisconnect}
                            disabled={isProcessing}
                            className="text-xs text-red-400 hover:text-red-300 transition hover:underline"
                        >
                            Disconnect
                        </button>
                    </div>
                </div>
            ) : (
                <div>
                    <p className="text-xs text-[var(--text-muted)] mb-4">
                        Connect your Meta Business WhatsApp account to receive voice note orders, send instant dispatch PDFs with dynamic UPI payment QR codes, and automate ledger payment reminders.
                    </p>
                    <button
                        onClick={handleConnect}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] bg-[#25D366] text-white text-xs font-semibold hover:bg-[#20ba59] transition disabled:opacity-50"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Connecting...</span>
                            </>
                        ) : (
                            <>
                                <MessageSquare size={14} />
                                <span>Connect with WhatsApp</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

function OtherIntegrationsCard() {
    const { data: settingsData } = useOrgSettings();
    const updateSettings = useUpdateOrgSettings();
    const settings = settingsData?.data ?? settingsData ?? {};

    const [tallyUrl, setTallyUrl] = useState(settings.tallyBridgeUrl ?? "");
    const [msg91Key, setMsg91Key] = useState(settings.msg91ApiKey ?? "");
    const [msg91Sender, setMsg91Sender] = useState(settings.msg91SenderId ?? "");
    const [razorpayKey, setRazorpayKey] = useState(settings.razorpayKeyId ?? "");
    const [razorpaySecret, setRazorpaySecret] = useState(settings.razorpayKeySecret ?? "");

    useEffect(() => {
        if (settings.tallyBridgeUrl) setTallyUrl(settings.tallyBridgeUrl);
        if (settings.msg91ApiKey) setMsg91Key(settings.msg91ApiKey);
        if (settings.msg91SenderId) setMsg91Sender(settings.msg91SenderId);
        if (settings.razorpayKeyId) setRazorpayKey(settings.razorpayKeyId);
        if (settings.razorpayKeySecret) setRazorpaySecret(settings.razorpayKeySecret);
    }, [settings]);

    const handleSave = () => {
        updateSettings.mutate({
            tallyBridgeUrl: tallyUrl,
            msg91ApiKey: msg91Key,
            msg91SenderId: msg91Sender,
            razorpayKeyId: razorpayKey,
            razorpayKeySecret: razorpaySecret,
        });
    };

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 space-y-4">
            <h2 className="font-semibold mb-2">Bridge & Payment Gateways</h2>

            <div>
                <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wider mb-2">Tally ERP / Prime Bridge</p>
                <InputField label="Tally Connector Local URL" value={tallyUrl} onChange={setTallyUrl} placeholder="http://localhost:9000" />
            </div>

            <div className="pt-4 border-t border-[var(--border)]">
                <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wider mb-2">SMS Gateway (MSG91)</p>
                <div className="grid sm:grid-cols-2 gap-4">
                    <InputField label="API Key" value={msg91Key} onChange={setMsg91Key} placeholder="Auth key..." />
                    <InputField label="Sender ID" value={msg91Sender} onChange={setMsg91Sender} placeholder="DSTRIA" />
                </div>
            </div>

            <div className="pt-4 border-t border-[var(--border)]">
                <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wider mb-2">Razorpay Payment Gateway</p>
                <div className="grid sm:grid-cols-2 gap-4">
                    <InputField label="Key ID" value={razorpayKey} onChange={setRazorpayKey} placeholder="rzp_live_..." />
                    <InputField label="Key Secret" value={razorpaySecret} onChange={setRazorpaySecret} type="password" placeholder="••••••••" />
                </div>
            </div>

            <button onClick={handleSave} disabled={updateSettings.isPending} className="px-6 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                {updateSettings.isPending ? "Saving..." : "Save Gateways"}
            </button>
        </div>
    );
}

export default function IntegrationsSettingsPage() {
    return (
        <SettingsLayout title="Integrations & Apps" description="Connect Meta WhatsApp Business, Tally Prime bridge, and payment gateways.">
            <div className="space-y-6">
                <WhatsAppCard />
                <OtherIntegrationsCard />
            </div>
        </SettingsLayout>
    );
}
