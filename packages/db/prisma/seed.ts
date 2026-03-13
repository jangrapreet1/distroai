import { PrismaClient, Plan, Role, CustomerType, CustomerTier } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Create Organization
    const org = await prisma.organization.create({
        data: {
            name: 'Acme Traders',
            gstNumber: '27AADCB2230M1Z2',
            phone: '+919876543210',
            email: 'contact@acmetraders.in',
            plan: Plan.ENTERPRISE,
        },
    });

    // 2. Create Owner User
    const owner = await prisma.user.create({
        data: {
            orgId: org.id,
            email: 'owner@acmetraders.in',
            phone: '+919876543210',
            passwordHash,
            firstName: 'Rahul',
            lastName: 'Sharma',
            role: Role.OWNER,
        },
    });

    // 3. Create Default Warehouse
    const warehouse = await prisma.warehouse.create({
        data: {
            orgId: org.id,
            name: 'Main Godown',
            code: 'WH-MAIN',
            city: 'Mumbai',
            state: 'Maharashtra',
            isDefault: true,
        },
    });

    // 4. Create Salesman
    const salesmanUser = await prisma.user.create({
        data: {
            orgId: org.id,
            email: 'sales1@acmetraders.in',
            phone: '+919876543211',
            passwordHash,
            firstName: 'Amit',
            lastName: 'Verma',
            role: Role.SALESMAN,
        },
    });

    const salesman = await prisma.salesman.create({
        data: {
            orgId: org.id,
            userId: salesmanUser.id,
            employeeCode: 'EMP001',
            name: 'Amit Verma',
            targetMonthly: 500000, // 5 Lakhs
        },
    });

    // 5. Create some Products
    const product1 = await prisma.product.create({
        data: {
            orgId: org.id,
            name: 'Colgate Total 120g',
            sku: 'COL-TOT-120',
            category: 'Oral Care',
            brand: 'Colgate',
            unit: 'Pieces',
            purchasePrice: 45.0,
            sellingPrice: 52.0,
            mrp: 60.0,
            gstRate: 18.0,
            minStockLevel: 50,
            inventories: {
                create: {
                    orgId: org.id,
                    warehouseId: warehouse.id,
                    quantity: 200,
                },
            },
        },
    });

    const product2 = await prisma.product.create({
        data: {
            orgId: org.id,
            name: 'Maggi 2-Minute Noodles 70g',
            sku: 'MAG-2M-70',
            category: 'Food',
            brand: 'Nestle',
            unit: 'Pieces',
            purchasePrice: 10.5,
            sellingPrice: 12.0,
            mrp: 14.0,
            gstRate: 12.0,
            minStockLevel: 100,
            inventories: {
                create: {
                    orgId: org.id,
                    warehouseId: warehouse.id,
                    quantity: 500,
                },
            },
        },
    });

    // 6. Create Customer
    const customer = await prisma.customer.create({
        data: {
            orgId: org.id,
            name: 'Sri Sai Kirana Store',
            contactPerson: 'Ramesh Bhai',
            phone: '+919988776655',
            type: CustomerType.RETAILER,
            tier: CustomerTier.SILVER,
            creditLimit: 10000,
            salesmanId: salesman.id,
        },
    });

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
