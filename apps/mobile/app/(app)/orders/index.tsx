import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card, Badge, Button, colors, spacing, fontSize } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';

const DEMO_ORDERS = [
    { id: 'o1', orderNumber: '#1045', customer: 'Rajesh Kirana', amount: 12500, items: 5, status: 'CONFIRMED', time: new Date() },
    { id: 'o2', orderNumber: '#1044', customer: 'City Mart', amount: 8200, items: 3, status: 'DISPATCHED', time: new Date(Date.now() - 3600000) },
    { id: 'o3', orderNumber: '#1043', customer: 'Sharma General', amount: 4500, items: 2, status: 'DELIVERED', time: new Date(Date.now() - 86400000) },
];

export default function OrdersIndex() {
    const [tab, setTab] = useState<'today' | 'all'>('today');

    const statusVariant = (s: string) => {
        if (s === 'DELIVERED') return 'success';
        if (s === 'DISPATCHED') return 'info';
        if (s === 'CONFIRMED') return 'warning';
        return 'muted';
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={styles.header}>
                <Text style={styles.title}>Orders</Text>
                <Button title="+ New" size="sm" onPress={() => router.push('/(app)/orders/new' as any)} />
            </View>

            <View style={styles.tabs}>
                {(['today', 'all'] as const).map((t) => (
                    <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
                        <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === 'today' ? "Today's" : 'All'}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={DEMO_ORDERS}
                keyExtractor={(o) => o.id}
                contentContainerStyle={{ padding: spacing.md }}
                renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => router.push(`/(app)/orders/${item.id}` as any)}>
                        <Card style={{ marginBottom: spacing.sm }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                    <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' }}>{item.customer}</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{item.orderNumber} • {item.items} items • {format(item.time, 'hh:mm a')}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ color: colors.gold, fontSize: fontSize.md, fontWeight: '700' }}>₹{item.amount.toLocaleString('en-IN')}</Text>
                                    <Badge label={item.status} variant={statusVariant(item.status)} style={{ marginTop: 4 }} />
                                </View>
                            </View>
                        </Card>
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md },
    title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary },
    tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, marginTop: spacing.md, gap: spacing.sm },
    tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
    tabActive: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.1)' },
    tabText: { color: colors.textMuted, fontSize: fontSize.sm },
    tabTextActive: { color: colors.gold },
});
