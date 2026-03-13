import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { storage } from './offline-queue';
import { enqueue } from './offline-queue';
import Constants from 'expo-constants';

const API_HOST = Constants.expoConfig?.extra?.apiUrl
    || process.env.EXPO_PUBLIC_API_URL
    || 'http://localhost:3000';
const BASE_URL = API_HOST.replace(/\/+$/, '');


export const apiClient: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach auth token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = storage.getString('auth:accessToken');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor — handle 401 refresh + offline queueing
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // 401 → try refresh token once
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = storage.getString('auth:refreshToken');
            if (refreshToken) {
                try {
                    const res = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });
                    const { accessToken, refreshToken: newRefresh } = res.data;
                    storage.set('auth:accessToken', accessToken);
                    if (newRefresh) storage.set('auth:refreshToken', newRefresh);
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return apiClient(originalRequest);
                } catch {
                    // Refresh failed — force logout
                    storage.delete('auth:accessToken');
                    storage.delete('auth:refreshToken');
                    storage.delete('auth:user');
                }
            }
        }

        // Network error on mutations → queue offline
        if (!error.response && ['post', 'patch', 'delete'].includes(originalRequest.method)) {
            const path = originalRequest.url || '';
            let actionType: any = null;
            if (path.includes('/orders')) actionType = 'CREATE_ORDER';
            else if (path.includes('/visits')) actionType = 'LOG_VISIT';
            else if (path.includes('/check-in')) actionType = 'CHECK_IN';
            else if (path.includes('/check-out')) actionType = 'CHECK_OUT';
            else if (path.includes('/payments')) actionType = 'RECORD_COLLECTION';

            if (actionType) {
                enqueue({ type: actionType, payload: originalRequest.data ? JSON.parse(originalRequest.data) : {} });
                return Promise.resolve({ data: { queued: true, message: 'Saved offline' }, status: 202 });
            }
        }

        return Promise.reject(error);
    }
);
