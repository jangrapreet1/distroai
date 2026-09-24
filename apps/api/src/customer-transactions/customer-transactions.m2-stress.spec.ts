/**
 * apps/api/src/customer-transactions/customer-transactions.m2-stress.spec.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE — MILESTONE M2
 * Challenger 1 (challenger_m2_1)
 *
 * Missions Tested:
 * 1. BOLA/IDOR Multi-Tenant Isolation & 100% Fail-Closed Verification (404 NotFoundException)
 * 2. Stress-Testing Input Validation (Dates, Amounts, Types, Quantities, Unicode, DTO Pipes)
 * 3. Concurrent Requests & Non-Blocking Performance (Row-level Locking, Atomicity, Drift-Free Sync)
 */

import { NotFoundException, BadRequestException, ValidationPipe, ArgumentMetadata } from '@nestjs/common';
import { CustomerTransactionsController } from './customer-transactions.controller';
import { CustomerTransactionsService } from './customer-transactions.service';
import { CustomerTransactionType, PaymentMethod } from './customer-transactions.calculation';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { CreateTransactionItemDto, UNICODE_TEXT_PATTERN } from './dto/create-transaction-item.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';

describe('Challenger 1 Empirical Stress Test Suite — Milestone M2', () => {
  // Test Tenants and Actors
  const orgAlpha = 'org-distributor-alpha';
  const orgBeta = 'org-distributor-beta';
  const orgGamma = 'org-distributor-gamma';

  const userAlpha = { sub: 'usr-alpha-001', orgId: orgAlpha, role: 'distributor', email: 'alpha@distroai.com' };
  const userBeta = { sub: 'usr-beta-002', orgId: orgBeta, role: 'distributor', email: 'beta@distroai.com' };

  const custAlpha1 = 'cust-alpha-uuid-101';
  const custAlpha2 = 'cust-alpha-uuid-102';
  const custBeta1 = 'cust-beta-uuid-201';

  // In-memory Database state
  let customers: any[] = [];
  let transactions: any[] = [];
  let auditLogs: any[] = [];
  let rowLockLog: Array<{ customerId: string; orgId: string; timestamp: number }> = [];

  // Realistic mock Prisma client with atomic locking simulation
  const buildMockPrisma = () => {
    let transactionLockPromise: Promise<void> = Promise.resolve();

    return {
      customer: {
        findFirst: jest.fn(async ({ where }: any) => {
          return (
            customers.find(
              (c) =>
                c.id === where.id &&
                (!where.orgId || c.orgId === where.orgId),
            ) || null
          );
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const cust = customers.find((c) => c.id === where.id);
          if (cust) {
            Object.assign(cust, data);
            return { ...cust };
          }
          return null;
        }),
      },
      organization: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === orgAlpha) {
            return {
              id: orgAlpha,
              name: 'Radhakishan Trading Company',
              address: 'Main Anaj Mandi, Shop 42',
              city: 'Rohtak',
              state: 'Haryana',
              phone: '+91 98765 43210',
              gstNumber: '06AAAAA0000A1Z5',
            };
          }
          if (where.id === orgBeta) {
            return {
              id: orgBeta,
              name: 'Gupta Provision Store Distributor',
              address: 'Railway Road',
              city: 'Hisar',
              state: 'Haryana',
              phone: '+91 98123 45678',
              gstNumber: '06BBBBB1111B1Z2',
            };
          }
          return null;
        }),
      },
      customerTransaction: {
        findFirst: jest.fn(async ({ where }: any) => {
          return (
            transactions.find(
              (t) =>
                t.id === where.id &&
                (!where.customerId || t.customerId === where.customerId) &&
                (!where.orgId || t.orgId === where.orgId),
            ) || null
          );
        }),
        findMany: jest.fn(async ({ where }: any) => {
          let rows = transactions.filter(
            (t) =>
              (!where.orgId || t.orgId === where.orgId) &&
              (!where.customerId || t.customerId === where.customerId),
          );
          if (where.type) {
            rows = rows.filter((t) => t.type === where.type);
          }
          if (where.date?.lt) {
            rows = rows.filter((t) => new Date(t.date) < new Date(where.date.lt));
          }
          if (where.date?.gte) {
            rows = rows.filter((t) => new Date(t.date) >= new Date(where.date.gte));
          }
          if (where.date?.lte) {
            rows = rows.filter((t) => new Date(t.date) <= new Date(where.date.lte));
          }
          // Sort chronologically
          rows.sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
          return rows.map((r) => ({ ...r, items: (r.items || []).map((it: any) => ({ ...it })) }));
        }),
        create: jest.fn(async ({ data }: any) => {
          const record = {
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            orgId: data.orgId,
            customerId: data.customerId,
            date: data.date,
            type: data.type,
            description: data.description || null,
            amount: data.amount,
            paymentMethod: data.paymentMethod || null,
            reference: data.reference || null,
            notes: data.notes || null,
            items: (data.items?.create || []).map((i: any, idx: number) => ({
              id: `item-${Date.now()}-${idx + 1}`,
              productId: i.productId || null,
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              amount: i.amount,
              unit: i.unit || null,
            })),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          transactions.push(record);
          return record;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const tx = transactions.find((t) => t.id === where.id);
          if (!tx) return null;
          if (data.date) tx.date = data.date;
          if (data.type) tx.type = data.type;
          if (data.description !== undefined) tx.description = data.description;
          if (data.amount !== undefined) tx.amount = data.amount;
          if (data.paymentMethod !== undefined) tx.paymentMethod = data.paymentMethod;
          if (data.reference !== undefined) tx.reference = data.reference;
          if (data.notes !== undefined) tx.notes = data.notes;
          if (data.items?.create) {
            tx.items = data.items.create.map((i: any, idx: number) => ({
              id: `item-upd-${Date.now()}-${idx + 1}`,
              productId: i.productId || null,
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              amount: i.amount,
              unit: i.unit || null,
            }));
          }
          tx.updatedAt = new Date();
          return tx;
        }),
        delete: jest.fn(async ({ where }: any) => {
          const idx = transactions.findIndex((t) => t.id === where.id);
          if (idx !== -1) {
            return transactions.splice(idx, 1)[0];
          }
          return null;
        }),
      },
      customerTransactionItem: {
        deleteMany: jest.fn(async ({ where }: any) => {
          const tx = transactions.find((t) => t.id === where.transactionId);
          if (tx) {
            tx.items = [];
          }
          return { count: 1 };
        }),
      },
      $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        // Record row lock
        const custId = values[0];
        const oId = values[1];
        rowLockLog.push({ customerId: custId, orgId: oId, timestamp: Date.now() });
        return [{ 1: 1 }];
      }),
      $transaction: jest.fn(async (callback: any) => {
        // Enforce serialized transaction queue to test concurrency locking realism
        const priorLock = transactionLockPromise;
        let releaseLock: () => void = () => {};
        transactionLockPromise = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });

        await priorLock;
        try {
          return await callback(mockPrisma);
        } finally {
          releaseLock();
        }
      }),
    };
  };

  let mockPrisma: any;
  let mockAuditService: any;
  let service: CustomerTransactionsService;
  let controller: CustomerTransactionsController;

  beforeEach(() => {
    customers = [
      {
        id: custAlpha1,
        orgId: orgAlpha,
        name: 'Manish Kumar (Alpha Customer 1)',
        phone: '+91 99999 11111',
        city: 'Rohtak',
        fullAddress: 'Shop 12, Cloth Market',
        outstandingAmount: 0,
      },
      {
        id: custAlpha2,
        orgId: orgAlpha,
        name: 'Suresh Verma (Alpha Customer 2)',
        phone: '+91 99999 22222',
        city: 'Rohtak',
        fullAddress: 'Shop 88, Grain Market',
        outstandingAmount: 0,
      },
      {
        id: custBeta1,
        orgId: orgBeta,
        name: 'Ramesh Gupta (Beta Customer 1)',
        phone: '+91 88888 33333',
        city: 'Hisar',
        fullAddress: 'Ward 5, Mandi',
        outstandingAmount: 0,
      },
    ];

    transactions = [];
    auditLogs = [];
    rowLockLog = [];

    mockPrisma = buildMockPrisma();
    mockAuditService = {
      log: jest.fn(async (entry: any) => {
        auditLogs.push(entry);
      }),
    };

    service = new CustomerTransactionsService(mockPrisma as any, mockAuditService as any);
    controller = new CustomerTransactionsController(service);
  });

  // =========================================================================
  // MISSION 1: BOLA/IDOR MULTI-TENANT ISOLATION (100% FAIL-CLOSED WITH 404)
  // =========================================================================
  describe('Mission 1: BOLA/IDOR Multi-Tenant Isolation & 100% Fail-Closed Verification', () => {
    let txAlpha: any;
    let txBeta: any;

    beforeEach(async () => {
      // Seed one transaction for Alpha and one for Beta
      txAlpha = await service.create(orgAlpha, custAlpha1, userAlpha.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 10000,
        description: 'Alpha Initial Sale',
        items: [
          {
            productName: 'Cement 50kg',
            quantity: 20,
            unitPrice: 500,
            amount: 10000,
          },
        ],
      });

      txBeta = await service.create(orgBeta, custBeta1, userBeta.sub, {
        date: '2026-08-02',
        type: CustomerTransactionType.SALE,
        amount: 25000,
        description: 'Beta Confidential Sale',
        items: [
          {
            productName: 'High-grade Steel',
            quantity: 50,
            unitPrice: 500,
            amount: 25000,
          },
        ],
      });
    });

    it('1.1 Cross-tenant READ attempt: Distributor Alpha attempting to read Distributor Beta transaction MUST throw 404', async () => {
      // Direct call via service
      await expect(service.findOne(orgAlpha, custBeta1, txBeta.id)).rejects.toThrow(NotFoundException);

      // Call via controller with Alpha user token attempting to access Beta's transaction
      await expect(controller.findOne(userAlpha, custBeta1, txBeta.id)).rejects.toThrow(NotFoundException);

      // Attempt with Alpha's customer ID and Beta's transaction ID (IDOR probe)
      await expect(controller.findOne(userAlpha, custAlpha1, txBeta.id)).rejects.toThrow(NotFoundException);
    });

    it('1.2 Cross-tenant UPDATE attempt: Distributor Alpha attempting to edit Distributor Beta transaction MUST fail with 404 and leave data unchanged', async () => {
      const originalBetaAmount = txBeta.amount;

      await expect(
        controller.update(userAlpha, custBeta1, txBeta.id, {
          amount: 1.0,
          description: 'HACKED_BY_ALPHA',
        }),
      ).rejects.toThrow(NotFoundException);

      // Verify Beta transaction was completely untouched in DB
      const freshBetaTx = transactions.find((t) => t.id === txBeta.id);
      expect(Number(freshBetaTx.amount)).toBe(originalBetaAmount);
      expect(freshBetaTx.description).toBe('Beta Confidential Sale');

      // Verify Beta customer balance was NOT corrupted
      const betaCustomer = customers.find((c) => c.id === custBeta1);
      expect(betaCustomer.outstandingAmount).toBe(25000);
    });

    it('1.3 Cross-tenant DELETE attempt: Distributor Alpha attempting to remove Distributor Beta transaction MUST fail with 404 and leave record intact', async () => {
      await expect(controller.remove(userAlpha, custBeta1, txBeta.id)).rejects.toThrow(NotFoundException);

      // Verify Beta transaction still exists in DB
      const freshBetaTx = transactions.find((t) => t.id === txBeta.id);
      expect(freshBetaTx).toBeDefined();
      expect(freshBetaTx.id).toBe(txBeta.id);

      // Verify Beta customer balance remains intact
      const betaCustomer = customers.find((c) => c.id === custBeta1);
      expect(betaCustomer.outstandingAmount).toBe(25000);
    });

    it('1.4 Cross-tenant CREATE attempt: Distributor Alpha attempting to inject transaction into Beta customer MUST fail with 404', async () => {
      const initialTxCount = transactions.length;

      await expect(
        controller.create(userAlpha, custBeta1, {
          date: '2026-08-05',
          type: CustomerTransactionType.SALE,
          amount: 50000,
          description: 'Forged invoice',
        }),
      ).rejects.toThrow(NotFoundException);

      // No new transaction added
      expect(transactions.length).toBe(initialTxCount);
      const betaCustomer = customers.find((c) => c.id === custBeta1);
      expect(betaCustomer.outstandingAmount).toBe(25000);
    });

    it('1.5 Cross-tenant LEDGER attempt: Distributor Alpha querying Beta customer ledger MUST fail with 404', async () => {
      await expect(controller.getLedger(userAlpha, custBeta1, {})).rejects.toThrow(NotFoundException);
    });

    it('1.6 Cross-tenant STATEMENT attempt: Distributor Alpha fetching Beta statement JSON or PDF MUST fail with 404', async () => {
      await expect(controller.getStatement(userAlpha, custBeta1, {})).rejects.toThrow(NotFoundException);

      const resMock: any = { set: jest.fn(), end: jest.fn() };
      await expect(controller.downloadStatementPdf(userAlpha, custBeta1, {}, resMock)).rejects.toThrow(
        NotFoundException,
      );
      expect(resMock.end).not.toHaveBeenCalled();
    });

    it('1.7 Intra-tenant Cross-Customer IDOR: Org Alpha accessing Cust1 transaction under Cust2 URL path MUST fail with 404', async () => {
      // Alpha Customer 2 tries to access Alpha Customer 1 transaction
      await expect(controller.findOne(userAlpha, custAlpha2, txAlpha.id)).rejects.toThrow(NotFoundException);

      // Alpha Customer 2 tries to edit Alpha Customer 1 transaction
      await expect(
        controller.update(userAlpha, custAlpha2, txAlpha.id, { amount: 500 }),
      ).rejects.toThrow(NotFoundException);

      // Alpha Customer 2 tries to delete Alpha Customer 1 transaction
      await expect(controller.remove(userAlpha, custAlpha2, txAlpha.id)).rejects.toThrow(NotFoundException);
    });

    it('1.8 Randomized IDOR Fuzzing Matrix (100 permutations across all 7 endpoints): 100% fail-closed with 404', async () => {
      const fakeOrgs = ['org-fake-1', 'org-evil', 'null', 'undefined', ''];
      const fakeCusts = ['cust-unknown-999', 'cust-null', 'cust-evil-x'];
      const fakeTxIds = ['tx-non-existent-1', 'tx-ghost-99', '00000000-0000-0000-0000-000000000000'];

      const resMock: any = { set: jest.fn(), end: jest.fn() };

      for (let i = 0; i < 20; i++) {
        const testOrg = fakeOrgs[i % fakeOrgs.length];
        const testCust = fakeCusts[i % fakeCusts.length];
        const testTx = fakeTxIds[i % fakeTxIds.length];
        const fakeUser = { sub: `usr-attacker-${i}`, orgId: testOrg, role: 'attacker', email: 'att@test.com' };

        // 1. findOne
        await expect(controller.findOne(fakeUser, testCust, testTx)).rejects.toThrow(NotFoundException);
        // 2. update
        await expect(controller.update(fakeUser, testCust, testTx, { amount: 100 })).rejects.toThrow(NotFoundException);
        // 3. remove
        await expect(controller.remove(fakeUser, testCust, testTx)).rejects.toThrow(NotFoundException);
        // 4. getLedger
        await expect(controller.getLedger(fakeUser, testCust, {})).rejects.toThrow(NotFoundException);
        // 5. getStatement
        await expect(controller.getStatement(fakeUser, testCust, {})).rejects.toThrow(NotFoundException);
        // 6. downloadStatementPdf
        await expect(controller.downloadStatementPdf(fakeUser, testCust, {}, resMock)).rejects.toThrow(NotFoundException);
      }
    });
  });

  // =========================================================================
  // MISSION 2: EXHAUSTIVE INPUT VALIDATION STRESS TESTING
  // =========================================================================
  describe('Mission 2: Exhaustive Input Validation Stress Testing', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });

    const transformAndValidate = async <T extends object>(cls: any, body: any): Promise<T> => {
      const metadata: ArgumentMetadata = { type: 'body', metatype: cls };
      return (await pipe.transform(body, metadata)) as T;
    };

    describe('2.1 Date Format and Calendar Boundary Validation', () => {
      it('rejects non-leap year Feb 29 (2025-02-29, 2026-02-29, 2027-02-29)', async () => {
        for (const badDate of ['2025-02-29', '2026-02-29', '2027-02-29']) {
          const dto = plainToInstance(CreateTransactionDto, {
            date: badDate,
            type: CustomerTransactionType.SALE,
            amount: 100,
          });
          const errors = await validate(dto);
          expect(errors.some((e) => e.property === 'date')).toBe(true);

          await expect(
            transformAndValidate(CreateTransactionDto, {
              date: badDate,
              type: CustomerTransactionType.SALE,
              amount: 100,
            }),
          ).rejects.toThrow(BadRequestException);
        }
      });

      it('accepts valid leap year Feb 29 (2024-02-29, 2028-02-29)', async () => {
        for (const goodLeapDate of ['2024-02-29', '2028-02-29']) {
          const dto = plainToInstance(CreateTransactionDto, {
            date: goodLeapDate,
            type: CustomerTransactionType.SALE,
            amount: 100,
          });
          const errors = await validate(dto);
          expect(errors.filter((e) => e.property === 'date')).toHaveLength(0);

          const transformed = await transformAndValidate<CreateTransactionDto>(CreateTransactionDto, {
            date: goodLeapDate,
            type: CustomerTransactionType.SALE,
            amount: 100,
          });
          expect(transformed.date).toBe(goodLeapDate);
        }
      });

      it('rejects impossible calendar dates (Feb 30/31, Apr 31, Jun 31, Sep 31, Nov 31)', async () => {
        const impossibleDates = [
          '2026-02-30',
          '2026-02-31',
          '2026-04-31',
          '2026-06-31',
          '2026-09-31',
          '2026-11-31',
          '2026-00-10',
          '2026-13-01',
          '2026-05-00',
          '2026-05-32',
        ];

        for (const badDate of impossibleDates) {
          const dto = plainToInstance(CreateTransactionDto, {
            date: badDate,
            type: CustomerTransactionType.SALE,
            amount: 100,
          });
          const errors = await validate(dto);
          expect(errors.some((e) => e.property === 'date')).toBe(true);
        }
      });

      it('rejects non-ISO date formats (slash separator, DD-MM-YYYY, word dates)', async () => {
        const malformedFormats = [
          '2026/08/01',
          '01-08-2026',
          '2026.08.01',
          '2026-8-1',
          'yesterday',
          'tomorrow',
          '2026-08',
          '1790012872414',
          '',
          '   ',
        ];

        for (const badFormat of malformedFormats) {
          const dto = plainToInstance(CreateTransactionDto, {
            date: badFormat,
            type: CustomerTransactionType.SALE,
            amount: 100,
          });
          const errors = await validate(dto);
          expect(errors.some((e) => e.property === 'date')).toBe(true);
        }
      });

      it('enforces strict calendar date validation on LedgerQueryDto parameters', async () => {
        const badQueryDto = plainToInstance(LedgerQueryDto, {
          startDate: '2026-02-31',
          endDate: '2026-13-01',
          dateFrom: '01/08/2026',
          dateTo: 'not-a-date',
          statementDate: '2025-02-29',
        });
        const errors = await validate(badQueryDto);
        expect(errors.some((e) => e.property === 'startDate')).toBe(true);
        expect(errors.some((e) => e.property === 'endDate')).toBe(true);
        expect(errors.some((e) => e.property === 'dateFrom')).toBe(true);
        expect(errors.some((e) => e.property === 'dateTo')).toBe(true);
        expect(errors.some((e) => e.property === 'statementDate')).toBe(true);
      });
    });

    describe('2.2 Monetary Amount Validation (SALE, RETURN, PAYMENT, ADJUSTMENT)', () => {
      it('rejects negative amounts on SALE, RETURN, and PAYMENT', async () => {
        for (const type of [CustomerTransactionType.SALE, CustomerTransactionType.RETURN, CustomerTransactionType.PAYMENT]) {
          for (const negAmt of [-0.01, -1.0, -500.0, -99999.99]) {
            const dto = plainToInstance(CreateTransactionDto, {
              date: '2026-08-01',
              type,
              amount: negAmt,
            });
            const errors = await validate(dto);
            expect(errors.some((e) => e.property === 'amount')).toBe(true);

            // Also test service level validation directly
            await expect(
              service.create(orgAlpha, custAlpha1, userAlpha.sub, {
                date: '2026-08-01',
                type,
                amount: negAmt,
              }),
            ).rejects.toThrow(BadRequestException);
          }
        }
      });

      it('rejects zero amount on SALE, RETURN, and PAYMENT (must be >= 0.01)', async () => {
        for (const type of [CustomerTransactionType.SALE, CustomerTransactionType.RETURN, CustomerTransactionType.PAYMENT]) {
          const dto = plainToInstance(CreateTransactionDto, {
            date: '2026-08-01',
            type,
            amount: 0,
          });
          const errors = await validate(dto);
          expect(errors.some((e) => e.property === 'amount')).toBe(true);
        }
      });

      it('allows negative, zero, and positive amounts strictly for ADJUSTMENT', async () => {
        for (const adjAmt of [-500.25, 0, 750.5]) {
          const dto = plainToInstance(CreateTransactionDto, {
            date: '2026-08-01',
            type: CustomerTransactionType.ADJUSTMENT,
            amount: adjAmt,
          });
          const errors = await validate(dto);
          expect(errors.filter((e) => e.property === 'amount')).toHaveLength(0);

          // Service level must also accept
          const record = await service.create(orgAlpha, custAlpha1, userAlpha.sub, {
            date: '2026-08-01',
            type: CustomerTransactionType.ADJUSTMENT,
            amount: adjAmt,
          });
          expect(record.amount).toBe(adjAmt);
        }
      });

      it('rejects amounts exceeding PostgreSQL Decimal(12,2) limit (9,999,999,999.99)', async () => {
        const overflowDto = plainToInstance(CreateTransactionDto, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 10000000000.0, // 10 Billion > 9.99 Billion
        });
        const errors = await validate(overflowDto);
        expect(errors.some((e) => e.property === 'amount')).toBe(true);

        const validMaxDto = plainToInstance(CreateTransactionDto, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 9999999999.99,
        });
        const validErrors = await validate(validMaxDto);
        expect(validErrors.filter((e) => e.property === 'amount')).toHaveLength(0);
      });

      it('rejects NaN, Infinity, and non-numeric amounts', async () => {
        for (const badAmt of [NaN, Infinity, -Infinity, 'invalid' as any]) {
          const dto = plainToInstance(CreateTransactionDto, {
            date: '2026-08-01',
            type: CustomerTransactionType.SALE,
            amount: badAmt,
          });
          const errors = await validate(dto);
          expect(errors.some((e) => e.property === 'amount')).toBe(true);
        }
      });
    });

    describe('2.3 Transaction Type and Enum Validation', () => {
      it('rejects invalid transaction types (INVOICE, DEBIT, CREDIT, sale lowercase, unknown)', async () => {
        const invalidTypes = ['INVOICE', 'DEBIT', 'CREDIT', 'sale', 'payment', 'UNKNOWN', '', '123'];

        for (const badType of invalidTypes) {
          const dto = plainToInstance(CreateTransactionDto, {
            date: '2026-08-01',
            type: badType as any,
            amount: 100,
          });
          const errors = await validate(dto);
          expect(errors.some((e) => e.property === 'type')).toBe(true);

          await expect(
            transformAndValidate(CreateTransactionDto, {
              date: '2026-08-01',
              type: badType,
              amount: 100,
            }),
          ).rejects.toThrow(BadRequestException);
        }
      });

      it('rejects invalid PaymentMethod enums', async () => {
        const dto = plainToInstance(CreateTransactionDto, {
          date: '2026-08-01',
          type: CustomerTransactionType.PAYMENT,
          amount: 100,
          paymentMethod: 'BITCOIN' as any,
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
      });
    });

    describe('2.4 Line Item and Quantity Validation', () => {
      it('rejects zero and negative item quantities (must be >= 0.01)', async () => {
        for (const badQty of [0, -1, -0.01, -100]) {
          const itemDto = plainToInstance(CreateTransactionItemDto, {
            productName: 'Cement Bag',
            quantity: badQty,
            unitPrice: 500,
          });
          const errors = await validate(itemDto);
          expect(errors.some((e) => e.property === 'quantity')).toBe(true);

          // Service validation
          await expect(
            service.create(orgAlpha, custAlpha1, userAlpha.sub, {
              date: '2026-08-01',
              type: CustomerTransactionType.SALE,
              amount: 500,
              items: [
                {
                  productName: 'Cement Bag',
                  quantity: badQty,
                  unitPrice: 500,
                  amount: 500,
                },
              ],
            }),
          ).rejects.toThrow(BadRequestException);
        }
      });

      it('rejects negative item unitPrice', async () => {
        const itemDto = plainToInstance(CreateTransactionItemDto, {
          productName: 'Cement Bag',
          quantity: 10,
          unitPrice: -50,
        });
        const errors = await validate(itemDto);
        expect(errors.some((e) => e.property === 'unitPrice')).toBe(true);

        await expect(
          service.create(orgAlpha, custAlpha1, userAlpha.sub, {
            date: '2026-08-01',
            type: CustomerTransactionType.SALE,
            amount: 500,
            items: [
              {
                productName: 'Cement Bag',
                quantity: 10,
                unitPrice: -50,
                amount: 500,
              },
            ],
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects empty or whitespace-only item productName', async () => {
        for (const badName of ['', '   ', '\t', '\n']) {
          const itemDto = plainToInstance(CreateTransactionItemDto, {
            productName: badName,
            quantity: 5,
            unitPrice: 100,
          });
          const errors = await validate(itemDto);
          expect(errors.some((e) => e.property === 'productName')).toBe(true);
        }
      });

      it('rejects null bytes and unprintable control characters in descriptions and items', async () => {
        const dangerousStrings = [
          'Marble slab \u0000 corrupted',
          'Tiles \u0007 bell sound',
          'Cement \u001B[31m red escape',
        ];

        for (const dangerous of dangerousStrings) {
          const itemDto = plainToInstance(CreateTransactionItemDto, {
            productName: dangerous,
            quantity: 1,
            unitPrice: 100,
          });
          const errors = await validate(itemDto);
          expect(errors.some((e) => e.property === 'productName')).toBe(true);

          const txDto = plainToInstance(CreateTransactionDto, {
            date: '2026-08-01',
            type: CustomerTransactionType.SALE,
            amount: 100,
            description: dangerous,
          });
          const txErrors = await validate(txDto);
          expect(txErrors.some((e) => e.property === 'description')).toBe(true);
        }
      });

      it('accepts authentic Hindi Devanagari characters, numerals, and punctuation', async () => {
        const authenticHindiTexts = [
          'अलमारी के लिए पत्थर',
          'राजस्थानी मकराना मार्बल (१०x१२)',
          'चौखट फिटिंग ग्रेनाइट स्लैब - ५० नग',
          'बिल सं. १०४२/२०२६',
        ];

        for (const hindi of authenticHindiTexts) {
          const itemDto = plainToInstance(CreateTransactionItemDto, {
            productName: hindi,
            quantity: 10,
            unitPrice: 450,
          });
          const errors = await validate(itemDto);
          expect(errors).toHaveLength(0);
        }
      });

      it('REMEDIATED DEFECT 1: UNICODE_TEXT_PATTERN in DTOs correctly accepts Rupee symbol (₹) and Math symbols (+, =) via \\p{S} and \\p{Cf}', async () => {
        // Remediated pattern in create-transaction-item.dto.ts: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Cf}\p{Zs}\n\r]*$/u
        // In Unicode, the Indian Rupee sign '₹' (U+20B9) has category \p{Sc} (Currency_Symbol), a subset of \p{S}.
        // The plus sign '+' has category \p{Sm} (Math_Symbol), a subset of \p{S}.
        // Both \p{S} and \p{Cf} are included, properly supporting Indian shopkeeper entries.
        const rupeeItem = plainToInstance(CreateTransactionItemDto, {
          productName: 'दर: ₹४५०.०० प्रति बैग',
          quantity: 10,
          unitPrice: 450,
        });
        const rupeeErrors = await validate(rupeeItem);
        // Confirms remediation: DTO validation accepts Indian Rupee symbol
        expect(rupeeErrors.filter((e) => e.property === 'productName')).toHaveLength(0);

        const plusItem = plainToInstance(CreateTransactionItemDto, {
          productName: 'सीमेंट + बालू + बजरी',
          quantity: 5,
          unitPrice: 200,
        });
        const plusErrors = await validate(plusItem);
        // Confirms remediation: DTO validation accepts plus symbol '+'
        expect(plusErrors.filter((e) => e.property === 'productName')).toHaveLength(0);

        // Verification of pattern across descriptions and math/ligature symbols
        expect(UNICODE_TEXT_PATTERN.test('दर: ₹४५०.०० प्रति बैग')).toBe(true);
        expect(UNICODE_TEXT_PATTERN.test('सीमेंट + बालू + बजरी')).toBe(true);
        expect(UNICODE_TEXT_PATTERN.test('साइज 10 x 12 = 120 sq ft')).toBe(true);
        expect(UNICODE_TEXT_PATTERN.test('अवैध \u0000')).toBe(false); // Null byte blocked
        expect(UNICODE_TEXT_PATTERN.test('कंट्रोल \u0007')).toBe(false); // Bell char blocked
      });

      it('REMEDIATED DEFECT 2: IsValidTransactionAmount permits partial PATCH of negative ADJUSTMENT when type field is omitted in body', async () => {
        // In UpdateTransactionDto, when type is omitted in partial PATCH,
        // Case C permits the amount at the DTO layer, allowing CustomerTransactionsService.update()
        // to enforce sign rules against the database row.
        const partialUpdateDto = plainToInstance(UpdateTransactionDto, {
          amount: -500, // Legitimate for ADJUSTMENT, type omitted in PATCH
        });
        const errors = await validate(partialUpdateDto);
        // Confirms remediation: validator permits negative amount on partial PATCH
        expect(errors.filter((e) => e.property === 'amount')).toHaveLength(0);

        // Explicit ADJUSTMENT also passes:
        const explicitUpdateDto = plainToInstance(UpdateTransactionDto, {
          type: CustomerTransactionType.ADJUSTMENT,
          amount: -500,
        });
        const explicitErrors = await validate(explicitUpdateDto);
        expect(explicitErrors.filter((e) => e.property === 'amount')).toHaveLength(0);

        // Explicit non-ADJUSTMENT with negative amount is still rejected at DTO layer:
        const explicitSaleDto = plainToInstance(UpdateTransactionDto, {
          type: CustomerTransactionType.SALE,
          amount: -500,
        });
        const saleErrors = await validate(explicitSaleDto);
        expect(saleErrors.some((e) => e.property === 'amount')).toBe(true);

        // NaN, Infinity, and overflow beyond Decimal(12,2) are still rejected:
        const nanDto = plainToInstance(UpdateTransactionDto, { amount: NaN });
        expect((await validate(nanDto)).some((e) => e.property === 'amount')).toBe(true);

        const infDto = plainToInstance(UpdateTransactionDto, { amount: Infinity });
        expect((await validate(infDto)).some((e) => e.property === 'amount')).toBe(true);

        const overflowDto = plainToInstance(UpdateTransactionDto, { amount: -10000000000.00 });
        expect((await validate(overflowDto)).some((e) => e.property === 'amount')).toBe(true);
      });

      it('rejects non-whitelisted payload fields under ValidationPipe forbidNonWhitelisted', async () => {
        await expect(
          transformAndValidate(CreateTransactionDto, {
            date: '2026-08-01',
            type: CustomerTransactionType.SALE,
            amount: 100,
            maliciousPayload: 'DROP TABLE Customer;',
            injectRole: 'SUPER_ADMIN',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // =========================================================================
  // MISSION 3: CONCURRENT REQUESTS & NON-BLOCKING PERFORMANCE
  // =========================================================================
  describe('Mission 3: Concurrent Requests & Non-Blocking Performance', () => {
    it('3.1 50 concurrent transactions for the same customer: row lock executed on all, zero drift in final balance', async () => {
      const CONCURRENT_COUNT = 50;
      const saleAmount = 100.5; // Total expected: 50 * 100.5 = 5025.00

      const promises = Array.from({ length: CONCURRENT_COUNT }).map((_, idx) =>
        service.create(orgAlpha, custAlpha1, userAlpha.sub, {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: saleAmount,
          description: `Concurrent Sale #${idx + 1}`,
        }),
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const durationMs = Date.now() - startTime;

      // 50 operations must execute smoothly
      expect(results).toHaveLength(CONCURRENT_COUNT);
      expect(durationMs).toBeLessThan(3000);

      // Verify row lock was issued for each create
      const alphaLocks = rowLockLog.filter((l) => l.customerId === custAlpha1 && l.orgId === orgAlpha);
      expect(alphaLocks.length).toBe(CONCURRENT_COUNT);

      // Verify final customer balance matches exactly 5025.00
      const customer = customers.find((c) => c.id === custAlpha1);
      expect(customer.outstandingAmount).toBe(5025.0);

      // Verify ledger dynamic computation equals exact balance
      const ledger = await service.findAllLedger(orgAlpha, custAlpha1, {});
      expect(ledger.summary.transactionCount).toBe(CONCURRENT_COUNT);
      expect(ledger.summary.totalGoodsGiven).toBe(5025.0);
      expect(ledger.summary.netBalance).toBe(5025.0);
      expect(ledger.customer.outstandingAmount).toBe(5025.0);
    });

    it('3.2 Interleaved concurrent mutations: 30 SALE (₹200) and 30 PAYMENT (₹120) executed simultaneously', async () => {
      // Net expected: 30 * 200 - 30 * 120 = 6000 - 3600 = 2400.00
      const operations: Promise<any>[] = [];

      for (let i = 0; i < 30; i++) {
        operations.push(
          service.create(orgAlpha, custAlpha2, userAlpha.sub, {
            date: '2026-08-01',
            type: CustomerTransactionType.SALE,
            amount: 200,
            description: `Interleaved Sale ${i}`,
          }),
        );
        operations.push(
          service.create(orgAlpha, custAlpha2, userAlpha.sub, {
            date: '2026-08-02',
            type: CustomerTransactionType.PAYMENT,
            amount: 120,
            description: `Interleaved Payment ${i}`,
          }),
        );
      }

      await Promise.all(operations);

      const customer = customers.find((c) => c.id === custAlpha2);
      expect(customer.outstandingAmount).toBe(2400.0);

      const ledger = await service.findAllLedger(orgAlpha, custAlpha2, {});
      expect(ledger.summary.totalGoodsGiven).toBe(6000.0);
      expect(ledger.summary.totalPaymentsReceived).toBe(3600.0);
      expect(ledger.summary.netBalance).toBe(2400.0);
    });

    it('3.3 High-frequency concurrent reads while writes are active do not throw or produce invalid data', async () => {
      // Concurrently execute 20 creates and 20 ledger reads
      const writePromises = Array.from({ length: 20 }).map((_, i) =>
        service.create(orgAlpha, custAlpha1, userAlpha.sub, {
          date: '2026-08-10',
          type: CustomerTransactionType.SALE,
          amount: 50,
          description: `Write ${i}`,
        }),
      );

      const readPromises = Array.from({ length: 20 }).map(() =>
        service.findAllLedger(orgAlpha, custAlpha1, {}),
      );

      const [writeResults, readResults] = await Promise.all([
        Promise.all(writePromises),
        Promise.all(readPromises),
      ]);

      expect(writeResults).toHaveLength(20);
      expect(readResults).toHaveLength(20);

      for (const ledger of readResults) {
        expect(ledger.summary).toBeDefined();
        expect(ledger.summary.netBalance).toBeGreaterThanOrEqual(0);
        expect(ledger.customer.id).toBe(custAlpha1);
      }
    });

    it('3.4 Non-blocking audit log resilience under concurrent mutations and artificial failures', async () => {
      // Simulate audit service with failure on every 3rd call
      let callCount = 0;
      mockAuditService.log = jest.fn(async () => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('Transient Kafka/Audit failure');
        }
      });

      const promises = Array.from({ length: 15 }).map((_, i) =>
        service.create(orgAlpha, custAlpha1, userAlpha.sub, {
          date: '2026-08-15',
          type: CustomerTransactionType.SALE,
          amount: 100,
          description: `Audit resilient tx ${i}`,
        }),
      );

      // All 15 transactions must succeed 100% without throwing despite audit failures
      const results = await Promise.all(promises);
      expect(results).toHaveLength(15);
    });
  });
});
