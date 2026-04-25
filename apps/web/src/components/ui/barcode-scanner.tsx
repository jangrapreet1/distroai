"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, X, ScanLine, Loader2 } from "lucide-react";

interface BarcodeScannerProps {
    onScan: (barcode: string) => void;
    onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const streamRef = useRef<MediaStream | null>(null);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        async function startCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
                });
                if (!mounted) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    setIsLoading(false);
                    startScanning();
                }
            } catch (err) {
                if (mounted) {
                    setError("Camera access denied. Please allow camera permissions to scan barcodes.");
                    setIsLoading(false);
                }
            }
        }

        startCamera();

        return () => {
            mounted = false;
            stopCamera();
        };
    }, [stopCamera]);

    const startScanning = () => {
        // Use BarcodeDetector API if available (Chrome 83+, Edge, Opera)
        if ("BarcodeDetector" in window) {
            const detector = new (window as any).BarcodeDetector({
                formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
            });

            const scan = async () => {
                if (!videoRef.current || !streamRef.current) return;
                try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes.length > 0) {
                        const code = barcodes[0].rawValue;
                        if (code) {
                            stopCamera();
                            onScan(code);
                            return;
                        }
                    }
                } catch {
                    // Ignore detection errors, keep scanning
                }
                if (streamRef.current) requestAnimationFrame(scan);
            };

            requestAnimationFrame(scan);
        } else {
            setError("Barcode scanning is not supported in this browser. Please use Chrome, Edge, or Opera.");
        }
    };

    const handleClose = () => {
        stopCamera();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-lg mx-4 bg-[var(--bg-primary)] rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2">
                        <Camera size={18} className="text-[var(--gold)]" />
                        <h3 className="font-semibold text-sm">Scan Barcode</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-card-hover)] transition"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Camera viewport */}
                <div className="relative aspect-[4/3] bg-black">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)]">
                            <Loader2 size={32} className="animate-spin mb-3" />
                            <p className="text-sm">Starting camera...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)] p-6 text-center">
                            <Camera size={40} className="mb-3 opacity-30" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                        muted
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scanning overlay */}
                    {!error && !isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-3/4 h-1/2 border-2 border-[var(--gold)]/50 rounded-lg relative">
                                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[var(--gold)] animate-pulse" />
                                {/* Corner markers */}
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[var(--gold)]" />
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[var(--gold)]" />
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[var(--gold)]" />
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[var(--gold)]" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 text-center">
                    <p className="text-xs text-[var(--text-muted)]">
                        Point the camera at a barcode or QR code to scan
                    </p>
                </div>
            </div>
        </div>
    );
}
