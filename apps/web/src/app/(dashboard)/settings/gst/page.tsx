"use client";

import { useState, useEffect } from "react";
import { FileText, Download } from "lucide-react";
import { useOrgSettings, useUpdateOrgSettings, useExportCaGst } from "@/hooks/api-hooks";
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

/* ─── GST & Invoicing Tab ─── */
function GstTab() {
    const { data: settingsData } = useOrgSettings();
    const updateSettings = useUpdateOrgSettings();
    const settings = settingsData?.data ?? settingsData ?? {};

    const [form, setForm] = useState<Record<string, unknown>>({});
    useEffect(() => {
        if (settings) setForm({
            invoicePrefix: settings.invoicePrefix ?? "INV",
            orderPrefix: settings.orderPrefix ?? "ORD",
            poPrefix: settings.poPrefix ?? "PO",
            autoInvoice: settings.autoInvoice ?? false,
            bankName: settings.bankName ?? "",
            bankAccountNumber: settings.bankAccountNumber ?? "",
            bankIfscCode: settings.bankIfscCode ?? "",
            bankBranch: settings.bankBranch ?? "",
            upiId: settings.upiId ?? "",
        });
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

            {/* Bank Details Card */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 space-y-4">
                <h2 className="font-semibold mb-4">Bank & Payment Details</h2>
                <p className="text-xs text-[var(--text-muted)] -mt-2">These details will appear on invoice PDFs for payment collection.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                    <InputField label="Bank Name" value={form.bankName as string ?? ""} onChange={(v) => set("bankName", v)} placeholder="e.g. State Bank of India" />
                    <InputField label="Account Number" value={form.bankAccountNumber as string ?? ""} onChange={(v) => set("bankAccountNumber", v)} placeholder="e.g. 1234567890" />
                    <InputField label="IFSC Code" value={form.bankIfscCode as string ?? ""} onChange={(v) => set("bankIfscCode", v)} placeholder="e.g. SBIN0001234" />
                    <InputField label="Branch" value={form.bankBranch as string ?? ""} onChange={(v) => set("bankBranch", v)} placeholder="e.g. Main Branch, Mumbai" />
                </div>
                <InputField label="UPI ID" value={form.upiId as string ?? ""} onChange={(v) => set("upiId", v)} placeholder="e.g. business@upi" />
                <button onClick={handleSave} disabled={updateSettings.isPending} className="px-6 py-2.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] text-sm font-semibold hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                    {updateSettings.isPending ? "Saving..." : "Save Bank Details"}
                </button>
            </div>
        </div>
    );
}

export default function GstSettingsPage() {
    return (
        <SettingsLayout title="Taxes & Compliance" description="Manage GST tracking, invoicing prefixes, and bank details.">
            <GstTab />
        </SettingsLayout>
    );
}
