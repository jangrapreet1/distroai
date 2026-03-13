import React from 'react';
import { TextInput, View, Text, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius, fontSize, spacing } from './theme';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
}

export function Input({ label, error, containerStyle, style, ...rest }: InputProps) {
    return (
        <View style={containerStyle}>
            {label && (
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.xs, fontWeight: '500' }}>
                    {label}
                </Text>
            )}
            <TextInput
                style={[
                    {
                        backgroundColor: colors.bgCard,
                        borderWidth: 1,
                        borderColor: error ? colors.danger : colors.border,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 12,
                        color: colors.textPrimary,
                        fontSize: fontSize.md,
                    },
                    style,
                ]}
                placeholderTextColor={colors.textMuted}
                {...rest}
            />
            {error && (
                <Text style={{ color: colors.danger, fontSize: fontSize.xs, marginTop: spacing.xs }}>
                    {error}
                </Text>
            )}
        </View>
    );
}
