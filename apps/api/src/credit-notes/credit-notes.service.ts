import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreditNoteStatus = 'ISSUED' | 'APPLIED' | 'VOID' | 'All';

@Injectable()
export class CreditNotesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(orgId: string, status?: CreditNoteStatus, search?: string, page = 1, limit = 20) {
        const where: any = { orgId };
        if (status && (status as string) !== 'All') where.status = status;
        if (search) {
            where.OR = [
                { creditNoteNumber: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.creditNote.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: { customer: { select: { name: true } } },
                orderBy: { creditNoteDate: 'desc' },
            }),
            this.prisma.creditNote.count({ where }),
        ]);

        return { data, meta: { total, page, limit } };
    }
}
