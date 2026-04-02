"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/contexts/LanguageContext";

interface NavItem { label: string; href: string; icon: React.ElementType; roles?: string[] }
interface NavGroup { title: string; items: NavItem[]; roles?: string[] }

export { type NavItem, type NavGroup };

export function getFilteredNav(role: string, navGroups: NavGroup[]): NavGroup[] {
    return navGroups
        .filter(g => !g.roles || g.roles.includes(role))
        .map(g => ({
            ...g,
            items: g.items.filter(i => !i.roles || i.roles.includes(role)),
        }))
        .filter(g => g.items.length > 0);
}

interface SidebarProps {
    navGroups: NavGroup[];
    userRole: string;
    userName?: string;
    orgName?: string;
    orgPlan?: string;
    pathname: string;
    onNavClick?: () => void;
    onLogout: () => void;
}

export function SidebarContent({ navGroups, userRole, userName, orgName, orgPlan, pathname, onNavClick, onLogout }: SidebarProps) {
    const { t } = useLanguage();

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    const filteredNav = getFilteredNav(userRole, navGroups);

    return (
        <>
            {/* Logo */}
            <div className="px-5 pt-6 pb-4 border-b border-[var(--border)]">
                <Logo className="w-8 h-8" textCls="text-xl" />
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-[var(--text-secondary)] truncate">{orgName ?? "My Organization"}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] font-medium uppercase">
                        {orgPlan ?? "FREE"}
                    </span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
                {filteredNav.map((group) => (
                    <div key={group.title} className="mb-5">
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider px-3 mb-2 uppercase">{t(group.title as any)}</p>
                        {group.items.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onNavClick}
                                    className={clsx(
                                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all mb-0.5",
                                        active
                                            ? "bg-[var(--gold)]/8 text-[var(--gold)] border-l-2 border-[var(--gold)]"
                                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                                    )}
                                >
                                    <item.icon size={18} />
                                    {t(item.label)}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* User */}
            <div className="px-4 py-4 border-t border-[var(--border)]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--gold)]/15 flex items-center justify-center text-sm font-semibold text-[var(--gold)]">
                        {userName?.[0] ?? "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{userName ?? "User"}</p>
                        <p className="text-xs text-[var(--text-muted)] capitalize">{userRole?.toLowerCase() ?? "viewer"}</p>
                    </div>
                    <button onClick={onLogout} className="text-[var(--text-muted)] hover:text-[var(--red)] transition" title="Logout">
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </>
    );
}
