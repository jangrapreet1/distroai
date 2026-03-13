import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card, Badge, Button, colors, spacing, fontSize } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/lib/api-client';
import { enqueue } from '@/lib/offline-queue';
import * as Haptics from 'expo-haptics';

export default function OrderDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [status, setStatus] = useState('DISPATCHED');
    const [marking, setMarking] = useState(false);

    // In production this would fetch from API/cache
    const order = {
        id,
        orderNumber: '#1045',
        customer: 'Rajesh Kirana Store',
        amount: 12500,
        items: [
            { name: 'Parle-G 800g', qty: 10, price: 35, total: 350 },
            { name: 'Surf Excel 1kg', qty: 5, price: 185, total: 925 },
            { name: 'Maggi 70g x4', qty: 20, price: 56, total: 1120 },
        ],
        timeline: [
            { status: 'CONFIRMED', time: '10:30 AM', date: 'Today' },
            { status: 'DISPATCHED', time: '2:15 PM', date: 'Today' },
            ...(status === 'DELIVERED' ? [{ status: 'DELIVERED', time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), date: 'Today' }] : []),
        ],
    };

    const markDelivered = async () => {
        setMarking(true);
        try {
            await apiClient.patch(`/api/v1/orders/${id}`, { status: 'DELIVERED' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
            enqueue({ type: 'UPDATE_ORDER', payload: { orderId: id, status: 'DELIVERED' } });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setStatus('DELIVERED');
        setMarking(false);
        Alert.alert('✅ Delivered', 'Order marked as delivered.');
    };

    const statusVariant = (s: string) => s === 'DELIVERED' ? 'success' : s === 'DISPATCHED' ? 'info' : 'warning';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.textMuted, fontSize: 18 }}>←</Text></TouchableOpacity>
                <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' }}>{order.orderNumber}</Text>
                <Badge label={status} variant={statusVariant(status)} />
            </View>

            <ScrollView contentContainerStyle={{ padding: spacing.md }}>
                <Card style={{ marginBottom: spacing.md }}>
                    <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Customer</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '600' }}>{order.customer}</Text>
                    <Text style={{ color: colors.gold, fontSize: fontSize.xl, fontWeight: '800', marginTop: 8 }}>₹{order.amount.toLocaleString('en-IN')}</Text>
                </Card>

                <Text style={styles.section}>Items</Text>
                {order.items.map((item, i) => (
                    <View key={i} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm }}>{item.name}</Text>
                            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{item.qty} × ₹{item.price}</Text>
                        </View>
                        <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm }}>₹{item.total.toLocaleString('en-IN')}</Text>
                    </View>
                ))}

                <Text style={[styles.section, { marginTop: spacing.lg }]}>Timeline</Text>
                {order.timeline.map((t, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                        <View style={{ alignItems: 'center', width: 16 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.status === 'DELIVERED' ? colors.greenBright : colors.purple }} />
                            {i < order.timeline.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 }} />}
                        </View>
                        <View>
                            <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' }}>{t.status}</Text>
                            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{t.date} at {t.time}</Text>
                        </View>
                    </View>
                ))}

                {status !== 'DELIVERED' && (
                    <Button title="✅ Mark Delivered" variant="secondary" size="lg" loading={marking} style={{ marginTop: spacing.lg }} onPress={markDelivered} />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
    section: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
});
