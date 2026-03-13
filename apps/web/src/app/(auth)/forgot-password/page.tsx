"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Mail, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import apiClient, { getApiError } from "@/lib/api-client";

const step1Schema = z.object({ email: z.string().email("Enter a valid email") });
const step2Schema = z.object({
    otp: z.string().length(6, "OTP must be 6 digits"),
    newPassword: z.string().min(8, "Minimum 8 characters"),
});

export default function ForgotPasswordPage() {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");

    const form1 = useForm<z.infer<typeof step1Schema>>({ resolver: zodResolver(step1Schema) });
    const form2 = useForm<z.infer<typeof step2Schema>>({ resolver: zodResolver(step2Schema) });

    const onStep1 = async (data: z.infer<typeof step1Schema>) => {
        setIsLoading(true);
        try {
            await apiClient.post("/api/v1/auth/forgot-password", { email: data.email });
            setEmail(data.email);
            setStep(2);
            toast.success("OTP sent to your email");
        } catch (err) {
            toast.error(getApiError(err).message);
        } finally {
            setIsLoading(false);
        }
    };

    const onStep2 = async (data: z.infer<typeof step2Schema>) => {
        setIsLoading(true);
        try {
            await apiClient.post("/api/v1/auth/reset-password", { email, ...data });
            toast.success("Password reset! Please sign in.");
            window.location.href = "/login";
        } catch (err) {
            toast.error(getApiError(err).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-[400px]">
                <Link href="/login" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition mb-8">
                    <ArrowLeft size={16} /> Back to login
                </Link>

                <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-playfair)" }}>Reset password</h1>
                <p className="text-[var(--text-secondary)] mb-8">{step === 1 ? "Enter your email to receive a reset code." : `Enter the OTP sent to ${email}`}</p>

                {step === 1 && (
                    <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-[var(--gold)]"><Mail size={18} /><span className="text-sm">Email Address</span></div>
                        <input {...form1.register("email")} type="email" placeholder="you@company.com" className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                        {form1.formState.errors.email && <p className="text-sm text-[var(--red)] mt-1">{form1.formState.errors.email.message}</p>}
                        <button type="submit" disabled={isLoading} className="w-full py-3 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition disabled:opacity-50">
                            {isLoading ? "Sending..." : "Send OTP"}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-[var(--gold)]"><KeyRound size={18} /><span className="text-sm">Reset Code</span></div>
                        <input {...form2.register("otp")} placeholder="6-digit OTP" maxLength={6} className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition tracking-widest text-center text-lg" style={{ fontFamily: "var(--font-mono)" }} />
                        {form2.formState.errors.otp && <p className="text-sm text-[var(--red)] mt-1">{form2.formState.errors.otp.message}</p>}
                        <input {...form2.register("newPassword")} type="password" placeholder="New password (min 8 chars)" className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                        {form2.formState.errors.newPassword && <p className="text-sm text-[var(--red)] mt-1">{form2.formState.errors.newPassword.message}</p>}
                        <button type="submit" disabled={isLoading} className="w-full py-3 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition disabled:opacity-50">
                            {isLoading ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
