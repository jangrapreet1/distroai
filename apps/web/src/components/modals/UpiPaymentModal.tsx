"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, ExternalLink, ShieldCheck, Sparkles, Smartphone, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

interface UpiPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoiceNumber: string;
    amount: number;
    upiId: string;
    orgName: string;
    onPaymentConfirmed?: () => void;
}

export function UpiPaymentModal({
    isOpen,
    onClose,
    invoiceNumber,
    amount,
    upiId,
    orgName,
    onPaymentConfirmed,
}: UpiPaymentModalProps) {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    // Standard NPCI UPI URI
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
        orgName
    )}&am=${amount.toFixed(2)}&tr=${encodeURIComponent(
        invoiceNumber
    )}&tn=Invoice+${encodeURIComponent(invoiceNumber)}&cu=INR`;

    const handleCopy = () => {
        navigator.clipboard.writeText(upiId);
        setCopied(true);
        toast.success("UPI ID copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border-accent)] rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5 overflow-hidden">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="text-center space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] text-xs font-semibold uppercase tracking-wider">
                        <Sparkles size={13} />
                        <span>Instant NPCI UPI Settlement</span>
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">
                        Pay ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                        For Invoice <span className="font-mono font-bold text-[var(--gold)]">{invoiceNumber}</span> • {orgName}
                    </p>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-white border-2 border-[var(--gold)]/30 shadow-inner">
                    <QRCodeSVG
                        value={upiUri}
                        size={180}
                        level="M"
                        includeMargin={false}
                    />
                    <p className="text-[11px] font-semibold text-gray-700 mt-3 flex items-center gap-1">
                        <Smartphone size={13} className="text-emerald-600" />
                        Scan with Google Pay, PhonePe, Paytm or BHIM
                    </p>
                </div>

                {/* UPI Details Bar */}
                <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">Payee UPI ID:</span>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[var(--text-primary)]">{upiId}</span>
                            <button
                                onClick={handleCopy}
                                className="p-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--gold)] hover:text-[var(--gold-light)] transition"
                                title="Copy UPI ID"
                            >
                                {copied ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">Payable Amount:</span>
                        <span className="font-mono font-bold text-[var(--green-bright)]">
                            ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-1">
                    {/* Mobile UPI Intent Deep Link */}
                    <a
                        href={upiUri}
                        className="w-full py-3 px-4 rounded-xl bg-[var(--gold)] text-[#07070E] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[var(--gold-light)] shadow-md shadow-amber-500/15 transition"
                    >
                        <span>Open in UPI App (PhonePe / GPay)</span>
                        <ExternalLink size={15} />
                    </a>

                    <button
                        onClick={() => {
                            toast.success("Payment submitted for automated reconciliation!");
                            if (onPaymentConfirmed) onPaymentConfirmed();
                            onClose();
                        }}
                        className="w-full py-2.5 px-4 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)] transition"
                    >
                        I have completed the payment
                    </button>
                </div>
            </div>
        </div>
    );
}
