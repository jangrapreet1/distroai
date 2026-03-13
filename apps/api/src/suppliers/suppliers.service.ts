import { Injectable, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsEmail, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class CreateSupplierDto {
    @IsString() name!: string;
    @IsOptional() @IsString() contactPerson?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsString() gstNumber?: string;
    @IsOptional() @IsString() address?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() state?: string;
    @IsOptional() @IsNumber() @Min(0) creditDays?: number;
    @IsOptional() @IsNumber() @Min(0) leadTimeDays?: number;
    @IsOptional() @IsString() notes?: string;
}

@Injectable()
export class SuppliersService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(orgId: string, page = 1, limit = 20) {
        const [data, total] = await Promise.all([
            this.prisma.supplier.findMany({ where: { orgId, isActive: true }, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
            this.prisma.supplier.count({ where: { orgId, isActive: true } }),
        ]);
        return { data, meta: { total, page, limit } };
    }

    async create(orgId: string, dto: CreateSupplierDto) {
        return this.prisma.supplier.create({ data: { orgId, ...dto } });
    }

    async findOne(orgId: string, id: string) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id, orgId } });
        if (!supplier) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Supplier not found' });
        const recentPOs = await this.prisma.purchaseOrder.findMany({ where: { supplierId: id }, take: 10, orderBy: { createdAt: 'desc' } });
        return { supplier, recentPOs };
    }

    async update(orgId: string, id: string, dto: Partial<CreateSupplierDto>) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id, orgId } });
        if (!supplier) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Supplier not found' });
        return this.prisma.supplier.update({ where: { id }, data: dto });
    }
}
