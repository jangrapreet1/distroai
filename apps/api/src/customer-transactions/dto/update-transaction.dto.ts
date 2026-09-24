import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerTransactionType, PaymentMethod } from '../customer-transactions.calculation';
import { CreateTransactionItemDto, UNICODE_TEXT_PATTERN } from './create-transaction-item.dto';
import { IsIsoDateOnly } from './validators/is-iso-date-only.decorator';
import { IsValidTransactionAmount } from './validators/is-valid-transaction-amount.decorator';

export class UpdateTransactionDto {
  @ApiPropertyOptional({
    description: 'Updated transaction date (YYYY-MM-DD)',
    example: '2026-08-05',
  })
  @IsOptional()
  @IsIsoDateOnly({ message: 'Date must be in YYYY-MM-DD format' })
  date?: string;

  @ApiPropertyOptional({
    description: 'Updated transaction type',
    enum: CustomerTransactionType,
    example: CustomerTransactionType.SALE,
  })
  @IsOptional()
  @IsEnum(CustomerTransactionType, {
    message: `Invalid transaction type. Must be one of: ${Object.values(CustomerTransactionType).join(', ')}`,
  })
  type?: CustomerTransactionType;

  @ApiPropertyOptional({
    description: 'Updated monetary amount',
    example: 5400.0,
  })
  @IsOptional()
  @IsValidTransactionAmount()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Updated transaction description',
    example: 'Corrected quantity after invoice audit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(UNICODE_TEXT_PATTERN, {
    message: 'Description contains invalid or unprintable characters',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated payment method',
    enum: PaymentMethod,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Updated external reference',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @ApiPropertyOptional({
    description: 'Updated notes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Replacement itemized line items (replaces full item set)',
    type: [CreateTransactionItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionItemDto)
  items?: CreateTransactionItemDto[];
}
