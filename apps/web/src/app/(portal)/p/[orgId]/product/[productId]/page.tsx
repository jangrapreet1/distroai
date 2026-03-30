"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Plus, Minus, ShoppingCart, Loader2, Package } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePortalOrgId, usePortalCart, usePortalAuth, portalApi } from "@/contexts/portal-context";

export default function ProductDetailPage({
    params,
}: {
    params: Promise<{ orgId: string; productId: string }> | { orgId: string; productId: string };
}) {
    const resolvedParams = params as any;
    const productId = resolvedParams.then
        ? use(resolvedParams as Promise<{ productId: string }>).productId
        : resolvedParams.productId;

    const orgId = usePortalOrgId();
    const cart = usePortalCart();
    const auth = usePortalAuth();

    const { data: catalog, isLoading } = useQuery({
        queryKey: ["portal-catalog", orgId, auth.token],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/catalog`, auth.token),
    });

    const product = useMemo(() => catalog?.find((p: any) => p.id === productId), [catalog, productId]);
    const relatedProducts = useMemo(
        () => catalog?.filter((p: any) => p.category === product?.category && p.id !== productId)?.slice(0, 4) || [],
        [catalog, product, productId]
    );

    const [activeImageIdx, setActiveImageIdx] = useState(0);
    const displayImages = product?.imageUrls?.length > 0 ? product.imageUrls : (product?.imageUrl ? [product.imageUrl] : []);

    const cartItem = cart.items[productId];
    const quantity = cartItem?.quantity || 0;

    const addToCart = () => {
        if (!product) return;
        cart.addItem({
            id: product.id,
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice,
            imageUrl: product.imageUrl,
            category: product.category,
            isB2B: product.isB2B,
            unit: product.unit,
        });
        toast.success(`Added ${product.name}`);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--gold)]" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-12 text-center">
                <Package className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
                <p className="text-zinc-400">Product not found</p>
                <Link href={`/p/${orgId}`} className="text-[var(--gold)] text-sm mt-2 inline-block hover:underline">
                    ← Back to catalog
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Breadcrumb */}
            <Link href={`/p/${orgId}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[var(--gold)] mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to catalog
            </Link>

            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                {/* Product Image Gallery */}
                <div className="flex flex-col gap-4 max-w-sm mx-auto w-full">
                    <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 sm:p-10 flex items-center justify-center aspect-square w-full">
                        {displayImages.length > 0 ? (
                            <img src={displayImages[activeImageIdx]} alt={product.name} className="max-w-full max-h-full object-contain" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 text-4xl font-bold">
                                {product.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    {displayImages.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
                            {displayImages.map((url: string, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveImageIdx(idx)}
                                    className={`w-16 h-16 shrink-0 rounded-lg border-2 ${idx === activeImageIdx ? 'border-[var(--gold)]' : 'border-transparent hover:border-[#333]'} overflow-hidden transition-colors snap-start bg-[#0a0a0a] flex items-center justify-center`}
                                >
                                    <img src={url} alt={`${product.name} view ${idx + 1}`} className="w-full h-full object-contain" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Details */}
                <div className="flex flex-col">
                    {product.category && (
                        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-medium">{product.category}</p>
                    )}
                    <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{product.name}</h1>

                    {product.brand && (
                        <p className="text-sm text-zinc-400 mt-1">by <span className="text-zinc-300">{product.brand}</span></p>
                    )}

                    {/* Pricing */}
                    <div className="mt-6 flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-[var(--gold)] font-mono">
                            ₹{product.price.toLocaleString("en-IN")}
                        </span>
                        {product.isB2B && product.price < product.originalPrice && (
                            <span className="text-lg text-zinc-500 line-through font-mono">
                                ₹{product.originalPrice.toLocaleString("en-IN")}
                            </span>
                        )}
                        {product.isB2B && (
                            <span className="text-xs bg-[var(--gold)]/20 text-[var(--gold)] px-2 py-0.5 rounded-full font-medium">
                                Wholesale Price
                            </span>
                        )}
                    </div>

                    {/* Details Grid */}
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                        {product.unit && (
                            <div className="bg-[#111] border border-[#222] rounded-lg p-3">
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Unit</p>
                                <p className="text-sm text-white font-medium mt-0.5">{product.unit}</p>
                            </div>
                        )}
                        {product.hsnCode && (
                            <div className="bg-[#111] border border-[#222] rounded-lg p-3">
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">HSN Code</p>
                                <p className="text-sm text-white font-medium mt-0.5 font-mono">{product.hsnCode}</p>
                            </div>
                        )}
                        <div className={`bg-[#111] border rounded-lg p-3 ${product.inStock ? "border-[#222]" : "border-red-900/30"}`}>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Availability</p>
                            <p className={`text-sm font-medium mt-0.5 ${product.inStock ? "text-green-400" : "text-red-400"}`}>
                                {product.inStock ? (product.stock > 10 ? "In Stock" : `Only ${product.stock} left`) : "Out of Stock"}
                            </p>
                        </div>
                    </div>

                    {product.description && (
                        <div className="mt-6">
                            <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-2 font-medium">Description</h3>
                            <p className="text-sm text-zinc-300 leading-relaxed">{product.description}</p>
                        </div>
                    )}

                    {/* Add to Cart */}
                    <div className="mt-8 flex items-center gap-4">
                        {quantity > 0 ? (
                            <div className="flex items-center border border-[#333] rounded-lg overflow-hidden bg-[#0a0a0a]">
                                <button
                                    onClick={() => cart.updateQuantity(productId, -1)}
                                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-12 text-center font-mono font-semibold">{quantity}</span>
                                <button
                                    onClick={() => cart.updateQuantity(productId, 1)}
                                    disabled={quantity >= product.stock}
                                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        ) : null}

                        <button
                            onClick={addToCart}
                            disabled={!product.inStock || quantity >= product.stock}
                            className="flex-1 bg-[var(--gold)] hover:bg-[#eab308] text-black font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none bg-zinc-800 disabled:hover:bg-zinc-800 disabled:text-zinc-500"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            {!product.inStock ? "Out of Stock" : quantity > 0 ? "Add More" : "Add to Cart"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Related Products */}
            {relatedProducts.length > 0 && (
                <section className="mt-16">
                    <h2 className="text-lg font-bold text-white mb-6">More in {product.category}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {relatedProducts.map((rp: any) => (
                            <Link
                                key={rp.id}
                                href={`/p/${orgId}/product/${rp.id}`}
                                className="group bg-[#111] border border-[#222] hover:border-[var(--gold)]/50 rounded-xl overflow-hidden transition-all duration-300"
                            >
                                <div className="aspect-square bg-[#0a0a0a] p-3 flex items-center justify-center border-b border-[#222]">
                                    {rp.imageUrl ? (
                                        <img src={rp.imageUrl} alt={rp.name} className="w-full h-full object-contain mix-blend-screen group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold">{rp.name.charAt(0)}</div>
                                    )}
                                </div>
                                <div className="p-3">
                                    <h3 className="text-sm font-semibold text-zinc-200 line-clamp-1">{rp.name}</h3>
                                    <p className="text-sm font-bold text-[var(--gold)] font-mono mt-1">₹{rp.price.toLocaleString("en-IN")}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
