import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient, { getApiError } from "@/lib/api-client";

// ===== ORDERS =====
export function useOrders(filters: Record<string, string | number | undefined>) {
    return useQuery({ queryKey: ["orders", filters], queryFn: () => apiClient.get("/api/v1/orders", { params: filters }).then((r) => r.data) });
}
export function useOrder(id: string) {
    return useQuery({ queryKey: ["orders", id], queryFn: () => apiClient.get(`/api/v1/orders/${id}`).then((r) => r.data), enabled: !!id });
}
export function useCreateOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.post("/api/v1/orders", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); qc.invalidateQueries({ queryKey: ["analytics"] }); toast.success("Order created"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}
export function useOrderAction() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, action, data }: { id: string; action: string; data?: Record<string, unknown> }) => apiClient.post(`/api/v1/orders/${id}/${action}`, data ?? {}).then((r) => r.data),
        onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ["orders"] }); toast.success(`Order ${v.action}ed`); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}

// ===== INVOICES =====
export function useInvoices(filters: Record<string, string | number | undefined>) {
    return useQuery({ queryKey: ["invoices", filters], queryFn: () => apiClient.get("/api/v1/invoices", { params: filters }).then((r) => r.data) });
}
export function useInvoice(id: string) {
    return useQuery({ queryKey: ["invoices", id], queryFn: () => apiClient.get(`/api/v1/invoices/${id}`).then((r) => r.data), enabled: !!id });
}

// ===== INVENTORY =====
export function useInventory(filters: Record<string, string | boolean | undefined>) {
    return useQuery({ queryKey: ["inventory", filters], queryFn: () => apiClient.get("/api/v1/inventory", { params: filters }).then((r) => r.data) });
}
export function useProducts(filters: Record<string, string | number | boolean | undefined>) {
    return useQuery({ queryKey: ["products", filters], queryFn: () => apiClient.get("/api/v1/products", { params: filters }).then((r) => r.data) });
}
export function useProduct(id: string) {
    return useQuery({ queryKey: ["products", id], queryFn: () => apiClient.get(`/api/v1/products/${id}`).then((r) => r.data), enabled: !!id });
}
export function useCreateProduct() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.post("/api/v1/products", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Product created"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}
export function useUpdateProduct() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => apiClient.patch(`/api/v1/products/${id}`, data).then((r) => r.data),
        onSuccess: (_, v) => {
            qc.invalidateQueries({ queryKey: ["products"] });
            qc.invalidateQueries({ queryKey: ["products", v.id] });
            toast.success("Product updated");
        },
        onError: (e) => toast.error(getApiError(e).message),
    });
}

// ===== CUSTOMERS =====
export function useCustomers(filters: Record<string, string | number | undefined>) {
    return useQuery({ queryKey: ["customers", filters], queryFn: () => apiClient.get("/api/v1/customers", { params: filters }).then((r) => r.data) });
}
export function useCustomer(id: string) {
    return useQuery({ queryKey: ["customers", id], queryFn: () => apiClient.get(`/api/v1/customers/${id}`).then((r) => r.data), enabled: !!id });
}
export function useCustomerCreditScore(id: string) {
    return useQuery({ queryKey: ["customers", id, "credit-score"], queryFn: () => apiClient.get(`/api/v1/customers/${id}/credit-score`).then((r) => r.data), enabled: !!id });
}
export function useCreateCustomer() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.post("/api/v1/customers", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast.success("Customer created"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}

// ===== PAYMENTS =====
export function usePayments(filters: Record<string, string | number | undefined>) {
    return useQuery({ queryKey: ["payments", filters], queryFn: () => apiClient.get("/api/v1/payments", { params: filters }).then((r) => r.data) });
}
export function useRecordPayment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.post("/api/v1/payments", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["customers"] }); toast.success("Payment recorded"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}
export function useOutstanding() {
    return useQuery({ queryKey: ["payments", "outstanding"], queryFn: () => apiClient.get("/api/v1/payments/outstanding").then((r) => r.data) });
}
export function useInvoicePayments(invoiceId: string) {
    return useQuery({ queryKey: ["payments", "invoice", invoiceId], queryFn: () => apiClient.get("/api/v1/payments", { params: { invoiceId } }).then((r) => r.data), enabled: !!invoiceId });
}
export function useCollectionPlan() {
    return useQuery({ queryKey: ["payments", "collection-plan"], queryFn: () => apiClient.get("/api/v1/payments/collection-plan").then((r) => r.data) });
}

// ===== SUPPLIERS =====
export function useSuppliers(page = 1, limit = 20) {
    return useQuery({ queryKey: ["suppliers", page, limit], queryFn: () => apiClient.get("/api/v1/suppliers", { params: { page, limit } }).then((r) => r.data) });
}
export function useCreateSupplier() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.post("/api/v1/suppliers", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Supplier created"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}

// ===== PURCHASE ORDERS =====
export function usePurchaseOrders(page = 1, limit = 20) {
    return useQuery({ queryKey: ["purchase-orders", page, limit], queryFn: () => apiClient.get("/api/v1/purchase-orders", { params: { page, limit } }).then((r) => r.data) });
}
export function usePurchaseOrder(id: string) {
    return useQuery({ queryKey: ["purchase-orders", id], queryFn: () => apiClient.get(`/api/v1/purchase-orders/${id}`).then((r) => r.data), enabled: !!id });
}
export function useCreatePurchaseOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.post("/api/v1/purchase-orders", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); toast.success("Purchase order created"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}
export function useReceivePurchaseOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => apiClient.post(`/api/v1/purchase-orders/${id}/receive`, data).then((r) => r.data),
        onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ["purchase-orders", v.id] }); qc.invalidateQueries({ queryKey: ["purchase-orders"] }); qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Items received"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}

// ===== ANALYTICS =====
export function useDashboard() {
    return useQuery({ queryKey: ["analytics", "dashboard"], queryFn: () => apiClient.get("/api/v1/analytics/dashboard").then((r) => r.data), staleTime: 300_000 });
}
export function useSalesAnalytics(from: string, to: string, groupBy: string) {
    return useQuery({ queryKey: ["analytics", "sales", from, to, groupBy], queryFn: () => apiClient.get("/api/v1/analytics/sales", { params: { from, to, groupBy } }).then((r) => r.data) });
}

// ===== ORG =====
export function useOrg() {
    return useQuery({ queryKey: ["org"], queryFn: () => apiClient.get("/api/v1/org").then((r) => r.data) });
}
export function useSubscription() {
    return useQuery({ queryKey: ["org", "subscription"], queryFn: () => apiClient.get("/api/v1/org/subscription").then((r) => r.data) });
}
export function useOrgSettings() {
    return useQuery({ queryKey: ["org", "settings"], queryFn: () => apiClient.get("/api/v1/org/settings").then((r) => r.data) });
}
export function useUpdateOrg() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.patch("/api/v1/org", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["org"] }); toast.success("Organization updated"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}
export function useUpdateOrgSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.patch("/api/v1/org/settings", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["org"] }); toast.success("Settings updated"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}

// ===== STORAGE =====
export function useUploadFile() {
    return useMutation({
        mutationFn: (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            return apiClient.post("/api/v1/storage/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            }).then((r) => r.data);
        },
        onError: (e) => toast.error(getApiError(e).message),
    });
}

// ===== INVENTORY EXTENDED =====
export function useWarehouses() {
    return useQuery({ queryKey: ["inventory", "warehouses"], queryFn: () => apiClient.get("/api/v1/inventory/warehouses").then((r) => r.data) });
}
export function useInventoryValuation() {
    return useQuery({ queryKey: ["inventory", "valuation"], queryFn: () => apiClient.get("/api/v1/inventory/valuation").then((r) => r.data) });
}
export function useInventoryTransactions(filters: Record<string, string | number | undefined>) {
    return useQuery({ queryKey: ["inventory", "transactions", filters], queryFn: () => apiClient.get("/api/v1/inventory/transactions", { params: filters }).then((r) => r.data) });
}
export function useAdjustInventory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.post("/api/v1/inventory/adjust", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Stock adjusted"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}
export function useTransferInventory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.post("/api/v1/inventory/transfer", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Stock transferred"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}

// ===== INVOICES EXTENDED =====
export function useCreateInvoice() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => apiClient.post("/api/v1/invoices", data).then((r) => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Invoice created successfully"); },
        onError: (e) => toast.error(getApiError(e).message),
    });
}
export function useCreateInvoiceFromOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (orderId: string) => apiClient.post(`/api/v1/invoices/from-order/${orderId}`).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Invoice generated successfully");
        },
        onError: (e) => toast.error(getApiError(e).message),
    });
}
export function useGenerateInvoicePdf() {
    return useMutation({
        mutationFn: (id: string) => apiClient.post(`/api/v1/invoices/${id}/pdf`).then((r) => r.data),
        onSuccess: () => toast.success("PDF Generated"),
        onError: (e) => toast.error(getApiError(e).message),
    });
}
export function useCreatePaymentLink() {
    return useMutation({
        mutationFn: (id: string) => apiClient.post(`/api/v1/invoices/${id}/payment-link`).then((r) => r.data),
        onSuccess: () => toast.success("Payment Link Generated"),
        onError: (e) => toast.error(getApiError(e).message),
    });
}
export function useSendInvoiceWhatsApp() {
    return useMutation({
        mutationFn: (id: string) => apiClient.post(`/api/v1/invoices/${id}/send`, { channels: ["whatsapp"] }).then((r) => r.data),
        onSuccess: () => toast.success("Invoice sent via WhatsApp"),
        onError: (e) => toast.error(getApiError(e).message),
    });
}
