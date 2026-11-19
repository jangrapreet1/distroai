"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api-client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function useWebPush() {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isPWA, setIsPWA] = useState(false);

    // Check support and current status on mount
    useEffect(() => {
        if (typeof window === "undefined") return;

        const supported =
            "serviceWorker" in navigator &&
            "PushManager" in window &&
            "Notification" in window;

        setIsSupported(supported);

        // Detect if running in standalone mode (iPhone Add to Home Screen)
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true;
        setIsPWA(isStandalone);

        if (supported) {
            setPermission(Notification.permission);
            navigator.serviceWorker.ready
                .then((reg) => reg.pushManager.getSubscription())
                .then((sub) => {
                    setIsSubscribed(!!sub);
                })
                .catch(() => {
                    setIsSubscribed(false);
                });
        }
    }, []);

    const subscribe = useCallback(async () => {
        if (!isSupported) {
            toast.error("Web Push notifications are not supported on this browser.");
            return false;
        }

        setLoading(true);
        try {
            // 1. Request user permission
            const perm = await Notification.requestPermission();
            setPermission(perm);

            if (perm !== "granted") {
                if (perm === "denied") {
                    toast.error(
                        "Notifications are blocked. Please allow notifications in your browser or device Settings."
                    );
                }
                return false;
            }

            // 2. Fetch VAPID public key from backend
            const keyRes = await apiClient.get<{ publicKey: string }>(
                "/api/v1/notifications/vapid-public-key"
            );
            const vapidPublicKey = keyRes.data?.publicKey || (keyRes as any).publicKey;

            if (!vapidPublicKey) {
                throw new Error("Failed to retrieve push encryption key.");
            }

            // 3. Register push subscription with Service Worker
            const reg = await navigator.serviceWorker.ready;
            const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedKey as unknown as BufferSource,
                });
            }

            const rawSub = sub.toJSON();

            // 4. Send subscription credentials to backend
            await apiClient.post("/api/v1/notifications/push-subscription", {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: rawSub.keys?.p256dh,
                    auth: rawSub.keys?.auth,
                },
                userAgent: navigator.userAgent,
            });

            setIsSubscribed(true);
            toast.success(
                "Push notifications enabled! You will receive lock screen alerts for new orders."
            );
            return true;
        } catch (err: any) {
            console.error("Push subscription error:", err);
            toast.error(err?.response?.data?.message || err?.message || "Failed to enable notifications");
            return false;
        } finally {
            setLoading(false);
        }
    }, [isSupported]);

    const unsubscribe = useCallback(async () => {
        setLoading(true);
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                await apiClient.delete("/api/v1/notifications/push-subscription", {
                    data: { endpoint: sub.endpoint },
                });
                await sub.unsubscribe();
            }
            setIsSubscribed(false);
            toast.success("Push notifications disabled for this device.");
            return true;
        } catch (err: any) {
            console.error("Push unsubscribe error:", err);
            toast.error("Failed to disable push notifications");
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const sendTestNotification = useCallback(async () => {
        setLoading(true);
        try {
            await apiClient.post("/api/v1/notifications/test-push");
            toast.success("Test notification sent! Check your phone lock screen / banners.");
            return true;
        } catch (err: any) {
            toast.error("Failed to send test notification");
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        isSupported,
        isPWA,
        permission,
        isSubscribed,
        loading,
        subscribe,
        unsubscribe,
        sendTestNotification,
    };
}
