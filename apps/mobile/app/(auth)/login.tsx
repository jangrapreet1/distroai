import React, { useState } from 'react';
import { View, Text, Image, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button, Input, colors, spacing, fontSize } from '@/components/ui';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const setAuth = useAuthStore((s) => s.setAuth);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            setError('Email and password are required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await apiClient.post('/api/v1/auth/login', { email: email.trim(), password });
            const { accessToken, refreshToken, user } = res.data;

            // Fetch org
            let org = null;
            try {
                const orgRes = await apiClient.get('/api/v1/org', { headers: { Authorization: `Bearer ${accessToken}` } });
                org = orgRes.data;
            } catch { }

            // Fetch salesman profile
            let salesman = null;
            try {
                const smRes = await apiClient.get('/api/v1/salesmen/me', { headers: { Authorization: `Bearer ${accessToken}` } });
                salesman = smRes.data;
            } catch { }

            setAuth({ user, org, salesman, accessToken, refreshToken });
            router.replace('/(app)');
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Login failed. Check your credentials.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.inner}>
                <View style={styles.logoBox}>
                    <Text style={styles.logoText}>DistroAI</Text>
                    <Text style={styles.logoSub}>Field App</Text>
                </View>

                <View style={styles.form}>
                    <Input
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@company.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        containerStyle={{ marginBottom: spacing.md }}
                    />

                    <Input
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        secureTextEntry={!showPassword}
                        containerStyle={{ marginBottom: spacing.lg }}
                        error={error || undefined}
                    />

                    <Button title="Sign In" onPress={handleLogin} loading={loading} size="lg" />
                </View>

                <Text style={styles.footer}>Only for invited salesmen. Contact your manager for access.</Text>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
    logoBox: { alignItems: 'center', marginBottom: 48 },
    logoText: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.gold, letterSpacing: 1 },
    logoSub: { fontSize: fontSize.md, color: colors.textMuted, marginTop: 4 },
    form: {},
    footer: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xl },
});
