import React, { useState } from 'react';
import { View, Text, ScrollView, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card, Button, Badge, Input, SectionHeader, colors, spacing, fontSize, radius } from '@/components/ui';
import { getCached } from '@/lib/local-cache';
import { enqueue } from '@/lib/offline-queue';
import { useSyncStore } from '@/stores/sync.store';
import { apiClient } from '@/lib/api-client';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

interface CartItem { productId: string; name: string; price: number; qty: number }

const TABS = ['ORDER', 'COLLECT', 'AUDIT', 'NOTES'] as const;

export default function VisitScreen() {
    const params = useLocalSearchParams<{ customerId?: string; customerName?: string }>();
    const customerName = params.customerName || 'Customer Visit';

    const [tab, setTab] = useState<typeof TABS[number]>('ORDER');
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [collectionAmt, setCollectionAmt] = useState('');
    const [payMethod, setPayMethod] = useState<'Cash' | 'UPI' | 'Cheque' | 'Bank'>('Cash');
    const [notes, setNotes] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [auditImages, setAuditImages] = useState<string[]>([]);

    const cachedProducts = getCached<any>('products');
    const productList = Array.isArray(cachedProducts) ? cachedProducts : (cachedProducts?.data || []);

    const filteredProducts = search.trim()
        ? productList.filter((p: any) => p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())).slice(0, 20)
        : productList.slice(0, 10);

    // === ORDER TAB ===
    const addToCart = (p: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCart((prev) => {
            const existing = prev.find((c) => c.productId === p.id);
            if (existing) return prev.map((c) => c.productId === p.id ? { ...c, qty: c.qty + 1 } : c);
            return [...prev, { productId: p.id, name: p.name, price: p.sellingPrice || p.mrp || 0, qty: 1 }];
        });
    };

    const updateQty = (productId: string, delta: number) => {
        setCart((prev) => prev.map((c) => c.productId === productId ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter((c) => c.qty > 0));
    };

    const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);

    const placeOrder = async () => {
        if (cart.length === 0) return;
        const payload = {
            customerId: params.customerId,
            items: cart.map((c) => ({ productId: c.productId, quantity: c.qty, price: c.price })),
            source: 'APP',
        };
        try {
            await apiClient.post('/api/v1/orders', payload);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Order Placed!', `₹${cartTotal.toLocaleString('en-IN')}`);
            setCart([]);
        } catch {
            enqueue({ type: 'CREATE_ORDER', payload });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Saved Offline', 'Order will sync when online.');
            setCart([]);
        }
        useSyncStore.getState().refreshPendingCount();
    };

    // === COLLECTION TAB ===
    const recordCollection = async () => {
        const amt = parseFloat(collectionAmt);
        if (!amt || amt <= 0) return;
        const payload = { customerId: params.customerId, amount: amt, method: payMethod };
        try {
            await apiClient.post('/api/v1/payments', payload);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Collection Recorded', `₹${amt.toLocaleString('en-IN')}`);
            setCollectionAmt('');
        } catch {
            enqueue({ type: 'RECORD_COLLECTION', payload });
            Alert.alert('Saved Offline');
            setCollectionAmt('');
        }
        useSyncStore.getState().refreshPendingCount();
    };

    // === AUDIT TAB ===
    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Camera Permission Required');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]) {
            setAuditImages((prev) => [...prev, result.assets[0].uri]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    };

    // === NOTES TAB ===
    const NOTE_TAGS = ['Price complaint', 'No stock', 'New product interest', 'Competitor activity', 'Relationship issue', 'Display quality'];
    const toggleTag = (t: string) => setTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

    const saveVisit = async () => {
        const payload = {
            customerId: params.customerId,
            notes,
            tags,
            auditImageCount: auditImages.length,
            orderPlaced: cart.length > 0,
        };
        try {
            await apiClient.post('/api/v1/visits', payload);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Visit Saved', 'All notes and data recorded.');
            router.back();
        } catch {
            enqueue({ type: 'LOG_VISIT', payload });
            Alert.alert('Saved Offline', 'Visit will sync when online.');
            router.back();
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            {/* Header */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ color: colors.textMuted, fontSize: 20 }}>←</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' }} numberOfLines={1}>{customerName}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Visit in progress</Text>
                </View>
                <Button title="End Visit" variant="outline" size="sm" onPress={saveVisit} />
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                {TABS.map((t) => (
                    <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
                        <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ORDER TAB */}
            {tab === 'ORDER' && (
                <View style={{ flex: 1 }}>
                    <View style={{ padding: spacing.md }}>
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Search products..."
                            placeholderTextColor={colors.textMuted}
                            style={styles.searchInput}
                        />
                    </View>
                    <FlatList
                        data={filteredProducts}
                        keyExtractor={(p: any) => p.id}
                        style={{ flex: 1 }}
                        renderItem={({ item: p }) => (
                            <TouchableOpacity onPress={() => addToCart(p)} style={styles.productRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm }}>{p.name}</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>₹{(p.sellingPrice || p.mrp || 0).toLocaleString('en-IN')}</Text>
                                </View>
                                <Text style={{ color: colors.purple, fontSize: fontSize.sm, fontWeight: '600' }}>+ Add</Text>
                            </TouchableOpacity>
                        )}
                        ListFooterComponent={
                            cart.length > 0 ? (
                                <View style={{ padding: spacing.md }}>
                                    <SectionHeader title={`Cart (${cart.length} items)`} />
                                    {cart.map((c) => (
                                        <View key={c.productId} style={styles.cartItem}>
                                            <Text style={{ color: colors.textPrimary, flex: 1, fontSize: fontSize.sm }}>{c.name}</Text>
                                            <View style={styles.qtyControls}>
                                                <TouchableOpacity onPress={() => updateQty(c.productId, -1)} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>−</Text></TouchableOpacity>
                                                <Text style={{ color: colors.textPrimary, width: 28, textAlign: 'center' }}>{c.qty}</Text>
                                                <TouchableOpacity onPress={() => updateQty(c.productId, 1)} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                                            </View>
                                            <Text style={{ color: colors.gold, fontSize: fontSize.sm, width: 70, textAlign: 'right' }}>₹{(c.price * c.qty).toLocaleString('en-IN')}</Text>
                                        </View>
                                    ))}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.md }}>
                                        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.lg }}>Total</Text>
                                        <Text style={{ color: colors.gold, fontWeight: '700', fontSize: fontSize.lg }}>₹{cartTotal.toLocaleString('en-IN')}</Text>
                                    </View>
                                    <Button title="Place Order" onPress={placeOrder} size="lg" />
                                </View>
                            ) : null
                        }
                    />
                </View>
            )}

            {/* COLLECT TAB */}
            {tab === 'COLLECT' && (
                <ScrollView style={{ flex: 1, padding: spacing.md }}>
                    <Card style={{ marginBottom: spacing.lg }}>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Outstanding Amount</Text>
                        <Text style={{ color: colors.red, fontSize: fontSize.xxl, fontWeight: '800' }}>₹25,000</Text>
                    </Card>
                    <Input label="Amount" value={collectionAmt} onChangeText={setCollectionAmt} placeholder="Enter amount" keyboardType="numeric" containerStyle={{ marginBottom: spacing.md }} />
                    <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.sm }}>Payment Method</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                        {(['Cash', 'UPI', 'Cheque', 'Bank'] as const).map((m) => (
                            <TouchableOpacity key={m} onPress={() => setPayMethod(m)} style={[styles.methodBtn, payMethod === m && styles.methodActive]}>
                                <Text style={{ color: payMethod === m ? colors.gold : colors.textMuted, fontSize: fontSize.sm }}>{m}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Button title="Record Collection" onPress={recordCollection} size="lg" />
                </ScrollView>
            )}

            {/* AUDIT TAB */}
            {tab === 'AUDIT' && (
                <ScrollView style={{ flex: 1, padding: spacing.md }}>
                    <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📸</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, textAlign: 'center', marginBottom: spacing.lg }}>
                            Take photos of the product shelf for AI analysis
                        </Text>
                        <Button title="Open Camera" size="lg" onPress={takePhoto} />
                    </View>

                    {auditImages.length > 0 && (
                        <>
                            <SectionHeader title={`Photos (${auditImages.length})`} />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {auditImages.map((uri, i) => (
                                    <View key={i} style={styles.imageThumb}>
                                        <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: radius.sm }} />
                                        <TouchableOpacity
                                            onPress={() => setAuditImages((prev) => prev.filter((_, j) => j !== i))}
                                            style={styles.removeBtn}
                                        >
                                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        </>
                    )}
                </ScrollView>
            )}

            {/* NOTES TAB */}
            {tab === 'NOTES' && (
                <ScrollView style={{ flex: 1, padding: spacing.md }}>
                    <TextInput
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Write visit notes..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        style={styles.notesInput}
                    />
                    <SectionHeader title="Quick Tags" />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        {NOTE_TAGS.map((t) => (
                            <TouchableOpacity key={t} onPress={() => toggleTag(t)} style={[styles.tagChip, tags.includes(t) && styles.tagChipActive]}>
                                <Text style={{ color: tags.includes(t) ? colors.gold : colors.textMuted, fontSize: fontSize.xs }}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Button title="Save Visit Notes" variant="secondary" onPress={saveVisit} style={{ marginTop: spacing.lg }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    headerBar: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
    tabText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', letterSpacing: 0.5 },
    tabTextActive: { color: colors.gold },
    searchInput: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.textPrimary, fontSize: fontSize.md },
    productRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    cartItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    qtyControls: { flexDirection: 'row', alignItems: 'center' },
    qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgCardHover, alignItems: 'center', justifyContent: 'center' },
    qtyBtnText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
    methodBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
    methodActive: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.1)' },
    notesInput: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.md, color: colors.textPrimary, fontSize: fontSize.md, minHeight: 120, textAlignVertical: 'top', marginBottom: spacing.md },
    tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
    tagChipActive: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.1)' },
    imageThumb: { marginRight: spacing.sm, position: 'relative' },
    removeBtn: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
});
