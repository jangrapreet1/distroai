import { OrdersImportService } from './orders-import.service';
import * as XLSX from 'xlsx';

describe('OrdersImportService', () => {
    let service: OrdersImportService;
    const mockPrisma = {
        customer: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
        product: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
        warehouse: {
            findFirst: jest.fn(),
            create: jest.fn(),
        },
        order: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
        customerTransaction: {
            create: jest.fn(),
        },
        inventoryLevel: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    beforeEach(() => {
        service = new OrdersImportService(mockPrisma as any);
        jest.clearAllMocks();
    });

    describe('generateSampleTemplate', () => {
        it('should generate a valid XLSX buffer with Orders Template and Instructions sheets', () => {
            const buffer = service.generateOrderTemplate();
            expect(buffer).toBeInstanceOf(Buffer);

            const wb = XLSX.read(buffer, { type: 'buffer' });
            expect(wb.SheetNames).toContain('Orders Template');
            expect(wb.SheetNames).toContain('Instructions & Status Guide');

            const templateSheet = wb.Sheets['Orders Template'];
            const data = XLSX.utils.sheet_to_json(templateSheet);
            expect(data.length).toBeGreaterThan(0);
            expect(data[0]).toHaveProperty('Order No');
            expect(data[0]).toHaveProperty('Customer Phone');
            expect(data[0]).toHaveProperty('Item Name');
            expect(data[0]).toHaveProperty('Qty');
            expect(data[0]).toHaveProperty('Rate');
        });
    });

    describe('autoDetectMapping', () => {
        it('should correctly map typical Indian ERP order headers', () => {
            const headers = ['Voucher No', 'Date', 'Party Mobile', 'Party Name', 'Item Name', 'Qty', 'Rate', 'Dis %', 'GST %'];
            const mapping = service['autoDetectMapping'](headers);

            expect(mapping['orderNumber']).toBe('Voucher No');
            expect(mapping['orderDate']).toBe('Date');
            expect(mapping['customerPhone']).toBe('Party Mobile');
            expect(mapping['customerName']).toBe('Party Name');
            expect(mapping['productNameOrSku']).toBe('Item Name');
            expect(mapping['quantity']).toBe('Qty');
            expect(mapping['price']).toBe('Rate');
            expect(mapping['discount']).toBe('Dis %');
            expect(mapping['taxRate']).toBe('GST %');
        });
    });

    describe('normalizeOrderStatus', () => {
        it('should normalize order status strings or default to CONFIRMED', () => {
            expect(service['normalizeOrderStatus']('draft')).toBe('DRAFT');
            expect(service['normalizeOrderStatus']('delivered')).toBe('DELIVERED');
            expect(service['normalizeOrderStatus']('cancelled')).toBe('CANCELLED');
            expect(service['normalizeOrderStatus']('confirmed')).toBe('CONFIRMED');
            expect(service['normalizeOrderStatus']('')).toBe('CONFIRMED');
            expect(service['normalizeOrderStatus'](undefined)).toBe('CONFIRMED');
            expect(service['normalizeOrderStatus']('PENDING')).toBe('CONFIRMED');
        });
    });
});
