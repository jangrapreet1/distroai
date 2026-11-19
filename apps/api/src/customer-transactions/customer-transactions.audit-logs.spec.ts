import { Test, TestingModule } from '@nestjs/testing';
import { CustomerTransactionsService } from './customer-transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { RtkStatementPdfService } from './rtk-statement-pdf.service';
import { NotFoundException } from '@nestjs/common';

describe('CustomerTransactionsService - Ledger Audit Logs', () => {
  let service: CustomerTransactionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      customer: {
        findFirst: jest.fn(),
      },
      customerTransaction: {
        findMany: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerTransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        { provide: RtkStatementPdfService, useValue: { generatePdf: jest.fn() } },
      ],
    }).compile();

    service = module.get<CustomerTransactionsService>(CustomerTransactionsService);
  });

  it('1. Throws NotFoundException if customer is not found or belongs to another tenant', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);

    await expect(
      service.getLedgerAuditLogs('org-1', 'cust-other', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('2. Queries and formats UPDATE logs into human-readable description', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', name: 'Sunny Bhai' });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        orgId: 'org-1',
        userId: 'user-1',
        action: 'UPDATE',
        entityType: 'CUSTOMER_TRANSACTION',
        entityId: 'tx-100',
        oldValue: JSON.stringify({
          id: 'tx-100',
          customerId: 'cust-1',
          date: '2026-09-20',
          type: 'SALE',
          amount: 22098,
          description: '4 Packet Leveler',
        }),
        newValue: JSON.stringify({
          id: 'tx-100',
          customerId: 'cust-1',
          date: '2026-09-21',
          type: 'SALE',
          amount: 25000,
          description: '4 Packet Leveler + Extras',
        }),
        createdAt: new Date('2026-10-31T10:00:00Z'),
        user: { firstName: 'Preet', lastName: 'Distro', email: 'preet@example.com' },
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.getLedgerAuditLogs('org-1', 'cust-1', {
      transactionId: 'tx-100',
    });

    expect(result.total).toBe(1);
    expect(result.logs.length).toBe(1);

    const log = result.logs[0];
    expect(log.action).toBe('UPDATE');
    expect(log.user.name).toBe('Preet Distro');
    expect(log.summary).toContain('Amount changed from ₹22,098 to ₹25,000');
    expect(log.summary).toContain('Date moved from 2026-09-20 to 2026-09-21');
    expect(log.changes.length).toBe(3); // amount, date, description
  });

  it('3. Formats DELETE and IMPORT logs with correct plain-language summaries', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', name: 'Sunny Bhai' });
    prisma.customerTransaction.findMany.mockResolvedValue([{ id: 'tx-1' }]);
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'audit-del',
          orgId: 'org-1',
          userId: 'user-1',
          action: 'DELETE',
          entityType: 'CUSTOMER_TRANSACTION',
          entityId: 'tx-del-1',
          oldValue: JSON.stringify({
            id: 'tx-del-1',
            customerId: 'cust-1',
            type: 'PAYMENT',
            amount: 50000,
            description: 'Cash received',
          }),
          newValue: null,
          createdAt: new Date('2026-10-31T11:00:00Z'),
          firstName: 'Preet',
          lastName: '',
          email: 'preet@example.com',
        },
        {
          id: 'audit-imp',
          orgId: 'org-1',
          userId: 'user-1',
          action: 'IMPORT',
          entityType: 'CUSTOMER_KHATA_IMPORT',
          entityId: 'cust-1',
          oldValue: JSON.stringify({ previousOutstanding: 0 }),
          newValue: JSON.stringify({
            importedTransactionsCount: 23,
            newOutstandingAmount: 99597,
          }),
          createdAt: new Date('2026-10-30T15:00:00Z'),
          firstName: 'Preet',
          lastName: '',
          email: 'preet@example.com',
        },
      ])
      .mockResolvedValueOnce([{ count: BigInt(2) }]);

    const result = await service.getLedgerAuditLogs('org-1', 'cust-1');

    expect(result.total).toBe(2);
    expect(result.logs[0].action).toBe('DELETE');
    expect(result.logs[0].summary).toBe('Deleted PAYMENT of ₹50,000 (Cash received)');

    expect(result.logs[1].action).toBe('IMPORT');
    expect(result.logs[1].summary).toBe('Imported 23 transactions from document');
  });
});
