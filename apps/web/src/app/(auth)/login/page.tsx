"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Package, BarChart3, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const loginSchema = z.object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(1, "Password is required"),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const { login, isLoggingIn } = useAuth();
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

    const onSubmit = (data: LoginForm) => login(data);

    const benefits = [
        { icon: Package, title: "Smart Inventory", desc: "AI-powered stock predictions, auto-reorder, batch tracking" },
        { icon: BarChart3, title: "Business Analytics", desc: "Real-time KPIs, GST reports, collection insights" },
        { icon: Zap, title: "Instant Operations", desc: "WhatsApp orders, one-tap invoicing, field force tracking" },
    ];

    return (
        <div className="min-h-screen flex">
            {/* Left Panel */}
            <div className="hidden lg:flex lg:w-1/2 bg-[var(--bg-secondary)] flex-col justify-center px-16 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--gold)]/5 via-transparent to-[var(--purple)]/5" />
                <div className="relative z-10">
                    <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
                        DistroAI
                    </h1>
                    <p className="text-[var(--text-secondary)] text-lg mb-12">
                        The intelligent distribution management platform for Indian businesses.
                    </p>
                    <div className="space-y-8">
                        {benefits.map((b) => (
                            <div key={b.title} className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center shrink-0">
                                    <b.icon size={20} className="text-[var(--gold)]" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-[var(--text-primary)] mb-1">{b.title}</h3>
                                    <p className="text-sm text-[var(--text-secondary)]">{b.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel — Login Form */}
            <div className="flex-1 flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-[400px]">
                    <div className="lg:hidden mb-8">
                        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>DistroAI</h1>
                    </div>

                    <h2 className="text-2xl font-semibold mb-2">Welcome back</h2>
                    <p className="text-[var(--text-secondary)] mb-8">Sign in to your account</p>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <div>
                            <label className="block text-sm text-[var(--text-secondary)] mb-1.5">Email</label>
                            <input
                                {...register("email")}
                                type="email"
                                placeholder="you@company.com"
                                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition"
                            />
                            {errors.email && <p className="text-sm text-[var(--red)] mt-1">{errors.email.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-secondary)] mb-1.5">Password</label>
                            <div className="relative">
                                <input
                                    {...register("password")}
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition pr-12"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.password && <p className="text-sm text-[var(--red)] mt-1">{errors.password.message}</p>}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded border-[var(--border)] bg-[var(--bg-card)]" />
                                <span className="text-[var(--text-secondary)]">Remember me</span>
                            </label>
                            <Link href="/forgot-password" className="text-[var(--gold)] hover:text-[var(--gold-light)] transition">
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoggingIn}
                            className="w-full py-3 rounded-[var(--radius-md)] bg-[var(--gold)] text-[var(--bg-primary)] font-semibold hover:bg-[var(--gold-light)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoggingIn ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    <p className="text-center text-sm text-[var(--text-secondary)] mt-8">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="text-[var(--gold)] hover:text-[var(--gold-light)] transition font-medium">
                            Start free trial
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
