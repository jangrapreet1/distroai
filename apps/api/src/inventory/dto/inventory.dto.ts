import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdjustInventoryDto {
    @IsString() productId!: string;
    @IsString() warehouseId!: string;
    @IsNumber() quantity!: number;
    @IsString() reason!: string;
}

export class TransferInventoryDto {
    @IsString() productId!: string;
    @IsString() fromWarehouseId!: string;
    @IsString() toWarehouseId!: string;
    @IsNumber() @Min(1) quantity!: number;
}

export class ListTransactionsQueryDto {
    @ApiPropertyOptional() @IsOptional() @IsString() productId?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() warehouseId?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() dateFrom?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() dateTo?: string;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Type(() => Number) page?: number = 1;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(100) @Type(() => Number) limit?: number = 20;
}

export class InventoryQueryDto {
    @ApiPropertyOptional() @IsOptional() @IsString() warehouseId?: string;
    @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) lowStockOnly?: boolean;
}

export class CreateWarehouseDto {
    @IsString() name!: string;
    @IsString() code!: string;
    @IsOptional() @IsString() address?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() state?: string;
    @IsOptional() @IsString() pincode?: string;
    @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateWarehouseDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsString() code?: string;
    @IsOptional() @IsString() address?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() state?: string;
    @IsOptional() @IsString() pincode?: string;
    @IsOptional() @IsBoolean() isDefault?: boolean;
}
