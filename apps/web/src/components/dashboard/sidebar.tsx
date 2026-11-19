import { useState, useMemo } from "react";
import Link from "next/link";
import { LogOut, Settings, ArrowUpCircle, ChevronUp, Globe, ChevronRight, SlidersHorizontal } from "lucide-react";
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
        if (href === "/dashboard") return pathname === "/dashboard";
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
                <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--text-secondary)] truncate">{orgName ?? "My Organization"}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold tracking-wide uppercase">
                        {orgPlan ?? "FREE"}
                    </span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
                {filteredNav.map((group) => (
                    <div key={group.title}>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 tracking-wider px-3 mb-1.5 uppercase">
                            {t(group.title as any)}
                        </p>
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onNavClick}
                                        className={clsx(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                                            active
                                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                                                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                                        )}
                                    >
                                        <item.icon size={17} className={clsx("shrink-0", active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-zinc-500")} />
                                        <span>{t(item.label)}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* User */}
            <div className="relative px-3 py-3 border-t border-[var(--border)]">
                {isProfileMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
                        <div className="absolute bottom-full mb-2 left-3 right-3 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl py-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                            <Link href="/settings/preferences" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                                <SlidersHorizontal size={14} className="text-blue-500" /> Preferences & Defaults
                            </Link>

                            <Link href="/settings" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                                <Settings size={14} /> All Settings
                            </Link>

                            <button onClick={() => setShowLanguages(!showLanguages)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                                <div className="flex items-center gap-2"><Globe size={14} /> Language</div>
                                <ChevronRight size={14} className={`transition-transform duration-200 ${showLanguages ? "rotate-90" : ""}`} />
                            </button>

                            {showLanguages && (
                                <div className="px-2 py-1 space-y-0.5 bg-slate-50 dark:bg-zinc-900 border-y border-slate-100 dark:border-zinc-800 max-h-32 overflow-y-auto">
                                    {AVAILABLE_LANGUAGES.map(l => (
                                        <button
                                            key={l.code}
                                            onClick={() => { setLanguage(l.code); setIsProfileMenuOpen(false); setShowLanguages(false); }}
                                            className={`w-full text-left text-xs py-1 px-2 rounded-md transition-colors ${language === l.code ? "bg-blue-500/10 text-blue-600 font-semibold" : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"}`}
                                        >
                                            {l.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <button onClick={() => { setIsProfileMenuOpen(false); openModal('premium features'); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                                <ArrowUpCircle size={14} className="text-amber-500" /> Upgrade plan
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-zinc-800 my-1 mx-2" />
                            <button onClick={() => { setIsProfileMenuOpen(false); onLogout(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                <LogOut size={14} /> Log out
                            </button>
                        </div>
                    </>
                )}

                <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors text-left"
                >
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                        {(userName?.[0] || "U").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{userName ?? "User"}</p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 capitalize">{userRole?.toLowerCase() ?? "viewer"}</p>
                    </div>
                    <ChevronUp size={14} className={`text-slate-400 dark:text-zinc-500 shrink-0 transition-transform duration-200 ${isProfileMenuOpen ? "rotate-180" : ""}`} />
                </button>
            </div>
        </>
    );
}
