import { Controller, Post, Body, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';
import { Request } from 'express';

@Controller('shelf-audit')
@UseGuards(JwtAuthGuard)
export class ShelfAuditController {
    constructor(private readonly aiService: AiService) { }

    @Post()
    @UseInterceptors(FileInterceptor('image'))
    async processAudit(@Req() req: Request, @UploadedFile() file: any, @Body() body: { notes?: string }) {
        if (!file) throw new BadRequestException("Image file is required");
        const orgId = (req.user as any).orgId;
        await this.aiService.checkAndIncrementAIUsage(orgId);
        return this.aiService.processShelfAudit(orgId, file.buffer, file.mimetype, body.notes);
    }
}
