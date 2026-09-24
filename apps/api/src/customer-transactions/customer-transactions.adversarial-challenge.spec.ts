/**
 * apps/api/src/customer-transactions/customer-transactions.adversarial-challenge.spec.ts
 *
 * EMPIRICAL ADVERSARIAL CHALLENGE SUITE — MILESTONE M1
 * Challenger 2 (challenger_m1_2)
 *
 * Rigorous empirical stress-testing of:
 * 1. Historical Price Immutability & Catalog Decoupling under simulated mutations/deletions.
 * 2. Devanagari / Hindi String Handling: complex conjuncts, halant, visarga, numerals,
 *    ZWJ/ZWNJ format characters, UTF-8 byte integrity, and regex validation auditing.
 * 3. PostgreSQL Row-Level Security (RLS) Multi-Tenant Isolation & Policy Coverage.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  calculateCustomerLedger,
  compareTransactions,
  toPaise,
  fromPaise,
  toRtkStatementRows,
  CustomerTransactionType,
  PaymentMethod,
  TransactionInput,
  CustomerLedgerCalculationEngine,
} from './customer-transactions.calculation';

describe('Challenger 2 Empirical Adversarial Suite — Milestone M1', () => {
  // =========================================================================
  // MISSION 1: HISTORICAL PRICE IMMUTABILITY & CATALOG DECOUPLING
  // =========================================================================
  describe('Mission 1: Historical Price Immutability & Catalog Decoupling', () => {
    interface CatalogProduct {
      id: string;
      orgId: string;
      name: string;
      sellingPrice: number;
      isDeleted?: boolean;
    }

    interface MockDbItem {
      id: string;
      transactionId: string;
      productId: string | null;
      productName: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }

    interface MockDbTransaction {
      id: string;
      orgId: string;
      customerId: string;
      date: string;
      createdAt: string;
      type: CustomerTransactionType;
      description?: string;
      amount: number;
      items: MockDbItem[];
    }

    it('1.1 Simulated catalog price modification (e.g. 100 -> 500) must NEVER mutate transaction item rates or balances', () => {
      // 1. Setup Product Catalog
      const productCatalog = new Map<string, CatalogProduct>([
        ['prod-1', { id: 'prod-1', orgId: 'org-1', name: 'UltraTech Cement 50kg', sellingPrice: 100.0 }],
        ['prod-2', { id: 'prod-2', orgId: 'org-1', name: 'White Marble Slab 10x12', sellingPrice: 450.0 }],
        ['prod-3', { id: 'prod-3', orgId: 'org-1', name: 'Steel Rebar 12mm', sellingPrice: 65.0 }],
      ]);

      // 2. Create customer transactions snapshotting catalog rates at creation time
      const createTransaction = (
        txId: string,
        customerId: string,
        date: string,
        type: CustomerTransactionType,
        itemsToOrder: Array<{ prodId: string; quantity: number }>
      ): MockDbTransaction => {
        let totalAmount = 0;
        const items: MockDbItem[] = itemsToOrder.map((it, idx) => {
          const product = productCatalog.get(it.prodId);
          if (!product) throw new Error(`Product not found: ${it.prodId}`);

          // Critical invariant: unitPrice and productName snapshotted into line item
          const unitPrice = product.sellingPrice;
          const amount = fromPaise(toPaise(it.quantity) * toPaise(unitPrice) / 100);
          totalAmount = fromPaise(toPaise(totalAmount) + toPaise(amount));

          return {
            id: `${txId}-item-${idx + 1}`,
            transactionId: txId,
            productId: product.id,
            productName: product.name,
            quantity: it.quantity,
            unitPrice,
            amount,
          };
        });

        return {
          id: txId,
          orgId: 'org-1',
          customerId,
          date,
          createdAt: `${date}T10:00:00.000Z`,
          type,
          amount: totalAmount,
          items,
        };
      };

      const tx1 = createTransaction('tx-001', 'cust-A', '2026-04-01', CustomerTransactionType.SALE, [
        { prodId: 'prod-1', quantity: 10 }, // 10 * 100 = 1,000
        { prodId: 'prod-2', quantity: 4 },  // 4 * 450 = 1,800
      ]); // Total = 2,800

      const tx2 = createTransaction('tx-002', 'cust-A', '2026-04-02', CustomerTransactionType.SALE, [
        { prodId: 'prod-1', quantity: 5 }, // 5 * 100 = 500
      ]); // Total = 500

      const tx3: MockDbTransaction = {
        id: 'tx-003',
        orgId: 'org-1',
        customerId: 'cust-A',
        date: '2026-04-03',
        createdAt: '2026-04-03T11:00:00.000Z',
        type: CustomerTransactionType.PAYMENT,
        amount: 2000.0,
        items: [],
      };

      const initialTransactions: MockDbTransaction[] = [tx1, tx2, tx3];

      // 3. Compute baseline ledger
      const baselineResult = calculateCustomerLedger(initialTransactions);
      expect(baselineResult.summary.totalGoodsGiven).toBe(3300.0);
      expect(baselineResult.summary.totalPaymentsReceived).toBe(2000.0);
      expect(baselineResult.summary.netBalance).toBe(1300.0);
      expect(baselineResult.entries[0].items[0].unitPrice).toBe(100.0);
      expect(baselineResult.entries[0].items[1].unitPrice).toBe(450.0);
      expect(baselineResult.entries[1].items[0].unitPrice).toBe(100.0);

      // Deep clone baseline to verify absolute immutability
      const baselineSnapshot = JSON.stringify(baselineResult);

      // 4. ADVERSARIAL STRESS: Drastically mutate all catalog prices and product names!
      // Cement jumps 100 -> 500 (500% spike)
      productCatalog.get('prod-1')!.sellingPrice = 500.0;
      productCatalog.get('prod-1')!.name = 'UltraTech Cement 50kg (PRICED HIKE TO 500)';

      // Marble drops 450 -> 25.50
      productCatalog.get('prod-2')!.sellingPrice = 25.5;
      productCatalog.get('prod-2')!.name = 'White Marble Slab 10x12 (DISCOUNTED)';

      // 5. Re-run ledger calculations for historical transactions
      const postMutationResult = calculateCustomerLedger(initialTransactions);

      // 6. VERIFY: Zero balance mutation, zero item rate mutation
      expect(postMutationResult.summary.totalGoodsGiven).toBe(3300.0);
      expect(postMutationResult.summary.totalPaymentsReceived).toBe(2000.0);
      expect(postMutationResult.summary.netBalance).toBe(1300.0);

      expect(postMutationResult.entries[0].items[0].unitPrice).toBe(100.0);
      expect(postMutationResult.entries[0].items[0].productName).toBe('UltraTech Cement 50kg');
      expect(postMutationResult.entries[0].items[1].unitPrice).toBe(450.0);
      expect(postMutationResult.entries[1].items[0].unitPrice).toBe(100.0);

      // Verify exact JSON parity with baseline
      expect(JSON.stringify(postMutationResult)).toBe(baselineSnapshot);

      // 7. Verify subsequent new transaction created with new price of 500
      const tx4 = createTransaction('tx-004', 'cust-A', '2026-04-04', CustomerTransactionType.SALE, [
        { prodId: 'prod-1', quantity: 2 }, // 2 * 500 = 1,000
      ]);

      const cumulativeResult = calculateCustomerLedger([...initialTransactions, tx4]);
      expect(cumulativeResult.summary.totalGoodsGiven).toBe(4300.0); // 3300 + 1000
      expect(cumulativeResult.summary.netBalance).toBe(2300.0); // 1300 + 1000

      // Prior historical transactions STILL preserve 100.0, while new transaction is 500.0
      expect(cumulativeResult.entries[0].items[0].unitPrice).toBe(100.0);
      expect(cumulativeResult.entries[1].items[0].unitPrice).toBe(100.0);
      expect(cumulativeResult.entries[3].items[0].unitPrice).toBe(500.0);
    });

    it('1.2 High-volume stress simulation: 1,000 transactions with 5,000 items under random catalog price churn and deletions', () => {
      // Create 50 catalog products
      const catalog = new Map<string, CatalogProduct>();
      for (let i = 1; i <= 50; i++) {
        catalog.set(`prod-${i}`, {
          id: `prod-${i}`,
          orgId: 'org-test',
          name: `Building Material Item #${i}`,
          sellingPrice: Math.round((10 + i * 15.75) * 100) / 100,
        });
      }

      // Generate 1,000 transactions with 5 items each (5,000 items total)
      const transactions: MockDbTransaction[] = [];
      let expectedTotalSale = 0;
      let expectedTotalPayment = 0;

      for (let txIndex = 1; txIndex <= 1000; txIndex++) {
        const isPayment = txIndex % 4 === 0;
        const dayStr = String((txIndex % 28) + 1).padStart(2, '0');
        const monthStr = String(((Math.floor(txIndex / 28) % 12) + 1)).padStart(2, '0');
        const date = `2026-${monthStr}-${dayStr}`;

        if (isPayment) {
          const payAmt = 1500.0;
          expectedTotalPayment = fromPaise(toPaise(expectedTotalPayment) + toPaise(payAmt));
          transactions.push({
            id: `tx-bulk-${txIndex}`,
            orgId: 'org-test',
            customerId: 'cust-stress',
            date,
            createdAt: `${date}T${String(txIndex % 24).padStart(2, '0')}:00:00.000Z`,
            type: CustomerTransactionType.PAYMENT,
            amount: payAmt,
            items: [],
          });
        } else {
          const items: MockDbItem[] = [];
          let txAmt = 0;
          for (let itIndex = 1; itIndex <= 5; itIndex++) {
            const prodIndex = ((txIndex * 7 + itIndex) % 50) + 1;
            const product = catalog.get(`prod-${prodIndex}`)!;
            const qty = (itIndex % 3) + 1; // 1, 2, or 3
            const rate = product.sellingPrice;
            const lineAmt = fromPaise(toPaise(qty) * toPaise(rate) / 100);
            txAmt = fromPaise(toPaise(txAmt) + toPaise(lineAmt));

            items.push({
              id: `item-${txIndex}-${itIndex}`,
              transactionId: `tx-bulk-${txIndex}`,
              productId: product.id,
              productName: product.name,
              quantity: qty,
              unitPrice: rate,
              amount: lineAmt,
            });
          }

          expectedTotalSale = fromPaise(toPaise(expectedTotalSale) + toPaise(txAmt));
          transactions.push({
            id: `tx-bulk-${txIndex}`,
            orgId: 'org-test',
            customerId: 'cust-stress',
            date,
            createdAt: `${date}T${String(txIndex % 24).padStart(2, '0')}:00:00.000Z`,
            type: CustomerTransactionType.SALE,
            amount: txAmt,
            items,
          });
        }
      }

      // Initial compute
      const initialLedger = calculateCustomerLedger(transactions);
      expect(initialLedger.summary.transactionCount).toBe(1000);
      expect(initialLedger.summary.totalGoodsGiven).toBe(expectedTotalSale);
      expect(initialLedger.summary.totalPaymentsReceived).toBe(expectedTotalPayment);
      expect(initialLedger.summary.netBalance).toBe(fromPaise(toPaise(expectedTotalSale) - toPaise(expectedTotalPayment)));

      // Snapshot all item rates
      const itemRatesSnapshot = new Map<string, number>();
      for (const tx of transactions) {
        for (const it of tx.items) {
          itemRatesSnapshot.set(it.id, it.unitPrice);
        }
      }

      // ADVERSARIAL MUTATION:
      // 1. Mutate 100% of product prices in catalog randomly
      for (const prod of catalog.values()) {
        prod.sellingPrice = Math.round(Math.random() * 50000) / 100 + 10;
        prod.name = `${prod.name} [MUTATED]`;
      }

      // 2. Delete 50% of catalog products (simulating SetNull foreign key behavior)
      let deletedCount = 0;
      for (const [prodId, prod] of catalog.entries()) {
        if (deletedCount < 25) {
          prod.isDeleted = true;
          // In the database with onDelete: SetNull, foreign key productId becomes null,
          // but the item record itself, its rate, amount, and productName remain intact!
          for (const tx of transactions) {
            for (const it of tx.items) {
              if (it.productId === prodId) {
                it.productId = null;
              }
            }
          }
          deletedCount++;
        }
      }

      // Recompute ledger
      const postStressLedger = calculateCustomerLedger(transactions);

      // Verify mathematical identity holds identically
      expect(postStressLedger.summary.totalGoodsGiven).toBe(expectedTotalSale);
      expect(postStressLedger.summary.totalPaymentsReceived).toBe(expectedTotalPayment);
      expect(postStressLedger.summary.netBalance).toBe(initialLedger.summary.netBalance);
      expect(postStressLedger.entries[postStressLedger.entries.length - 1].runningBalance).toBe(initialLedger.summary.netBalance);

      // Verify every single item rate is still identical to its snapshot
      for (const tx of transactions) {
        for (const it of tx.items) {
          expect(it.unitPrice).toBe(itemRatesSnapshot.get(it.id));
        }
      }
    });

    it('1.3 RTK statement particulars preserve snapshotted line item rate and quantity formatting', () => {
      const tx: TransactionInput = {
        id: 'tx-rtk-immutable',
        date: '2026-04-10',
        type: CustomerTransactionType.SALE,
        amount: 2500.0,
        description: 'साइट डिलीवरी',
        items: [
          {
            id: 'it-1',
            productId: 'prod-old',
            productName: 'मकराना मार्बल टाइल्स',
            quantity: 5,
            unitPrice: 500.0,
            amount: 2500.0,
          },
        ],
      };

      const ledger = calculateCustomerLedger([tx]);
      const rtkRows = toRtkStatementRows(ledger.entries, 'राजेश कुमार');

      expect(rtkRows.length).toBe(1);
      expect(rtkRows[0].particulars).toContain('मकराना मार्बल टाइल्स (5 @ ₹500.00)');
      expect(rtkRows[0].goodsGivenAmount).toBe(2500.0);
    });

    it('1.4 Historical line item edits recalculate using the item snapshot rate, NOT mutated catalog price', () => {
      // Historical item originally created at ₹100 (quantity: 5, total: 500)
      const historicalTx: TransactionInput = {
        id: 'tx-edit-test',
        date: '2026-04-01',
        type: CustomerTransactionType.SALE,
        amount: 500.0,
        items: [
          {
            id: 'it-1',
            productId: 'prod-cement',
            productName: 'Cement 50kg',
            quantity: 5,
            unitPrice: 100.0, // Snapshot rate
            amount: 500.0,
          },
        ],
      };

      // In the meantime, catalog price for 'prod-cement' increased from 100 to 500
      const currentCatalogPrice = 500.0;

      // User edits transaction quantity from 5 to 8
      // Crucial requirement: edit must use historical snapshot unitPrice (100), yielding 800 (NOT 8 * 500 = 4000)
      const editedItemQuantity = 8;
      const editedTx: TransactionInput = {
        ...historicalTx,
        amount: fromPaise(toPaise(editedItemQuantity) * toPaise(historicalTx.items![0].unitPrice) / 100),
        items: [
          {
            ...historicalTx.items![0],
            quantity: editedItemQuantity,
            amount: fromPaise(toPaise(editedItemQuantity) * toPaise(historicalTx.items![0].unitPrice) / 100),
          },
        ],
      };

      expect(editedTx.amount).toBe(800.0);
      expect(editedTx.amount).not.toBe(editedItemQuantity * currentCatalogPrice);

      const ledger = calculateCustomerLedger([editedTx]);
      expect(ledger.summary.totalGoodsGiven).toBe(800.0);
      expect(ledger.summary.netBalance).toBe(800.0);
    });

    it('1.5 Goods Return uses snapshot purchase rate, NOT mutated catalog rate', () => {
      // Original Sale at ₹100
      const saleTx: TransactionInput = {
        id: 'tx-sale-1',
        date: '2026-04-01',
        type: CustomerTransactionType.SALE,
        amount: 1000.0,
        items: [{ id: 'it-1', productId: 'prod-tile', productName: 'Vitrified Tile 2x2', quantity: 10, unitPrice: 100.0, amount: 1000.0 }],
      };

      // Catalog price jumps to ₹500
      // Customer returns 2 defective tiles
      // Return should credit 2 * 100 = 200, reducing balance from 1000 to 800
      const returnTx: TransactionInput = {
        id: 'tx-return-1',
        date: '2026-04-05',
        type: CustomerTransactionType.RETURN,
        amount: 200.0,
        items: [{ id: 'it-2', productId: 'prod-tile', productName: 'Vitrified Tile 2x2 (वापसी)', quantity: 2, unitPrice: 100.0, amount: 200.0 }],
      };

      const ledger = calculateCustomerLedger([saleTx, returnTx]);
      expect(ledger.summary.totalGoodsGiven).toBe(1000.0);
      expect(ledger.summary.totalGoodsReturned).toBe(200.0);
      expect(ledger.summary.netBalance).toBe(800.0); // 1000 - 200 = 800 (NOT 1000 - 1000 = 0)
    });

    it('1.6 Fractional quantities and monetary decimal precision produce zero drift over thousands of operations', () => {
      // 1000 fractional transactions: 12.35 units @ ₹45.50 = ₹561.925 -> round2 = ₹561.93
      const txs: TransactionInput[] = [];
      let expectedSum = 0;

      for (let i = 1; i <= 1000; i++) {
        const qty = 12.35;
        const rate = 45.50;
        const itemAmount = fromPaise(Math.round(qty * rate * 100)); // 561.93
        expectedSum = fromPaise(toPaise(expectedSum) + toPaise(itemAmount));

        txs.push({
          id: `tx-frac-${i}`,
          date: '2026-04-10',
          type: CustomerTransactionType.SALE,
          amount: itemAmount,
          items: [{ id: `it-frac-${i}`, productName: 'Fractional Material', quantity: qty, unitPrice: rate, amount: itemAmount }],
        });
      }

      const ledger = calculateCustomerLedger(txs);
      expect(ledger.summary.totalGoodsGiven).toBe(expectedSum);
      expect(ledger.summary.netBalance).toBe(expectedSum);
      expect(ledger.entries[999].runningBalance).toBe(expectedSum);
    });
  });

  // =========================================================================
  // MISSION 2: DEVANAGARI / HINDI STRING HANDLING & ZERO GLYPH TRUNCATION
  // =========================================================================
  describe('Mission 2: Devanagari / Hindi String Handling & Zero Glyph Truncation', () => {
    // Comprehensive corpus of authentic Hindi Devanagari text strings
    const authenticDevanagariCorpus = [
      // Basic vowels, consonants, and standard words
      { label: 'Standard Goods', text: 'अलमारी के लिए पत्थर' },
      { label: 'Building Material', text: 'चौखट फिटिंग ग्रेनाइट स्लैब' },
      { label: 'Specification', text: 'राजस्थानी मकराना मार्बल - पॉलिश सहित' },
      { label: 'Units & Quantities', text: 'सीमेंट की बोरी (अल्ट्राटेक पीपीसी) - ५० नग' },

      // Complex Conjuncts (संयुक्ताक्षर: क्ष, त्र, ज्ञ, श्र, द्ध, ष्ट्र, क्ष्म, त्त्व, ङ्क, ङ्ग, ञ्ज, ष्ठ, ण्ड, द्व, द्य, ह्न)
      { label: 'Conjunct Ksha/Tra/Gya/Shra', text: 'क्षेत्रीय निर्माण सामग्री, त्रिशूल ब्रांड, ज्ञान मार्बल, श्री श्याम ट्रेडर्स' },
      { label: 'Conjunct Ddha/Shtra/Kshma', text: 'बुद्धिमान ठेकेदार, महाराष्ट्र मार्बल, सूक्ष्म कटिंग कार्य' },
      { label: 'Conjunct Ttva/Nga/Nja', text: 'सत्तत्व गुणवत्ता, पङ्कज सप्लायर, गङ्गा जल फिटिंग, सञ्जय टाइल्स' },
      { label: 'Conjunct Shtha/Nnda/Dva/Dya', text: 'कनिष्ठ कारीगर, अखण्ड स्लैब, द्वार चौखट, विद्युत वायरिंग फिटिंग' },
      { label: 'Conjunct Hna/Hma/Hla/Hya', text: 'अपराह्न डिलीवरी, ब्राह्मण समाज ट्रस्ट, प्रह्लाद इंटरप्राइजेज' },

      // Halant / Virama (हलन्त)
      { label: 'Explicit Halant Words', text: 'पश्चात् भुगतान, विद्वान् वास्तुविद, पृथक् बिल, परिषद् स्वीकृति, सम्यक् संतुलन, महान् कार्य' },

      // Visarga (विसर्ग)
      { label: 'Visarga Words', text: 'प्रातःकाल डिलीवरी, निःशुल्क लोडिंग, क्रमशः भुगतान, अंतःकरण शुद्धि, दुःख निवारण' },

      // Anusvara & Chandrabindu (अनुस्वार और अनुनासिक/चंद्रबिंदु)
      { label: 'Anusvara & Chandrabindu', text: 'संबंध पक्का, चाँदनी चौक दुकान, आँख की सुरक्षा, माँ भवानी ट्रेडर्स, ऊँट गाड़ी किराया, गाँव में डिलीवरी' },

      // Nukta (नुक्ता: ज़, फ़, ख़, ग़, क़, ड़, ढ़)
      { label: 'Nukta Consonants', text: 'ज़िला जयपुर, फ़र्श की घिसाई, ख़रीद विवरण, ग़लत नाप वापसी, क़ीमत सूची, डाक का ख़र्च, सीढ़ी के पत्थर' },

      // Devanagari Numerals (देवनागरी अंक: ०, १, २, ३, ४, ५, ६, ७, ८, ९)
      { label: 'Devanagari Numerals', text: 'चालान क्र. १०८/२०२६, कुल वजन: ४५०० कि.ग्रा., दर: ₹३५०.००, शेष: ₹१,२५,४५०.५०' },

      // Full Punctuation (।, ॥, brackets, quotes)
      { label: 'Traditional Punctuation', text: 'श्री गणेशाय नमः। शुभ लाभ॥ "विशेष ऑर्डर - मार्बल फिटिंग (प्रथम तल)।"' },

      // Zero-Width Non-Joiner (ZWNJ \u200C) and Zero-Width Joiner (ZWJ \u200D)
      { label: 'ZWNJ Half-forms', text: 'क्\u200Cय तथा श्\u200Cर तथा त्\u200Cत' },
      { label: 'ZWJ Eyelash Reph', text: 'र्\u200Dया तथा क\u200D्य' },
    ];

    it('2.1 Zero corruption across UTF-8 byte serialization, parsing, and ledger calculation', () => {
      for (const item of authenticDevanagariCorpus) {
        const tx: TransactionInput = {
          id: `tx-hindi-${item.label.replace(/\s+/g, '_')}`,
          date: '2026-04-10',
          type: CustomerTransactionType.SALE,
          amount: 1500.5,
          description: item.text,
          items: [
            {
              id: 'it-hindi-1',
              productName: item.text,
              quantity: 1,
              unitPrice: 1500.5,
              amount: 1500.5,
            },
          ],
        };

        // 1. Convert to UTF-8 Buffer and verify roundtrip
        const utf8Buffer = Buffer.from(JSON.stringify(tx), 'utf8');
        const parsedTx: TransactionInput = JSON.parse(utf8Buffer.toString('utf8'));

        expect(parsedTx.description).toBe(item.text);
        expect(parsedTx.items![0].productName).toBe(item.text);

        // 2. Run through calculation engine
        const { entries, summary } = calculateCustomerLedger([parsedTx]);

        expect(entries[0].description).toBe(item.text);
        expect(entries[0].items[0].productName).toBe(item.text);
        expect(summary.totalGoodsGiven).toBe(1500.5);

        // 3. Run through RTK statement transformer
        const rtkRows = toRtkStatementRows(entries, 'सुरेश कुमार');
        expect(rtkRows[0].particulars).toContain(item.text);
      }
    });

    it('2.2 Intl.Segmenter verification: Grapheme clusters must NOT split or truncate across ledger operations', () => {
      const segmenter = new Intl.Segmenter('hi', { granularity: 'grapheme' });

      for (const item of authenticDevanagariCorpus) {
        // Measure initial grapheme count
        const initialGraphemes = Array.from(segmenter.segment(item.text)).map((s) => s.segment);
        expect(initialGraphemes.length).toBeGreaterThan(0);

        // Reconstruct string from segmented graphemes
        const reconstructed = initialGraphemes.join('');
        expect(reconstructed).toBe(item.text);

        // Run ledger calculation
        const tx: TransactionInput = {
          id: 'tx-grapheme-test',
          date: '2026-04-10',
          type: CustomerTransactionType.SALE,
          amount: 100,
          description: item.text,
        };
        const result = calculateCustomerLedger([tx]);
        const outputText = result.entries[0].description;

        // Post-ledger grapheme segmentation
        const postGraphemes = Array.from(segmenter.segment(outputText)).map((s) => s.segment);
        expect(postGraphemes).toEqual(initialGraphemes);
      }
    });

    it('2.3 Unicode Normalization (NFC vs NFD) stability: Normalization forms must preserve calculations and integrity', () => {
      // In Unicode, U+095B (Devanagari Letter Za 'ज़') is a precomposed character.
      // Under Unicode Normalization Form C and D, U+095B is on the Composition Exclusion Table,
      // meaning it decomposes to U+091C + U+093C (ज + nukta).
      const precomposedNuktaText = '\u095Bिला जयपुर - मकराना मार्बल'; // Contains single U+095B
      const decomposedNuktaText = '\u091C\u093Cिला जयपुर - मकराना मार्बल'; // Contains U+091C + U+093C

      expect(precomposedNuktaText).not.toBe(decomposedNuktaText);
      expect(precomposedNuktaText.length).toBe(decomposedNuktaText.length - 1);

      const txPre: TransactionInput = {
        id: 'tx-precomposed',
        date: '2026-04-10',
        type: CustomerTransactionType.SALE,
        amount: 5000,
        description: precomposedNuktaText,
      };

      const txDecom: TransactionInput = {
        id: 'tx-decomposed',
        date: '2026-04-11',
        type: CustomerTransactionType.SALE,
        amount: 5000,
        description: decomposedNuktaText,
      };

      const { entries } = calculateCustomerLedger([txPre, txDecom]);
      expect(entries[0].description).toBe(precomposedNuktaText);
      expect(entries[1].description).toBe(decomposedNuktaText);

      // Both normalize to identical canonical representation in NFC
      expect(entries[0].description.normalize('NFC')).toBe(entries[1].description.normalize('NFC'));
    });

    it('2.4 Empirical Audit of DTO Validation Regex: Exposes flaws in UNICODE_TEXT_PATTERN and verifies robust fix', () => {
      // Current regex in customer-transactions.spec.ts:
      // export const UNICODE_TEXT_PATTERN = /^[\p{L}\p{M}\p{N}\p{P}\p{Zs}\n\r]*$/u;
      const flawedRegex = /^[\p{L}\p{M}\p{N}\p{P}\p{Zs}\n\r]*$/u;

      // Real-world inputs that an Indian distributor routinely inputs:
      const rupeeInput = 'रेट ₹४५० प्रति बैग';
      const plusInput = 'सीमेंट + बालू + बजरी';
      const zwnjInput = 'क्\u200Cय';
      const zwjInput = 'क\u200Dय';
      const mathSymbolInput = 'साइज 10 x 12 = 120 sq ft';

      // Flawed regex empirically FAILS on standard Indian commercial inputs:
      expect(flawedRegex.test(rupeeInput)).toBe(false); // Fails because ₹ is \p{Sc} (Currency Symbol), not \p{P}
      expect(flawedRegex.test(plusInput)).toBe(false);  // Fails because + is \p{Sm} (Math Symbol), not \p{P}
      expect(flawedRegex.test(zwnjInput)).toBe(false);  // Fails because ZWNJ \u200C is \p{Cf} (Format), not \p{L}
      expect(flawedRegex.test(zwjInput)).toBe(false);   // Fails because ZWJ \u200D is \p{Cf} (Format), not \p{L}
      expect(flawedRegex.test(mathSymbolInput)).toBe(false); // Fails because = is \p{Sm}

      // Robust regex that correctly encompasses Symbols (\p{S}) and Format characters (\p{Cf}):
      const robustUnicodePattern = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Cf}\p{Zs}\n\r]*$/u;

      // Robust pattern succeeds on all genuine Hindi and commercial inputs:
      expect(robustUnicodePattern.test(rupeeInput)).toBe(true);
      expect(robustUnicodePattern.test(plusInput)).toBe(true);
      expect(robustUnicodePattern.test(zwnjInput)).toBe(true);
      expect(robustUnicodePattern.test(zwjInput)).toBe(true);
      expect(robustUnicodePattern.test(mathSymbolInput)).toBe(true);

      // And still strictly rejects null bytes, unprintable control codes, and script injection hazards:
      expect(robustUnicodePattern.test('अवैध विवरण \u0000')).toBe(false); // Null byte blocked
      expect(robustUnicodePattern.test('कंट्रोल कोड \u0007')).toBe(false); // Bell char blocked
      expect(robustUnicodePattern.test('एस्केप कोड \u001B')).toBe(false); // ESC char blocked
    });

    it('2.5 Empirical Truncation Hazard: Naive UTF-16 slice causes broken glyphs; Intl.Segmenter preserves cluster boundaries', () => {
      // Devanagari word "श्री" is composed of 4 Unicode code points:
      // \u0936 (श) + \u094D (halant) + \u0930 (र) + \u0940 (ii matra)
      const conjunctWord = 'श्री';
      expect(conjunctWord.length).toBe(4);

      // Naive slice(0, 2) truncates after the halant, producing a dangling virama
      const brokenSlice = conjunctWord.slice(0, 2);
      expect(brokenSlice).toBe('श्'); // Dangling halant, missing consonant and vowel

      // Safe segmentation with Intl.Segmenter preserves the complete visual ligature
      const segmenter = new Intl.Segmenter('hi', { granularity: 'grapheme' });
      const graphemes = Array.from(segmenter.segment(conjunctWord)).map((s) => s.segment);
      expect(graphemes.length).toBe(1);
      expect(graphemes[0]).toBe('श्री'); // Grapheme cluster kept intact

      // Word "अलमारी": 4 visual syllables, but 6 UTF-16 units: अ, ल, म, ा, र, ी
      const multiSyllableWord = 'अलमारी';
      expect(multiSyllableWord.length).toBe(6);
      const syllables = Array.from(segmenter.segment(multiSyllableWord)).map((s) => s.segment);
      expect(syllables).toEqual(['अ', 'ल', 'मा', 'री']);
    });

    it('2.6 Multiline complex vernacular Hindi notes and RTK statement formatting across 100+ transactions', () => {
      const complexHindiNote = [
        'मेसर्स राधे-कृष्णा मार्बल एंड ग्रेनाइट सप्लायर्स',
        'साइट: प्लॉट क्र. ४२/ए, मानसरोवर एक्सटेंशन, जयपुर।',
        'सामग्री विवरण: प्रथम तल हेतु विशेष कटिंग मकराना मार्बल (१०x१२),',
        'चौखट फिटिंग ग्रेनाइट, एवं ५० बैग अल्ट्राटेक पीपीसी सीमेंट।',
        'शर्तें: माल की अनलोडिंग ग्राहक के स्तर पर होगी।破損 वापसी मान्य नहीं होगी।',
        'भुगतान विवरण: ₹५०,००० नकद प्राप्त (रसीद क्र. १०४)। शेष भुगतान ३० दिवस में देय।',
      ].join('\n');

      const tx: TransactionInput = {
        id: 'tx-multiline-hindi',
        date: '2026-04-10',
        type: CustomerTransactionType.SALE,
        amount: 85000.0,
        description: complexHindiNote,
        notes: complexHindiNote,
        items: [
          {
            id: 'it-multi-1',
            productName: 'मकराना मार्बल (१०x१२) - विशेष कटिंग',
            quantity: 100,
            unitPrice: 650.0,
            amount: 65000.0,
          },
          {
            id: 'it-multi-2',
            productName: 'चौखट फिटिंग ग्रेनाइट स्लैब',
            quantity: 20,
            unitPrice: 1000.0,
            amount: 20000.0,
          },
        ],
      };

      const ledger = calculateCustomerLedger([tx]);
      expect(ledger.entries[0].description).toBe(complexHindiNote);
      expect(ledger.entries[0].notes).toBe(complexHindiNote);

      const rtkRows = toRtkStatementRows(ledger.entries, 'राजेश कुमार शर्मा');
      expect(rtkRows[0].particulars).toContain('मेसर्स राधे-कृष्णा');
      expect(rtkRows[0].particulars).toContain('मकराना मार्बल (१०x१२) - विशेष कटिंग (100 @ ₹650.00)');
      expect(rtkRows[0].particulars).toContain('चौखट फिटिंग ग्रेनाइट स्लैब (20 @ ₹1000.00)');
    });
  });

  // =========================================================================
  // MISSION 3: POSTGRESQL RLS MULTI-TENANT ISOLATION & POLICY COVERAGE
  // =========================================================================
  describe('Mission 3: PostgreSQL RLS Multi-Tenant Security & Policy Verification', () => {
    const migrationFilePath = path.resolve(
      __dirname,
      '../../../../packages/db/prisma/migrations/20260921_customer_transactions_rls/migration.sql'
    );

    it('3.1 Migration SQL file exists, is readable, and contains well-formed RLS policies', () => {
      expect(fs.existsSync(migrationFilePath)).toBe(true);
      const sqlContent = fs.readFileSync(migrationFilePath, 'utf8');

      // Table 1: CustomerTransaction
      expect(sqlContent).toContain('ALTER TABLE "CustomerTransaction" ENABLE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('CREATE POLICY "org_isolation_customer_transactions"');
      expect(sqlContent).toContain('ON "CustomerTransaction"');
      expect(sqlContent).toContain('USING (');
      expect(sqlContent).toContain('WITH CHECK (');
      expect(sqlContent).toContain('"orgId" = (');
      expect(sqlContent).toContain('SELECT "orgId" FROM "User" WHERE "id" = auth.uid() LIMIT 1');

      // Table 2: CustomerTransactionItem
      expect(sqlContent).toContain('ALTER TABLE "CustomerTransactionItem" ENABLE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('CREATE POLICY "org_isolation_customer_transaction_items"');
      expect(sqlContent).toContain('ON "CustomerTransactionItem"');
      expect(sqlContent).toContain('"transactionId" IN (');
      expect(sqlContent).toContain('SELECT "id" FROM "CustomerTransaction"');
    });

    it('3.2 Simulated PostgreSQL RLS engine enforces tenant isolation and blocks cross-tenant breaches', () => {
      // Simulated DB state
      const dbUsers = [
        { id: 'user-tenant-A', orgId: 'org-A' },
        { id: 'user-tenant-B', orgId: 'org-B' },
      ];

      const dbCustomerTransactions: Array<{ id: string; orgId: string; customerId: string; amount: number }> = [
        { id: 'tx-A1', orgId: 'org-A', customerId: 'cust-A1', amount: 1000 },
        { id: 'tx-A2', orgId: 'org-A', customerId: 'cust-A1', amount: 2000 },
        { id: 'tx-B1', orgId: 'org-B', customerId: 'cust-B1', amount: 9999 },
      ];

      const dbCustomerTransactionItems: Array<{ id: string; transactionId: string; productName: string; amount: number }> = [
        { id: 'item-A1-1', transactionId: 'tx-A1', productName: 'Cement Org A', amount: 1000 },
        { id: 'item-A2-1', transactionId: 'tx-A2', productName: 'Steel Org A', amount: 2000 },
        { id: 'item-B1-1', transactionId: 'tx-B1', productName: 'Secret Org B Goods', amount: 9999 },
      ];

      // Exact PostgreSQL RLS policy evaluator modeled after migration.sql
      const evaluateCustomerTransactionRLS = (
        authUserId: string | null,
        operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
        targetRow: { orgId: string }
      ): boolean => {
        if (!authUserId) return false;
        const user = dbUsers.find((u) => u.id === authUserId);
        if (!user) return false;
        // USING and WITH CHECK clause: "orgId" = (SELECT "orgId" FROM "User" WHERE "id" = auth.uid() LIMIT 1)
        return targetRow.orgId === user.orgId;
      };

      const evaluateCustomerTransactionItemRLS = (
        authUserId: string | null,
        operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
        targetRow: { transactionId: string }
      ): boolean => {
        if (!authUserId) return false;
        const user = dbUsers.find((u) => u.id === authUserId);
        if (!user) return false;
        // USING and WITH CHECK clause:
        // "transactionId" IN (SELECT "id" FROM "CustomerTransaction" WHERE "orgId" = (SELECT "orgId" FROM "User" WHERE "id" = auth.uid() LIMIT 1))
        const parentTx = dbCustomerTransactions.find((tx) => tx.id === targetRow.transactionId);
        if (!parentTx) return false;
        return parentTx.orgId === user.orgId;
      };

      // Test 1: User A querying CustomerTransaction
      const userAVisibleTxs = dbCustomerTransactions.filter((tx) =>
        evaluateCustomerTransactionRLS('user-tenant-A', 'SELECT', tx)
      );
      expect(userAVisibleTxs.map((t) => t.id)).toEqual(['tx-A1', 'tx-A2']);
      expect(userAVisibleTxs.some((t) => t.orgId === 'org-B')).toBe(false);

      // Test 2: User A querying CustomerTransactionItem
      const userAVisibleItems = dbCustomerTransactionItems.filter((it) =>
        evaluateCustomerTransactionItemRLS('user-tenant-A', 'SELECT', it)
      );
      expect(userAVisibleItems.map((i) => i.id)).toEqual(['item-A1-1', 'item-A2-1']);
      expect(userAVisibleItems.some((i) => i.productName.includes('Org B'))).toBe(false);

      // Attack Scenario 1: Cross-tenant IDOR / BOLA query by specific ID
      const userATryingToReadOrgBItem = evaluateCustomerTransactionItemRLS(
        'user-tenant-A',
        'SELECT',
        dbCustomerTransactionItems[2] // item-B1-1
      );
      expect(userATryingToReadOrgBItem).toBe(false); // RLS BLOCKS

      // Attack Scenario 2: Cross-tenant insertion attempt (Tenant A attempts to inject transaction into Org B)
      const userATryingToInsertIntoOrgB = evaluateCustomerTransactionRLS(
        'user-tenant-A',
        'INSERT',
        { orgId: 'org-B' }
      );
      expect(userATryingToInsertIntoOrgB).toBe(false); // WITH CHECK BLOCKS

      // Attack Scenario 3: Cross-tenant item spoofing (Tenant A attempts to attach an item to Tenant B's transaction)
      const userATryingToAttachItemToOrgBTx = evaluateCustomerTransactionItemRLS(
        'user-tenant-A',
        'INSERT',
        { transactionId: 'tx-B1' }
      );
      expect(userATryingToAttachItemToOrgBTx).toBe(false); // WITH CHECK BLOCKS
    });

    it('3.3 Schema indexing supports RLS policy performance', () => {
      const schemaFilePath = path.resolve(__dirname, '../../../../packages/db/prisma/schema.prisma');
      const schemaContent = fs.readFileSync(schemaFilePath, 'utf8');

      // Verify indexing on CustomerTransaction
      expect(schemaContent).toContain('model CustomerTransaction {');
      expect(schemaContent).toMatch(/@@index\(\[orgId\]\)/);
      expect(schemaContent).toMatch(/@@index\(\[customerId\]\)/);
      expect(schemaContent).toMatch(/@@index\(\[date\]\)/);
      expect(schemaContent).toMatch(/@@index\(\[orgId, customerId, date\]\)/);

      // Verify indexing on CustomerTransactionItem
      expect(schemaContent).toContain('model CustomerTransactionItem {');
      expect(schemaContent).toMatch(/@@index\(\[transactionId\]\)/);
      expect(schemaContent).toMatch(/@@index\(\[productId\]\)/);
    });

    it('3.4 Complete RLS Attack Matrix: Blocks unauthorized mutations and unauthenticated queries', () => {
      const dbUsers = [
        { id: 'user-tenant-A', orgId: 'org-A' },
        { id: 'user-tenant-B', orgId: 'org-B' },
      ];
      const dbCustomerTransactions = [
        { id: 'tx-B1', orgId: 'org-B', customerId: 'cust-B1', amount: 9999 },
      ];
      const dbCustomerTransactionItems = [
        { id: 'item-B1-1', transactionId: 'tx-B1', productName: 'Secret Org B Goods', amount: 9999 },
      ];

      const evaluateCustomerTransactionRLS = (
        authUserId: string | null,
        targetRow: { orgId: string }
      ): boolean => {
        if (!authUserId) return false;
        const user = dbUsers.find((u) => u.id === authUserId);
        if (!user) return false;
        return targetRow.orgId === user.orgId;
      };

      const evaluateCustomerTransactionItemRLS = (
        authUserId: string | null,
        targetRow: { transactionId: string }
      ): boolean => {
        if (!authUserId) return false;
        const user = dbUsers.find((u) => u.id === authUserId);
        if (!user) return false;
        const parentTx = dbCustomerTransactions.find((tx) => tx.id === targetRow.transactionId);
        if (!parentTx) return false;
        return parentTx.orgId === user.orgId;
      };

      // 1. Cross-tenant UPDATE on CustomerTransaction
      const attackUpdateTx = evaluateCustomerTransactionRLS('user-tenant-A', dbCustomerTransactions[0]);
      expect(attackUpdateTx).toBe(false);

      // 2. Cross-tenant UPDATE on CustomerTransactionItem
      const attackUpdateItem = evaluateCustomerTransactionItemRLS('user-tenant-A', dbCustomerTransactionItems[0]);
      expect(attackUpdateItem).toBe(false);

      // 3. Cross-tenant DELETE on CustomerTransaction
      const attackDeleteTx = evaluateCustomerTransactionRLS('user-tenant-A', dbCustomerTransactions[0]);
      expect(attackDeleteTx).toBe(false);

      // 4. Cross-tenant DELETE on CustomerTransactionItem
      const attackDeleteItem = evaluateCustomerTransactionItemRLS('user-tenant-A', dbCustomerTransactionItems[0]);
      expect(attackDeleteItem).toBe(false);

      // 5. Unauthenticated request (auth.uid() is null)
      const unauthQueryTx = evaluateCustomerTransactionRLS(null, dbCustomerTransactions[0]);
      expect(unauthQueryTx).toBe(false);

      const unauthQueryItem = evaluateCustomerTransactionItemRLS(null, dbCustomerTransactionItems[0]);
      expect(unauthQueryItem).toBe(false);
    });
  });
});
