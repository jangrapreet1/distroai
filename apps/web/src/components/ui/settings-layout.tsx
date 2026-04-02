"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function SettingsLayout({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
            <div className="flex items-center gap-4 border-b border-[var(--border)] pb-4">
                <Link href="/settings" className="p-2 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold font-[var(--font-playfair)]">{title}</h1>
                    {description && <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>}
                </div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 shadow-sm">
                {children}
            </div>
        </div>
    );
}
