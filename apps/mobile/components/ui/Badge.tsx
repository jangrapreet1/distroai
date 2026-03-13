import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { colors, radius, fontSize, spacing } from './theme';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const badgeColors: Record<BadgeVariant, { bg: string; text: string }> = {
    success: { bg: 'rgba(46,139,87,0.15)', text: colors.greenBright },
    warning: { bg: 'rgba(201,168,76,0.15)', text: colors.gold },
    danger: { bg: 'rgba(224,123,96,0.15)', text: colors.red },
    info: { bg: 'rgba(123,94,167,0.15)', text: colors.purple },
    muted: { bg: 'rgba(255,255,255,0.05)', text: colors.textMuted },
};

interface BadgeProps {
    label: string;
    variant?: BadgeVariant;
    style?: ViewStyle;
}

export function Badge({ label, variant = 'muted', style }: BadgeProps) {
    const c = badgeColors[variant];
    return (
        <View style={[{ backgroundColor: c.bg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full }, style]}>
            <Text style={{ color: c.text, fontSize: fontSize.xs, fontWeight: '600' }}>{label}</Text>
        </View>
    );
}
