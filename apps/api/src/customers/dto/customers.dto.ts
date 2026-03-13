import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
    @IsString() name!: string;
    @IsOptional() @IsString() contactPerson?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() email?: string;
    @IsOptional() @IsString() gstNumber?: string;
    @IsOptional() @IsString() fullAddress?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() state?: string;
    @IsOptional() @IsString() pincode?: string;
    @IsOptional() @IsEnum(['RETAILER', 'WHOLESALER', 'INSTITUTION', 'INDIVIDUAL']) type?: string;
    @IsOptional() @IsString() salesmanId?: string;
    @IsOptional() @IsNumber() creditLimit?: number;
    @IsOptional() @IsNumber() creditDays?: number;
    @IsOptional() @IsString() whatsappNumber?: string;
}

export class UpdateCustomerDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsString() contactPerson?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() email?: string;
    @IsOptional() @IsNumber() creditLimit?: number;
    @IsOptional() @IsNumber() creditDays?: number;
    @IsOptional() @IsBoolean() isActive?: boolean;
    @IsOptional() @IsEnum(['GOLD', 'SILVER', 'BRONZE']) tier?: string;
}

export class ListCustomersQueryDto {
    @IsOptional() @IsString() search?: string;
    @IsOptional() @IsString() type?: string;
    @IsOptional() @IsString() tier?: string;
    @IsOptional() @IsString() salesmanId?: string;
    @IsOptional() @IsString() routeId?: string;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Type(() => Number) page?: number = 1;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(100) @Type(() => Number) limit?: number = 20;
}

export class DormantQueryDto {
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Type(() => Number) days?: number = 30;
}
