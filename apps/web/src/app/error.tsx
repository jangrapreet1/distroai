"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error
        console.error("App error caught by ErrorBoundary:", error);

        // Handle chunk loading failure across deployments (auto-recover once)
        const isChunkError =
            error.name === "ChunkLoadError" ||
            error.message?.includes("Loading chunk") ||
            error.message?.includes("failed to fetch dynamically imported module");

        if (isChunkError && typeof window !== "undefined") {
            const hasReloaded = sessionStorage.getItem("chunk_reload_attempted");
            if (!hasReloaded) {
                sessionStorage.setItem("chunk_reload_attempted", "true");
                window.location.reload();
            }
        }
    }, [error]);

    const handleHardReload = () => {
        if (typeof window !== "undefined") {
            sessionStorage.removeItem("chunk_reload_attempted");
            if ("caches" in window) {
                caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
            }
            window.location.href = window.location.pathname + "?t=" + Date.now();
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary,#07070E)] text-[var(--text-primary,#EDEDEF)] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-[var(--bg-secondary,#0F0F1A)] border border-[var(--border,#222238)] rounded-xl p-8 text-center shadow-2xl">
                <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-[var(--gold,#C6A75E)]/10 flex items-center justify-center text-[var(--gold,#C6A75E)]">
                    <AlertTriangle size={28} />
                </div>

                <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
                <p className="text-sm text-[var(--text-secondary,#8B8B9E)] mb-6">
                    A temporary error occurred while rendering the page. This is usually due to a new version update.
                </p>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleHardReload}
                        className="w-full py-3 px-4 rounded-lg bg-[var(--gold,#C6A75E)] text-black font-semibold hover:bg-[var(--gold-light,#DFBE76)] transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <RefreshCw size={16} />
                        Reload Application
                    </button>

                    <button
                        onClick={() => reset()}
                        className="w-full py-2.5 px-4 rounded-lg bg-[var(--bg-card,#151524)] border border-[var(--border,#222238)] text-sm text-[var(--text-secondary,#8B8B9E)] hover:text-white transition cursor-pointer"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}
