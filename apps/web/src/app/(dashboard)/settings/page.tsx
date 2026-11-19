"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/settings/preferences");
    }, [router]);

    return (
        <div className="flex items-center justify-center p-12">
            <div className="w-5 h-5 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
