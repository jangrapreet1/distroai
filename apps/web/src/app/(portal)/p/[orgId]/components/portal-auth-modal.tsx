"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, User, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePortalAuth, usePortalOrgId, usePortalBusinessType, portalApi } from "@/contexts/portal-context";

export function PortalAuthModal({ onClose }: { onClose: () => void }) {
    const orgId = usePortalOrgId();
    const auth = usePortalAuth();
    const businessType = usePortalBusinessType();
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");

    const reqMutation = useMutation({
        mutationFn: (p: string) =>
            portalApi.post(`/api/v1/portal/${orgId}/auth/request-otp`, { phone: p }),
        onSuccess: () => {
            setStep(2);
            toast.success("OTP sent!");
        },
        onError: (err: Error) => toast.error(err.message || "Failed to send OTP"),
    });

    const verifyMutation = useMutation({
        mutationFn: () =>
            portalApi.post(`/api/v1/portal/${orgId}/auth/verify-otp`, { phone, otp }),
        onSuccess: (data: any) => {
            auth.setAuth(data.token, data.customer);
            toast.success(`Welcome back, ${data.customer.name}!`);
            onClose();
        },
        onError: (err: Error) => toast.error(err.message || "Invalid OTP"),
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-[#111] border border-[#333] w-full max-w-sm rounded-2xl shadow-2xl p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-6 flex space-x-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-[var(--gold)]" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">{businessType === 'Manufacturer' ? 'Partner Login' : 'Retailer Login'}</h2>
                        <p className="text-sm text-zinc-400">{businessType === 'Manufacturer' ? 'Access partner pricing & order history' : 'Access wholesale pricing & order history'}</p>
                    </div>
                </div>

                {step === 1 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            reqMutation.mutate(phone);
                        }}
                        className="space-y-4"
                    >
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Phone Number</label>
                            <input
                                type="tel"
                                placeholder="e.g. 9876543210"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-black border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[var(--gold)]"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={reqMutation.isPending}
                            className="w-full bg-zinc-100 hover:bg-white text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
                        >
                            {reqMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get OTP"}
                        </button>
                    </form>
                ) : (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            verifyMutation.mutate();
                        }}
                        className="space-y-4 animate-in slide-in-from-right duration-300"
                    >
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Enter OTP</label>
                            <input
                                type="text"
                                maxLength={4}
                                required
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="w-full bg-black border border-[#333] rounded-lg px-4 py-3 text-white font-mono text-center tracking-[1em] focus:outline-none focus:border-[var(--gold)]"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={verifyMutation.isPending}
                            className="w-full bg-[var(--gold)] hover:bg-[#eab308] text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
                        >
                            {verifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Login"}
                        </button>
                        <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-zinc-500 hover:text-white mt-2">
                            Back to phone
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
