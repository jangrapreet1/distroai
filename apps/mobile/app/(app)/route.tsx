import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Card, Badge, Button, colors, spacing, fontSize } from '@/components/ui';
import { getCached } from '@/lib/local-cache';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking } from 'react-native';

const { height } = Dimensions.get('window');

interface RouteCustomer {
    id: string;
    name: string;
    area: string;
    latitude?: number;
    longitude?: number;
    outstanding: number;
    lastOrderDaysAgo: number | null;
    visited: boolean;
    skipped: boolean;
}

const PIN_COLORS = { visited: '#2E8B57', current: '#3b82f6', unvisited: '#9A9080', skipped: '#E07B60' };

export default function RouteScreen() {
    const [customers, setCustomers] = useState<RouteCustomer[]>([]);
    const [region, setRegion] = useState({ latitude: 19.076, longitude: 72.8777, latitudeDelta: 0.05, longitudeDelta: 0.05 });

    useEffect(() => {
        const cached = getCached<any>('route');
        if (cached?.data) {
            setCustomers(cached.data.map((c: any, i: number) => ({
                id: c.id || `c${i}`,
                name: c.name || `Customer ${i + 1}`,
                area: c.area || c.address || '',
                latitude: c.latitude,
                longitude: c.longitude,
                outstanding: c.outstanding || 0,
                lastOrderDaysAgo: c.lastOrderDaysAgo ?? null,
                visited: false,
                skipped: false,
            })));
        } else {
            // Demo data
            setCustomers([
                { id: '1', name: 'Rajesh Kirana Store', area: 'Andheri West', latitude: 19.136, longitude: 72.836, outstanding: 15000, lastOrderDaysAgo: 3, visited: false, skipped: false },
                { id: '2', name: 'City Mart', area: 'Bandra East', latitude: 19.054, longitude: 72.840, outstanding: 8500, lastOrderDaysAgo: 7, visited: false, skipped: false },
                { id: '3', name: 'Sharma General', area: 'Juhu', latitude: 19.098, longitude: 72.826, outstanding: 0, lastOrderDaysAgo: 1, visited: false, skipped: false },
            ]);
        }

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                setRegion({ ...region, latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            }
        })();
    }, []);

    const navigateToCustomer = (lat?: number, lng?: number) => {
        if (lat && lng) {
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
        }
    };

    const getPinColor = (c: RouteCustomer, i: number) => {
        if (c.visited) return PIN_COLORS.visited;
        if (c.skipped) return PIN_COLORS.skipped;
        const firstUnvisited = customers.findIndex((x) => !x.visited && !x.skipped);
        return i === firstUnvisited ? PIN_COLORS.current : PIN_COLORS.unvisited;
    };

    const renderCustomer = ({ item, index }: { item: RouteCustomer; index: number }) => {
        const status = item.visited ? 'Visited' : item.skipped ? 'Skipped' : 'Pending';
        const variant = item.visited ? 'success' : item.skipped ? 'danger' : 'muted';

        return (
            <Card style={{ marginBottom: spacing.sm, marginHorizontal: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={[styles.seqCircle, { backgroundColor: getPinColor(item, index) }]}>
                        <Text style={styles.seqText}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' }}>{item.name}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{item.area}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 }}>
                            {item.lastOrderDaysAgo !== null && (
                                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Last: {item.lastOrderDaysAgo}d ago</Text>
                            )}
                            {item.outstanding > 0 && (
                                <Text style={{ color: colors.orange, fontSize: fontSize.xs, fontWeight: '600' }}>₹{item.outstanding.toLocaleString('en-IN')}</Text>
                            )}
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Badge label={status} variant={variant} />
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity onPress={() => navigateToCustomer(item.latitude, item.longitude)}>
                                <Text style={{ color: colors.purple, fontSize: fontSize.xs, fontWeight: '600' }}>Navigate</Text>
                            </TouchableOpacity>
                            {!item.visited && !item.skipped && (
                                <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/audit' as any, params: { customerId: item.id, customerName: item.name } })}>
                                    <Text style={{ color: colors.gold, fontSize: fontSize.xs, fontWeight: '600' }}>Visit →</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            {/* Map */}
            <View style={{ height: height * 0.35 }}>
                <MapView style={{ flex: 1 }} region={region} provider={PROVIDER_GOOGLE} customMapStyle={darkMapStyle}>
                    {customers.map((c, i) => c.latitude && c.longitude && (
                        <Marker
                            key={c.id}
                            coordinate={{ latitude: c.latitude, longitude: c.longitude }}
                            pinColor={getPinColor(c, i)}
                            title={c.name}
                            description={c.outstanding > 0 ? `₹${c.outstanding.toLocaleString('en-IN')} outstanding` : undefined}
                        />
                    ))}
                </MapView>
            </View>

            {/* Customer List */}
            <View style={{ flex: 1, paddingTop: spacing.md }}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
                    Today's Route ({customers.length} stops)
                </Text>
                <FlatList data={customers} renderItem={renderCustomer} keyExtractor={(c) => c.id} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    seqCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    seqText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
});

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1d1d2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d2e' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c3e' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
];
