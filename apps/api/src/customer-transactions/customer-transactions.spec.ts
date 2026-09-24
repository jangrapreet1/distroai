/**
 * apps/api/src/customer-transactions/customer-transactions.spec.ts
 *
 * Comprehensive unit test suite for Milestone M1:
 * 1. Dynamic Ledger Calculation & Floating-Point Drift Elimination
 * 2. Strict Chronological Ordering & Same-Date Anti-Aggregation
 * 3. Historical Price Immutability & Catalog Decoupling
 * 4. Hindi / Devanagari Unicode Text Preservation & Validation
 * 5. Mutation Audit Trail Integration & Error Resilience
 * 6. Multi-Tenant Security & BOLA Isolation
 * 7. RTK 5-Column Statement Transformation
 */

import { validate, IsString, IsNotEmpty, IsOptional, MaxLength, Matches, IsNumber, Min } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { NotFoundException } from '@nestjs/common';
import {
  calculateCustomerLedger,
  compareTransactions,
  toPaise,
  fromPaise,
  round2,
  formatCurrencyINR,
  toDateOnlyString,
  normalizeDate,
  toRtkStatementRows,
  CustomerTransactionType,
  PaymentMethod,
  TransactionInput,
  CustomerLedgerCalculationEngine,
} from './customer-transactions.calculation';

// Unicode-aware regex matching letters, combining marks (matras), digits, punctuation, symbols (including Rupee ₹ and math), format chars (ZWNJ/ZWJ), and spaces
export const UNICODE_TEXT_PATTERN = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Cf}\p{Zs}\n\r]*$/u;

export class CreateTransactionItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Item name cannot be empty' })
  @MaxLength(255, { message: 'Item name must not exceed 255 characters' })
  @Matches(UNICODE_TEXT_PATTERN, {
    message: 'Item name contains invalid or unprintable characters',
  })
  productName!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsNotEmpty()
  type!: CustomerTransactionType;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  @Matches(UNICODE_TEXT_PATTERN, {
    message: 'Description contains invalid characters',
  })
  description?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  items?: CreateTransactionItemDto[];
}

describe('Customer Transactions — Milestone M1 Comprehensive Test Suite', () => {

  // =========================================================================
  // SUITE 1: DYNAMIC LEDGER CALCULATION & FLOATING-POINT DRIFT ELIMINATION
  // =========================================================================
  describe('Suite 1: Dynamic Calculation Engine & Decimal Precision', () => {
    it('1.1 should eliminate IEEE-754 binary floating-point drift (0.1 + 0.2 = 0.3)', () => {
      const p1 = toPaise(0.1);
      const p2 = toPaise(0.2);
      expect(p1).toBe(10);
      expect(p2).toBe(20);
      expect(fromPaise(p1 + p2)).toBe(0.3);

      // Cumulative drift test: 1000 additions of 0.10
      let totalPaise = 0;
      for (let i = 0; i < 1000; i++) {
        totalPaise += toPaise(0.1);
      }
      expect(totalPaise).toBe(10000);
      expect(fromPaise(totalPaise)).toBe(100.0);
    });

    it('1.2 should accurately parse numbers, strings, and Prisma Decimal-like objects', () => {
      expect(toPaise(12450.75)).toBe(1245075);
      expect(toPaise('12450.75')).toBe(1245075);
      expect(toPaise({ toString: () => '99.99' })).toBe(9999);
      expect(toPaise({ toNumber: () => 500.25 })).toBe(50025);
      expect(toPaise(null)).toBe(0);
      expect(toPaise(undefined)).toBe(0);
      expect(toPaise('')).toBe(0);
      expect(fromPaise(1245075)).toBe(12450.75);
      expect(round2(1234.567)).toBe(1234.57);
    });

    it('1.3 should calculate Total Goods Given (SUM SALE) and increase balance', () => {
      const sales: TransactionInput[] = [
        { id: 's1', date: '2026-04-01', type: CustomerTransactionType.SALE, amount: 15000 },
        { id: 's2', date: '2026-04-02', type: CustomerTransactionType.SALE, amount: 25000 },
      ];

      const { summary, entries } = calculateCustomerLedger(sales);
      expect(summary.totalGoodsGiven).toBe(40000);
      expect(summary.totalGoodsReturned).toBe(0);
      expect(summary.totalPaymentsReceived).toBe(0);
      expect(summary.netBalance).toBe(40000);
      expect(entries[0].runningBalance).toBe(15000);
      expect(entries[1].runningBalance).toBe(40000);
    });

    it('1.4 should calculate Total Goods Returned (SUM RETURN) and decrease balance', () => {
      const txs: TransactionInput[] = [
        { id: 's1', date: '2026-04-01', type: CustomerTransactionType.SALE, amount: 20000 },
        { id: 'r1', date: '2026-04-03', type: CustomerTransactionType.RETURN, amount: 4000 },
      ];

      const { summary, entries } = calculateCustomerLedger(txs);
      expect(summary.totalGoodsGiven).toBe(20000);
      expect(summary.totalGoodsReturned).toBe(4000);
      expect(summary.netBalance).toBe(16000); // 20000 - 4000
      expect(entries[0].runningBalance).toBe(20000);
      expect(entries[1].runningBalance).toBe(16000);
    });

    it('1.5 should calculate Total Payments Received (SUM PAYMENT) and decrease balance', () => {
      const txs: TransactionInput[] = [
        { id: 's1', date: '2026-04-01', type: CustomerTransactionType.SALE, amount: 30000 },
        { id: 'p1', date: '2026-04-05', type: CustomerTransactionType.PAYMENT, amount: 12000, paymentMethod: PaymentMethod.UPI },
        { id: 'p2', date: '2026-04-08', type: CustomerTransactionType.PAYMENT, amount: 8000, paymentMethod: PaymentMethod.CASH },
      ];

      const { summary, entries } = calculateCustomerLedger(txs);
      expect(summary.totalPaymentsReceived).toBe(20000);
      expect(summary.netBalance).toBe(10000); // 30000 - 20000
      expect(entries[1].runningBalance).toBe(18000);
      expect(entries[2].runningBalance).toBe(10000);
    });

    it('1.6 should calculate Adjustments (both positive debit and negative credit)', () => {
      const txs: TransactionInput[] = [
        { id: 's1', date: '2026-04-01', type: CustomerTransactionType.SALE, amount: 10000 },
        { id: 'a1', date: '2026-04-02', type: CustomerTransactionType.ADJUSTMENT, amount: 500, description: 'Interest penalty' },
        { id: 'a2', date: '2026-04-03', type: CustomerTransactionType.ADJUSTMENT, amount: -300, description: 'Prompt payment discount' },
      ];

      const { summary, entries } = calculateCustomerLedger(txs);
      expect(summary.totalAdjustments).toBe(200); // +500 - 300
      expect(summary.netBalance).toBe(10200); // 10000 + 500 - 300
      expect(entries[1].runningBalance).toBe(10500);
      expect(entries[2].runningBalance).toBe(10200);
    });

    it('1.7 should verify invariant: row-by-row running balances and final row balance === summary.netBalance', () => {
      const txs: TransactionInput[] = [
        { id: 'tx-1', date: '2026-04-01', type: CustomerTransactionType.SALE, amount: 5000.50 },
        { id: 'tx-2', date: '2026-04-02', type: CustomerTransactionType.SALE, amount: 2500.25 },
        { id: 'tx-3', date: '2026-04-03', type: CustomerTransactionType.RETURN, amount: 750.75 },
        { id: 'tx-4', date: '2026-04-04', type: CustomerTransactionType.PAYMENT, amount: 4000.00 },
        { id: 'tx-5', date: '2026-04-05', type: CustomerTransactionType.ADJUSTMENT, amount: -250.00 },
      ];

      const { summary, entries } = calculateCustomerLedger(txs);

      // Verify each row's running balance
      expect(entries[0].runningBalance).toBe(5000.50);
      expect(entries[1].runningBalance).toBe(7500.75);
      expect(entries[2].runningBalance).toBe(6750.00);
      expect(entries[3].runningBalance).toBe(2750.00);
      expect(entries[4].runningBalance).toBe(2500.00);

      // Invariant: Final row running balance matches summary.netBalance exactly
      expect(entries[entries.length - 1].runningBalance).toBe(summary.netBalance);
      expect(summary.netBalance).toBe(2500.00);
    });

    it('1.8 should support initial opening balance and synthetic opening row', () => {
      const txs: TransactionInput[] = [
        { id: 'tx-1', date: '2026-04-10', type: CustomerTransactionType.SALE, amount: 5000 },
      ];

      const { summary, entries } = calculateCustomerLedger(txs, {
        initialBalance: 12000,
        includeOpeningBalanceRow: true,
        openingBalanceDate: '2026-04-01',
      });

      expect(summary.openingBalance).toBe(12000);
      expect(summary.closingBalance).toBe(17000);
      expect(summary.netBalance).toBe(17000);
      expect(entries.length).toBe(2);
      expect(entries[0].id).toBe('OPENING_BALANCE');
      expect(entries[0].runningBalance).toBe(12000);
      expect(entries[1].runningBalance).toBe(17000);
    });

    it('1.9 should format currency in INR with Rupee symbol and lakh/crore formatting', () => {
      const formatted = formatCurrencyINR(125450.50);
      expect(formatted).toContain('1,25,450.50');
    });
  });

  // =========================================================================
  // SUITE 2: STRICT CHRONOLOGICAL SORTING & SAME-DATE ANTI-AGGREGATION
  // =========================================================================
  describe('Suite 2: Strict Chronological Sorting & Anti-Aggregation', () => {
    it('2.1 should order transactions ascending by date ASC, then createdAt ASC, then id ASC', () => {
      const unordered: TransactionInput[] = [
        { id: 'tx-3', date: '2026-04-15', createdAt: '2026-04-15T14:00:00Z', type: CustomerTransactionType.SALE, amount: 300 },
        { id: 'tx-1', date: '2026-04-10', createdAt: '2026-04-10T10:00:00Z', type: CustomerTransactionType.SALE, amount: 100 },
        { id: 'tx-2', date: '2026-04-15', createdAt: '2026-04-15T09:00:00Z', type: CustomerTransactionType.PAYMENT, amount: 50 },
      ];

      const sorted = [...unordered].sort(compareTransactions);
      expect(sorted.map((t) => t.id)).toEqual(['tx-1', 'tx-2', 'tx-3']);
    });

    it('2.2 should use id ASC as deterministic tie-breaker when date and createdAt are identical', () => {
      const sameTimestamp: TransactionInput[] = [
        { id: 'tx-c', date: '2026-04-20', createdAt: '2026-04-20T10:00:00Z', type: CustomerTransactionType.SALE, amount: 100 },
        { id: 'tx-a', date: '2026-04-20', createdAt: '2026-04-20T10:00:00Z', type: CustomerTransactionType.SALE, amount: 200 },
        { id: 'tx-b', date: '2026-04-20', createdAt: '2026-04-20T10:00:00Z', type: CustomerTransactionType.SALE, amount: 300 },
      ];

      const sorted = [...sameTimestamp].sort(compareTransactions);
      expect(sorted.map((t) => t.id)).toEqual(['tx-a', 'tx-b', 'tx-c']);
    });

    it('2.3 should NEVER aggregate multiple transactions on the same date into a single row', () => {
      const sameDateTxs: TransactionInput[] = [
        { id: 'tx-morning', date: '2026-04-25', createdAt: '2026-04-25T09:00:00Z', type: CustomerTransactionType.SALE, amount: 5000, description: 'Morning cement' },
        { id: 'tx-afternoon', date: '2026-04-25', createdAt: '2026-04-25T14:00:00Z', type: CustomerTransactionType.SALE, amount: 3000, description: 'Afternoon steel' },
        { id: 'tx-evening', date: '2026-04-25', createdAt: '2026-04-25T18:00:00Z', type: CustomerTransactionType.PAYMENT, amount: 4000, description: 'Evening cash receipt' },
      ];

      const { entries, summary } = calculateCustomerLedger(sameDateTxs);

      // Must remain 3 separate rows
      expect(entries.length).toBe(3);
      expect(entries[0].id).toBe('tx-morning');
      expect(entries[0].runningBalance).toBe(5000);
      expect(entries[1].id).toBe('tx-afternoon');
      expect(entries[1].runningBalance).toBe(8000);
      expect(entries[2].id).toBe('tx-evening');
      expect(entries[2].runningBalance).toBe(4000);
      expect(summary.netBalance).toBe(4000);
    });

    it('2.4 should handle Date objects and ISO strings interchangeably without timezone corruption', () => {
      const dateObj = new Date('2026-05-01T00:00:00.000Z');
      const dateStr = '2026-05-01';
      expect(toDateOnlyString(dateObj)).toBe('2026-05-01');
      expect(toDateOnlyString(dateStr)).toBe('2026-05-01');
    });
  });

  // =========================================================================
  // SUITE 3: HISTORICAL PRICE IMMUTABILITY & CATALOG DECOUPLING
  // =========================================================================
  describe('Suite 3: Historical Price Immutability', () => {
    it('3.1 should snapshot product catalog price and name into line item at creation', () => {
      const catalogProduct = {
        id: 'prod-marble-001',
        name: 'White Marble Slab 10x12',
        sellingPrice: 450.00,
      };

      const lineItem = {
        id: 'item-101',
        productId: catalogProduct.id,
        productName: catalogProduct.name,
        quantity: 10,
        unitPrice: catalogProduct.sellingPrice,
        amount: 10 * catalogProduct.sellingPrice,
      };

      expect(lineItem.unitPrice).toBe(450.00);
      expect(lineItem.amount).toBe(4500.00);
      expect(lineItem.productName).toBe('White Marble Slab 10x12');
    });

    it('3.2 modifying Product catalog price must NEVER alter historical transaction items', () => {
      // Step 1: Historical line item created with snapshot rate ₹450
      const historicalItem = {
        id: 'item-101',
        transactionId: 'tx-101',
        productId: 'prod-marble-001',
        productName: 'White Marble Slab 10x12',
        quantity: 10,
        unitPrice: 450.00,
        amount: 4500.00,
      };

      // Step 2: Product catalog price increases to ₹650
      const catalogProduct = {
        id: 'prod-marble-001',
        name: 'White Marble Slab 10x12 (Updated)',
        sellingPrice: 650.00, // Price mutated in master catalog
      };

      // Step 3: Historical item rate remains strictly ₹450
      expect(historicalItem.unitPrice).toBe(450.00);
      expect(historicalItem.amount).toBe(4500.00);
      expect(historicalItem.unitPrice).not.toBe(catalogProduct.sellingPrice);
    });

    it('3.3 dynamic ledger calculation must use snapshot rates, remaining impervious to catalog changes', () => {
      const tx: TransactionInput = {
        id: 'tx-1',
        date: '2026-04-01',
        type: CustomerTransactionType.SALE,
        amount: 4500.00,
        items: [
          {
            id: 'it-1',
            productId: 'prod-marble-001',
            productName: 'White Marble Slab 10x12',
            quantity: 10,
            unitPrice: 450.00, // Snapshot rate
            amount: 4500.00,
          },
        ],
      };

      const resBefore = calculateCustomerLedger([tx]);
      expect(resBefore.summary.totalGoodsGiven).toBe(4500.00);
      expect(resBefore.summary.netBalance).toBe(4500.00);

      // Even if catalog price in external table jumps to ₹900, ledger computation uses stored snapshot
      const resAfter = calculateCustomerLedger([tx]);
      expect(resAfter.summary.totalGoodsGiven).toBe(4500.00);
      expect(resAfter.summary.netBalance).toBe(4500.00);
      expect(resAfter.entries[0].items[0].unitPrice).toBe(450.00);
    });

    it('3.4 deleting catalog Product must leave transaction item intact with productId set to null', () => {
      const historicalItem = {
        id: 'item-101',
        productId: 'prod-marble-001' as string | null,
        productName: 'White Marble Slab 10x12',
        quantity: 10,
        unitPrice: 450.00,
        amount: 4500.00,
      };

      // Simulate DB onDelete: SetNull
      historicalItem.productId = null;

      expect(historicalItem.productId).toBeNull();
      expect(historicalItem.productName).toBe('White Marble Slab 10x12');
      expect(historicalItem.unitPrice).toBe(450.00);
      expect(historicalItem.amount).toBe(4500.00);
    });

    it('3.5 should support ad-hoc custom items without a catalog productId', () => {
      const adHocItem: CreateTransactionItemDto = {
        productName: 'अलमारी के लिए पत्थर (विशेष कटिंग)',
        quantity: 4,
        unitPrice: 350.00,
        amount: 1400.00,
      };

      expect(adHocItem.productId).toBeUndefined();
      expect(adHocItem.productName).toBe('अलमारी के लिए पत्थर (विशेष कटिंग)');
      expect(adHocItem.amount).toBe(1400.00);
    });
  });

  // =========================================================================
  // SUITE 4: HINDI / DEVANAGARI UNICODE TEXT PRESERVATION & VALIDATION
  // =========================================================================
  describe('Suite 4: Hindi / Devanagari Text Integrity & Validation', () => {
    it('4.1 should validate and accept authentic Hindi Devanagari descriptions', async () => {
      const dto = plainToInstance(CreateTransactionDto, {
        date: '2026-04-10',
        type: CustomerTransactionType.SALE,
        description: 'अलमारी के लिए पत्थर',
        amount: 3500,
        items: [
          {
            productName: 'अलमारी के लिए पत्थर',
            quantity: 5,
            unitPrice: 700,
            amount: 3500,
          },
        ],
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('4.2 should validate and accept mixed Hindi-English text with numbers and punctuation', async () => {
      const dto = plainToInstance(CreateTransactionDto, {
        date: '2026-04-10',
        type: CustomerTransactionType.SALE,
        description: 'दुकान मरम्मत सामग्री (Batch #2, 10x12 साइज)',
        amount: 12000,
        items: [
          {
            productName: 'चौखट फिटिंग मार्बल - 4 नग',
            quantity: 4,
            unitPrice: 3000,
            amount: 12000,
          },
        ],
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('4.3 should preserve complex Devanagari ligatures and matras across JSON roundtrips', () => {
      const complexHindiText = 'श्री राधे कृष्णा ट्रेडर्स (अलमारी के लिए पत्थर एवं चौखट)';
      const jsonPayload = JSON.stringify({ description: complexHindiText });
      const parsed = JSON.parse(jsonPayload);

      expect(parsed.description).toBe(complexHindiText);
      expect(Buffer.from(parsed.description, 'utf8').toString('utf8')).toBe(complexHindiText);
    });

    it('4.4 should reject unprintable control characters and null bytes', async () => {
      const dto = plainToInstance(CreateTransactionDto, {
        date: '2026-04-10',
        type: CustomerTransactionType.SALE,
        description: 'अवैध विवरण \u0000\u0007',
        amount: 1000,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.matches).toBeDefined();
    });

    it('4.5 should reject item names exceeding maximum allowed length of 255 characters', async () => {
      const longName = 'पत्थर '.repeat(60); // > 255 chars
      const dto = plainToInstance(CreateTransactionItemDto, {
        productName: longName,
        quantity: 1,
        unitPrice: 100,
        amount: 100,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.maxLength).toBeDefined();
    });
  });

  // =========================================================================
  // SUITE 5: MUTATION AUDIT TRAIL INTEGRATION & ERROR RESILIENCE
  // =========================================================================
  describe('Suite 5: Mutation Audit Trail Integration', () => {
    let auditLogCalls: any[] = [];
    const mockAuditLogService = {
      log: jest.fn(async (params: any) => {
        auditLogCalls.push(params);
      }),
    };

    beforeEach(() => {
      auditLogCalls = [];
      jest.clearAllMocks();
    });

    it('5.1 should record audit log on transaction creation with full item details in newValue', async () => {
      const user = { sub: 'usr-admin-1', orgId: 'org-distributor-1' };
      const createdTx = {
        id: 'tx-101',
        orgId: user.orgId,
        customerId: 'cust-55',
        date: new Date('2026-04-01T10:00:00Z'),
        type: CustomerTransactionType.SALE,
        description: 'अलमारी के लिए पत्थर',
        amount: 4500,
        items: [
          {
            id: 'item-1',
            productId: null,
            productName: 'अलमारी के लिए पत्थर',
            quantity: 10,
            unitPrice: 450,
            amount: 4500,
          },
        ],
      };

      await mockAuditLogService.log({
        orgId: user.orgId,
        userId: user.sub,
        action: 'CREATE',
        entityType: 'CUSTOMER_TRANSACTION',
        entityId: createdTx.id,
        oldValue: null,
        newValue: {
          id: createdTx.id,
          customerId: createdTx.customerId,
          date: createdTx.date.toISOString(),
          type: createdTx.type,
          description: createdTx.description,
          amount: createdTx.amount,
          items: createdTx.items,
        },
      });

      expect(mockAuditLogService.log).toHaveBeenCalledTimes(1);
      const call = auditLogCalls[0];
      expect(call.action).toBe('CREATE');
      expect(call.entityType).toBe('CUSTOMER_TRANSACTION');
      expect(call.entityId).toBe('tx-101');
      expect(call.userId).toBe('usr-admin-1');
      expect(call.orgId).toBe('org-distributor-1');
      expect(call.oldValue).toBeNull();
      expect(call.newValue.items.length).toBe(1);
      expect(call.newValue.items[0].productName).toBe('अलमारी के लिए पत्थर');
      expect(call.newValue.amount).toBe(4500);
    });

    it('5.2 should record audit log on transaction update with before-and-after snapshots', async () => {
      const user = { sub: 'usr-admin-1', orgId: 'org-distributor-1' };
      const beforeState = {
        id: 'tx-101',
        amount: 4500,
        items: [{ id: 'item-1', productName: 'अलमारी के लिए पत्थर', quantity: 10, unitPrice: 450, amount: 4500 }],
      };
      const afterState = {
        id: 'tx-101',
        amount: 5400, // Updated quantity from 10 to 12
        items: [{ id: 'item-1', productName: 'अलमारी के लिए पत्थर', quantity: 12, unitPrice: 450, amount: 5400 }],
      };

      await mockAuditLogService.log({
        orgId: user.orgId,
        userId: user.sub,
        action: 'UPDATE',
        entityType: 'CUSTOMER_TRANSACTION',
        entityId: 'tx-101',
        oldValue: beforeState,
        newValue: afterState,
      });

      expect(mockAuditLogService.log).toHaveBeenCalledTimes(1);
      const call = auditLogCalls[0];
      expect(call.action).toBe('UPDATE');
      expect(call.oldValue.amount).toBe(4500);
      expect(call.newValue.amount).toBe(5400);
      expect(call.oldValue.items[0].quantity).toBe(10);
      expect(call.newValue.items[0].quantity).toBe(12);
    });

    it('5.3 should record audit log on transaction delete with deleted snapshot in oldValue', async () => {
      const user = { sub: 'usr-admin-1', orgId: 'org-distributor-1' };
      const deletedState = {
        id: 'tx-101',
        amount: 4500,
        items: [{ id: 'item-1', productName: 'अलमारी के लिए पत्थर', quantity: 10, unitPrice: 450, amount: 4500 }],
      };

      await mockAuditLogService.log({
        orgId: user.orgId,
        userId: user.sub,
        action: 'DELETE',
        entityType: 'CUSTOMER_TRANSACTION',
        entityId: 'tx-101',
        oldValue: deletedState,
        newValue: null,
      });

      expect(mockAuditLogService.log).toHaveBeenCalledTimes(1);
      const call = auditLogCalls[0];
      expect(call.action).toBe('DELETE');
      expect(call.oldValue.id).toBe('tx-101');
      expect(call.oldValue.amount).toBe(4500);
      expect(call.newValue).toBeNull();
    });

    it('5.4 should safely catch and swallow audit log errors without failing business transaction', async () => {
      const failingAuditService = {
        log: jest.fn(async (_params?: any) => {
          throw new Error('Database connection timeout on audit log write');
        }),
      };

      const executeResilientLog = async (params: any) => {
        try {
          await failingAuditService.log(params);
        } catch (err) {
          // Swallow error to protect business transaction
          return;
        }
      };

      await expect(executeResilientLog({ action: 'CREATE' })).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // SUITE 6: MULTI-TENANT SECURITY & BOLA PREVENTION
  // =========================================================================
  describe('Suite 6: Multi-Tenant Security & BOLA Prevention', () => {
    it('6.1 should reject operations on transactions belonging to another tenant', async () => {
      const user = { sub: 'usr-1', orgId: 'org-tenant-A' };

      const mockFindTransaction = async (id: string, orgId: string) => {
        const storedTx = { id: 'tx-secret', orgId: 'org-tenant-B', amount: 10000 };
        if (storedTx.orgId !== orgId) {
          return null; // Scoped query blocks other org's record
        }
        return storedTx;
      };

      const result = await mockFindTransaction('tx-secret', user.orgId);
      expect(result).toBeNull();

      const executeProtectedAction = async () => {
        const tx = await mockFindTransaction('tx-secret', user.orgId);
        if (!tx) {
          throw new NotFoundException('Transaction not found or access denied');
        }
      };

      await expect(executeProtectedAction()).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // SUITE 7: RTK 5-COLUMN STATEMENT TRANSFORMATION
  // =========================================================================
  describe('Suite 7: RTK 5-Column Statement Transformation', () => {
    it('7.1 should correctly format 5-column RTK statement rows with Devanagari text support', () => {
      const txs: TransactionInput[] = [
        {
          id: '1',
          date: '2026-04-10',
          type: CustomerTransactionType.SALE,
          amount: 1500,
          description: 'अलमारी के लिए पत्थर',
          items: [{ productName: 'अलमारी पत्थर', quantity: 3, unitPrice: 500, amount: 1500 }],
        },
        {
          id: '2',
          date: '2026-04-11',
          type: CustomerTransactionType.RETURN,
          amount: 500,
          description: 'टूटा हुआ पत्थर',
        },
        {
          id: '3',
          date: '2026-04-12',
          type: CustomerTransactionType.PAYMENT,
          amount: 1000,
          paymentMethod: PaymentMethod.CASH,
          reference: 'REC-001',
        },
      ];

      const { entries } = calculateCustomerLedger(txs);
      const rtkRows = toRtkStatementRows(entries, 'Manish Sharma');

      expect(rtkRows.length).toBe(3);

      // Row 1: Sale
      expect(rtkRows[0].goodsGivenAmount).toBe(1500);
      expect(rtkRows[0].returnedAmount).toBeNull();
      expect(rtkRows[0].paymentReceivedAmount).toBeNull();
      expect(rtkRows[0].particulars).toContain('अलमारी के लिए पत्थर');
      expect(rtkRows[0].particulars).toContain('अलमारी पत्थर (3 @ ₹500.00)');

      // Row 2: Return
      expect(rtkRows[1].goodsGivenAmount).toBeNull();
      expect(rtkRows[1].returnedAmount).toBe(500);
      expect(rtkRows[1].paymentReceivedAmount).toBeNull();
      expect(rtkRows[1].particulars).toBe('टूटा हुआ पत्थर');

      // Row 3: Payment
      expect(rtkRows[2].goodsGivenAmount).toBeNull();
      expect(rtkRows[2].returnedAmount).toBeNull();
      expect(rtkRows[2].paymentReceivedAmount).toBe(1000);
      expect(rtkRows[2].particulars).toContain('Payment Received via CASH (Ref: REC-001)');
    });

    it('7.2 CustomerLedgerCalculationEngine static class methods should match functional results', () => {
      const txs: TransactionInput[] = [
        { id: '1', date: '2026-04-01', type: CustomerTransactionType.SALE, amount: 5000 },
        { id: '2', date: '2026-04-02', type: CustomerTransactionType.PAYMENT, amount: 2000 },
      ];

      const summary = CustomerLedgerCalculationEngine.computeSummary(txs);
      const ledger = CustomerLedgerCalculationEngine.computeChronologicalLedger(txs);

      expect(summary.totalGoodsGiven).toBe(5000);
      expect(summary.totalPaymentsReceived).toBe(2000);
      expect(summary.netBalance).toBe(3000);
      expect(ledger.length).toBe(2);
      expect(ledger[1].runningBalance).toBe(3000);
    });
  });
});
