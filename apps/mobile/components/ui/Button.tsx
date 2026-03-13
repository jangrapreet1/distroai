import React from 'react';
import {
    TouchableOpacity, Text, StyleSheet, ActivityIndicator,
    type TouchableOpacityProps, type ViewStyle, type TextStyle,
} from 'react-native';
import { colors, radius, fontSize, spacing } from './theme';
import * as Haptics from 'expo-haptics';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: Variant;
    loading?: boolean;
    icon?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.gold, text: '#07070E' },
    secondary: { bg: colors.purple, text: '#fff' },
    outline: { bg: 'transparent', text: colors.textPrimary, border: colors.border },
    danger: { bg: colors.danger, text: '#fff' },
    ghost: { bg: 'transparent', text: colors.textSecondary },
};

const sizeStyles: Record<string, { py: number; px: number; fs: number }> = {
    sm: { py: 8, px: 14, fs: fontSize.sm },
    md: { py: 12, px: 20, fs: fontSize.md },
    lg: { py: 16, px: 24, fs: fontSize.lg },
};

export function Button({ title, variant = 'primary', loading, icon, size = 'md', style, disabled, onPress, ...rest }: ButtonProps) {
    const v = variantStyles[variant];
    const s = sizeStyles[size];

    const handlePress = (e: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
    };

    return (
        <TouchableOpacity
            style={[
                {
                    backgroundColor: v.bg,
                    paddingVertical: s.py,
                    paddingHorizontal: s.px,
                    borderRadius: radius.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    opacity: disabled || loading ? 0.5 : 1,
                    ...(v.border ? { borderWidth: 1, borderColor: v.border } : {}),
                },
                style as ViewStyle,
            ]}
            disabled={disabled || loading}
            onPress={handlePress}
            activeOpacity={0.7}
            {...rest}
        >
            {loading ? <ActivityIndicator size="small" color={v.text} /> : icon}
            <Text style={{ color: v.text, fontSize: s.fs, fontWeight: '600' }}>{title}</Text>
        </TouchableOpacity>
    );
}
