import { IsEmail, IsString, IsOptional, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ example: 'Acme Traders' })
    @IsString()
    orgName!: string;

    @ApiProperty({ example: '+919876543210' })
    @IsString()
    @Matches(/^[6-9]\d{9}$/, { message: 'Phone must be a valid Indian mobile number (10 digits starting with 6-9)' })
    phone!: string;

    @ApiPropertyOptional({ example: 'Mumbai' })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiPropertyOptional({ example: 'Maharashtra' })
    @IsOptional()
    @IsString()
    state?: string;

    @ApiProperty({ example: 'owner@acme.in' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'SecurePass@123' })
    @IsString()
    @MinLength(8)
    password!: string;

    @ApiProperty({ example: 'Rahul' })
    @IsString()
    firstName!: string;

    @ApiPropertyOptional({ example: 'Sharma' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiPropertyOptional({ example: '27AADCB2230M1Z2' })
    @IsOptional()
    @IsString()
    gstNumber?: string;

    @ApiPropertyOptional({ example: 'Distribution' })
    @IsOptional()
    @IsString()
    businessType?: string;

    @ApiPropertyOptional({ example: 'FMCG' })
    @IsOptional()
    @IsString()
    sector?: string;
}

export class LoginDto {
    @ApiProperty({ example: 'owner@acme.in' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'SecurePass@123' })
    @IsString()
    password!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    orgId?: string;
}

export class RefreshTokenDto {
    @ApiProperty()
    @IsString()
    refreshToken!: string;
}

export class LogoutDto {
    @ApiProperty()
    @IsString()
    refreshToken!: string;
}

export class ForgotPasswordDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsEmail()
    email?: string;
}

export class ResetPasswordDto {
    @ApiProperty({ example: 'owner@acme.in or +919876543210' })
    @IsString()
    identifier!: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    otp!: string;

    @ApiProperty({ example: 'NewSecurePass@123' })
    @IsString()
    @MinLength(8)
    newPassword!: string;
}
