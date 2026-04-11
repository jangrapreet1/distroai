"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePortalOrgId, usePortalCart, usePortalAuth, usePortalBusinessType, portalApi } from "@/contexts/portal-context";

interface CheckoutModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export function PortalCheckoutModal({ onClose, onSuccess }: CheckoutModalProps) {
    const orgId = usePortalOrgId();
    const cart = usePortalCart();
    const auth = usePortalAuth();
    const businessType = usePortalBusinessType();

    const items = cart.getItems();
    const total = cart.getTotal();

    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [guestAddress, setGuestAddress] = useState("");
    // Retailer orgs are B2C — no LEDGER. Distributor/Manufacturer orgs allow LEDGER for authenticated users.
    const allowLedger = businessType !== 'Retailer' && auth.isAuthenticated;
    const [paymentMethod, setPaymentMethod] = useState(allowLedger ? "LEDGER" : "RAZORPAY");

    const checkoutMutation = useMutation({
        mutationFn: async () => {
            const orderItems = items.map((c) => ({
                productId: c.product.id,
                quantity: c.quantity,
                price: c.product.price,
            }));
            const body = { items: orderItems, paymentMethod, guestName, guestPhone, guestAddress };
            return portalApi.post(`/api/v1/portal/${orgId}/orders`, body, auth.token);
        },
        onSuccess: () => {
            toast.success("Order Placed Successfully! 🎉", { duration: 5000 });
            onSuccess();
        },
        onError: (err: Error) => toast.error(err.message || "Checkout failed"),
    });

    const handlePlaceOrder = () => {
        if (paymentMethod === "RAZORPAY") {
            toast.loading("Redirecting to payment gateway...", { duration: 1500 });
            setTimeout(() => checkoutMutation.mutate(), 1500);
        } else {
            checkoutMutation.mutate();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-[#111] border border-[#333] w-full max-w-2xl rounded-2xl shadow-2xl relative flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-[#222] flex items-center justify-between bg-[#0a0a0a] rounded-t-2xl">
                    <h2 className="text-lg font-bold text-white">Checkout</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto grid md:grid-cols-2 gap-6">
                    {/* Left: Customer Details */}
                    <div className="space-y-5">
                        {auth.isAuthenticated && auth.customer ? (
                            <div className="bg-[var(--gold)]/10 border border-[var(--gold)]/30 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-[var(--gold)] mb-2 text-sm">
                                    <CheckCircle2 className="w-4 h-4" /> B2B {auth.customer.type === 'WHOLESALER' ? 'Wholesaler' : auth.customer.type === 'INSTITUTION' ? 'Institution' : 'Retailer'}
                                </div>
                                <h3 className="font-bold text-white">{auth.customer.name}</h3>
                                <p className="text-xs text-zinc-400 mt-1">
                                    Outstanding: <span className="font-mono text-white">₹{auth.customer.outstandingAmount.toLocaleString("en-IN")}</span>
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <h3 className="font-semibold text-white text-sm border-b border-[#333] pb-2">Guest Checkout</h3>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Full Name</label>
                                    <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} required className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm focus:border-[var(--gold)] outline-none" placeholder="Name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Phone</label>
                                    <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm focus:border-[var(--gold)] outline-none" placeholder="9876543210" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Address</label>
                                    <textarea value={guestAddress} onChange={(e) => setGuestAddress(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm focus:border-[var(--gold)] outline-none" rows={2} placeholder="Delivery address" />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 pt-3 border-t border-[#333]">
                            <h3 className="font-semibold text-white text-sm">Payment Method</h3>
                            {allowLedger && (
                                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "LEDGER" ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-[#333] bg-[#1a1a1a] hover:border-zinc-500"}`}>
                                    <input type="radio" name="payment" value="LEDGER" checked={paymentMethod === "LEDGER"} onChange={(e) => setPaymentMethod(e.target.value)} className="w-4 h-4 accent-[var(--gold)]" />
                                    <div>
                                        <p className="font-medium text-white text-sm">Add to Ledger (Pay Later)</p>
                                        <p className="text-xs text-zinc-500">Added to your outstanding balance</p>
                                    </div>
                                </label>
                            )}
                            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "RAZORPAY" ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-[#333] bg-[#1a1a1a] hover:border-zinc-500"}`}>
                                <input type="radio" name="payment" value="RAZORPAY" checked={paymentMethod === "RAZORPAY"} onChange={(e) => setPaymentMethod(e.target.value)} className="w-4 h-4 accent-[var(--gold)]" />
                                <div>
                                    <p className="font-medium text-white text-sm">Pay Instantly (Razorpay)</p>
                                    <p className="text-xs text-zinc-500">UPI, Cards, or Netbanking</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Right: Order Summary */}
                    <div className="bg-black rounded-xl border border-[#333] p-4 flex flex-col">
                        <h3 className="font-semibold text-white mb-3 flex justify-between text-sm">
                            Order Summary <span className="text-zinc-500 font-normal">{items.length} items</span>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1 max-h-48">
                            {items.map((item) => (
                                <div key={item.product.id} className="flex justify-between text-sm">
                                    <span className="text-zinc-300 w-2/3 truncate">{item.quantity} × {item.product.name}</span>
                                    <span className="text-zinc-100 font-mono">₹{(item.quantity * item.product.price).toLocaleString("en-IN")}</span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-[#333] pt-4 mt-auto">
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-zinc-400 font-medium">Total</span>
                                <span className="text-2xl font-bold font-mono text-[var(--gold)]">₹{total.toLocaleString("en-IN")}</span>
                            </div>
                            <button
                                onClick={handlePlaceOrder}
                                disabled={checkoutMutation.isPending || (!auth.isAuthenticated && (!guestName || !guestPhone))}
                                className="w-full bg-[var(--gold)] hover:bg-[#eab308] text-black font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                            >
                                {checkoutMutation.isPending ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : paymentMethod === "LEDGER" ? (
                                    <>Confirm B2B Order <ArrowRight className="w-4 h-4" /></>
                                ) : (
                                    <>Pay & Place Order <ArrowRight className="w-4 h-4" /></>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
