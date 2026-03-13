import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize } from '@/components/ui';
import { OfflineIndicator } from '@/components/OfflineIndicator';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
    return (
        <View style={{ alignItems: 'center', paddingTop: 6 }}>
            <Text style={{ fontSize: 20 }}>{label}</Text>
            {focused && <View style={styles.dot} />}
        </View>
    );
}

export default function AppLayout() {
    return (
        <>
            <OfflineIndicator />
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: styles.tabBar,
                    tabBarShowLabel: false,
                    tabBarActiveTintColor: colors.gold,
                    tabBarInactiveTintColor: colors.textMuted,
                }}
            >
                <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} /> }} />
                <Tabs.Screen name="route" options={{ tabBarIcon: ({ focused }) => <TabIcon label="🗺️" focused={focused} /> }} />
                <Tabs.Screen name="orders" options={{ tabBarIcon: ({ focused }) => <TabIcon label="📦" focused={focused} /> }} />
                <Tabs.Screen name="collections" options={{ tabBarIcon: ({ focused }) => <TabIcon label="💰" focused={focused} /> }} />
                <Tabs.Screen name="performance" options={{ tabBarIcon: ({ focused }) => <TabIcon label="📊" focused={focused} /> }} />
                <Tabs.Screen name="audit" options={{ href: null }} />
                <Tabs.Screen name="customers" options={{ href: null }} />
            </Tabs>
        </>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#0F0C1A',
        borderTopColor: 'rgba(255,255,255,0.07)',
        borderTopWidth: 1,
        height: 60,
        paddingBottom: 4,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.gold,
        marginTop: 2,
    },
});
