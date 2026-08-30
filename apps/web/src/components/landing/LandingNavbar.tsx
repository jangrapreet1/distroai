"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, ArrowRight, Sun, Moon, LayoutDashboard, Sparkles } from "lucide-react";
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
            setScrolled(window.scrollY > 25);
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
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                scrolled
                    ? "bg-[#06060A]/80 backdrop-blur-xl border-b border-white/[0.08] py-3.5 shadow-2xl shadow-black/40"
                    : "bg-transparent py-6"
            }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                {/* Brand Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <motion.div
                        whileHover={{ scale: 1.03 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        className="text-[var(--gold)]"
                    >
                        <Logo className="w-8 h-8" textCls="text-2xl font-bold tracking-tight text-[var(--text-primary)]" />
                    </motion.div>
                </Link>

                {/* Desktop Navigation Links */}
                <nav className="hidden md:flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-1.5 backdrop-blur-md">
                    {navLinks.map((link) => (
                        <motion.a
                            key={link.label}
                            href={link.href}
                            whileHover={{ scale: 1.04 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            className="px-3.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors duration-150 rounded-full hover:bg-white/[0.03]"
                        >
                            {link.label}
                        </motion.a>
                    ))}
                </nav>

                {/* Right Actions */}
                <div className="hidden md:flex items-center gap-3">
                    <motion.button
                        onClick={toggleTheme}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.94 }}
                        aria-label="Toggle Theme"
                        className="p-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)] transition"
                    >
                        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                    </motion.button>

                    {isAuthenticated && user ? (
                        <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                            <Link
                                href="/dashboard"
                                className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-[var(--gold)] text-[#07070E] font-semibold text-xs hover:bg-[var(--gold-light)] shadow-lg shadow-amber-500/15 transition"
                            >
                                <LayoutDashboard size={15} />
                                <span>Go to Dashboard</span>
                            </Link>
                        </motion.div>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--gold)] px-3 py-2 transition"
                            >
                                Sign In
                            </Link>
                            <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                                <Link
                                    href="/register"
                                    className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-gradient-to-r from-[var(--gold)] via-[var(--gold-light)] to-[#FFE8A3] text-[#07070E] font-bold text-xs shadow-lg shadow-amber-500/20 hover:opacity-95 transition"
                                >
                                    <span>Start 14-Day Free Trial</span>
                                    <ArrowRight size={14} />
                                </Link>
                            </motion.div>
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
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="md:hidden bg-[#06060A]/95 backdrop-blur-2xl border-b border-white/[0.08] px-4 pt-3 pb-6 space-y-3"
                    >
                        <div className="space-y-1">
                            {navLinks.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--gold)] hover:bg-white/[0.03] transition"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </div>
                        <div className="pt-4 border-t border-white/[0.08] space-y-2">
                            {isAuthenticated && user ? (
                                <Link
                                    href="/dashboard"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--gold)] text-[#07070E] font-semibold text-xs"
                                >
                                    <LayoutDashboard size={15} />
                                    <span>Go to Dashboard</span>
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href="/login"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="w-full block text-center py-2.5 px-4 rounded-xl border border-white/[0.08] text-[var(--text-primary)] font-medium text-xs"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        href="/register"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--gold)] text-[#07070E] font-semibold text-xs"
                                    >
                                        <span>Start 14-Day Free Trial</span>
                                        <ArrowRight size={14} />
                                    </Link>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
}
