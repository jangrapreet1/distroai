import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogParams {
    userId: string;
    orgId: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: unknown;
    newValue?: unknown;
}

@Injectable()
export class AuditLogService {
    private readonly logger = new Logger(AuditLogService.name);

    constructor(private readonly prisma: PrismaService) { }

    async log(params: AuditLogParams): Promise<void> {
        try {
            await this.prisma.auditLog.create({
                data: {
                    orgId: params.orgId,
                    userId: params.userId,
                    action: params.action,
                    entityType: params.entityType,
                    entityId: params.entityId ?? '',
                    oldValue: params.oldValue ? JSON.stringify(params.oldValue) : undefined,
                    newValue: params.newValue ? JSON.stringify(params.newValue) : undefined,
                },
            });
        } catch (err) {
            // Never throw — swallow and log only to console
            this.logger.error('Failed to write audit log', err);
        }
    }

    async findAll(orgId: string, params: {
        entityType?: string; entityId?: string; userId?: string;
        dateFrom?: string; dateTo?: string; page?: number; limit?: number;
    }): Promise<any> {
        const { page = 1, limit = 20, entityType, entityId, userId, dateFrom, dateTo } = params;
        const where = {
            orgId,
            ...(entityType && { entityType }),
            ...(entityId && { entityId }),
            ...(userId && { userId }),
            ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
            ...(dateTo && { createdAt: { lte: new Date(dateTo) } }),
        };
        const [data, total] = await Promise.all([
            this.prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
            this.prisma.auditLog.count({ where }),
        ]);
        return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }
}
