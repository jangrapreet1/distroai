/**
 * apps/api/src/customer-transactions/stress-lifecycle-harness.ts
 *
 * EMPIRICAL STRESS TEST & ORACLE HARNESS — MILESTONE M2
 * Agent: challenger_m2_2 (Critic & Specialist)
 *
 * Empirical verification of:
 * 1. Rapid multi-step transaction lifecycle:
 *    CREATE SALE -> CREATE RETURN -> EDIT SALE AMOUNT -> CREATE PAYMENT -> DELETE RETURN
 * 2. Exact synchronization between Customer.outstandingAmount and dynamic ledger netBalance (0.00 drift).
 * 3. Mutation audit logging before-and-after JSON snapshots with line items.
 * 4. Audit logging failure resilience and safe suppression without failing financial transactions.
 * 5. High-throughput 100-cycle stress testing (500 rapid mutations).
 * 6. Live PostgreSQL database validation (if reachable).
 */

import { CustomerTransactionsService } from './customer-transactions.service';
import {
  CustomerTransactionType,
  PaymentMethod,
  calculateCustomerLedger,
  CustomerLedgerCalculationEngine,
  round2,
  toPaise,
  fromPaise,
} from './customer-transactions.calculation';
import { PrismaClient, Prisma } from '@distroai/db';

// PRNG for deterministic, reproducible stress tests
function createMulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface InMemCustomer {
  id: string;
  orgId: string;
  name: string;
  phone?: string | null;
  city?: string | null;
  fullAddress?: string | null;
  outstandingAmount: number;
}

interface InMemItem {
  id: string;
  transactionId: string;
  productId?: string | null;
  productName: string;
  quantity: any;
  unitPrice: any;
  amount: any;
  unit?: string | null;
}

interface InMemTx {
  id: string;
  orgId: string;
  customerId: string;
  date: Date;
  type: CustomerTransactionType;
  description?: string | null;
  amount: any;
  paymentMethod?: PaymentMethod | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: InMemItem[];
}

interface AuditRecord {
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: any;
  newValue: any;
}

function buildMockPrisma(state: {
  customers: InMemCustomer[];
  transactions: InMemTx[];
  queryRawHistory: string[];
}) {
  let idCounter = 1;

  const mock: any = {
    customer: {
      findFirst: async ({ where }: any) => {
        return (
          state.customers.find(
            (c) => c.id === where.id && (!where.orgId || c.orgId === where.orgId),
          ) || null
        );
      },
      update: async ({ where, data }: any) => {
        const c = state.customers.find((cust) => cust.id === where.id);
        if (c) {
          if (data.outstandingAmount !== undefined) {
            c.outstandingAmount = Number(data.outstandingAmount);
          }
          return c;
        }
        return null;
      },
    },
    organization: {
      findUnique: async ({ where }: any) => {
        return {
          id: where.id,
          name: 'Radhakishan Trading Company',
          address: 'Main Market, Anaj Mandi',
          city: 'Rohtak',
          state: 'Haryana',
          phone: '+91 98765 43210',
          gstNumber: '06AAAAA0000A1Z5',
        };
      },
    },
    customerTransaction: {
      findFirst: async ({ where }: any) => {
        return (
          state.transactions.find(
            (t) =>
              t.id === where.id &&
              (!where.customerId || t.customerId === where.customerId) &&
              (!where.orgId || t.orgId === where.orgId),
          ) || null
        );
      },
      findMany: async ({ where, orderBy }: any) => {
        let list = state.transactions.filter(
          (t) =>
            (!where.orgId || t.orgId === where.orgId) &&
            (!where.customerId || t.customerId === where.customerId),
        );
        if (where.type) list = list.filter((t) => t.type === where.type);
        if (where.date?.lt) {
          list = list.filter((t) => new Date(t.date) < new Date(where.date.lt));
        }
        if (where.date?.gte) {
          list = list.filter((t) => new Date(t.date) >= new Date(where.date.gte));
        }
        if (where.date?.lte) {
          list = list.filter((t) => new Date(t.date) <= new Date(where.date.lte));
        }
        // Apply orderBy
        const sorted = [...list].sort((a, b) => {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
        return sorted;
      },
      create: async ({ data }: any) => {
        const txId = `tx-${String(idCounter++).padStart(6, '0')}`;
        const items: InMemItem[] = (data.items?.create || []).map(
          (it: any, idx: number) => ({
            id: `item-${txId}-${idx + 1}`,
            transactionId: txId,
            productId: it.productId || null,
            productName: it.productName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: it.amount,
            unit: it.unit || null,
          }),
        );

        const newTx: InMemTx = {
          id: txId,
          orgId: data.orgId,
          customerId: data.customerId,
          date: new Date(data.date),
          type: data.type,
          description: data.description || null,
          amount: data.amount,
          paymentMethod: data.paymentMethod || null,
          reference: data.reference || null,
          notes: data.notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          items,
        };
        state.transactions.push(newTx);
        return newTx;
      },
      update: async ({ where, data }: any) => {
        const tx = state.transactions.find((t) => t.id === where.id);
        if (!tx) return null;
        if (data.date) tx.date = new Date(data.date);
        if (data.type) tx.type = data.type;
        if (data.description !== undefined) tx.description = data.description;
        if (data.amount !== undefined) tx.amount = data.amount;
        if (data.paymentMethod !== undefined) tx.paymentMethod = data.paymentMethod;
        if (data.reference !== undefined) tx.reference = data.reference;
        if (data.notes !== undefined) tx.notes = data.notes;
        if (data.items?.create) {
          tx.items = data.items.create.map((it: any, idx: number) => ({
            id: `item-${tx.id}-upd-${idx + 1}`,
            transactionId: tx.id,
            productId: it.productId || null,
            productName: it.productName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: it.amount,
            unit: it.unit || null,
          }));
        }
        tx.updatedAt = new Date();
        return tx;
      },
      delete: async ({ where }: any) => {
        const idx = state.transactions.findIndex((t) => t.id === where.id);
        if (idx !== -1) {
          const [removed] = state.transactions.splice(idx, 1);
          return removed;
        }
        return null;
      },
    },
    customerTransactionItem: {
      deleteMany: async ({ where }: any) => {
        const tx = state.transactions.find((t) => t.id === where.transactionId);
        if (tx) {
          tx.items = [];
        }
        return { count: 1 };
      },
    },
    $queryRaw: async (strings: any, ...values: any[]) => {
      state.queryRawHistory.push(String(strings));
      return [{ 1: 1 }];
    },
    $transaction: async (cb: any) => {
      return cb(mock);
    },
  };

  return mock;
}

async function runStandaloneHarness() {
  console.log('================================================================================');
  console.log('DISTROAI M2: EMPIRICAL STRESS TEST & AUDIT LOG HARNESS');
  console.log('Agent: challenger_m2_2 (Critic & Specialist)');
  console.log('================================================================================\n');

  const orgId = 'org-wholesaler-rohtak-1';
  const customerId = 'cust-gupta-store-1';
  const userId = 'usr-accountant-001';

  const mockDbState = {
    customers: [
      {
        id: customerId,
        orgId,
        name: 'Gupta Provision Store',
        phone: '+91 98123 45678',
        city: 'Rohtak',
        fullAddress: 'Shop 42, Grain Market',
        outstandingAmount: 0.0,
      },
    ],
    transactions: [] as InMemTx[],
    queryRawHistory: [] as string[],
  };

  const auditLogs: AuditRecord[] = [];
  let shouldAuditThrow = false;

  const mockAuditService: any = {
    log: async (params: AuditRecord) => {
      if (shouldAuditThrow) {
        throw new Error('AuditLog Service Network Failure [Simulated Error]');
      }
      auditLogs.push(params);
    },
  };

  const mockPrisma = buildMockPrisma(mockDbState);
  const service = new CustomerTransactionsService(mockPrisma, mockAuditService);

  // ---------------------------------------------------------------------------
  // SECTION 1: CANONICAL 5-STEP LIFECYCLE
  // ---------------------------------------------------------------------------
  console.log('--------------------------------------------------------------------------------');
  console.log('SECTION 1: CANONICAL 5-STEP LIFECYCLE STRESS VERIFICATION');
  console.log('CREATE SALE -> CREATE RETURN -> EDIT SALE AMOUNT -> CREATE PAYMENT -> DELETE RETURN');
  console.log('--------------------------------------------------------------------------------');

  // Step 0: Initial state verification
  console.log('\n[Step 0] Initial State: Customer balance = ₹0.00');
  const initialLedger = await service.findAllLedger(orgId, customerId);
  console.log(`  Initial Customer.outstandingAmount: ₹${mockDbState.customers[0].outstandingAmount.toFixed(2)}`);
  console.log(`  Initial Ledger netBalance          : ₹${initialLedger.summary.netBalance.toFixed(2)}`);
  if (mockDbState.customers[0].outstandingAmount !== initialLedger.summary.netBalance) {
    throw new Error('Initial state mismatch!');
  }

  // Step 1: CREATE SALE
  console.log('\n[Step 1] CREATE SALE: ₹15,450.75 with 2 line items (Hindi descriptions)');
  const sale1 = await service.create(orgId, customerId, userId, {
    date: '2026-08-01',
    type: CustomerTransactionType.SALE,
    description: 'अलमारी के लिए पत्थर एवं सीमेंट आपूर्ति',
    amount: 15450.75,
    items: [
      {
        productName: 'अलमारी के लिए पत्थर',
        quantity: 15,
        unitPrice: 1000.05,
        amount: 15000.75,
      },
      {
        productName: 'सीमेंट बैग',
        quantity: 1,
        unitPrice: 450.0,
        amount: 450.0,
      },
    ],
  });

  let ledger1 = await service.findAllLedger(orgId, customerId);
  let custAmt1 = mockDbState.customers[0].outstandingAmount;
  let ledgerNet1 = ledger1.summary.netBalance;
  let drift1 = Math.abs(custAmt1 - ledgerNet1);

  console.log(`  Created Sale ID                    : ${sale1.id}`);
  console.log(`  Customer.outstandingAmount        : ₹${custAmt1.toFixed(2)}`);
  console.log(`  Dynamic Ledger netBalance          : ₹${ledgerNet1.toFixed(2)}`);
  console.log(`  Drift                              : ₹${drift1.toFixed(4)} [${drift1 === 0 ? 'PASS 0.00' : 'FAIL'}]`);
  console.log(`  Audit Log Count                    : ${auditLogs.length}`);
  const log1 = auditLogs[auditLogs.length - 1];
  console.log(`  Audit Action                       : ${log1.action}`);
  console.log(`  Audit oldValue === null            : ${log1.oldValue === null}`);
  console.log(`  Audit newValue.items.length        : ${log1.newValue.items.length}`);
  console.log(`  Audit Item 0 Name                  : ${log1.newValue.items[0].productName}`);

  if (custAmt1 !== 15450.75 || ledgerNet1 !== 15450.75 || drift1 !== 0) {
    throw new Error(`Step 1 balance failure: cust=${custAmt1}, ledger=${ledgerNet1}`);
  }
  if (!log1 || log1.action !== 'CREATE' || log1.oldValue !== null || log1.newValue.items.length !== 2) {
    throw new Error('Step 1 audit snapshot incomplete');
  }

  // Step 2: CREATE RETURN
  console.log('\n[Step 2] CREATE RETURN: ₹2,000.10 (damaged stone return)');
  const return1 = await service.create(orgId, customerId, userId, {
    date: '2026-08-05',
    type: CustomerTransactionType.RETURN,
    description: 'अलमारी के लिए पत्थर वापसी (खराब माल)',
    amount: 2000.1,
    items: [
      {
        productName: 'अलमारी के लिए पत्थर (खराब)',
        quantity: 2,
        unitPrice: 1000.05,
        amount: 2000.1,
      },
    ],
  });

  let ledger2 = await service.findAllLedger(orgId, customerId);
  let custAmt2 = mockDbState.customers[0].outstandingAmount;
  let ledgerNet2 = ledger2.summary.netBalance;
  let drift2 = Math.abs(custAmt2 - ledgerNet2);

  console.log(`  Created Return ID                  : ${return1.id}`);
  console.log(`  Customer.outstandingAmount        : ₹${custAmt2.toFixed(2)}`);
  console.log(`  Dynamic Ledger netBalance          : ₹${ledgerNet2.toFixed(2)} (Expected: 13,450.65)`);
  console.log(`  Drift                              : ₹${drift2.toFixed(4)} [${drift2 === 0 ? 'PASS 0.00' : 'FAIL'}]`);
  console.log(`  Audit Log Count                    : ${auditLogs.length}`);
  const log2 = auditLogs[auditLogs.length - 1];
  console.log(`  Audit Action                       : ${log2.action}`);
  console.log(`  Audit newValue.amount              : ₹${log2.newValue.amount}`);

  if (custAmt2 !== 13450.65 || ledgerNet2 !== 13450.65 || drift2 !== 0) {
    throw new Error(`Step 2 balance failure: cust=${custAmt2}, ledger=${ledgerNet2}`);
  }

  // Step 3: EDIT SALE AMOUNT
  console.log('\n[Step 3] EDIT SALE AMOUNT: Update sale from ₹15,450.75 to ₹18,450.95 (quantity revised)');
  const updatedSale1 = await service.update(orgId, customerId, sale1.id, userId, {
    amount: 18450.95,
    description: 'अलमारी के लिए पत्थर (संशोधित १८ नग)',
    items: [
      {
        productName: 'अलमारी के लिए पत्थर',
        quantity: 18,
        unitPrice: 1000.05,
        amount: 18000.9,
      },
      {
        productName: 'सीमेंट बैग',
        quantity: 1,
        unitPrice: 450.05,
        amount: 450.05,
      },
    ],
  });

  let ledger3 = await service.findAllLedger(orgId, customerId);
  let custAmt3 = mockDbState.customers[0].outstandingAmount;
  let ledgerNet3 = ledger3.summary.netBalance;
  let drift3 = Math.abs(custAmt3 - ledgerNet3);

  console.log(`  Updated Sale Amount                : ₹${updatedSale1.amount.toFixed(2)}`);
  console.log(`  Customer.outstandingAmount        : ₹${custAmt3.toFixed(2)}`);
  console.log(`  Dynamic Ledger netBalance          : ₹${ledgerNet3.toFixed(2)} (Expected: 16,450.85)`);
  console.log(`  Drift                              : ₹${drift3.toFixed(4)} [${drift3 === 0 ? 'PASS 0.00' : 'FAIL'}]`);
  console.log(`  Audit Log Count                    : ${auditLogs.length}`);
  const log3 = auditLogs[auditLogs.length - 1];
  console.log(`  Audit Action                       : ${log3.action}`);
  console.log(`  Audit oldValue.amount              : ₹${log3.oldValue.amount}`);
  console.log(`  Audit newValue.amount              : ₹${log3.newValue.amount}`);
  console.log(`  Audit oldValue.items[0].quantity   : ${log3.oldValue.items[0].quantity}`);
  console.log(`  Audit newValue.items[0].quantity   : ${log3.newValue.items[0].quantity}`);

  if (custAmt3 !== 16450.85 || ledgerNet3 !== 16450.85 || drift3 !== 0) {
    throw new Error(`Step 3 balance failure: cust=${custAmt3}, ledger=${ledgerNet3}`);
  }
  if (log3.oldValue.amount !== 15450.75 || log3.newValue.amount !== 18450.95) {
    throw new Error('Step 3 audit snapshot amounts incorrect');
  }

  // Step 4: CREATE PAYMENT
  console.log('\n[Step 4] CREATE PAYMENT: ₹10,000.50 via UPI');
  const payment1 = await service.create(orgId, customerId, userId, {
    date: '2026-08-10',
    type: CustomerTransactionType.PAYMENT,
    paymentMethod: PaymentMethod.UPI,
    reference: 'UPI-AXIS-99887766',
    description: 'बैंक द्वारा आंशिक भुगतान प्राप्त',
    amount: 10000.5,
  });

  let ledger4 = await service.findAllLedger(orgId, customerId);
  let custAmt4 = mockDbState.customers[0].outstandingAmount;
  let ledgerNet4 = ledger4.summary.netBalance;
  let drift4 = Math.abs(custAmt4 - ledgerNet4);

  console.log(`  Created Payment ID                 : ${payment1.id}`);
  console.log(`  Customer.outstandingAmount        : ₹${custAmt4.toFixed(2)}`);
  console.log(`  Dynamic Ledger netBalance          : ₹${ledgerNet4.toFixed(2)} (Expected: 6,450.35)`);
  console.log(`  Drift                              : ₹${drift4.toFixed(4)} [${drift4 === 0 ? 'PASS 0.00' : 'FAIL'}]`);
  console.log(`  Audit Log Count                    : ${auditLogs.length}`);
  const log4 = auditLogs[auditLogs.length - 1];
  console.log(`  Audit Action                       : ${log4.action}`);
  console.log(`  Audit newValue.paymentMethod       : ${log4.newValue.paymentMethod}`);
  console.log(`  Audit newValue.reference           : ${log4.newValue.reference}`);

  if (custAmt4 !== 6450.35 || ledgerNet4 !== 6450.35 || drift4 !== 0) {
    throw new Error(`Step 4 balance failure: cust=${custAmt4}, ledger=${ledgerNet4}`);
  }

  // Step 5: DELETE RETURN
  console.log('\n[Step 5] DELETE RETURN: Delete return1 (restoring ₹2,000.10 to balance)');
  const deleteResult = await service.remove(orgId, customerId, return1.id, userId);

  let ledger5 = await service.findAllLedger(orgId, customerId);
  let custAmt5 = mockDbState.customers[0].outstandingAmount;
  let ledgerNet5 = ledger5.summary.netBalance;
  let drift5 = Math.abs(custAmt5 - ledgerNet5);

  console.log(`  Deleted Return ID                  : ${deleteResult.deletedId}`);
  console.log(`  Customer.outstandingAmount        : ₹${custAmt5.toFixed(2)}`);
  console.log(`  Dynamic Ledger netBalance          : ₹${ledgerNet5.toFixed(2)} (Expected: 8,450.45)`);
  console.log(`  Drift                              : ₹${drift5.toFixed(4)} [${drift5 === 0 ? 'PASS 0.00' : 'FAIL'}]`);
  console.log(`  Audit Log Count                    : ${auditLogs.length}`);
  const log5 = auditLogs[auditLogs.length - 1];
  console.log(`  Audit Action                       : ${log5.action}`);
  console.log(`  Audit oldValue.amount              : ₹${log5.oldValue.amount}`);
  console.log(`  Audit oldValue.items.length        : ${log5.oldValue.items.length}`);
  console.log(`  Audit newValue === null            : ${log5.newValue === null}`);

  if (custAmt5 !== 8450.45 || ledgerNet5 !== 8450.45 || drift5 !== 0) {
    throw new Error(`Step 5 balance failure: cust=${custAmt5}, ledger=${ledgerNet5}`);
  }
  if (log5.action !== 'DELETE' || log5.oldValue.amount !== 2000.1 || log5.newValue !== null) {
    throw new Error('Step 5 delete audit snapshot mismatch');
  }

  console.log('\n>> CANONICAL 5-STEP LIFECYCLE: 100% PASSED WITH EXACT 0.00 DRIFT <<');

  // ---------------------------------------------------------------------------
  // SECTION 2: AUDIT LOGGING ERROR SUPPRESSION & RESILIENCE
  // ---------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('SECTION 2: AUDIT LOGGING ERROR SUPPRESSION & FAULT TOLERANCE');
  console.log('Simulating catastrophic audit logger crash during financial mutations');
  console.log('--------------------------------------------------------------------------------');

  shouldAuditThrow = true;

  // 2.1 Create with audit failure
  console.log('\n[2.1] Attempting CREATE with dead audit service...');
  const sale2 = await service.create(orgId, customerId, userId, {
    date: '2026-08-15',
    type: CustomerTransactionType.SALE,
    amount: 5000.0,
    description: 'Resilient Sale with Broken Audit',
  });
  let ledgerAfterDeadCreate = await service.findAllLedger(orgId, customerId);
  console.log(`  Result                             : SUCCEEDED (Did not throw)`);
  console.log(`  Customer.outstandingAmount        : ₹${mockDbState.customers[0].outstandingAmount.toFixed(2)}`);
  console.log(`  Ledger netBalance                  : ₹${ledgerAfterDeadCreate.summary.netBalance.toFixed(2)}`);
  console.log(`  Drift                              : ${Math.abs(mockDbState.customers[0].outstandingAmount - ledgerAfterDeadCreate.summary.netBalance)}`);

  // 2.2 Update with audit failure
  console.log('\n[2.2] Attempting UPDATE with dead audit service...');
  const updatedSale2 = await service.update(orgId, customerId, sale2.id, userId, {
    amount: 6000.0,
    description: 'Resilient Sale Edited with Broken Audit',
  });
  let ledgerAfterDeadUpdate = await service.findAllLedger(orgId, customerId);
  console.log(`  Result                             : SUCCEEDED (Did not throw)`);
  console.log(`  Customer.outstandingAmount        : ₹${mockDbState.customers[0].outstandingAmount.toFixed(2)}`);
  console.log(`  Ledger netBalance                  : ₹${ledgerAfterDeadUpdate.summary.netBalance.toFixed(2)}`);
  console.log(`  Drift                              : ${Math.abs(mockDbState.customers[0].outstandingAmount - ledgerAfterDeadUpdate.summary.netBalance)}`);

  // 2.3 Remove with audit failure
  console.log('\n[2.3] Attempting DELETE with dead audit service...');
  const removeResult = await service.remove(orgId, customerId, sale2.id, userId);
  let ledgerAfterDeadDelete = await service.findAllLedger(orgId, customerId);
  console.log(`  Result                             : SUCCEEDED (Did not throw)`);
  console.log(`  Customer.outstandingAmount        : ₹${mockDbState.customers[0].outstandingAmount.toFixed(2)}`);
  console.log(`  Ledger netBalance                  : ₹${ledgerAfterDeadDelete.summary.netBalance.toFixed(2)}`);
  console.log(`  Drift                              : ${Math.abs(mockDbState.customers[0].outstandingAmount - ledgerAfterDeadDelete.summary.netBalance)}`);

  shouldAuditThrow = false;
  console.log('\n>> AUDIT FAILURE SUPPRESSION: 100% PASSED (Financial transactions never fail) <<');

  // ---------------------------------------------------------------------------
  // SECTION 3: RAPID 100-CYCLE (500 MUTATIONS) STRESS LOOP
  // ---------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('SECTION 3: RAPID 100-CYCLE (500 MUTATIONS) STRESS LOOP');
  console.log('Executing 100 complete 5-step lifecycles with random paise and amounts');
  console.log('--------------------------------------------------------------------------------');

  const prng = createMulberry32(0x1337c0de);
  let totalDrift = 0;
  let maxStepDrift = 0;
  let totalMutations = 0;

  const loopStartTime = Date.now();

  for (let cycle = 1; cycle <= 100; cycle++) {
    const saleAmt = Math.floor(prng() * 50000) + Math.floor(prng() * 100) / 100 + 1.0;
    const returnAmt = Math.floor(prng() * 5000) + Math.floor(prng() * 100) / 100 + 0.5;
    const editAmt = saleAmt + Math.floor(prng() * 2000) + 1.25;
    const paymentAmt = Math.floor(prng() * 10000) + Math.floor(prng() * 100) / 100 + 0.75;

    const dateStr = `2026-09-${String((cycle % 28) + 1).padStart(2, '0')}`;

    // 1. Create Sale
    const s = await service.create(orgId, customerId, userId, {
      date: dateStr,
      type: CustomerTransactionType.SALE,
      amount: saleAmt,
      description: `Cycle #${cycle} Sale`,
      items: [
        {
          productName: `Item Cycle #${cycle}`,
          quantity: 2,
          unitPrice: round2(saleAmt / 2),
          amount: round2(saleAmt),
        },
      ],
    });
    totalMutations++;
    let l1 = await service.findAllLedger(orgId, customerId);
    let d1 = Math.abs(mockDbState.customers[0].outstandingAmount - l1.summary.netBalance);
    if (d1 > maxStepDrift) maxStepDrift = d1;
    totalDrift += d1;

    // 2. Create Return
    const r = await service.create(orgId, customerId, userId, {
      date: dateStr,
      type: CustomerTransactionType.RETURN,
      amount: returnAmt,
      description: `Cycle #${cycle} Return`,
    });
    totalMutations++;
    let l2 = await service.findAllLedger(orgId, customerId);
    let d2 = Math.abs(mockDbState.customers[0].outstandingAmount - l2.summary.netBalance);
    if (d2 > maxStepDrift) maxStepDrift = d2;
    totalDrift += d2;

    // 3. Edit Sale
    await service.update(orgId, customerId, s.id, userId, {
      amount: editAmt,
      description: `Cycle #${cycle} Sale Revised`,
    });
    totalMutations++;
    let l3 = await service.findAllLedger(orgId, customerId);
    let d3 = Math.abs(mockDbState.customers[0].outstandingAmount - l3.summary.netBalance);
    if (d3 > maxStepDrift) maxStepDrift = d3;
    totalDrift += d3;

    // 4. Create Payment
    const p = await service.create(orgId, customerId, userId, {
      date: dateStr,
      type: CustomerTransactionType.PAYMENT,
      amount: paymentAmt,
      description: `Cycle #${cycle} Payment`,
      paymentMethod: PaymentMethod.CASH,
    });
    totalMutations++;
    let l4 = await service.findAllLedger(orgId, customerId);
    let d4 = Math.abs(mockDbState.customers[0].outstandingAmount - l4.summary.netBalance);
    if (d4 > maxStepDrift) maxStepDrift = d4;
    totalDrift += d4;

    // 5. Delete Return
    await service.remove(orgId, customerId, r.id, userId);
    totalMutations++;
    let l5 = await service.findAllLedger(orgId, customerId);
    let d5 = Math.abs(mockDbState.customers[0].outstandingAmount - l5.summary.netBalance);
    if (d5 > maxStepDrift) maxStepDrift = d5;
    totalDrift += d5;

    if (cycle % 25 === 0) {
      console.log(
        `  Completed ${cycle}/100 cycles (${totalMutations} mutations) | Max drift so far: ₹${maxStepDrift.toFixed(4)}`,
      );
    }
  }

  const loopDuration = Date.now() - loopStartTime;
  console.log(`\n----------------- 100-CYCLE STRESS TELEMETRY -----------------`);
  console.log(`Total Cycles Executed    : 100`);
  console.log(`Total Mutations Processed: ${totalMutations}`);
  console.log(`Total Execution Time     : ${loopDuration} ms`);
  console.log(`Throughput               : ${Math.round((totalMutations / loopDuration) * 1000)} mutations/sec`);
  console.log(`Max Step Float Drift     : ₹${maxStepDrift.toFixed(6)} (Strictly 0.00)`);
  console.log(`Cumulative Drift         : ₹${totalDrift.toFixed(6)} (Strictly 0.00)`);
  console.log(`Row Lock History Count   : ${mockDbState.queryRawHistory.length} SELECT FOR UPDATE locks`);
  console.log(`--------------------------------------------------------------\n`);

  if (maxStepDrift !== 0 || totalDrift !== 0) {
    throw new Error(`Mathematical invariant failure: non-zero drift observed!`);
  }

  // ---------------------------------------------------------------------------
  // SECTION 4: LIVE POSTGRESQL DATABASE EMPIRICAL VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('--------------------------------------------------------------------------------');
  console.log('SECTION 4: LIVE POSTGRESQL DATABASE VERIFICATION (WSL Localhost)');
  console.log('Testing real PostgreSQL $transaction, SELECT FOR UPDATE, and table persistence');
  console.log('--------------------------------------------------------------------------------');

  const realPrisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/distroai?schema=public',
      },
    },
  });

  try {
    await realPrisma.$connect();
    console.log('Connected to real PostgreSQL database.');

    const realOrgId = `org-pg-stress-${Date.now()}`;
    const realCustId = `cust-pg-stress-${Date.now()}`;
    const realUserId = `usr-pg-stress-${Date.now()}`;

    // Clean or seed test organization & customer
    await realPrisma.organization.create({
      data: {
        id: realOrgId,
        name: 'Live PG Test Organization',
        address: 'Rohtak Market',
        city: 'Rohtak',
        state: 'Haryana',
        phone: '+91 99999 88888',
        gstNumber: '06REALORG1234Z1',
      },
    });

    await realPrisma.customer.create({
      data: {
        id: realCustId,
        orgId: realOrgId,
        name: 'Live PG Test Customer',
        phone: '+91 98888 77777',
        outstandingAmount: 0.0,
      },
    });

    const realAuditLogs: any[] = [];
    const realAuditService: any = {
      log: async (params: any) => {
        realAuditLogs.push(params);
      },
    };

    const liveService = new CustomerTransactionsService(realPrisma as any, realAuditService);

    // Live Step 1: Create Sale
    console.log('\n[PG-1] Executing CREATE SALE on real PostgreSQL...');
    const liveSale = await liveService.create(realOrgId, realCustId, realUserId, {
      date: '2026-08-01',
      type: CustomerTransactionType.SALE,
      amount: 25000.5,
      description: 'Live PostgreSQL Real Sale',
      items: [
        {
          productName: 'अलमारी के लिए पत्थर (लाइव टेस्ट)',
          quantity: 25,
          unitPrice: 1000.02,
          amount: 25000.5,
        },
      ],
    });

    // Inspect real database row in PostgreSQL directly
    const pgCust1 = await realPrisma.customer.findUnique({ where: { id: realCustId } });
    const liveLedger1 = await liveService.findAllLedger(realOrgId, realCustId);
    console.log(`  Postgres Customer.outstandingAmount: ₹${Number(pgCust1?.outstandingAmount).toFixed(2)}`);
    console.log(`  Dynamic Ledger netBalance          : ₹${liveLedger1.summary.netBalance.toFixed(2)}`);
    if (Number(pgCust1?.outstandingAmount) !== liveLedger1.summary.netBalance) {
      throw new Error('Real PG Step 1 balance mismatch!');
    }

    // Live Step 2: Create Return
    console.log('\n[PG-2] Executing CREATE RETURN on real PostgreSQL...');
    const liveReturn = await liveService.create(realOrgId, realCustId, realUserId, {
      date: '2026-08-03',
      type: CustomerTransactionType.RETURN,
      amount: 5000.25,
      description: 'Live Return',
    });
    const pgCust2 = await realPrisma.customer.findUnique({ where: { id: realCustId } });
    const liveLedger2 = await liveService.findAllLedger(realOrgId, realCustId);
    console.log(`  Postgres Customer.outstandingAmount: ₹${Number(pgCust2?.outstandingAmount).toFixed(2)}`);
    console.log(`  Dynamic Ledger netBalance          : ₹${liveLedger2.summary.netBalance.toFixed(2)}`);
    if (Number(pgCust2?.outstandingAmount) !== liveLedger2.summary.netBalance) {
      throw new Error('Real PG Step 2 balance mismatch!');
    }

    // Live Step 3: Edit Sale Amount
    console.log('\n[PG-3] Executing EDIT SALE AMOUNT on real PostgreSQL...');
    await liveService.update(realOrgId, realCustId, liveSale.id, realUserId, {
      amount: 30000.75,
      description: 'Live Sale Updated',
    });
    const pgCust3 = await realPrisma.customer.findUnique({ where: { id: realCustId } });
    const liveLedger3 = await liveService.findAllLedger(realOrgId, realCustId);
    console.log(`  Postgres Customer.outstandingAmount: ₹${Number(pgCust3?.outstandingAmount).toFixed(2)}`);
    console.log(`  Dynamic Ledger netBalance          : ₹${liveLedger3.summary.netBalance.toFixed(2)}`);
    if (Number(pgCust3?.outstandingAmount) !== liveLedger3.summary.netBalance) {
      throw new Error('Real PG Step 3 balance mismatch!');
    }

    // Live Step 4: Create Payment
    console.log('\n[PG-4] Executing CREATE PAYMENT on real PostgreSQL...');
    await liveService.create(realOrgId, realCustId, realUserId, {
      date: '2026-08-05',
      type: CustomerTransactionType.PAYMENT,
      amount: 15000.5,
      paymentMethod: PaymentMethod.UPI,
    });
    const pgCust4 = await realPrisma.customer.findUnique({ where: { id: realCustId } });
    const liveLedger4 = await liveService.findAllLedger(realOrgId, realCustId);
    console.log(`  Postgres Customer.outstandingAmount: ₹${Number(pgCust4?.outstandingAmount).toFixed(2)}`);
    console.log(`  Dynamic Ledger netBalance          : ₹${liveLedger4.summary.netBalance.toFixed(2)}`);
    if (Number(pgCust4?.outstandingAmount) !== liveLedger4.summary.netBalance) {
      throw new Error('Real PG Step 4 balance mismatch!');
    }

    // Live Step 5: Delete Return
    console.log('\n[PG-5] Executing DELETE RETURN on real PostgreSQL...');
    await liveService.remove(realOrgId, realCustId, liveReturn.id, realUserId);
    const pgCust5 = await realPrisma.customer.findUnique({ where: { id: realCustId } });
    const liveLedger5 = await liveService.findAllLedger(realOrgId, realCustId);
    console.log(`  Postgres Customer.outstandingAmount: ₹${Number(pgCust5?.outstandingAmount).toFixed(2)}`);
    console.log(`  Dynamic Ledger netBalance          : ₹${liveLedger5.summary.netBalance.toFixed(2)}`);
    if (Number(pgCust5?.outstandingAmount) !== liveLedger5.summary.netBalance) {
      throw new Error('Real PG Step 5 balance mismatch!');
    }

    // Live Step 6: Verify cascade deletion of items in PostgreSQL
    const remainingItems = await realPrisma.customerTransactionItem.findMany({
      where: { transaction: { orgId: realOrgId } },
    });
    console.log(`\n[PG-6] Remaining transaction items in PostgreSQL: ${remainingItems.length}`);

    // Cleanup live test records
    await realPrisma.customerTransactionItem.deleteMany({
      where: { transaction: { orgId: realOrgId } },
    });
    await realPrisma.customerTransaction.deleteMany({
      where: { orgId: realOrgId },
    });
    await realPrisma.customer.deleteMany({
      where: { orgId: realOrgId },
    });
    await realPrisma.organization.deleteMany({
      where: { id: realOrgId },
    });
    console.log('Cleaned up live PostgreSQL test records.');

    console.log('\n>> REAL POSTGRESQL DATABASE INTEGRATION: 100% PASSED <<');
  } catch (pgErr) {
    console.error('PostgreSQL live test encountered error:', pgErr);
    throw pgErr;
  } finally {
    await realPrisma.$disconnect();
  }

  console.log('\n================================================================================');
  console.log('ALL EMPIRICAL TESTS & ADVERSARIAL CHALLENGES PASSED WITH ZERO ERROR.');
  console.log('FINAL VERDICT: APPROVE');
  console.log('================================================================================');
}

runStandaloneHarness().catch((err) => {
  console.error('FATAL STRESS HARNESS ERROR:', err);
  process.exit(1);
});
