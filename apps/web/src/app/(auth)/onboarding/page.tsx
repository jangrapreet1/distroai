"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Phone, MapPin, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth.store";
import apiClient, { getApiError } from "@/lib/api-client";
import { INDIAN_STATES } from "@/lib/indian-states";
import { Logo } from "@/components/Logo";

const onboardingSchema = z.object({
    orgName: z.string().min(2, "Business / Firm name is required"),
    phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number starting with 6-9"),
    businessType: z.string().min(1, "Please select your business type"),
    city: z.string().min(2, "City is required"),
    state: z.string().min(1, "Please select your state"),
    gstNumber: z.string().optional(),
});

type OnboardingForm = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
    const router = useRouter();
    const { user, org, isAuthenticated } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<OnboardingForm>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: {
            orgName: org?.name && !org.name.includes("'s Workspace") ? org.name : "",
            phone: user?.phone || "",
            businessType: "FMCG",
            city: "",
            state: "",
            gstNumber: "",
        },
    });

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, router]);

    const onSubmit = async (data: OnboardingForm) => {
        if (!user) return;
        setIsSubmitting(true);

        try {
            // 1. Update user's personal mobile number
            await apiClient.patch(`/api/v1/users/${user.id}`, {
                phone: data.phone,
            });

            // 2. Update organization details
            const orgRes = await apiClient.patch(`/api/v1/org`, {
                name: data.orgName,
                phone: data.phone,
                city: data.city,
                state: data.state,
                businessType: data.businessType,
                gstNumber: data.gstNumber ? data.gstNumber.toUpperCase() : undefined,
            });

            // 3. Update auth store state
            const updatedOrg = orgRes.data || {
                ...org,
                name: data.orgName,
                phone: data.phone,
                city: data.city,
                state: data.state,
            };

            useAuthStore.getState().setAuth(
                { ...user, phone: data.phone },
                updatedOrg,
                {
                    accessToken: useAuthStore.getState().accessToken || "",
                    refreshToken: useAuthStore.getState().refreshToken || "",
                }
            );

            toast.success("Profile setup complete! Welcome to DistroAI.");
            router.push("/dashboard");
        } catch (error) {
            const err = getApiError(error);
            toast.error(err.message || "Failed to update profile. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--bg-primary)]">
            <div className="w-full max-w-[540px]">
                {/* Header / Brand */}
                <div className="flex items-center justify-between mb-8">
                    <div className="text-[var(--gold)]">
                        <Logo className="w-7 h-7" textCls="text-xl text-[var(--text-primary)]" />
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] text-xs font-medium">
                        <Sparkles size={13} />
                        Step 2: Profile Setup
                    </div>
                </div>

                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                        Set up your workspace
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm">
                        Welcome, <span className="text-[var(--text-primary)] font-medium">{user?.firstName || "Partner"}</span>! Enter your distributorship details to start receiving WhatsApp orders and generating GST invoices.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 sm:p-8 shadow-xl">
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        {/* Business Name */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                Firm / Distributorship Name *
                            </label>
                            <div className="relative">
                                <Building2 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                <input
                                    {...form.register("orgName")}
                                    placeholder="e.g., Radha Krishan Trading Co."
                                    className="w-full pl-11 pr-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </div>
                            {form.formState.errors.orgName && (
                                <p className="text-sm text-[var(--red)] mt-1">{form.formState.errors.orgName.message}</p>
                            )}
                        </div>

                        {/* WhatsApp / Phone */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                WhatsApp / Mobile Number *
                            </label>
                            <div className="relative">
                                <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                <input
                                    {...form.register("phone")}
                                    placeholder="9876543210 (10 digits)"
                                    maxLength={10}
                                    className="w-full pl-11 pr-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                Used to connect your WhatsApp bot for retailers to place voice/text orders.
                            </p>
                            {form.formState.errors.phone && (
                                <p className="text-sm text-[var(--red)] mt-1">{form.formState.errors.phone.message}</p>
                            )}
                        </div>

                        {/* Sector / Business Type */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                Distribution Sector *
                            </label>
                            <select
                                {...form.register("businessType")}
                                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                            >
                                <option value="FMCG">FMCG & Packaged Goods</option>
                                <option value="Food & Beverages">Food & Beverages</option>
                                <option value="Pharma">Pharmaceuticals & Healthcare</option>
                                <option value="Agriculture">Agriculture & Seeds</option>
                                <option value="Electronics">Electronics & Hardware</option>
                                <option value="Automotive">Automotive & Spare Parts</option>
                                <option value="General Trade">General Trade / Wholesale</option>
                            </select>
                            {form.formState.errors.businessType && (
                                <p className="text-sm text-[var(--red)] mt-1">{form.formState.errors.businessType.message}</p>
                            )}
                        </div>

                        {/* City and State */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                    City *
                                </label>
                                <input
                                    {...form.register("city")}
                                    placeholder="e.g., Surat, Karnal"
                                    className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition"
                                />
                                {form.formState.errors.city && (
                                    <p className="text-sm text-[var(--red)] mt-1">{form.formState.errors.city.message}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                    State *
                                </label>
                                <select
                                    {...form.register("state")}
                                    className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                                >
                                    <option value="">Select state</option>
                                    {INDIAN_STATES.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                {form.formState.errors.state && (
                                    <p className="text-sm text-[var(--red)] mt-1">{form.formState.errors.state.message}</p>
                                )}
                            </div>
                        </div>

                        {/* GSTIN (Optional) */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                GST Number <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
                            </label>
                            <input
                                {...form.register("gstNumber")}
                                placeholder="e.g., 07AAAAA0000A1Z5"
                                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none uppercase transition"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3.5 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition flex items-center justify-center gap-2 mt-4 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSubmitting ? (
                                "Saving workspace..."
                            ) : (
                                <>
                                    Complete Setup & Go to Dashboard <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Features Recap */}
                <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)]/50">
                        <CheckCircle2 size={16} className="text-[var(--gold)] mx-auto mb-1" />
                        <p className="text-xs text-[var(--text-secondary)]">WhatsApp Orders</p>
                    </div>
                    <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)]/50">
                        <CheckCircle2 size={16} className="text-[var(--gold)] mx-auto mb-1" />
                        <p className="text-xs text-[var(--text-secondary)]">GST Invoicing</p>
                    </div>
                    <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)]/50">
                        <CheckCircle2 size={16} className="text-[var(--gold)] mx-auto mb-1" />
                        <p className="text-xs text-[var(--text-secondary)]">Tally Sync</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
