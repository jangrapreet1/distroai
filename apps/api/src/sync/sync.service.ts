import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SyncService {
    constructor(private prisma: PrismaService) { }

    async getSyncProducts(orgId: string, lastSyncTimestamp: number) {
        const lastSyncDate = new Date(lastSyncTimestamp);

        const products = await this.prisma.product.findMany({
            where: {
                orgId,
                updatedAt: {
                    gt: lastSyncDate,
                },
            },
            include: {
                inventories: {
                    select: {
                        quantity: true,
                        warehouseId: true,
                    }
                }
            }
        });

        // Also figure out deleted products if we soft-deleted them, but for now we just return updated/created
        return {
            products,
            timestamp: Date.now(),
        };
    }
}
