import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

interface TallyConfig {
    companyName: string;
    tallySyncEnabled: boolean;
    tallyPort: number;
}

@Controller('tally')
@UseGuards(JwtAuthGuard)
export class TallyController {
    constructor(private prisma: PrismaService) { }

    @Get('pending-sync')
    async getPendingSync(@Req() req: Request) {
        const orgId = (req.user as Record<string, string>)?.orgId;

        const invoices = await this.prisma.invoice.findMany({
            where: { orgId, status: { not: 'DRAFT' }, tallySyncedAt: null },
            include: { items: { include: { product: true } }, customer: true, organization: true },
            take: 50,
        }) as any;

        const payments = await this.prisma.payment.findMany({
            where: { orgId, status: 'COMPLETED', tallySyncedAt: null },
            include: { customer: true, organization: true },
            take: 50,
        }) as any;

        return { success: true, data: { invoices, payments } };
    }

    @Post('sync-complete')
    async markSynced(@Body() body: { invoiceIds?: string[]; paymentIds?: string[] }) {
        const now = new Date();

        if (body.invoiceIds?.length) {
            await this.prisma.invoice.updateMany({
                where: { id: { in: body.invoiceIds } },
                data: { tallySyncedAt: now },
            });
        }
        if (body.paymentIds?.length) {
            await this.prisma.payment.updateMany({
                where: { id: { in: body.paymentIds } },
                data: { tallySyncedAt: now },
            });
        }

        return { success: true };
    }

    @Get('config')
    async getConfig(@Req() req: Request) {
        const orgId = (req.user as Record<string, string>)?.orgId;
        const settings = await this.prisma.orgSettings.findUnique({ where: { orgId } });
        return {
            success: true,
            data: {
                companyName: (settings as Record<string, unknown>)?.tallyCompanyName ?? '',
                tallySyncEnabled: (settings as Record<string, unknown>)?.tallySyncEnabled ?? false,
                tallyPort: 9000,
            },
        };
    }

    @Post('config')
    async saveConfig(@Req() req: Request, @Body() body: TallyConfig) {
        const orgId = (req.user as Record<string, string>)?.orgId;
        await this.prisma.orgSettings.update({
            where: { orgId },
            data: {
                tallyCompanyName: body.companyName,
                tallySyncEnabled: body.tallySyncEnabled,
            } as Record<string, unknown>,
        });
        return { success: true };
    }
}
