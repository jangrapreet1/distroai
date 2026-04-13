"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, PackageSearch, ShoppingCart, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePortalOrgId, usePortalCart, usePortalAuth, portalApi } from "@/contexts/portal-context";
import { QuickViewModal } from "./components/quick-view-modal";

function ProductCard({ product, orgId, cart, isB2BContext, onQuickView }: { product: any; orgId: string; cart: any; isB2BContext: boolean; onQuickView: (p: any) => void }) {
    const [bulkQty, setBulkQty] = useState<number>(1);
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
        <div className={`group bg-[#1a1a1a] border border-[#222] hover:border-[var(--gold)] hover:shadow-[0_0_20px_rgba(234,179,8,0.12)] rounded-xl overflow-hidden transition-all duration-300 flex flex-col ${isOOS ? 'opacity-60 grayscale' : 'hover:-translate-y-0.5'}`}>
            <Link
                href={`/p/${orgId}/product/${product.id}`}
                className="block relative cursor-pointer"
                onClick={(e) => {
                    e.preventDefault();
                    if (!isOOS || isB2BContext) onQuickView(product);
                }}
            >
                <div className="aspect-square bg-[#0a0a0a] relative p-3 flex items-center justify-center border-b border-[#222]">
                    {product.imageUrl ? (
                        <img
                            src={product.imageUrl}
                            alt={product.name}
                            className={`w-full h-full object-contain mix-blend-screen transition-transform duration-500 ${!isOOS && 'group-hover:scale-105'}`}
                        />
                    ) : (
                        <div className="w-14 h-14 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 text-xl font-bold">
                            {product.name.charAt(0)}
                        </div>
                    )}
                    {isB2BContext && (
                        <div className="absolute top-2 right-2 bg-[#222] border border-[#333] text-zinc-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm z-10 hover:bg-[#333]">
                            Wholesale
                        </div>
                    )}
                    {isOOS && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px] z-10">
                            <span className="bg-red-950/80 text-red-200 text-xs font-bold px-3 py-1.5 rounded-md border border-red-900/50 backdrop-blur-md uppercase tracking-wider flex items-center gap-1.5 shadow-xl">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Out of Stock
                            </span>
                        </div>
                    )}
                </div>
            </Link>

            <div className="p-3 sm:p-4 flex flex-col flex-1">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5 font-medium">{product.category}</p>
                <Link
                    href={`/p/${orgId}/product/${product.id}`}
                    onClick={(e) => {
                        e.preventDefault();
                        if (!isOOS || isB2BContext) onQuickView(product);
                    }}
                >
                    <h3 className={`text-sm font-semibold flex-1 line-clamp-2 leading-tight transition-colors ${isOOS ? 'text-zinc-400' : 'text-zinc-100 hover:text-[var(--gold)] cursor-pointer'}`}>
                        {product.name}
                    </h3>
                </Link>
                <div className="mt-4 flex items-end justify-between">
                    <div>
                        <p className={`text-[15px] font-bold font-mono tracking-tight ${isOOS ? 'text-zinc-500' : 'text-[var(--gold)]'}`}>
                            ₹{product.price.toLocaleString("en-IN")}
                        </p>
                        {isB2BContext && product.price < product.originalPrice && (
                            <p className="text-[10px] text-zinc-500 line-through">
                                MRP ₹{product.originalPrice.toLocaleString("en-IN")}
                            </p>
                        )}
                    </div>

                    {!isOOS && (
                        isB2BContext ? (
                            <div className="flex bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden group-hover:border-[#444] transition-colors focus-within:border-[var(--gold)]">
                                <input
                                    type="number"
                                    min="1"
                                    max={product.stock}
                                    value={bulkQty}
                                    onChange={(e) => setBulkQty(parseInt(e.target.value) || 1)}
                                    className="w-12 bg-transparent text-xs text-center focus:outline-none font-mono text-zinc-200"
                                />
                                <button
                                    onClick={handleAdd}
                                    className="px-2 py-1 bg-[#222] hover:bg-[var(--gold)] hover:text-black transition-colors border-l border-[#333] flex items-center justify-center cursor-pointer"
                                >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleAdd}
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-[var(--gold)] hover:text-black flex items-center justify-center transition-all border border-white/10 group-hover:border-[var(--gold)]/50 cursor-pointer shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

export default function CatalogPage() {
    const orgId = usePortalOrgId();
    const cart = usePortalCart();
    const auth = usePortalAuth();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get("q") || "";
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [quickViewProduct, setQuickViewProduct] = useState<any | null>(null);

    const isB2BContext = auth.isAuthenticated && auth.customer?.type !== 'INDIVIDUAL';

    const { data: catalog, isLoading } = useQuery({
        queryKey: ["portal-catalog", orgId, auth.token],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/catalog`, auth.token),
    });

    const { data: storefrontInfo } = useQuery({
        queryKey: ["portal-storefront", orgId],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/storefront`),
    });

    const { data: orders } = useQuery({
        queryKey: ["portal-orders", orgId, auth.token],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/orders`, auth.token),
        enabled: auth.isAuthenticated && !!auth.token,
    });

    const maxCatalogPrice = useMemo(() => {
        if (!catalog) return 10000;
        return catalog.reduce((max: number, p: any) => Math.max(max, p.price), 0);
    }, [catalog]);

    const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);

    useEffect(() => {
        if (maxCatalogPrice > 0) {
            setPriceRange([0, maxCatalogPrice]);
        }
    }, [maxCatalogPrice]);

    const categories = useMemo(() => {
        if (!catalog) return [];
        // Extract distinct categories from catalog (post-filtering for OOS if needed, but categories usually represent the whole catalog)
        const cats = new Set(catalog.map((p: any) => p.category).filter(Boolean));
        return Array.from(cats) as string[];
    }, [catalog]);

    const filteredCatalog = useMemo(() => {
        if (!catalog) return [];
        return catalog.filter((p: any) => {
            // B2C Context: Completely hide Out of Stock items
            if (!isB2BContext && !p.inStock) return false;

            const matchesSearch =
                !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.brand?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory ? p.category === selectedCategory : true;
            const matchesPrice = isB2BContext ? true : (p.price >= priceRange[0] && p.price <= priceRange[1]);
            return matchesSearch && matchesCategory && matchesPrice;
        });
    }, [catalog, searchQuery, selectedCategory, isB2BContext, priceRange]);

    // Buy It Again calculation
    const buyItAgainProducts = useMemo(() => {
        if (!isB2BContext || !orders || orders.length < 3 || !catalog) return [];

        // Extract distinct product IDs from all past orders
        const pastProductIds = new Set<string>();
        orders.forEach((order: any) => {
            order.items?.forEach((item: any) => {
                if (item.productId) pastProductIds.add(item.productId);
            });
        });

        // Map IDs back to full catalog products, filter out anything not in active catalog
        return catalog.filter((p: any) => pastProductIds.has(p.id) && p.inStock).slice(0, 10);
    }, [catalog, orders, isB2BContext]);

    return (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
            {/* Dynamic Storefront Hero Banner */}
            {storefrontInfo && !searchQuery && !selectedCategory && (
                <div className="mb-10 w-full rounded-3xl overflow-hidden relative border border-[#222] bg-[#050505]">
                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/20 via-black/40 to-[#0a0a0a] mix-blend-overlay" />
                    <div className="relative px-8 py-14 sm:px-16 sm:py-20 flex flex-col items-center justify-center text-center">
                        {storefrontInfo.logoUrl ? (
                            <img src={storefrontInfo.logoUrl} alt={storefrontInfo.name} className="w-20 h-20 rounded-xl mb-6 shadow-[0_0_40px_rgba(234,179,8,0.3)] object-cover bg-white" />
                        ) : (
                            <div className="w-20 h-20 rounded-2xl bg-[var(--gold)]/10 text-[var(--gold)] flex items-center justify-center text-3xl font-extrabold mb-6 border border-[var(--gold)]/30 backdrop-blur-md shadow-[0_0_40px_rgba(234,179,8,0.2)]">
                                {storefrontInfo.name?.charAt(0)}
                            </div>
                        )}
                        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-xl">{storefrontInfo.name}</h1>
                        <p className="text-sm sm:text-base text-zinc-400 max-w-xl leading-relaxed">
                            {isB2BContext ? "Welcome back to your wholesale purchasing portal. Streamlined ordering designed for loyalty." : `Discover premium products from ${storefrontInfo.name}.`}
                        </p>
                    </div>
                </div>
            )}

            {/* Buy It Again Carousel (Gated behind 3+ orders) */}
            {buyItAgainProducts.length > 0 && !searchQuery && !selectedCategory && (
                <section className="mb-12 border-b border-[#222] pb-12">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Buy It Again</h2>
                            <p className="text-xs sm:text-sm text-zinc-400 mt-1">Based on your recent wholesale orders</p>
                        </div>
                        <span className="hidden sm:inline-flex bg-[var(--gold)]/10 text-[var(--gold)] text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-sm border border-[var(--gold)]/20">
                            Partner Loyalty
                        </span>
                    </div>
                    <div className="flex overflow-x-auto gap-4 sm:gap-6 pb-4 scrollbar-hide snap-x">
                        {buyItAgainProducts.map((product: any) => (
                            <div key={product.id} className="w-[240px] sm:w-[280px] shrink-0 snap-start">
                                <ProductCard
                                    product={product}
                                    orgId={orgId}
                                    cart={cart}
                                    isB2BContext={isB2BContext}
                                    onQuickView={(p) => setQuickViewProduct(p)}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Mobile Search */}
            <div className="md:hidden mb-4">
                <input
                    type="text"
                    placeholder="Search products..."
                    className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-xl text-sm focus:outline-none focus:border-[var(--gold)]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Main Content Layout */}
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Filters */}
                <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-8">
                    {/* Categories */}
                    {categories.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Categories</h3>
                            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`whitespace-nowrap px-4 py-2 lg:py-2 lg:px-3 text-left rounded-lg text-sm font-medium transition-all ${!selectedCategory ? "bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/30" : "text-zinc-400 hover:bg-[#111] hover:text-white"}`}
                                >
                                    All Products
                                </button>
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`whitespace-nowrap px-4 py-2 lg:py-2 lg:px-3 text-left rounded-lg text-sm font-medium transition-all ${selectedCategory === cat ? "bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/30" : "text-zinc-400 hover:bg-[#111] hover:text-white"}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* B2C Price Filter */}
                    {!isB2BContext && catalog && (
                        <div className="hidden lg:block border-t border-[#222] pt-6">
                            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Price Range</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                                    <span>₹{priceRange[0]}</span>
                                    <span>₹{priceRange[1]}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={maxCatalogPrice}
                                    step={10}
                                    value={priceRange[1]}
                                    onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                                    className="w-full appearance-none bg-[#222] h-1 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--gold)] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-[var(--gold)] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
                                />
                            </div>
                        </div>
                    )}
                </aside>

                {/* Catalog Grid Area */}
                <main className="flex-1 min-w-0">
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-6">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="bg-[#1a1a1a] border border-[#222] rounded-xl overflow-hidden flex flex-col animate-pulse">
                                    <div className="aspect-square bg-[#0a0a0a]" />
                                    <div className="p-3 sm:p-4 flex flex-col flex-1 gap-2">
                                        <div className="h-3 bg-[#222] rounded w-1/3" />
                                        <div className="h-4 bg-[#222] rounded w-3/4 mt-1" />
                                        <div className="h-4 bg-[#222] rounded w-1/2" />
                                        <div className="mt-auto flex items-end justify-between pt-3">
                                            <div className="h-5 bg-[#222] rounded w-20" />
                                            <div className="w-8 h-8 rounded-full bg-[#222]" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredCatalog.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[400px] text-center border border-dashed border-[#333] rounded-3xl bg-[#0a0a0a] p-8 mx-auto max-w-2xl mt-8">
                            <div className="w-20 h-20 bg-[#1a1a1a] rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(234,179,8,0.05)] border border-[#222]">
                                <PackageSearch className="w-10 h-10 text-[var(--gold)] opacity-90" />
                            </div>
                            <h3 className="text-2xl font-semibold text-white mb-3 tracking-tight">No products found</h3>
                            <p className="text-[15px] text-zinc-400 max-w-md leading-relaxed">
                                {searchQuery || selectedCategory
                                    ? "We couldn't find anything matching your filters. Try adjusting your search keywords or browsing all categories."
                                    : "This distributor's catalog is currently empty or being updated. Please check back later."}
                            </p>
                            {(searchQuery || selectedCategory) && (
                                <button
                                    onClick={() => { setSearchQuery(""); setSelectedCategory(null); }}
                                    className="mt-8 px-8 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-full text-sm font-bold transition-all shadow-lg hover:shadow-xl active:scale-95"
                                >
                                    Clear all filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-6">
                            {filteredCatalog.map((product: any) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    orgId={orgId}
                                    cart={cart}
                                    isB2BContext={isB2BContext}
                                    onQuickView={(p) => setQuickViewProduct(p)}
                                />
                            ))}
                        </div>
                    )}
                </main>
            </div>

            <QuickViewModal
                product={quickViewProduct}
                onClose={() => setQuickViewProduct(null)}
                isB2BContext={isB2BContext}
            />
        </div>
    );
}

