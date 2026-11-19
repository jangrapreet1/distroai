"use client";

import { useState } from "react";
import { X, Truck, Loader2, Navigation, FileText, CheckCircle2 } from "lucide-react";
import apiClient from "@/lib/api-client";
import toast from "react-hot-toast";

interface EWayBillModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: number;
    customerName: string;
    customerCity?: string;
    onSuccess: (result: { ewayBillNo: string; validUpto: string }) => void;
}

export function EWayBillModal({
    isOpen,
    onClose,
    invoiceId,
    invoiceNumber,
    totalAmount,
    customerName,
    customerCity,
    onSuccess,
}: EWayBillModalProps) {
    const [vehicleNo, setVehicleNo] = useState("");
    const [transporterName, setTransporterName] = useState("");
    const [transporterId, setTransporterId] = useState("");
    const [distanceKm, setDistanceKm] = useState<number>(100);
    const [transportDocNo, setTransportDocNo] = useState("");
    const [transportMode, setTransportMode] = useState<string>("ROAD");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanVehicle = vehicleNo.trim().toUpperCase();
        if (!cleanVehicle) {
            toast.error("Please enter a valid vehicle number");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await apiClient.post(`/api/v1/invoices/${invoiceId}/e-waybill`, {
                vehicleNo: cleanVehicle,
                transporterName: transporterName.trim() || undefined,
                transporterId: transporterId.trim() || undefined,
                distanceKm: Number(distanceKm) || 100,
                transportDocNo: transportDocNo.trim() || undefined,
                transportMode,
            });

            const data = res.data?.data || res.data;
            toast.success(`e-Way Bill ${data.ewayBillNo} generated successfully!`);
            onSuccess(data);
            onClose();
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || "Failed to generate e-Way Bill";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--border-accent)] rounded-2xl shadow-2xl p-6 space-y-5"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
                        <Truck size={13} />
                        <span>Part A & Part B Generation</span>
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                        Generate e-Way Bill
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                        Invoice <span className="font-mono font-bold text-[var(--gold)]">{invoiceNumber}</span> • Consignee: {customerName}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-[var(--text-muted)] block mb-1 font-medium">
                                Vehicle Number <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. RJ14-GA-9988"
                                value={vehicleNo}
                                onChange={(e) => setVehicleNo(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-cyan-400 focus:outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-[var(--text-muted)] block mb-1 font-medium">
                                Approx Distance (KM) <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="number"
                                required
                                min={1}
                                max={5000}
                                value={distanceKm}
                                onChange={(e) => setDistanceKm(Number(e.target.value))}
                                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-cyan-400 focus:outline-none transition"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-[var(--text-muted)] block mb-1 font-medium">
                                Transporter Name
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. VRL Logistics / Local Truck"
                                value={transporterName}
                                onChange={(e) => setTransporterName(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-cyan-400 focus:outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-[var(--text-muted)] block mb-1 font-medium">
                                Transporter GSTIN (optional)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 08AAAAA0000A1Z5"
                                value={transporterId}
                                onChange={(e) => setTransporterId(e.target.value.toUpperCase())}
                                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-cyan-400 focus:outline-none transition"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-[var(--text-muted)] block mb-1 font-medium">
                                LR / Bilty Number (optional)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. LR-98214"
                                value={transportDocNo}
                                onChange={(e) => setTransportDocNo(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-cyan-400 focus:outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-[var(--text-muted)] block mb-1 font-medium">
                                Transport Mode
                            </label>
                            <select
                                value={transportMode}
                                onChange={(e) => setTransportMode(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-cyan-400 focus:outline-none transition"
                            >
                                <option value="ROAD">Road (Truck / Tempo / LCV)</option>
                                <option value="RAIL">Rail</option>
                                <option value="AIR">Air Cargo</option>
                                <option value="SHIP">Ship / Inland Waterways</option>
                            </select>
                        </div>
                    </div>

                    {/* Notice */}
                    <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-200 leading-relaxed">
                        Notice: As per Indian GST mandate, any inter-state or intra-state consignment exceeding ₹50,000 must carry a valid e-Way bill. Validity is 1 day per 200 km.
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50 transition shadow-md shadow-cyan-500/20"
                        >
                            {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Truck size={13} />}
                            <span>Generate e-Way Bill</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
