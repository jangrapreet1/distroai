"use client";

import { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { useOrg, useUpdateOrg, useWarehouses, useUploadFile } from "@/hooks/api-hooks";
import toast from "react-hot-toast";
import { parseGstin } from "@/lib/utils";
import { SettingsLayout } from "@/components/ui/settings-layout";
import { ImageUpload } from "@/components/ui/image-upload";

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

/* ─── General Tab ─── */
function GeneralTab() {
    const { data: orgData } = useOrg() || {};
    const { data: warehousesData } = useWarehouses();
    const updateOrg = useUpdateOrg();
    const uploadFile = useUploadFile();
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

            <div className="pt-2 border-t border-[var(--border)] mt-4">
                <span className="block text-sm font-medium mb-4">Organization Logo</span>
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="w-full sm:w-48 shrink-0">
                        <ImageUpload
                            value={form.logoUrl}
                            onChange={(v) => set("logoUrl", v)}
                            onUpload={(f) => uploadFile.mutateAsync(f)}
                            disabled={updateOrg.isPending || uploadFile.isPending}
                        />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                        <InputField label="Or Paste External Logo URL directly" value={form.logoUrl} onChange={(v) => set("logoUrl", v)} placeholder="https://..." />
                        <p className="text-xs text-[var(--text-muted)] mt-2">Upload a transparent PNG for the best result on dark backgrounds.</p>
                    </div>
                </div>
            </div>

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

export default function OrgSettingsPage() { return <SettingsLayout title="Organization Settings" description="Manage your business profile, warehouses, and B2B portal storefront."><GeneralTab /></SettingsLayout>; }
