"use client";



export function SettingsLayout({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="border-b border-[var(--border)] pb-4">
                <h2 className="text-xl font-bold font-[var(--font-playfair)] tracking-wide">{title}</h2>
                {description && <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>}
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 md:p-8 shadow-sm">
                {children}
            </div>
        </div>
    );
}
