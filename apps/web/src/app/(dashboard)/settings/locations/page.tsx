"use client";

import { useState } from "react";
import { SettingsLayout } from "@/components/ui/settings-layout";
import { useWarehouses, useCreateWarehouse, useUpdateWarehouse } from "@/hooks/api-hooks";
import { Plus, Edit2, X, MapPin } from "lucide-react";
import toast from "react-hot-toast";

function InputField({ label, value, onChange, placeholder = "", required = false }: any) {
    return (
        <label className="block mb-3">
            <span className="block text-sm text-[var(--text-secondary)] mb-1">
                {label} {required && <span className="text-[var(--red)]">*</span>}
            </span>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--gold)] focus:outline-none transition"
            />
        </label>
    );
}

function WarehouseModal({ isOpen, onClose, initialData = null }: any) {
    const isEdit = !!initialData;
    const createWarehouse = useCreateWarehouse();
    const updateWarehouse = useUpdateWarehouse();

    const [form, setForm] = useState({
        name: initialData?.name || "",
        code: initialData?.code || "",
        address: initialData?.address || "",
        city: initialData?.city || "",
        state: initialData?.state || "",
        pincode: initialData?.pincode || "",
        isDefault: initialData?.isDefault || false,
    });

    const isPending = createWarehouse.isPending || updateWarehouse.isPending;

    if (!isOpen) return null;

    const handleSave = () => {
        if (!form.name || !form.code) {
            toast.error("Name and Code are required");
            return;
        }

        if (isEdit) {
            updateWarehouse.mutate({ id: initialData.id, data: form }, {
                onSuccess: () => onClose()
            });
        } else {
            createWarehouse.mutate(form, {
                onSuccess: () => onClose()
            });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-playfair)' }}>
                        {isEdit ? "Edit Location" : "Add Location"}
                    </h3>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={20} /></button>
                </div>
                <div className="p-5 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                        <InputField label="Name" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} placeholder="Main Godown" required />
                        <InputField label="Code" value={form.code} onChange={(v: string) => setForm({ ...form, code: v.toUpperCase() })} placeholder="WH01" required />
                    </div>
                    <InputField label="Address" value={form.address} onChange={(v: string) => setForm({ ...form, address: v })} placeholder="123 Industrial Area" />
                    <div className="grid grid-cols-2 gap-3">
                        <InputField label="City" value={form.city} onChange={(v: string) => setForm({ ...form, city: v })} />
                        <InputField label="Pincode" value={form.pincode} onChange={(v: string) => setForm({ ...form, pincode: v })} />
                    </div>
                    <label className="flex items-center gap-3 mt-4 cursor-pointer">
                        <div className={`w-10 h-6 mx-1 rounded-full relative transition ${form.isDefault ? "bg-[var(--green)]/30" : "bg-[var(--border)]"}`} onClick={() => setForm({ ...form, isDefault: !form.isDefault })}>
                            <div className={`w-4 h-4 rounded-full absolute top-1 transition-all ${form.isDefault ? "right-1 bg-[var(--green-bright)]" : "left-1 bg-[var(--text-muted)]"}`} />
                        </div>
                        <span className="text-sm font-medium">Set as Default Warehouse</span>
                    </label>
                </div>
                <div className="p-5 border-t border-[var(--border)] flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] hover:bg-[var(--bg-card)] transition">Cancel</button>
                    <button onClick={handleSave} disabled={isPending} className="px-6 py-2 text-sm font-semibold bg-[var(--gold)] text-[var(--bg-primary)] rounded-[var(--radius-md)] hover:bg-[var(--gold-light)] disabled:opacity-50 transition">
                        {isPending ? 'Saving...' : 'Save Location'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function LocationsSettingsPage() {
    const { data, isLoading } = useWarehouses();
    const warehouses = data?.data ?? data ?? [];
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<any>(null);

    return (
        <SettingsLayout title="Locations & Warehouses" description="Manage your godowns, branches, and fulfillment centers.">
            <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                        <MapPin size={20} className="text-[var(--gold)]" /> Your Locations
                    </h2>
                    <button
                        onClick={() => { setEditData(null); setModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[var(--gold)] text-[var(--bg-primary)] rounded-[var(--radius-md)] hover:bg-[var(--gold-light)] transition"
                    >
                        <Plus size={16} /> Add Location
                    </button>
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        <div className="h-20 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
                        <div className="h-20 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
                    </div>
                ) : warehouses.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-[var(--border)] rounded-lg text-[var(--text-muted)]">
                        <MapPin size={40} className="mx-auto mb-3 opacity-20" />
                        <p>No locations defined.</p>
                        <p className="text-xs mt-1">Add a warehouse to track separate stock batches.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {warehouses.map((wh: any) => (
                            <div key={wh.id} className="relative bg-[var(--bg-secondary)] border border-[var(--border)] p-5 rounded-[var(--radius-lg)] hover:border-[var(--gold)]/30 transition group">
                                {wh.isDefault && (
                                    <span className="absolute top-4 right-4 px-2 py-0.5 text-[10px] font-bold bg-[var(--green)]/10 text-[var(--green-bright)] rounded-full border border-[var(--green)]/20 uppercase tracking-widest">
                                        Default
                                    </span>
                                )}
                                <div className="flex items-start justify-between">
                                    <div className="pr-12">
                                        <h3 className="font-bold text-[var(--text-primary)] text-lg mb-1">{wh.name}</h3>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="font-mono text-xs bg-[var(--bg-primary)] px-2 py-1 rounded text-[var(--gold)] border border-[var(--border)]">{wh.code}</span>
                                        </div>
                                        <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-2 min-h-[32px]">
                                            {wh.address ? `${wh.address}, ${wh.city || ''} ${wh.pincode || ''}` : 'No address provided'}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-end">
                                    <button
                                        onClick={() => { setEditData(wh); setModalOpen(true); }}
                                        className="text-xs flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--gold)] transition font-medium"
                                    >
                                        <Edit2 size={12} /> Edit Details
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalOpen && (
                <WarehouseModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    initialData={editData}
                />
            )}
        </SettingsLayout>
    );
}
