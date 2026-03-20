"use client";

import { use, useState, useEffect } from "react";
import { usePublicLocationRequest, useSubmitPublicLocation } from "@/hooks/api-hooks";
import { MapPin, Navigation, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function LocatePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const { data, isLoading, isError } = usePublicLocationRequest(token);
    const { mutate: submitLocation, isPending } = useSubmitPublicLocation(token);

    const [status, setStatus] = useState<"idle" | "requesting" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const getLocation = () => {
        setStatus("requesting");
        if (!navigator.geolocation) {
            setStatus("error");
            setErrorMessage("Geolocation is not supported by your browser");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                submitLocation(
                    { lat: position.coords.latitude, lng: position.coords.longitude },
                    {
                        onSuccess: () => setStatus("success"),
                        onError: () => {
                            setStatus("error");
                            setErrorMessage("Failed to save location. Please try again.");
                        }
                    }
                );
            },
            (error) => {
                setStatus("error");
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        setErrorMessage("You denied the request for Geolocation. We need this to ensure accurate deliveries.");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setErrorMessage("Location information is unavailable. Check your GPS settings.");
                        break;
                    case error.TIMEOUT:
                        setErrorMessage("The request to get user location timed out.");
                        break;
                    default:
                        setErrorMessage("An unknown error occurred.");
                        break;
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
                <div className="w-8 h-8 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (isError || !data?.valid) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--red)]/10 flex items-center justify-center mb-6">
                    <AlertTriangle size={32} className="text-[var(--red)]" />
                </div>
                <h1 className="text-xl font-bold mb-2 text-[var(--text-primary)]">Link Expired or Invalid</h1>
                <p className="text-[var(--text-muted)] max-w-sm">
                    {data?.reason || "This location request link is no longer valid. Please ask your distributor to send a new one."}
                </p>
            </div>
        );
    }

    if (status === "success") {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-full bg-[var(--green)]/15 flex items-center justify-center mb-6">
                    <CheckCircle2 size={40} className="text-[var(--green-bright)]" />
                </div>
                <h1 className="text-2xl font-bold mb-3 text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>Location Shared!</h1>
                <p className="text-[var(--text-muted)] max-w-sm">
                    Thank you, {data.customerName}. Your shop location has been securely sent to <b>{data.orgName}</b>. This will help us deliver to you faster!
                </p>
                <p className="text-xs text-[var(--text-muted)]/50 mt-12 flex items-center justify-center gap-1">
                    <ShieldCheck size={12} /> Powered securely by DistroAI
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col pt-12 p-6 max-w-md mx-auto">
            <div className="mb-10 text-center">
                <h2 className="text-sm font-semibold tracking-widest text-[var(--gold)] uppercase mb-2">Delivery Optimization</h2>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
                    Share Your Location
                </h1>
                <p className="text-[var(--text-muted)]">
                    <b>{data.orgName}</b> is requesting your exact shop location to improve delivery accuracy and speed.
                </p>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 mb-8 shadow-[var(--shadow-card)] text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-4 relative">
                    <MapPin size={32} className="text-[var(--gold)] relative z-10" />
                    {status === "requesting" && (
                        <div className="absolute inset-0 rounded-full border border-[var(--gold)]/30 animate-ping"></div>
                    )}
                </div>
                <h3 className="font-semibold mb-1">{data.customerName}</h3>
                <p className="text-xs text-[var(--text-muted)] flex items-center justify-center gap-1">
                    <Navigation size={12} /> GPS Precision Request
                </p>
            </div>

            {status === "error" && (
                <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--red)]/10 border border-[var(--red)]/20 text-sm text-[var(--red)] flex items-start gap-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <p>{errorMessage}</p>
                </div>
            )}

            <button
                onClick={getLocation}
                disabled={status === "requesting" || isPending}
                className="w-full bg-[var(--gold)] text-[var(--bg-primary)] h-14 rounded-[var(--radius-md)] font-bold text-lg hover:bg-[var(--gold-light)] transition shadow-lg shadow-[var(--gold)]/20 flex items-center justify-center gap-2 disabled:opacity-70"
            >
                {(status === "requesting" || isPending) ? (
                    <div className="w-5 h-5 border-2 border-[var(--bg-primary)] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <>
                        <Navigation size={20} />
                        Share Current Location
                    </>
                )}
            </button>
            <p className="text-xs text-center text-[var(--text-muted)] mt-4 px-4 leading-relaxed">
                By clicking this button, your browser will ask for permission to use your phone's GPS.
            </p>

            <div className="mt-auto pt-16 flex items-center justify-center gap-2 opacity-50">
                <ShieldCheck size={14} className="text-[var(--text-muted)]" />
                <span className="text-[10px] font-medium text-[var(--text-muted)] tracking-wider">SECURE LINK VIA DISTROAI</span>
            </div>
        </div>
    );
}
