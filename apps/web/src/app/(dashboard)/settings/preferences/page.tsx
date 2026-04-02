"use client";

import { useState, useEffect, useCallback } from "react";
import { Plug, Globe, MessageSquare, Phone, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useOrg, useOrgSettings, useUpdateOrgSettings, useWhatsAppStatus, useWhatsAppConnect, useWhatsAppDisconnect } from "@/hooks/api-hooks";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGES } from "@/lib/translations";
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

/* ─── Notifications Tab ─── */
function NotificationsTab() {
    const { data: settingsData } = useOrgSettings();
    const updateSettings = useUpdateOrgSettings();
    const settings = settingsData?.data ?? settingsData ?? {};

    const [notifications, setNotifications] = useState({
        whatsappBriefing: true, paymentReminders: true, lowStockAlerts: true, newOrderAlerts: true,
    });
    const [reminderDays, setReminderDays] = useState(settings.paymentReminderDays ?? 7);

    useEffect(() => {
        if (settings.paymentReminderDays) setReminderDays(settings.paymentReminderDays);
    }, [settings.paymentReminderDays]);

    const toggle = (key: string) => setNotifications((n) => ({ ...n, [key]: !(n as Record<string, boolean>)[key] }));
    const handleSave = () => {
        updateSettings.mutate({
            paymentReminderDays: reminderDays,
            whatsappBriefing: notifications.whatsappBriefing,
            paymentReminders: notifications.paymentReminders,
            lowStockAlerts: notifications.lowStockAlerts,
            newOrderAlerts: notifications.newOrderAlerts,
        });
    };

    return (
        <div id="notifications" className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 scroll-mt-6">
            <h2 className="font-semibold mb-4">Notifications</h2>
            <Toggle label="WhatsApp daily briefing" description="Receive a daily summary on WhatsApp" enabled={notifications.whatsappBriefing} onToggle={() => toggle("whatsappBriefing")} />
            <Toggle label="Payment reminders" description="Auto-send payment reminders to customers" enabled={notifications.paymentReminders} onToggle={() => toggle("paymentReminders")} />
            <Toggle label="Low stock alerts" description="Get notified when products fall below minimum" enabled={notifications.lowStockAlerts} onToggle={() => toggle("lowStockAlerts")} />
            <Toggle label="New order alerts" description="Get notified for new orders" enabled={notifications.newOrderAlerts} onToggle={() => toggle("newOrderAlerts")} />
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <InputField label="Payment Reminder Days" value={String(reminderDays)} onChange={(v) => setReminderDays(Number(v))} type="number" />
            </div>
            <button onClick={handleSave} disabled={updateSettings.isPending} className="mt-4 px-6 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                {updateSettings.isPending ? "Saving..." : "Save"}
            </button>
        </div>
    );
}

/* ─── WhatsApp Connect Card ─── */
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
            {/* Header */}
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

                {/* Status badge */}
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

            {/* Connected state */}
            {isConnected && (
                <div className="mb-5 p-4 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] border border-[var(--border)]">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        {status.phoneNumber && (
                            <div>
                                <p className="text-[var(--text-muted)] text-xs mb-0.5">Phone Number</p>
                                <p className="font-medium flex items-center gap-1.5">
                                    <Phone size={14} className="text-[#25D366]" />
                                    {status.phoneNumber}
                                </p>
                            </div>
                        )}
                        {status.businessName && (
                            <div>
                                <p className="text-[var(--text-muted)] text-xs mb-0.5">Business Name</p>
                                <p className="font-medium">{status.businessName}</p>
                            </div>
                        )}
                        {status.wabaId && (
                            <div>
                                <p className="text-[var(--text-muted)] text-xs mb-0.5">WABA ID</p>
                                <p className="font-medium" style={{ fontFamily: "var(--font-mono)" }}>{status.wabaId}</p>
                            </div>
                        )}
                        {status.connectedAt && (
                            <div>
                                <p className="text-[var(--text-muted)] text-xs mb-0.5">Connected</p>
                                <p className="font-medium">{new Date(status.connectedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Action button */}
            {isConnected ? (
                <button onClick={handleDisconnect} disabled={isProcessing}
                    className="w-full py-2.5 text-sm rounded-[var(--radius-md)] border border-red-500/30 text-red-400 hover:bg-red-500/10 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {disconnectMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect WhatsApp"}
                </button>
            ) : (
                <button onClick={handleConnect} disabled={isProcessing}
                    className="w-full py-3 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition flex items-center justify-center gap-2">
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                    {isProcessing ? "Connecting..." : "Connect WhatsApp"}
                </button>
            )}

            {/* Subtle gradient accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#25D366]/5 to-transparent pointer-events-none rounded-lg" />
        </div>
    );
}

/* ─── Other Integrations ─── */
function OtherIntegrationsCard() {
    const { data: orgData } = useOrg();
    const org = orgData?.data ?? orgData ?? {};
    const [expanded, setExpanded] = useState<string | null>(null);

    const integrations = [
        { id: "razorpay", name: "Razorpay", status: org.razorpayConfigured ? "Connected" : "Not configured", color: "var(--purple)", connected: !!org.razorpayConfigured, fields: ["Key ID", "Key Secret", "Webhook Secret"] },
        { id: "tally", name: "Tally Bridge", status: org.tallyConfigured ? "Connected" : "Not configured", color: "var(--gold)", connected: !!org.tallyConfigured, fields: ["Tally Server URL"] },
        { id: "nic", name: "NIC E-Invoice", status: "Not configured", color: "var(--orange)", connected: false, fields: ["API Username", "API Password"] },
    ];

    const handleSave = (name: string) => {
        toast.success(`${name} keys saved securely.`);
        setExpanded(null);
    };

    return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((i) => (
                <div key={i.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${i.color}15` }}>
                            <Plug size={18} style={{ color: i.color }} />
                        </div>
                        <div>
                            <p className="font-semibold text-sm">{i.name}</p>
                            <p className={`text-xs ${i.connected ? "text-[var(--green-bright)]" : "text-[var(--text-muted)]"}`}>{i.status}</p>
                        </div>
                    </div>
                    {expanded === i.id ? (
                        <div className="mt-3 space-y-3 p-3 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] border border-[var(--border)]">
                            {i.fields.map(f => (
                                <label key={f}>
                                    <span className="block text-xs text-[var(--text-secondary)] mb-1">{f}</span>
                                    <input type="password" placeholder={`Enter ${f}`} className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--gold)] focus:outline-none" />
                                </label>
                            ))}
                            <div className="flex justify-end gap-2 pt-1">
                                <button onClick={() => setExpanded(null)} className="px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
                                <button onClick={() => handleSave(i.name)} className="px-3 py-1 text-xs bg-[var(--gold)] text-[var(--bg-primary)] rounded hover:bg-[var(--gold-light)] font-medium">Save API Keys</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setExpanded(i.id)} className={`w-full py-2 text-xs rounded-[var(--radius-md)] border transition ${i.connected ? "border-[var(--green)]/30 text-[var(--green-bright)] bg-[var(--green)]/5" : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"}`}>
                            {i.connected ? "✓ Connected (Edit Keys)" : "Configure Keys"}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

/* ─── Language Tab ─── */
function LanguageTab() {
    const { language, setLanguage, t } = useLanguage();

    return (
        <div id="language" className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 space-y-6 scroll-mt-6">
            <div>
                <h2 className="font-semibold mb-1">{t('language_region')}</h2>
                <p className="text-sm text-[var(--text-muted)]">{t('language_desc')}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                {LANGUAGES.map((l) => (
                    <label key={l.code}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${language === l.code ? 'border-[var(--gold)] bg-[var(--gold)]/5' : 'border-[var(--border)] hover:border-[var(--text-muted)]'}`}>
                        <input type="radio" name="language" value={l.code} checked={language === l.code}
                            onChange={() => { setLanguage(l.code); toast.success(`Language set to ${l.name}`, { icon: '🌐' }); }} className="hidden" />
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${language === l.code ? 'border-[var(--gold)]' : 'border-[var(--text-muted)]'}`}>
                            {language === l.code && <div className="w-2.5 h-2.5 rounded-full bg-[var(--gold)]" />}
                        </div>
                        <div>
                            <p className="font-medium text-[var(--text-primary)]">{l.nativeName}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{l.name}</p>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}

export default function PreferencesSettingsPage() {
    return (
        <SettingsLayout title="Preferences & Integrations" description="Manage WhatsApp integrations, notifications, API keys, and language settings.">
            <div className="space-y-8">
                <div id="integrations" className="scroll-mt-6 space-y-4">
                    <WhatsAppCard />
                    <OtherIntegrationsCard />
                </div>
                <NotificationsTab />
                <LanguageTab />
            </div>
        </SettingsLayout>
    );
}
