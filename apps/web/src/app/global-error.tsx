"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        console.error("Fatal global error:", error);

        try {
            // Auto-recover once on chunk failure
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
        } catch {}
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
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    padding: 0,
                    backgroundColor: "#07070E",
                    color: "#EDEDEF",
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
                }}
            >
                <div
                    style={{
                        minHeight: "100vh",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "24px",
                    }}
                >
                    <div
                        style={{
                            maxWidth: "420px",
                            width: "100%",
                            backgroundColor: "#0F0F1A",
                            border: "1px solid #222238",
                            borderRadius: "12px",
                            padding: "32px",
                            textAlign: "center",
                            boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                        }}
                    >
                        <div
                            style={{
                                width: "56px",
                                height: "56px",
                                margin: "0 auto 20px auto",
                                borderRadius: "50%",
                                backgroundColor: "rgba(198, 167, 94, 0.1)",
                                color: "#C6A75E",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <AlertTriangle size={28} />
                        </div>

                        <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 8px 0" }}>
                            Something went wrong
                        </h1>
                        <p style={{ fontSize: "14px", color: "#8B8B9E", margin: "0 0 20px 0", lineHeight: "1.5" }}>
                            A temporary error occurred while rendering the page. This is usually due to a new version update.
                        </p>

                        <div style={{ marginBottom: "20px", textAlign: "left", backgroundColor: "rgba(0,0,0,0.5)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", padding: "12px" }}>
                            <p style={{ fontSize: "12px", fontFamily: "monospace", color: "#F87171", fontWeight: "600", margin: "0 0 4px 0", wordBreak: "break-all" }}>
                                {error?.name || "Error"}: {error?.message || "Render exception"}
                            </p>
                            {error?.digest && (
                                <p style={{ fontSize: "10px", fontFamily: "monospace", color: "#6B7280", margin: "0" }}>
                                    Digest: {error.digest}
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowDetails(!showDetails)}
                                style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", padding: "4px 0 0 0" }}
                            >
                                {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {showDetails ? "Hide stack trace" : "Show stack trace"}
                            </button>
                            {showDetails && error?.stack && (
                                <pre style={{ fontSize: "10px", fontFamily: "monospace", color: "#9CA3AF", margin: "8px 0 0 0", maxHeight: "140px", overflow: "auto", whiteSpace: "pre-wrap" }}>
                                    {error.stack}
                                </pre>
                            )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <button
                                onClick={handleHardReload}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    borderRadius: "8px",
                                    backgroundColor: "#C6A75E",
                                    color: "#07070E",
                                    fontWeight: "600",
                                    border: "none",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    fontSize: "14px",
                                }}
                            >
                                <RefreshCw size={16} />
                                Reload Application
                            </button>

                            <button
                                onClick={() => reset()}
                                style={{
                                    width: "100%",
                                    padding: "10px 16px",
                                    borderRadius: "8px",
                                    backgroundColor: "#151524",
                                    color: "#8B8B9E",
                                    border: "1px solid #222238",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                }}
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
