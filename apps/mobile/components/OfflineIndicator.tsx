import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSyncStore } from '@/stores/sync.store';
import { colors, fontSize, spacing } from '@/components/ui';

export function OfflineIndicator() {
    const netInfo = useNetInfo();
    const { isSyncing, pendingCount } = useSyncStore();
    const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

    if (isOnline && pendingCount === 0 && !isSyncing) return null;

    if (isSyncing) {
        return (
            <View style={[styles.banner, { backgroundColor: 'rgba(201,168,76,0.12)' }]}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={[styles.text, { color: colors.gold }]}>Syncing {pendingCount} items...</Text>
            </View>
        );
    }

    if (isOnline && pendingCount > 0) {
        return (
            <View style={[styles.banner, { backgroundColor: 'rgba(201,168,76,0.12)' }]}>
                <Text style={[styles.text, { color: colors.gold }]}>⏳ {pendingCount} pending</Text>
            </View>
        );
    }

    return (
        <View style={[styles.banner, { backgroundColor: 'rgba(224,123,96,0.12)' }]}>
            <Text style={[styles.text, { color: colors.red }]}>📵 Offline — data saved locally</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
    },
    text: { fontSize: fontSize.xs, fontWeight: '600' },
});
