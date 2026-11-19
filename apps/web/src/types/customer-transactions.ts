export type CustomerTransactionType = 'SALE' | 'RETURN' | 'PAYMENT' | 'ADJUSTMENT';

export type PaymentMethod = 'CASH' | 'UPI' | 'CHEQUE' | 'BANK_TRANSFER' | 'CREDIT';

export interface CreateTransactionItemDto {
  productId?: string;
  variantId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  amount?: number;
  unit?: string;
}

export interface CreateTransactionDto {
  date: string; // ISO format 'YYYY-MM-DD'
  type: CustomerTransactionType;
  amount: number; // positive for SALE, RETURN, PAYMENT; non-zero for ADJUSTMENT
  description?: string;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  items?: CreateTransactionItemDto[];
  warehouseId?: string;
}

export interface UpdateTransactionDto {
  date?: string;
  type?: CustomerTransactionType;
  amount?: number;
  description?: string;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  items?: CreateTransactionItemDto[];
}

export interface LedgerItemOutput {
  id: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  unit?: string | null;
}

export interface LedgerEntryWithBalance {
  id: string;
  date: string; // YYYY-MM-DD
  rawDate?: string | Date;
  type: CustomerTransactionType;
  description: string;
  amount: number;
  runningBalance: number;
  paymentMethod?: PaymentMethod | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
  items: LedgerItemOutput[];
}

export interface LedgerSummary {
  totalGoodsGiven: number;
  totalGoodsReturned: number;
  totalPaymentsReceived: number;
  totalAdjustments: number;
  netBalance: number;
  openingBalance?: number;
  closingBalance?: number;
  transactionCount?: number;
}

export interface CustomerLedgerResponse {
  customer: {
    id: string;
    name: string;
    phone?: string | null;
    outstandingAmount: number;
  };
  summary: LedgerSummary;
  entries: LedgerEntryWithBalance[];
}

export interface CustomerLedgerFilters {
  startDate?: string;
  endDate?: string;
  type?: CustomerTransactionType | string;
}

export interface RTKStatementData {
  organization: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    gstin?: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone?: string | null;
    city?: string | null;
    address?: string | null;
  };
  statementDate: string;
  rows: Array<{
    date: string;
    particulars: string;
    amount?: number | null;
    goodsGivenAmount?: number | null;
    returned?: number | null;
    returnedAmount?: number | null;
    paymentReceived?: number | null;
    paymentReceivedAmount?: number | null;
    runningBalance: number;
    rawType?: CustomerTransactionType;
  }>;
  summary: LedgerSummary;
}


export interface LedgerAuditChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  description: string;
}

export interface FormattedLedgerAuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | string;
  entityType: string;
  entityId: string;
  createdAt: string;
  user: {
    id?: string;
    name: string;
    email?: string;
  };
  summary: string;
  changes: LedgerAuditChange[];
  transactionSnapshot?: {
    date?: string;
    type?: CustomerTransactionType | string;
    amount?: number;
    description?: string;
  };
}

export interface CustomerLedgerLogsResponse {
  logs: FormattedLedgerAuditLog[];
  total: number;
}
