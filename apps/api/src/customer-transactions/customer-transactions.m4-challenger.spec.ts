/**
 * customer-transactions.m4-challenger.spec.ts
 *
 * EMPIRICAL ADVERSARIAL CHALLENGE SUITE — MILESTONE M4
 * Challenger 2 (challenger_m4_2): API Streaming & Multi-Tenant Verifier
 *
 * Empirical verification of:
 * 1. HTTP Response Headers for GET /api/v1/customers/:id/statement/pdf
 * 2. PDF Buffer Magic Bytes (%PDF) & Structural Integrity
 * 3. BOLA / Multi-Tenant Isolation & Fail-Closed Security
 * 4. Dynamic Date Filtering (startDate, endDate) & Opening Balance Computation
 * 5. Edge-Case Matrix: Zero Transactions, Negative Balance, Same-Date Entries
 */

import { NotFoundException } from '@nestjs/common';
import { CustomerTransactionsController } from './customer-transactions.controller';
import { CustomerTransactionsService } from './customer-transactions.service';
import {
  CustomerTransactionType,
  PaymentMethod,
  calculateCustomerLedger,
} from './customer-transactions.calculation';
import { RTKStatementPDFDocument, RTKStatementData } from './rtk-statement.document';
import { RtkStatementPdfService } from './rtk-statement-pdf.service';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';

describe('Challenger M4_2: API Streaming & Multi-Tenant Empirical Verification', () => {
  const orgAlpha = 'org-alpha-uuid';
  const orgBeta = 'org-beta-uuid';

  const userAlpha = {
    sub: 'usr-alpha-1',
    orgId: orgAlpha,
    role: 'distributor',
    email: 'alpha@distroai.com',
  };

  const userBeta = {
    sub: 'usr-beta-1',
    orgId: orgBeta,
    role: 'distributor',
    email: 'beta@distroai.com',
  };

  const custAlpha1 = 'cust-alpha-001';
  const custAlpha2 = 'cust-alpha-002';
  const custBeta1 = 'cust-beta-001';

  let mockCustomers: any[] = [];
  let mockOrganizations: any[] = [];
  let mockTransactions: any[] = [];
  let mockAuditLogs: any[] = [];

  let service: CustomerTransactionsService;
  let controller: CustomerTransactionsController;

  const createMockPrisma = () => ({
    customer: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          mockCustomers.find(
            (c) =>
              c.id === where.id &&
              (!where.orgId || c.orgId === where.orgId),
          ) || null
        );
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const cust = mockCustomers.find((c) => c.id === where.id);
        if (cust) {
          Object.assign(cust, data);
          return cust;
        }
        return null;
      }),
    },
    organization: {
      findUnique: jest.fn(async ({ where }: any) => {
        return mockOrganizations.find((o) => o.id === where.id) || null;
      }),
    },
    customerTransaction: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          mockTransactions.find(
            (t) =>
              t.id === where.id &&
              (!where.customerId || t.customerId === where.customerId) &&
              (!where.orgId || t.orgId === where.orgId),
          ) || null
        );
      }),
      findMany: jest.fn(async ({ where, orderBy }: any) => {
        let results = mockTransactions.filter(
          (t) =>
            (!where.orgId || t.orgId === where.orgId) &&
            (!where.customerId || t.customerId === where.customerId),
        );
        if (where.type) {
          results = results.filter((t) => t.type === where.type);
        }
        if (where.date?.lt) {
          results = results.filter(
            (t) => new Date(t.date).getTime() < new Date(where.date.lt).getTime(),
          );
        }
        if (where.date?.gte) {
          results = results.filter(
            (t) => new Date(t.date).getTime() >= new Date(where.date.gte).getTime(),
          );
        }
        if (where.date?.lte) {
          results = results.filter(
            (t) => new Date(t.date).getTime() <= new Date(where.date.lte).getTime(),
          );
        }

        // Apply chronological sort (date ASC, createdAt ASC, id ASC)
        results.sort((a, b) => {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          const createdDiff =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          if (createdDiff !== 0) return createdDiff;
          return (a.id || '').localeCompare(b.id || '');
        });
        return results;
      }),
      create: jest.fn(async ({ data }: any) => {
        const record = {
          id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          orgId: data.orgId,
          customerId: data.customerId,
          date: data.date,
          type: data.type,
          description: data.description || null,
          amount: data.amount,
          paymentMethod: data.paymentMethod || null,
          reference: data.reference || null,
          notes: data.notes || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: data.items?.create || [],
        };
        mockTransactions.push(record);
        return record;
      }),
    },
    $transaction: jest.fn(async (cb: any) => {
      const txMock = {
        $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
        customerTransaction: {
          create: jest.fn(async ({ data }: any) => {
            const record = {
              id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              orgId: data.orgId,
              customerId: data.customerId,
              date: data.date,
              type: data.type,
              description: data.description || null,
              amount: data.amount,
              paymentMethod: data.paymentMethod || null,
              reference: data.reference || null,
              notes: data.notes || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              items: data.items?.create || [],
            };
            mockTransactions.push(record);
            return record;
          }),
          findMany: jest.fn(async ({ where }: any) => {
            return mockTransactions.filter(
              (t) => t.orgId === where.orgId && t.customerId === where.customerId,
            );
          }),
        },
        customer: {
          update: jest.fn(async ({ where, data }: any) => {
            const cust = mockCustomers.find((c) => c.id === where.id);
            if (cust) Object.assign(cust, data);
            return cust;
          }),
        },
      };
      return cb(txMock);
    }),
  });

  const mockAuditLogService = {
    log: jest.fn(async (entry: any) => {
      mockAuditLogs.push(entry);
    }),
  };

  beforeEach(() => {
    mockOrganizations = [
      {
        id: orgAlpha,
        name: 'Radhakishan Trading Company',
        address: 'Main Mandi, Shop #45',
        city: 'Rohtak',
        state: 'Haryana',
        phone: '+91 98765 43210',
        gstNumber: '06AAAAA0000A1Z5',
      },
      {
        id: orgBeta,
        name: 'Beta Agro Distributors',
        address: 'Kisan Chowk',
        city: 'Hisar',
        state: 'Haryana',
        phone: '+91 91234 56789',
        gstNumber: '06BBBBB1111B1Z2',
      },
    ];

    mockCustomers = [
      {
        id: custAlpha1,
        orgId: orgAlpha,
        name: 'Manish Kumar',
        phone: '+91 99999 11111',
        city: 'Rohtak',
        fullAddress: 'Shop #12, Cloth Market, Rohtak',
        outstandingAmount: 0,
      },
      {
        id: custAlpha2,
        orgId: orgAlpha,
        name: 'राजेश कुमार (Rajesh Hindi)',
        phone: '+91 98888 22222',
        city: 'Rohtak',
        fullAddress: 'स्टेशन रोड, रोहतक',
        outstandingAmount: 0,
      },
      {
        id: custBeta1,
        orgId: orgBeta,
        name: 'Beta Customer One',
        phone: '+91 97777 33333',
        city: 'Hisar',
        fullAddress: 'Hisar Mandi',
        outstandingAmount: 0,
      },
    ];

    mockTransactions = [];
    mockAuditLogs = [];

    const prisma = createMockPrisma();
    service = new CustomerTransactionsService(prisma as any, mockAuditLogService as any);
    controller = new CustomerTransactionsController(service);
  });

  // =========================================================================
  // 1. API STREAMING & RESPONSE HEADERS SPECIFICATION
  // =========================================================================
  describe('1. API Streaming & Response Headers (GET /api/v1/customers/:id/statement/pdf)', () => {
    it('1.1 sets exact Content-Type, Content-Disposition, and Content-Length response headers', async () => {
      // Seed some transactions for custAlpha1
      mockTransactions.push({
        id: 'tx-1',
        orgId: orgAlpha,
        customerId: custAlpha1,
        date: new Date('2026-08-01'),
        type: CustomerTransactionType.SALE,
        description: 'First delivery',
        amount: 15000,
        createdAt: new Date('2026-08-01T10:00:00Z'),
        items: [],
      });

      const resMock: any = {
        set: jest.fn(),
        end: jest.fn(),
      };

      await controller.downloadStatementPdf(userAlpha, custAlpha1, {}, resMock);

      // Verify res.set was called with all 3 mandatory headers
      expect(resMock.set).toHaveBeenCalledTimes(1);
      const headers = resMock.set.mock.calls[0][0];

      expect(headers['Content-Type']).toBe('application/pdf');
      expect(headers['Content-Disposition']).toBe(
        `inline; filename="statement-${custAlpha1}.pdf"`,
      );
      expect(headers['Content-Length']).toBeDefined();
      expect(typeof headers['Content-Length']).toBe('string');

      // Verify Content-Length matches the exact byte count passed to res.end()
      expect(resMock.end).toHaveBeenCalledTimes(1);
      const bufferSent = resMock.end.mock.calls[0][0];
      expect(Buffer.isBuffer(bufferSent)).toBe(true);
      expect(headers['Content-Length']).toBe(bufferSent.length.toString());
    });

    it('1.2 streams buffer beginning with %PDF magic bytes and valid PDF trailer', async () => {
      mockTransactions.push({
        id: 'tx-2',
        orgId: orgAlpha,
        customerId: custAlpha1,
        date: new Date('2026-08-05'),
        type: CustomerTransactionType.SALE,
        description: 'Soap Bags',
        amount: 5000,
        createdAt: new Date('2026-08-05T10:00:00Z'),
        items: [],
      });

      const resMock: any = { set: jest.fn(), end: jest.fn() };
      await controller.downloadStatementPdf(userAlpha, custAlpha1, {}, resMock);

      const bufferSent: Buffer = resMock.end.mock.calls[0][0];
      expect(Buffer.isBuffer(bufferSent)).toBe(true);
      expect(bufferSent.length).toBeGreaterThan(0);

      // Magic bytes verification
      const magicBytes = bufferSent.subarray(0, 4).toString('utf8');
      expect(magicBytes).toBe('%PDF');

      // Binary trailer check: should terminate or contain %%EOF
      const tail = bufferSent.toString('utf8');
      expect(tail).toMatch(/%%EOF/);
    });

    it('1.3 dynamically embeds customer-specific filename in Content-Disposition', async () => {
      const resMock: any = { set: jest.fn(), end: jest.fn() };
      await controller.downloadStatementPdf(userAlpha, custAlpha2, {}, resMock);

      const headers = resMock.set.mock.calls[0][0];
      expect(headers['Content-Disposition']).toBe(
        `inline; filename="statement-${custAlpha2}.pdf"`,
      );
    });
  });

  // =========================================================================
  // 2. MULTI-TENANT BOLA ISOLATION & FAIL-CLOSED DEFENSE
  // =========================================================================
  describe('2. Multi-Tenant BOLA Isolation & Fail-Closed Defense', () => {
    it('2.1 requesting customer belonging to another organization throws NotFoundException (HTTP 404)', async () => {
      const resMock: any = { set: jest.fn(), end: jest.fn() };

      // User Alpha tries to access CustBeta1
      await expect(
        controller.downloadStatementPdf(userAlpha, custBeta1, {}, resMock),
      ).rejects.toThrow(NotFoundException);

      // FAIL-CLOSED: No headers set, no buffer streamed
      expect(resMock.set).not.toHaveBeenCalled();
      expect(resMock.end).not.toHaveBeenCalled();
    });

    it('2.2 requesting non-existent customer in same organization throws NotFoundException (HTTP 404)', async () => {
      const resMock: any = { set: jest.fn(), end: jest.fn() };
      const nonExistentCustId = '00000000-0000-0000-0000-000000000000';

      await expect(
        controller.downloadStatementPdf(userAlpha, nonExistentCustId, {}, resMock),
      ).rejects.toThrow(NotFoundException);

      expect(resMock.set).not.toHaveBeenCalled();
      expect(resMock.end).not.toHaveBeenCalled();
    });

    it('2.3 orgId is strictly derived from server-side JWT auth token, ignoring any query params or body', async () => {
      // Attacker attempts to spoof orgId via query parameters
      const spoofedQuery: any = {
        orgId: orgBeta, // Attempted tenant override
        startDate: '2026-08-01',
      };

      const resMock: any = { set: jest.fn(), end: jest.fn() };

      // Still accessing CustBeta1 with spoofed query
      await expect(
        controller.downloadStatementPdf(userAlpha, custBeta1, spoofedQuery, resMock),
      ).rejects.toThrow(NotFoundException);

      // Successfully accessing own customer even if query has bogus orgId
      await expect(
        controller.downloadStatementPdf(userAlpha, custAlpha1, spoofedQuery, resMock),
      ).resolves.not.toThrow();

      expect(resMock.end).toHaveBeenCalled();
    });

    it('2.4 fails closed if organization does not exist in database', async () => {
      const orphanedUser = {
        sub: 'usr-orphan',
        orgId: 'org-ghost-999',
        role: 'distributor',
        email: 'ghost@nowhere.com',
      };
      const resMock: any = { set: jest.fn(), end: jest.fn() };

      await expect(
        controller.downloadStatementPdf(orphanedUser, custAlpha1, {}, resMock),
      ).rejects.toThrow(NotFoundException);

      expect(resMock.set).not.toHaveBeenCalled();
      expect(resMock.end).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. DATE FILTERING (startDate, endDate) & OPENING BALANCE CALCULATIONS
  // =========================================================================
  describe('3. Date Range Filtering & Opening Balance Calculations', () => {
    beforeEach(() => {
      // Seed a sequence of transactions across August and September 2026
      mockTransactions = [
        {
          id: 'tx-jul-sale',
          orgId: orgAlpha,
          customerId: custAlpha1,
          date: new Date('2026-07-25'),
          type: CustomerTransactionType.SALE,
          description: 'July Baseline Sale',
          amount: 10000,
          createdAt: new Date('2026-07-25T10:00:00Z'),
          items: [],
        },
        {
          id: 'tx-jul-pay',
          orgId: orgAlpha,
          customerId: custAlpha1,
          date: new Date('2026-07-30'),
          type: CustomerTransactionType.PAYMENT,
          description: 'July Baseline Payment',
          amount: 4000,
          paymentMethod: PaymentMethod.UPI,
          createdAt: new Date('2026-07-30T10:00:00Z'),
          items: [],
        },
        // Net prior to 2026-08-01 = 10000 - 4000 = 6000
        {
          id: 'tx-aug-sale',
          orgId: orgAlpha,
          customerId: custAlpha1,
          date: new Date('2026-08-10'),
          type: CustomerTransactionType.SALE,
          description: 'August Mid Sale',
          amount: 5000,
          createdAt: new Date('2026-08-10T10:00:00Z'),
          items: [],
        },
        {
          id: 'tx-aug-return',
          orgId: orgAlpha,
          customerId: custAlpha1,
          date: new Date('2026-08-15'),
          type: CustomerTransactionType.RETURN,
          description: 'August Mid Return',
          amount: 1000,
          createdAt: new Date('2026-08-15T10:00:00Z'),
          items: [],
        },
        {
          id: 'tx-aug-pay',
          orgId: orgAlpha,
          customerId: custAlpha1,
          date: new Date('2026-08-20'),
          type: CustomerTransactionType.PAYMENT,
          description: 'August Mid Payment',
          amount: 2000,
          createdAt: new Date('2026-08-20T10:00:00Z'),
          items: [],
        },
        // End of August period net: 6000 + 5000 - 1000 - 2000 = 8000
        {
          id: 'tx-sep-sale',
          orgId: orgAlpha,
          customerId: custAlpha1,
          date: new Date('2026-09-05'),
          type: CustomerTransactionType.SALE,
          description: 'September Later Sale',
          amount: 7000,
          createdAt: new Date('2026-09-05T10:00:00Z'),
          items: [],
        },
      ];
    });

    it('3.1 Full statement (no date filter) includes all 6 rows and correct grand totals', async () => {
      const statement = await service.getStatementData(orgAlpha, custAlpha1, {});

      // All 6 transactions included without opening balance row (initialBalance is 0)
      expect(statement.rows.length).toBe(6);
      expect(statement.summary.totalGoodsGiven).toBe(22000); // 10000 + 5000 + 7000
      expect(statement.summary.totalGoodsReturned).toBe(1000); // 1000
      expect(statement.summary.totalPaymentsReceived).toBe(6000); // 4000 + 2000
      expect(statement.summary.netBalance).toBe(15000); // 22000 - 1000 - 6000
    });

    it('3.2 startDate filter prepends synthetic Opening Balance row and excludes prior rows', async () => {
      const statement = await service.getStatementData(orgAlpha, custAlpha1, {
        startDate: '2026-08-01',
      });

      // July transactions (10000 sale, 4000 pay) become opening balance of 6000
      // Period transactions: Aug sale, Aug return, Aug pay, Sep sale (4 transactions)
      // + 1 Opening Balance row = 5 rows total
      expect(statement.rows.length).toBe(5);

      const obRow = statement.rows[0];
      expect(obRow.date).toBe('2026-08-01');
      expect(obRow.particulars).toContain('Opening Balance');
      expect(obRow.runningBalance).toBe(6000);

      // Remaining rows are the August & September ones
      expect(statement.rows.map((r) => r.particulars)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Opening Balance'),
          'August Mid Sale',
          'August Mid Return',
          'August Mid Payment',
          'September Later Sale',
        ]),
      );

      // Overall net balance reflects period + opening balance
      expect(statement.summary.openingBalance).toBe(6000);
      expect(statement.summary.netBalance).toBe(15000);
    });

    it('3.3 startDate AND endDate filter isolates the active window and recalculates closing balance', async () => {
      const statement = await service.getStatementData(orgAlpha, custAlpha1, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      // Prior to Aug 1: Opening balance = 6000
      // In Aug 1 - Aug 31:
      //  - Aug 10: Sale 5000
      //  - Aug 15: Return 1000
      //  - Aug 20: Payment 2000
      // Sep 5 sale is excluded!
      // Total rows = 1 OB row + 3 period rows = 4 rows
      expect(statement.rows.length).toBe(4);

      // Period totals
      expect(statement.summary.totalGoodsGiven).toBe(5000);
      expect(statement.summary.totalGoodsReturned).toBe(1000);
      expect(statement.summary.totalPaymentsReceived).toBe(2000);
      expect(statement.summary.openingBalance).toBe(6000);
      // Net closing balance = 6000 + 5000 - 1000 - 2000 = 8000
      expect(statement.summary.netBalance).toBe(8000);
      expect(statement.summary.closingBalance).toBe(8000);
    });

    it('3.4 date range with ZERO transactions in period returns opening balance row without crashing', async () => {
      const statement = await service.getStatementData(orgAlpha, custAlpha1, {
        startDate: '2026-08-01',
        endDate: '2026-08-05', // No transactions between Aug 1 and Aug 5
      });

      // Opening balance prior to Aug 1 is 6000
      expect(statement.rows.length).toBe(1);
      expect(statement.rows[0].particulars).toContain('Opening Balance');
      expect(statement.rows[0].runningBalance).toBe(6000);

      expect(statement.summary.totalGoodsGiven).toBe(0);
      expect(statement.summary.totalGoodsReturned).toBe(0);
      expect(statement.summary.totalPaymentsReceived).toBe(0);
      expect(statement.summary.openingBalance).toBe(6000);
      expect(statement.summary.netBalance).toBe(6000);

      // Ensure PDF generation succeeds on empty period
      const resMock: any = { set: jest.fn(), end: jest.fn() };
      await expect(
        controller.downloadStatementPdf(
          userAlpha,
          custAlpha1,
          { startDate: '2026-08-01', endDate: '2026-08-05' },
          resMock,
        ),
      ).resolves.not.toThrow();
      expect(resMock.end).toHaveBeenCalled();
    });

    it('3.5 date range where customer has NO transactions ever generates clean empty statement', async () => {
      // custAlpha2 has 0 transactions
      const statement = await service.getStatementData(orgAlpha, custAlpha2, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(statement.rows.length).toBe(0);
      expect(statement.summary.totalGoodsGiven).toBe(0);
      expect(statement.summary.totalGoodsReturned).toBe(0);
      expect(statement.summary.totalPaymentsReceived).toBe(0);
      expect(statement.summary.netBalance).toBe(0);

      const resMock: any = { set: jest.fn(), end: jest.fn() };
      await expect(
        controller.downloadStatementPdf(
          userAlpha,
          custAlpha2,
          { startDate: '2026-08-01', endDate: '2026-08-31' },
          resMock,
        ),
      ).resolves.not.toThrow();
      expect(resMock.end).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. EDGE-CASE MATRIX & UNAGGREGATED SAME-DATE PRESENTATION
  // =========================================================================
  describe('4. Edge-Case Matrix: Unaggregated Same-Date Entries & Devanagari Strings', () => {
    it('4.1 multiple transactions on the same date preserve distinct unaggregated rows', async () => {
      mockTransactions = [
        {
          id: 'tx-same-1',
          orgId: orgAlpha,
          customerId: custAlpha1,
          date: new Date('2026-08-10'),
          type: CustomerTransactionType.SALE,
          description: 'Morning Delivery - Cement',
          amount: 3000,
          createdAt: new Date('2026-08-10T09:00:00Z'),
          items: [],
        },
        {
          id: 'tx-same-2',
          orgId: orgAlpha,
          customerId: custAlpha1,
          date: new Date('2026-08-10'),
          type: CustomerTransactionType.SALE,
          description: 'Noon Delivery - Sand',
          amount: 4500,
          createdAt: new Date('2026-08-10T12:00:00Z'),
          items: [],
        },
        {
          id: 'tx-same-3',
          orgId: orgAlpha,
          customerId: custAlpha1,
          date: new Date('2026-08-10'),
          type: CustomerTransactionType.PAYMENT,
          description: 'Evening Cash Payment',
          amount: 2000,
          createdAt: new Date('2026-08-10T17:00:00Z'),
          items: [],
        },
      ];

      const statement = await service.getStatementData(orgAlpha, custAlpha1, {});

      // All 3 transactions on 2026-08-10 must remain distinct
      expect(statement.rows.length).toBe(3);
      expect(statement.rows[0].particulars).toBe('Morning Delivery - Cement');
      expect(statement.rows[0].runningBalance).toBe(3000);

      expect(statement.rows[1].particulars).toBe('Noon Delivery - Sand');
      expect(statement.rows[1].runningBalance).toBe(7500);

      expect(statement.rows[2].particulars).toBe('Evening Cash Payment');
      expect(statement.rows[2].runningBalance).toBe(5500);

      expect(statement.summary.netBalance).toBe(5500);
    });

    it('4.2 negative running balance (distributor owes customer or excess returns) computes correctly', async () => {
      mockTransactions = [
        {
          id: 'tx-overpay',
          orgId: orgAlpha,
          customerId: custAlpha1,
          date: new Date('2026-08-01'),
          type: CustomerTransactionType.PAYMENT,
          description: 'Advance Payment',
          amount: 10000,
          createdAt: new Date('2026-08-01T10:00:00Z'),
          items: [],
        },
      ];

      const statement = await service.getStatementData(orgAlpha, custAlpha1, {});
      expect(statement.summary.netBalance).toBe(-10000);
      expect(statement.rows[0].runningBalance).toBe(-10000);

      const resMock: any = { set: jest.fn(), end: jest.fn() };
      await expect(
        controller.downloadStatementPdf(userAlpha, custAlpha1, {}, resMock),
      ).resolves.not.toThrow();
    });

    it('4.3 Devanagari Hindi customer name and item descriptions render without throwing', async () => {
      mockTransactions = [
        {
          id: 'tx-hindi-1',
          orgId: orgAlpha,
          customerId: custAlpha2, // Rajesh Hindi
          date: new Date('2026-08-01'),
          type: CustomerTransactionType.SALE,
          description: 'अलमारी के लिए पत्थर',
          amount: 16000,
          createdAt: new Date('2026-08-01T10:00:00Z'),
          items: [
            {
              id: 'it-1',
              productName: 'अलमारी का पत्थर (५ नग)',
              quantity: 5,
              unitPrice: 3200,
              amount: 16000,
            },
          ],
        },
      ];

      const statement = await service.getStatementData(orgAlpha, custAlpha2, {});
      expect(statement.customer.name).toBe('राजेश कुमार (Rajesh Hindi)');
      expect(statement.rows[0].particulars).toContain('अलमारी के लिए पत्थर');

      const resMock: any = { set: jest.fn(), end: jest.fn() };
      await expect(
        controller.downloadStatementPdf(userAlpha, custAlpha2, {}, resMock),
      ).resolves.not.toThrow();

      const bufferSent: Buffer = resMock.end.mock.calls[0][0];
      const text = bufferSent.toString('utf8');
      expect(text).toContain('RTK –');
      expect(text).toContain('अलमारी');
    });
  });
});
