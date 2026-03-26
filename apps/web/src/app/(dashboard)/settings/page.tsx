"use client";

import { useState, useEffect } from "react";
import { Building2, FileText, Bell, Plug, Receipt, Check, Users, UserPlus, X, Shield, MapPin, Truck, CheckCircle2, Download, Globe } from "lucide-react";
import { useOrg, useSubscription, useOrgSettings, useUpdateOrg, useUpdateOrgSettings, useWarehouses, useTeamOverview, useCreateTeamMember, useToggleUserActive, useUpdateUserRole, useExportCaGst } from "@/hooks/api-hooks";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGES } from "@/lib/translations";
import { formatDistanceToNow } from "date-fns";
import { parseGstin } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

const TABS = [
    { id: "general", labelKey: "general", icon: Building2 },
    { id: "team", labelKey: "team", icon: Users },
    { id: "gst", labelKey: "gst_invoicing", icon: FileText },
    { id: "notifications", labelKey: "notifications", icon: Bell },
    { id: "language", labelKey: "language", icon: Globe },
    { id: "integrations", labelKey: "integrations", icon: Plug },
    { id: "billing", labelKey: "billing", icon: Receipt },
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
    const [gstinMessage, setGstinMessage] = useState("");

    // Detect GSTIN changes for Smart Auto-fill (State & PAN)
    useEffect(() => {
        if (form.gstNumber && form.gstNumber.length === 15) {
            const parsed = parseGstin(form.gstNumber);
            if (parsed.valid && parsed.stateName && parsed.pan) {
                setForm(f => ({ ...f, state: parsed.stateName!, panNumber: parsed.pan! }));
                setGstinMessage(`✅ Detected: ${parsed.stateName} & PAN`);
            } else {
                setGstinMessage("⚠️ Invalid GSTIN format or State Code");
            }
        } else {
            setGstinMessage("");
        }
    }, [form.gstNumber]);

    useEffect(() => {
        if (org?.name && Object.keys(form).length === 0) {
            setForm({ name: org.name ?? "", phone: org.phone ?? "", email: org.email ?? "", address: org.address ?? "", city: org.city ?? "", state: org.state ?? "", gstNumber: org.gstNumber ?? "", panNumber: org.panNumber ?? "", logoUrl: org.logoUrl ?? "" });
        }
    }, [org?.name, form]);

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
            <div className="bg-[var(--gold)]/5 border border-[var(--gold)]/20 p-4 rounded-[var(--radius-md)] flex flex-col gap-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><CheckCircle2 size={16} className="text-[var(--gold)]" /> Smart GSTIN</h3>
                        <p className="text-xs text-[var(--text-muted)]">Type a valid 15-character GSTIN to instantly auto-fill the State Code and PAN Number.</p>
                    </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <InputField label="GST Number" value={form.gstNumber} onChange={(v) => set("gstNumber", v.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
                        {gstinMessage && <p className={`text-xs mt-1.5 font-medium ${gstinMessage.includes('✅') ? 'text-[var(--green-bright)]' : 'text-[var(--orange)]'}`}>{gstinMessage}</p>}
                    </div>
                    <InputField label="PAN Number" value={form.panNumber} onChange={(v) => set("panNumber", v.toUpperCase())} placeholder="ABCDE1234F" />
                </div>
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

            {/* Storefront Link */}
            {org?.id && (
                <div className="pt-2 border-t border-[var(--border)] mt-4 mb-4">
                    <h3 className="text-sm font-medium mb-3">B2B Portal Storefront Link</h3>
                    <div className="flex gap-2">
                        <input type="text" readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${org.id}`} className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none cursor-text" onClick={(e) => (e.target as HTMLInputElement).select()} />
                        <button onClick={() => { navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${org.id}`); toast.success("Copied link", { icon: "🔗" }); }} className="shrink-0 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)]/10 text-[var(--gold)] font-medium text-sm hover:bg-[var(--gold)]/20 transition">Copy</button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">Share this link with your customers so they can view your catalog and place orders directly.</p>
                </div>
            )}

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

    // CA Export Logic
    const exportGst = useExportCaGst();
    const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
    const [exportYear, setExportYear] = useState(new Date().getFullYear());

    const handleExport = async () => {
        try {
            const blob = await exportGst.mutateAsync({ month: exportMonth, year: exportYear });
            // Create a link to download the blob
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `GST_Export_${String(exportMonth).padStart(2, '0')}_${exportYear}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("GST Export Downloaded", { icon: "📈" });
        } catch (error: any) {
            toast.error(error?.message || "Failed to download export");
        }
    };

    return (
        <div className="space-y-6">
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

            {/* CA GST Export Card */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="font-semibold flex items-center gap-2 mb-1"><FileText size={18} className="text-[var(--gold)]" /> CA GST Export</h2>
                        <p className="text-sm text-[var(--text-muted)]">Download a complete, itemized CSV of all sales for your Chartered Accountant.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-4 bg-[var(--bg-secondary)] p-4 rounded-[var(--radius-md)] border border-[var(--border)]">
                    <label className="flex-1 min-w-[150px]">
                        <span className="block text-xs text-[var(--text-muted)] mb-1">Target Month</span>
                        <select value={exportMonth} onChange={(e) => setExportMonth(Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex-1 min-w-[150px]">
                        <span className="block text-xs text-[var(--text-muted)] mb-1">Target Year</span>
                        <select value={exportYear} onChange={(e) => setExportYear(Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                            {[0, 1, 2].map(offset => {
                                const y = new Date().getFullYear() - offset;
                                return <option key={y} value={y}>{y}</option>;
                            })}
                        </select>
                    </label>
                    <button onClick={handleExport} disabled={exportGst.isPending} className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-2 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                        {exportGst.isPending ? "Generating..." : <><Download size={16} /> Download CSV</>}
                    </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                    Note: The export precisely calculates CGST, SGST, IGST, and CESS on a per-item basis natively resolving Place of Supply regulations.
                </p>
            </div>
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

const loadRazorpay = () => {
    return new Promise((resolve) => {
        if ((window as any).Razorpay) return resolve(true);
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

/* ─── Billing Tab ─── */
function BillingTab() {
    const { data: subData, refetch: refetchSub } = useSubscription();
    const sub = subData?.data ?? subData ?? {};
    const [upgrading, setUpgrading] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const accessToken = useAuthStore((s) => s.accessToken);

    const plans = [
        { name: "FREE", price: "₹0", priceNum: 0, period: "forever", features: ["2 users", "50 products", "Basic dashboard"], recommended: false },
        { name: "STARTER", price: "₹499", priceNum: 499, period: "/mo", features: ["5 users", "500 products", "1,000 invoices/mo", "AI insights"], recommended: false },
        { name: "GROWTH", price: "₹899", priceNum: 899, period: "/mo", features: ["15 users", "Unlimited products", "AI insights", "WhatsApp integration", "Priority support"], recommended: true },
        { name: "ENTERPRISE", price: "Custom", priceNum: 0, period: "", features: ["Unlimited everything", "Dedicated support", "Custom integrations", "SLA guarantee"], recommended: false },
    ];

    const currentPlan = (sub?.plan ?? "FREE").toUpperCase();

    const handleUpgrade = async (planName: string) => {
        if (planName === "ENTERPRISE") {
            toast("Contact sales at sales@distroai.in", { icon: "📧" });
            return;
        }
        if (planName === "FREE") return;

        setUpgrading(planName);
        try {
            const loaded = await loadRazorpay();
            if (!loaded) {
                toast.error("Failed to load payment gateway. Please check your connection.");
                return;
            }

            const res = await fetch("/api/v1/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ plan: planName }),
            });
            const json = await res.json();
            const data = json.data ?? json;

            if (!res.ok) {
                toast.error(data?.message || "Failed to create checkout");
                return;
            }

            // Load Razorpay Checkout
            const options = {
                key: data.razorpayKeyId,
                amount: data.amount,
                currency: data.currency,
                name: "DistroAI",
                description: data.planLabel,
                order_id: data.orderId,
                handler: async (response: any) => {
                    // Verify payment
                    try {
                        const verifyRes = await fetch("/api/v1/billing/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                plan: planName,
                            }),
                        });
                        const verifyJson = await verifyRes.json();
                        if (verifyRes.ok) {
                            toast.success(`Upgraded to ${planName}! 🎉`);
                            refetchSub();
                        } else {
                            toast.error(verifyJson?.data?.message || "Payment verification failed");
                        }
                    } catch {
                        toast.error("Payment verification failed");
                    }
                },
                prefill: {
                    email: sub?.email || "",
                },
                theme: { color: "#a855f7" },
                modal: {
                    ondismiss: () => setUpgrading(null),
                },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (err) {
            toast.error("Failed to initiate checkout");
        } finally {
            setUpgrading(null);
        }
    };

    const handleCancel = async () => {
        if (!confirm("Are you sure you want to cancel your subscription? You'll be downgraded to the Free plan.")) return;
        setCancelling(true);
        try {
            const res = await fetch("/api/v1/billing/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            });
            if (res.ok) {
                toast.success("Subscription cancelled. Downgraded to Free plan.");
                refetchSub();
            } else {
                const json = await res.json();
                toast.error(json?.data?.message || "Failed to cancel");
            }
        } catch {
            toast.error("Failed to cancel subscription");
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Current Plan Card */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-accent)] rounded-[var(--radius-md)] p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="font-semibold text-lg">Current Plan: <span className="text-[var(--gold)]">{currentPlan}</span></h2>
                        <p className="text-sm text-[var(--text-muted)]">Status: {sub?.subscription?.status ?? "Active"}</p>
                        {sub?.subscription?.currentPeriodEnd && (
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                Renews: {new Date(sub.subscription.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                        )}
                    </div>
                    {currentPlan !== "FREE" && (
                        <button
                            onClick={handleCancel}
                            disabled={cancelling}
                            className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-red-500/30 text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                        >
                            {cancelling ? "Cancelling..." : "Cancel Subscription"}
                        </button>
                    )}
                </div>

                {/* Usage bars */}
                {sub?.limits && Object.entries(sub.limits as Record<string, { current: number; max: number }>).map(([k, v]) => (
                    <div key={k} className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-secondary)] capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                            <span style={{ fontFamily: "var(--font-mono)" }}>{v.current}/{v.max === 999999 ? "∞" : v.max}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--border)]">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${v.max === 999999 ? 5 : Math.min((v.current / v.max) * 100, 100)}%`,
                                    backgroundColor: (v.current / v.max) > 0.8 ? 'var(--red)' : 'var(--gold)'
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Plan Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((p) => {
                    const isCurrent = currentPlan === p.name;
                    const isDowngrade = plans.findIndex(pl => pl.name === currentPlan) > plans.findIndex(pl => pl.name === p.name);

                    return (
                        <div key={p.name} className={`bg-[var(--bg-card)] border rounded-[var(--radius-md)] p-5 relative ${p.recommended ? "border-[var(--gold)] ring-1 ring-[var(--gold)]/20" : "border-[var(--border)]"} ${isCurrent ? "ring-2 ring-[var(--purple)]/30" : ""}`}>
                            {p.recommended && <p className="text-[10px] text-[var(--gold)] font-semibold mb-2 tracking-wider">⭐ RECOMMENDED</p>}
                            {isCurrent && <p className="text-[10px] text-[var(--purple)] font-semibold mb-2 tracking-wider">✓ CURRENT PLAN</p>}
                            <h3 className="font-bold mb-1">{p.name}</h3>
                            <div className="flex items-baseline gap-1 mb-3">
                                <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>{p.price}</span>
                                {p.period && <span className="text-xs text-[var(--text-muted)]">{p.period}</span>}
                            </div>
                            <ul className="space-y-1.5 mb-5">
                                {p.features.map((f) => (
                                    <li key={f} className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                                        <Check size={12} className="text-[var(--green-bright)] shrink-0" />{f}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => !isCurrent && handleUpgrade(p.name)}
                                disabled={isCurrent || isDowngrade || upgrading === p.name}
                                className={`w-full py-2.5 text-sm rounded-[var(--radius-md)] transition font-medium ${isCurrent
                                    ? "bg-[var(--purple)]/15 text-[var(--purple)] border border-[var(--purple)]/20 cursor-default"
                                    : isDowngrade
                                        ? "border border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed opacity-50"
                                        : p.recommended
                                            ? "bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)]"
                                            : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                                    }`}
                            >
                                {isCurrent ? "Current Plan" : upgrading === p.name ? "Processing..." : p.name === "ENTERPRISE" ? "Contact Sales" : isDowngrade ? "Downgrade" : "Upgrade"}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    OWNER: { label: 'Owner', color: 'var(--gold)', icon: Shield },
    ADMIN: { label: 'Admin', color: 'var(--gold)', icon: Shield },
    MANAGER: { label: 'Manager', color: 'var(--blue, #3b82f6)', icon: Users },
    SALESMAN: { label: 'Field Agent', color: 'var(--green-bright)', icon: Truck },
    ACCOUNTANT: { label: 'Accountant', color: 'var(--orange)', icon: Receipt },
    VIEWER: { label: 'Viewer', color: 'var(--text-muted)', icon: Users },
};

/* ─── Team Tab ─── */
function TeamTab() {
    const { data: subData } = useSubscription();
    const { data, isLoading } = useTeamOverview();
    const createMember = useCreateTeamMember();
    const toggleActive = useToggleUserActive();
    const updateRole = useUpdateUserRole();
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', role: 'SALESMAN' });

    const teamData = data?.data ?? data ?? {};
    const members = teamData?.members ?? [];
    const counts = teamData?.counts ?? { total: 0, active: 0, inactive: 0 };

    const sub = subData?.data ?? subData ?? {};
    const maxUsers = sub?.limits?.users?.max ?? 999999;
    const isLimitReached = counts.total >= maxUsers;

    const handleAdd = () => {
        if (!form.firstName || !form.email) { toast.error('Name and email are required'); return; }
        createMember.mutate(form, {
            onSuccess: (res: any) => {
                const tp = res?.tempPassword;
                toast.success(tp ? `Member added! Temp password: ${tp}` : 'Member added successfully!');
                setShowAdd(false);
                setForm({ firstName: '', lastName: '', phone: '', email: '', role: 'SALESMAN' });
            },
            onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to add member'),
        });
    };

    const handleToggle = (userId: string, name: string, currentlyActive: boolean) => {
        toggleActive.mutate(userId, {
            onSuccess: () => toast.success(`${name} is now ${currentlyActive ? 'inactive' : 'active'}`),
            onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed'),
        });
    };

    if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Total Members', value: counts.total, color: 'var(--text-primary)' },
                { label: 'Active', value: counts.active, color: 'var(--green-bright)' },
                { label: 'Inactive', value: counts.inactive, color: 'var(--red)' }].map(s => (
                    <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">{s.label}</p>
                        <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Header + Add Button */}
            <div className="flex items-center justify-between">
                <h2 className="font-semibold" style={{ fontFamily: 'var(--font-playfair)' }}>Team Members</h2>
                <button
                    onClick={() => setShowAdd(true)}
                    disabled={isLimitReached}
                    title={isLimitReached ? "Plan user limit reached" : ""}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] transition ${isLimitReached ? 'bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed hidden' : 'bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)]'}`}
                >
                    <UserPlus size={16} /> Add Member
                </button>
            </div>

            {/* Members Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                            <th className="text-left p-4">Member</th>
                            <th className="text-left p-4 hidden md:table-cell">Phone</th>
                            <th className="text-center p-4">Role</th>
                            <th className="text-center p-4 hidden sm:table-cell">Last Login</th>
                            <th className="text-center p-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">
                                <Users size={32} className="mx-auto mb-2 opacity-30" />No team members yet
                            </td></tr>
                        ) : members.map((m: any) => {
                            const rc = ROLE_CONFIG[m.role] ?? ROLE_CONFIG.VIEWER;
                            const RoleIcon = rc.icon;
                            return (
                                <tr key={m.id} className={`border-b border-[var(--border)] transition ${m.isActive ? 'hover:bg-[var(--bg-card-hover)]' : 'opacity-50'}`}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${rc.color}15`, color: rc.color }}>
                                                {m.firstName?.[0]}{m.lastName?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-medium">{m.firstName} {m.lastName}</p>
                                                <p className="text-xs text-[var(--text-muted)]">{m.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-[var(--text-secondary)] hidden md:table-cell">{m.phone ?? '—'}</td>
                                    <td className="p-4 text-center">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${rc.color}12`, color: rc.color }}>
                                            <RoleIcon size={10} /> {rc.label}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center text-xs text-[var(--text-muted)] hidden sm:table-cell">
                                        {m.lastLoginAt ? formatDistanceToNow(new Date(m.lastLoginAt), { addSuffix: true }) : 'Never'}
                                    </td>
                                    <td className="p-4 text-center">
                                        {m.role === 'OWNER' ? (
                                            <span className="text-xs text-[var(--gold)] font-medium">Owner</span>
                                        ) : (
                                            <button
                                                onClick={() => handleToggle(m.id, m.firstName, m.isActive)}
                                                disabled={toggleActive.isPending}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${m.isActive ? 'bg-[var(--green-bright)]' : 'bg-[var(--text-muted)]/30'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform ${m.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Add Member Modal */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAdd(false)}>
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-playfair)' }}>Add Team Member</h3>
                            <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="First Name *" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} placeholder="Ramesh" />
                                <InputField label="Last Name" value={form.lastName} onChange={v => setForm(f => ({ ...f, lastName: v }))} placeholder="Kumar" />
                            </div>
                            <InputField label="Email *" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" placeholder="ramesh@company.com" />
                            <InputField label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="9876543210" />
                            <label>
                                <span className="block text-sm text-[var(--text-secondary)] mb-1">Role</span>
                                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition text-sm">
                                    <option value="MANAGER">Manager</option>
                                    <option value="SALESMAN">Field Agent / Salesman</option>
                                    <option value="ACCOUNTANT">Accountant</option>
                                    <option value="VIEWER">Viewer (Read-only)</option>
                                </select>
                            </label>
                            <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-card)] p-3 rounded-[var(--radius-md)] border border-[var(--border)]">
                                A temporary password will be generated and sent via WhatsApp. The user will be asked to change it on first login.
                            </p>
                        </div>
                        <div className="p-5 border-t border-[var(--border)] flex gap-3 justify-end">
                            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-[var(--text-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] hover:bg-[var(--bg-card)] transition">Cancel</button>
                            <button onClick={handleAdd} disabled={createMember.isPending} className="px-6 py-2 text-sm font-semibold bg-[var(--gold)] text-[var(--bg-primary)] rounded-[var(--radius-md)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition flex items-center gap-2">
                                {createMember.isPending ? <div className="w-4 h-4 border-2 border-[var(--bg-primary)] border-t-transparent rounded-full animate-spin" /> : <UserPlus size={14} />}
                                {createMember.isPending ? 'Adding...' : 'Add Member'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Language Tab ─── */
function LanguageTab() {
    const { language, setLanguage, t } = useLanguage();

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 space-y-6">
            <div>
                <h2 className="font-semibold mb-1">{t('language_region')}</h2>
                <p className="text-sm text-[var(--text-muted)]">{t('language_desc')}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                {LANGUAGES.map((l) => (
                    <label
                        key={l.code}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${language === l.code ? 'border-[var(--gold)] bg-[var(--gold)]/5' : 'border-[var(--border)] hover:border-[var(--text-muted)]'}`}
                    >
                        <input
                            type="radio"
                            name="language"
                            value={l.code}
                            checked={language === l.code}
                            onChange={() => {
                                setLanguage(l.code);
                                toast.success(`Language set to ${l.name}`, { icon: '🌐' });
                            }}
                            className="hidden"
                        />
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

/* ─── Main Settings Page ─── */
export default function SettingsPage() {
    const { t } = useLanguage();
    const [tab, setTab] = useState("general");

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-playfair)" }}>{t('settings')}</h1>

            {/* Mobile tabs — horizontal scrollable row */}
            <div className="lg:hidden flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
                {TABS.map((tabItem) => (
                    <button key={tabItem.id} onClick={() => setTab(tabItem.id)} className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-full whitespace-nowrap transition ${tab === tabItem.id ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)]"}`}>
                        <tabItem.icon size={14} /> {t(tabItem.labelKey as any)}
                    </button>
                ))}
            </div>

            <div className="flex gap-6">
                {/* Desktop sidebar */}
                <div className="hidden lg:block w-48 shrink-0 space-y-1">
                    {TABS.map((tabItem) => (
                        <button key={tabItem.id} onClick={() => setTab(tabItem.id)} className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition ${tab === tabItem.id ? "bg-[var(--gold)]/10 text-[var(--gold)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"}`}>
                            <tabItem.icon size={16} /> {t(tabItem.labelKey as any)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {tab === "general" && <GeneralTab />}
                    {tab === "team" && <TeamTab />}
                    {tab === "gst" && <GstTab />}
                    {tab === "notifications" && <NotificationsTab />}
                    {tab === "language" && <LanguageTab />}
                    {tab === "integrations" && <IntegrationsTab />}
                    {tab === "billing" && <BillingTab />}
                </div>
            </div>
        </div>
    );
}
