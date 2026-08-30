"use client";

import Link from "next/link";
import { formatINR } from "./kpi-card";
import { ScoreRing } from "./score-ring";

interface TopProduct {
    productId?: string;
    id?: string;
    productName?: string;
    name?: string;
    revenue?: number;
    _sum?: { totalAmount: number };
}

interface TopCustomer {
    id: string;
    name: string;
    outstandingAmount?: number;
    revenue?: number;
    paymentScore?: number;
    orderCount?: number;
}

export function TopLists({ topProducts, topCustomers, t }: {
    topProducts: any[];
    topCustomers: any[];
    t: (key: string) => string;
}) {
    return (
        <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                <h3 className="font-semibold mb-4">{t('top_products')}</h3>
                <div className="space-y-3">
                    {topProducts.length > 0 ? topProducts.map((p, i) => {
                        const rev = p.revenue ?? p._sum?.totalAmount ?? 0;
                        const firstRev = topProducts[0]?.revenue ?? topProducts[0]?._sum?.totalAmount ?? 1;
                        const maxRev = firstRev > 0 ? firstRev : 1;
                        const prodName = p.name ?? p.productName ?? p.productId ?? "Product";
                        const prodKey = p.id ?? p.productId ?? `prod-${i}`;
                        return (
                            <div key={prodKey} className="flex items-center gap-3">
                                <span className="text-sm font-bold text-[var(--text-muted)] w-5">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{prodName}</p>
                                    <div className="h-1.5 rounded-full bg-[var(--border)] mt-1">
                                        <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.min(100, (rev / maxRev) * 100)}%` }} />
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{formatINR(rev)}</p>
                                </div>
                            </div>
                        );
                    }) : (
                        <p className="text-sm text-[var(--text-muted)]">{t('no_product_data')}</p>
                    )}
                </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                <h3 className="font-semibold mb-4">{t('top_customers')}</h3>
                <div className="space-y-3">
                    {topCustomers.length > 0 ? topCustomers.map((c, i) => (
                        <Link key={c.id} href={`/customers/${c.id}`}>
                            <div className="flex items-center gap-3 hover:bg-[var(--bg-card-hover)] rounded-lg p-1 -m-1 transition">
                                <span className="text-sm font-bold text-[var(--text-muted)] w-5">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{c.name}</p>
                                    <p className="text-xs text-[var(--text-muted)]">{t('outstanding')}: {formatINR(c.outstandingAmount ?? 0)}</p>
                                </div>
                                <div className="relative shrink-0">
                                    <ScoreRing score={c.paymentScore ?? 50} />
                                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ fontFamily: "var(--font-mono)" }}>{c.paymentScore ?? 50}</span>
                                </div>
                            </div>
                        </Link>
                    )) : (
                        <p className="text-sm text-[var(--text-muted)]">{t('no_customer_data')}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
