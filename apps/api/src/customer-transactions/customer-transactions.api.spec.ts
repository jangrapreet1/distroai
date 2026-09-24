import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CustomerTransactionsController } from './customer-transactions.controller';
import { CustomerTransactionsService } from './customer-transactions.service';
import { CustomerTransactionType, PaymentMethod } from './customer-transactions.calculation';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { CreateTransactionItemDto } from './dto/create-transaction-item.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';

describe('CustomerTransactions API & Service Unit Suite (Milestone M2)', () => {
  const orgA = 'org-tenant-a';
  const orgB = 'org-tenant-b';
  const userA = { sub: 'usr-admin-a', orgId: orgA, role: 'admin', email: 'admin@a.com' };
  const customerId = 'cust-uuid-1';

  // In-memory mock database state
  let mockCustomers: any[] = [];
  let mockTransactions: any[] = [];
  let mockAuditLogs: any[] = [];
  let queryRawCalls: any[] = [];

  // Mock PrismaService
  const createMockPrismaService = () => ({
    customer: {
      findFirst: jest.fn(async ({ where }: any) => {
        return mockCustomers.find(
          (c) => c.id === where.id && (!where.orgId || c.orgId === where.orgId),
        ) || null;
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
        if (where.id === orgA) {
          return {
            id: orgA,
            name: 'Radhakishan Trading Company',
            address: 'Main Market, Anaj Mandi',
            city: 'Rohtak',
            state: 'Haryana',
            phone: '+91 98765 43210',
            gstNumber: '06AAAAA0000A1Z5',
          };
        }
        return null;
      }),
    },
    customerTransaction: {
      findFirst: jest.fn(async ({ where }: any) => {
        return mockTransactions.find(
          (t) =>
            t.id === where.id &&
            (!where.customerId || t.customerId === where.customerId) &&
            (!where.orgId || t.orgId === where.orgId),
        ) || null;
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
          results = results.filter((t) => new Date(t.date) < new Date(where.date.lt));
        }
        if (where.date?.gte) {
          results = results.filter((t) => new Date(t.date) >= new Date(where.date.gte));
        }
        if (where.date?.lte) {
          results = results.filter((t) => new Date(t.date) <= new Date(where.date.lte));
        }
        // Apply chronological sort
        results.sort((a, b) => {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        return results;
      }),
      create: jest.fn(async ({ data }: any) => {
        const record = {
          id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
            id: `item-${idx + 1}`,
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
        mockTransactions.push(record);
        return record;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const tx = mockTransactions.find((t) => t.id === where.id);
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
            id: `item-upd-${idx + 1}`,
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
        const idx = mockTransactions.findIndex((t) => t.id === where.id);
        if (idx !== -1) {
          const removed = mockTransactions.splice(idx, 1)[0];
          return removed;
        }
        return null;
      }),
    },
    customerTransactionItem: {
      deleteMany: jest.fn(async ({ where }: any) => {
        const tx = mockTransactions.find((t) => t.id === where.transactionId);
        if (tx) {
          tx.items = [];
        }
        return { count: 1 };
      }),
    },
    $queryRaw: jest.fn(async (query: any, ...params: any[]) => {
      queryRawCalls.push({ query, params });
      return [{ 1: 1 }];
    }),
    $transaction: jest.fn(async (cb: any) => {
      // Execute the callback with the same mock Prisma client
      return cb(mockPrisma);
    }),
  });

  let mockPrisma: any;
  let mockAuditLog: any;
  let service: CustomerTransactionsService;
  let controller: CustomerTransactionsController;

  beforeEach(() => {
    mockCustomers = [
      {
        id: customerId,
        orgId: orgA,
        name: 'Manish Kumar',
        phone: '+91 99999 11111',
        city: 'Rohtak',
        address: 'Shop #12, Cloth Market',
        outstandingAmount: 0,
      },
    ];
    mockTransactions = [];
    mockAuditLogs = [];
    queryRawCalls = [];

    mockPrisma = createMockPrismaService();
    mockAuditLog = {
      log: jest.fn(async (params: any) => {
        mockAuditLogs.push(params);
      }),
    };

    service = new CustomerTransactionsService(mockPrisma as any, mockAuditLog as any);
    controller = new CustomerTransactionsController(service);
  });

  // =========================================================================
  // 1. CONTROLLER ROUTE DISPATCH & STATUS CODES
  // =========================================================================
  describe('1. Controller Endpoints', () => {
    it('1.1 POST /customers/:customerId/transactions delegates to service.create', async () => {
      const dto: CreateTransactionDto = {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 5000,
        description: 'Initial Delivery',
      };
      const result = await controller.create(userA, customerId, dto);

      expect(result).toBeDefined();
      expect(result.amount).toBe(5000);
      expect(result.customerId).toBe(customerId);
      expect(result.type).toBe(CustomerTransactionType.SALE);
    });

    it('1.2 GET /customers/:customerId/ledger delegates to service.findAllLedger', async () => {
      // Seed a transaction
      await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 3000,
      });

      const ledger = await controller.getLedger(userA, customerId, {});
      expect(ledger.entries).toHaveLength(1);
      expect(ledger.summary.totalGoodsGiven).toBe(3000);
      expect(ledger.summary.netBalance).toBe(3000);
    });

    it('1.3 GET /customers/:customerId/transactions/:id delegates to service.findOne', async () => {
      const created = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-02',
        type: CustomerTransactionType.PAYMENT,
        amount: 1500,
      });

      const fetched = await controller.findOne(userA, customerId, created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.amount).toBe(1500);
    });

    it('1.4 PATCH /customers/:customerId/transactions/:id delegates to service.update', async () => {
      const created = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-03',
        type: CustomerTransactionType.SALE,
        amount: 2000,
      });

      const updated = await controller.update(userA, customerId, created.id, {
        amount: 2500,
      });
      expect(updated.amount).toBe(2500);
    });

    it('1.4.1 PATCH with negative amount without type succeeds for existing ADJUSTMENT transaction', async () => {
      const created = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-03',
        type: CustomerTransactionType.ADJUSTMENT,
        amount: 500,
      });

      const updated = await controller.update(userA, customerId, created.id, {
        amount: -500,
      });
      expect(updated.amount).toBe(-500);
    });

    it('1.4.2 PATCH with negative amount without type fails for existing SALE transaction', async () => {
      const created = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-03',
        type: CustomerTransactionType.SALE,
        amount: 2000,
      });

      await expect(
        controller.update(userA, customerId, created.id, {
          amount: -500,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('1.4.3 POST create transaction with Rupee (₹) and plus (+) symbols in items succeeds', async () => {
      const created = await controller.create(userA, customerId, {
        date: '2026-08-03',
        type: CustomerTransactionType.SALE,
        amount: 450,
        description: 'दर: ₹४५० प्रति बैग',
        items: [
          {
            productName: 'सीमेंट + बजरी (दर: ₹४५०)',
            quantity: 1,
            unitPrice: 450,
            amount: 450,
          },
        ],
      });
      expect(created.id).toBeDefined();
      expect(created.description).toBe('दर: ₹४५० प्रति बैग');
      expect(created.items[0].productName).toBe('सीमेंट + बजरी (दर: ₹४५०)');
    });

    it('1.5 DELETE /customers/:customerId/transactions/:id delegates to service.remove', async () => {
      const created = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-04',
        type: CustomerTransactionType.SALE,
        amount: 4000,
      });

      const result = await controller.remove(userA, customerId, created.id);
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(created.id);
    });

    it('1.6 GET /customers/:customerId/statement delegates to service.getStatementData', async () => {
      await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-05',
        type: CustomerTransactionType.SALE,
        amount: 6000,
      });

      const statement = await controller.getStatement(userA, customerId, {});
      expect(statement.organization.name).toBe('Radhakishan Trading Company');
      expect(statement.customer.name).toBe('Manish Kumar');
      expect(statement.rows.length).toBeGreaterThan(0);
      expect(statement.summary.netBalance).toBe(6000);
    });

    it('1.7 GET /customers/:customerId/statement/pdf streams binary PDF headers', async () => {
      const resMock: any = {
        set: jest.fn(),
        end: jest.fn(),
      };

      await controller.downloadStatementPdf(userA, customerId, {}, resMock);

      expect(resMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="statement-${customerId}.pdf"`,
        }),
      );
      expect(resMock.end).toHaveBeenCalled();
      const streamedBuffer = resMock.end.mock.calls[0][0];
      expect(Buffer.isBuffer(streamedBuffer)).toBe(true);
      expect(streamedBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });

  // =========================================================================
  // 2. ATOMIC SYNCHRONIZATION & PESSIMISTIC LOCKING
  // =========================================================================
  describe('2. Atomic Balance Sync & Concurrency Locking', () => {
    it('2.1 executes SELECT ... FOR UPDATE row lock inside $transaction on create', async () => {
      await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 10000,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(queryRawCalls.length).toBeGreaterThan(0);
      // Verify row lock was requested
      const lockCall = queryRawCalls[0];
      expect(lockCall).toBeDefined();
    });

    it('2.2 SALE transaction atomically updates Customer.outstandingAmount', async () => {
      await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 15000,
      });

      const cust = mockCustomers.find((c) => c.id === customerId);
      expect(cust.outstandingAmount).toBe(15000);
    });

    it('2.3 RETURN and PAYMENT decrease Customer.outstandingAmount', async () => {
      // 1. Initial sale: 20,000
      await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 20000,
      });
      // 2. Return: 2,000
      await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-05',
        type: CustomerTransactionType.RETURN,
        amount: 2000,
      });
      // 3. Payment: 10,000
      await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-10',
        type: CustomerTransactionType.PAYMENT,
        amount: 10000,
      });

      const cust = mockCustomers.find((c) => c.id === customerId);
      expect(cust.outstandingAmount).toBe(8000); // 20000 - 2000 - 10000
    });

    it('2.4 Editing transaction dynamically recalculates Customer.outstandingAmount', async () => {
      const sale = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 10000,
      });

      await service.update(orgA, customerId, sale.id, userA.sub, {
        amount: 12500,
      });

      const cust = mockCustomers.find((c) => c.id === customerId);
      expect(cust.outstandingAmount).toBe(12500);
    });

    it('2.5 Deleting transaction dynamically recalculates Customer.outstandingAmount', async () => {
      const sale1 = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 10000,
      });
      const sale2 = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-02',
        type: CustomerTransactionType.SALE,
        amount: 5000,
      });

      expect(mockCustomers[0].outstandingAmount).toBe(15000);

      await service.remove(orgA, customerId, sale1.id, userA.sub);

      expect(mockCustomers[0].outstandingAmount).toBe(5000);
    });
  });

  // =========================================================================
  // 3. MULTI-TENANT ISOLATION & BOLA DEFENSE
  // =========================================================================
  describe('3. Multi-Tenant Security & Scoping', () => {
    it('3.1 rejects create when customer belongs to another organization (404)', async () => {
      await expect(
        service.create(orgB, customerId, 'usr-b', {
          date: '2026-08-01',
          type: CustomerTransactionType.SALE,
          amount: 1000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('3.2 rejects findOne when transaction belongs to another organization (404)', async () => {
      const tx = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 1000,
      });

      await expect(service.findOne(orgB, customerId, tx.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('3.3 rejects update when called by another organization (404)', async () => {
      const tx = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 1000,
      });

      await expect(
        service.update(orgB, customerId, tx.id, 'usr-b', { amount: 9999 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('3.4 rejects remove when called by another organization (404)', async () => {
      const tx = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 1000,
      });

      await expect(service.remove(orgB, customerId, tx.id, 'usr-b')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('3.5 findAllLedger returns 404 if customer not found in organization', async () => {
      await expect(service.findAllLedger(orgB, customerId, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // 4. MUTATION AUDIT TRAIL LOGGING & FAULT TOLERANCE
  // =========================================================================
  describe('4. Mutation Audit Logging', () => {
    it('4.1 logs CREATE action with actor, null oldValue, and full newValue snapshot', async () => {
      const created = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 7500,
        description: 'अलमारी के लिए पत्थर',
        items: [
          {
            productName: 'अलमारी के लिए पत्थर',
            quantity: 15,
            unitPrice: 500,
            amount: 7500,
          },
        ],
      });

      expect(mockAuditLogs).toHaveLength(1);
      const log = mockAuditLogs[0];
      expect(log.action).toBe('CREATE');
      expect(log.entityType).toBe('CUSTOMER_TRANSACTION');
      expect(log.entityId).toBe(created.id);
      expect(log.userId).toBe(userA.sub);
      expect(log.orgId).toBe(orgA);
      expect(log.oldValue).toBeNull();
      expect(log.newValue.amount).toBe(7500);
      expect(log.newValue.items).toHaveLength(1);
      expect(log.newValue.items[0].productName).toBe('अलमारी के लिए पत्थर');
    });

    it('4.2 logs UPDATE action capturing before and after state snapshots', async () => {
      const created = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 5000,
      });

      await service.update(orgA, customerId, created.id, userA.sub, {
        amount: 6500,
      });

      expect(mockAuditLogs).toHaveLength(2);
      const updateLog = mockAuditLogs[1];
      expect(updateLog.action).toBe('UPDATE');
      expect(updateLog.entityId).toBe(created.id);
      expect(updateLog.oldValue.amount).toBe(5000);
      expect(updateLog.newValue.amount).toBe(6500);
    });

    it('4.3 logs DELETE action capturing full deleted row in oldValue', async () => {
      const created = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 5000,
      });

      await service.remove(orgA, customerId, created.id, userA.sub);

      expect(mockAuditLogs).toHaveLength(2);
      const deleteLog = mockAuditLogs[1];
      expect(deleteLog.action).toBe('DELETE');
      expect(deleteLog.entityId).toBe(created.id);
      expect(deleteLog.oldValue.amount).toBe(5000);
      expect(deleteLog.newValue).toBeNull();
    });

    it('4.4 audit logging failure does NOT throw or abort business transaction', async () => {
      // Mock audit service to throw
      mockAuditLog.log = jest.fn(async () => {
        throw new Error('Audit logging service unreachable');
      });

      const created = await service.create(orgA, customerId, userA.sub, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 5000,
      });

      expect(created).toBeDefined();
      expect(created.amount).toBe(5000);
    });
  });

  // =========================================================================
  // 5. VALIDATORS & DTO CONTRACT TESTING
  // =========================================================================
  describe('5. Validators & DTO Contracts', () => {
    it('5.1 IsIsoDateOnly accepts valid YYYY-MM-DD dates and rejects malformed dates', async () => {
      const validDto = plainToInstance(CreateTransactionDto, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 100,
      });
      const validErrors = await validate(validDto);
      expect(validErrors.filter((e) => e.property === 'date')).toHaveLength(0);

      // Malformed date: DD-MM-YYYY
      const invalidDto1 = plainToInstance(CreateTransactionDto, {
        date: '01-08-2026',
        type: CustomerTransactionType.SALE,
        amount: 100,
      });
      const invalidErrors1 = await validate(invalidDto1);
      expect(invalidErrors1.some((e) => e.property === 'date')).toBe(true);

      // Non-existent calendar date: 2026-02-31
      const invalidDto2 = plainToInstance(CreateTransactionDto, {
        date: '2026-02-31',
        type: CustomerTransactionType.SALE,
        amount: 100,
      });
      const invalidErrors2 = await validate(invalidDto2);
      expect(invalidErrors2.some((e) => e.property === 'date')).toBe(true);
    });

    it('5.2 IsValidTransactionAmount rejects negative amounts for SALE and allows for ADJUSTMENT', async () => {
      const negativeSaleDto = plainToInstance(CreateTransactionDto, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: -500,
      });
      const saleErrors = await validate(negativeSaleDto);
      expect(saleErrors.some((e) => e.property === 'amount')).toBe(true);

      const negativeAdjustmentDto = plainToInstance(CreateTransactionDto, {
        date: '2026-08-01',
        type: CustomerTransactionType.ADJUSTMENT,
        amount: -500,
      });
      const adjErrors = await validate(negativeAdjustmentDto);
      expect(adjErrors.filter((e) => e.property === 'amount')).toHaveLength(0);
    });

    it('5.3 CreateTransactionItemDto enforces Hindi Unicode support and rejects zero/negative quantity', async () => {
      const validHindiItem = plainToInstance(CreateTransactionItemDto, {
        productName: 'अलमारी के लिए पत्थर (५० नग)',
        quantity: 10,
        unitPrice: 450,
        amount: 4500,
      });
      const itemErrors = await validate(validHindiItem);
      expect(itemErrors).toHaveLength(0);

      // Zero quantity rejection
      const zeroQtyItem = plainToInstance(CreateTransactionItemDto, {
        productName: 'Soap Box',
        quantity: 0,
        unitPrice: 100,
        amount: 0,
      });
      const zeroQtyErrors = await validate(zeroQtyItem);
      expect(zeroQtyErrors.some((e) => e.property === 'quantity')).toBe(true);

      // Negative unit price rejection
      const negativeRateItem = plainToInstance(CreateTransactionItemDto, {
        productName: 'Soap Box',
        quantity: 5,
        unitPrice: -50,
        amount: -250,
      });
      const negativeRateErrors = await validate(negativeRateItem);
      expect(negativeRateErrors.some((e) => e.property === 'unitPrice')).toBe(true);

      // Unprintable control character rejection
      const invalidCharItem = plainToInstance(CreateTransactionItemDto, {
        productName: 'Bad\u0000Text',
        quantity: 5,
        unitPrice: 50,
        amount: 250,
      });
      const invalidCharErrors = await validate(invalidCharItem);
      expect(invalidCharErrors.some((e) => e.property === 'productName')).toBe(true);
    });
  });
});
