import { useState } from "react";
import { X } from "lucide-react";
import { useCreateCustomer } from "@/hooks/api-hooks";

const CUSTOMER_TYPES = ["RETAILER", "WHOLESALER", "INSTITUTION", "INDIVIDUAL"];

export function AddCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const createCustomer = useCreateCustomer();
    const [form, setForm] = useState({
        name: "", contactPerson: "", phone: "", email: "", type: "RETAILER",
        gstNumber: "", fullAddress: "", city: "", state: "Maharashtra", pincode: "",
        creditLimit: 0, creditDays: 30, whatsappNumber: "",
    });

    const set = (key: string, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: Record<string, unknown> = { ...form };
        if (!payload.email) delete payload.email;
        if (!payload.gstNumber) delete payload.gstNumber;
        if (!payload.fullAddress) delete payload.fullAddress;
        if (!payload.whatsappNumber) delete payload.whatsappNumber;
        createCustomer.mutate(payload, { onSuccess: () => { onClose(); setForm({ name: "", contactPerson: "", phone: "", email: "", type: "RETAILER", gstNumber: "", fullAddress: "", city: "", state: "Maharashtra", pincode: "", creditLimit: 0, creditDays: 30, whatsappNumber: "" }); } });
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Add Customer</h2>
                    <button type="button" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    {/* Basic Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <label className="col-span-2">
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Business Name *</span>
                                <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Contact Person</span>
                                <input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Type</span>
                                <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                                    {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </label>
                        </div>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Contact</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Phone</span>
                                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91XXXXXXXXXX" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">WhatsApp</span>
                                <input value={form.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} placeholder="+91XXXXXXXXXX" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Email</span>
                                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@business.com" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">GST Number</span>
                                <input value={form.gstNumber} onChange={(e) => set("gstNumber", e.target.value)} placeholder="22AAAAA0000A1Z5" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] uppercase focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                        </div>
                    </div>

                    {/* Financial Terms */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Financial Terms</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Credit Limit (₹)</span>
                                <input type="number" value={form.creditLimit} onChange={(e) => set("creditLimit", Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Credit Days</span>
                                <input type="number" value={form.creditDays} onChange={(e) => set("creditDays", Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">Cancel</button>
                        <button type="submit" disabled={createCustomer.isPending} className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                            {createCustomer.isPending ? "Adding..." : "Add Customer"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
