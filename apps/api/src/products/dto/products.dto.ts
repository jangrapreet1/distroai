import {
    IsString, IsOptional, IsNumber, IsBoolean, IsArray,
    Min, Max, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ToBoolean } from '../../common/decorators/to-boolean.decorator';

export class CreateProductDto {
    @IsString() name!: string;
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
    @IsOptional() @IsNumber() @Min(0) cessRate?: number;
    @IsOptional() @IsNumber() @Min(0) minStockLevel?: number;
    @IsOptional() @IsNumber() maxStockLevel?: number;
    @IsOptional() @IsNumber() leadTimeDays?: number;
    @IsOptional() @IsBoolean() isDraft?: boolean;
    @IsOptional() @IsString() imageUrl?: string;
    @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[];
    @IsOptional() @IsString() description?: string;
    @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
    @IsOptional() @IsNumber() initialQuantity?: number;
    @IsOptional() @IsString() commissionType?: string | null;
    @IsOptional() @IsNumber() commissionValue?: number;
    @IsOptional() @IsBoolean() hasVariants?: boolean;
    @IsOptional() variantAttributes?: any;
    @IsOptional() @IsArray() variants?: any[];
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
    @IsOptional() @IsNumber() @Min(0) cessRate?: number;
    @IsOptional() @IsNumber() @Min(0) minStockLevel?: number;
    @IsOptional() @IsNumber() maxStockLevel?: number;
    @IsOptional() @IsNumber() leadTimeDays?: number;
    @IsOptional() @IsBoolean() isActive?: boolean;
    @IsOptional() @IsBoolean() isDraft?: boolean;
    @IsOptional() @IsString() imageUrl?: string;
    @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[];
    @IsOptional() @IsString() description?: string;
    @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
    @IsOptional() @IsString() commissionType?: string | null;
    @IsOptional() @IsNumber() commissionValue?: number;
    @IsOptional() @IsBoolean() hasVariants?: boolean;
    @IsOptional() variantAttributes?: any;
    @IsOptional() @IsArray() variants?: any[];
}

export class ListProductsQueryDto {
    @IsOptional() @IsString() search?: string;
    @IsOptional() @IsString() category?: string;
    @IsOptional() @IsString() brand?: string;
    @ApiPropertyOptional()
    @IsOptional()
    @ToBoolean()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @ToBoolean()
    @IsBoolean()
    isDraft?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Type(() => Number) page?: number = 1;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(100) @Type(() => Number) limit?: number = 20;
}

export class ExpiringQueryDto {
    @IsOptional() @IsNumber() @Min(1) @Type(() => Number) days?: number = 30;
}
