"use client";

import Link from "next/link";
import { Building2, CreditCard, Bell, Plug, Receipt, Users, Shield, MapPin, Globe, Store } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const CATEGORIES = [
    {
        title: "Organization",
        items: [
            { label: "Profile & Branding", desc: "Manage business info, logo, and smart GST autofill", icon: Building2, href: "/settings/org" },
            { label: "Locations", desc: "Manage warehouses, godowns, and branch addresses", icon: MapPin, href: "/settings/locations" },
            { label: "Users & Roles", desc: "Invite team members and configure access levels", icon: Users, href: "/settings/team" },
        ]
    },
    {
        title: "Sales & Portal",
        items: [
            { label: "Customer Portal", desc: "Configure your B2B storefront and custom domain", icon: Store, href: "/settings/portal" },
        ]
    },
    {
        title: "Compliance & Finance",
        items: [
            { label: "Taxes & Compliance", desc: "GST tracking, invoice prefixes, bank details, and export tools", icon: Shield, href: "/settings/gst" },
            { label: "Billing & Plans", desc: "View your subscription, compare plans, and manage billing", icon: CreditCard, href: "/settings/billing" },
        ]
    },
    {
        title: "Integrations & Platform",
        items: [
            { label: "Integrations & Apps", desc: "Connect WhatsApp, Razorpay, or Tally Bridge", icon: Plug, href: "/settings/preferences#integrations" },
            { label: "Notifications", desc: "Set up WhatsApp alerts and payment reminders", icon: Bell, href: "/settings/preferences#notifications" },
            { label: "Language", desc: "Change your default application language", icon: Globe, href: "/settings/preferences#language" },
        ]
    }
];

export default function SettingsCommandCenter() {
    const { t } = useLanguage();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both max-w-6xl mx-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                    <h1 className="text-3xl font-bold font-[var(--font-playfair)]">{t('settings') ?? "All Settings"}</h1>
                    <p className="text-sm text-[var(--text-muted)] mt-1">Manage your DistroAI organization, features, and preferences.</p>
                </div>
            </div>

            <div className="space-y-10">
                {CATEGORIES.map((category) => (
                    <div key={category.title}>
                        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">{category.title}</h2>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {category.items.map((item) => (
                                <Link key={item.label} href={item.href} className="group block h-full">
                                    <div className="bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--gold)]/40 hover:bg-[var(--bg-card-hover)] rounded-[var(--radius-lg)] p-5 h-full transition flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-muted)] group-hover:bg-[var(--gold)]/10 group-hover:text-[var(--gold)] transition shrink-0">
                                            <item.icon size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--gold)] transition mb-1 text-sm">{item.label}</h3>
                                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
