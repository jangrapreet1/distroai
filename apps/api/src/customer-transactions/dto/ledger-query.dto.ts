import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerTransactionType } from '../customer-transactions.calculation';
import { IsIsoDateOnly } from './validators/is-iso-date-only.decorator';

export class LedgerQueryDto {
  @ApiPropertyOptional({ description: 'Filter start date (YYYY-MM-DD)', example: '2026-08-01' })
  @IsOptional()
  @IsIsoDateOnly({ message: 'startDate must be in YYYY-MM-DD format' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter start date alias (dateFrom)', example: '2026-08-01' })
  @IsOptional()
  @IsIsoDateOnly({ message: 'dateFrom must be in YYYY-MM-DD format' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter end date (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsIsoDateOnly({ message: 'endDate must be in YYYY-MM-DD format' })
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter end date alias (dateTo)', example: '2026-08-31' })
  @IsOptional()
  @IsIsoDateOnly({ message: 'dateTo must be in YYYY-MM-DD format' })
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by transaction type', enum: CustomerTransactionType })
  @IsOptional()
  @IsEnum(CustomerTransactionType)
  type?: CustomerTransactionType;

  @ApiPropertyOptional({ description: 'Initial opening balance before range', example: 0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  initialBalance?: number;

  @ApiPropertyOptional({ description: 'Include synthetic opening balance row in ledger output', example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true || value === '1' || value === 1)
  includeOpeningBalanceRow?: boolean;

  @ApiPropertyOptional({ description: 'Statement document date (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsIsoDateOnly({ message: 'statementDate must be in YYYY-MM-DD format' })
  statementDate?: string;

  @ApiPropertyOptional({ description: 'Pagination page (1-based)', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Pagination limit (max 500)', example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number;
}
