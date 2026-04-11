"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, Bell, Plug, Shield, MapPin, Globe, Store, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const CATEGORIES = [
    {
        title: "Organization",
        items: [
            { label: "Profile & Branding", icon: Building2, href: "/settings/org" },
            { label: "Locations", icon: MapPin, href: "/settings/locations" },
            { label: "Users & Roles", icon: Users, href: "/settings/team" },
        ]
    },
    {
        title: "Sales & Portal",
        items: [
            { label: "Customer Portal", icon: Store, href: "/settings/portal" },
        ]
    },
    {
        title: "Compliance & Finance",
        items: [
            { label: "Taxes & Compliance", icon: Shield, href: "/settings/gst" },
            { label: "Billing & Plans", icon: CreditCard, href: "/settings/billing" },
        ]
    },
    {
        title: "System & Preferences",
        items: [
            { label: "Integrations & Apps", icon: Plug, href: "/settings/preferences" },
        ]
    }
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { t } = useLanguage();

    return (
        <div className="flex flex-col md:flex-row h-full gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both max-w-7xl mx-auto">
            {/* Settings Sidebar */}
            <div className="w-full md:w-64 shrink-0 space-y-8">
                <div>
                    <h1 className="text-2xl font-bold font-[var(--font-playfair)] mb-1">{t('settings') ?? "Settings"}</h1>
                    <p className="text-xs text-[var(--text-muted)]">Configuration & Preferences</p>
                </div>

                <div className="space-y-6">
                    {CATEGORIES.map((category) => (
                        <div key={category.title}>
                            <h2 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-3">{category.title}</h2>
                            <div className="space-y-1">
                                {category.items.map((item) => {
                                    // Make sure sub-hashes or exact paths match for highlighting
                                    // We check if pathname exactly matches or starts with the href if href isn't just /settings
                                    const isActive = pathname === item.href || (item.href !== '/settings' && pathname.startsWith(item.href));
                                    return (
                                        <Link key={item.label} href={item.href} className={`
                                            flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium
                                            ${isActive ? "bg-[var(--gold)]/10 text-[var(--gold)] relative" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"}
                                        `}>
                                            {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 bg-[var(--gold)] rounded-r-md shadow-[0_0_8px_var(--gold)]" />}
                                            <item.icon size={16} className={isActive ? "text-[var(--gold)]" : "text-[var(--text-muted)]"} />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Settings Content Pane */}
            <div className="flex-1 min-w-0 pb-12">
                {children}
            </div>
        </div>
    );
}
