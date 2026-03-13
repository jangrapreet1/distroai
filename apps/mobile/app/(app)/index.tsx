import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import { useSyncStore } from '@/stores/sync.store';
import { Card, Badge, Button, StatCard, SectionHeader, ListItem, colors, spacing, fontSize } from '@/components/ui';
import { getCached } from '@/lib/local-cache';
import { getPendingCount } from '@/lib/offline-queue';
import { syncOnReconnect } from '@/lib/sync-engine';
import { apiClient } from '@/lib/api-client';
import { format } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function HomeScreen() {
    const user = useAuthStore((s) => s.user);
    const { isSyncing, lastSyncAt, pendingCount } = useSyncStore();
    const [refreshing, setRefreshing] = useState(false);
    const [checkedIn, setCheckedIn] = useState(false);
    const [checkInTime, setCheckInTime] = useState<Date | null>(null);

    const route = getCached<any>('route') || [];
    const routeCustomers = Array.isArray(route) ? route : (route?.data || []);

    // Calculate today's stats from cached data
    const customers = getCached<any>('customers');
    const customerList = Array.isArray(customers) ? customers : (customers?.data || []);
    const totalOutstanding = customerList.reduce((s: number, c: any) => s + (Number(c.outstandingAmount) || 0), 0);

    const targets = [
        { emoji: '📍', value: `0/${routeCustomers.length || 8}`, label: 'Visits' },
        { emoji: '📦', value: '₹0', label: 'Orders' },
        { emoji: '💰', value: '₹0', label: 'Collections' },
        { emoji: '⚠️', value: `₹${(totalOutstanding / 1000).toFixed(0)}K`, label: 'Outstanding' },
    ];

    const quickActions = [
        { emoji: '📍', label: checkedIn ? 'Checked In ✓' : 'Check In', onPress: () => !checkedIn && handleCheckIn() },
        { emoji: '📦', label: 'New Order', onPress: () => router.push('/(app)/orders/new' as any) },
        { emoji: '💰', label: 'Collect', onPress: () => router.push('/(app)/collections' as any) },
        { emoji: '👥', label: 'Customers', onPress: () => router.push('/(app)/customers' as any) },
    ];

    const handleCheckIn = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Location Required', 'Please enable location permissions.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({});
            try {
                await apiClient.post('/api/v1/attendance/check-in', {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    timestamp: new Date().toISOString(),
                });
            } catch {
                // Will be queued offline by the API interceptor
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCheckedIn(true);
            setCheckInTime(new Date());
        } catch (err) {
            Alert.alert('Check-in Failed', 'Could not get your location.');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await syncOnReconnect();
            useSyncStore.getState().refreshPendingCount();
        } finally {
            setRefreshing(false);
        }
    }, []);

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ paddingBottom: 32 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{getGreeting()}, {user?.firstName || 'Salesman'}!</Text>
                        <Text style={styles.date}>{format(new Date(), 'EEEE, dd MMM yyyy')}</Text>
                    </View>
                    {pendingCount > 0 && (
                        <View style={styles.syncBadge}>
                            <Text style={{ color: colors.gold, fontSize: fontSize.xs, fontWeight: '700' }}>{pendingCount} pending</Text>
                        </View>
                    )}
                </View>

                {/* Check-in Status */}
                <Card style={{ marginBottom: spacing.md }}>
                    {checkedIn ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            <Badge label="Checked In" variant="success" />
                            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
                                at {checkInTime ? format(checkInTime, 'hh:mm a') : '--'}
                            </Text>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                <Text style={{ fontSize: 16 }}>⚠️</Text>
                                <Text style={{ color: colors.orange, fontSize: fontSize.sm, fontWeight: '600' }}>Not checked in</Text>
                            </View>
                            <Button title="Check In Now" size="sm" onPress={handleCheckIn} />
                        </View>
                    )}
                </Card>

                {/* Today's Targets */}
                <SectionHeader title="Today's Targets" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
                    {targets.map((t, i) => (
                        <StatCard key={i} emoji={t.emoji} value={t.value} label={t.label} width={120} />
                    ))}
                </ScrollView>

                {/* Quick Actions */}
                <SectionHeader title="Quick Actions" />
                <View style={styles.actionGrid}>
                    {quickActions.map((a, i) => (
                        <TouchableOpacity key={i} onPress={a.onPress} style={styles.actionCard} activeOpacity={0.7}>
                            <Text style={{ fontSize: 24, marginBottom: 4 }}>{a.emoji}</Text>
                            <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'center' }}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Today's Route */}
                <SectionHeader title="Your Beat Today" actionLabel={routeCustomers.length > 0 ? 'View All' : undefined} onAction={() => router.push('/(app)/route' as any)} />
                {routeCustomers.length > 0 ? (
                    <>
                        {routeCustomers.slice(0, 3).map((c: any, i: number) => (
                            <ListItem
                                key={c.id || i}
                                leftNode={
                                    <View style={styles.seqCircle}><Text style={styles.seqText}>{i + 1}</Text></View>
                                }
                                title={c.name || 'Customer'}
                                subtitle={c.area || c.address || 'Area'}
                                onPress={() => router.push(`/(app)/customers/${c.id}` as any)}
                            />
                        ))}
                    </>
                ) : (
                    <Card>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' }}>No route assigned for today. Contact your manager.</Text>
                    </Card>
                )}

                {/* Last Sync Info */}
                {lastSyncAt && (
                    <Text style={styles.syncInfo}>
                        Last synced: {format(lastSyncAt, 'hh:mm a')}
                    </Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, paddingHorizontal: spacing.md },
    header: { paddingTop: spacing.md, marginBottom: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    greeting: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary },
    date: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
    syncBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(201,168,76,0.1)', borderWidth: 1, borderColor: colors.borderAccent },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    actionCard: {
        width: '48%' as any,
        backgroundColor: colors.bgCard,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        alignItems: 'center',
    },
    seqCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
    seqText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
    syncInfo: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.lg },
});
