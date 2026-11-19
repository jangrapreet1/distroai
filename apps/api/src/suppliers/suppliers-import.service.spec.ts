import { SuppliersImportService } from './suppliers-import.service';

describe('SuppliersImportService', () => {
    let service: SuppliersImportService;
    let mockSupplier: any;
    let createdPOs: any[] = [];
    let createdExpenses: any[] = [];
    let createdProducts: any[] = [];
    let createdInventory: any[] = [];

    const mockPrisma: any = {
        supplier: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        product: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        warehouse: {
            findFirst: jest.fn(),
        },
        purchaseOrder: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
        },
        purchaseOrderItem: {
            create: jest.fn(),
        },
        expense: {
            create: jest.fn(),
        },
        inventory: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn(async (callback) => callback(mockPrisma)),
    };

    beforeEach(() => {
        createdPOs = [];
        createdExpenses = [];
        createdProducts = [];
        createdInventory = [];

        mockSupplier = {
            id: 'sup-ronak-1',
            name: 'Ronak',
            phone: '9876543210',
            outstandingBalance: 0,
        };

        mockPrisma.supplier.findFirst.mockResolvedValue(mockSupplier);
        mockPrisma.supplier.findUnique.mockImplementation(() => Promise.resolve(mockSupplier));
        mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-default-1', name: 'Default Warehouse' });

        mockPrisma.purchaseOrder.create.mockImplementation((args: any) => {
            const po = { id: `po-${createdPOs.length + 1}`, ...args.data };
            createdPOs.push(po);
            return Promise.resolve(po);
        });

        mockPrisma.product.findFirst.mockImplementation(() => Promise.resolve(null));
        mockPrisma.product.create.mockImplementation((args: any) => {
            const p = { id: `prod-${createdProducts.length + 1}`, ...args.data };
            createdProducts.push(p);
            return Promise.resolve(p);
        });

        mockPrisma.expense.create.mockImplementation((args: any) => {
            const exp = { id: `exp-${createdExpenses.length + 1}`, ...args.data };
            createdExpenses.push(exp);
            return Promise.resolve(exp);
        });

        mockPrisma.supplier.update.mockImplementation((args: any) => {
            mockSupplier.outstandingBalance = args.data.outstandingBalance;
            return Promise.resolve(mockSupplier);
        });

        service = new SuppliersImportService(mockPrisma);
        jest.clearAllMocks();
    });

    const sampleSupplierDoc = `
| DATE | BILL NO | ITEM DESCRIPTION | QUANTITY | COST | PURCHASE AMOUNT | RETURNED | PAYMENT MADE |
| 08/05/26 | BILL-101 | General Purchase Goods | | | 50,131 | | |
| 19/05/26 | BILL-102 | General Purchase Goods | | | 2,600 | | |
| 19/05/26 | | Payment to Ronak | | | | | 25,000 |
| 22/05/26 | BILL-103 | General Purchase Goods | | | 29,606 | | |
ACCOUNT SUMMARY
| TOTAL PURCHASES | 82,337 |
| LESS: PAYMENTS | 25,000 |
| BALANCE | 57,337 |
`;

    describe('previewSupplierPurchases', () => {
        it('should correctly parse supplier statement and skip summary footer rows', async () => {
            const buf = Buffer.from(sampleSupplierDoc, 'utf-8');
            const preview = await service.previewSupplierPurchases('org-1', 'sup-ronak-1', buf);

            expect(preview.totalRows).toBe(4);
            expect(preview.validCount).toBe(4);
            expect(preview.invalidCount).toBe(0);
            expect(preview.projectedBalance).toBe(57337);

            // Row types
            expect(preview.validationResults[0].rowType).toBe('PURCHASE');
            expect(preview.validationResults[0].effectiveAmount).toBe(50131);

            expect(preview.validationResults[2].rowType).toBe('PAYMENT');
            expect(preview.validationResults[2].effectiveAmount).toBe(25000);
        });
    });

    describe('executeSupplierPurchasesImport with architectural guardrails', () => {
        it('should mark placeholder items as isActive: false, category: INTERNAL_LEDGER and NOT add to inventory stock', async () => {
            const buf = Buffer.from(sampleSupplierDoc, 'utf-8');
            const preview = await service.previewSupplierPurchases('org-1', 'sup-ronak-1', buf);
            const rowsToImport = preview.validationResults.map(r => r.data);

            const result = await service.executeSupplierPurchasesImport(
                'org-1',
                'sup-ronak-1',
                rowsToImport,
                { updateInventory: false, skipErrors: true }
            );

            expect(result.createdOrdersCount).toBe(3);
            expect(result.createdPaymentsCount).toBe(1);
            expect(result.newOutstandingBalance).toBe(57337);

            // Verify financial placeholder was marked isActive: false and INTERNAL_LEDGER
            expect(createdProducts.length).toBeGreaterThan(0);
            const placeholder = createdProducts.find(p => p.name === 'General Purchase Goods');
            expect(placeholder).toBeDefined();
            expect(placeholder.isActive).toBe(false);
            expect(placeholder.category).toBe('INTERNAL_LEDGER');

            // Verify no warehouse inventory record was created for financial placeholders
            expect(mockPrisma.inventory.create).not.toHaveBeenCalled();
        });
    });
});
