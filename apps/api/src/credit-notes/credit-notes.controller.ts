import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreditNotesService } from './credit-notes.service';

type CreditNoteStatus = 'ISSUED' | 'APPLIED' | 'VOID' | 'All';

@ApiTags('credit-notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credit-notes')
export class CreditNotesController {
    constructor(private readonly creditNotes: CreditNotesService) { }

    @Get()
    findAll(
        @CurrentUser() u: JwtPayload,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 20
    ) {
        return this.creditNotes.findAll(u.orgId, status as CreditNoteStatus, search, +page, +limit);
    }
}
