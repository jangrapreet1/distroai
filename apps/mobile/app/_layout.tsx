import React, { useEffect } from 'react';
import { Slot, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, AppState, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { startNetworkListener, stopNetworkListener } from '@/lib/sync-engine';
import { registerForPushNotifications, setupNotificationListeners } from '@/lib/notifications';
import { recordBackground, shouldPromptBiometric, authenticateWithBiometrics } from '@/lib/biometrics';
import { colors } from '@/components/ui';

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

export default function RootLayout() {
    const hydrate = useAuthStore((s) => s.hydrate);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const user = useAuthStore((s) => s.user);

    useEffect(() => {
        hydrate();
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            startNetworkListener();
            router.replace('/(app)');

            // Register push token
            if (user?.id) {
                registerForPushNotifications(user.id);
            }

            // Listen for notification taps
            const sub = setupNotificationListeners();
            return () => sub.remove();
        } else {
            stopNetworkListener();
            router.replace('/(auth)/login');
        }
    }, [isAuthenticated]);

    // Biometric lock on app resume
    useEffect(() => {
        const handleAppState = async (next: AppStateStatus) => {
            if (next === 'background' || next === 'inactive') {
                recordBackground();
            }
            if (next === 'active' && isAuthenticated && shouldPromptBiometric()) {
                const ok = await authenticateWithBiometrics();
                if (!ok) {
                    useAuthStore.getState().logout();
                }
            }
        };

        const subscription = AppState.addEventListener('change', handleAppState);
        return () => subscription.remove();
    }, [isAuthenticated]);

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
            <QueryClientProvider client={queryClient}>
                <StatusBar style="light" />
                <View style={{ flex: 1, backgroundColor: colors.bg }}>
                    <Slot />
                </View>
            </QueryClientProvider>
        </GestureHandlerRootView>
    );
}
