"use client";

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Tesseract from 'tesseract.js';
import { db, ProductOffline } from '@/lib/offline-db';
import { Camera, RefreshCw, X, Box, ScanLine } from 'lucide-react';
import clsx from 'clsx';

interface OfflineScannerProps {
    onClose: () => void;
}

export function OfflineScanner({ onClose }: OfflineScannerProps) {
    const [scannedProduct, setScannedProduct] = useState<ProductOffline | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const [ocrMode, setOcrMode] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Auto-search local DB
    const lookupProduct = async (query: string) => {
        try {
            // exact match by sku
            let product = await db.products.where('sku').equalsIgnoreCase(query).first();

            if (!product) {
                // partial match by name
                const productsArray = await db.products.toArray();
                product = productsArray.find(p => p.name.toLowerCase().includes(query.toLowerCase()));
            }

            if (product) {
                setScannedProduct(product);
                setIsScanning(false);
                if (scannerRef.current?.isScanning) {
                    await scannerRef.current.pause();
                }
            }
        } catch (error) {
            console.error('Local DB lookup failed', error);
        }
    };

    // Initialize Barcode Reader
    useEffect(() => {
        const startScanner = async () => {
            if (!document.getElementById('reader')) return;

            try {
                scannerRef.current = new Html5Qrcode("reader", {
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                    ],
                    verbose: false
                });
                await scannerRef.current.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 }
                    },
                    (decodedText) => {
                        if (isScanning && !ocrMode) {
                            lookupProduct(decodedText);
                        }
                    },
                    (errorMessage) => {
                        // ignore background scan errors
                    }
                );
            } catch (err) {
                console.error("Error starting scanner", err);
            }
        };

        startScanner();

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(console.error);
            }
        };
    }, []);

    // Perform OCR fallback
    const runOcrFallback = async () => {
        if (!scannerRef.current) return;
        setOcrMode(true);
        setOcrProgress(10);
        try {
            // Get current frame
            const videoElement = document.querySelector('#reader video') as HTMLVideoElement;
            if (!videoElement) {
                setOcrMode(false);
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(videoElement, 0, 0);

            const worker = await Tesseract.createWorker('eng', 1, {
                logger: (m: any) => {
                    if (m.status === 'recognizing text') {
                        setOcrProgress(Math.round(m.progress * 100));
                    }
                }
            });
            const { data: { text } } = await worker.recognize(canvas);
            await worker.terminate();

            // Clean up text and try to match largest words
            const words = text.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
            let found = false;
            for (const word of words) {
                const product = await db.products.where('sku').equalsIgnoreCase(word).first();
                if (product) {
                    setScannedProduct(product);
                    setIsScanning(false);
                    found = true;
                    break;
                }
            }

            if (!found) {
                alert("No product recognized from text. Please try again or use Barcode.");
            }

        } catch (error) {
            console.error('OCR failed', error);
        } finally {
            setOcrMode(false);
            setOcrProgress(0);
        }
    };

    const resumeScanning = async () => {
        setScannedProduct(null);
        setIsScanning(true);
        setOcrMode(false);
        if (scannerRef.current) {
            await scannerRef.current.resume();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center font-sans tracking-tight">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-2 text-white">
                    <ScanLine size={24} className="text-[var(--gold)]" />
                    <span className="font-semibold text-lg">Offline Scanner</span>
                </div>
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition backdrop-blur">
                    <X size={24} />
                </button>
            </div>

            {/* Camera Viewport */}
            <div className="relative w-full h-full max-h-screen overflow-hidden flex items-center justify-center bg-gray-900">
                <div id="reader" className="w-full h-full object-cover"></div>

                {/* Aiming Reticle overlay */}
                {isScanning && !ocrMode && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-64 h-64 border-2 border-white/50 rounded-xl relative">
                            {/* Corner accents */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[var(--gold)] rounded-tl-xl -mt-0.5 -ml-0.5"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[var(--gold)] rounded-tr-xl -mt-0.5 -mr-0.5"></div>
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[var(--gold)] rounded-bl-xl -mb-0.5 -ml-0.5"></div>
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[var(--gold)] rounded-br-xl -mb-0.5 -mr-0.5"></div>
                        </div>
                    </div>
                )}

                {/* OCR Loading Overlay */}
                {ocrMode && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                        <RefreshCw size={48} className="text-[var(--gold)] animate-spin mb-4" />
                        <p className="text-white font-medium">Reading Text... {ocrProgress}%</p>
                    </div>
                )}

                {/* Product Card Overlay */}
                {scannedProduct && (
                    <div className="absolute bottom-0 left-0 right-0 p-6 z-30 animate-in slide-in-from-bottom">
                        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-2xl p-5 relative overflow-hidden">
                            {/* Decorative background blur */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--gold)]/10 rounded-full blur-2xl"></div>

                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Box size={16} className="text-[var(--gold)]" />
                                        <span className="text-xs font-bold tracking-widest text-[var(--text-muted)] uppercase">
                                            {scannedProduct.brand || 'Local Database'}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                                        {scannedProduct.name}
                                    </h3>
                                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                                        SKU: {scannedProduct.sku}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black text-[var(--gold)]">₹{scannedProduct.sellingPrice}</p>
                                    <p className="text-xs text-[var(--text-muted)] line-through">MRP ₹{scannedProduct.mrp}</p>
                                </div>
                            </div>

                            <div className="bg-[var(--bg-secondary)] rounded-xl py-3 px-4 mb-4 border border-[var(--border)]">
                                <p className="text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase">Local Stock (Last Sync)</p>
                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                    {scannedProduct.stockInfo}
                                </p>
                            </div>

                            <button
                                onClick={resumeScanning}
                                className="w-full font-semibold py-3.5 rounded-xl bg-white text-black hover:bg-gray-100 transition active:scale-[0.98]"
                            >
                                Tap to Scan Again
                            </button>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {!scannedProduct && isScanning && (
                    <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
                        <button
                            onClick={runOcrFallback}
                            className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-full hover:bg-white/20 transition font-medium"
                        >
                            <Camera size={18} />
                            Read Text (OCR)
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
