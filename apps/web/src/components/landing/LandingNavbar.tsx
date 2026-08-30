"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight, Sparkles, Sun, Moon, LayoutDashboard, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/contexts/ThemeProvider";

export function LandingNavbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const user = useAuthStore((s) => s.user);
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { label: "Features", href: "#features" },
        { label: "WhatsApp AI", href: "#whatsapp-ai" },
        { label: "Tally Bridge", href: "#tally-bridge" },
        { label: "ROI Calculator", href: "#roi-calculator" },
        { label: "Pricing", href: "#pricing" },
        { label: "FAQ", href: "#faq" },
    ];

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                scrolled
                    ? "bg-[var(--bg-primary)]/85 backdrop-blur-md border-b border-[var(--border)] py-3 shadow-lg"
                    : "bg-transparent py-5"
            }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                {/* Brand Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="text-[var(--gold)] group-hover:scale-105 transition-transform duration-200">
                        <Logo className="w-8 h-8" textCls="text-2xl font-bold tracking-tight text-[var(--text-primary)]" />
                    </div>
                </Link>

                {/* Desktop Navigation Links */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors duration-150"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                {/* Right Actions */}
                <div className="hidden md:flex items-center gap-4">
                    <button
                        onClick={toggleTheme}
                        aria-label="Toggle Theme"
                        className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)] transition"
                    >
                        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                    </button>

                    {isAuthenticated && user ? (
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 py-2 px-4 rounded-[var(--radius-md)] bg-[var(--gold)] text-[#07070E] font-semibold text-sm hover:bg-[var(--gold-light)] shadow-md hover:shadow-gold transition duration-200"
                        >
                            <LayoutDashboard size={16} />
                            <span>Go to Dashboard</span>
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--gold)] px-3 py-2 transition"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/register"
                                className="inline-flex items-center gap-2 py-2 px-4 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--gold)] to-[var(--gold-light)] text-[#07070E] font-semibold text-sm hover:opacity-95 shadow-md shadow-amber-500/10 hover:shadow-amber-500/20 transition duration-200"
                            >
                                <span>Start 14-Day Trial</span>
                                <ArrowRight size={15} />
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <div className="flex md:hidden items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        aria-label="Toggle Theme"
                        className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)]"
                    >
                        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] focus:outline-none"
                    >
                        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </div>

            {/* Mobile Drawer */}
            {mobileMenuOpen && (
                <div className="md:hidden bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-[var(--border)] px-4 pt-3 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-1">
                        {navLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="block px-3 py-2 rounded-md text-base font-medium text-[var(--text-secondary)] hover:text-[var(--gold)] hover:bg-[var(--bg-card)] transition"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                    <div className="pt-4 border-t border-[var(--border)] space-y-2">
                        {isAuthenticated && user ? (
                            <Link
                                href="/dashboard"
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[var(--radius-md)] bg-[var(--gold)] text-[#07070E] font-semibold text-sm"
                            >
                                <LayoutDashboard size={16} />
                                <span>Go to Dashboard</span>
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full block text-center py-2.5 px-4 rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-primary)] font-medium text-sm"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/register"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[var(--radius-md)] bg-[var(--gold)] text-[#07070E] font-semibold text-sm"
                                >
                                    <span>Start 14-Day Free Trial</span>
                                    <ArrowRight size={15} />
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
