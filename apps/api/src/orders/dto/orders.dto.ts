import { IsString, IsOptional, IsNumber, IsArray, IsEnum, ValidateNested, Min, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
    @IsString() productId!: string;
    @IsOptional() @IsString() variantId?: string;
    @IsNumber() @Min(1) quantity!: number;
    @IsString() unit!: string;
    @IsNumber() @Min(0) price!: number;
    @IsOptional() @IsNumber() @Min(0) discount?: number;
}

export class CreateOrderDto {
    @IsString() customerId!: string;
    @IsOptional() @IsString() warehouseId?: string;
    @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items!: OrderItemDto[];
    @IsOptional() @IsString() notes?: string;
    @IsOptional() @IsDateString() deliveryDate?: string;
    @IsOptional() @IsEnum(['APP', 'WHATSAPP', 'PHONE', 'WEB', 'PORTAL']) source?: string;
    @IsOptional() @IsString() commissionTo?: string;
    @IsOptional() @IsEnum(['FIXED', 'PERCENTAGE']) commissionType?: string;
    @IsOptional() @IsNumber() @Min(0) commissionValue?: number;
    @IsOptional() @IsBoolean() overrideCreditLimit?: boolean;
    @IsOptional() @IsString() overrideReason?: string;
}

export class ReturnItemDto {
    @IsString() orderItemId!: string;
    @IsOptional() @IsNumber() @Min(1) returnQty?: number;
    @IsOptional() @IsNumber() @Min(1) quantity?: number;
    @IsOptional() @IsString() reason?: string;
    @IsOptional() @IsEnum(['RESTOCKABLE', 'DAMAGED']) condition?: 'RESTOCKABLE' | 'DAMAGED';
}

export class ReturnOrderDto {
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReturnItemDto) items?: ReturnItemDto[];
    @IsOptional() @IsString() reason?: string;
}

export class DispatchOrderItemDto {
    @IsString() orderItemId!: string;
    @IsNumber() @Min(0) dispatchQty!: number;
}

export class DispatchOrderDto {
    @IsOptional() @IsString() vehicleNumber?: string;
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DispatchOrderItemDto) items?: DispatchOrderItemDto[];
}

export class ListOrdersQueryDto {
    @IsOptional() @IsString() status?: string;
    @IsOptional() @IsString() search?: string;
    @IsOptional() @IsString() customerId?: string;
    @IsOptional() @IsString() salesmanId?: string;
    @IsOptional() @IsString() source?: string;
    @IsOptional() @IsString() dateFrom?: string;
    @IsOptional() @IsString() dateTo?: string;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) @Min(1) page?: number = 1;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) @Min(1) limit?: number = 20;
}

export class UpdateDraftOrderDto {
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items?: OrderItemDto[];
    @IsOptional() @IsString() notes?: string;
    @IsOptional() @IsDateString() deliveryDate?: string;
}

export class MarkPaidDto {
    @IsOptional() @IsEnum(['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT']) method?: 'CASH' | 'UPI' | 'CHEQUE' | 'BANK_TRANSFER' | 'CREDIT';
    @IsOptional() @IsNumber() @Min(0.01) amount?: number;
    @IsOptional() @IsString() referenceNumber?: string;
    @IsOptional() @IsString() notes?: string;
    @IsOptional() @IsString() date?: string;
}
