"use client";

import { useState, useMemo, use } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShoppingCart, LogIn, Search, Plus, Minus, X, CheckCircle2, Loader2, ArrowRight, User } from "lucide-react";
import { toast } from "react-hot-toast";

// Simple API wrapper for portal without requiring auth interceptors initially
const portalApi = {
    get: async (url: string, token?: string | null) => {
        const headers: any = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        return json.data !== undefined ? json.data : json;
    },
    post: async (url: string, body: any, token?: string | null) => {
        const headers: any = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Request failed');
        }
        const json = await res.json();
        return json.data !== undefined ? json.data : json;
    }
};

export default function StorefrontPage({ params }: { params: Promise<{ orgId: string }> | { orgId: string } }) {
    const resolvedParams = params as any;
    const orgId = resolvedParams.then ? use(resolvedParams as Promise<{ orgId: string }>).orgId : resolvedParams.orgId;
    // Auth State
    const [token, setToken] = useState<string | null>(null);
    const [customer, setCustomer] = useState<any>(null);

    // UI State
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Cart State
    const [cart, setCart] = useState<Record<string, { product: any, quantity: number }>>({});

    const { data: storeInfo } = useQuery({
        queryKey: ['portal-store', orgId],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/storefront`)
    });

    const { data: catalog, isLoading: isLoadingCatalog, refetch: refetchCatalog } = useQuery({
        queryKey: ['portal-catalog', orgId, token],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/catalog`, token)
    });

    const addToCart = (product: any) => {
        setCart(prev => {
            const current = prev[product.id]?.quantity || 0;
            return {
                ...prev,
                [product.id]: { product, quantity: current + 1 }
            };
        });
        toast.success(`Added ${product.name} to cart`);
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => {
            const next = { ...prev };
            if (!next[productId]) return next;
            const newQty = next[productId].quantity + delta;
            if (newQty <= 0) delete next[productId];
            else next[productId].quantity = newQty;
            return next;
        });
    };

    const cartItems = Object.values(cart);
    const cartTotal = cartItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

    const handleLoginSuccess = (loginData: any) => {
        setToken(loginData.token);
        setCustomer(loginData.customer);
        localStorage.setItem(`portal_token_${orgId}`, loginData.token);
        setIsAuthModalOpen(false);
        // Refresh catalog to get wholesale prices
        setTimeout(() => refetchCatalog(), 100);
        toast.success(`Welcome back, ${loginData.customer.name}!`);
    };

    const handleLogout = () => {
        setToken(null);
        setCustomer(null);
        setCart({});
        localStorage.removeItem(`portal_token_${orgId}`);
        setTimeout(() => refetchCatalog(), 100);
        toast.success("Logged out");
    };

    if (!storeInfo) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" /></div>;

    const filteredCatalog = catalog?.filter((p: any) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category?.toLowerCase().includes(searchQuery.toLowerCase())) || [];

    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#050505]/80 border-b border-[#222]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] font-bold">
                            {storeInfo.name.charAt(0)}
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-white">{storeInfo.name} <span className="text-xs text-[var(--gold)] font-medium ml-2 px-2 py-0.5 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10">B2B Portal</span></h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                className="pl-9 pr-4 py-1.5 bg-[#111] border border-[#333] rounded-full text-sm w-64 focus:outline-none focus:border-[var(--gold)] transition-colors"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {customer ? (
                            <div className="flex items-center gap-4">
                                <div className="hidden md:flex flex-col items-end">
                                    <span className="text-sm font-medium text-[var(--gold)]">{customer.name}</span>
                                    <span className="text-xs text-zinc-400">LEDGER: ₹{customer.outstandingAmount.toLocaleString('en-IN')}</span>
                                </div>
                                <button onClick={handleLogout} className="text-xs text-zinc-400 hover:text-white underline underline-offset-2">Logout</button>
                            </div>
                        ) : (
                            <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-2 text-sm font-medium text-white hover:text-[var(--gold)] transition-colors">
                                <LogIn className="w-4 h-4" />
                                <span className="hidden sm:inline">Retailer Login</span>
                            </button>
                        )}

                        <button
                            onClick={() => setIsCartOpen(true)}
                            className="relative p-2 text-zinc-300 hover:text-white"
                        >
                            <ShoppingCart className="w-6 h-6" />
                            {cartItemCount > 0 && (
                                <span className="absolute top-0 right-0 w-4 h-4 bg-[var(--gold)] text-black text-[10px] font-bold flex items-center justify-center rounded-full transform translate-x-1 -translate-y-1">
                                    {cartItemCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
                {isLoadingCatalog ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" /></div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                        {filteredCatalog.map((product: any) => (
                            <div key={product.id} className="group bg-[#111] border border-[#222] hover:border-[var(--gold)]/50 rounded-xl overflow-hidden transition-all duration-300 flex flex-col">
                                <div className="aspect-square bg-[#0a0a0a] relative p-4 flex items-center justify-center border-b border-[#222]">
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain mix-blend-screen group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 text-2xl font-bold">{product.name.charAt(0)}</div>
                                    )}
                                    {product.isB2B && (
                                        <div className="absolute top-2 right-2 bg-[var(--gold)] text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg">
                                            Wholesale
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 flex flex-col flex-1">
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-medium">{product.category}</p>
                                    <h3 className="text-sm font-semibold text-zinc-100 flex-1 line-clamp-2 leading-tight">{product.name}</h3>

                                    <div className="mt-4 flex items-end justify-between">
                                        <div>
                                            <p className="text-lg font-bold text-[var(--gold)] font-mono tracking-tight">₹{product.price.toLocaleString('en-IN')}</p>
                                            {product.isB2B && product.price < product.originalPrice && (
                                                <p className="text-xs text-zinc-500 line-through">MRP ₹{product.originalPrice}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => addToCart(product)}
                                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-[var(--gold)] hover:text-black flex items-center justify-center transition-colors border border-white/10 group-hover:border-[var(--gold)]/50"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Cart Drawer */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)} />
                    <div className="relative w-full max-w-md bg-[#111] border-l border-[#222] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-4 border-b border-[#222] flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-[var(--gold)]" /> Your Cart</h2>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 text-zinc-400 hover:text-white rounded-full"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cartItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                                    <ShoppingCart className="w-12 h-12 mb-4 opacity-50" />
                                    <p>Your cart is empty</p>
                                </div>
                            ) : (
                                cartItems.map((item) => (
                                    <div key={item.product.id} className="flex gap-4 p-3 bg-[#1a1a1a] rounded-lg border border-[#333]">
                                        <div className="w-16 h-16 bg-black rounded-md border border-[#222] p-1 flex items-center justify-center">
                                            {item.product.imageUrl ? <img src={item.product.imageUrl} className="max-w-full max-h-full object-contain" /> : <div className="text-zinc-600 font-bold">{item.product.name.charAt(0)}</div>}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-semibold text-zinc-200 line-clamp-1">{item.product.name}</h4>
                                            <p className="text-[var(--gold)] font-mono text-sm mt-1">₹{item.product.price.toLocaleString('en-IN')}</p>

                                            <div className="mt-2 flex items-center justify-between">
                                                <div className="flex items-center border border-[#333] rounded-md overflow-hidden bg-black">
                                                    <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10"><Minus className="w-3 h-3" /></button>
                                                    <span className="w-8 text-center text-xs font-mono">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10"><Plus className="w-3 h-3" /></button>
                                                </div>
                                                <span className="text-xs font-semibold text-zinc-400">₹{(item.quantity * item.product.price).toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {cartItems.length > 0 && (
                            <div className="p-6 border-t border-[#222] bg-[#0a0a0a]">
                                <div className="flex justify-between items-end mb-6">
                                    <span className="text-zinc-400 font-medium">Subtotal</span>
                                    <span className="text-2xl font-bold font-mono text-white">₹{cartTotal.toLocaleString('en-IN')}</span>
                                </div>
                                <button
                                    onClick={() => { setIsCartOpen(false); setIsCheckoutModalOpen(true); }}
                                    className="w-full bg-[var(--gold)] hover:bg-[#eab308] text-black font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                                >
                                    Proceed to Checkout <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Auth Modal */}
            {isAuthModalOpen && <AuthModal orgId={orgId} onClose={() => setIsAuthModalOpen(false)} onSuccess={handleLoginSuccess} />}

            {/* Checkout Modal */}
            {isCheckoutModalOpen && (
                <CheckoutModal
                    orgId={orgId}
                    cartItems={cartItems}
                    total={cartTotal}
                    customer={customer}
                    token={token}
                    onClose={() => setIsCheckoutModalOpen(false)}
                    onSuccess={() => { setIsCheckoutModalOpen(false); setCart({}); }}
                    storeInfo={storeInfo}
                />
            )}
        </div>
    );
}

// ─── Auth Modal (OTP Flow) ───
function AuthModal({ orgId, onClose, onSuccess }: { orgId: string, onClose: () => void, onSuccess: (data: any) => void }) {
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");

    const reqMutation = useMutation({
        mutationFn: (p: string) => portalApi.post(`/api/v1/portal/${orgId}/auth/request-otp`, { phone: p }),
        onSuccess: () => { setStep(2); toast.success("OTP sent! (Use 1234)"); },
        onError: (err: any) => toast.error(err.message || 'Failed to send OTP')
    });

    const verifyMutation = useMutation({
        mutationFn: () => portalApi.post(`/api/v1/portal/${orgId}/auth/verify-otp`, { phone, otp }),
        onSuccess: (data) => onSuccess(data),
        onError: (err: any) => toast.error(err.message || 'Invalid OTP')
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-[#111] border border-[#333] w-full max-w-sm rounded-[var(--radius-lg)] shadow-2xl p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                <div className="mb-6 flex space-x-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center"><User className="w-5 h-5 text-[var(--gold)]" /></div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Retailer Login</h2>
                        <p className="text-sm text-zinc-400">Access wholesale pricing</p>
                    </div>
                </div>

                {step === 1 ? (
                    <form onSubmit={(e) => { e.preventDefault(); reqMutation.mutate(phone); }} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Phone Number</label>
                            <input
                                type="tel" placeholder={"e.g. 9876543210"} required value={phone} onChange={e => setPhone(e.target.value)}
                                className="w-full bg-black border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[var(--gold)]"
                            />
                        </div>
                        <button type="submit" disabled={reqMutation.isPending} className="w-full bg-zinc-100 hover:bg-white text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2">
                            {reqMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get OTP'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={(e) => { e.preventDefault(); verifyMutation.mutate(); }} className="space-y-4 animate-in slide-in-from-right duration-300">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Enter OTP (1234)</label>
                            <input
                                type="text" maxLength={4} required value={otp} onChange={e => setOtp(e.target.value)}
                                className="w-full bg-black border border-[#333] rounded-lg px-4 py-3 text-white font-mono text-center tracking-[1em] focus:outline-none focus:border-[var(--gold)]"
                            />
                        </div>
                        <button type="submit" disabled={verifyMutation.isPending} className="w-full bg-[var(--gold)] hover:bg-[#eab308] text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2">
                            {verifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Login'}
                        </button>
                        <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-zinc-500 hover:text-white mt-4">Back to phone</button>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── Checkout Modal ───
function CheckoutModal({ orgId, cartItems, total, customer, token, onClose, onSuccess, storeInfo }: any) {
    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [guestAddress, setGuestAddress] = useState("");

    // Default to LEDGER if logged in (B2B), else RAZORPAY
    const [paymentMethod, setPaymentMethod] = useState(customer ? "LEDGER" : "RAZORPAY");

    const checkoutMutation = useMutation({
        mutationFn: async () => {
            const items = cartItems.map((c: any) => ({ productId: c.product.id, quantity: c.quantity, price: c.product.price }));
            const body = { items, paymentMethod, guestName, guestPhone, guestAddress };
            return portalApi.post(`/api/v1/portal/${orgId}/orders`, body, token);
        },
        onSuccess: () => {
            toast.success("Order Placed Successfully! 🎉", { duration: 5000 });
            onSuccess();
        },
        onError: (err: any) => toast.error(err.message || "Checkout failed")
    });

    const handlePlaceOrder = () => {
        // If Razorpay, ideally we'd load Razorpay here. For simplicity in phase 8 demo, we simulate Razorpay success immediately.
        if (paymentMethod === 'RAZORPAY') {
            toast.loading("Redirecting to payment gateway...", { duration: 1500 });
            setTimeout(() => checkoutMutation.mutate(), 1500);
        } else {
            checkoutMutation.mutate();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-[#111] border border-[#333] w-full max-w-2xl rounded-[var(--radius-lg)] shadow-2xl relative flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-[#222] flex items-center justify-between bg-black rounded-t-[var(--radius-lg)]">
                    <h2 className="text-xl font-bold text-white">Checkout</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 overflow-y-auto grid md:grid-cols-2 gap-8">
                    {/* Left: Customer Details */}
                    <div className="space-y-6">
                        {customer ? (
                            <div className="bg-[var(--gold)]/10 border border-[var(--gold)]/30 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-[var(--gold)] mb-2"><CheckCircle2 className="w-5 h-5" /> Logged in as B2B Retailer</div>
                                <h3 className="font-bold text-white text-lg">{customer.name}</h3>
                                <p className="text-sm text-zinc-400 mt-1">Outstanding Ledger: <span className="font-mono text-white">₹{customer.outstandingAmount.toLocaleString('en-IN')}</span></p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-white border-b border-[#333] pb-2">Guest / Public Checkout</h3>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Full Name</label>
                                    <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} required className="w-full bg-[#1a1a1a] border border-[#333] rounded p-2.5 text-white text-sm focus:border-[var(--gold)] outline-none" placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Phone Number</label>
                                    <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} required className="w-full bg-[#1a1a1a] border border-[#333] rounded p-2.5 text-white text-sm focus:border-[var(--gold)] outline-none" placeholder="9876543210" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Delivery Address</label>
                                    <textarea value={guestAddress} onChange={e => setGuestAddress(e.target.value)} required className="w-full bg-[#1a1a1a] border border-[#333] rounded p-2.5 text-white text-sm focus:border-[var(--gold)] outline-none" placeholder="123 Street..." rows={3} />
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 pt-4 border-t border-[#333]">
                            <h3 className="font-semibold text-white">Payment Method</h3>

                            {customer && (
                                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === 'LEDGER' ? 'border-[var(--gold)] bg-[var(--gold)]/5' : 'border-[#333] bg-[#1a1a1a] hover:border-zinc-500'}`}>
                                    <input type="radio" name="payment" value="LEDGER" checked={paymentMethod === 'LEDGER'} onChange={(e) => setPaymentMethod(e.target.value)} className="w-4 h-4 accent-[var(--gold)]" />
                                    <div>
                                        <p className="font-medium text-white text-sm">Add to Ledger (Pay Later)</p>
                                        <p className="text-xs text-zinc-500">Amount will be added to your distributor outstanding balance.</p>
                                    </div>
                                </label>
                            )}

                            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === 'RAZORPAY' ? 'border-[var(--gold)] bg-[var(--gold)]/5' : 'border-[#333] bg-[#1a1a1a] hover:border-zinc-500'}`}>
                                <input type="radio" name="payment" value="RAZORPAY" checked={paymentMethod === 'RAZORPAY'} onChange={(e) => setPaymentMethod(e.target.value)} className="w-4 h-4 accent-[var(--gold)]" />
                                <div>
                                    <p className="font-medium text-white text-sm">Pay Instantly (Razorpay)</p>
                                    <p className="text-xs text-zinc-500">Pay securely via UPI, Cards, or Netbanking.</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Right: Order Summary */}
                    <div className="bg-black rounded-xl border border-[#333] p-5 flex flex-col">
                        <h3 className="font-semibold text-white mb-4 flex justify-between">Order Summary <span className="text-zinc-500 font-normal text-sm">{cartItems.length} items</span></h3>

                        <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
                            {cartItems.map((item: any) => (
                                <div key={item.product.id} className="flex justify-between text-sm">
                                    <span className="text-zinc-300 w-2/3 truncate">{item.quantity} x {item.product.name}</span>
                                    <span className="text-zinc-100 font-mono">₹{(item.quantity * item.product.price).toLocaleString('en-IN')}</span>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-[#333] pt-4 mt-auto">
                            <div className="flex justify-between items-end mb-6">
                                <span className="text-zinc-400 font-medium text-lg">Total Due</span>
                                <span className="text-3xl font-bold font-mono text-[var(--gold)]">₹{total.toLocaleString('en-IN')}</span>
                            </div>

                            <button
                                onClick={handlePlaceOrder}
                                disabled={checkoutMutation.isPending || (!customer && (!guestName || !guestPhone))}
                                className="w-full bg-[var(--gold)] hover:bg-[#eab308] text-black font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(234,179,8,0.2)] text-lg"
                            >
                                {checkoutMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : paymentMethod === 'LEDGER' ? 'Confirm B2B Order' : 'Pay & Place Order'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
