import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CustomersService & SuppliersService - Entity Detail Editing', () => {
    describe('CustomersService.update', () => {
        let service: CustomersService;
        let prisma: {
            customer: {
                findFirst: jest.Mock;
                update: jest.Mock;
            };
        };

        beforeEach(() => {
            prisma = {
                customer: {
                    findFirst: jest.fn(),
                    update: jest.fn(),
                },
            };
            service = new CustomersService(prisma as unknown as PrismaService);
        });

        it('should update customer details when customer belongs to tenant orgId', async () => {
            const existingCustomer = {
                id: 'cust-123',
                orgId: 'org-456',
                name: 'Old Store Name',
                phone: '9812400000',
                tier: 'BRONZE',
                type: 'RETAILER',
            };
            prisma.customer.findFirst.mockResolvedValue(existingCustomer);
            prisma.customer.update.mockResolvedValue({
                ...existingCustomer,
                name: 'New Store Name',
                gstNumber: '06AAAAA0000A1Z5',
                panNumber: 'AAAAA0000A',
                city: 'Rohtak',
                state: 'Haryana',
                creditLimit: 50000,
            });

            const updateDto = {
                name: 'New Store Name',
                gstNumber: '06AAAAA0000A1Z5',
                panNumber: 'AAAAA0000A',
                city: 'Rohtak',
                state: 'Haryana',
                creditLimit: 50000,
                tier: 'GOLD',
                type: 'WHOLESALER',
            };

            const result = await service.update('org-456', 'cust-123', updateDto as any);

            expect(prisma.customer.findFirst).toHaveBeenCalledWith({
                where: { id: 'cust-123', orgId: 'org-456' },
            });
            expect(prisma.customer.update).toHaveBeenCalledWith({
                where: { id: 'cust-123' },
                data: expect.objectContaining({
                    name: 'New Store Name',
                    gstNumber: '06AAAAA0000A1Z5',
                    tier: 'GOLD',
                    type: 'WHOLESALER',
                }),
            });
            expect(result.name).toBe('New Store Name');
        });

        it('should throw NotFoundException if customer does not exist or orgId does not match (OWASP tenant isolation)', async () => {
            prisma.customer.findFirst.mockResolvedValue(null);

            await expect(
                service.update('org-wrong', 'cust-123', { name: 'Attacker Attempt' })
            ).rejects.toThrow(NotFoundException);

            expect(prisma.customer.update).not.toHaveBeenCalled();
        });
    });

    describe('SuppliersService.update', () => {
        let service: SuppliersService;
        let prisma: {
            supplier: {
                findFirst: jest.Mock;
                update: jest.Mock;
            };
        };

        beforeEach(() => {
            prisma = {
                supplier: {
                    findFirst: jest.fn(),
                    update: jest.fn(),
                },
            };
            service = new SuppliersService(prisma as unknown as PrismaService, {} as any);
        });

        it('should update supplier details when supplier belongs to tenant orgId', async () => {
            const existingSupplier = {
                id: 'supp-100',
                orgId: 'org-456',
                name: 'Acme Traders',
                leadTimeDays: 5,
            };
            prisma.supplier.findFirst.mockResolvedValue(existingSupplier);
            prisma.supplier.update.mockResolvedValue({
                ...existingSupplier,
                name: 'Acme Global Traders',
                phone: '9876543210',
                gstNumber: '07AAAAA0000A1Z5',
                leadTimeDays: 3,
                creditDays: 45,
            });

            const updateDto = {
                name: 'Acme Global Traders',
                phone: '9876543210',
                gstNumber: '07AAAAA0000A1Z5',
                leadTimeDays: 3,
                creditDays: 45,
            };

            const result = await service.update('org-456', 'supp-100', updateDto);

            expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
                where: { id: 'supp-100', orgId: 'org-456' },
            });
            expect(prisma.supplier.update).toHaveBeenCalledWith({
                where: { id: 'supp-100' },
                data: updateDto,
            });
            expect(result.name).toBe('Acme Global Traders');
        });

        it('should throw NotFoundException if supplier does not belong to the calling tenant', async () => {
            prisma.supplier.findFirst.mockResolvedValue(null);

            await expect(
                service.update('org-attacker', 'supp-100', { name: 'Unauthorized Name' })
            ).rejects.toThrow(NotFoundException);

            expect(prisma.supplier.update).not.toHaveBeenCalled();
        });
    });
});
