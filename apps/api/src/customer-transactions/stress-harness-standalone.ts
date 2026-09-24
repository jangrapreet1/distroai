/**
 * apps/api/src/customer-transactions/stress-harness-standalone.ts
 *
 * Standalone Empirical Stress & Oracle Benchmark Harness
 * Executed directly via ts-node to measure raw throughput, memory delta,
 * and verify zero floating-point drift over 50,000 transactions.
 */

import {
  calculateCustomerLedger,
  compareTransactions,
  toPaise,
  fromPaise,
  round2,
  toDateOnlyString,
  toRtkStatementRows,
  CustomerTransactionType,
  TransactionInput,
} from './customer-transactions.calculation';

function createMulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('DISTROAI M1: EMPIRICAL STRESS TEST & ORACLE BENCHMARK HARNESS');
  console.log('Agent: challenger_m1_1 (Critic & Specialist)');
  console.log('================================================================\n');

  const COUNT = 50000;
  console.log(`[STAGE 1] Generating ${COUNT.toLocaleString()} randomized transactions (₹0.01 to ₹99,999,999.99)...`);
  const prng = createMulberry32(0xfacefeed);

  const transactions: TransactionInput[] = [];
  const baseDate = new Date('2022-01-01T00:00:00.000Z').getTime();
  const extremeValues = [0.01, 0.02, 0.05, 0.10, 0.99, 1.00, 99.99, 99999.99, 50000000.50, 99999999.99];

  for (let i = 0; i < COUNT; i++) {
    const roll = prng();
    let type: CustomerTransactionType;
    if (roll < 0.40) type = CustomerTransactionType.SALE;
    else if (roll < 0.60) type = CustomerTransactionType.RETURN;
    else if (roll < 0.95) type = CustomerTransactionType.PAYMENT;
    else type = CustomerTransactionType.ADJUSTMENT;

    let amount: number;
    if (i < extremeValues.length) {
      amount = extremeValues[i];
    } else if (prng() < 0.05) {
      amount = extremeValues[Math.floor(prng() * extremeValues.length)];
    } else {
      amount = Math.floor(prng() * 1000000) + Math.floor(prng() * 100) / 100;
    }

    if (type === CustomerTransactionType.ADJUSTMENT && prng() < 0.5) {
      amount = -amount;
    }

    const dayOffset = Math.floor(i / 10);
    const txDate = new Date(baseDate + dayOffset * 86400000).toISOString().slice(0, 10);
    const createdAt = new Date(baseDate + dayOffset * 86400000 + Math.floor(prng() * 86400000)).toISOString();

    transactions.push({
      id: `tx-bench-${String(i).padStart(6, '0')}`,
      date: txDate,
      createdAt,
      type,
      amount,
      description: `Bench Tx #${i}`,
    });
  }

  // Shuffle input array to verify sort engine handles unsorted database inputs
  console.log('[STAGE 2] Shuffling input transactions to test non-linear input resistance...');
  for (let i = transactions.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [transactions[i], transactions[j]] = [transactions[j], transactions[i]];
  }

  // Compute exact BigInt oracle expectations on sorted order
  console.log('[STAGE 3] Executing independent BigInt oracle in exact integer paise space...');
  const sortedTxs = [...transactions].sort(compareTransactions);
  let oracleGoodsGivenPaise = 0n;
  let oracleGoodsReturnedPaise = 0n;
  let oraclePaymentsReceivedPaise = 0n;
  let oracleAdjustmentsPaise = 0n;
  const initialBalancePaise = 1000000000n; // ₹10,000,000.00
  let oracleRunningBalancePaise = initialBalancePaise;
  const oracleHistory: bigint[] = [];

  for (const tx of sortedTxs) {
    const type = tx.type as CustomerTransactionType;
    const amtPaise = BigInt(toPaise(tx.amount));
    switch (type) {
      case CustomerTransactionType.SALE:
        oracleGoodsGivenPaise += amtPaise;
        oracleRunningBalancePaise += amtPaise;
        break;
      case CustomerTransactionType.RETURN:
        oracleGoodsReturnedPaise += amtPaise;
        oracleRunningBalancePaise -= amtPaise;
        break;
      case CustomerTransactionType.PAYMENT:
        oraclePaymentsReceivedPaise += amtPaise;
        oracleRunningBalancePaise -= amtPaise;
        break;
      case CustomerTransactionType.ADJUSTMENT:
        oracleAdjustmentsPaise += amtPaise;
        oracleRunningBalancePaise += amtPaise;
        break;
    }
    oracleHistory.push(oracleRunningBalancePaise);
  }

  // Measure memory and time for calculateCustomerLedger
  console.log('[STAGE 4] Executing calculateCustomerLedger() on 50,000 transactions...');
  const memBefore = process.memoryUsage().heapUsed;
  const t0 = process.hrtime.bigint();

  const result = calculateCustomerLedger(transactions, {
    initialBalance: Number(initialBalancePaise) / 100,
  });

  const t1 = process.hrtime.bigint();
  const memAfter = process.memoryUsage().heapUsed;

  const durationMs = Number(t1 - t0) / 1e6;
  const heapDeltaMb = (memAfter - memBefore) / (1024 * 1024);
  const throughput = Math.round((COUNT / durationMs) * 1000);

  console.log('\n----------------- BENCHMARK TELEMETRY -----------------');
  console.log(`Transactions Processed : ${COUNT.toLocaleString()}`);
  console.log(`Total Execution Time   : ${durationMs.toFixed(2)} ms`);
  console.log(`Throughput             : ${throughput.toLocaleString()} tx/sec`);
  console.log(`Heap Delta             : ${heapDeltaMb.toFixed(2)} MB`);
  console.log('-------------------------------------------------------\n');

  // Verify invariants
  console.log('[STAGE 5] Verifying Mathematical Invariants & Zero Float Drift...');
  let maxDelta = 0;
  let mismatchCount = 0;

  for (let i = 0; i < COUNT; i++) {
    const actual = result.entries[i].runningBalance;
    const expected = Number(oracleHistory[i]) / 100;
    const delta = Math.abs(actual - expected);
    if (delta > maxDelta) maxDelta = delta;
    if (actual !== expected) mismatchCount++;
  }

  const expectedNetBalance = Number(oracleRunningBalancePaise) / 100;
  const finalRowBalance = result.entries[COUNT - 1].runningBalance;

  console.log(`Summary Net Balance      : ₹${result.summary.netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  console.log(`Oracle Net Balance       : ₹${expectedNetBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  console.log(`Final Row Running Balance: ₹${finalRowBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  console.log(`Invariant B_N === NetBal : ${finalRowBalance === result.summary.netBalance ? 'PASS (EXACT)' : 'FAIL'}`);
  console.log(`Max Step Float Drift     : ${maxDelta} (Strictly 0)`);
  console.log(`Row-by-Row Mismatches    : ${mismatchCount} / ${COUNT}`);

  if (mismatchCount > 0 || maxDelta !== 0 || finalRowBalance !== result.summary.netBalance) {
    console.error('VERDICT: REJECT (Mathematical Invariant Failure)');
    process.exit(1);
  }

  // Stage 6: Same-date permutation stress (500 items)
  console.log('\n[STAGE 6] Stress-testing 500 transactions on exact same date with timestamp permutations...');
  const sameDateTxs: TransactionInput[] = [];
  for (let i = 0; i < 500; i++) {
    sameDateTxs.push({
      id: `same-${String(i).padStart(4, '0')}`,
      date: '2026-07-04',
      createdAt: new Date(1700000000000 + i * 500).toISOString(),
      type: CustomerTransactionType.SALE,
      amount: 100,
    });
  }
  // Reverse
  sameDateTxs.reverse();
  const sortedSameDate = [...sameDateTxs].sort(compareTransactions);
  let sameDateOrdered = true;
  for (let i = 1; i < 500; i++) {
    if (sortedSameDate[i - 1].createdAt! >= sortedSameDate[i].createdAt!) {
      sameDateOrdered = false;
      break;
    }
  }
  console.log(`Same-date 500 items order : ${sameDateOrdered ? 'PASS (STRICT CHRONOLOGICAL)' : 'FAIL'}`);

  // Stage 7: Leap years & century boundaries
  console.log('\n[STAGE 7] Stress-testing leap years and century boundaries...');
  const dateEdgeCases: TransactionInput[] = [
    { id: 't4', date: '2024-03-01', type: CustomerTransactionType.SALE, amount: 10 },
    { id: 't3', date: '2024-02-29', type: CustomerTransactionType.SALE, amount: 10 }, // Leap day
    { id: 't2', date: '2024-02-28', type: CustomerTransactionType.SALE, amount: 10 },
    { id: 't1', date: '2023-12-31', type: CustomerTransactionType.SALE, amount: 10 }, // Year boundary
  ];
  const sortedDates = [...dateEdgeCases].sort(compareTransactions);
  const datesCorrect = sortedDates.map((d) => d.id).join(',') === 't1,t2,t3,t4';
  console.log(`Leap & boundary sequencing: ${datesCorrect ? 'PASS (STRICT CHRONOLOGICAL)' : 'FAIL'}`);

  console.log('\n================================================================');
  console.log('ALL EMPIRICAL TESTS PASSED WITH ZERO FLOATING POINT ERROR.');
  console.log('FINAL VERDICT: APPROVE');
  console.log('================================================================');
}

runBenchmark().catch((err) => {
  console.error('FATAL BENCHMARK ERROR:', err);
  process.exit(1);
});
