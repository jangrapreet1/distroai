import * as Notifications from 'expo-notifications';
import * as Device from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from './api-client';
import { storage } from './offline-queue';
import { router } from 'expo-router';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Save token locally
    storage.set('push:token', token);

    // Send token to backend
    try {
        await apiClient.patch(`/api/v1/users/${userId}`, { pushToken: token });
    } catch {
        // Will retry on next login
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#C9A84C',
        });
    }

    return token;
}

export function setupNotificationListeners() {
    // Handle notification tap (app in foreground or background)
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;

        if (data?.screen) {
            switch (data.screen) {
                case 'order':
                    router.push(`/(app)/orders/${data.id}` as any);
                    break;
                case 'customer':
                    router.push(`/(app)/customers/${data.id}` as any);
                    break;
                case 'collection':
                    router.push('/(app)/collections' as any);
                    break;
                default:
                    router.push('/(app)' as any);
            }
        }
    });

    return subscription;
}
