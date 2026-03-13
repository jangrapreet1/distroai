import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from './theme';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radius.sm, style }: SkeletonProps) {
    const pulse = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.7, duration: 800, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ]),
        );
        animation.start();
        return () => animation.stop();
    }, []);

    return (
        <Animated.View
            style={[
                { width: width as any, height, borderRadius, backgroundColor: colors.bgCardHover, opacity: pulse },
                style,
            ]}
        />
    );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
    return (
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
            {Array.from({ length: count }).map((_, i) => (
                <View key={i} style={styles.row}>
                    <Skeleton width={40} height={40} borderRadius={20} />
                    <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton width="70%" height={14} />
                        <Skeleton width="40%" height={10} />
                    </View>
                    <Skeleton width={60} height={14} />
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.bgCard,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
    },
});
