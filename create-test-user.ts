import { PrismaClient } from './packages/db/index.ts';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Creating fresh test environment...');

    const orgName = `Test Org ${Math.floor(Math.random() * 1000)}`;
    const email = `test${Math.floor(Math.random() * 1000)}@distroai.com`;
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create Organization
    const org = await prisma.organization.create({
        data: {
            name: orgName,
            address: '123 New Start Blvd, Bangalore',
            plan: 'PRO',
            settings: {
                create: {
                    currency: 'INR',
                    timezone: 'Asia/Kolkata',
                    invoicePrefix: 'TS-INV',
                    orderPrefix: 'TS-ORD',
                }
            }
        }
    });

    // Create User
    const user = await prisma.user.create({
        data: {
            orgId: org.id,
            name: 'Test Setup Admin',
            email: email,
            password: hashedPassword,
            role: 'ADMIN',
        }
    });

    // Create Warehouse
    const warehouse = await prisma.warehouse.create({
        data: {
            orgId: org.id,
            name: 'Central Hub',
            address: 'Industrial Area Phase 2',
            managerId: user.id
        }
    });

    // Create Product
    const product = await prisma.product.create({
        data: {
            orgId: org.id,
            name: 'Premium Coffee Beans 1kg',
            sku: 'COF-1KG',
            category: 'Beverages',
            unit: 'Pieces',
            price: 1200,
            mrp: 1500,
            minStock: 20,
            taxRate: 5,
            gstRate: 5,
            hsnCode: '0901',
            inventory: {
                create: {
                    warehouseId: warehouse.id,
                    quantity: 500,
                }
            }
        }
    });

    // Create Customer
    const customer = await prisma.customer.create({
        data: {
            orgId: org.id,
            name: 'Fresh Market Superstore',
            type: 'RETAILER',
            phone: '9876543210',
            whatsappNumber: '9876543210',
            email: 'contact@freshmarket.com',
            address: 'Market Road, Shop 1',
            creditLimit: 50000,
            outstandingAmount: 0,
            paymentTerms: 30,
        }
    });

    console.log('\n--- SUCCESS! ---');
    console.log('Use these credentials to log in:');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('\nOrganization:', org.name);
    console.log('----------------');

    await prisma.$disconnect();
}

main().catch(console.error);
