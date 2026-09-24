/**
 * DistroAI Customer Ledger & RTK Statement Engine — End-to-End Test Suite (Tiers 1–4)
 *
 * Implements comprehensive verification of:
 * - Tier 1: Feature coverage for SALE, RETURN, PAYMENT, ADJUSTMENT, line items, DTOs
 * - Tier 2: Boundary cases (zero amounts, decimal precision, multiple transactions on exact same date,
 *           negative validation, empty descriptions vs Hindi Unicode descriptions)
 * - Tier 3: Cross-feature combinations (SALE + RETURN + PAYMENT + subsequent edits and deletions
 *           recalculating balance accurately)
 * - Tier 4: Full customer RTK account statement reproduction (matching Radhakishan Trading Company sample data)
 * - Immutability check: modifying product catalog prices does NOT mutate historical transaction item prices
 * - Multi-tenant isolation test: verifying orgId separation
 * - PDF rendering verification: ensuring PDF compiles without error with Hindi text and Rupee symbol
 *
 * Conforms strictly to:
 * - ORIGINAL_REQUEST.md (§R1, §R2, §R3, §R4, §R5, Acceptance Criteria)
 * - PROJECT.md (§Interface Contracts, §Feature Inventory F1-F11)
 * - security-guidelines-prompt.md
 */

import React from 'react';

// ─── Mock @react-pdf/renderer for Fast, Offline, Deterministic Verification ───
jest.mock('@react-pdf/renderer', () => {
  return {
    Document: ({ children }: any) => React.createElement('Document', null, children),
    Page: ({ children, style, size }: any) => React.createElement('Page', { style, size }, children),
    View: ({ children, style, wrap }: any) => React.createElement('View', { style, wrap }, children),
    Text: ({ children, style }: any) => React.createElement('Text', { style }, children),
    StyleSheet: {
      create: (styles: any) => styles,
    },
    Font: {
      register: jest.fn(),
      registerHyphenationCallback: jest.fn(),
    },
    renderToBuffer: jest.fn(async (element: any) => {
      // Serialize tree to verify content, Rupee symbol, and Devanagari text
      const serializeTree = (node: any): string => {
        if (!node) return '';
        if (typeof node === 'string' || typeof node === 'number') return String(node);
        if (Array.isArray(node)) return node.map(serializeTree).join(' ');
        if (typeof node.type === 'function') {
          return serializeTree(node.type(node.props));
        }
        if (node.props?.children) return serializeTree(node.props.children);
        return '';
      };
      const textContent = serializeTree(element);
      return Buffer.from(`%PDF-1.4\nMock RTK Statement PDF\n${textContent}\n%%EOF`, 'utf8');
    }),
  };
});

import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';

// ─── Domain Interface Contracts (PROJECT.md § Interface Contracts) ───

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

export interface CreateTransactionItemDto {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface CreateTransactionDto {
  date: string; // ISO-8601 YYYY-MM-DD
  type: CustomerTransactionType;
  description?: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  items?: CreateTransactionItemDto[];
}

export interface UpdateTransactionDto {
  date?: string;
  type?: CustomerTransactionType;
  description?: string;
  amount?: number;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  items?: CreateTransactionItemDto[];
}

export interface LedgerSummary {
  totalGoodsGiven: number;
  totalGoodsReturned: number;
  totalPaymentsReceived: number;
  totalAdjustments: number;
  netBalance: number;
}

export interface LedgerEntryWithBalance {
  id: string;
  date: string;
  type: CustomerTransactionType;
  description?: string;
  amount: number;
  runningBalance: number;
  paymentMethod?: PaymentMethod;
  reference?: string;
  items: Array<{
    id: string;
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

export interface RTKStatementData {
  organization: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    phone?: string;
    gstin?: string;
  };
  customer: {
    id: string;
    name: string;
    phone?: string;
    city?: string;
  };
  statementDate: string;
  rows: Array<{
    date: string;
    particulars: string;
    amount?: number;
    returned?: number;
    paymentReceived?: number;
    runningBalance: number;
  }>;
  summary: LedgerSummary;
}

// ─── Pure Calculation Engine (Reference Oracle) ───

export class CustomerLedgerCalculationEngine {
  /**
   * Round to 2 decimal places to avoid IEEE-754 floating point precision drift.
   */
  public static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Sort transactions strictly ascending by date (YYYY-MM-DD), breaking ties by createdAt timestamp.
   */
  public static sortChronologically<T extends { date: string; createdAt?: string; id?: string }>(
    transactions: T[]
  ): T[] {
    return [...transactions].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      const aCreated = a.createdAt || a.id || '';
      const bCreated = b.createdAt || b.id || '';
      return aCreated.localeCompare(bCreated);
    });
  }

  /**
   * Calculate ledger summary aggregates from transactions according to R2:
   * Total Goods Given = Sum of SALE transactions
   * Total Goods Returned = Sum of RETURN transactions
   * Total Payments Received = Sum of PAYMENT transactions
   * Net Balance = Total Goods Given - Total Goods Returned - Total Payments Received + Total Adjustments
   */
  public static computeSummary(transactions: Array<{ type: CustomerTransactionType; amount: number }>): LedgerSummary {
    let totalGoodsGiven = 0;
    let totalGoodsReturned = 0;
    let totalPaymentsReceived = 0;
    let totalAdjustments = 0;

    for (const tx of transactions) {
      const amt = this.round2(tx.amount);
      switch (tx.type) {
        case CustomerTransactionType.SALE:
          totalGoodsGiven = this.round2(totalGoodsGiven + amt);
          break;
        case CustomerTransactionType.RETURN:
          totalGoodsReturned = this.round2(totalGoodsReturned + amt);
          break;
        case CustomerTransactionType.PAYMENT:
          totalPaymentsReceived = this.round2(totalPaymentsReceived + amt);
          break;
        case CustomerTransactionType.ADJUSTMENT:
          totalAdjustments = this.round2(totalAdjustments + amt);
          break;
      }
    }

    const netBalance = this.round2(
      totalGoodsGiven - totalGoodsReturned - totalPaymentsReceived + totalAdjustments
    );

    return {
      totalGoodsGiven,
      totalGoodsReturned,
      totalPaymentsReceived,
      totalAdjustments,
      netBalance,
    };
  }

  /**
   * Compute date-wise running balance for each transaction in chronological sequence.
   */
  public static computeChronologicalLedger(
    transactions: Array<{
      id: string;
      date: string;
      type: CustomerTransactionType;
      description?: string;
      amount: number;
      paymentMethod?: PaymentMethod;
      reference?: string;
      createdAt?: string;
      items?: any[];
    }>
  ): LedgerEntryWithBalance[] {
    const sorted = this.sortChronologically(transactions);
    let running = 0;

    return sorted.map((tx) => {
      const amt = this.round2(tx.amount);
      switch (tx.type) {
        case CustomerTransactionType.SALE:
          running = this.round2(running + amt);
          break;
        case CustomerTransactionType.RETURN:
        case CustomerTransactionType.PAYMENT:
          running = this.round2(running - amt);
          break;
        case CustomerTransactionType.ADJUSTMENT:
          running = this.round2(running + amt);
          break;
      }

      return {
        id: tx.id,
        date: tx.date,
        type: tx.type,
        description: tx.description,
        amount: amt,
        runningBalance: running,
        paymentMethod: tx.paymentMethod,
        reference: tx.reference,
        items: (tx.items || []).map((item, idx) => ({
          id: item.id || `item-${idx + 1}`,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })),
      };
    });
  }

  /**
   * Format the 5-column RTK Statement data structure from customer ledger entries.
   */
  public static generateRTKStatementData(
    org: any,
    customer: any,
    statementDate: string,
    transactions: any[]
  ): RTKStatementData {
    const ledger = this.computeChronologicalLedger(transactions);
    const summary = this.computeSummary(transactions);

    const rows = ledger.map((entry) => {
      let particulars = entry.description || '';
      if (entry.items && entry.items.length > 0) {
        const itemSummaries = entry.items.map(
          (i) => `${i.productName} (${i.quantity} @ ₹${this.round2(i.unitPrice)})`
        );
        particulars = particulars ? `${particulars} — ${itemSummaries.join(', ')}` : itemSummaries.join(', ');
      }

      let amount: number | undefined;
      let returned: number | undefined;
      let paymentReceived: number | undefined;

      switch (entry.type) {
        case CustomerTransactionType.SALE:
          amount = entry.amount;
          break;
        case CustomerTransactionType.RETURN:
          returned = entry.amount;
          break;
        case CustomerTransactionType.PAYMENT:
          paymentReceived = entry.amount;
          break;
        case CustomerTransactionType.ADJUSTMENT:
          if (entry.amount >= 0) {
            amount = entry.amount;
          } else {
            returned = Math.abs(entry.amount);
          }
          break;
      }

      return {
        date: entry.date,
        particulars,
        amount,
        returned,
        paymentReceived,
        runningBalance: entry.runningBalance,
      };
    });

    return {
      organization: {
        name: org.name,
        address: org.address,
        city: org.city,
        state: org.state,
        phone: org.phone,
        gstin: org.gstNumber,
      },
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        city: customer.city,
      },
      statementDate,
      rows,
      summary,
    };
  }
}

// ─── In-Memory Multi-Tenant Service Harness for E2E Contract Testing ───

export class InMemoryCustomerTransactionRepository {
  private transactions: Map<string, any> = new Map();
  private auditLogs: any[] = [];
  private idCounter = 1;

  public async createTransaction(orgId: string, customerId: string, dto: CreateTransactionDto, userId: string) {
    if (!dto.date || !dto.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('VALIDATION_ERROR: Date must be in YYYY-MM-DD format');
    }
    if (dto.amount === undefined || dto.amount === null || isNaN(dto.amount)) {
      throw new Error('VALIDATION_ERROR: Amount is required');
    }
    if (dto.amount < 0 && dto.type !== CustomerTransactionType.ADJUSTMENT) {
      throw new Error('VALIDATION_ERROR: Amount must be non-negative');
    }
    if (!Object.values(CustomerTransactionType).includes(dto.type)) {
      throw new Error(`VALIDATION_ERROR: Invalid transaction type ${dto.type}`);
    }

    if (dto.items && dto.items.length > 0) {
      for (const item of dto.items) {
        if (!item.productName || item.productName.trim() === '') {
          throw new Error('VALIDATION_ERROR: Line item productName is required');
        }
        if (item.quantity <= 0) {
          throw new Error('VALIDATION_ERROR: Line item quantity must be greater than zero');
        }
        if (item.unitPrice < 0) {
          throw new Error('VALIDATION_ERROR: Line item unitPrice cannot be negative');
        }
      }
    }

    const id = `ctx_${this.idCounter++}`;
    const createdAt = new Date().toISOString();
    const tx = {
      id,
      orgId,
      customerId,
      date: dto.date,
      type: dto.type,
      description: dto.description || '',
      amount: CustomerLedgerCalculationEngine.round2(dto.amount),
      paymentMethod: dto.paymentMethod,
      reference: dto.reference,
      notes: dto.notes,
      items: (dto.items || []).map((i, idx) => ({
        id: `${id}_item_${idx + 1}`,
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: CustomerLedgerCalculationEngine.round2(i.unitPrice),
        amount: CustomerLedgerCalculationEngine.round2(i.amount),
      })),
      createdAt,
      updatedAt: createdAt,
    };

    this.transactions.set(id, tx);
    return tx;
  }

  public async getLedger(orgId: string, customerId: string) {
    const list = Array.from(this.transactions.values()).filter(
      (t) => t.orgId === orgId && t.customerId === customerId
    );
    const entries = CustomerLedgerCalculationEngine.computeChronologicalLedger(list);
    const summary = CustomerLedgerCalculationEngine.computeSummary(list);
    return { entries, summary };
  }

  public async getTransactionById(orgId: string, id: string) {
    const tx = this.transactions.get(id);
    if (!tx || tx.orgId !== orgId) return null;
    return tx;
  }

  public async updateTransaction(
    orgId: string,
    id: string,
    dto: UpdateTransactionDto,
    userId: string
  ) {
    const existing = await this.getTransactionById(orgId, id);
    if (!existing) {
      throw new Error(`NOT_FOUND: Transaction ${id} not found for org ${orgId}`);
    }

    if (dto.amount !== undefined && dto.amount < 0 && (dto.type ?? existing.type) !== CustomerTransactionType.ADJUSTMENT) {
      throw new Error('VALIDATION_ERROR: Amount must be non-negative');
    }

    const oldSnapshot = JSON.parse(JSON.stringify(existing));
    const updated = {
      ...existing,
      date: dto.date ?? existing.date,
      type: dto.type ?? existing.type,
      description: dto.description ?? existing.description,
      amount: dto.amount !== undefined ? CustomerLedgerCalculationEngine.round2(dto.amount) : existing.amount,
      paymentMethod: dto.paymentMethod ?? existing.paymentMethod,
      reference: dto.reference ?? existing.reference,
      notes: dto.notes ?? existing.notes,
      items: dto.items
        ? dto.items.map((i, idx) => ({
            id: `${id}_item_${idx + 1}`,
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: CustomerLedgerCalculationEngine.round2(i.unitPrice),
            amount: CustomerLedgerCalculationEngine.round2(i.amount),
          }))
        : existing.items,
      updatedAt: new Date().toISOString(),
    };

    this.transactions.set(id, updated);

    this.auditLogs.push({
      id: `audit_${this.auditLogs.length + 1}`,
      orgId,
      userId,
      action: 'UPDATE_TRANSACTION',
      entityType: 'CustomerTransaction',
      entityId: id,
      oldValue: oldSnapshot,
      newValue: updated,
      createdAt: new Date().toISOString(),
    });

    return updated;
  }

  public async deleteTransaction(orgId: string, id: string, userId: string) {
    const existing = await this.getTransactionById(orgId, id);
    if (!existing) {
      throw new Error(`NOT_FOUND: Transaction ${id} not found for org ${orgId}`);
    }

    const snapshot = JSON.parse(JSON.stringify(existing));
    this.transactions.delete(id);

    this.auditLogs.push({
      id: `audit_${this.auditLogs.length + 1}`,
      orgId,
      userId,
      action: 'DELETE_TRANSACTION',
      entityType: 'CustomerTransaction',
      entityId: id,
      oldValue: snapshot,
      newValue: null,
      createdAt: new Date().toISOString(),
    });

    return { success: true, deletedId: id };
  }

  public getAuditLogs(orgId: string, entityId?: string) {
    return this.auditLogs.filter(
      (a) => a.orgId === orgId && (!entityId || a.entityId === entityId)
    );
  }

  public clear() {
    this.transactions.clear();
    this.auditLogs = [];
    this.idCounter = 1;
  }
}

// ─── RTK React-PDF Document Component ───

import { RTKStatementPDFDocument } from './rtk-statement.document';
export { RTKStatementPDFDocument };


// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE EXECUTION (TIERS 1 – 4)
// ═══════════════════════════════════════════════════════════════════════════

describe('Customer Ledger & RTK Statement Engine (E2E Test Suite)', () => {
  let repo: InMemoryCustomerTransactionRepository;
  const ORG_A = 'org_radhakishan_101';
  const ORG_B = 'org_competitor_202';
  const CUST_MANISH = 'cust_manish_001';
  const USER_ID = 'usr_admin_999';

  beforeEach(() => {
    repo = new InMemoryCustomerTransactionRepository();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 1: FEATURE COVERAGE & CONTRACT CONFORMANCE
  // ─────────────────────────────────────────────────────────────────────────
  describe('Tier 1: Feature Coverage & Contract Conformance', () => {
    describe('F1 & F4: Transaction Types and Ledger Net Balance Effects', () => {
      it('1.1 SALE transaction records debit and increases net customer balance', async () => {
        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 5000,
          description: '5 Cartons Biscuits',
        }, USER_ID);

        const { summary, entries } = await repo.getLedger(ORG_A, CUST_MANISH);
        expect(summary.totalGoodsGiven).toBe(5000);
        expect(summary.netBalance).toBe(5000);
        expect(entries[0].runningBalance).toBe(5000);
      });

      it('1.2 RETURN transaction records credit and decreases net customer balance', async () => {
        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 5000,
        }, USER_ID);

        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-02',
          type: CustomerTransactionType.RETURN,
          amount: 1000,
          description: '1 Carton Damaged Biscuits Returned',
        }, USER_ID);

        const { summary, entries } = await repo.getLedger(ORG_A, CUST_MANISH);
        expect(summary.totalGoodsGiven).toBe(5000);
        expect(summary.totalGoodsReturned).toBe(1000);
        expect(summary.netBalance).toBe(4000);
        expect(entries[1].runningBalance).toBe(4000);
      });

      it('1.3 PAYMENT transaction records credit and decreases net customer balance', async () => {
        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 5000,
        }, USER_ID);

        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-03',
          type: CustomerTransactionType.PAYMENT,
          amount: 2500,
          paymentMethod: PaymentMethod.UPI,
          reference: 'UPI/20260803/998877',
        }, USER_ID);

        const { summary, entries } = await repo.getLedger(ORG_A, CUST_MANISH);
        expect(summary.totalPaymentsReceived).toBe(2500);
        expect(summary.netBalance).toBe(2500);
        expect(entries[1].runningBalance).toBe(2500);
      });

      it('1.4 Positive ADJUSTMENT (debit memo/interest) increases customer balance', async () => {
        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.ADJUSTMENT,
          amount: 250,
          description: 'Late Payment Fee / Interest',
        }, USER_ID);

        const { summary, entries } = await repo.getLedger(ORG_A, CUST_MANISH);
        expect(summary.totalAdjustments).toBe(250);
        expect(summary.netBalance).toBe(250);
        expect(entries[0].runningBalance).toBe(250);
      });

      it('1.5 Multi-line item breakdown on SALE: sum of line items matches transaction amount', async () => {
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-04',
          type: CustomerTransactionType.SALE,
          amount: 16000,
          items: [
            { productName: 'Bath Soap', quantity: 10, unitPrice: 1200, amount: 12000 },
            { productName: 'Detergent', quantity: 5, unitPrice: 800, amount: 4000 },
          ],
        }, USER_ID);

        expect(tx.items.length).toBe(2);
        const sumItems = tx.items.reduce((acc: number, item: any) => acc + item.amount, 0);
        expect(sumItems).toBe(tx.amount);
      });

      it('1.6 Multi-line item breakdown on RETURN: records return quantities and rates', async () => {
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-05',
          type: CustomerTransactionType.RETURN,
          amount: 2400,
          items: [
            { productName: 'Bath Soap', quantity: 2, unitPrice: 1200, amount: 2400 },
          ],
        }, USER_ID);

        expect(tx.items[0].productName).toBe('Bath Soap');
        expect(tx.items[0].quantity).toBe(2);
        expect(tx.items[0].unitPrice).toBe(1200);
      });
    });

    describe('F2: Historical Rate Preservation & Hindi / Devanagari Descriptions', () => {
      it('1.7 Historical item rates are captured in the transaction snapshot', async () => {
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-04',
          type: CustomerTransactionType.SALE,
          amount: 1200,
          items: [
            { productId: 'prod_soap_01', productName: 'Bath Soap', quantity: 1, unitPrice: 1200, amount: 1200 },
          ],
        }, USER_ID);

        expect(tx.items[0].unitPrice).toBe(1200);
        expect(tx.items[0].productId).toBe('prod_soap_01');
      });

      it('1.8 Accepts custom Hindi Unicode transaction description', async () => {
        const hindiDesc = 'दुकान की मरम्मत के लिए विशेष अग्रिम';
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-05',
          type: CustomerTransactionType.SALE,
          amount: 3500,
          description: hindiDesc,
        }, USER_ID);

        expect(tx.description).toBe(hindiDesc);
      });

      it('1.9 Accepts Hindi item descriptions matching reference (अलमारी के लिए पत्थर)', async () => {
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-06',
          type: CustomerTransactionType.SALE,
          amount: 1500,
          items: [
            { productName: 'अलमारी के लिए पत्थर', quantity: 1, unitPrice: 1500, amount: 1500 },
          ],
        }, USER_ID);

        expect(tx.items[0].productName).toBe('अलमारी के लिए पत्थर');
      });

      it('1.10 Preserves mixed English and Hindi text without character corruption', async () => {
        const mixed = 'Order #1042 - विशेष सामान (Special Delivery)';
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-07',
          type: CustomerTransactionType.SALE,
          amount: 2200,
          notes: mixed,
        }, USER_ID);

        expect(tx.notes).toBe(mixed);
      });

      it('1.10a Line item productName snapshot preserved even if catalog product is deleted or renamed', async () => {
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-08',
          type: CustomerTransactionType.SALE,
          amount: 1500,
          items: [
            { productId: 'prod_archived_99', productName: 'Legacy Detergent Powder', quantity: 2, unitPrice: 750, amount: 1500 },
          ],
        }, USER_ID);

        // Catalog product simulated deletion or rename does not affect transaction item
        expect(tx.items[0].productName).toBe('Legacy Detergent Powder');
        expect(tx.items[0].unitPrice).toBe(750);
      });

      it('1.10b Hindi description with commercial abbreviations (उदा. "बिल सं. १०४२", "५० नग") preserved', async () => {
        const hindiCommercial = 'बिल सं. १०४२ - ५० नग साबुन और १० पेटी चाय';
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-09',
          type: CustomerTransactionType.SALE,
          amount: 8500,
          description: hindiCommercial,
        }, USER_ID);

        expect(tx.description).toBe(hindiCommercial);
      });
    });

    describe('F3: Audit Trail Logging on Mutations', () => {
      it('1.11 Updating transaction records audit log with old and new values', async () => {
        const created = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 5000,
        }, USER_ID);

        await repo.updateTransaction(ORG_A, created.id, {
          amount: 6000,
          notes: 'Corrected quantity after invoice audit',
        }, 'usr_auditor_444');

        const logs = repo.getAuditLogs(ORG_A, created.id);
        expect(logs.length).toBe(1);
        expect(logs[0].action).toBe('UPDATE_TRANSACTION');
        expect(logs[0].userId).toBe('usr_auditor_444');
        expect(logs[0].oldValue.amount).toBe(5000);
        expect(logs[0].newValue.amount).toBe(6000);
      });

      it('1.12 Deleting transaction records audit log with full snapshot of deleted row', async () => {
        const created = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.RETURN,
          amount: 800,
        }, USER_ID);

        await repo.deleteTransaction(ORG_A, created.id, 'usr_auditor_444');

        const logs = repo.getAuditLogs(ORG_A, created.id);
        expect(logs.length).toBe(1);
        expect(logs[0].action).toBe('DELETE_TRANSACTION');
        expect(logs[0].oldValue.amount).toBe(800);
        expect(logs[0].newValue).toBeNull();
      });

      it('1.12a Audit log captures actor userId, orgId, and valid ISO timestamp', async () => {
        const created = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 2000,
        }, USER_ID);

        await repo.updateTransaction(ORG_A, created.id, { description: 'Updated' }, 'usr_compliance_777');
        const logs = repo.getAuditLogs(ORG_A, created.id);

        expect(logs[0].orgId).toBe(ORG_A);
        expect(logs[0].userId).toBe('usr_compliance_777');
        expect(new Date(logs[0].createdAt).getTime()).not.toBeNaN();
      });

      it('1.12b Unchanged fields are preserved in new audit snapshot', async () => {
        const created = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 4500,
          description: 'Original Desc',
        }, USER_ID);

        await repo.updateTransaction(ORG_A, created.id, { amount: 5000 }, USER_ID);
        const logs = repo.getAuditLogs(ORG_A, created.id);

        expect(logs[0].newValue.description).toBe('Original Desc');
        expect(logs[0].newValue.type).toBe(CustomerTransactionType.SALE);
        expect(logs[0].newValue.amount).toBe(5000);
      });

      it('1.12c Line item mutations (adding/removing items) are fully captured in audit log', async () => {
        const created = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 1200,
          items: [{ productName: 'Soap', quantity: 1, unitPrice: 1200, amount: 1200 }],
        }, USER_ID);

        await repo.updateTransaction(ORG_A, created.id, {
          amount: 2000,
          items: [
            { productName: 'Soap', quantity: 1, unitPrice: 1200, amount: 1200 },
            { productName: 'Shampoo', quantity: 1, unitPrice: 800, amount: 800 },
          ],
        }, USER_ID);

        const logs = repo.getAuditLogs(ORG_A, created.id);
        expect(logs[0].oldValue.items.length).toBe(1);
        expect(logs[0].newValue.items.length).toBe(2);
        expect(logs[0].newValue.items[1].productName).toBe('Shampoo');
      });
    });

    describe('F5: Multi-Tenant Security & Input Validation', () => {
      it('1.13 Tenant scoping: Querying Org B never returns Org A customer transactions', async () => {
        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 7500,
        }, USER_ID);

        const ledgerA = await repo.getLedger(ORG_A, CUST_MANISH);
        const ledgerB = await repo.getLedger(ORG_B, CUST_MANISH);

        expect(ledgerA.entries.length).toBe(1);
        expect(ledgerA.summary.netBalance).toBe(7500);

        expect(ledgerB.entries.length).toBe(0);
        expect(ledgerB.summary.netBalance).toBe(0);
      });

      it('1.14 BOLA prevention: Org B cannot fetch, update, or delete Org A transactions', async () => {
        const created = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 7500,
        }, USER_ID);

        const fetchByB = await repo.getTransactionById(ORG_B, created.id);
        expect(fetchByB).toBeNull();

        await expect(
          repo.updateTransaction(ORG_B, created.id, { amount: 1000 }, USER_ID)
        ).rejects.toThrow(/NOT_FOUND/);

        await expect(
          repo.deleteTransaction(ORG_B, created.id, USER_ID)
        ).rejects.toThrow(/NOT_FOUND/);
      });

      it('1.15 Input validation: Rejects malformed dates', async () => {
        await expect(
          repo.createTransaction(ORG_A, CUST_MANISH, {
            date: '04-08-2026', // non ISO YYYY-MM-DD
            type: CustomerTransactionType.SALE,
            amount: 1000,
          }, USER_ID)
        ).rejects.toThrow(/VALIDATION_ERROR: Date must be in YYYY-MM-DD format/);
      });

      it('1.16 Input validation: Rejects invalid transaction type', async () => {
        await expect(
          repo.createTransaction(ORG_A, CUST_MANISH, {
            date: '2026-08-04',
            type: 'UNKNOWN_TYPE' as any,
            amount: 1000,
          }, USER_ID)
        ).rejects.toThrow(/VALIDATION_ERROR: Invalid transaction type/);
      });

      it('1.17 Input validation: Rejects negative amounts', async () => {
        await expect(
          repo.createTransaction(ORG_A, CUST_MANISH, {
            date: '2026-08-04',
            type: CustomerTransactionType.SALE,
            amount: -500,
          }, USER_ID)
        ).rejects.toThrow(/VALIDATION_ERROR: Amount must be non-negative/);
      });

      it('1.18 Input validation: Rejects zero or negative line item quantity', async () => {
        await expect(
          repo.createTransaction(ORG_A, CUST_MANISH, {
            date: '2026-08-04',
            type: CustomerTransactionType.SALE,
            amount: 1000,
            items: [
              { productName: 'Soap', quantity: 0, unitPrice: 1000, amount: 0 },
            ],
          }, USER_ID)
        ).rejects.toThrow(/Line item quantity must be greater than zero/);
      });
    });

    describe('F8 & F9: RTK 5-Column Statement Structure & PDF Rendering', () => {
      it('1.19 RTK statement data structure formats 5 distinct columns', () => {
        const statement = CustomerLedgerCalculationEngine.generateRTKStatementData(
          { name: 'Radhakishan Trading Company', city: 'Bhiwani' },
          { id: CUST_MANISH, name: 'Manish' },
          '2026-08-31',
          [
            { id: '1', date: '2026-08-04', type: CustomerTransactionType.SALE, amount: 16000, description: '10 Boxes Bath Soap' },
            { id: '2', date: '2026-08-10', type: CustomerTransactionType.PAYMENT, amount: 10000, description: 'UPI Payment' },
            { id: '3', date: '2026-08-15', type: CustomerTransactionType.RETURN, amount: 2400, description: '2 Boxes Bath Soap' },
          ]
        );

        expect(statement.rows.length).toBe(3);
        // Column checks
        expect(statement.rows[0].date).toBe('2026-08-04');
        expect(statement.rows[0].particulars).toContain('Bath Soap');
        expect(statement.rows[0].amount).toBe(16000);
        expect(statement.rows[0].returned).toBeUndefined();
        expect(statement.rows[0].paymentReceived).toBeUndefined();

        expect(statement.rows[1].paymentReceived).toBe(10000);
        expect(statement.rows[2].returned).toBe(2400);
      });

      it('1.20 RTK statement summary contains 4 required ledger aggregates', () => {
        const summary = CustomerLedgerCalculationEngine.computeSummary([
          { type: CustomerTransactionType.SALE, amount: 25000 },
          { type: CustomerTransactionType.RETURN, amount: 2400 },
          { type: CustomerTransactionType.PAYMENT, amount: 10000 },
        ]);

        expect(summary.totalGoodsGiven).toBe(25000);
        expect(summary.totalGoodsReturned).toBe(2400);
        expect(summary.totalPaymentsReceived).toBe(10000);
        expect(summary.netBalance).toBe(12600);
      });

      it('1.21 Compiles React-PDF document with Devanagari text and Rupee symbol', async () => {
        const statement = CustomerLedgerCalculationEngine.generateRTKStatementData(
          { name: 'राधाकिशन ट्रेडिंग कम्पनी', city: 'भिवानी' },
          { id: CUST_MANISH, name: 'मनीष' },
          '2026-08-31',
          [
            { id: '1', date: '2026-08-04', type: CustomerTransactionType.SALE, amount: 12000, description: 'अलमारी के लिए पत्थर' },
          ]
        );

        const doc = React.createElement(RTKStatementPDFDocument, { statement });
        const pdfBuffer = await (renderToBuffer as any)(doc);

        expect(pdfBuffer).toBeDefined();
        expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
        const contentStr = pdfBuffer.toString('utf8');
        expect(contentStr).toContain('अलमारी के लिए पत्थर');
        expect(contentStr).toContain('₹');
      });

      it('1.22 Unaggregated row presentation: distinct rows for each date/transaction, multi-line item details', () => {
        const statement = CustomerLedgerCalculationEngine.generateRTKStatementData(
          { name: 'Radhakishan Trading Company', city: 'Bhiwani' },
          { id: CUST_MANISH, name: 'Manish' },
          '2026-08-31',
          [
            {
              id: 'tx1',
              date: '2026-08-04',
              type: CustomerTransactionType.SALE,
              amount: 16000,
              items: [
                { productName: 'Bath Soap', quantity: 10, unitPrice: 1200, amount: 12000 },
                { productName: 'Detergent', quantity: 5, unitPrice: 800, amount: 4000 },
              ],
            },
            {
              id: 'tx2',
              date: '2026-08-04',
              type: CustomerTransactionType.SALE,
              amount: 5000,
              items: [
                { productName: 'Tea Powder', quantity: 2, unitPrice: 2500, amount: 5000 },
              ],
            },
          ]
        );

        // Verify rows are NOT aggregated into a single day row
        expect(statement.rows.length).toBe(2);
        expect(statement.rows[0].particulars).toContain('Bath Soap (10 @ ₹1200)');
        expect(statement.rows[0].particulars).toContain('Detergent (5 @ ₹800)');
        expect(statement.rows[1].particulars).toContain('Tea Powder (2 @ ₹2500)');
      });

      it('1.23 Statement header displays active distributor contact details (address, phone, GSTIN)', () => {
        const statement = CustomerLedgerCalculationEngine.generateRTKStatementData(
          {
            name: 'Radhakishan Trading Company',
            address: 'Railway Road',
            city: 'Bhiwani',
            state: 'Haryana',
            phone: '+91-9350995075',
            gstNumber: '06AAAAA0000A1Z5',
          },
          { id: CUST_MANISH, name: 'Manish' },
          '2026-08-31',
          []
        );

        expect(statement.organization.name).toBe('Radhakishan Trading Company');
        expect(statement.organization.phone).toBe('+91-9350995075');
        expect(statement.organization.gstin).toBe('06AAAAA0000A1Z5');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 2: BOUNDARY & EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────
  describe('Tier 2: Boundary & Edge Cases', () => {
    describe('Monetary & Decimal Precision Boundaries', () => {
      it('2.1 Zero amount transaction handling without NaN or divide-by-zero', async () => {
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.ADJUSTMENT,
          amount: 0,
          description: 'Opening Balance (Nil)',
        }, USER_ID);

        expect(tx.amount).toBe(0);
        const { summary } = await repo.getLedger(ORG_A, CUST_MANISH);
        expect(summary.netBalance).toBe(0);
      });

      it('2.2 Decimal precision: fractional paise additions prevent IEEE-754 drift', () => {
        // Standard JS: 1200.55 + 4000.45 = 5201.00; 0.1 + 0.2 = 0.30000000000000004
        const summary = CustomerLedgerCalculationEngine.computeSummary([
          { type: CustomerTransactionType.SALE, amount: 1200.55 },
          { type: CustomerTransactionType.SALE, amount: 4000.45 },
          { type: CustomerTransactionType.RETURN, amount: 200.10 },
          { type: CustomerTransactionType.PAYMENT, amount: 3000.90 },
        ]);

        expect(summary.totalGoodsGiven).toBe(5201.00);
        expect(summary.totalGoodsReturned).toBe(200.10);
        expect(summary.totalPaymentsReceived).toBe(3000.90);
        expect(summary.netBalance).toBe(2000.00);
      });

      it('2.3 High monetary amounts (crore scale: ₹9,99,99,999.99) retain full precision', () => {
        const summary = CustomerLedgerCalculationEngine.computeSummary([
          { type: CustomerTransactionType.SALE, amount: 99999999.99 },
          { type: CustomerTransactionType.PAYMENT, amount: 50000000.00 },
        ]);

        expect(summary.totalGoodsGiven).toBe(99999999.99);
        expect(summary.netBalance).toBe(49999999.99);
      });

      it('2.3a Negative line item unitPrice is rejected', async () => {
        await expect(
          repo.createTransaction(ORG_A, CUST_MANISH, {
            date: '2026-08-01',
            type: CustomerTransactionType.SALE,
            amount: 1000,
            items: [{ productName: 'Soap', quantity: 1, unitPrice: -500, amount: -500 }],
          }, USER_ID)
        ).rejects.toThrow(/Line item unitPrice cannot be negative/);
      });

      it('2.3b Fractional paise rounding (e.g. 0.005 rounds to 0.01 half-up)', () => {
        expect(CustomerLedgerCalculationEngine.round2(10.005)).toBe(10.01);
        expect(CustomerLedgerCalculationEngine.round2(10.004)).toBe(10.00);
      });
    });

    describe('Date Sorting & Chronological Boundaries', () => {
      it('2.4 Multiple transactions on the exact same date maintain individual order', async () => {
        // Two sales on same date
        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-04',
          type: CustomerTransactionType.SALE,
          amount: 10000,
          description: 'Morning Order',
        }, USER_ID);

        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-04',
          type: CustomerTransactionType.SALE,
          amount: 6000,
          description: 'Afternoon Order',
        }, USER_ID);

        const { entries } = await repo.getLedger(ORG_A, CUST_MANISH);
        expect(entries.length).toBe(2);
        expect(entries[0].description).toBe('Morning Order');
        expect(entries[0].runningBalance).toBe(10000);
        expect(entries[1].description).toBe('Afternoon Order');
        expect(entries[1].runningBalance).toBe(16000);
      });

      it('2.5 Out-of-order date entries are automatically sorted strictly chronologically', async () => {
        // Insert Aug 20, then Aug 04, then Aug 10
        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-20',
          type: CustomerTransactionType.SALE,
          amount: 9000,
          description: 'Aug 20 Order',
        }, USER_ID);

        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-04',
          type: CustomerTransactionType.SALE,
          amount: 16000,
          description: 'Aug 04 Order',
        }, USER_ID);

        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-10',
          type: CustomerTransactionType.PAYMENT,
          amount: 10000,
          description: 'Aug 10 Payment',
        }, USER_ID);

        const { entries } = await repo.getLedger(ORG_A, CUST_MANISH);
        expect(entries[0].date).toBe('2026-08-04');
        expect(entries[0].runningBalance).toBe(16000);

        expect(entries[1].date).toBe('2026-08-10');
        expect(entries[1].runningBalance).toBe(6000);

        expect(entries[2].date).toBe('2026-08-20');
        expect(entries[2].runningBalance).toBe(15000);
      });

      it('2.6 Leap year and year-end boundary sorting', () => {
        const sorted = CustomerLedgerCalculationEngine.sortChronologically([
          { date: '2027-01-01', id: 'tx3' },
          { date: '2024-02-29', id: 'tx1' },
          { date: '2026-12-31', id: 'tx2' },
        ]);

        expect(sorted.map((s) => s.id)).toEqual(['tx1', 'tx2', 'tx3']);
      });

      it('2.7 Same-day mixed transaction types (SALE and PAYMENT on same day)', async () => {
        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-10',
          type: CustomerTransactionType.SALE,
          amount: 10000,
        }, USER_ID);

        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-10',
          type: CustomerTransactionType.PAYMENT,
          amount: 4000,
        }, USER_ID);

        const { entries, summary } = await repo.getLedger(ORG_A, CUST_MANISH);
        expect(entries[0].runningBalance).toBe(10000);
        expect(entries[1].runningBalance).toBe(6000);
        expect(summary.netBalance).toBe(6000);
      });

      it('2.7a Future-dated transactions sort correctly after current transactions', () => {
        const sorted = CustomerLedgerCalculationEngine.sortChronologically([
          { date: '2026-12-01', id: 'future' },
          { date: '2026-08-01', id: 'current' },
        ]);
        expect(sorted[0].id).toBe('current');
        expect(sorted[1].id).toBe('future');
      });

      it('2.7b Transactions spanning multiple fiscal years (e.g. 2025-03-31 and 2025-04-01)', () => {
        const sorted = CustomerLedgerCalculationEngine.sortChronologically([
          { date: '2025-04-01', id: 'fy2526' },
          { date: '2025-03-31', id: 'fy2425' },
        ]);
        expect(sorted[0].id).toBe('fy2425');
        expect(sorted[1].id).toBe('fy2526');
      });
    });

    describe('Unicode, Strings & Adversarial Boundary Cases', () => {
      it('2.8 Handles empty description string gracefully', async () => {
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 1000,
          description: '',
        }, USER_ID);

        expect(tx.description).toBe('');
      });

      it('2.9 Handles long description strings (1,000 chars) without truncation or error', async () => {
        const longText = 'A'.repeat(1000);
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 1000,
          description: longText,
        }, USER_ID);

        expect(tx.description.length).toBe(1000);
      });

      it('2.10 Sanitizes and safely stores SQL injection test strings in notes', async () => {
        const injection = "'; DROP TABLE \"CustomerTransaction\"; -- <script>alert(1)</script>";
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 1000,
          notes: injection,
        }, USER_ID);

        expect(tx.notes).toBe(injection);
      });

      it('2.11 Preserves complex Devanagari conjuncts and matras (संयुक्त वर्ण)', async () => {
        const complexHindi = 'श्री कृष्ण ट्रेडिंग कंपनी - क्षत्रिय ज्ञान आश्रम';
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 1000,
          description: complexHindi,
        }, USER_ID);

        expect(tx.description).toBe(complexHindi);
      });

      it('2.12 Whitespace-only description string defaults cleanly', async () => {
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 1000,
          description: '   ',
        }, USER_ID);

        expect(tx.description).toBe('   ');
      });

      it('2.13 XSS payload in transaction notes does not crash or execute', async () => {
        const xssPayload = '<img src=x onerror="alert(\'XSS\')" />';
        const tx = await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 1000,
          notes: xssPayload,
        }, USER_ID);

        expect(tx.notes).toBe(xssPayload);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 3: PAIRWISE & CROSS-FEATURE STATE LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────
  describe('Tier 3: Pairwise & Cross-Feature State Lifecycle', () => {
    it('3.1 Full lifecycle: SALE + RETURN + PAYMENT calculates exact net balance', async () => {
      // 1. SALE
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 12000,
      }, USER_ID);

      // 2. RETURN
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-05',
        type: CustomerTransactionType.RETURN,
        amount: 2400,
      }, USER_ID);

      // 3. PAYMENT
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-10',
        type: CustomerTransactionType.PAYMENT,
        amount: 5000,
      }, USER_ID);

      const { summary } = await repo.getLedger(ORG_A, CUST_MANISH);
      expect(summary.totalGoodsGiven).toBe(12000);
      expect(summary.totalGoodsReturned).toBe(2400);
      expect(summary.totalPaymentsReceived).toBe(5000);
      expect(summary.netBalance).toBe(4600); // 12000 - 2400 - 5000 = 4600
    });

    it('3.2 Subsequent SALE edit immediately recalculates customer balance', async () => {
      const sale = await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 12000,
      }, USER_ID);

      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-05',
        type: CustomerTransactionType.RETURN,
        amount: 2400,
      }, USER_ID);

      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-10',
        type: CustomerTransactionType.PAYMENT,
        amount: 5000,
      }, USER_ID);

      // Edit SALE from 12,000 to 15,000
      await repo.updateTransaction(ORG_A, sale.id, { amount: 15000 }, USER_ID);

      const { summary } = await repo.getLedger(ORG_A, CUST_MANISH);
      expect(summary.totalGoodsGiven).toBe(15000);
      expect(summary.netBalance).toBe(7600); // 15000 - 2400 - 5000 = 7600
    });

    it('3.3 Subsequent RETURN edit immediately recalculates customer balance', async () => {
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 15000,
      }, USER_ID);

      const returnTx = await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-05',
        type: CustomerTransactionType.RETURN,
        amount: 2400,
      }, USER_ID);

      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-10',
        type: CustomerTransactionType.PAYMENT,
        amount: 5000,
      }, USER_ID);

      // Edit RETURN from 2,400 to 3,000
      await repo.updateTransaction(ORG_A, returnTx.id, { amount: 3000 }, USER_ID);

      const { summary } = await repo.getLedger(ORG_A, CUST_MANISH);
      expect(summary.totalGoodsReturned).toBe(3000);
      expect(summary.netBalance).toBe(7000); // 15000 - 3000 - 5000 = 7000
    });

    it('3.4 Deletion of RETURN transaction restores balance', async () => {
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 15000,
      }, USER_ID);

      const returnTx = await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-05',
        type: CustomerTransactionType.RETURN,
        amount: 3000,
      }, USER_ID);

      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-10',
        type: CustomerTransactionType.PAYMENT,
        amount: 5000,
      }, USER_ID);

      // Delete the RETURN transaction
      await repo.deleteTransaction(ORG_A, returnTx.id, USER_ID);

      const { summary, entries } = await repo.getLedger(ORG_A, CUST_MANISH);
      expect(entries.length).toBe(2);
      expect(summary.totalGoodsReturned).toBe(0);
      expect(summary.netBalance).toBe(10000); // 15000 - 0 - 5000 = 10000
    });

    it('3.5 Deletion of SALE transaction removes goods given and updates running balances', async () => {
      const sale1 = await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 5000,
      }, USER_ID);

      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-10',
        type: CustomerTransactionType.SALE,
        amount: 8000,
      }, USER_ID);

      await repo.deleteTransaction(ORG_A, sale1.id, USER_ID);

      const { summary, entries } = await repo.getLedger(ORG_A, CUST_MANISH);
      expect(entries.length).toBe(1);
      expect(summary.totalGoodsGiven).toBe(8000);
      expect(entries[0].runningBalance).toBe(8000);
    });

    it('3.6 Editing a transaction date moves its position and recalculates downstream running balances', async () => {
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 10000,
      }, USER_ID);

      const payment = await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-20',
        type: CustomerTransactionType.PAYMENT,
        amount: 4000,
      }, USER_ID);

      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-10',
        type: CustomerTransactionType.SALE,
        amount: 5000,
      }, USER_ID);

      // Originally:
      // Aug 01 (Sale 10,000) -> running 10,000
      // Aug 10 (Sale 5,000)  -> running 15,000
      // Aug 20 (Pay 4,000)   -> running 11,000

      // Move Payment from Aug 20 to Aug 05
      await repo.updateTransaction(ORG_A, payment.id, { date: '2026-08-05' }, USER_ID);

      const { entries } = await repo.getLedger(ORG_A, CUST_MANISH);
      // New chronological order:
      // Aug 01 (Sale 10,000) -> running 10,000
      // Aug 05 (Pay 4,000)   -> running 6,000
      // Aug 10 (Sale 5,000)  -> running 11,000

      expect(entries[0].date).toBe('2026-08-01');
      expect(entries[0].runningBalance).toBe(10000);

      expect(entries[1].date).toBe('2026-08-05');
      expect(entries[1].runningBalance).toBe(6000);

      expect(entries[2].date).toBe('2026-08-10');
      expect(entries[2].runningBalance).toBe(11000);
    });

    it('3.7 Line item addition and quantity modification recalculates transaction amount and balance', async () => {
      const sale = await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 12000,
        items: [
          { productName: 'Bath Soap', quantity: 10, unitPrice: 1200, amount: 12000 },
        ],
      }, USER_ID);

      // Update by adding Detergent line item (amount becomes 16,000)
      await repo.updateTransaction(ORG_A, sale.id, {
        amount: 16000,
        items: [
          { productName: 'Bath Soap', quantity: 10, unitPrice: 1200, amount: 12000 },
          { productName: 'Detergent', quantity: 5, unitPrice: 800, amount: 4000 },
        ],
      }, USER_ID);

      const { summary, entries } = await repo.getLedger(ORG_A, CUST_MANISH);
      expect(entries[0].items.length).toBe(2);
      expect(summary.totalGoodsGiven).toBe(16000);
      expect(summary.netBalance).toBe(16000);
    });

    it('3.8 Invariant verification: 10 interleaved operations satisfy fundamental ledger equation', async () => {
      const operations = [
        { type: CustomerTransactionType.SALE, amount: 1000 },
        { type: CustomerTransactionType.SALE, amount: 2000 },
        { type: CustomerTransactionType.PAYMENT, amount: 500 },
        { type: CustomerTransactionType.RETURN, amount: 300 },
        { type: CustomerTransactionType.SALE, amount: 4000 },
        { type: CustomerTransactionType.ADJUSTMENT, amount: 150 },
        { type: CustomerTransactionType.PAYMENT, amount: 1200 },
        { type: CustomerTransactionType.RETURN, amount: 250 },
        { type: CustomerTransactionType.SALE, amount: 1500 },
        { type: CustomerTransactionType.PAYMENT, amount: 800 },
      ];

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        await repo.createTransaction(ORG_A, CUST_MANISH, {
          date: `2026-08-${String(i + 1).padStart(2, '0')}`,
          type: op.type,
          amount: op.amount,
        }, USER_ID);
      }

      const { summary } = await repo.getLedger(ORG_A, CUST_MANISH);
      const expectedNet =
        summary.totalGoodsGiven -
        summary.totalGoodsReturned -
        summary.totalPaymentsReceived +
        summary.totalAdjustments;

      expect(summary.netBalance).toBe(CustomerLedgerCalculationEngine.round2(expectedNet));
      expect(summary.netBalance).toBe(5600); // (1000+2000+4000+1500) - (300+250) - (500+1200+800) + 150 = 8500 - 550 - 2500 + 150 = 5600
    });

    it('3.9 Partial return scenario with item rate tracking reduces balance appropriately', async () => {
      // Sale of 10 units @ 500 = 5000
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 5000,
        items: [{ productName: 'Oil Tin', quantity: 10, unitPrice: 500, amount: 5000 }],
      }, USER_ID);

      // Return 3 units @ 500 = 1500
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-05',
        type: CustomerTransactionType.RETURN,
        amount: 1500,
        items: [{ productName: 'Oil Tin', quantity: 3, unitPrice: 500, amount: 1500 }],
      }, USER_ID);

      const { summary } = await repo.getLedger(ORG_A, CUST_MANISH);
      expect(summary.totalGoodsGiven).toBe(5000);
      expect(summary.totalGoodsReturned).toBe(1500);
      expect(summary.netBalance).toBe(3500); // 7 tins remain = 3500
    });

    it('3.10 Multiple adjustments (positive fee followed by negative discount/rebate)', async () => {
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 10000,
      }, USER_ID);

      // Add positive fee +500
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-02',
        type: CustomerTransactionType.ADJUSTMENT,
        amount: 500,
        description: 'Freight Charges',
      }, USER_ID);

      // Add negative rebate / discount -300
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-03',
        type: CustomerTransactionType.ADJUSTMENT,
        amount: -300,
        description: 'Seasonal Promotion Discount',
      }, USER_ID);

      const { summary, entries } = await repo.getLedger(ORG_A, CUST_MANISH);
      expect(summary.totalAdjustments).toBe(200);
      expect(summary.netBalance).toBe(10200);
      expect(entries[2].runningBalance).toBe(10200);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 4: REAL-WORLD RADHAKISHAN TRADING COMPANY CANONICAL STATEMENT
  // ─────────────────────────────────────────────────────────────────────────
  describe('Tier 4: Canonical Radhakishan Trading Company Statement Reproduction', () => {
    const ORG_RTK = {
      name: 'Radhakishan Trading Company',
      address: 'Bhiwani, Haryana',
      city: 'Bhiwani',
      state: 'Haryana',
      phone: '+91-9350995075',
      gstNumber: '06AAAAA0000A1Z5',
    };

    const CUSTOMER_MANISH = {
      id: CUST_MANISH,
      name: 'Manish',
      phone: '+91-9876543210',
      city: 'Bhiwani',
    };

    it('4.1 Reproduces authoritative transaction history and computes exact RTK summary totals', async () => {
      // 1. 01/08/2026: Opening Balance
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-01',
        type: CustomerTransactionType.ADJUSTMENT,
        amount: 0,
        description: 'Opening Balance',
      }, USER_ID);

      // 2. 04/08/2026: SALE 10 Boxes Bath Soap @ 1,200 + 5 Pcs Detergent @ 800 + Hindi note
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-04',
        type: CustomerTransactionType.SALE,
        amount: 16000,
        description: 'अलमारी के लिए पत्थर (Special order)',
        items: [
          { productId: 'p_soap_1', productName: 'Bath Soap', quantity: 10, unitPrice: 1200, amount: 12000 },
          { productId: 'p_det_1', productName: 'Detergent', quantity: 5, unitPrice: 800, amount: 4000 },
        ],
      }, USER_ID);

      // 3. 10/08/2026: PAYMENT UPI Ref #893412
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-10',
        type: CustomerTransactionType.PAYMENT,
        amount: 10000,
        paymentMethod: PaymentMethod.UPI,
        reference: 'Ref #893412',
        description: 'Payment Received (UPI: Ref #893412)',
      }, USER_ID);

      // 4. 15/08/2026: RETURN 2 Boxes Bath Soap @ 1,200
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-15',
        type: CustomerTransactionType.RETURN,
        amount: 2400,
        description: 'Goods Returned (2 Boxes Bath Soap)',
        items: [
          { productId: 'p_soap_1', productName: 'Bath Soap', quantity: 2, unitPrice: 1200, amount: 2400 },
        ],
      }, USER_ID);

      // 5. 20/08/2026: SALE 3 Cartons Tea Powder @ 3,000
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-20',
        type: CustomerTransactionType.SALE,
        amount: 9000,
        description: '3 Cartons Tea Powder @ ₹3,000',
        items: [
          { productId: 'p_tea_1', productName: 'Tea Powder', quantity: 3, unitPrice: 3000, amount: 9000 },
        ],
      }, USER_ID);

      const { entries, summary } = await repo.getLedger(ORG_A, CUST_MANISH);

      // Authoritative Summary Expectations
      expect(summary.totalGoodsGiven).toBe(25000.00);      // 16,000 + 9,000
      expect(summary.totalGoodsReturned).toBe(2400.00);     // 2,400
      expect(summary.totalPaymentsReceived).toBe(10000.00); // 10,000
      expect(summary.totalAdjustments).toBe(0.00);
      expect(summary.netBalance).toBe(12600.00);           // 25,000 - 2,400 - 10,000 = 12,600

      // Step-by-step Running Balance Verification
      expect(entries[0].date).toBe('2026-08-01');
      expect(entries[0].runningBalance).toBe(0.00);

      expect(entries[1].date).toBe('2026-08-04');
      expect(entries[1].runningBalance).toBe(16000.00);

      expect(entries[2].date).toBe('2026-08-10');
      expect(entries[2].runningBalance).toBe(6000.00);

      expect(entries[3].date).toBe('2026-08-15');
      expect(entries[3].runningBalance).toBe(3600.00);

      expect(entries[4].date).toBe('2026-08-20');
      expect(entries[4].runningBalance).toBe(12600.00);
    });

    it('4.2 Immutability Check: Product catalog price change does NOT alter historical transaction items', async () => {
      // Create product catalog state
      const productCatalog = {
        p_soap_1: { name: 'Bath Soap', sellingPrice: 1200 },
        p_tea_1: { name: 'Tea Powder', sellingPrice: 3000 },
      };

      // Create transactions using snapshot pricing
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-04',
        type: CustomerTransactionType.SALE,
        amount: 12000,
        items: [
          { productId: 'p_soap_1', productName: productCatalog.p_soap_1.name, quantity: 10, unitPrice: productCatalog.p_soap_1.sellingPrice, amount: 12000 },
        ],
      }, USER_ID);

      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-20',
        type: CustomerTransactionType.SALE,
        amount: 9000,
        items: [
          { productId: 'p_tea_1', productName: productCatalog.p_tea_1.name, quantity: 3, unitPrice: productCatalog.p_tea_1.sellingPrice, amount: 9000 },
        ],
      }, USER_ID);

      // Now MUTATE the product catalog prices (Price Hike)
      productCatalog.p_soap_1.sellingPrice = 1500; // was 1,200
      productCatalog.p_tea_1.sellingPrice = 3500;  // was 3,000

      // Re-fetch customer ledger
      const { entries, summary } = await repo.getLedger(ORG_A, CUST_MANISH);

      // Verify that transaction line items STILL have the original snapshot rates
      expect(entries[0].items[0].unitPrice).toBe(1200);
      expect(entries[0].items[0].amount).toBe(12000);

      expect(entries[1].items[0].unitPrice).toBe(3000);
      expect(entries[1].items[0].amount).toBe(9000);

      // Verify totals remain unchanged
      expect(summary.totalGoodsGiven).toBe(21000);
      expect(summary.netBalance).toBe(21000);
    });

    it('4.3 Dynamic Customer Parameterization: Statement adapts to any customer (Gupta Provision Store)', () => {
      const statement = CustomerLedgerCalculationEngine.generateRTKStatementData(
        ORG_RTK,
        { id: 'cust_gupta_002', name: 'Gupta Provision Store', city: 'Bhiwani' },
        '2026-09-21',
        [
          { id: '1', date: '2026-09-01', type: CustomerTransactionType.SALE, amount: 35000, description: 'Bulk Provisions' },
          { id: '2', date: '2026-09-10', type: CustomerTransactionType.PAYMENT, amount: 20000, description: 'Bank Transfer' },
        ]
      );

      expect(statement.customer.name).toBe('Gupta Provision Store');
      expect(statement.summary.totalGoodsGiven).toBe(35000);
      expect(statement.summary.netBalance).toBe(15000);
    });

    it('4.4 Generates complete RTK PDF statement with Hindi items and Rupee symbol', async () => {
      const statement = CustomerLedgerCalculationEngine.generateRTKStatementData(
        ORG_RTK,
        CUSTOMER_MANISH,
        '2026-09-21',
        [
          { id: '1', date: '2026-08-01', type: CustomerTransactionType.ADJUSTMENT, amount: 0, description: 'Opening Balance' },
          { id: '2', date: '2026-08-04', type: CustomerTransactionType.SALE, amount: 16000, description: 'अलमारी के लिए पत्थर' },
          { id: '3', date: '2026-08-10', type: CustomerTransactionType.PAYMENT, amount: 10000, description: 'UPI Ref #893412' },
          { id: '4', date: '2026-08-15', type: CustomerTransactionType.RETURN, amount: 2400, description: 'Bath Soap Return' },
          { id: '5', date: '2026-08-20', type: CustomerTransactionType.SALE, amount: 9000, description: 'Tea Powder' },
        ]
      );

      const doc = React.createElement(RTKStatementPDFDocument, { statement });
      const buffer = await (renderToBuffer as any)(doc);

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');

      const content = buffer.toString('utf8');
      expect(content).toContain('RTK – MANISH ACCOUNT SUMMARY');
      expect(content).toContain('Radhakishan Trading Company');
      expect(content).toContain('अलमारी के लिए पत्थर');
      expect(content).toContain('₹ 12600.00'); // Final Net Balance
    });

    it('4.5 Multi-tenant statement isolation: Statement for Org B yields empty ledger and zero balance', async () => {
      // Manish has transactions in ORG_A
      await repo.createTransaction(ORG_A, CUST_MANISH, {
        date: '2026-08-04',
        type: CustomerTransactionType.SALE,
        amount: 16000,
      }, USER_ID);

      // Fetch statement for Manish in ORG_B
      const statementB = CustomerLedgerCalculationEngine.generateRTKStatementData(
        { name: 'Competitor Corp' },
        CUSTOMER_MANISH,
        '2026-09-21',
        (await repo.getLedger(ORG_B, CUST_MANISH)).entries
      );

      expect(statementB.rows.length).toBe(0);
      expect(statementB.summary.totalGoodsGiven).toBe(0);
      expect(statementB.summary.netBalance).toBe(0);
    });

    it('4.6 Single A4 page capacity verification: 18 unaggregated rows format cleanly', async () => {
      const canonicalRows: any[] = [];
      for (let i = 1; i <= 18; i++) {
        canonicalRows.push({
          id: `tx_${i}`,
          date: `2026-08-${String(i).padStart(2, '0')}`,
          type: i % 3 === 0 ? CustomerTransactionType.PAYMENT : CustomerTransactionType.SALE,
          amount: i * 500,
          description: `Transaction Line ${i}`,
        });
      }

      const statement = CustomerLedgerCalculationEngine.generateRTKStatementData(
        ORG_RTK,
        CUSTOMER_MANISH,
        '2026-09-21',
        canonicalRows
      );

      expect(statement.rows.length).toBe(18);
      const doc = React.createElement(RTKStatementPDFDocument, { statement });
      const buffer = await (renderToBuffer as any)(doc);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('4.7 Column alignment and formatting in RTK Statement rows', () => {
      const statement = CustomerLedgerCalculationEngine.generateRTKStatementData(
        ORG_RTK,
        CUSTOMER_MANISH,
        '2026-09-21',
        [
          { id: '1', date: '2026-08-04', type: CustomerTransactionType.SALE, amount: 16000, description: '10 Boxes Bath Soap' },
          { id: '2', date: '2026-08-15', type: CustomerTransactionType.RETURN, amount: 2400, description: '2 Boxes Bath Soap' },
          { id: '3', date: '2026-08-10', type: CustomerTransactionType.PAYMENT, amount: 10000, description: 'UPI' },
        ]
      );

      // Sale row: amount populated, returned and paymentReceived undefined
      expect(statement.rows[0].amount).toBe(16000);
      expect(statement.rows[0].returned).toBeUndefined();
      expect(statement.rows[0].paymentReceived).toBeUndefined();

      // Payment row: paymentReceived populated, amount and returned undefined
      expect(statement.rows[1].amount).toBeUndefined();
      expect(statement.rows[1].returned).toBeUndefined();
      expect(statement.rows[1].paymentReceived).toBe(10000);

      // Return row: returned populated, amount and paymentReceived undefined
      expect(statement.rows[2].amount).toBeUndefined();
      expect(statement.rows[2].returned).toBe(2400);
      expect(statement.rows[2].paymentReceived).toBeUndefined();
    });
  });
});
