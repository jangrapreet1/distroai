"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, ShoppingCart, User, LayoutGrid } from "lucide-react";
import { usePortalOrgId, usePortalCart, usePortalAuth } from "@/contexts/portal-context";

export function PortalBottomNav() {
    const orgId = usePortalOrgId();
    const cart = usePortalCart();
    const auth = usePortalAuth();
    const pathname = usePathname();
    const itemCount = cart.getItemCount();

    const links = [
        { href: `/p/${orgId}`, label: "Catalog", icon: LayoutGrid },
        { href: `/p/${orgId}/cart`, label: "Cart", icon: ShoppingCart, badge: itemCount },
        ...(auth.isAuthenticated
            ? [
                { href: `/p/${orgId}/account/orders`, label: "Orders", icon: ShoppingBag },
                { href: `/p/${orgId}/account`, label: "Account", icon: User },
            ]
            : []),
    ];

    return (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-[#222] safe-area-pb">
            <div className="flex items-center justify-around h-16">
                {links.map((link) => {
                    const isActive = pathname === link.href || (link.href !== `/p/${orgId}` && pathname.startsWith(link.href));
                    const Icon = link.icon;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex flex-col items-center gap-1 px-3 py-1 relative transition-colors ${isActive ? "text-[var(--gold)]" : "text-zinc-500 hover:text-zinc-300"}`}
                        >
                            <div className="relative">
                                <Icon className="w-5 h-5" />
                                {(link.badge ?? 0) > 0 && (
                                    <span className="absolute -top-1 -right-2 w-4 h-4 bg-[var(--gold)] text-black text-[9px] font-bold flex items-center justify-center rounded-full">
                                        {(link.badge ?? 0) > 9 ? "9+" : link.badge}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-medium">{link.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
