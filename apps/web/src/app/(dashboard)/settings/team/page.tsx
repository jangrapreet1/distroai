"use client";

import { useState } from "react";
import { Users, UserPlus, X, Shield, Truck, Receipt } from "lucide-react";
import { useSubscription, useTeamOverview, useCreateTeamMember, useToggleUserActive, useUpdateUserRole } from "@/hooks/api-hooks";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { SettingsLayout } from "@/components/ui/settings-layout";

function InputField({ label, value, onChange, type = "text", placeholder }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
    return (
        <label>
            <span className="block text-sm text-[var(--text-secondary)] mb-1">{label}</span>
            <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition text-sm" />
        </label>
    );
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    OWNER: { label: 'Owner', color: 'var(--gold)', icon: Shield },
    ADMIN: { label: 'Admin', color: 'var(--gold)', icon: Shield },
    MANAGER: { label: 'Manager', color: 'var(--blue, #3b82f6)', icon: Users },
    SALESMAN: { label: 'Field Agent', color: 'var(--green-bright)', icon: Truck },
    ACCOUNTANT: { label: 'Accountant', color: 'var(--orange)', icon: Receipt },
    VIEWER: { label: 'Viewer', color: 'var(--text-muted)', icon: Users },
};

function TeamTab() {
    const { data: subData } = useSubscription();
    const { data, isLoading } = useTeamOverview();
    const createMember = useCreateTeamMember();
    const toggleActive = useToggleUserActive();
    const updateRole = useUpdateUserRole();
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', role: 'SALESMAN' });

    const teamData = data?.data ?? data ?? {};
    const members = teamData?.members ?? [];
    const counts = teamData?.counts ?? { total: 0, active: 0, inactive: 0 };
    const sub = subData?.data ?? subData ?? {};
    const maxUsers = sub?.limits?.users?.max ?? 999999;
    const isLimitReached = counts.total >= maxUsers;

    const handleAdd = () => {
        if (!form.firstName || !form.email) { toast.error('Name and email are required'); return; }
        createMember.mutate(form, {
            onSuccess: (res: any) => {
                const tp = res?.tempPassword;
                toast.success(tp ? `Member added! Temp password: ${tp}` : 'Member added successfully!');
                setShowAdd(false);
                setForm({ firstName: '', lastName: '', phone: '', email: '', role: 'SALESMAN' });
            },
            onError: (err: any) => {
                const msg =
                    err?.response?.data?.error?.message ||
                    err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    err?.message ||
                    'Failed to add member';
                toast.error(typeof msg === 'string' ? msg : 'Failed to add member');
            },
        });
    };

    const handleToggle = (userId: string, name: string, currentlyActive: boolean) => {
        toggleActive.mutate(userId, {
            onSuccess: () => toast.success(`${name} is now ${currentlyActive ? 'inactive' : 'active'}`),
            onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed'),
        });
    };

    if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Total Members', value: counts.total, color: 'var(--text-primary)' },
                { label: 'Active', value: counts.active, color: 'var(--green-bright)' },
                { label: 'Inactive', value: counts.inactive, color: 'var(--red)' }].map(s => (
                    <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-4 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">{s.label}</p>
                        <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between">
                <h2 className="font-semibold" style={{ fontFamily: 'var(--font-playfair)' }}>Team Members</h2>
                <button onClick={() => setShowAdd(true)} disabled={isLimitReached} title={isLimitReached ? "Plan user limit reached" : ""}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] transition ${isLimitReached ? 'bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed hidden' : 'bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)]'}`}>
                    <UserPlus size={16} /> Add Member
                </button>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                            <th className="text-left p-4">Member</th>
                            <th className="text-left p-4 hidden md:table-cell">Phone</th>
                            <th className="text-center p-4">Role</th>
                            <th className="text-center p-4 hidden sm:table-cell">Last Login</th>
                            <th className="text-center p-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">
                                <Users size={32} className="mx-auto mb-2 opacity-30" />No team members yet
                            </td></tr>
                        ) : members.map((m: any) => {
                            const rc = ROLE_CONFIG[m.role] ?? ROLE_CONFIG.VIEWER;
                            const RoleIcon = rc.icon;
                            return (
                                <tr key={m.id} className={`border-b border-[var(--border)] transition ${m.isActive ? 'hover:bg-[var(--bg-card-hover)]' : 'opacity-50'}`}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${rc.color}15`, color: rc.color }}>
                                                {m.firstName?.[0]}{m.lastName?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-medium">{m.firstName} {m.lastName}</p>
                                                <p className="text-xs text-[var(--text-muted)]">{m.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-[var(--text-secondary)] hidden md:table-cell">{m.phone ?? '—'}</td>
                                    <td className="p-4 text-center">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${rc.color}12`, color: rc.color }}>
                                            <RoleIcon size={10} /> {rc.label}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center text-xs text-[var(--text-muted)] hidden sm:table-cell">
                                        {m.lastLoginAt ? formatDistanceToNow(new Date(m.lastLoginAt), { addSuffix: true }) : 'Never'}
                                    </td>
                                    <td className="p-4 text-center">
                                        {m.role === 'OWNER' ? (
                                            <span className="text-xs text-[var(--gold)] font-medium">Owner</span>
                                        ) : (
                                            <button onClick={() => handleToggle(m.id, m.firstName, m.isActive)} disabled={toggleActive.isPending}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${m.isActive ? 'bg-[var(--green-bright)]' : 'bg-[var(--text-muted)]/30'}`}>
                                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform ${m.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAdd(false)}>
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-playfair)' }}>Add Team Member</h3>
                            <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="First Name *" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} placeholder="Ramesh" />
                                <InputField label="Last Name" value={form.lastName} onChange={v => setForm(f => ({ ...f, lastName: v }))} placeholder="Kumar" />
                            </div>
                            <InputField label="Email *" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" placeholder="ramesh@company.com" />
                            <InputField label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="9876543210" />
                            <label>
                                <span className="block text-sm text-[var(--text-secondary)] mb-1">Role</span>
                                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition text-sm">
                                    <option value="MANAGER">Manager</option>
                                    <option value="SALESMAN">Field Agent / Salesman</option>
                                    <option value="ACCOUNTANT">Accountant</option>
                                    <option value="VIEWER">Viewer (Read-only)</option>
                                </select>
                            </label>
                            <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-card)] p-3 rounded-[var(--radius-md)] border border-[var(--border)]">
                                A temporary password will be generated and sent via WhatsApp. The user will be asked to change it on first login.
                            </p>
                        </div>
                        <div className="p-5 border-t border-[var(--border)] flex gap-3 justify-end">
                            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-[var(--text-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] hover:bg-[var(--bg-card)] transition">Cancel</button>
                            <button onClick={handleAdd} disabled={createMember.isPending} className="px-6 py-2 text-sm font-semibold bg-[var(--gold)] text-[var(--bg-primary)] rounded-[var(--radius-md)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition flex items-center gap-2">
                                {createMember.isPending ? <div className="w-4 h-4 border-2 border-[var(--bg-primary)] border-t-transparent rounded-full animate-spin" /> : <UserPlus size={14} />}
                                {createMember.isPending ? 'Adding...' : 'Add Member'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TeamSettingsPage() {
    return (
        <SettingsLayout title="Users & Roles" description="Manage access, invite team members, and assign role-based permissions to users.">
            <TeamTab />
        </SettingsLayout>
    );
}
