"use client";

import { useState, useEffect } from "react";
import { X, Building2, User, CheckCircle2, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateCustomer, useOrg } from "@/hooks/api-hooks";
import { parseGstin, INDIAN_STATES } from "@/lib/utils";

const CUSTOMER_TYPES = ["RETAILER", "WHOLESALER", "INSTITUTION", "INDIVIDUAL"];
const CUSTOMER_TIERS = ["GOLD", "SILVER", "BRONZE"];

interface EditCustomerModalProps {
    open: boolean;
    onClose: () => void;
    customer: any;
}

export function EditCustomerModal({ open, onClose, customer }: EditCustomerModalProps) {
    const qc = useQueryClient();
    const updateCustomer = useUpdateCustomer();
    const { data: orgData } = useOrg() || {};
    const orgState = orgData?.data?.state ?? "Maharashtra";

    const [isRegistered, setIsRegistered] = useState(false);
    const [gstinMessage, setGstinMessage] = useState("");

    const [form, setForm] = useState({
        name: "",
        contactPerson: "",
        phone: "",
        altPhone: "",
        email: "",
        type: "RETAILER",
        tier: "BRONZE",
        gstNumber: "",
        panNumber: "",
        fullAddress: "",
        city: "",
        state: orgState,
        pincode: "",
        creditLimit: 0,
        creditDays: 30,
        gracePeriodDays: 7,
        isActive: true,
    });

    const set = (key: string, value: string | number | boolean) =>
        setForm((f) => ({ ...f, [key]: value }));

    // Populate existing customer details when opened
    useEffect(() => {
        if (open && customer) {
            const hasGst = Boolean(customer.gstNumber && customer.gstNumber.trim().length > 0);
            setIsRegistered(hasGst);
            setForm({
                name: customer.name ?? "",
                contactPerson: customer.contactPerson ?? "",
                phone: customer.phone ?? "",
                altPhone: customer.altPhone || customer.whatsappNumber || "",
                email: customer.email ?? "",
                type: customer.type ?? "RETAILER",
                tier: customer.tier ?? "BRONZE",
                gstNumber: customer.gstNumber ?? "",
                panNumber: customer.panNumber ?? "",
                fullAddress: customer.fullAddress ?? "",
                city: customer.city ?? "",
                state: customer.state ?? orgState,
                pincode: customer.pincode ?? "",
                creditLimit: Number(customer.creditLimit) || 0,
                creditDays: Number(customer.creditDays) || 0,
                gracePeriodDays: Number(customer.gracePeriodDays) || 7,
                isActive: customer.isActive !== false,
            });
            setGstinMessage("");
        }
    }, [open, customer, orgState]);

    // Smart GSTIN autofill & validation
    useEffect(() => {
        if (isRegistered && form.gstNumber && form.gstNumber.length === 15) {
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
    }, [form.gstNumber, isRegistered]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer?.id) return;

        let primaryPhone = form.phone.trim();
        let alternatePhone = form.altPhone.trim();
        let contact = form.contactPerson.trim();

        // If the user entered a phone number into "Contact Person"
        const isContactDigits = /^\+?[0-9\s-]{10,15}$/.test(contact);
        if (isContactDigits) {
            // If primary phone wasn't changed from original or is empty, user intended this to be the primary phone
            if (!primaryPhone || primaryPhone === (customer.phone || '')) {
                primaryPhone = contact;
            } else if (!alternatePhone || alternatePhone === (customer.altPhone || '')) {
                alternatePhone = contact;
            }
            // Do not store phone digits as person name
            contact = customer.contactPerson && !/^\+?[0-9\s-]{10,15}$/.test(customer.contactPerson)
                ? customer.contactPerson
                : "";
        }

        const payload: Record<string, unknown> = {
            name: form.name.trim(),
            contactPerson: contact ? contact : null,
            phone: primaryPhone ? primaryPhone : null,
            altPhone: alternatePhone ? alternatePhone : null,
            whatsappNumber: alternatePhone || primaryPhone || null,
            email: form.email.trim() ? form.email.trim() : null,
            type: form.type,
            tier: form.tier,
            fullAddress: form.fullAddress.trim() ? form.fullAddress.trim() : null,
            city: form.city.trim() ? form.city.trim() : null,
            state: form.state,
            pincode: form.pincode.trim() ? form.pincode.trim() : null,
            creditLimit: Number(form.creditLimit) || 0,
            creditDays: Number(form.creditDays) || 0,
            gracePeriodDays: Number(form.gracePeriodDays) || 0,
            isActive: form.isActive,
        };

        if (isRegistered && form.gstNumber.trim()) {
            payload.gstNumber = form.gstNumber.trim().toUpperCase();
            payload.panNumber = form.panNumber.trim().toUpperCase() || null;
        } else {
            payload.gstNumber = null;
            payload.panNumber = null;
        }

        updateCustomer.mutate(
            { id: customer.id, data: payload },
            {
                onSuccess: () => {
                    qc.invalidateQueries({ queryKey: ["customers"] });
                    qc.invalidateQueries({ queryKey: ["customers", customer.id] });
                    onClose();
                },
            }
        );
    };

    if (!open || !customer) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-[var(--bg-primary)] border-t sm:border border-[var(--border)] rounded-t-2xl sm:rounded-[var(--radius-lg)] w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col pb-safe"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-primary)] z-10">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                            Edit Customer Details
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            Update profile, tax identification, contact, and credit terms for {customer.name}
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
                    {/* B2B / B2C Toggle */}
                    <div className="flex bg-[var(--bg-secondary)] border border-[var(--border)] p-1 rounded-[var(--radius-lg)]">
                        <button
                            type="button"
                            onClick={() => setIsRegistered(true)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-[var(--radius-md)] transition ${
                                isRegistered
                                    ? "bg-[var(--bg-card)] text-[var(--gold)] shadow-sm border border-[var(--border)]"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                            }`}
                        >
                            <Building2 size={16} /> Registered Business (B2B / GST)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsRegistered(false);
                                setForm((f) => ({ ...f, gstNumber: "", panNumber: "" }));
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-[var(--radius-md)] transition ${
                                !isRegistered
                                    ? "bg-[var(--bg-card)] text-[var(--gold)] shadow-sm border border-[var(--border)]"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                            }`}
                        >
                            <User size={16} /> Unregistered (B2C)
                        </button>
                    </div>

                    {/* Section 1: Business Profile */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gold)] border-b border-[var(--border)] pb-1.5">
                            Business Profile
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="sm:col-span-2">
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">
                                    Customer / Business Name *
                                </span>
                                <input
                                    required
                                    value={form.name}
                                    onChange={(e) => set("name", e.target.value)}
                                    placeholder="e.g. Radhe Shyam General Store"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">
                                    Contact Person Name (optional)
                                </span>
                                <input
                                    value={form.contactPerson}
                                    onChange={(e) => set("contactPerson", e.target.value)}
                                    placeholder="e.g. Mukesh Kumar (Name only, not phone)"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                                {/^\+?[0-9\s-]{6,}$/.test(form.contactPerson.trim()) && (
                                    <span className="text-[11px] text-[var(--warning)] block mt-1">
                                        💡 Detected phone number. On save, this will update Primary Mobile Number.
                                    </span>
                                )}
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Customer Type</span>
                                <select
                                    value={form.type}
                                    onChange={(e) => set("type", e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                >
                                    {CUSTOMER_TYPES.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Customer Tier</span>
                                <select
                                    value={form.tier}
                                    onChange={(e) => set("tier", e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                >
                                    {CUSTOMER_TIERS.map((tier) => (
                                        <option key={tier} value={tier}>
                                            {tier}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex items-center gap-3 pt-6 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => set("isActive", e.target.checked)}
                                    className="w-4 h-4 rounded text-[var(--gold)] focus:ring-[var(--gold)] border-[var(--border)] bg-[var(--bg-secondary)] cursor-pointer"
                                />
                                <span className="text-sm font-medium text-[var(--text-primary)]">
                                    Active Account
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Section 2: Contact Information */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gold)] border-b border-[var(--border)] pb-1.5">
                            Contact Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block font-semibold text-[var(--text-primary)]">
                                    Primary Phone / Mobile *
                                </span>
                                <input
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    value={form.phone}
                                    onChange={(e) => set("phone", e.target.value)}
                                    placeholder="+91 98124 66888"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block font-semibold text-[var(--text-primary)]">
                                    Alternate Phone / WhatsApp
                                </span>
                                <input
                                    type="tel"
                                    inputMode="tel"
                                    value={form.altPhone}
                                    onChange={(e) => set("altPhone", e.target.value)}
                                    placeholder="+91 98124 00000"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                                    Used for sending invoices and payment links on WhatsApp
                                </span>
                            </label>

                            <label className="sm:col-span-2">
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Email Address</span>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => set("email", e.target.value)}
                                    placeholder="retailer@example.com"
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

                        {isRegistered && (
                            <div className="bg-[var(--gold)]/5 border border-[var(--gold)]/20 p-4 rounded-[var(--radius-md)] space-y-3">
                                <div>
                                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-1 text-[var(--text-primary)]">
                                        <CheckCircle2 size={16} className="text-[var(--gold)]" /> Smart GSTIN Verification
                                    </h4>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Entering a 15-character GSTIN automatically detects state code and PAN number.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-[var(--text-muted)] mb-1">GSTIN *</label>
                                        <input
                                            required={isRegistered}
                                            value={form.gstNumber}
                                            onChange={(e) => set("gstNumber", e.target.value.toUpperCase())}
                                            placeholder="06AAAAA0000A1Z5"
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
                                        <span className="block text-xs text-[var(--text-muted)] mb-1">PAN Number</span>
                                        <input
                                            value={form.panNumber}
                                            onChange={(e) => set("panNumber", e.target.value.toUpperCase())}
                                            placeholder="AAAAA0000A"
                                            maxLength={10}
                                            autoCapitalize="characters"
                                            autoCorrect="off"
                                            spellCheck={false}
                                            className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] uppercase focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <label className="sm:col-span-3">
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Full Address</span>
                                <input
                                    value={form.fullAddress}
                                    onChange={(e) => set("fullAddress", e.target.value)}
                                    placeholder="Shop No. 4, Main Market Road"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">City / Town</span>
                                <input
                                    value={form.city}
                                    onChange={(e) => set("city", e.target.value)}
                                    placeholder="e.g. Rohtak"
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
                                    {INDIAN_STATES.map((state) => (
                                        <option key={state} value={state}>
                                            {state}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Pincode</span>
                                <input
                                    value={form.pincode}
                                    onChange={(e) => set("pincode", e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="124001"
                                    maxLength={6}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Section 4: Credit Terms & Limits */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gold)] border-b border-[var(--border)] pb-1.5">
                            Credit Terms & Policy
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Credit Limit (₹)</span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    value={form.creditLimit}
                                    onChange={(e) => set("creditLimit", Number(e.target.value))}
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                                    0 = Unlimited
                                </span>
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Credit Days</span>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={form.creditDays}
                                    onChange={(e) => set("creditDays", Number(e.target.value))}
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                                    Payment due window
                                </span>
                            </label>

                            <label>
                                <span className="text-xs text-[var(--text-muted)] mb-1 block">Grace Period (Days)</span>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={form.gracePeriodDays}
                                    onChange={(e) => set("gracePeriodDays", Number(e.target.value))}
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                                />
                                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                                    Days before blocking
                                </span>
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
                            disabled={updateCustomer.isPending}
                            className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition shadow-sm cursor-pointer"
                        >
                            {updateCustomer.isPending ? "Saving Changes..." : "Save Customer Details"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
