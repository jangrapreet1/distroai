import { IsString, IsOptional, IsNumber, IsArray, IsEnum, ValidateNested, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
    @IsString() productId!: string;
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
}

export class ReturnItemDto {
    @IsString() orderItemId!: string;
    @IsNumber() @Min(1) returnQty!: number;
    @IsString() reason!: string;
}

export class ReturnOrderDto {
    @IsArray() @ValidateNested({ each: true }) @Type(() => ReturnItemDto) items!: ReturnItemDto[];
    @IsOptional() @IsString() reason?: string;
}

export class DispatchOrderDto {
    @IsOptional() @IsString() vehicleNumber?: string;
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
}
