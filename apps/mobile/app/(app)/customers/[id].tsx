import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card, Badge, Button, colors, spacing, fontSize } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CustomerDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();

    const customer = {
        id, name: 'Rajesh Kirana Store', address: '15, MG Road, Andheri West, Mumbai 400053',
        phone: '9876543210', outstanding: 125000, paymentScore: 32,
        recentOrders: [
            { id: 'o1', number: '#1045', amount: 12500, date: '02 Mar 2026' },
            { id: 'o2', number: '#1032', amount: 8900, date: '25 Feb 2026' },
            { id: 'o3', number: '#1018', amount: 15200, date: '18 Feb 2026' },
        ],
        recentVisits: [
            { date: '02 Mar', note: 'Regular order placed' },
            { date: '25 Feb', note: 'Collection ₹10,000' },
            { date: '18 Feb', note: 'Complaint about damaged goods' },
        ],
    };

    const scoreColor = customer.paymentScore > 70 ? colors.greenBright : customer.paymentScore > 40 ? colors.gold : colors.red;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.textMuted, fontSize: 18 }}>←</Text></TouchableOpacity>
                <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', flex: 1, marginLeft: spacing.sm }}>{customer.name}</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
                {/* Contact */}
                <Card style={{ marginBottom: spacing.md }}>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 }}>Address</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.md }}>{customer.address}</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <Button title="📞 Call" variant="outline" size="sm" onPress={() => Linking.openURL(`tel:${customer.phone}`)} style={{ flex: 1 }} />
                        <Button title="💬 WhatsApp" variant="outline" size="sm" onPress={() => Linking.openURL(`https://wa.me/91${customer.phone}`)} style={{ flex: 1 }} />
                    </View>
                </Card>

                {/* Financials */}
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                    <Card style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Outstanding</Text>
                        <Text style={{ color: colors.red, fontSize: fontSize.lg, fontWeight: '800' }}>₹{(customer.outstanding / 1000).toFixed(0)}K</Text>
                    </Card>
                    <Card style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Payment Score</Text>
                        <Text style={{ color: scoreColor, fontSize: fontSize.lg, fontWeight: '800' }}>{customer.paymentScore}</Text>
                    </Card>
                </View>

                {/* Quick Actions */}
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                    <Button title="🚀 Visit" variant="primary" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/(app)/audit' as any, params: { customerId: customer.id, customerName: customer.name } })} />
                    <Button title="📦 Order" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push('/(app)/orders/new' as any)} />
                    <Button title="💰 Collect" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => router.push('/(app)/collections' as any)} />
                </View>

                {/* Recent Orders */}
                <Text style={styles.section}>Recent Orders</Text>
                {customer.recentOrders.map((o) => (
                    <TouchableOpacity key={o.id} onPress={() => router.push(`/(app)/orders/${o.id}` as any)}>
                        <View style={styles.listRow}>
                            <View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontSize: fontSize.sm }}>{o.number}</Text><Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{o.date}</Text></View>
                            <Text style={{ color: colors.gold, fontSize: fontSize.sm, fontWeight: '600' }}>₹{o.amount.toLocaleString('en-IN')}</Text>
                        </View>
                    </TouchableOpacity>
                ))}

                {/* Recent Visits */}
                <Text style={[styles.section, { marginTop: spacing.lg }]}>Recent Visits</Text>
                {customer.recentVisits.map((v, i) => (
                    <View key={i} style={styles.listRow}>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, width: 50 }}>{v.date}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 }}>{v.note}</Text>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    section: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
    listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
});
