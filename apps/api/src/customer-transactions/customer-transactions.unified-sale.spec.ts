import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomerTransactionsService } from './customer-transactions.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CustomerTransactionType, PaymentMethod } from './customer-transactions.calculation';

describe('Unified Quick Sale & Khata Synchronization Spec', () => {
  const orgId = 'org-radhakishan-123';
  const customerId = 'cust-sunny-456';
  const warehouseId = 'wh-main-789';
  const productId = 'prod-roff-tile';
  const variantId = 'var-type-1';
  const userId = 'usr-admin-001';

  let mockDb: {
    customers: any[];
    warehouses: any[];
    orgSettings: any[];
    products: any[];
    variants: any[];
    variantInventories: any[];
    inventories: any[];
    inventoryTransactions: any[];
    invoices: any[];
    orders: any[];
    payments: any[];
    paymentAllocations: any[];
    ledgerEntries: any[];
    customerTransactions: any[];
  };

  let mockPrisma: any;
  let service: CustomerTransactionsService;

  beforeEach(() => {
    mockDb = {
      customers: [
        {
          id: customerId,
          orgId,
          name: 'Sunny (Retailer)',
          outstandingAmount: 0,
        },
      ],
      warehouses: [
        {
          id: warehouseId,
          orgId,
          name: 'Main Godown',
          isDefault: true,
        },
      ],
      orgSettings: [
        {
          orgId,
          invoicePrefix: 'INV',
          orderPrefix: 'ORD',
        },
      ],
      products: [
        {
          id: productId,
          orgId,
          name: 'Roff Tile Adhesive',
          sku: 'ROFF-ADH',
          gstRate: 18,
          cessRate: 0,
        },
      ],
      variants: [
        {
          id: variantId,
          productId,
          name: 'Type 1',
        },
      ],
      variantInventories: [
        {
          id: 'var-inv-1',
          orgId,
          variantId,
          warehouseId,
          quantity: 78,
          reservedQty: 0,
        },
      ],
      inventories: [
        {
          id: 'inv-1',
          orgId,
          productId,
          warehouseId,
          quantity: 78,
          reservedQty: 0,
        },
      ],
      inventoryTransactions: [],
      invoices: [],
      orders: [],
      payments: [],
      paymentAllocations: [],
      ledgerEntries: [],
      customerTransactions: [],
    };

    mockPrisma = {
      customer: {
        findFirst: jest.fn(async ({ where }: any) => {
          return mockDb.customers.find((c) => c.id === where.id && (!where.orgId || c.orgId === where.orgId)) || null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const cust = mockDb.customers.find((c) => c.id === where.id);
          if (cust) {
            Object.assign(cust, data);
            return cust;
          }
          return null;
        }),
      },
      warehouse: {
        findFirst: jest.fn(async ({ where }: any) => {
          return mockDb.warehouses.find((w) => (!where.orgId || w.orgId === where.orgId) && (!where.isDefault || w.isDefault)) || mockDb.warehouses[0] || null;
        }),
      },
      orgSettings: {
        findUnique: jest.fn(async ({ where }: any) => {
          return mockDb.orgSettings.find((s) => s.orgId === where.orgId) || null;
        }),
      },
      product: {
        findFirst: jest.fn(async ({ where }: any) => {
          return mockDb.products.find((p) => p.id === where.id && (!where.orgId || p.orgId === where.orgId)) || null;
        }),
        upsert: jest.fn(async ({ create }: any) => {
          const existing = mockDb.products.find((p) => p.sku === create.sku && p.orgId === create.orgId);
          if (existing) return existing;
          const newProd = { id: `prod-${Date.now()}`, ...create };
          mockDb.products.push(newProd);
          return newProd;
        }),
      },
      variantInventory: {
        findFirst: jest.fn(async ({ where }: any) => {
          return mockDb.variantInventories.find((v) => v.variantId === where.variantId && v.warehouseId === where.warehouseId) || null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const v = mockDb.variantInventories.find((item) => item.id === where.id);
          if (v) {
            if (data.quantity?.decrement) v.quantity -= data.quantity.decrement;
            if (data.quantity?.increment) v.quantity += data.quantity.increment;
          }
          return v;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const items = mockDb.variantInventories.filter((item) => item.variantId === where.variantId && item.warehouseId === where.warehouseId);
          for (const item of items) {
            if (data.quantity?.decrement) item.quantity -= data.quantity.decrement;
            if (data.quantity?.increment) item.quantity += data.quantity.increment;
          }
          return { count: items.length };
        }),
      },
      inventory: {
        findFirst: jest.fn(async ({ where }: any) => {
          return mockDb.inventories.find((i) => i.productId === where.productId && i.warehouseId === where.warehouseId) || null;
        }),
        create: jest.fn(async ({ data }: any) => {
          const inv = { id: `inv-${Date.now()}`, ...data };
          mockDb.inventories.push(inv);
          return inv;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const inv = mockDb.inventories.find((item) => item.id === where.id);
          if (inv) {
            if (data.quantity?.decrement) inv.quantity -= data.quantity.decrement;
            if (data.quantity?.increment) inv.quantity += data.quantity.increment;
          }
          return inv;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const items = mockDb.inventories.filter((item) => item.productId === where.productId && item.warehouseId === where.warehouseId);
          for (const item of items) {
            if (data.quantity?.decrement) item.quantity -= data.quantity.decrement;
            if (data.quantity?.increment) item.quantity += data.quantity.increment;
          }
          return { count: items.length };
        }),
      },
      inventoryTransaction: {
        create: jest.fn(async ({ data }: any) => {
          const tx = { id: `itx-${Date.now()}`, ...data };
          mockDb.inventoryTransactions.push(tx);
          return tx;
        }),
      },
      invoice: {
        count: jest.fn(async () => mockDb.invoices.length),
        create: jest.fn(async ({ data }: any) => {
          const inv = { id: `inv-${Date.now()}`, ...data };
          mockDb.invoices.push(inv);
          return inv;
        }),
        findMany: jest.fn(async ({ where }: any) => {
          return mockDb.invoices.filter((i) => (!where.orgId || i.orgId === where.orgId) && (!where.customerId || i.customerId === where.customerId));
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const inv = mockDb.invoices.find((i) => i.id === where.id);
          if (inv) Object.assign(inv, data);
          return inv;
        }),
      },
      order: {
        count: jest.fn(async () => mockDb.orders.length),
        create: jest.fn(async ({ data }: any) => {
          const ord = { id: `ord-${Date.now()}`, ...data };
          mockDb.orders.push(ord);
          return ord;
        }),
      },
      payment: {
        create: jest.fn(async ({ data }: any) => {
          const p = { id: `pmt-${Date.now()}`, ...data };
          mockDb.payments.push(p);
          return p;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const p = mockDb.payments.find((item) => item.id === where.id);
          if (p) Object.assign(p, data);
          return p;
        }),
      },
      paymentAllocation: {
        create: jest.fn(async ({ data }: any) => {
          const alloc = { id: `pa-${Date.now()}`, ...data };
          mockDb.paymentAllocations.push(alloc);
          return alloc;
        }),
      },
      ledgerEntry: {
        create: jest.fn(async ({ data }: any) => {
          const le = { id: `le-${Date.now()}`, ...data };
          mockDb.ledgerEntries.push(le);
          return le;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          const filtered = mockDb.ledgerEntries.filter((l) => (!where.orgId || l.orgId === where.orgId) && (!where.customerId || l.customerId === where.customerId));
          return filtered[filtered.length - 1] || null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const le = mockDb.ledgerEntries.find((l) => l.id === where.id);
          if (le) Object.assign(le, data);
          return le;
        }),
      },
      customerTransaction: {
        create: jest.fn(async ({ data }: any) => {
          const record = {
            id: `tx-${Date.now()}`,
            ...data,
            items: (data.items?.create || []).map((it: any, idx: number) => ({
              id: `item-${idx + 1}`,
              ...it,
            })),
          };
          mockDb.customerTransactions.push(record);
          return record;
        }),
        findMany: jest.fn(async ({ where }: any) => {
          return mockDb.customerTransactions.filter((t) => (!where.orgId || t.orgId === where.orgId) && (!where.customerId || t.customerId === where.customerId));
        }),
      },
      $queryRaw: jest.fn(async (strings: any, ...values: any[]) => {
        const query = Array.isArray(strings) ? strings.join('') : String(strings);
        if (query.includes('VariantInventory')) {
          const vi = mockDb.variantInventories.find((v) => v.variantId === values[0] && v.warehouseId === values[1]);
          return vi ? [{ id: vi.id, quantity: vi.quantity, reservedQty: vi.reservedQty }] : [];
        }
        if (query.includes('Inventory')) {
          const inv = mockDb.inventories.find((i) => i.productId === values[0] && i.warehouseId === values[1]);
          return inv ? [{ id: inv.id, quantity: inv.quantity, reservedQty: inv.reservedQty }] : [];
        }
        return [{ 1: 1 }];
      }),
      $transaction: jest.fn(async (cb: any) => {
        return cb(mockPrisma);
      }),
    };

    const mockAuditLogService = {
      log: jest.fn(async () => {}),
    };

    service = new CustomerTransactionsService(mockPrisma, mockAuditLogService as any);
  });

  it('1. Quick Sale (Goods Given): deducts variant inventory, creates delivered order, official invoice, ledger entry, and customer transaction', async () => {
    const saleResult = await service.create(orgId, customerId, userId, {
      date: '2026-08-01',
      type: CustomerTransactionType.SALE,
      amount: 4500,
      warehouseId,
      items: [
        {
          productId,
          variantId,
          productName: 'Roff Tile Adhesive (Type 1)',
          quantity: 2,
          unitPrice: 2250,
          amount: 4500,
          unit: 'BAG',
        },
      ],
    });

    expect(saleResult).toBeDefined();
    expect(saleResult.amount).toBe(4500);

    // 1. Variant Inventory must be decremented from 78 to 76
    const varInv = mockDb.variantInventories.find((v) => v.variantId === variantId);
    expect(varInv?.quantity).toBe(76);

    // 2. Inventory Transaction must be recorded with OUT and -2
    expect(mockDb.inventoryTransactions.length).toBe(1);
    expect(mockDb.inventoryTransactions[0].type).toBe('OUT');
    expect(mockDb.inventoryTransactions[0].quantity).toBe(-2);
    expect(mockDb.inventoryTransactions[0].referenceType).toBe('ORDER');

    // 3. Official Invoice must be created with status SENT
    expect(mockDb.invoices.length).toBe(1);
    const invoice = mockDb.invoices[0];
    expect(invoice.status).toBe('SENT');
    expect(invoice.totalAmount).toBe(4500);
    expect(invoice.balanceAmount).toBe(4500);

    // 4. Order must be created with status DELIVERED linked to Invoice
    expect(mockDb.orders.length).toBe(1);
    const order = mockDb.orders[0];
    expect(order.status).toBe('DELIVERED');
    expect(order.invoiceId).toBe(invoice.id);
    expect(order.netAmount).toBe(4500);

    // 5. Ledger Entry must be created with type DEBIT
    expect(mockDb.ledgerEntries.length).toBe(1);
    expect(mockDb.ledgerEntries[0].type).toBe('DEBIT');
    expect(mockDb.ledgerEntries[0].amount).toBe(4500);
    expect(mockDb.ledgerEntries[0].referenceId).toBe(invoice.id);

    // 6. Customer Outstanding Amount must be updated to 4500
    const customer = mockDb.customers.find((c) => c.id === customerId);
    expect(customer?.outstandingAmount).toBe(4500);

    // 7. Customer Transaction reference should link to invoice
    expect(saleResult.reference).toBe(invoice.invoiceNumber);
  });

  it('2. Insufficient Stock: throws BadRequestException when requested qty exceeds available stock', async () => {
    // Current stock is 78, request 100
    await expect(
      service.create(orgId, customerId, userId, {
        date: '2026-08-01',
        type: CustomerTransactionType.SALE,
        amount: 225000,
        warehouseId,
        items: [
          {
            productId,
            variantId,
            productName: 'Roff Tile Adhesive (Type 1)',
            quantity: 100,
            unitPrice: 2250,
            amount: 225000,
            unit: 'BAG',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    // Stock must remain unchanged
    const varInv = mockDb.variantInventories.find((v) => v.variantId === variantId);
    expect(varInv?.quantity).toBe(78);
  });

  it('3. Payment Received: creates Payment record, allocates to invoice, and decreases balance', async () => {
    // First make a sale of 4500
    await service.create(orgId, customerId, userId, {
      date: '2026-08-01',
      type: CustomerTransactionType.SALE,
      amount: 4500,
      warehouseId,
      items: [
        {
          productId,
          variantId,
          productName: 'Roff Tile Adhesive (Type 1)',
          quantity: 2,
          unitPrice: 2250,
          amount: 4500,
          unit: 'BAG',
        },
      ],
    });

    // Now record payment of 3000
    const paymentResult = await service.create(orgId, customerId, userId, {
      date: '2026-08-02',
      type: CustomerTransactionType.PAYMENT,
      amount: 3000,
      paymentMethod: PaymentMethod.UPI,
      reference: 'UPI-TXN-998877',
    });

    expect(paymentResult).toBeDefined();

    // 1. Payment table must have the record
    expect(mockDb.payments.length).toBe(1);
    expect(mockDb.payments[0].amount).toBe(3000);
    expect(mockDb.payments[0].method).toBe('UPI');

    // 2. Invoice should have allocated 3000, leaving 1500 balance
    const invoice = mockDb.invoices[0];
    expect(invoice.paidAmount).toBe(3000);
    expect(invoice.balanceAmount).toBe(1500);
    expect(invoice.status).toBe('PARTIAL');

    // 3. Customer outstanding balance should now be 1500 (4500 - 3000)
    const customer = mockDb.customers.find((c) => c.id === customerId);
    expect(customer?.outstandingAmount).toBe(1500);
  });

  it('4. Goods Return: increments stock, records IN inventory transaction, and credits customer balance', async () => {
    // Initial stock is 78
    const returnResult = await service.create(orgId, customerId, userId, {
      date: '2026-08-03',
      type: CustomerTransactionType.RETURN,
      amount: 2250,
      warehouseId,
      items: [
        {
          productId,
          variantId,
          productName: 'Roff Tile Adhesive (Type 1)',
          quantity: 1,
          unitPrice: 2250,
          amount: 2250,
          unit: 'BAG',
        },
      ],
    });

    expect(returnResult).toBeDefined();

    // 1. Stock should be incremented from 78 to 79
    const varInv = mockDb.variantInventories.find((v) => v.variantId === variantId);
    expect(varInv?.quantity).toBe(79);

    // 2. Inventory transaction of type RETURN
    expect(mockDb.inventoryTransactions.length).toBe(1);
    expect(mockDb.inventoryTransactions[0].type).toBe('RETURN');
    expect(mockDb.inventoryTransactions[0].quantity).toBe(1);

    // 3. LedgerEntry CREDIT recorded
    const le = mockDb.ledgerEntries.find((l) => l.type === 'CREDIT');
    expect(le).toBeDefined();
    expect(le?.amount).toBe(2250);
  });
});
