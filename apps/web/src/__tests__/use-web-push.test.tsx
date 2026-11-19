import { renderHook, act } from "@testing-library/react";
import { useWebPush } from "@/hooks/use-web-push";
import apiClient from "@/lib/api-client";
import toast from "react-hot-toast";

jest.mock("@/lib/api-client");
jest.mock("react-hot-toast");

describe("useWebPush hook", () => {
    const originalNotification = window.Notification;
    const originalNavigator = window.navigator;

    let mockPushManager: {
        getSubscription: jest.Mock;
        subscribe: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockPushManager = {
            getSubscription: jest.fn().mockResolvedValue(null),
            subscribe: jest.fn().mockResolvedValue({
                endpoint: "https://web.push.apple.com/sub-abc",
                toJSON: () => ({
                    endpoint: "https://web.push.apple.com/sub-abc",
                    keys: { p256dh: "key-p256dh", auth: "key-auth" },
                }),
                unsubscribe: jest.fn().mockResolvedValue(true),
            }),
        };

        // Mock Notification
        (window as any).Notification = {
            permission: "default",
            requestPermission: jest.fn().mockResolvedValue("granted"),
        };

        // Mock PushManager on window
        (window as any).PushManager = {};

        // Mock ServiceWorker on navigator
        Object.defineProperty(navigator, "serviceWorker", {
            value: {
                ready: Promise.resolve({
                    pushManager: mockPushManager,
                }),
            },
            configurable: true,
            writable: true,
        });

        // Mock matchMedia
        window.matchMedia = jest.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }));
    });

    afterAll(() => {
        (window as any).Notification = originalNotification;
    });

    it("should initialize as supported and not subscribed", async () => {
        let result: any;
        await act(async () => {
            const hook = renderHook(() => useWebPush());
            result = hook.result;
        });
        expect(result.current.isSupported).toBe(true);
        expect(result.current.permission).toBe("default");
    });

    it("should request permission and register push subscription", async () => {
        const validVapid = "BPlNUHZjrKP9m2v4ygVQoZXagv0ncFx727q-V1Ozl8pA1CM2saDoQN0YqVEU-DOAt6w-QQ_AIGZHqoJjLemniD0";
        (apiClient.get as jest.Mock).mockResolvedValueOnce({
            data: { publicKey: validVapid },
        });
        (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

        const { result } = renderHook(() => useWebPush());

        let ok: boolean = false;
        await act(async () => {
            ok = await result.current.subscribe();
        });

        expect(ok).toBe(true);
        expect(Notification.requestPermission).toHaveBeenCalled();
        expect(apiClient.get).toHaveBeenCalledWith("/api/v1/notifications/vapid-public-key");
        expect(mockPushManager.subscribe).toHaveBeenCalled();
        expect(apiClient.post).toHaveBeenCalledWith(
            "/api/v1/notifications/push-subscription",
            expect.objectContaining({
                endpoint: "https://web.push.apple.com/sub-abc",
                keys: { p256dh: "key-p256dh", auth: "key-auth" },
            })
        );
        expect(result.current.isSubscribed).toBe(true);
        expect(toast.success).toHaveBeenCalledWith(
            expect.stringContaining("Push notifications enabled")
        );
    });

    it("should dispatch a test push notification", async () => {
        (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

        const { result } = renderHook(() => useWebPush());

        let ok: boolean = false;
        await act(async () => {
            ok = await result.current.sendTestNotification();
        });

        expect(ok).toBe(true);
        expect(apiClient.post).toHaveBeenCalledWith("/api/v1/notifications/test-push");
        expect(toast.success).toHaveBeenCalledWith(
            expect.stringContaining("Test notification sent")
        );
    });
});
