"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        console.error("App error caught by ErrorBoundary:", error);

        // Auto-recover once on chunk failure
        try {
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
        } catch {
            // Guard against sessionStorage failure in private browsing
        }
    }, [error]);

    const handleHardReload = async () => {
        try {
            sessionStorage.removeItem("chunk_reload_attempted");
        } catch {}

        if (typeof window !== "undefined") {
            try {
                if ("caches" in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                }
            } catch {}
            try {
                if ("serviceWorker" in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map((r) => r.unregister()));
                }
            } catch {}
            window.location.href = window.location.pathname + "?t=" + Date.now();
        }
    };

    return (
        <div className="min-h-screen bg-[#07070E] text-[#EDEDEF] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-[#0F0F1A] border border-[#222238] rounded-xl p-8 text-center shadow-2xl">
                <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-[#C6A75E]/10 flex items-center justify-center text-[#C6A75E]">
                    <AlertTriangle size={28} />
                </div>

                <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
                <p className="text-sm text-[#8B8B9E] mb-4">
                    A temporary error occurred while rendering the page. This is usually due to a new version update.
                </p>

                {/* Technical error display so we can identify exact root cause */}
                <div className="mb-6 text-left bg-black/50 border border-red-500/20 rounded-lg p-3">
                    <p className="text-xs font-mono text-red-400 font-semibold break-words">
                        {error?.name || "Error"}: {error?.message || "Render exception"}
                    </p>
                    {error?.digest && (
                        <p className="text-[10px] font-mono text-gray-500 mt-1">
                            Digest: {error.digest}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-[10px] text-gray-400 hover:text-gray-200 mt-2 flex items-center gap-1 cursor-pointer"
                    >
                        {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {showDetails ? "Hide stack trace" : "Show stack trace"}
                    </button>
                    {showDetails && error?.stack && (
                        <pre className="text-[10px] font-mono text-gray-400 mt-2 max-h-40 overflow-auto whitespace-pre-wrap">
                            {error.stack}
                        </pre>
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleHardReload}
                        className="w-full py-3 px-4 rounded-lg bg-[#C6A75E] text-black font-semibold hover:bg-[#DFBE76] transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                        <RefreshCw size={16} />
                        Reload Application
                    </button>

                    <button
                        onClick={() => reset()}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#151524] border border-[#222238] text-sm text-[#8B8B9E] hover:text-white transition cursor-pointer"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}
