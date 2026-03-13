import axios from "axios";

export interface ApiError {
    code: string;
    message: string;
    statusCode: number;
}

export function getApiError(error: unknown): ApiError {
    if (axios.isAxiosError(error) && error.response?.data) {
        // Handle nested error object from AllExceptionsFilter
        const errorData = error.response.data.error || error.response.data;
        return {
            code: errorData.code ?? "UNKNOWN",
            message: errorData.message ?? "Something went wrong",
            statusCode: error.response.status ?? 500,
        };
    }
    return { code: "NETWORK_ERROR", message: "Network error", statusCode: 0 };
}
