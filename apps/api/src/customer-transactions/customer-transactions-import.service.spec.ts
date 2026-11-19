import { CustomerTransactionsImportService } from './customer-transactions-import.service';
import { CustomerTransactionType } from './customer-transactions.calculation';

describe('CustomerTransactionsImportService', () => {
    let service: CustomerTransactionsImportService;
    let mockCustomer: any;
    let createdTransactions: any[] = [];

    const mockPrisma: any = {
        customer: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        customerTransaction: {
            create: jest.fn(),
            findMany: jest.fn(),
        },
        $transaction: jest.fn(async (callback) => callback(mockPrisma)),
    };

    beforeEach(() => {
        createdTransactions = [];
        mockCustomer = {
            id: 'cust-sunny-1',
            name: 'Sunny Bhai',
            phone: '9876543210',
            outstandingAmount: 0,
        };

        mockPrisma.customer.findFirst.mockResolvedValue(mockCustomer);
        mockPrisma.customer.findUnique.mockImplementation(() => Promise.resolve(mockCustomer));
        mockPrisma.customerTransaction.create.mockImplementation((args: any) => {
            createdTransactions.push(args.data);
            return Promise.resolve({ id: `tx-${createdTransactions.length}`, ...args.data });
        });
        mockPrisma.customerTransaction.findMany.mockImplementation(() => {
            return Promise.resolve(createdTransactions.map(t => ({ type: t.type, amount: t.amount })));
        });
        mockPrisma.customer.update.mockImplementation((args: any) => {
            mockCustomer.outstandingAmount = args.data.outstandingAmount;
            return Promise.resolve(mockCustomer);
        });

        service = new CustomerTransactionsImportService(mockPrisma);
        jest.clearAllMocks();
    });

    const sunnyBhaiDocText = `SUNNY BHAI ACCOUNT SUMMARY
Radhakishan Trading Company  •  Customer: Sunny Bhai
| DATE   | GOODS GIVEN TO SUNNY BHAI   | AMOUNT   | RETURNED   | PAYMENT RECEIVED   |
| 04/08/26   | 4 Packet Leveler — ₹21036 Box 2×4 — 576 × 38 = ₹21,888   | ₹22,098   |  |  |
| 10/08/26   | 13 Box 2×4 — 208 × 38 = ₹7,90415 Box 16×16 — 180 × 15 = ₹2,7003 Leveler — ₹210   | ₹10,814   |  |  |
| 13/08/26   | 26 Box 16×16 — 180 = ₹4,68012 Bag Type I — 210 = ₹2,520  3 leveler -- 210   | ₹7,410   |  |  |
| 14/08/26   | Bondtite — ₹500Brush — ₹600Feviquick — ₹100   | ₹1,200   |  |  |
| 15/08/26   | 14 Box 2×4 — 224 × 38 = ₹8,512  1 Brash Patti --- 600   | ₹9,112   |  |  |
| 17/08/26   | Brash Patti — ₹600   | ₹600   |  |  |
| 17/08/26   | Bondtite — ₹500   | ₹500   |  |  |
| 19/08/26   | 5 Box white — 80 × 30 = ₹2,400   | ₹2,400   |  |  |
| 21/08/26   | 1 Box 2×4 — 16 × 38 = ₹608   | ₹608   |  |  |
| 21/08/26   | 16½ Return — 264 × 38 = ₹10,032   |  | ₹10,032   |  |
| 02/08/26   | 5 Bag Type I — ₹1,0505 Bag Type II — ₹2,0003 Tile Extra — ₹7504 Box 2×1 — ₹1,200   | ₹5,000   |  |  |
| 07/09/26   | 4 Box 16×16 — ₹7201 brash patti — ₹600   | ₹1,320   |  |  |
| 09/09/26   | 2 Roff epoxy (2-Black) — ₹6,4002 Roff cleaner — ₹3005 Jali (washbasin/B.R) — ₹1001 Box (4×2) — ₹480   | ₹7,330   |  |  |
| 10/09/26   | 1 12×12 Manhole cover — ₹60060 ft golden brush — ₹1,2008 Bag Type-3 — 600 × 8 = ₹4,8005 Box 4×2 — 80 × 38 = ₹3,040Feviquick — ₹100   | ₹9,740   |  |  |
|  | 3 Single tile — ₹600   | ₹600   |  |  |
| 22/09/26   | 3 Slab Black — ₹9,600   | ₹9,600   |  |  |
| 27/09/26   | 5 chemical + 2 Grout + Faviquick   | ₹375   |  |  |
| 28/09/26   | 4*2.6 = 10.6ft slab   | ₹1700   |  |  |
| 29/09/26   | Bondtite = 690₹  3 slab White :- 3200*3= 9600  5 tile (40ft)   | ₹690  ₹9600  ₹1000   |  |  |
| 1/10/26   | 1 Brashpatti = 600  1 faviquick = 150   | ₹750   |  |  |
| 2/10/26   | 4 box 4*2 gloss = 38*64 = ₹2432  5 box 4*2 matt white = 30*80 = ₹2400  1/2 slab black = 1600   | ₹4832   |  |  |
| 6/10/26   | 3 Bag type 3  = 1650  Faviquick =150   | ₹1650  ₹150   |  |  |
| 7/10/26   | 1 Bag type 3 = 550   | ₹550   |  |  |
ACCOUNT SUMMARY
| TOTAL GOODS GIVEN   | ₹1,09,629   |
| LESS: GOODS RETURNED   | ₹10,032   |
| LESS: PAYMENTS RECEIVED   | ₹0   |
| BALANCE   | ₹99,597   |`;

    describe('previewCustomerKhata with pasted document table', () => {
        it('should correctly preview, parse and validate all 23 rows from raw text', async () => {
            const buf = Buffer.from(sunnyBhaiDocText, 'utf-8');
            const preview = await service.previewCustomerKhata('org-1', 'cust-sunny-1', buf);

            expect(preview.totalRows).toBe(23);
            expect(preview.validCount).toBe(23);
            expect(preview.invalidCount).toBe(0);

            // Verified calculations
            expect(preview.projectedBalance).toBe(99597);

            // Column Mapping
            expect(preview.mapping.date).toBe('DATE');
            expect(preview.mapping.description).toBe('GOODS GIVEN TO SUNNY BHAI');
            expect(preview.mapping.saleAmount).toBe('AMOUNT');
            expect(preview.mapping.returnedAmount).toBe('RETURNED');
            expect(preview.mapping.paymentReceivedAmount).toBe('PAYMENT RECEIVED');

            // Multi-amount summation verification (Row 19: 690 + 9600 + 1000 = 11290)
            const row19 = preview.validationResults[18];
            expect(row19.data.date).toBe('2026-09-29');
            expect(row19.txType).toBe('SALE');
            expect(row19.effectiveAmount).toBe(11290);

            // Row 22: 1650 + 150 = 1800
            const row22 = preview.validationResults[21];
            expect(row22.data.date).toBe('2026-10-06');
            expect(row22.effectiveAmount).toBe(1800);

            // Return Row 10: 10032
            const row10 = preview.validationResults[9];
            expect(row10.txType).toBe('RETURN');
            expect(row10.effectiveAmount).toBe(10032);

            // Missing date inferred from previous row (Row 15)
            const row15 = preview.validationResults[14];
            expect(row15.data.date).toBe('2026-09-10');
            expect(row15.warnings.some(w => w.field === 'date')).toBe(true);
            expect(row15.isValid).toBe(true);
        });
    });

    describe('executeCustomerKhataImport', () => {
        it('should atomically import transactions and update customer balance to ₹99,597', async () => {
            const buf = Buffer.from(sunnyBhaiDocText, 'utf-8');
            const preview = await service.previewCustomerKhata('org-1', 'cust-sunny-1', buf);
            const rowsToImport = preview.validationResults.map(r => r.data);

            const result = await service.executeCustomerKhataImport('org-1', 'cust-sunny-1', rowsToImport);

            expect(result.importedTransactionsCount).toBe(23);
            expect(result.newOutstandingAmount).toBe(99597);
            expect(mockPrisma.customerTransaction.create).toHaveBeenCalledTimes(23);
            expect(mockPrisma.customer.update).toHaveBeenCalledWith({
                where: { id: 'cust-sunny-1' },
                data: { outstandingAmount: 99597 },
            });
        });
    });

    describe('previewCustomerKhata with multiline cell HTML/DOCX statement (Badal Bhai case)', () => {
        it('should correctly sum multiple amounts within a single cell instead of concatenating them', async () => {
            const badalHtml = `
            <table>
                <tr>
                    <th><strong>DATE</strong></th>
                    <th><strong>GOODS GIVEN TO</strong></th>
                    <th><strong>AMOUNT</strong></th>
                    <th><strong>RETURNED</strong></th>
                    <th><strong>PAYMENT RECEIVED</strong></th>
                </tr>
                <tr>
                    <td><p>20/09/26</p></td>
                    <td><p>57 Box (4*2) = 35.5 per sqft</p><p>5 Jali</p></td>
                    <td><p>32,376</p><p>200</p></td>
                    <td></td>
                    <td></td>
                </tr>
                <tr>
                    <td><p>20/09/26</p></td>
                    <td><p>Payment Received (Cash)</p></td>
                    <td></td>
                    <td></td>
                    <td><p>50,000</p></td>
                </tr>
                <tr>
                    <td><p>23/09/26</p></td>
                    <td><p>6 Leveler + 6 clipper + 4 spacer</p></td>
                    <td><p>1,400</p></td>
                    <td></td>
                    <td></td>
                </tr>
            </table>`;

            const buf = Buffer.from(badalHtml, 'utf-8');
            const preview = await service.previewCustomerKhata('org-1', 'cust-sunny-1', buf);

            expect(preview.totalRows).toBe(3);
            expect(preview.validCount).toBe(3);

            // Row 1: 32376 + 200 = 32576 (NOT 32376200!)
            const row1 = preview.validationResults[0];
            expect(row1.txType).toBe('SALE');
            expect(row1.data.saleAmount).toBe(32576);
            expect(row1.effectiveAmount).toBe(32576);

            // Row 2: Payment Received = 50000
            const row2 = preview.validationResults[1];
            expect(row2.txType).toBe('PAYMENT');
            expect(row2.data.paymentReceivedAmount).toBe(50000);

            // Row 3: Sale = 1400
            const row3 = preview.validationResults[2];
            expect(row3.txType).toBe('SALE');
            expect(row3.data.saleAmount).toBe(1400);

            // Projected balance: 32576 - 50000 + 1400 = -16024
            expect(preview.projectedBalance).toBe(-16024);
        });
    });

    describe('previewCustomerKhata with Google Docs unquoted multiline TSV paste', () => {
        it('should reassemble multiline product lines into single rows and parse correctly without row fragmentation', async () => {
            const rawGDocsPaste = `DATE\tGOODS GIVEN TO SUNNY BHAI\tAMOUNT\tRETURNED\tPAYMENT RECEIVED
04/08/26\t4 Packet Leveler — ₹210
36 Box 2×4 — 576 × 38 = ₹21,888\t₹22,098\t\t
10/08/26\t13 Box 2×4 — 208 × 38 = ₹7,904
15 Box 16×16 — 180 × 15 = ₹2,700
3 Leveler — ₹210\t₹10,814\t\t
13/08/26\t26 Box 16×16 — 180 = ₹4,680
12 Bag Type I — 210 = ₹2,520
3 leveler -- 210\t₹7,410\t\t`;

            const buf = Buffer.from(rawGDocsPaste, 'utf-8');
            const preview = await service.previewCustomerKhata('org-1', 'cust-sunny-1', buf);

            expect(preview.totalRows).toBe(3);
            expect(preview.validCount).toBe(3);
            expect(preview.invalidCount).toBe(0);

            // Row 1 should have both products combined with comma
            const row1 = preview.validationResults[0];
            expect(row1.data.date).toBe('2026-08-04');
            expect(row1.data.description).toBe(
                '4 Packet Leveler — ₹210, 36 Box 2×4 — 576 × 38 = ₹21,888'
            );
            expect(row1.data.saleAmount).toBe(22098);
            expect(row1.isValid).toBe(true);

            // Row 2 should have all 3 products combined with comma
            const row2 = preview.validationResults[1];
            expect(row2.data.date).toBe('2026-08-10');
            expect(row2.data.description).toBe(
                '13 Box 2×4 — 208 × 38 = ₹7,904, 15 Box 16×16 — 180 × 15 = ₹2,700, 3 Leveler — ₹210'
            );
            expect(row2.data.saleAmount).toBe(10814);
            expect(row2.isValid).toBe(true);
        });
    });
});
