import { IsEmail, IsOptional, IsString, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRole {
    OWNER = 'OWNER', ADMIN = 'ADMIN', MANAGER = 'MANAGER',
    SALESMAN = 'SALESMAN', ACCOUNTANT = 'ACCOUNTANT', VIEWER = 'VIEWER',
}

export class CreateUserDto {
    @IsEmail() email!: string;
    @IsString() firstName!: string;
    @IsOptional() @IsString() lastName?: string;
    @IsOptional() @IsString() phone?: string;
    @IsEnum(UserRole) role!: UserRole;
}

export class UpdateUserDto {
    @IsOptional() @IsString() firstName?: string;
    @IsOptional() @IsString() lastName?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() avatarUrl?: string;
    @IsOptional() @IsString() preferredLang?: string;
}

export class UpdateRoleDto {
    @IsEnum(UserRole) role!: UserRole;
}

export class ListUsersQueryDto {
    @ApiPropertyOptional() @IsOptional() @IsEnum(UserRole) role?: UserRole;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Type(() => Number) page?: number = 1;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(100) @Type(() => Number) limit?: number = 20;
}
