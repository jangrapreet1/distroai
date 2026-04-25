import { useState, useMemo } from "react";
import Link from "next/link";
import { LogOut, Settings, ArrowUpCircle, ChevronUp, Globe, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUpgradeStore } from "@/stores/upgrade.store";

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
    const { t, language, setLanguage } = useLanguage();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [showLanguages, setShowLanguages] = useState(false);
    const { openModal } = useUpgradeStore();

    const AVAILABLE_LANGUAGES = [
        { code: 'en', name: 'English' },
        { code: 'hi', name: 'हिंदी (Hindi)' },
        { code: 'ta', name: 'தமிழ் (Tamil)' },
        { code: 'te', name: 'తెలుగు (Telugu)' },
        { code: 'mr', name: 'मराठी (Marathi)' },
        { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
        { code: 'id', name: 'Bahasa Indonesia' },
    ];

    const filteredNav = getFilteredNav(userRole, navGroups);

    const allHrefs = useMemo(() =>
        filteredNav.flatMap(g => g.items.map(i => i.href)),
        [filteredNav]
    );

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        // Exact match always wins
        if (pathname === href) return true;
        // For prefix matching (e.g., /orders matches /orders/abc),
        // only allow if no OTHER nav item is a more specific match
        if (pathname.startsWith(href + "/")) {
            // Check if a more specific nav item exists that also matches
            const hasMoreSpecificItem = allHrefs.some(
                h => h !== href && h.startsWith(href + "/") && pathname.startsWith(h)
            );
            return !hasMoreSpecificItem;
        }
        return false;
    };

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
            <div className="relative px-4 py-4 border-t border-[var(--border)]">
                {isProfileMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
                        <div className="absolute bottom-full mb-2 left-4 right-4 bg-[var(--bg-secondary)] border border-[var(--border-accent)] rounded-lg shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                            <Link href="/settings" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors">
                                <Settings size={16} /> Settings
                            </Link>

                            <button onClick={() => setShowLanguages(!showLanguages)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors">
                                <div className="flex items-center gap-2"><Globe size={16} /> Language</div>
                                <ChevronRight size={14} className={`transition-transform duration-200 ${showLanguages ? "rotate-90" : ""}`} />
                            </button>

                            {showLanguages && (
                                <div className="px-3 py-1 space-y-0.5 bg-[var(--bg-secondary)]/30 border-y border-[var(--border)] max-h-32 overflow-y-auto">
                                    {AVAILABLE_LANGUAGES.map(l => (
                                        <button
                                            key={l.code}
                                            onClick={() => { setLanguage(l.code); setIsProfileMenuOpen(false); setShowLanguages(false); }}
                                            className={`w-full text-left text-xs py-1.5 px-3 rounded-md transition-colors ${language === l.code ? "bg-[var(--gold)]/15 text-[var(--gold)] font-medium" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"}`}
                                        >
                                            {l.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <button onClick={() => { setIsProfileMenuOpen(false); openModal('premium features'); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors">
                                <ArrowUpCircle size={16} /> Upgrade plan
                            </button>
                            <div className="h-px bg-[var(--border)] my-1 mx-2" />
                            <button onClick={() => { setIsProfileMenuOpen(false); onLogout(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <LogOut size={16} /> Log out
                            </button>
                        </div>
                    </>
                )}

                <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="w-full flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors text-left"
                >
                    <div className="w-9 h-9 rounded-full bg-[var(--gold)]/15 flex items-center justify-center text-sm font-semibold text-[var(--gold)] shrink-0">
                        {userName?.[0] ?? "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{userName ?? "User"}</p>
                        <p className="text-xs text-[var(--text-muted)] capitalize">{userRole?.toLowerCase() ?? "viewer"}</p>
                    </div>
                    <ChevronUp size={16} className={`text-[var(--text-muted)] shrink-0 transition-transform duration-200 ${isProfileMenuOpen ? "rotate-180" : ""}`} />
                </button>
            </div>
        </>
    );
}
