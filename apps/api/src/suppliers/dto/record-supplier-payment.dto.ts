import { IsNumber, IsPositive, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SupplierPaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export class RecordSupplierPaymentDto {
  @ApiProperty({ description: 'Amount paid to supplier', example: 15000 })
  @IsNumber()
  @IsPositive({ message: 'Amount must be greater than zero' })
  amount!: number;

  @ApiPropertyOptional({ description: 'Payment date (YYYY-MM-DD)', example: '2026-08-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: SupplierPaymentMethod, default: SupplierPaymentMethod.CASH })
  @IsOptional()
  @IsEnum(SupplierPaymentMethod, { message: 'Invalid payment method' })
  paymentMethod?: SupplierPaymentMethod;

  @ApiPropertyOptional({ description: 'Reference number, cheque number, or notes', example: 'NEFT Ref #981248' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Optional linked Purchase Order ID' })
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;
}
