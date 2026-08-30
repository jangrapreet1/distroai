import axios from "axios";
import { useAuthStore } from "@/stores/auth.store";
import { useUpgradeStore } from "@/stores/upgrade.store";

const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "",
    headers: { "Content-Type": "application/json" },
});

// Request: attach access token
apiClient.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response: unwrap { success, data } wrapper + handle 401 refresh
let isRefreshing = false;
let failedQueue: {
    resolve: (t: string) => void;
    reject: (e: unknown) => void;
}[] = [];

function processQueue(error: unknown, token: string | null) {
    failedQueue.forEach((p) =>
        error ? p.reject(error) : p.resolve(token as string)
    );
    failedQueue = [];
}

apiClient.interceptors.response.use(
    (response) => {
        // Unwrap { success: true, data: ... }
        if (response.data?.success && response.data?.data !== undefined) {
            response.data = response.data.data;
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        const errorCode = error.response?.data?.code;

        // Catch explicitly defined plan limits — but ONLY on user-initiated mutations (POST/PUT/PATCH/DELETE),
        // never on background GET fetches (React Query) which would cause the modal to pop on page load.
        const isGetRequest = originalRequest?.method?.toLowerCase() === 'get';
        if (
            (errorCode === 'PLAN_LIMIT_REACHED' || error.response?.status === 402)
            && !originalRequest.headers?.['x-suppress-upgrade-modal']
            && !isGetRequest
        ) {
            const featureName = error.response?.data?.feature?.replace(/([A-Z])/g, " $1").toLowerCase()
                || error.response?.data?.message
                || "this feature";

            useUpgradeStore.getState().openModal(featureName);
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return apiClient(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const { refreshToken, setTokens, logout } = useAuthStore.getState();

            if (!refreshToken) {
                logout();
                if (typeof window !== "undefined") window.location.href = "/login";
                return Promise.reject(error);
            }

            try {
                const res = await axios.post(
                    `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/auth/refresh`,
                    { refreshToken }
                );
                const { accessToken: newAccess, refreshToken: newRefresh } =
                    res.data?.data ?? res.data;
                setTokens({ accessToken: newAccess, refreshToken: newRefresh });

                // Set cookie for middleware
                document.cookie = `accessToken=${newAccess};path=/;max-age=2592000;SameSite=Lax`;

                processQueue(null, newAccess);
                originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                logout();
                document.cookie =
                    "accessToken=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT";
                if (typeof window !== "undefined") window.location.href = "/login";
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;

export * from "./api-errors";
