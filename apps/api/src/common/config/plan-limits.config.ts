export const PLAN_LIMITS = {
    FREE: {
        maxUsers: 1,
        maxMonthlyInvoices: 100,
        maxProducts: 50,
        maxCustomers: 100,
        maxAiQueriesPerMonth: 10,
        features: {
            whatsappBot: false,
            salesmanApp: false,
            shelfAudit: false,
            customReports: false,
            tallySync: false,
            apiAccess: false,
        },
    },
    STARTER: {
        maxUsers: 3,
        maxMonthlyInvoices: Infinity,
        maxProducts: 500,
        maxCustomers: 1000,
        maxAiQueriesPerMonth: 100,
        features: {
            whatsappBot: true,
            salesmanApp: true,
            shelfAudit: false,
            customReports: false,
            tallySync: false,
            apiAccess: false,
        },
    },
    GROWTH: {
        maxUsers: 10,
        maxMonthlyInvoices: Infinity,
        maxProducts: Infinity,
        maxCustomers: Infinity,
        maxAiQueriesPerMonth: 500,
        features: {
            whatsappBot: true,
            salesmanApp: true,
            shelfAudit: true,
            customReports: true,
            tallySync: true,
            apiAccess: false,
        },
    },
    ENTERPRISE: {
        maxUsers: Infinity,
        maxMonthlyInvoices: Infinity,
        maxProducts: Infinity,
        maxCustomers: Infinity,
        maxAiQueriesPerMonth: Infinity,
        features: {
            whatsappBot: true,
            salesmanApp: true,
            shelfAudit: true,
            customReports: true,
            tallySync: true,
            apiAccess: true,
        },
    },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;
export type FeatureName = keyof typeof PLAN_LIMITS.FREE.features;
