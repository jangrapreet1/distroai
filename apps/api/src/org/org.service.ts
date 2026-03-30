import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS, PlanName } from '../common/config/plan-limits.config';

export class UpdateOrgDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() email?: string;
    @IsOptional() @IsString() address?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() state?: string;
    @IsOptional() @IsString() pincode?: string;
    @IsOptional() @IsString() logoUrl?: string;
    @IsOptional() @IsString() website?: string;
    @IsOptional() @IsString() @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
    slug?: string;
}

export class UpdateSettingsDto {
    @IsOptional() @IsString() invoicePrefix?: string;
    @IsOptional() @IsString() orderPrefix?: string;
    @IsOptional() @IsString() poPrefix?: string;
    @IsOptional() @IsString() timezone?: string;
    @IsOptional() @IsString() language?: string;
    @IsOptional() @IsBoolean() autoInvoice?: boolean;
    @IsOptional() @IsString() bankName?: string;
    @IsOptional() @IsString() bankAccountNumber?: string;
    @IsOptional() @IsString() bankIfscCode?: string;
    @IsOptional() @IsString() bankBranch?: string;
    @IsOptional() @IsString() upiId?: string;
}

@Injectable()
export class OrgService {
    constructor(private readonly prisma: PrismaService) { }

    async getOrg(orgId: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id: orgId },
            include: { settings: true, subscription: true },
        });
        if (!org) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Organization not found' });
        return org;
    }

    async updateOrg(orgId: string, dto: UpdateOrgDto) {
        // Enforce slug uniqueness — another org must not use the same slug
        if (dto.slug) {
            const existing = await this.prisma.organization.findFirst({
                where: { slug: dto.slug, NOT: { id: orgId } },
            });
            if (existing) {
                throw new ConflictException({
                    code: 'CONFLICT',
                    message: `The portal slug "${dto.slug}" is already taken. Please choose a different one.`,
                });
            }
        }
        return this.prisma.organization.update({ where: { id: orgId }, data: dto });
    }

    async getSettings(orgId: string) {
        const settings = await this.prisma.orgSettings.findUnique({ where: { orgId } });
        if (!settings) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Settings not found' });
        return settings;
    }

    async updateSettings(orgId: string, dto: UpdateSettingsDto) {
        return this.prisma.orgSettings.update({ where: { orgId }, data: dto });
    }

    async getSubscription(orgId: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id: orgId },
            include: { subscription: true },
        });
        if (!org) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Organization not found' });

        const plan = org.plan as PlanName;
        const limits = PLAN_LIMITS[plan];

        const [userCount, productCount, customerCount] = await Promise.all([
            this.prisma.user.count({ where: { orgId, isActive: true } }),
            this.prisma.product.count({ where: { orgId, isActive: true } }),
            this.prisma.customer.count({ where: { orgId, isActive: true } }),
        ]);

        return {
            subscription: org.subscription,
            plan,
            limits: {
                users: { current: userCount, max: limits.maxUsers },
                products: { current: productCount, max: limits.maxProducts },
                customers: { current: customerCount, max: limits.maxCustomers },
            },
            features: limits.features,
        };
    }
}
