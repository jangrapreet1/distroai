import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, Linking } from 'react-native';
import { Card, Badge, Button, Input, colors, spacing, fontSize } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/lib/api-client';
import { enqueue } from '@/lib/offline-queue';
import * as Haptics from 'expo-haptics';

const DEMO_CUSTOMERS = [
    { id: 'c1', name: 'Rajesh Kirana Store', phone: '9876543210', outstanding: 125000, daysOverdue: 45 },
    { id: 'c2', name: 'City Mart', phone: '9876543211', outstanding: 98000, daysOverdue: 38 },
    { id: 'c3', name: 'Sharma General', phone: '9876543212', outstanding: 67000, daysOverdue: 28 },
    { id: 'c4', name: 'Quick Stop', phone: '9876543213', outstanding: 45000, daysOverdue: 22 },
    { id: 'c5', name: 'Patel Enterprises', phone: '9876543214', outstanding: 38000, daysOverdue: 15 },
];

export default function CollectionsScreen() {
    const [collecting, setCollecting] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<'Cash' | 'UPI' | 'Cheque' | 'Bank'>('Cash');
    const totalTarget = 200000;
    const collected = 75000;
    const progress = Math.min(collected / totalTarget, 1);

    const daysVariant = (d: number) => d > 30 ? 'danger' : d > 15 ? 'warning' : 'muted';

    const recordPayment = async (customerId: string) => {
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) return;
        const payload = { customerId, amount: amt, method };
        try {
            await apiClient.post('/api/v1/payments', payload);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Collected', `₹${amt.toLocaleString('en-IN')}`);
        } catch {
            enqueue({ type: 'RECORD_COLLECTION', payload });
            Alert.alert('Saved Offline');
        }
        setCollecting(null);
        setAmount('');
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ padding: spacing.md }}>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary }}>Collections</Text>

                {/* Progress bar */}
                <Card style={{ marginTop: spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Today's Collections</Text>
                        <Text style={{ color: colors.gold, fontSize: fontSize.sm, fontWeight: '700' }}>₹{collected.toLocaleString('en-IN')} / ₹{(totalTarget / 1000).toFixed(0)}K</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: colors.bgCardHover, borderRadius: 3 }}>
                        <View style={{ height: 6, width: `${progress * 100}%`, backgroundColor: colors.gold, borderRadius: 3 } as any} />
                    </View>
                </Card>
            </View>

            <FlatList
                data={DEMO_CUSTOMERS}
                keyExtractor={(c) => c.id}
                contentContainerStyle={{ paddingHorizontal: spacing.md }}
                renderItem={({ item }) => (
                    <Card style={{ marginBottom: spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' }}>{item.name}</Text>
                                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4 }}>
                                    <Text style={{ color: colors.red, fontSize: fontSize.sm, fontWeight: '700' }}>₹{item.outstanding.toLocaleString('en-IN')}</Text>
                                    <Badge label={`${item.daysOverdue}d overdue`} variant={daysVariant(item.daysOverdue)} />
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)} style={styles.iconBtn}>
                                    <Text>📞</Text>
                                </TouchableOpacity>
                                <Button title="Collect" size="sm" onPress={() => { setCollecting(item.id); setAmount(String(item.outstanding)); }} />
                            </View>
                        </View>

                        {collecting === item.id && (
                            <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                                <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" containerStyle={{ marginBottom: spacing.sm }} />
                                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                                    {(['Cash', 'UPI', 'Cheque', 'Bank'] as const).map((m) => (
                                        <TouchableOpacity key={m} onPress={() => setMethod(m)} style={[styles.methodBtn, method === m && styles.methodActive]}>
                                            <Text style={{ color: method === m ? colors.gold : colors.textMuted, fontSize: fontSize.xs }}>{m}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Button title="Record" onPress={() => recordPayment(item.id)} />
                            </View>
                        )}
                    </Card>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgCardHover, alignItems: 'center', justifyContent: 'center' },
    methodBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
    methodActive: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.1)' },
});
