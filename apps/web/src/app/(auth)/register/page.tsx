"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Check, ArrowLeft, ArrowRight, Building2, User, PartyPopper } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { INDIAN_STATES } from "@/lib/indian-states";

const step1Schema = z.object({
    orgName: z.string().min(2, "Business name is required"),
    businessType: z.string().min(1, "Business type is required"),
    sector: z.string().min(1, "Sector is required"),
    gstNumber: z.string().optional(),
    phone: z.string().min(10, "Enter a valid phone number").optional(),
    city: z.string().optional(),
    state: z.string().optional(),
});

const step2Schema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Minimum 8 characters"),
    confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

export default function RegisterPage() {
    const { register: registerUser, isRegistering } = useAuth();
    const [step, setStep] = useState(1);
    const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
    const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

    const onStep1 = (data: Step1Data) => {
        setStep1Data(data);
        setStep(2);
    };

    const onStep2 = (data: Step2Data) => {
        if (!step1Data) return;

        // Clean up the data before sending to backend
        const { confirmPassword, ...accountData } = data;

        // Ensure phone is exactly 10 digits if it exists
        const cleanedPhone = step1Data.phone?.replace(/\D/g, "").slice(-10);

        registerUser(
            { ...step1Data, phone: cleanedPhone, ...accountData },
            { onSuccess: () => setStep(3) }
        );
    };

    const steps = ["Business", "Account", "Done"];

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-[520px]">
                {/* Header */}
                <Link href="/login" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition mb-8">
                    <ArrowLeft size={16} /> Back to login
                </Link>

                <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
                    Create your account
                </h1>
                <p className="text-[var(--text-secondary)] mb-8">14-day free trial. No credit card required.</p>

                {/* Progress Bar */}
                <div className="flex items-center gap-2 mb-10">
                    {steps.map((label, i) => (
                        <div key={label} className="flex-1">
                            <div className={`h-1 rounded-full transition-all ${i < step ? "bg-[var(--gold)]" : "bg-[var(--border)]"}`} />
                            <p className={`text-xs mt-1.5 ${i < step ? "text-[var(--gold)]" : "text-[var(--text-muted)]"}`}>{label}</p>
                        </div>
                    ))}
                </div>

                {/* Step 1: Business Details */}
                {step === 1 && (
                    <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
                        <div className="flex items-center gap-2 mb-4 text-[var(--gold)]">
                            <Building2 size={20} />
                            <span className="text-sm font-medium">Business Details</span>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-secondary)] mb-1">Business Name *</label>
                            <input {...form1.register("orgName")} placeholder="e.g. Sharma Trading Co." className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                            {form1.formState.errors.orgName && <p className="text-sm text-[var(--red)] mt-1">{form1.formState.errors.orgName.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-1">Business Type *</label>
                                <select {...form1.register("businessType")} className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                                    <option value="">Select type</option>
                                    <option value="Distributor">Distributor / Wholesaler</option>
                                    <option value="Manufacturer">Manufacturer</option>
                                    <option value="Retailer">Retailer</option>
                                    <option value="Other">Other</option>
                                </select>
                                {form1.formState.errors.businessType && <p className="text-sm text-[var(--red)] mt-1">{form1.formState.errors.businessType.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-1">Sector *</label>
                                <select {...form1.register("sector")} className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                                    <option value="">Select sector</option>
                                    <option value="FMCG">FMCG</option>
                                    <option value="Pharma">Pharmaceuticals</option>
                                    <option value="Electronics">Electronics</option>
                                    <option value="Apparel">Apparel</option>
                                    <option value="Automotive">Automotive</option>
                                    <option value="Other">Other</option>
                                </select>
                                {form1.formState.errors.sector && <p className="text-sm text-[var(--red)] mt-1">{form1.formState.errors.sector.message}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-secondary)] mb-1">GST Number (optional)</label>
                            <input {...form1.register("gstNumber")} placeholder="22AAAAA0000A1Z5" className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-secondary)] mb-1">Phone</label>
                            <input {...form1.register("phone")} placeholder="9876543210" className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-1">City</label>
                                <input {...form1.register("city")} placeholder="Mumbai" className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-1">State</label>
                                <select {...form1.register("state")} className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                                    <option value="">Select state</option>
                                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="w-full py-3 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition flex items-center justify-center gap-2 mt-2">
                            Next: Create Account <ArrowRight size={16} />
                        </button>
                    </form>
                )}

                {/* Step 2: Account Details */}
                {step === 2 && (
                    <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
                        <div className="flex items-center gap-2 mb-4 text-[var(--gold)]">
                            <User size={20} />
                            <span className="text-sm font-medium">Your Account</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-1">First Name *</label>
                                <input {...form2.register("firstName")} className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                                {form2.formState.errors.firstName && <p className="text-sm text-[var(--red)] mt-1">{form2.formState.errors.firstName.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-1">Last Name</label>
                                <input {...form2.register("lastName")} className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-secondary)] mb-1">Email *</label>
                            <input {...form2.register("email")} type="email" className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                            {form2.formState.errors.email && <p className="text-sm text-[var(--red)] mt-1">{form2.formState.errors.email.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-secondary)] mb-1">Password *</label>
                            <div className="relative">
                                <input {...form2.register("password")} type={showPassword ? "text" : "password"} className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition pr-12" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {form2.formState.errors.password && <p className="text-sm text-[var(--red)] mt-1">{form2.formState.errors.password.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-secondary)] mb-1">Confirm Password *</label>
                            <input {...form2.register("confirmPassword")} type="password" className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                            {form2.formState.errors.confirmPassword && <p className="text-sm text-[var(--red)] mt-1">{form2.formState.errors.confirmPassword.message}</p>}
                        </div>

                        <div className="flex gap-3 mt-2">
                            <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition">
                                Back
                            </button>
                            <button type="submit" disabled={isRegistering} className="flex-1 py-3 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition disabled:opacity-50">
                                {isRegistering ? "Creating..." : "Create Account"}
                            </button>
                        </div>
                    </form>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-[var(--green)]/15 flex items-center justify-center mx-auto mb-6">
                            <PartyPopper size={32} className="text-[var(--green-bright)]" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-playfair)" }}>Welcome to DistroAI!</h2>
                        <p className="text-[var(--text-secondary)] mb-8">Your 14-day free trial has started.</p>

                        <div className="text-left space-y-3 mb-8 bg-[var(--bg-card)] rounded-[var(--radius-md)] p-5 border border-[var(--border)]">
                            <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Get started in 3 steps:</p>
                            {["Add your first 10 products", "Import your customer list", "Create your first order"].map((t, i) => (
                                <div key={t} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                                    <div className="w-6 h-6 rounded-full bg-[var(--gold)]/10 flex items-center justify-center shrink-0 text-xs text-[var(--gold)] font-semibold">{i + 1}</div>
                                    {t}
                                </div>
                            ))}
                        </div>

                        <Link href="/" className="inline-flex items-center gap-2 py-3 px-8 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition">
                            Open Dashboard <ArrowRight size={16} />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
