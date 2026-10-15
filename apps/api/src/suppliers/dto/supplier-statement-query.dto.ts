import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierStatementQueryDto {
  @ApiPropertyOptional({ description: 'Filter start date (YYYY-MM-DD)', example: '2026-08-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter end date (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Statement document date (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsString()
  statementDate?: string;
}
