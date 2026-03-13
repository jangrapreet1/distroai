import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, spacing, fontSize, radius } from './theme';

interface ListItemProps {
    title: string;
    subtitle?: string;
    leftEmoji?: string;
    leftNode?: React.ReactNode;
    rightNode?: React.ReactNode;
    onPress?: () => void;
    style?: ViewStyle;
}

export function ListItem({ title, subtitle, leftEmoji, leftNode, rightNode, onPress, style }: ListItemProps) {
    const content = (
        <>
            {leftNode || (leftEmoji ? (
                <View style={styles.emojiCircle}>
                    <Text style={{ fontSize: 18 }}>{leftEmoji}</Text>
                </View>
            ) : null)}
            <View style={styles.body}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {rightNode}
        </>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.container, style]}>
                {content}
            </TouchableOpacity>
        );
    }

    return <View style={[styles.container, style]}>{content}</View>;
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.bgCard,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.xs,
    },
    emojiCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(201,168,76,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: { flex: 1 },
    title: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
    subtitle: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
});
