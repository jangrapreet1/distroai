"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Package, BarChart3, Zap, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth.store";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/contexts/ThemeProvider";

const loginSchema = z.object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(1, "Password is required"),
});
type LoginForm = z.infer<typeof loginSchema>;

// Inner component that uses useSearchParams — must be wrapped in Suspense
function LoginForm() {
    const { login, isLoggingIn, handleGoogleCallback } = useAuth();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const searchParams = useSearchParams();
    const { theme, toggleTheme } = useTheme();

    // If user is already authenticated (e.g. from localStorage session), restore cookie and return to dashboard
    useEffect(() => {
        if (isAuthenticated) {
            const token = useAuthStore.getState().accessToken;
            if (token && typeof document !== "undefined" && !document.cookie.includes('accessToken=')) {
                document.cookie = `accessToken=${token};path=/;max-age=2592000;SameSite=Lax`;
            }
            const preferred = (typeof window !== "undefined" && localStorage.getItem('distroai_default_home')) || '/dashboard';
            const redirectTo = searchParams?.get('redirect') || preferred;
            router.replace(redirectTo);
        }
    }, [isAuthenticated, router, searchParams]);

    useEffect(() => {
        const accessToken = searchParams?.get('accessToken');
        const refreshToken = searchParams?.get('refreshToken');
        if (accessToken && refreshToken) {
            handleGoogleCallback({ accessToken, refreshToken });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

    const onSubmit = (data: LoginForm) => login(data);

    return (
        <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
            <div className="absolute top-6 right-6">
                <button
                    type="button"
                    onClick={toggleTheme}
                    className="p-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)] transition shadow-sm"
                    title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    aria-label="Toggle theme"
                >
                    {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            <div className="w-full max-w-[400px]">
                <div className="lg:hidden mb-8">
                    <Logo className="w-8 h-8" textCls="text-2xl font-bold text-[var(--text-primary)]" />
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-slate-900 dark:text-white">Welcome back</h2>
                <p className="text-slate-500 dark:text-zinc-400 mb-8 text-sm">Sign in to your account to manage distribution operations</p>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">Email address</label>
                        <input
                            {...register("email")}
                            type="email"
                            placeholder="you@company.com"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition shadow-xs"
                        />
                        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">Password</label>
                        <div className="relative">
                            <input
                                {...register("password")}
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition pr-11 shadow-xs"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-slate-300 dark:border-zinc-700 accent-blue-600 w-4 h-4 cursor-pointer" />
                            <span className="text-slate-600 dark:text-zinc-400 font-medium">Remember me</span>
                        </label>
                        <Link href="/forgot-password" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                            Forgot password?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mt-2"
                    >
                        {isLoggingIn ? "Signing in..." : "Sign In"}
                    </button>

                    <div className="relative my-5">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-zinc-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase tracking-wider">
                            <span className="bg-[var(--bg-primary)] px-3 text-slate-400 dark:text-zinc-500 font-medium">Or continue with</span>
                        </div>
                    </div>

                    <a
                        href="/api/v1/auth/google"
                        className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-medium text-sm transition shadow-xs active:scale-[0.99]"
                    >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>Google</span>
                    </a>
                </form>

                <p className="text-center text-sm text-slate-500 dark:text-zinc-400 mt-6">
                    Don&apos;t have an account?{" "}
                    <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                        Start free trial
                    </Link>
                </p>
            </div>
        </div>
    );
}

const benefits = [
    { icon: Package, title: "Smart Inventory", desc: "AI-powered stock predictions, auto-reorder, batch tracking" },
    { icon: BarChart3, title: "Business Analytics", desc: "Real-time KPIs, GST reports, collection insights" },
    { icon: Zap, title: "Instant Operations", desc: "WhatsApp orders, one-tap invoicing, field force tracking" },
];

export default function LoginPage() {
    return (
        <div className="min-h-screen flex bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
            {/* Left Panel */}
            <div className="hidden lg:flex lg:w-1/2 bg-[var(--bg-secondary)] flex-col justify-center px-16 relative overflow-hidden border-r border-[var(--border)]">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--gold)]/5 via-transparent to-[var(--purple)]/5" />
                <div className="relative z-10">
                    <div className="mb-2 text-[var(--gold)]">
                        <Logo className="w-10 h-10" textCls="text-4xl text-[var(--text-primary)]" />
                    </div>
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

            {/* Right Panel — wrapped in Suspense for useSearchParams */}
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="text-[var(--text-muted)]">Loading...</div></div>}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
