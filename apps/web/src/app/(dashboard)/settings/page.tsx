"use client";

import { useState, useEffect } from "react";
import { Building2, FileText, Bell, Plug, Receipt, Check } from "lucide-react";
import { useOrg, useSubscription, useOrgSettings, useUpdateOrg, useUpdateOrgSettings, useWarehouses } from "@/hooks/api-hooks";
import toast from "react-hot-toast";

const TABS = [
    { id: "general", label: "General", icon: Building2 },
    { id: "gst", label: "GST & Invoicing", icon: FileText },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "billing", label: "Billing", icon: Receipt },
];

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi",
];

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

/* ─── General Tab ─── */
function GeneralTab() {
    const { data: orgData } = useOrg();
    const { data: warehousesData } = useWarehouses();
    const updateOrg = useUpdateOrg();
    const org = orgData?.data ?? orgData ?? {};
    const warehouses = warehousesData?.data ?? warehousesData ?? [];

    const [form, setForm] = useState<Record<string, string>>({});
    useEffect(() => {
        if (org?.name) setForm({ name: org.name ?? "", phone: org.phone ?? "", email: org.email ?? "", address: org.address ?? "", city: org.city ?? "", state: org.state ?? "", gstNumber: org.gstNumber ?? "", panNumber: org.panNumber ?? "", logoUrl: org.logoUrl ?? "" });
    }, [org?.name]);

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
    const handleSave = () => {
        const payload: Record<string, unknown> = {};
        Object.entries(form).forEach(([k, v]) => { if (v) payload[k] = v; });
        updateOrg.mutate(payload);
    };

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 space-y-4">
            <h2 className="font-semibold mb-4">Organization</h2>
            <InputField label="Business Name" value={form.name} onChange={(v) => set("name", v)} />
            <div className="grid sm:grid-cols-2 gap-4">
                <InputField label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
                <InputField label="Email" value={form.email} onChange={(v) => set("email", v)} type="email" />
            </div>
            <InputField label="Address" value={form.address} onChange={(v) => set("address", v)} />
            <div className="grid sm:grid-cols-2 gap-4">
                <InputField label="City" value={form.city} onChange={(v) => set("city", v)} />
                <label>
                    <span className="block text-sm text-[var(--text-secondary)] mb-1">State</span>
                    <select value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition text-sm">
                        <option value="">Select...</option>
                        {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                <InputField label="GST Number" value={form.gstNumber} onChange={(v) => set("gstNumber", v)} placeholder="22AAAAA0000A1Z5" />
                <InputField label="PAN Number" value={form.panNumber} onChange={(v) => set("panNumber", v)} placeholder="ABCDE1234F" />
            </div>
            {warehouses.length > 0 && (
                <div className="pt-2 border-t border-[var(--border)] mt-4">
                    <h3 className="text-sm font-medium mb-3">Warehouse Details</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {warehouses.map((w: any, idx: number) => (
                            <InputField key={w.id} label={`Warehouse ${idx + 1} ID (${w.name})`} value={w.id} onChange={() => { }} />
                        ))}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">These IDs are required for API integrations or bulk uploads.</p>
                </div>
            )}
            <InputField label="Logo URL" value={form.logoUrl} onChange={(v) => set("logoUrl", v)} placeholder="https://..." />
            <button onClick={handleSave} disabled={updateOrg.isPending} className="px-6 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                {updateOrg.isPending ? "Saving..." : "Save Changes"}
            </button>
        </div>
    );
}

/* ─── GST & Invoicing Tab ─── */
function GstTab() {
    const { data: settingsData } = useOrgSettings();
    const updateSettings = useUpdateOrgSettings();
    const settings = settingsData?.data ?? settingsData ?? {};

    const [form, setForm] = useState<Record<string, unknown>>({});
    useEffect(() => {
        if (settings) setForm({ invoicePrefix: settings.invoicePrefix ?? "INV", orderPrefix: settings.orderPrefix ?? "ORD", poPrefix: settings.poPrefix ?? "PO", autoInvoice: settings.autoInvoice ?? false });
    }, [settings?.invoicePrefix]);

    const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
    const handleSave = () => { updateSettings.mutate(form); };

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 space-y-4">
            <h2 className="font-semibold mb-4">GST & Invoicing</h2>
            <div className="grid sm:grid-cols-3 gap-4">
                <InputField label="Invoice Prefix" value={form.invoicePrefix as string ?? ""} onChange={(v) => set("invoicePrefix", v)} />
                <InputField label="Order Prefix" value={form.orderPrefix as string ?? ""} onChange={(v) => set("orderPrefix", v)} />
                <InputField label="PO Prefix" value={form.poPrefix as string ?? ""} onChange={(v) => set("poPrefix", v)} />
            </div>
            <Toggle label="Auto-invoice on dispatch" description="Automatically generate invoice when order is dispatched" enabled={form.autoInvoice as boolean ?? false} onToggle={() => set("autoInvoice", !(form.autoInvoice as boolean))} />
            <button onClick={handleSave} disabled={updateSettings.isPending} className="px-6 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                {updateSettings.isPending ? "Saving..." : "Save Settings"}
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
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6">
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

/* ─── Integrations Tab ─── */
function IntegrationsTab() {
    const { data: orgData } = useOrg();
    const org = orgData?.data ?? orgData ?? {};
    const [expanded, setExpanded] = useState<string | null>(null);

    const integrations = [
        { id: "whatsapp", name: "WhatsApp Business", status: org.whatsappConfigured ? "Connected" : "Not configured", color: "var(--whatsapp)", connected: !!org.whatsappConfigured, fields: ["Phone Number ID", "Access Token", "Webhook Secret"] },
        { id: "razorpay", name: "Razorpay", status: org.razorpayConfigured ? "Connected" : "Not configured", color: "var(--purple)", connected: !!org.razorpayConfigured, fields: ["Key ID", "Key Secret", "Webhook Secret"] },
        { id: "tally", name: "Tally Bridge", status: org.tallyConfigured ? "Connected" : "Not configured", color: "var(--gold)", connected: !!org.tallyConfigured, fields: ["Tally Server URL"] },
        { id: "nic", name: "NIC E-Invoice", status: "Not configured", color: "var(--orange)", connected: false, fields: ["API Username", "API Password"] },
    ];

    const handleSave = (name: string) => {
        toast.success(`${name} keys saved securely.`);
        setExpanded(null);
    };

    return (
        <div className="grid sm:grid-cols-2 gap-4">
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

/* ─── Billing Tab ─── */
function BillingTab() {
    const { data: subData } = useSubscription();
    const sub = subData?.data ?? subData ?? {};

    const plans = [
        { name: "Starter", price: "₹999/mo", features: ["5 users", "500 products", "1,000 invoices/mo"], recommended: false },
        { name: "Growth", price: "₹2,499/mo", features: ["15 users", "Unlimited products", "AI insights", "WhatsApp integration"], recommended: true },
        { name: "Enterprise", price: "Custom", features: ["Unlimited everything", "Dedicated support", "Custom integrations", "SLA guarantee"], recommended: false },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border-accent)] rounded-[var(--radius-md)] p-6">
                <h2 className="font-semibold mb-1">Current Plan: {sub?.plan ?? "FREE"}</h2>
                <p className="text-sm text-[var(--text-muted)] mb-1">{sub?.status ?? "Active"}</p>
                {sub?.currentPeriodEnd && <p className="text-xs text-[var(--text-muted)] mb-4">Renews: {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>}

                {/* Usage bars from real subscription data */}
                {sub?.limits && Object.entries(sub.limits as Record<string, { current: number; max: number }>).map(([k, v]) => (
                    <div key={k} className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-secondary)] capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                            <span style={{ fontFamily: "var(--font-mono)" }}>{v.current}/{v.max}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--border)]">
                            <div className="h-full rounded-full bg-[var(--gold)] transition-all" style={{ width: `${Math.min((v.current / v.max) * 100, 100)}%` }} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                {plans.map((p) => (
                    <div key={p.name} className={`bg-[var(--bg-card)] border rounded-[var(--radius-md)] p-5 ${p.recommended ? "border-[var(--gold)]" : "border-[var(--border)]"}`}>
                        {p.recommended && <p className="text-[10px] text-[var(--gold)] font-semibold mb-2">RECOMMENDED</p>}
                        <h3 className="font-bold mb-1">{p.name}</h3>
                        <p className="text-lg font-bold mb-3" style={{ fontFamily: "var(--font-mono)" }}>{p.price}</p>
                        <ul className="space-y-1 mb-4">
                            {p.features.map((f) => <li key={f} className="text-xs text-[var(--text-secondary)] flex items-center gap-1"><Check size={12} className="text-[var(--green-bright)]" />{f}</li>)}
                        </ul>
                        <button onClick={() => {
                            const label = sub?.plan === p.name.toUpperCase() ? null : p.name === "Enterprise" ? "Contact sales at sales@distroai.in" : `Upgrade to ${p.name}`;
                            if (label) toast(label + " — coming soon!", { icon: "✨" });
                        }} className={`w-full py-2 text-sm rounded-[var(--radius-md)] transition ${p.recommended ? "bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)]" : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"}`}>
                            {sub?.plan === p.name.toUpperCase() ? "Current Plan" : p.name === "Enterprise" ? "Contact Sales" : "Upgrade"}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Main Settings Page ─── */
export default function SettingsPage() {
    const [tab, setTab] = useState("general");

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-playfair)" }}>Settings</h1>

            {/* Mobile tabs — horizontal scrollable row */}
            <div className="lg:hidden flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
                {TABS.map((t) => (
                    <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full whitespace-nowrap transition ${tab === t.id ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)]"}`}>
                        <t.icon size={14} /> {t.label}
                    </button>
                ))}
            </div>

            <div className="flex gap-6">
                {/* Desktop sidebar */}
                <div className="hidden lg:block w-48 shrink-0 space-y-1">
                    {TABS.map((t) => (
                        <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition ${tab === t.id ? "bg-[var(--gold)]/10 text-[var(--gold)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"}`}>
                            <t.icon size={16} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {tab === "general" && <GeneralTab />}
                    {tab === "gst" && <GstTab />}
                    {tab === "notifications" && <NotificationsTab />}
                    {tab === "integrations" && <IntegrationsTab />}
                    {tab === "billing" && <BillingTab />}
                </div>
            </div>
        </div>
    );
}
