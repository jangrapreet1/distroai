import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from './theme';
import { Button } from './Button';

interface EmptyStateProps {
    emoji?: string;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({ emoji = '📭', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
    return (
        <View style={styles.container}>
            <Text style={{ fontSize: 48, marginBottom: spacing.md }}>{emoji}</Text>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {actionLabel && onAction ? (
                <Button title={actionLabel} variant="outline" size="sm" onPress={onAction} style={{ marginTop: spacing.md }} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: spacing.xl },
    title: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', textAlign: 'center' },
    subtitle: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.xs },
});
