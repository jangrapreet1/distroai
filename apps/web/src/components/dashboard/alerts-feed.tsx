"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

interface Alert {
    type: string;
    message: string;
    action: string;
    color: string;
    href?: string;
    secondaryAction?: { label: string; href?: string; onClick?: (e: React.MouseEvent) => void; icon?: React.ElementType };
}

export function AlertsFeed({ alerts, t }: { alerts: Alert[]; t: (key: string) => string }) {
    return (
        <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{t('alerts')}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--red)]/15 text-[var(--red)]">{alerts.length}</span>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
                {alerts.map((alert, i) => (
                    <Link key={i} href={alert.href ?? "#"} className="block group">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition">
                            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: alert.color }} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-[var(--text-primary)] mb-1">{alert.message}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1"><Clock size={10} />{t('now')}</span>
                                    <div className="flex items-center gap-3">
                                        {alert.secondaryAction && (
                                            alert.secondaryAction.href ? (
                                                <Link href={alert.secondaryAction.href} className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/30 transition shadow-sm z-10 relative">
                                                    {alert.secondaryAction.icon && <alert.secondaryAction.icon size={10} />}
                                                    {alert.secondaryAction.label}
                                                </Link>
                                            ) : (
                                                <button onClick={(e) => { e.preventDefault(); alert.secondaryAction?.onClick?.(e); }} className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/30 transition shadow-sm z-10 relative">
                                                    {alert.secondaryAction.icon && <alert.secondaryAction.icon size={10} />}
                                                    {alert.secondaryAction.label}
                                                </button>
                                            )
                                        )}
                                        {alert.action && <span className="text-xs font-medium hover:underline transition" style={{ color: alert.color }}>{alert.action}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
