import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, radius } from './theme';

interface StatCardProps {
    emoji: string;
    value: string | number;
    label: string;
    trend?: { value: string; positive: boolean };
    width?: number;
}

export function StatCard({ emoji, value, label, trend, width }: StatCardProps) {
    return (
        <View style={[styles.container, width ? { width } : {}]}>
            <Text style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</Text>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
            {trend ? (
                <Text style={[styles.trend, { color: trend.positive ? colors.greenBright : colors.red }]}>
                    {trend.positive ? '↑' : '↓'} {trend.value}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bgCard,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginRight: spacing.sm,
    },
    value: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
    label: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    trend: { fontSize: fontSize.xs, fontWeight: '600', marginTop: 4 },
});
