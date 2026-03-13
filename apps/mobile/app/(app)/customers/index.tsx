import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card, Badge, colors, spacing, fontSize } from '@/components/ui';
import { getCached } from '@/lib/local-cache';
import { SafeAreaView } from 'react-native-safe-area-context';

const DEMO_CUSTOMERS = [
    { id: 'c1', name: 'Rajesh Kirana Store', area: 'Andheri West', outstanding: 125000, lastOrderDays: 3, paymentScore: 32 },
    { id: 'c2', name: 'City Mart', area: 'Bandra East', outstanding: 98000, lastOrderDays: 7, paymentScore: 45 },
    { id: 'c3', name: 'Sharma General', area: 'Juhu', outstanding: 0, lastOrderDays: 1, paymentScore: 85 },
    { id: 'c4', name: 'Quick Stop', area: 'Versova', outstanding: 45000, lastOrderDays: 5, paymentScore: 62 },
    { id: 'c5', name: 'Patel Enterprises', area: 'Goregaon', outstanding: 38000, lastOrderDays: 10, paymentScore: 72 },
];

export default function CustomersIndex() {
    const [search, setSearch] = useState('');
    const cached = getCached<any>('customers')?.data || DEMO_CUSTOMERS;
    const filtered = search.trim()
        ? cached.filter((c: any) => c.name?.toLowerCase().includes(search.toLowerCase()))
        : cached;

    const scoreVariant = (s: number) => s > 70 ? 'success' : s > 40 ? 'warning' : 'danger';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ padding: spacing.md }}>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md }}>Customers</Text>
                <TextInput value={search} onChangeText={setSearch} placeholder="Search customers..." placeholderTextColor={colors.textMuted} style={styles.search} />
            </View>

            <FlatList
                data={filtered}
                keyExtractor={(c: any) => c.id}
                contentContainerStyle={{ paddingHorizontal: spacing.md }}
                renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => router.push(`/(app)/customers/${item.id}` as any)}>
                        <Card style={{ marginBottom: spacing.sm }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' }}>{item.name}</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{item.area} • Last order: {item.lastOrderDays}d ago</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    {item.outstanding > 0 && (
                                        <Text style={{ color: colors.orange, fontSize: fontSize.sm, fontWeight: '600' }}>₹{item.outstanding.toLocaleString('en-IN')}</Text>
                                    )}
                                    <Badge label={`Score: ${item.paymentScore}`} variant={scoreVariant(item.paymentScore)} />
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
    search: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.textPrimary, fontSize: fontSize.md },
});
