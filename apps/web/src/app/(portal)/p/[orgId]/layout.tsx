"use client";

import { use, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalProvider, portalApi } from "@/contexts/portal-context";
import { PortalHeader } from "./components/portal-header";
import { PortalBottomNav } from "./components/portal-bottom-nav";
import { Loader2 } from "lucide-react";

export default function PortalOrgLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ orgId: string }> | { orgId: string };
}) {
    const resolvedParams = params as any;
    const orgIdOrSlug = resolvedParams.then
        ? use(resolvedParams as Promise<{ orgId: string }>).orgId
        : resolvedParams.orgId;

    // We fetch the storefront info here, OUTSIDE the provider, 
    // because we need to resolve the real orgId (CUID) before setting up stores.
    const { data: storeInfo, isLoading, error } = useQuery({
        queryKey: ["portal-store", orgIdOrSlug],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgIdOrSlug}/storefront`),
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" />
            </div>
        );
    }

    if (error || !storeInfo) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500">
                Storefront not found
            </div>
        );
    }

    // Use the real resolved ID for the rest of the app
    const realOrgId = storeInfo.id;

    return (
        <PortalProvider orgId={realOrgId} businessType={storeInfo.businessType ?? null}>
            <div className="min-h-screen bg-[#000000] text-[#f4f4f5] antialiased flex flex-col font-sans">
                <PortalHeader storeInfo={storeInfo} />
                <main className="flex-1 pb-20 md:pb-0">{children}</main>
                <PortalBottomNav />
            </div>
        </PortalProvider>
    );
}
