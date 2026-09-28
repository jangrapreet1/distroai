import { CustomersImportService } from './customers-import.service';
import * as XLSX from 'xlsx';

describe('CustomersImportService', () => {
    let service: CustomersImportService;
    const mockPrisma = {
        customer: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        customerTransaction: {
            create: jest.fn(),
        },
        $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    beforeEach(() => {
        service = new CustomersImportService(mockPrisma as any);
        jest.clearAllMocks();
    });

    describe('generateSampleTemplate', () => {
        it('should generate a valid XLSX buffer with Template and Instructions sheets', () => {
            const buffer = service.generateCustomerTemplate();
            expect(buffer).toBeInstanceOf(Buffer);

            const wb = XLSX.read(buffer, { type: 'buffer' });
            expect(wb.SheetNames).toContain('Customers Template');
            expect(wb.SheetNames).toContain('Field Instructions');

            const templateSheet = wb.Sheets['Customers Template'];
            const data = XLSX.utils.sheet_to_json(templateSheet);
            expect(data.length).toBeGreaterThan(0);
            expect(data[0]).toHaveProperty('Party Name');
            expect(data[0]).toHaveProperty('Mobile No');
        });
    });

    describe('autoDetectMapping', () => {
        it('should correctly map typical Indian ERP headers', () => {
            const headers = ['Party Name', 'Mobile No', 'GSTIN', 'Station', 'Cr Limit', 'Op Bal'];
            const mapping = service['autoDetectMapping'](headers);

            expect(mapping['name']).toBe('Party Name');
            expect(mapping['phone']).toBe('Mobile No');
            expect(mapping['gstNumber']).toBe('GSTIN');
            expect(mapping['city']).toBe('Station');
            expect(mapping['creditLimit']).toBe('Cr Limit');
            expect(mapping['openingBalance']).toBe('Op Bal');
        });

        it('should handle standard column names', () => {
            const headers = ['Name', 'Phone', 'Address', 'State', 'Pincode', 'Type'];
            const mapping = service['autoDetectMapping'](headers);

            expect(mapping['name']).toBe('Name');
            expect(mapping['phone']).toBe('Phone');
            expect(mapping['fullAddress']).toBe('Address');
            expect(mapping['state']).toBe('State');
            expect(mapping['pincode']).toBe('Pincode');
            expect(mapping['type']).toBe('Type');
        });
    });

    describe('cleanPhone', () => {
        it('should format 10-digit Indian phone numbers', () => {
            expect(service['cleanPhone']('9876543210')).toBe('9876543210');
            expect(service['cleanPhone']('+91 98765 43210')).toBe('9876543210');
            expect(service['cleanPhone']('09876543210')).toBe('9876543210');
        });
    });
});
