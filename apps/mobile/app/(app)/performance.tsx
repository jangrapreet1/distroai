import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, colors, spacing, fontSize } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Circle, Text as SvgText } from 'react-native-svg';

function ProgressRing({ percent, size = 100 }: { percent: number; size?: number }) {
    const strokeWidth = 8;
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const fill = circ * (1 - percent / 100);
    const color = percent > 80 ? colors.greenBright : percent > 50 ? colors.gold : colors.red;

    return (
        <Svg width={size} height={size}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.bgCardHover} strokeWidth={strokeWidth} fill="transparent" />
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={`${circ}`} strokeDashoffset={fill} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            <SvgText x={size / 2} y={size / 2 + 6} textAnchor="middle" fill={color} fontSize={20} fontWeight="bold">{percent}%</SvgText>
        </Svg>
    );
}

function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
    const max = Math.max(...data.map((d) => d.value), 1);
    const barWidth = 28;
    const height = 80;
    const gap = 8;
    const width = data.length * (barWidth + gap);

    return (
        <Svg width={width} height={height + 20}>
            {data.map((d, i) => {
                const barH = (d.value / max) * height;
                return (
                    <React.Fragment key={i}>
                        <Rect x={i * (barWidth + gap)} y={height - barH} width={barWidth} height={barH} rx={4} fill={colors.purple} opacity={0.8} />
                        <SvgText x={i * (barWidth + gap) + barWidth / 2} y={height + 14} textAnchor="middle" fill={colors.textMuted} fontSize={9}>{d.label}</SvgText>
                    </React.Fragment>
                );
            })}
        </Svg>
    );
}

export default function PerformanceScreen() {
    const todayStats = [
        { label: 'Visits', done: 5, total: 8, emoji: '📍' },
        { label: 'Orders', done: 3, total: 0, value: '₹25,200', emoji: '📦' },
        { label: 'Collections', done: 0, total: 0, value: '₹12,500', emoji: '💰' },
    ];

    const monthlyTarget = 500000;
    const monthlyAchieved = 380000;
    const percent = Math.round((monthlyAchieved / monthlyTarget) * 100);
    const daysLeft = 30 - new Date().getDate();

    const weeklyData = [
        { label: 'Mon', value: 3 }, { label: 'Tue', value: 5 }, { label: 'Wed', value: 4 },
        { label: 'Thu', value: 7 }, { label: 'Fri', value: 2 }, { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 },
    ];

    const leaderboard = [
        { name: 'Amit Sharma', orders: 45, amount: 520000 },
        { name: 'Priya Patel', orders: 42, amount: 480000 },
        { name: 'Rahul Gupta', orders: 38, amount: 420000 },
        { name: 'You', orders: 35, amount: 380000, isYou: true },
        { name: 'Suresh Kumar', orders: 30, amount: 350000 },
    ];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.lg }}>Performance</Text>

                {/* Today */}
                <Text style={styles.section}>Today's Summary</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                    {todayStats.map((s, i) => (
                        <Card key={i} style={{ flex: 1 }}>
                            <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
                            <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', marginTop: 4 }}>{s.value || `${s.done}/${s.total}`}</Text>
                            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{s.label}</Text>
                            {s.total > 0 && (
                                <View style={{ height: 3, backgroundColor: colors.bgCardHover, borderRadius: 2, marginTop: 6 }}>
                                    <View style={{ height: 3, width: `${Math.min((s.done / s.total) * 100, 100)}%`, backgroundColor: colors.greenBright, borderRadius: 2 } as any} />
                                </View>
                            )}
                        </Card>
                    ))}
                </View>

                {/* Monthly Target */}
                <Text style={styles.section}>Monthly Target</Text>
                <Card style={{ marginBottom: spacing.lg, alignItems: 'center' }}>
                    <ProgressRing percent={percent} size={120} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: spacing.md }}>
                        <View><Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Target</Text><Text style={{ color: colors.textPrimary, fontWeight: '600' }}>₹{(monthlyTarget / 100000).toFixed(1)}L</Text></View>
                        <View style={{ alignItems: 'center' }}><Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Achieved</Text><Text style={{ color: colors.gold, fontWeight: '600' }}>₹{(monthlyAchieved / 100000).toFixed(1)}L</Text></View>
                        <View style={{ alignItems: 'flex-end' }}><Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Days Left</Text><Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{daysLeft}</Text></View>
                    </View>
                </Card>

                {/* Weekly Trend */}
                <Text style={styles.section}>Weekly Orders</Text>
                <Card style={{ marginBottom: spacing.lg, alignItems: 'center' }}>
                    <MiniBarChart data={weeklyData} />
                </Card>

                {/* Leaderboard */}
                <Text style={styles.section}>Leaderboard</Text>
                {leaderboard.map((s, i) => (
                    <View key={i} style={[styles.lbRow, (s as any).isYou && { backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: 10 }]}>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.md, fontWeight: '700', width: 24 }}>{i + 1}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: (s as any).isYou ? colors.gold : colors.textPrimary, fontSize: fontSize.md, fontWeight: (s as any).isYou ? '700' : '500' }}>{s.name}</Text>
                            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{s.orders} orders</Text>
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>₹{(s.amount / 100000).toFixed(1)}L</Text>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    section: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
    lbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
});
