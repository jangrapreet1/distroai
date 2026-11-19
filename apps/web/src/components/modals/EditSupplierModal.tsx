"use client";

import { useState, useEffect } from "react";
import { X, Building2, CheckCircle2 } from "lucide-react";
import { useUpdateSupplier, useOrg } from "@/hooks/api-hooks";
import { parseGstin, INDIAN_STATES } from "@/lib/utils";

interface EditSupplierModalProps {
    open: boolean;
    onClose: () => void;
    supplier: any;
}

export function EditSupplierModal({ open, onClose, supplier }: EditSupplierModalProps) {
    const updateSupplier = useUpdateSupplier();
    const { data: orgData } = useOrg() || {};
    const orgState = orgData?.data?.state ?? "Maharashtra";

    const [gstinMessage, setGstinMessage] = useState("");

    const [form, setForm] = useState({
        name: "",
        contactPerson: "",
        phone: "",
        email: "",
        gstNumber: "",
        panNumber: "",
        address: "",
        city: "",
        state: orgState,
        pincode: "",
        leadTimeDays: 0,
        creditDays: 0,
        notes: "",
        isActive: true,
    });

    const set = (key: string, value: string | number | boolean) =>
        setForm((f) => ({ ...f, [key]: value }));

    useEffect(() => {
        if (open && supplier) {
            setForm({
                name: supplier.name ?? "",
                contactPerson: supplier.contactPerson ?? "",
                phone: supplier.phone ?? "",
                email: supplier.email ?? "",
                gstNumber: supplier.gstNumber ?? "",
                panNumber: supplier.panNumber ?? "",
                address: supplier.address ?? "",
                city: supplier.city ?? "",
                state: supplier.state ?? orgState,
                pincode: supplier.pincode ?? "",
                leadTimeDays: Number(supplier.leadTimeDays) || 0,
                creditDays: Number(supplier.creditDays) || 0,
                notes: supplier.notes ?? "",
                isActive: supplier.isActive !== false,
            });
            setGstinMessage("");
        }
    }, [open, supplier, orgState]);

    // Smart GSTIN validation
    useEffect(() => {
        if (form.gstNumber && form.gstNumber.length === 15) {
            const parsed = parseGstin(form.gstNumber);
            if (parsed.valid && parsed.stateName && parsed.pan) {
                setForm((f) => ({ ...f, state: parsed.stateName!, panNumber: parsed.pan! }));
                setGstinMessage(`✅ Valid GSTIN: ${parsed.stateName} & PAN auto-filled`);
            } else {
                setGstinMessage("⚠️ Invalid GSTIN checksum or state code");
            }
        } else {
            setGstinMessage("");
        }
    }, [form.gstNumber]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplier?.id || !form.name.trim()) return;

        const payload: Record<string, unknown> = {
            name: form.name.trim(),
            contactPerson: form.contactPerson.trim() || undefined,
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
            gstNumber: form.gstNumber.trim().toUpperCase() || undefined,
            panNumber: form.panNumber.trim().toUpperCase() || undefined,
            address: form.address.trim() || undefined,
            city: form.city.trim() || undefined,
            state: form.state || undefined,
            pincode: form.pincode.trim() || undefined,
            leadTimeDays: Number(form.leadTimeDays) || 0,
            creditDays: Number(form.creditDays) || 0,
            notes: form.notes.trim() || undefined,
            isActive: form.isActive,
        };

        updateSupplier.mutate(
            { id: supplier.id, data: payload },
            {
                onSuccess: () => {
                    onClose();
                },
            }
        );
    };

    if (!open || !supplier) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-[var(--bg-primary)] border-t sm:border border-[var(--border)] rounded-t-2xl sm:rounded-[var(--radius-lg)] w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col pb-safe"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-primary)] z-10">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                            Edit Supplier Details
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            Update vendor contact, address, lead time, and payment terms for {supplier.name}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition p-1 rounded-md"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-6">
                    {/* Section 1: Vendor Profile */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gold)] border-b border-[var(--border)] pb-1.5">
                            Vendor Profile
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="sm:col-span-2">
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Supplier / Company Name *</span>
                                <input
                                    required
                                    value={form.name}
                                    onChange={(e) => set("name", e.target.value)}
                                    placeholder="e.g. Acme Pharmaceuticals"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Contact Person</span>
                                <input
                                    value={form.contactPerson}
                                    onChange={(e) => set("contactPerson", e.target.value)}
                                    placeholder="e.g. Rajesh Sharma"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </label>

                            <label className="flex items-center gap-3 pt-6 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => set("isActive", e.target.checked)}
                                    className="w-4 h-4 rounded text-[var(--gold)] focus:ring-[var(--gold)] border-[var(--border)] bg-[var(--bg-secondary)] cursor-pointer"
                                />
                                <span className="text-sm font-medium text-[var(--text-primary)]">
                                    Active Supplier
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Section 2: Contact Info */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gold)] border-b border-[var(--border)] pb-1.5">
                            Contact Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Phone Number</span>
                                <input
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    value={form.phone}
                                    onChange={(e) => set("phone", e.target.value)}
                                    placeholder="+91 98765 43210"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Email Address</span>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => set("email", e.target.value)}
                                    placeholder="orders@acme.com"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Section 3: Tax Identification & Address */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gold)] border-b border-[var(--border)] pb-1.5">
                            Tax & Address Details
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-[var(--text-muted)] mb-1">GSTIN</label>
                                <input
                                    value={form.gstNumber}
                                    onChange={(e) => set("gstNumber", e.target.value.toUpperCase())}
                                    placeholder="07AAAAA0000A1Z5"
                                    maxLength={15}
                                    autoCapitalize="characters"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] uppercase focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                                {gstinMessage && (
                                    <p
                                        className={`text-xs mt-1.5 font-medium ${
                                            gstinMessage.includes("✅")
                                                ? "text-[var(--green-bright)]"
                                                : "text-[var(--orange)]"
                                        }`}
                                    >
                                        {gstinMessage}
                                    </p>
                                )}
                            </div>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">PAN Number</span>
                                <input
                                    value={form.panNumber}
                                    onChange={(e) => set("panNumber", e.target.value.toUpperCase())}
                                    placeholder="AAAAA0000A"
                                    maxLength={10}
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] uppercase focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                            </label>

                            <label className="sm:col-span-2">
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Address</span>
                                <input
                                    value={form.address}
                                    onChange={(e) => set("address", e.target.value)}
                                    placeholder="Plot 45, Industrial Area Phase 1"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">City</span>
                                <input
                                    value={form.city}
                                    onChange={(e) => set("city", e.target.value)}
                                    placeholder="e.g. Mumbai"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">State</span>
                                <select
                                    value={form.state}
                                    onChange={(e) => set("state", e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                >
                                    {INDIAN_STATES.map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Pincode</span>
                                <input
                                    value={form.pincode}
                                    onChange={(e) => set("pincode", e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="400001"
                                    maxLength={6}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Section 4: Operational Terms */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gold)] border-b border-[var(--border)] pb-1.5">
                            Purchasing & Payment Terms
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Lead Time (Days)</span>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={form.leadTimeDays}
                                    onChange={(e) => set("leadTimeDays", Number(e.target.value))}
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                                    Typical shipment fulfillment delay
                                </span>
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Payment Terms (Credit Days)</span>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={form.creditDays}
                                    onChange={(e) => set("creditDays", Number(e.target.value))}
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                                    Days allowed to clear vendor bills
                                </span>
                            </label>

                            <label className="sm:col-span-2">
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Internal Notes</span>
                                <textarea
                                    rows={2}
                                    value={form.notes}
                                    onChange={(e) => set("notes", e.target.value)}
                                    placeholder="Bank details, preferred delivery slots, rep contact details..."
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)] sticky bottom-0 bg-[var(--bg-primary)] z-10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateSupplier.isPending}
                            className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition shadow-sm cursor-pointer"
                        >
                            {updateSupplier.isPending ? "Saving Changes..." : "Save Supplier Details"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
