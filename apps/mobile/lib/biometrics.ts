import * as LocalAuthentication from 'expo-local-authentication';
import { storage } from './offline-queue';
import { Alert } from 'react-native';

const BIOMETRIC_PREF_KEY = 'auth:biometrics';
const LAST_BACKGROUND_KEY = 'app:lastBackground';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function isBiometricEnabled(): boolean {
    return storage.getString(BIOMETRIC_PREF_KEY) === 'true';
}

export function setBiometricEnabled(enabled: boolean): void {
    storage.set(BIOMETRIC_PREF_KEY, enabled ? 'true' : 'false');
}

export function recordBackground(): void {
    storage.set(LAST_BACKGROUND_KEY, String(Date.now()));
}

export function shouldPromptBiometric(): boolean {
    if (!isBiometricEnabled()) return false;
    const last = storage.getString(LAST_BACKGROUND_KEY);
    if (!last) return false;
    return Date.now() - parseInt(last, 10) > LOCK_TIMEOUT_MS;
}

export async function checkBiometricSupport(): Promise<{ supported: boolean; enrolled: boolean }> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return { supported: compatible, enrolled };
}

export async function authenticateWithBiometrics(): Promise<boolean> {
    try {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock DistroAI',
            fallbackLabel: 'Use PIN',
            disableDeviceFallback: false,
        });
        return result.success;
    } catch {
        return false;
    }
}

export async function promptEnableBiometrics(): Promise<boolean> {
    const { supported, enrolled } = await checkBiometricSupport();
    if (!supported || !enrolled) return false;

    return new Promise((resolve) => {
        Alert.alert(
            'Enable Biometric Unlock?',
            'Use fingerprint or face recognition to unlock DistroAI when you return.',
            [
                { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Enable', onPress: () => { setBiometricEnabled(true); resolve(true); } },
            ],
        );
    });
}
