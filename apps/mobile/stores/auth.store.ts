import { create } from 'zustand';
import { storage } from '@/lib/offline-queue';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    orgId: string;
}

interface Org {
    id: string;
    name: string;
    plan: string;
}

interface Salesman {
    id: string;
    name: string;
    phone: string;
    territory?: string;
}

interface AuthState {
    user: User | null;
    org: Org | null;
    salesman: Salesman | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    biometricsEnabled: boolean;

    setAuth: (data: { user: User; org?: Org; salesman?: Salesman; accessToken: string; refreshToken: string }) => void;
    setSalesman: (s: Salesman) => void;
    setBiometrics: (enabled: boolean) => void;
    logout: () => void;
    hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    org: null,
    salesman: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    biometricsEnabled: false,

    setAuth: ({ user, org, salesman, accessToken, refreshToken }) => {
        storage.set('auth:accessToken', accessToken);
        storage.set('auth:refreshToken', refreshToken);
        storage.set('auth:user', JSON.stringify(user));
        if (org) storage.set('auth:org', JSON.stringify(org));
        if (salesman) storage.set('auth:salesman', JSON.stringify(salesman));
        set({ user, org: org || null, salesman: salesman || null, accessToken, refreshToken, isAuthenticated: true });
    },

    setSalesman: (s) => {
        storage.set('auth:salesman', JSON.stringify(s));
        set({ salesman: s });
    },

    setBiometrics: (enabled) => {
        storage.set('auth:biometrics', enabled ? 'true' : 'false');
        set({ biometricsEnabled: enabled });
    },

    logout: () => {
        storage.delete('auth:accessToken');
        storage.delete('auth:refreshToken');
        storage.delete('auth:user');
        storage.delete('auth:org');
        storage.delete('auth:salesman');
        set({ user: null, org: null, salesman: null, accessToken: null, refreshToken: null, isAuthenticated: false });
    },

    hydrate: () => {
        try {
            const token = storage.getString('auth:accessToken');
            const refresh = storage.getString('auth:refreshToken');
            const userStr = storage.getString('auth:user');
            const orgStr = storage.getString('auth:org');
            const salesmanStr = storage.getString('auth:salesman');
            const bio = storage.getString('auth:biometrics');

            if (token && userStr) {
                set({
                    accessToken: token,
                    refreshToken: refresh || null,
                    user: JSON.parse(userStr),
                    org: orgStr ? JSON.parse(orgStr) : null,
                    salesman: salesmanStr ? JSON.parse(salesmanStr) : null,
                    isAuthenticated: true,
                    biometricsEnabled: bio === 'true',
                });
            }
        } catch { /* corrupt storage, stay logged out */ }
    },
}));
