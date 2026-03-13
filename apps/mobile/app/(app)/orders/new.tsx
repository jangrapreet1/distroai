import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card, Button, colors, spacing, fontSize } from '@/components/ui';
import { getCached } from '@/lib/local-cache';
import { apiClient } from '@/lib/api-client';
import { enqueue } from '@/lib/offline-queue';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

interface CartItem { productId: string; name: string; price: number; qty: number }

export default function NewOrderScreen() {
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [productSearch, setProductSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);

    const customers = getCached<any>('customers')?.data || [];
    const products = getCached<any>('products')?.data || [];

    const filteredCustomers = customerSearch.trim()
        ? customers.filter((c: any) => c.name?.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 8)
        : [];

    const filteredProducts = productSearch.trim()
        ? products.filter((p: any) => p.name?.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 15)
        : products.slice(0, 10);

    const addToCart = (p: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCart((prev) => {
            const ex = prev.find((c) => c.productId === p.id);
            if (ex) return prev.map((c) => c.productId === p.id ? { ...c, qty: c.qty + 1 } : c);
            return [...prev, { productId: p.id, name: p.name, price: p.sellingPrice || 0, qty: 1 }];
        });
    };

    const updateQty = (id: string, d: number) => setCart((prev) => prev.map((c) => c.productId === id ? { ...c, qty: Math.max(0, c.qty + d) } : c).filter((c) => c.qty > 0));
    const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

    const submit = async () => {
        if (!selectedCustomer || cart.length === 0) return;
        const payload = { customerId: selectedCustomer.id, items: cart.map((c) => ({ productId: c.productId, quantity: c.qty, price: c.price })), source: 'APP' };
        try {
            await apiClient.post('/api/v1/orders', payload);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Order Placed!', `₹${total.toLocaleString('en-IN')}`);
            router.back();
        } catch {
            enqueue({ type: 'CREATE_ORDER', payload });
            Alert.alert('Saved Offline');
            router.back();
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.textMuted, fontSize: 18 }}>←</Text></TouchableOpacity>
                <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' }}>New Order</Text>
                <View style={{ width: 24 }} />
            </View>

            {!selectedCustomer ? (
                <View style={{ padding: spacing.md }}>
                    <TextInput value={customerSearch} onChangeText={setCustomerSearch} placeholder="Search customer..." placeholderTextColor={colors.textMuted} style={styles.search} autoFocus />
                    <FlatList
                        data={filteredCustomers}
                        keyExtractor={(c: any) => c.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity onPress={() => { setSelectedCustomer(item); setCustomerSearch(''); }} style={styles.row}>
                                <Text style={{ color: colors.textPrimary, fontSize: fontSize.md }}>{item.name}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{item.area || item.address || ''}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <Card style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: colors.gold, fontSize: fontSize.md, fontWeight: '600' }}>{selectedCustomer.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedCustomer(null)}><Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Change</Text></TouchableOpacity>
                        </View>
                    </Card>

                    <View style={{ paddingHorizontal: spacing.md }}><TextInput value={productSearch} onChangeText={setProductSearch} placeholder="Search products..." placeholderTextColor={colors.textMuted} style={styles.search} /></View>

                    <FlatList
                        data={filteredProducts}
                        keyExtractor={(p: any) => p.id}
                        renderItem={({ item: p }) => (
                            <TouchableOpacity onPress={() => addToCart(p)} style={styles.row}>
                                <View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontSize: fontSize.sm }}>{p.name}</Text><Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>₹{(p.sellingPrice || 0).toLocaleString('en-IN')}</Text></View>
                                <Text style={{ color: colors.purple, fontWeight: '600' }}>+ Add</Text>
                            </TouchableOpacity>
                        )}
                        ListFooterComponent={
                            cart.length > 0 ? (
                                <View style={{ padding: spacing.md }}>
                                    {cart.map((c) => (
                                        <View key={c.productId} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                            <Text style={{ color: colors.textPrimary, flex: 1, fontSize: fontSize.sm }}>{c.name}</Text>
                                            <TouchableOpacity onPress={() => updateQty(c.productId, -1)} style={styles.qtyBtn}><Text style={styles.qtyText}>−</Text></TouchableOpacity>
                                            <Text style={{ color: colors.textPrimary, width: 28, textAlign: 'center' }}>{c.qty}</Text>
                                            <TouchableOpacity onPress={() => updateQty(c.productId, 1)} style={styles.qtyBtn}><Text style={styles.qtyText}>+</Text></TouchableOpacity>
                                            <Text style={{ color: colors.gold, width: 70, textAlign: 'right', fontSize: fontSize.sm }}>₹{(c.price * c.qty).toLocaleString('en-IN')}</Text>
                                        </View>
                                    ))}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.sm }}>
                                        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.lg }}>Total</Text>
                                        <Text style={{ color: colors.gold, fontWeight: '700', fontSize: fontSize.lg }}>₹{total.toLocaleString('en-IN')}</Text>
                                    </View>
                                    <Button title="Place Order" onPress={submit} size="lg" />
                                </View>
                            ) : null
                        }
                    />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
    search: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.textPrimary, fontSize: fontSize.md, marginBottom: spacing.sm },
    row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgCardHover, alignItems: 'center', justifyContent: 'center' },
    qtyText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
});
