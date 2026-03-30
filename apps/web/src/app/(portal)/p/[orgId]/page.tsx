"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, PackageSearch, ShoppingCart } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePortalOrgId, usePortalCart, usePortalAuth, portalApi } from "@/contexts/portal-context";

function ProductCard({ product, orgId, cart }: { product: any; orgId: string; cart: any }) {
    const [bulkQty, setBulkQty] = useState<number>(1);

    const handleAdd = () => {
        if (!product.isB2B) {
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
        <div className="group bg-[#1a1a1a] border border-[#222] hover:border-[var(--gold)] hover:shadow-[0_0_20px_rgba(234,179,8,0.12)] hover:-translate-y-0.5 rounded-xl overflow-hidden transition-all duration-300 flex flex-col">
            <Link href={`/p/${orgId}/product/${product.id}`} className="block relative">
                <div className="aspect-square bg-[#0a0a0a] relative p-3 flex items-center justify-center border-b border-[#222]">
                    {product.imageUrl ? (
                        <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-contain mix-blend-screen group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-14 h-14 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 text-xl font-bold">
                            {product.name.charAt(0)}
                        </div>
                    )}
                    {product.isB2B && (
                        <div className="absolute top-2 right-2 bg-[var(--gold)] text-black text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg">
                            Wholesale
                        </div>
                    )}
                </div>
            </Link>

            <div className="p-3 sm:p-4 flex flex-col flex-1">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5 font-medium">{product.category}</p>
                <Link href={`/p/${orgId}/product/${product.id}`}>
                    <h3 className="text-sm font-semibold text-zinc-100 flex-1 line-clamp-2 leading-tight hover:text-[var(--gold)] transition-colors">
                        {product.name}
                    </h3>
                </Link>
                <div className="mt-4 flex items-end justify-between">
                    <div>
                        <p className="text-[15px] font-bold text-[var(--gold)] font-mono tracking-tight">
                            ₹{product.price.toLocaleString("en-IN")}
                        </p>
                        {product.isB2B && product.price < product.originalPrice && (
                            <p className="text-[10px] text-zinc-500 line-through">
                                MRP ₹{product.originalPrice.toLocaleString("en-IN")}
                            </p>
                        )}
                    </div>

                    {!product.inStock ? (
                        <span className="text-[10px] font-bold text-red-400 bg-red-900/30 px-2 py-1 rounded-md uppercase tracking-wider self-center mb-1">
                            Out of Stock
                        </span>
                    ) : (
                        product.isB2B ? (
                            <div className="flex bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden group-hover:border-[#444] transition-colors">
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
                                    className="px-2 py-1 bg-[#222] hover:bg-[var(--gold)] hover:text-black transition-colors border-l border-[#333] flex items-center justify-center"
                                >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleAdd}
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-[var(--gold)] hover:text-black flex items-center justify-center transition-all border border-white/10 group-hover:border-[var(--gold)]/50"
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

    const { data: catalog, isLoading } = useQuery({
        queryKey: ["portal-catalog", orgId, auth.token],
        queryFn: () => portalApi.get(`/api/v1/portal/${orgId}/catalog`, auth.token),
    });

    const categories = useMemo(() => {
        if (!catalog) return [];
        const cats = new Set(catalog.map((p: any) => p.category).filter(Boolean));
        return Array.from(cats) as string[];
    }, [catalog]);

    const filteredCatalog = useMemo(() => {
        if (!catalog) return [];
        return catalog.filter((p: any) => {
            const matchesSearch =
                !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.brand?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory ? p.category === selectedCategory : true;
            return matchesSearch && matchesCategory;
        });
    }, [catalog, searchQuery, selectedCategory]);

    const addToCart = (product: any) => {
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

    return (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
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

            {/* Category Filters */}
            {categories.length > 0 && (
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${!selectedCategory ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-[0_0_15px_rgba(234,179,8,0.3)]" : "bg-[#111] text-zinc-400 border-[#333] hover:border-[var(--gold)]/50 hover:text-white"}`}
                    >
                        All
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${selectedCategory === cat ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-[0_0_15px_rgba(234,179,8,0.3)]" : "bg-[#111] text-zinc-400 border-[#333] hover:border-[var(--gold)]/50 hover:text-white"}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {/* Catalog Grid */}
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
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                    <PackageSearch className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">No products found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-6">
                    {filteredCatalog.map((product: any) => (
                        <ProductCard key={product.id} product={product} orgId={orgId} cart={cart} />
                    ))}
                </div>
            )}
        </div>
    );
}
