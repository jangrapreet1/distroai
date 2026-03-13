import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from './auth.store';

describe('useAuthStore', () => {
    beforeEach(() => {
        // Clear the store before each test
        const { logout } = useAuthStore.getState();
        act(() => logout());
    });

    it('should initialize with disconnected state', () => {
        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.org).toBeNull();
        expect(state.accessToken).toBeNull();
        expect(state.refreshToken).toBeNull();
        expect(state.isAuthenticated).toBe(false);
    });

    it('should set auth data correctly', () => {
        const mockUser = { id: '1', email: 'test@company.com', firstName: 'Test', role: 'ADMIN' };
        const mockOrg = { id: '1', name: 'Test Org', plan: 'PRO' };
        const mockTokens = { accessToken: 'access-123', refreshToken: 'refresh-123' };

        act(() => {
            useAuthStore.getState().setAuth(mockUser, mockOrg, mockTokens);
        });

        const state = useAuthStore.getState();
        expect(state.user).toEqual(mockUser);
        expect(state.org).toEqual(mockOrg);
        expect(state.accessToken).toBe(mockTokens.accessToken);
        expect(state.refreshToken).toBe(mockTokens.refreshToken);
        expect(state.isAuthenticated).toBe(true);
    });

    it('should clear auth data on logout', () => {
        // First set data
        const mockUser = { id: '1', email: 'test@company.com', firstName: 'Test', role: 'ADMIN' };
        const mockOrg = { id: '1', name: 'Test Org', plan: 'PRO' };
        const mockTokens = { accessToken: 'access-123', refreshToken: 'refresh-123' };

        act(() => {
            useAuthStore.getState().setAuth(mockUser, mockOrg, mockTokens);
        });

        expect(useAuthStore.getState().isAuthenticated).toBe(true);

        // Then logout
        act(() => {
            useAuthStore.getState().logout();
        });

        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.org).toBeNull();
        expect(state.accessToken).toBeNull();
        expect(state.refreshToken).toBeNull();
        expect(state.isAuthenticated).toBe(false);
    });

    it('should update tokens correctly', () => {
        const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };

        act(() => {
            useAuthStore.getState().setTokens(newTokens);
        });

        const state = useAuthStore.getState();
        expect(state.accessToken).toBe(newTokens.accessToken);
        expect(state.refreshToken).toBe(newTokens.refreshToken);
    });
});
