import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from './theme';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    padded?: boolean;
}

export function Card({ children, style, padded = true }: CardProps) {
    return (
        <View
            style={[
                {
                    backgroundColor: colors.bgCard,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...(padded ? { padding: spacing.md } : {}),
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}
