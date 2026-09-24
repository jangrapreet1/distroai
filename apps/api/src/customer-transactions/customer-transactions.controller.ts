import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { CustomerTransactionsService } from './customer-transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';

@ApiTags('customer-transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomerTransactionsController {
  constructor(private readonly service: CustomerTransactionsService) {}

  /**
   * 1. Create Transaction with Items
   * POST /api/v1/customers/:customerId/transactions
   */
  @Post(':customerId/transactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create customer financial transaction',
    description:
      'Creates a new transaction (SALE, RETURN, PAYMENT, ADJUSTMENT) with optional line items, atomically recalculates customer outstanding balance, and writes an audit log snapshot.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer UUID', type: String })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({ status: 201, description: 'Transaction successfully created and customer balance updated' })
  @ApiResponse({ status: 400, description: 'Validation failed (e.g. malformed date, negative amount, invalid type)' })
  @ApiResponse({ status: 401, description: 'Unauthorized access token' })
  @ApiResponse({ status: 404, description: 'Customer not found within organization' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.service.create(user.orgId, customerId, user.sub, dto);
  }

  /**
   * 2. Get Chronological Ledger and Running Balance Summary
   * GET /api/v1/customers/:customerId/ledger
   */
  @Get(':customerId/ledger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get customer date-wise ledger',
    description:
      'Retrieves chronologically sorted transactions (date ASC, createdAt ASC) with running balances and summary totals (Total Goods Given, Goods Returned, Payments Received, Net Balance).',
  })
  @ApiParam({ name: 'customerId', description: 'Customer UUID', type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter end date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by transaction type (SALE, RETURN, PAYMENT, ADJUSTMENT)' })
  @ApiResponse({ status: 200, description: 'Ledger entries and summary successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized access token' })
  @ApiResponse({ status: 404, description: 'Customer not found within organization' })
  async getLedger(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
    @Query() query: LedgerQueryDto,
  ) {
    return this.service.findAllLedger(user.orgId, customerId, query);
  }

  /**
   * 3. Get Single Transaction Details
   * GET /api/v1/customers/:customerId/transactions/:id
   */
  @Get(':customerId/transactions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get single customer transaction',
    description: 'Fetches transaction details including immutable line item snapshots for the given customer.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer UUID', type: String })
  @ApiParam({ name: 'id', description: 'Transaction UUID', type: String })
  @ApiResponse({ status: 200, description: 'Transaction details retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized access token' })
  @ApiResponse({ status: 404, description: 'Transaction or customer not found within organization' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(user.orgId, customerId, id);
  }

  /**
   * 4. Update Transaction
   * PATCH /api/v1/customers/:customerId/transactions/:id
   */
  @Patch(':customerId/transactions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update customer transaction',
    description:
      'Updates transaction attributes or line items, atomically recalculates customer balance, and records before/after audit log snapshot.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer UUID', type: String })
  @ApiParam({ name: 'id', description: 'Transaction UUID', type: String })
  @ApiBody({ type: UpdateTransactionDto })
  @ApiResponse({ status: 200, description: 'Transaction updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized access token' })
  @ApiResponse({ status: 404, description: 'Transaction or customer not found within organization' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.service.update(user.orgId, customerId, id, user.sub, dto);
  }

  /**
   * 5. Delete Transaction
   * DELETE /api/v1/customers/:customerId/transactions/:id
   */
  @Delete(':customerId/transactions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete customer transaction',
    description:
      'Permanently deletes a transaction, atomically recalculates customer outstanding balance, and stores the deleted row snapshot in the audit log.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer UUID', type: String })
  @ApiParam({ name: 'id', description: 'Transaction UUID', type: String })
  @ApiResponse({ status: 200, description: 'Transaction deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized access token' })
  @ApiResponse({ status: 404, description: 'Transaction or customer not found within organization' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(user.orgId, customerId, id, user.sub);
  }

  /**
   * 6. Get RTK Statement Data (JSON)
   * GET /api/v1/customers/:customerId/statement
   */
  @Get(':customerId/statement')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get structured RTK 5-column statement data',
    description:
      'Returns structured statement payload containing active organization profile, customer profile, unaggregated 5-column ledger rows, and RTK summary box totals.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer UUID', type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter end date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Statement data successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized access token' })
  @ApiResponse({ status: 404, description: 'Customer not found within organization' })
  async getStatement(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
    @Query() query: LedgerQueryDto,
  ) {
    return this.service.getStatementData(user.orgId, customerId, query);
  }

  /**
   * 7. Stream RTK Statement PDF (Binary)
   * GET /api/v1/customers/:customerId/statement/pdf
   */
  @Get(':customerId/statement/pdf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Download RTK 5-Column Statement PDF',
    description:
      'Compiles and streams a single-page A4 PDF matching the Radhakishan Trading Company reference layout with native Devanagari Hindi font rendering.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer UUID', type: String })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'Binary PDF stream' })
  @ApiResponse({ status: 401, description: 'Unauthorized access token' })
  @ApiResponse({ status: 404, description: 'Customer not found within organization' })
  async downloadStatementPdf(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
    @Query() query: LedgerQueryDto,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.service.generateStatementPdf(user.orgId, customerId, query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="statement-${customerId}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }
}
