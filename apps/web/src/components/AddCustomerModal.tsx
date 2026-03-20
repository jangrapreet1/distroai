import { useState, useEffect } from "react";
import { X, Building2, User, CheckCircle2 } from "lucide-react";
import { useCreateCustomer, useOrg } from "@/hooks/api-hooks";
import { parseGstin, INDIAN_STATES } from "@/lib/utils";

const CUSTOMER_TYPES = ["RETAILER", "WHOLESALER", "INSTITUTION", "INDIVIDUAL"];

export function AddCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const createCustomer = useCreateCustomer();
    const { data: orgData } = useOrg();
    const orgState = orgData?.data?.state ?? "Maharashtra";

    const [isRegistered, setIsRegistered] = useState(false);
    const [gstinMessage, setGstinMessage] = useState("");

    const [form, setForm] = useState({
        name: "", contactPerson: "", phone: "", email: "", type: "RETAILER",
        gstNumber: "", fullAddress: "", city: "", state: orgState, pincode: "",
        creditLimit: 0, creditDays: 30, whatsappNumber: "", panNumber: "",
    });

    const set = (key: string, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

    // Reset state to org default when org loads
    useEffect(() => {
        if (orgState && !form.state) set("state", orgState);
    }, [orgState]);

    // Smart GSTIN autofill
    useEffect(() => {
        if (isRegistered && form.gstNumber && form.gstNumber.length === 15) {
            const parsed = parseGstin(form.gstNumber);
            if (parsed.valid && parsed.stateName && parsed.pan) {
                setForm(f => ({ ...f, state: parsed.stateName!, panNumber: parsed.pan! }));
                setGstinMessage(`✅ Detected: ${parsed.stateName} & PAN`);
            } else {
                setGstinMessage("⚠️ Invalid GSTIN or State Code");
            }
        } else {
            setGstinMessage("");
        }
    }, [form.gstNumber, isRegistered]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: Record<string, unknown> = { ...form };
        if (!isRegistered) {
            delete payload.gstNumber;
            delete payload.panNumber;
        } else {
            if (!payload.gstNumber) delete payload.gstNumber;
            if (!payload.panNumber) delete payload.panNumber;
        }
        if (!payload.email) delete payload.email;
        if (!payload.fullAddress) delete payload.fullAddress;
        if (!payload.whatsappNumber) delete payload.whatsappNumber;

        createCustomer.mutate(payload, {
            onSuccess: () => {
                onClose();
                setForm({ name: "", contactPerson: "", phone: "", email: "", type: "RETAILER", gstNumber: "", fullAddress: "", city: "", state: orgState, pincode: "", creditLimit: 0, creditDays: 30, whatsappNumber: "", panNumber: "" });
                setIsRegistered(false);
                setGstinMessage("");
            }
        });
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

                    {/* B2B / B2C Toggle */}
                    <div className="flex bg-[var(--bg-secondary)] border border-[var(--border)] p-1 rounded-[var(--radius-lg)]">
                        <button type="button" onClick={() => setIsRegistered(true)} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-[var(--radius-md)] transition ${isRegistered ? "bg-[var(--bg-card)] text-[var(--gold)] shadow-sm border border-[var(--border)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
                            <Building2 size={16} /> Registered Business (B2B)
                        </button>
                        <button type="button" onClick={() => setIsRegistered(false)} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-[var(--radius-md)] transition ${!isRegistered ? "bg-[var(--bg-card)] text-[var(--gold)] shadow-sm border border-[var(--border)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
                            <User size={16} /> Unregistered (B2C)
                        </button>
                    </div>

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
                        </div>
                    </div>

                    {/* Tax & Logistics (Smart GSTIN) */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Tax & Logistics</h3>

                        {isRegistered && (
                            <div className="bg-[var(--gold)]/5 border border-[var(--gold)]/20 p-4 rounded-[var(--radius-md)] mb-4 flex flex-col gap-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-1"><CheckCircle2 size={16} className="text-[var(--gold)]" /> Smart GSTIN</h4>
                                        <p className="text-xs text-[var(--text-muted)]">Type a valid GSTIN to instantly auto-fill the State Code and PAN Number.</p>
                                    </div>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-[var(--text-muted)] mb-1">GST Number *</label>
                                        <input required={isRegistered} value={form.gstNumber} onChange={(e) => set("gstNumber", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] uppercase focus:border-[var(--gold)] focus:outline-none transition" />
                                        {gstinMessage && <p className={`text-xs mt-1.5 font-medium ${gstinMessage.includes('✅') ? 'text-[var(--green-bright)]' : 'text-[var(--orange)]'}`}>{gstinMessage}</p>}
                                    </div>
                                    <label>
                                        <span className="block text-xs text-[var(--text-muted)] mb-1">PAN Number</span>
                                        <input value={form.panNumber} onChange={(e) => set("panNumber", e.target.value.toUpperCase())} placeholder="ABCDE1234F" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] uppercase focus:border-[var(--gold)] focus:outline-none transition" />
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <label className="col-span-2">
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Full Address</span>
                                <input value={form.fullAddress} onChange={(e) => set("fullAddress", e.target.value)} placeholder="123 Market Street..." className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">City / Town</span>
                                <input value={form.city} onChange={(e) => set("city", e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </label>
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">State {isRegistered && "(Auto-filled)"}</span>
                                <select value={form.state} onChange={(e) => set("state", e.target.value)} disabled={isRegistered && form.gstNumber.length === 15} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition disabled:opacity-60">
                                    {INDIAN_STATES.map((s: string) => <option key={s} value={s}>{s}</option>)}
                                </select>
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
