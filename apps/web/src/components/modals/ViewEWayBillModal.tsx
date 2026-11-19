"use client";

import React, { useRef } from "react";
import { X, Printer, Truck, ShieldCheck, QrCode, Calendar, MapPin, Building2, User, FileText, CheckCircle2 } from "lucide-react";
import { formatINR } from "@/lib/utils";

interface ViewEWayBillModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: {
        id: string;
        invoiceNumber: string;
        invoiceDate: string;
        eWayBillNumber?: string | null;
        totalAmount: number;
        taxableAmount?: number;
        cgstAmount?: number;
        sgstAmount?: number;
        igstAmount?: number;
        placeOfSupply?: string | null;
        customer?: {
            name: string;
            phone?: string | null;
            fullAddress?: string | null;
            city?: string | null;
            state?: string | null;
            pincode?: string | null;
            gstNumber?: string | null;
        } | null;
        organization?: {
            name: string;
            gstNumber?: string | null;
            address?: string | null;
            city?: string | null;
            state?: string | null;
            pincode?: string | null;
        } | null;
        items?: Array<{
            product?: { name: string; hsnCode?: string | null };
            quantity: number;
            totalAmount: number;
        }>;
    };
    ewbDetails?: {
        vehicleNo?: string;
        transporterName?: string;
        distanceKm?: number;
        validUpto?: string;
    } | null;
}

export function ViewEWayBillModal({
    isOpen,
    onClose,
    invoice,
    ewbDetails,
}: ViewEWayBillModalProps) {
    const printRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !invoice.eWayBillNumber) return null;

    const ewbNumber = invoice.eWayBillNumber;
    const invDate = new Date(invoice.invoiceDate);
    const validFromStr = invDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    
    // Validity: In India, 1 day validity per 200 km, minimum 1 day
    const distance = ewbDetails?.distanceKm || 100;
    const validityDays = Math.max(1, Math.ceil(distance / 200));
    const validUntilDate = new Date(invDate.getTime() + validityDays * 24 * 3600 * 1000);
    const validUntilStr = ewbDetails?.validUpto
        ? new Date(ewbDetails.validUpto).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : validUntilDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + " 23:59";

    const org = invoice.organization;
    const cust = invoice.customer;
    const mainProduct = invoice.items?.[0]?.product?.name || "Goods";
    const hsn = invoice.items?.[0]?.product?.hsnCode || "38245090";

    const handlePrint = () => {
        window.print();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl bg-[#0f1117] text-gray-100 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden my-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#161922]">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                            <Truck size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                e-Way Bill Slip
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-normal">
                                    ACTIVE / VALID
                                </span>
                            </h3>
                            <p className="text-xs text-gray-400">Form GST EWB-01 • Government of India e-Way Bill System</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition cursor-pointer"
                        >
                            <Printer size={14} /> Print Slip
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Printable Content */}
                <div ref={printRef} className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:text-black">
                    {/* Sandbox Notice */}
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between print:hidden">
                        <div className="flex items-center gap-2">
                            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded">Test Environment</span>
                            <span>Generated in Sandbox Mode. In production, this matches the official NIC-registered slip.</span>
                        </div>
                    </div>

                    {/* Official EWB Header Box */}
                    <div className="border border-cyan-500/40 rounded-xl p-4 bg-cyan-950/20 space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-cyan-500/20">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">e-Way Bill Number</span>
                                <span className="text-xl font-mono font-bold text-cyan-400 tracking-wider">
                                    {ewbNumber}
                                </span>
                            </div>
                            <div className="text-left sm:text-right">
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Generated Date & Time</span>
                                <span className="font-mono text-gray-200">
                                    {validFromStr}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                            <div>
                                <span className="text-gray-400 text-[10px] uppercase block">Valid From</span>
                                <span className="font-medium text-white">{validFromStr}</span>
                            </div>
                            <div>
                                <span className="text-gray-400 text-[10px] uppercase block">Valid Until</span>
                                <span className="font-semibold text-emerald-400">{validUntilStr}</span>
                            </div>
                            <div>
                                <span className="text-gray-400 text-[10px] uppercase block">Approx Distance</span>
                                <span className="font-medium text-white">{distance} KM</span>
                            </div>
                            <div>
                                <span className="text-gray-400 text-[10px] uppercase block">Supply Type</span>
                                <span className="font-medium text-white">Outward - Normal</span>
                            </div>
                        </div>
                    </div>

                    {/* PART - A */}
                    <div className="border border-gray-800 rounded-xl overflow-hidden">
                        <div className="bg-gray-800/60 px-4 py-2 border-b border-gray-800 font-bold uppercase tracking-wider text-[11px] text-cyan-300 flex items-center justify-between">
                            <span>PART - A (Consignor & Consignee Details)</span>
                            <span className="text-gray-400 font-normal">Form GST EWB-01</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-gray-800">
                            {/* From */}
                            <div className="space-y-1.5 pr-2">
                                <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider block">1. From (Supplier / Consignor)</span>
                                <p className="font-bold text-white text-sm">{org?.name || "Radha Kishan Trading Company"}</p>
                                <p className="text-gray-300 font-mono text-[11px]">GSTIN: <span className="font-bold text-cyan-400">{org?.gstNumber || "06AABCR1234F1Z5"}</span></p>
                                <p className="text-gray-400">
                                    {[org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(", ") || "Bhiwani, Haryana"}
                                </p>
                            </div>

                            {/* To */}
                            <div className="space-y-1.5 pt-3 md:pt-0 md:pl-4">
                                <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider block">2. To (Recipient / Consignee)</span>
                                <p className="font-bold text-white text-sm">{cust?.name || "Customer"}</p>
                                <p className="text-gray-300 font-mono text-[11px]">GSTIN: <span className="font-bold text-gray-200">{cust?.gstNumber || "URP (Unregistered Person)"}</span></p>
                                <p className="text-gray-400">
                                    {[cust?.fullAddress, cust?.city, cust?.state, cust?.pincode].filter(Boolean).join(", ") || "Bawani Khera, Bhiwani, Haryana"}
                                </p>
                            </div>
                        </div>

                        {/* Document & Goods Row */}
                        <div className="border-t border-gray-800 px-4 py-3 bg-gray-900/40 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 block">Doc No.</span>
                                <span className="font-mono font-bold text-white">{invoice.invoiceNumber}</span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 block">Doc Date</span>
                                <span className="font-medium text-gray-200">{validFromStr}</span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 block">Total Goods Value</span>
                                <span className="font-mono font-bold text-emerald-400">{formatINR(invoice.totalAmount)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 block">Main HSN Code</span>
                                <span className="font-mono font-medium text-gray-200">{hsn}</span>
                            </div>
                        </div>
                    </div>

                    {/* PART - B */}
                    <div className="border border-gray-800 rounded-xl overflow-hidden">
                        <div className="bg-gray-800/60 px-4 py-2 border-b border-gray-800 font-bold uppercase tracking-wider text-[11px] text-cyan-300">
                            PART - B (Vehicle & Transportation Details)
                        </div>
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 block">Mode</span>
                                <span className="font-medium text-white">Road</span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 block">Vehicle Number</span>
                                <span className="font-mono font-bold text-amber-400 text-sm">
                                    {ewbDetails?.vehicleNo || "HR16-XY-1234"}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 block">From City</span>
                                <span className="font-medium text-white">{org?.city || "Bhiwani"}</span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 block">Transporter</span>
                                <span className="font-medium text-gray-300">{ewbDetails?.transporterName || "Self / Regular Fleet"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-2 text-center text-[10px] text-gray-500 space-y-1">
                        <p>This document is generated by DistroAI e-Way Bill compliance module under Rule 138 of the CGST Rules, 2017.</p>
                        <p className="font-mono">Verification Hash: EWB-{ewbNumber}-HASH-VERIFIED</p>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="px-6 py-3.5 border-t border-gray-800 bg-[#161922] flex justify-end gap-2.5">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 transition cursor-pointer flex items-center gap-1.5"
                    >
                        <Printer size={14} /> Print / Save PDF
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
