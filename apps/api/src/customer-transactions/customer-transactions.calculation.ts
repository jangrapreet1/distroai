/**
 * customer-transactions.calculation.ts
 *
 * Pure, deterministic customer ledger calculation engine.
 * Computes chronological running balances, summary metrics, and RTK statement rows
 * with zero floating-point drift using exact fixed-point paise arithmetic.
 */

export enum CustomerTransactionType {
  SALE = 'SALE',
  RETURN = 'RETURN',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum PaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CREDIT = 'CREDIT',
}

export interface TransactionItemInput {
  id?: string;
  productId?: string | null;
  productName: string;
  quantity: number | string | { toNumber?(): number; toString(): string };
  unitPrice: number | string | { toNumber?(): number; toString(): string };
  amount: number | string | { toNumber?(): number; toString(): string };
}

export interface TransactionInput {
  id: string;
  date: Date | string;
  type: CustomerTransactionType | string;
  amount: number | string | { toNumber?(): number; toString(): string };
  description?: string | null;
  paymentMethod?: PaymentMethod | string | null;
  reference?: string | null;
  notes?: string | null;
  createdAt?: Date | string | null;
  items?: TransactionItemInput[];
}

export interface LedgerItemOutput {
  id: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface LedgerEntryWithBalance {
  id: string;
  date: string; // ISO string 'YYYY-MM-DD'
  rawDate: Date;
  type: CustomerTransactionType;
  description: string;
  amount: number;
  runningBalance: number;
  paymentMethod?: PaymentMethod | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  items: LedgerItemOutput[];
}

export interface LedgerSummary {
  totalGoodsGiven: number;
  totalGoodsReturned: number;
  totalPaymentsReceived: number;
  totalAdjustments: number;
  netBalance: number;
  openingBalance: number;
  closingBalance: number;
  transactionCount: number;
}

export interface CustomerLedgerResult {
  summary: LedgerSummary;
  entries: LedgerEntryWithBalance[];
}

export interface CalculationOptions {
  /** Initial opening balance before the first transaction in this list (default: 0) */
  initialBalance?: number | string;
  /** Whether to prepend a synthetic opening balance row if initialBalance !== 0 */
  includeOpeningBalanceRow?: boolean;
  /** Date string for the synthetic opening balance row (YYYY-MM-DD) */
  openingBalanceDate?: string;
}

export interface RtkStatementRow {
  date: string;
  particulars: string;
  goodsGivenAmount: number | null;
  returnedAmount: number | null;
  paymentReceivedAmount: number | null;
  runningBalance: number;
  rawType: CustomerTransactionType;
}

// ---------------------------------------------------------------------------
// Exact Decimal / Paise Precision Helpers
// ---------------------------------------------------------------------------

/**
 * Converts any numeric input (number, string, Prisma.Decimal) into an exact integer Paise.
 * Uses exact fixed-point scaling to avoid binary floating-point roundoff.
 */
export function toPaise(val: number | string | { toNumber?(): number; toString(): string } | null | undefined): number {
  if (val === null || val === undefined) {
    return 0;
  }

  if (typeof val === 'object') {
    if (typeof val.toNumber === 'function') {
      const n = val.toNumber();
      return Math.round((n + (n >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100);
    }
    return toPaise(val.toString());
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return 0;
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return 0;
    return Math.round((parsed + (parsed >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100);
  }

  if (typeof val === 'number') {
    if (Number.isNaN(val) || !Number.isFinite(val)) return 0;
    return Math.round((val + (val >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100);
  }

  return 0;
}

/**
 * Converts integer paise back to a clean 2-decimal JavaScript number.
 */
export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Rounds a number to exactly two decimal places, avoiding IEEE-754 precision artifacts.
 */
export function round2(val: number): number {
  return Math.round((val + (val >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100;
}

/**
 * Formats a number into Indian Rupee currency format (e.g. ₹1,25,450.00).
 */
export function formatCurrencyINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

// ---------------------------------------------------------------------------
// Date Normalization Helpers
// ---------------------------------------------------------------------------

export function normalizeDate(d: Date | string | null | undefined): Date {
  if (!d) return new Date(0);
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

export function toDateOnlyString(d: Date | string | null | undefined): string {
  if (!d) return '1970-01-01';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return d;
  }
  const dateObj = normalizeDate(d);
  return dateObj.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// ---------------------------------------------------------------------------
// Sorting Comparator: Strict Chronological Order (No Date Aggregation)
// ---------------------------------------------------------------------------

/**
 * Strictly orders transactions:
 * 1. date ASC
 * 2. createdAt ASC
 * 3. id ASC (deterministic tie-breaker)
 */
export function compareTransactions(a: TransactionInput, b: TransactionInput): number {
  const dateA = toDateOnlyString(a.date);
  const dateB = toDateOnlyString(b.date);

  const dateDiff = dateA.localeCompare(dateB);
  if (dateDiff !== 0) {
    return dateDiff;
  }

  const createdA = a.createdAt ? normalizeDate(a.createdAt).getTime() : 0;
  const createdB = b.createdAt ? normalizeDate(b.createdAt).getTime() : 0;

  if (createdA !== createdB) {
    return createdA - createdB;
  }

  return (a.id || '').localeCompare(b.id || '');
}

// ---------------------------------------------------------------------------
// Core Ledger Calculation Engine
// ---------------------------------------------------------------------------

/**
 * Pure calculation function for dynamic customer ledger.
 *
 * @param transactions Array of transactions from the database
 * @param options Calculation options (initialBalance, openingBalanceDate)
 * @returns Summary metrics and chronologically sorted entries with running balance
 */
export function calculateCustomerLedger(
  transactions: TransactionInput[],
  options: CalculationOptions = {}
): CustomerLedgerResult {
  const initialPaise = toPaise(options.initialBalance ?? 0);

  // 1. Strict Ascending Chronological Sort (Never mutate input array)
  const sorted = [...transactions].sort(compareTransactions);

  // 2. Accumulators in exact integer Paise
  let totalGoodsGivenPaise = 0;
  let totalGoodsReturnedPaise = 0;
  let totalPaymentsReceivedPaise = 0;
  let totalAdjustmentsPaise = 0;
  let runningBalancePaise = initialPaise;

  const entries: LedgerEntryWithBalance[] = [];

  // 3. Optional: Prepend synthetic opening balance row if requested
  if (options.includeOpeningBalanceRow && initialPaise !== 0) {
    const obDate = options.openingBalanceDate || (sorted.length > 0 ? toDateOnlyString(sorted[0].date) : new Date().toISOString().slice(0, 10));
    entries.push({
      id: 'OPENING_BALANCE',
      date: obDate,
      rawDate: normalizeDate(obDate),
      type: CustomerTransactionType.ADJUSTMENT,
      description: 'Opening Balance (आरंभिक शेष)',
      amount: fromPaise(initialPaise),
      runningBalance: fromPaise(runningBalancePaise),
      createdAt: new Date(0).toISOString(),
      items: [],
    });
  }

  // 4. Iterate over sorted rows without aggregation
  for (const tx of sorted) {
    const txAmountPaise = toPaise(tx.amount);
    const type = tx.type as CustomerTransactionType;

    let deltaPaise = 0;

    switch (type) {
      case CustomerTransactionType.SALE:
        totalGoodsGivenPaise += txAmountPaise;
        deltaPaise = +txAmountPaise; // Debit: increases customer's balance
        break;

      case CustomerTransactionType.RETURN:
        totalGoodsReturnedPaise += txAmountPaise;
        deltaPaise = -txAmountPaise; // Credit: decreases customer's balance
        break;

      case CustomerTransactionType.PAYMENT:
        totalPaymentsReceivedPaise += txAmountPaise;
        deltaPaise = -txAmountPaise; // Credit: decreases customer's balance
        break;

      case CustomerTransactionType.ADJUSTMENT:
        // Adjustments can be positive (debit) or negative (credit)
        totalAdjustmentsPaise += txAmountPaise;
        deltaPaise = txAmountPaise;
        break;

      default:
        deltaPaise = 0;
        break;
    }

    runningBalancePaise += deltaPaise;

    // Map item list
    const items: LedgerItemOutput[] = (tx.items || []).map((item, idx) => {
      const q = fromPaise(toPaise(item.quantity));
      const p = fromPaise(toPaise(item.unitPrice));
      const a = fromPaise(toPaise(item.amount));
      return {
        id: item.id || `${tx.id}-item-${idx}`,
        productId: item.productId || null,
        productName: item.productName || 'Unnamed Item',
        quantity: q,
        unitPrice: p,
        amount: a,
      };
    });

    entries.push({
      id: tx.id,
      date: toDateOnlyString(tx.date),
      rawDate: normalizeDate(tx.date),
      type,
      description: tx.description || '',
      amount: fromPaise(txAmountPaise),
      runningBalance: fromPaise(runningBalancePaise),
      paymentMethod: (tx.paymentMethod as PaymentMethod) || null,
      reference: tx.reference || null,
      notes: tx.notes || null,
      createdAt: normalizeDate(tx.createdAt).toISOString(),
      items,
    });
  }

  const closingBalancePaise = runningBalancePaise;

  const summary: LedgerSummary = {
    totalGoodsGiven: fromPaise(totalGoodsGivenPaise),
    totalGoodsReturned: fromPaise(totalGoodsReturnedPaise),
    totalPaymentsReceived: fromPaise(totalPaymentsReceivedPaise),
    totalAdjustments: fromPaise(totalAdjustmentsPaise),
    netBalance: fromPaise(closingBalancePaise),
    openingBalance: fromPaise(initialPaise),
    closingBalance: fromPaise(closingBalancePaise),
    transactionCount: sorted.length,
  };

  return {
    summary,
    entries,
  };
}

// ---------------------------------------------------------------------------
// RTK 5-Column Statement Transformer
// ---------------------------------------------------------------------------

/**
 * Transforms ledger entries into the exact 5-column layout required by RTK Statement:
 * Columns: DATE | GOODS GIVEN TO [CUSTOMER] | AMOUNT | RETURNED | PAYMENT RECEIVED
 */
export function toRtkStatementRows(
  entries: LedgerEntryWithBalance[],
  customerName: string
): RtkStatementRow[] {
  return entries.map((entry) => {
    let goodsGivenAmount: number | null = null;
    let returnedAmount: number | null = null;
    let paymentReceivedAmount: number | null = null;

    let particulars = entry.description || '';

    // If items exist, construct item details string
    if (entry.items && entry.items.length > 0) {
      const itemsDetail = entry.items
        .map((it) => `${it.productName} (${it.quantity} @ ₹${it.unitPrice.toFixed(2)})`)
        .join(', ');
      particulars = particulars ? `${particulars} — ${itemsDetail}` : itemsDetail;
    }

    switch (entry.type) {
      case CustomerTransactionType.SALE:
        goodsGivenAmount = entry.amount;
        if (!particulars) particulars = `Goods Given to ${customerName}`;
        break;

      case CustomerTransactionType.RETURN:
        returnedAmount = entry.amount;
        if (!particulars) particulars = `Goods Returned by ${customerName}`;
        break;

      case CustomerTransactionType.PAYMENT:
        paymentReceivedAmount = entry.amount;
        const methodStr = entry.paymentMethod ? ` via ${entry.paymentMethod}` : '';
        const refStr = entry.reference ? ` (Ref: ${entry.reference})` : '';
        if (!particulars) particulars = `Payment Received${methodStr}${refStr}`;
        break;

      case CustomerTransactionType.ADJUSTMENT:
        if (entry.amount >= 0) {
          goodsGivenAmount = entry.amount;
          if (!particulars) particulars = `Adjustment (Debit)`;
        } else {
          paymentReceivedAmount = Math.abs(entry.amount);
          if (!particulars) particulars = `Adjustment (Credit)`;
        }
        break;
    }

    return {
      date: entry.date,
      particulars,
      goodsGivenAmount,
      returnedAmount,
      paymentReceivedAmount,
      runningBalance: entry.runningBalance,
      rawType: entry.type,
    };
  });
}

// ---------------------------------------------------------------------------
// Static Class Interface for Object-Oriented Consumers
// ---------------------------------------------------------------------------

export class CustomerLedgerCalculationEngine {
  public static round2(val: number): number {
    return round2(val);
  }

  public static toPaise(val: any): number {
    return toPaise(val);
  }

  public static fromPaise(paise: number): number {
    return fromPaise(paise);
  }

  public static sortChronologically<T extends { date: Date | string; createdAt?: Date | string | null; id?: string }>(
    transactions: T[]
  ): T[] {
    return [...transactions].sort((a, b) => compareTransactions(a as any, b as any));
  }

  public static computeSummary(
    transactions: Array<{ type: CustomerTransactionType | string; amount: number | string | any }>,
    initialBalance: number = 0
  ): LedgerSummary {
    const result = calculateCustomerLedger(transactions as any, { initialBalance });
    return result.summary;
  }

  public static computeChronologicalLedger(
    transactions: TransactionInput[],
    initialBalance: number = 0
  ): LedgerEntryWithBalance[] {
    const result = calculateCustomerLedger(transactions, { initialBalance });
    return result.entries;
  }

  public static toRtkStatementRows(
    entries: LedgerEntryWithBalance[],
    customerName: string
  ): RtkStatementRow[] {
    return toRtkStatementRows(entries, customerName);
  }
}
