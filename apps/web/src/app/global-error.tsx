"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Fatal global error:", error);

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
                            Application Update Available
                        </h1>
                        <p style={{ fontSize: "14px", color: "#8B8B9E", margin: "0 0 24px 0", lineHeight: "1.5" }}>
                            A new version of DistroAI has been deployed. Please reload the app to get the latest features.
                        </p>

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
                                Reload DistroAI
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
