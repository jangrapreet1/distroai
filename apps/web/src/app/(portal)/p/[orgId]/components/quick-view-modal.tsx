"use client";

import { useState, useEffect } from "react";
import { Plus, Minus, ShoppingCart, X, Package } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePortalCart, usePortalOrgId } from "@/contexts/portal-context";
import Link from "next/link";

interface QuickViewModalProps {
    product: any | null;
    onClose: () => void;
    isB2BContext: boolean;
}

export function QuickViewModal({ product, onClose, isB2BContext }: QuickViewModalProps) {
    const orgId = usePortalOrgId();
    const cart = usePortalCart();
    const [activeImageIdx, setActiveImageIdx] = useState(0);
    const [mounted, setMounted] = useState(false);

    const [bulkQty, setBulkQty] = useState(1);

    useEffect(() => {
        setMounted(true);
        if (product) setActiveImageIdx(0);
    }, [product]);

    if (!mounted || !product) return null;

    const displayImages = product.imageUrls?.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []);

    // Check if adding to cart would exceed stock
    const cartItem = cart.items[product.id];
    const cartQuantity = cartItem?.quantity || 0;

    const isOOS = !product.inStock;

    const handleAdd = () => {
        if (isOOS) return;

        if (!isB2BContext) {
            cart.addItem({ ...product });
            toast.success(`Added ${product.name}`);
        } else {
            const qty = Math.min(Math.max(1, bulkQty), product.stock);
            for (let i = 0; i < qty; i++) {
                cart.addItem({ ...product });
            }
            toast.success(`Added ${qty} units of ${product.name}`);
            setBulkQty(1);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            <div
                className="relative bg-[#0a0a0a] border border-[#222] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 scrollbar-hide"
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-zinc-400 hover:text-white rounded-full hover:bg-black/80 transition-colors backdrop-blur-md"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col md:flex-row h-full">
                    {/* Left: Image Gallery */}
                    <div className="w-full md:w-1/2 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-[#222] bg-[#050505] flex flex-col justify-center">
                        <div className="aspect-square bg-[#0a0a0a] border border-[#222] rounded-xl p-6 flex flex-col items-center justify-center relative shadow-inner">
                            {displayImages.length > 0 ? (
                                <img
                                    src={displayImages[activeImageIdx]}
                                    alt={product.name}
                                    className={`max-w-full max-h-full object-contain mix-blend-screen transition-opacity duration-300 ${isOOS ? 'opacity-50 grayscale' : ''}`}
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 text-4xl font-bold">
                                    {product.name.charAt(0)}
                                </div>
                            )}
                            {isOOS && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                                    <span className="bg-red-950/90 text-red-200 text-sm font-bold px-4 py-2 rounded-lg border border-red-900/50 backdrop-blur-md uppercase tracking-wider shadow-2xl">
                                        Out of Stock
                                    </span>
                                </div>
                            )}
                        </div>

                        {displayImages.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto mt-4 pb-2 scrollbar-hide snap-x justify-center">
                                {displayImages.map((url: string, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImageIdx(idx)}
                                        className={`w-14 h-14 shrink-0 rounded-lg border-2 ${idx === activeImageIdx ? 'border-[var(--gold)]' : 'border-transparent hover:border-[#333]'} overflow-hidden transition-colors snap-start bg-[#0a0a0a] flex items-center justify-center`}
                                    >
                                        <img src={url} alt={`view ${idx + 1}`} className="w-full h-full object-contain" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Product Details */}
                    <div className="w-full md:w-1/2 p-6 sm:p-8 flex flex-col">
                        {product.category && (
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] text-[var(--gold)] uppercase tracking-widest font-bold px-2 py-0.5 bg-[var(--gold)]/10 rounded-sm border border-[var(--gold)]/20">
                                    {product.category}
                                </p>
                                <Link onClick={() => onClose()} href={`/p/${orgId}/product/${product.id}`} className="text-xs text-zinc-500 hover:text-white underline underline-offset-2">
                                    View Full Details →
                                </Link>
                            </div>
                        )}
                        <h2 className={`text-2xl sm:text-3xl font-bold leading-tight ${isOOS ? 'text-zinc-400' : 'text-white'}`}>
                            {product.name}
                        </h2>

                        {product.brand && (
                            <p className="text-sm text-zinc-500 mt-1 uppercase tracking-wider font-medium">{product.brand}</p>
                        )}

                        {/* Pricing */}
                        <div className="mt-6 flex flex-col gap-1">
                            <div className="flex items-baseline gap-3">
                                <span className={`text-3xl font-bold font-mono tracking-tight ${isOOS ? 'text-zinc-500' : 'text-[var(--gold)]'}`}>
                                    ₹{product.price.toLocaleString("en-IN")}
                                </span>
                                {isB2BContext && product.price < product.originalPrice && (
                                    <span className="text-lg text-zinc-500 line-through font-mono">
                                        ₹{product.originalPrice.toLocaleString("en-IN")}
                                    </span>
                                )}
                            </div>
                            {isB2BContext && product.price < product.originalPrice && (
                                <p className="text-xs text-zinc-400">
                                    Includes {(100 - (product.price / product.originalPrice) * 100).toFixed(0)}% margin discount
                                </p>
                            )}
                        </div>

                        {product.description && (
                            <p className="mt-6 text-sm text-zinc-400 leading-relaxed line-clamp-3">
                                {product.description}
                            </p>
                        )}

                        {/* Tags Grid */}
                        <div className="mt-8 grid grid-cols-2 gap-3 mb-8">
                            <div className="bg-[#111] border border-[#222] rounded-xl p-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4 text-zinc-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Packaging</p>
                                    <p className="text-sm text-white font-medium">{product.unit || 'Unit'}</p>
                                </div>
                            </div>
                            <div className={`border rounded-xl p-3 flex flex-col justify-center ${product.inStock ? "bg-[#111] border-[#222]" : "bg-red-950/20 border-red-900/30"}`}>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Availability</p>
                                <p className={`text-sm font-bold tracking-wide ${product.inStock ? "text-green-400" : "text-red-400"}`}>
                                    {product.inStock ? (product.stock > 10 ? "In Stock" : `Low Stock: ${product.stock}`) : "Currently Out of Stock"}
                                </p>
                            </div>
                        </div>

                        {/* Add to Cart Footer */}
                        <div className="mt-auto pt-6 border-t border-[#222]">
                            {isOOS ? (
                                <button
                                    disabled
                                    className="w-full py-3.5 px-6 rounded-xl font-bold flex items-center justify-center gap-2 uppercase tracking-wide bg-[#111] text-zinc-500 border border-[#222] cursor-not-allowed"
                                >
                                    Sold Out
                                </button>
                            ) : isB2BContext ? (
                                <div className="flex gap-3">
                                    <div className="flex bg-[#0a0a0a] border border-[#333] rounded-xl overflow-hidden focus-within:border-[var(--gold)] shrink-0 w-32">
                                        <button
                                            onClick={() => setBulkQty(Math.max(1, bulkQty - 1))}
                                            className="px-3 hover:bg-[#111] transition-colors border-r border-[#333]"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <input
                                            type="number"
                                            min="1"
                                            max={product.stock}
                                            value={bulkQty}
                                            onChange={(e) => setBulkQty(parseInt(e.target.value) || 1)}
                                            className="w-full bg-transparent text-center focus:outline-none font-mono text-white text-sm"
                                        />
                                        <button
                                            onClick={() => setBulkQty(bulkQty + 1)}
                                            className="px-3 hover:bg-[#111] transition-colors border-l border-[#333]"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleAdd}
                                        className="flex-1 bg-[var(--gold)] hover:bg-[#eab308] text-black font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(234,179,8,0.15)] active:scale-95 uppercase tracking-wide text-sm"
                                    >
                                        <ShoppingCart className="w-4 h-4" /> Add Required
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    {cartQuantity > 0 ? (
                                        <div className="flex items-center border border-[#333] rounded-xl overflow-hidden bg-[#0a0a0a] h-12">
                                            <button
                                                onClick={() => cart.updateQuantity(product.id, -1)}
                                                className="w-12 h-12 flex items-center justify-center hover:bg-white/10 transition-colors"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="w-12 text-center font-mono font-semibold">{cartQuantity}</span>
                                            <button
                                                onClick={() => cart.updateQuantity(product.id, 1)}
                                                disabled={cartQuantity >= product.stock}
                                                className="w-12 h-12 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : null}

                                    <button
                                        onClick={handleAdd}
                                        disabled={!product.inStock || cartQuantity >= product.stock}
                                        className="flex-1 bg-[var(--gold)] hover:bg-[#eab308] text-black font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(234,179,8,0.15)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none bg-zinc-800 disabled:hover:bg-zinc-800 disabled:text-zinc-500 uppercase tracking-wide text-sm"
                                    >
                                        <ShoppingCart className="w-4 h-4 border-black" />
                                        {cartQuantity > 0 ? "Add Another" : "Add to Cart"}
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
