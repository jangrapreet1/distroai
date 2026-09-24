import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import {
  UNICODE_TEXT_PATTERN,
  CreateTransactionItemDto,
} from './dto/create-transaction-item.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { CustomerTransactionsService } from './customer-transactions.service';
import { CustomerTransactionsController } from './customer-transactions.controller';
import {
  CustomerTransactionType,
  PaymentMethod,
  round2,
} from './customer-transactions.calculation';

/**
 * Challenger M2 Remediation Empirical Audit Suite
 * Agent: challenger_m2_remediation
 *
 * Verifies with 100% empirical rigor:
 * 1. Defect 1: UNICODE_TEXT_PATTERN acceptance of Currency Symbols (\p{Sc}, ₹),
 *    Math Symbols (\p{Sm}, +, =, etc.), Devanagari Format chars (\p{Cf}, ZWNJ, ZWJ),
 *    and strict rejection of unprintable/control codes (\u0000, \u0007, \u001B, etc.).
 * 2. Defect 2: Partial PATCH semantics for negative amounts:
 *    - On existing ADJUSTMENT: partial PATCH { amount: -500 } succeeds and recalculates balance.
 *    - On existing SALE, RETURN, PAYMENT: partial PATCH { amount: -500 } fails closed with 400 BadRequestException.
 *    - DTO-level rejection of explicit non-ADJUSTMENT negative amounts.
 *    - Boundary checks (Decimal(12,2) limit, NaN, Infinity).
 */
describe('Challenger M2 Remediation Empirical Audit Suite', () => {
  // =========================================================================
  // DEFECT 1: UNICODE PATTERN, CURRENCY, MATH, FORMAT, AND CONTROL CHARACTERS
  // =========================================================================
  describe('Defect 1: Indian Rupee (₹), Math Signs (+, =), Devanagari ZWNJ/ZWJ & Control Characters', () => {
    it('1.1 UNICODE_TEXT_PATTERN directly accepts all required symbol categories and rejects control codes', () => {
      // Currency symbols (\p{Sc})
      expect(UNICODE_TEXT_PATTERN.test('₹')).toBe(true);
      expect(UNICODE_TEXT_PATTERN.test('₹ 450.00')).toBe(true);
      expect(UNICODE_TEXT_PATTERN.test('$100')).toBe(true);
      expect(UNICODE_TEXT_PATTERN.test('€50')).toBe(true);

      // Math symbols (\p{Sm})
      expect(UNICODE_TEXT_PATTERN.test('+')).toBe(true);
      expect(UNICODE_TEXT_PATTERN.test('=')).toBe(true);
      expect(UNICODE_TEXT_PATTERN.test('10 + 20 = 30')).toBe(true);
      expect(UNICODE_TEXT_PATTERN.test('±5%')).toBe(true);
      expect(UNICODE_TEXT_PATTERN.test('10 × 20')).toBe(true);
      expect(UNICODE_TEXT_PATTERN.test('10 ÷ 2')).toBe(true);

      // Devanagari Zero-Width Non-Joiner (U+200C) and Joiner (U+200D) (\p{Cf})
      const zwnj = '\u200C';
      const zwj = '\u200D';
      expect(UNICODE_TEXT_PATTERN.test(`क्${zwnj}त`)).toBe(true);
      expect(UNICODE_TEXT_PATTERN.test(`क्${zwj}ष`)).toBe(true);

      // Real Indian merchant strings
      const realMerchantStrings = [
        'दर: ₹४५०.०० प्रति बैग',
        'सीमेंट + बालू + बजरी',
        'साइज 10 x 12 = 120 sq ft',
        'अलमारी के लिए पत्थर',
        'राजस्थानी मकराना मार्बल (१०x१२)',
        'चौखट फिटिंग ग्रेनाइट स्लैब - ५० नग',
        'बिल सं. १०४२/२०२६',
        'डिस्काउंट: -५% (कुल ₹३५०)',
      ];
      for (const text of realMerchantStrings) {
        expect(UNICODE_TEXT_PATTERN.test(text)).toBe(true);
      }

      // Strict rejection of unprintable/control characters
      const unprintableCharacters = [
        '\u0000', // Null byte
        '\u0007', // Bell
        '\u0008', // Backspace
        '\u001B', // Escape
        '\u000C', // Form Feed
        '\u000B', // Vertical Tab
        '\u007F', // Delete
        '\u0001', // SOH
        '\u0002', // STX
        '\u0003', // ETX
        '\u0004', // EOT
        '\u0005', // ENQ
        '\u0006', // ACK
        '\u000E', // SO
        '\u000F', // SI
        '\u0010', // DLE
        '\u0011', // DC1
        '\u0012', // DC2
        '\u0013', // DC3
        '\u0014', // DC4
        '\u0015', // NAK
        '\u0016', // SYN
        '\u0017', // ETB
        '\u0018', // CAN
        '\u0019', // EM
        '\u001A', // SUB
        '\u001C', // FS
        '\u001D', // GS
        '\u001E', // RS
        '\u001F', // US
      ];
      for (const char of unprintableCharacters) {
        expect(UNICODE_TEXT_PATTERN.test(`Prefix ${char} Suffix`)).toBe(false);
      }
    });

    it('1.2 CreateTransactionItemDto validation accepts Rupee, Math, ZWNJ/ZWJ and rejects control codes', async () => {
      // Valid item with Rupee and math
      const validItem = plainToInstance(CreateTransactionItemDto, {
        productName: 'सीमेंट + बालू (दर: ₹४५० = कुल ₹९००)',
        quantity: 2,
        unitPrice: 450,
      });
      const validErrors = await validate(validItem);
      expect(validErrors).toHaveLength(0);

      // Invalid item with null byte
      const nullByteItem = plainToInstance(CreateTransactionItemDto, {
        productName: 'सीमेंट \u0000 बालू',
        quantity: 2,
        unitPrice: 450,
      });
      const nullErrors = await validate(nullByteItem);
      expect(nullErrors.some((e) => e.property === 'productName')).toBe(true);

      // Invalid item with bell control code
      const bellItem = plainToInstance(CreateTransactionItemDto, {
        productName: 'मार्बल \u0007 स्लैब',
        quantity: 1,
        unitPrice: 1000,
      });
      const bellErrors = await validate(bellItem);
      expect(bellErrors.some((e) => e.property === 'productName')).toBe(true);
    });

    it('1.3 CreateTransactionDto & UpdateTransactionDto descriptions accept Rupee/Math and reject control codes', async () => {
      const validCreate = plainToInstance(CreateTransactionDto, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 1500,
        description: 'कुल राशि = ₹१,५०० (माल + डिलीवरी)',
      });
      expect(await validate(validCreate)).toHaveLength(0);

      const invalidCreate = plainToInstance(CreateTransactionDto, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 1500,
        description: 'Attack payload \u0000 null byte',
      });
      const createErrors = await validate(invalidCreate);
      expect(createErrors.some((e) => e.property === 'description')).toBe(true);

      const validUpdate = plainToInstance(UpdateTransactionDto, {
        description: 'संशोधित विवरण: दर ₹४५० + कर = ₹५००',
      });
      expect(await validate(validUpdate)).toHaveLength(0);

      const invalidUpdate = plainToInstance(UpdateTransactionDto, {
        description: 'Escape injection \u001B[31m',
      });
      const updateErrors = await validate(invalidUpdate);
      expect(updateErrors.some((e) => e.property === 'description')).toBe(true);
    });
  });

  // =========================================================================
  // DEFECT 2: PARTIAL PATCH AMOUNT VALIDATION ACROSS ALL TRANSACTION TYPES
  // =========================================================================
  describe('Defect 2: Partial PATCH updating negative amount across transaction types', () => {
    const orgId = 'org-challenger-m2-test';
    const customerId = 'cust-challenger-m2-test';
    const userId = 'usr-challenger-m2-test';

    let mockCustomer: any;
    let mockTransactions: any[];
    let mockPrisma: any;
    let mockAuditService: any;
    let service: CustomerTransactionsService;

    beforeEach(() => {
      mockCustomer = {
        id: customerId,
        orgId,
        name: 'Empirical Challenger Store',
        phone: '+91 98765 43210',
        city: 'New Delhi',
        address: 'Chandni Chowk',
        outstandingAmount: 0,
      };

      mockTransactions = [];

      mockAuditService = {
        log: jest.fn().mockResolvedValue(undefined),
      };

      mockPrisma = {
        customer: {
          findFirst: jest.fn(async ({ where }: any) => {
            if (where.id === customerId && where.orgId === orgId) {
              return mockCustomer;
            }
            return null;
          }),
          update: jest.fn(async ({ where, data }: any) => {
            if (where.id === customerId) {
              mockCustomer.outstandingAmount = Number(data.outstandingAmount);
              return mockCustomer;
            }
            return null;
          }),
        },
        customerTransaction: {
          findFirst: jest.fn(async ({ where }: any) => {
            const tx = mockTransactions.find(
              (t) =>
                t.id === where.id &&
                t.customerId === where.customerId &&
                t.orgId === where.orgId,
            );
            return tx ? JSON.parse(JSON.stringify(tx)) : null;
          }),
          findMany: jest.fn(async ({ where, orderBy }: any) => {
            let res = mockTransactions.filter(
              (t) => t.customerId === where.customerId && t.orgId === where.orgId,
            );
            return JSON.parse(JSON.stringify(res));
          }),
          create: jest.fn(async ({ data }: any) => {
            const newTx = {
              id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              orgId: data.orgId,
              customerId: data.customerId,
              date: new Date(data.date),
              type: data.type,
              description: data.description || null,
              amount: Number(data.amount),
              paymentMethod: data.paymentMethod || null,
              reference: data.reference || null,
              notes: data.notes || null,
              createdAt: new Date(),
              updatedAt: new Date(),
              items: (data.items?.create || []).map((item: any, idx: number) => ({
                id: `item-${Date.now()}-${idx}`,
                ...item,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                amount: Number(item.amount),
              })),
            };
            mockTransactions.push(newTx);
            return JSON.parse(JSON.stringify(newTx));
          }),
          update: jest.fn(async ({ where, data }: any) => {
            const idx = mockTransactions.findIndex((t) => t.id === where.id);
            if (idx === -1) return null;
            const existing = mockTransactions[idx];
            if (data.amount !== undefined) {
              existing.amount = Number(data.amount);
            }
            if (data.type !== undefined) {
              existing.type = data.type;
            }
            if (data.description !== undefined) {
              existing.description = data.description;
            }
            existing.updatedAt = new Date();
            return JSON.parse(JSON.stringify(existing));
          }),
        },
        customerTransactionItem: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
        $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      };

      service = new CustomerTransactionsService(mockPrisma as any, mockAuditService as any);
    });

    it('2.1 DTO Layer: UpdateTransactionDto permits negative amount when type is omitted (partial PATCH)', async () => {
      const partialNegativeDto = plainToInstance(UpdateTransactionDto, {
        amount: -500,
      });
      const errors = await validate(partialNegativeDto);
      expect(errors).toHaveLength(0);
    });

    it('2.2 DTO Layer: UpdateTransactionDto permits negative amount explicitly for ADJUSTMENT', async () => {
      const explicitAdjDto = plainToInstance(UpdateTransactionDto, {
        type: CustomerTransactionType.ADJUSTMENT,
        amount: -500,
      });
      const errors = await validate(explicitAdjDto);
      expect(errors).toHaveLength(0);
    });

    it('2.3 DTO Layer: UpdateTransactionDto rejects negative amount explicitly for non-ADJUSTMENT types', async () => {
      for (const nonAdjType of [
        CustomerTransactionType.SALE,
        CustomerTransactionType.RETURN,
        CustomerTransactionType.PAYMENT,
      ]) {
        const dto = plainToInstance(UpdateTransactionDto, {
          type: nonAdjType,
          amount: -500,
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'amount')).toBe(true);
      }
    });

    it('2.4 DTO Layer: UpdateTransactionDto rejects invalid numbers (NaN, Infinity, overflow)', async () => {
      for (const badValue of [NaN, Infinity, -Infinity, 10000000000.0, -10000000000.0]) {
        const dto = plainToInstance(UpdateTransactionDto, {
          amount: badValue,
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'amount')).toBe(true);
      }
    });

    it('2.5 Service Layer: Partial PATCH { amount: -500 } on existing ADJUSTMENT succeeds and updates balance', async () => {
      // Create initial positive adjustment (+500)
      const adjTx = await service.create(orgId, customerId, userId, {
        date: '2026-08-01',
        type: CustomerTransactionType.ADJUSTMENT,
        amount: 500,
        description: 'Initial manual adjustment',
      });
      expect(adjTx.amount).toBe(500);
      expect(mockCustomer.outstandingAmount).toBe(500);

      // Partial PATCH: omit type, send only { amount: -500 }
      const updated = await service.update(orgId, customerId, adjTx.id, userId, {
        amount: -500,
      });

      expect(updated.amount).toBe(-500);
      expect(updated.type).toBe(CustomerTransactionType.ADJUSTMENT);
      // Balance must have updated from +500 to -500
      expect(mockCustomer.outstandingAmount).toBe(-500);
    });

    it('2.6 Service Layer: Partial PATCH { amount: -500 } on existing SALE fails closed with 400 BadRequestException', async () => {
      const saleTx = await service.create(orgId, customerId, userId, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 2500,
        description: 'Goods Sold',
      });
      expect(saleTx.amount).toBe(2500);

      // Attempt partial PATCH { amount: -500 } omitting type
      await expect(
        service.update(orgId, customerId, saleTx.id, userId, {
          amount: -500,
        }),
      ).rejects.toThrow(BadRequestException);

      // Data must remain completely unmodified
      const unmodified = await service.findOne(orgId, customerId, saleTx.id);
      expect(unmodified.amount).toBe(2500);
    });

    it('2.7 Service Layer: Partial PATCH { amount: -500 } on existing RETURN fails closed with 400 BadRequestException', async () => {
      const returnTx = await service.create(orgId, customerId, userId, {
        date: '2026-08-01',
        type: CustomerTransactionType.RETURN,
        amount: 800,
        description: 'Goods Returned',
      });
      expect(returnTx.amount).toBe(800);

      // Attempt partial PATCH { amount: -500 } omitting type
      await expect(
        service.update(orgId, customerId, returnTx.id, userId, {
          amount: -500,
        }),
      ).rejects.toThrow(BadRequestException);

      // Data must remain unmodified
      const unmodified = await service.findOne(orgId, customerId, returnTx.id);
      expect(unmodified.amount).toBe(800);
    });

    it('2.8 Service Layer: Partial PATCH { amount: -500 } on existing PAYMENT fails closed with 400 BadRequestException', async () => {
      const paymentTx = await service.create(orgId, customerId, userId, {
        date: '2026-08-01',
        type: CustomerTransactionType.PAYMENT,
        amount: 1500,
        description: 'Bank Payment',
      });
      expect(paymentTx.amount).toBe(1500);

      // Attempt partial PATCH { amount: -500 } omitting type
      await expect(
        service.update(orgId, customerId, paymentTx.id, userId, {
          amount: -500,
        }),
      ).rejects.toThrow(BadRequestException);

      // Data must remain unmodified
      const unmodified = await service.findOne(orgId, customerId, paymentTx.id);
      expect(unmodified.amount).toBe(1500);
    });

    it('2.9 Service Layer: Atomic balance recalculation with multi-type ledger and negative adjustment PATCH', async () => {
      // 1. SALE: 10,000 -> balance: 10,000
      await service.create(orgId, customerId, userId, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 10000,
      });

      // 2. RETURN: 2,000 -> balance: 8,000
      await service.create(orgId, customerId, userId, {
        date: '2026-08-02',
        type: CustomerTransactionType.RETURN,
        amount: 2000,
      });

      // 3. PAYMENT: 3,000 -> balance: 5,000
      await service.create(orgId, customerId, userId, {
        date: '2026-08-03',
        type: CustomerTransactionType.PAYMENT,
        amount: 3000,
      });

      // 4. ADJUSTMENT: +1,000 -> balance: 6,000
      const adj = await service.create(orgId, customerId, userId, {
        date: '2026-08-04',
        type: CustomerTransactionType.ADJUSTMENT,
        amount: 1000,
      });

      expect(mockCustomer.outstandingAmount).toBe(6000);

      // 5. Partial PATCH ADJUSTMENT to -1,500 (rebate/discount)
      // Net balance should become: 10,000 (SALE) - 2,000 (RETURN) - 3,000 (PAYMENT) + (-1,500) (ADJ) = 3,500
      await service.update(orgId, customerId, adj.id, userId, {
        amount: -1500,
      });

      expect(mockCustomer.outstandingAmount).toBe(3500);

      // Check full ledger dynamic summary
      const ledger = await service.findAllLedger(orgId, customerId, {});
      expect(ledger.summary.totalGoodsGiven).toBe(10000);
      expect(ledger.summary.totalGoodsReturned).toBe(2000);
      expect(ledger.summary.totalPaymentsReceived).toBe(3000);
      expect(ledger.summary.totalAdjustments).toBe(-1500);
      expect(ledger.summary.netBalance).toBe(3500);
    });
  });
});
