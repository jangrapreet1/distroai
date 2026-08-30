export interface TopProduct {
    id: string;
    name: string;
    revenue: number;
    salesCount: number;
    inventory: number;
}

export interface TopCustomer {
    id: string;
    name: string;
    revenue: number;
    orderCount: number;
}

export interface DashboardData {
    today: { revenue: number; orders: number };
    thisMonth: { revenue: number; orders: number };
    collections: { totalOutstanding: number; totalCredit: number };
    inventory: { lowStockCount: number };
    topProducts: TopProduct[];
    topCustomers: TopCustomer[];
    recentOrders: {
        id: string;
        orderNumber: string;
        netAmount: number;
        status: string;
        createdAt: string;
        customer: { name: string } | null;
        source?: string;
    }[];
}

export interface CatalogProduct {
    id: string;
    name: string;
    sku: string;
    price: number;
    originalPrice: number;
    stock: number;
    inStock: boolean;
    category: string;
    brand: string;
    imageUrl?: string;
}

export interface OrderItem {
    id: string;
    productId: string;
    quantity: number;
    price: number;
    totalAmount: number;
}

export interface Order {
    id: string;
    orderNumber: string;
    status: string;
    netAmount: number;
    createdAt: string;
    items?: OrderItem[];
}
