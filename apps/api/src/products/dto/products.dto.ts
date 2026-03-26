import {
    IsString, IsOptional, IsNumber, IsBoolean, IsArray,
    Min, Max, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
    @IsString() name!: string;
    @IsOptional() @IsString() sku?: string;
    @IsOptional() @IsString() barcode?: string;
    @IsOptional() @IsString() hsnCode?: string;
    @IsOptional() @IsString() category?: string;
    @IsOptional() @IsString() brand?: string;
    @IsString() unit!: string;
    @IsOptional() @IsString() secondaryUnit?: string;
    @IsOptional() @IsNumber() conversionFactor?: number;
    @IsOptional() @IsNumber() @Min(0) purchasePrice?: number;
    @IsNumber() @Min(0) sellingPrice!: number;
    @IsNumber() @Min(0) mrp!: number;
    @IsNumber() @Min(0) gstRate!: number;
    @IsOptional() @IsNumber() @Min(0) cessRate?: number;
    @IsOptional() @IsNumber() @Min(0) minStockLevel?: number;
    @IsOptional() @IsNumber() maxStockLevel?: number;
    @IsOptional() @IsNumber() leadTimeDays?: number;
    @IsOptional() @IsString() imageUrl?: string;
    @IsOptional() @IsString() description?: string;
    @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
    @IsOptional() @IsNumber() initialQuantity?: number;
}

export class UpdateProductDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsString() sku?: string;
    @IsOptional() @IsString() barcode?: string;
    @IsOptional() @IsString() hsnCode?: string;
    @IsOptional() @IsString() category?: string;
    @IsOptional() @IsString() brand?: string;
    @IsOptional() @IsString() unit?: string;
    @IsOptional() @IsString() secondaryUnit?: string;
    @IsOptional() @IsNumber() conversionFactor?: number;
    @IsOptional() @IsNumber() @Min(0) purchasePrice?: number;
    @IsOptional() @IsNumber() @Min(0) sellingPrice?: number;
    @IsOptional() @IsNumber() @Min(0) mrp?: number;
    @IsOptional() @IsNumber() @Min(0) gstRate?: number;
    @IsOptional() @IsNumber() @Min(0) minStockLevel?: number;
    @IsOptional() @IsNumber() maxStockLevel?: number;
    @IsOptional() @IsBoolean() isActive?: boolean;
    @IsOptional() @IsString() imageUrl?: string;
    @IsOptional() @IsString() description?: string;
}

export class ListProductsQueryDto {
    @IsOptional() @IsString() search?: string;
    @IsOptional() @IsString() category?: string;
    @IsOptional() @IsString() brand?: string;
    @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Type(() => Number) page?: number = 1;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(100) @Type(() => Number) limit?: number = 20;
}

export class ExpiringQueryDto {
    @IsOptional() @IsNumber() @Min(1) @Type(() => Number) days?: number = 30;
}
