import { Controller, Post, Get, Body, Param, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile, Sse, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';
import { Request } from 'express';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('query')
    async handleQuery(@Req() req: Request, @Body() body: { query: string }) {
        const orgId = (req.user as any).orgId;
        const userId = (req.user as any).id;
        await this.aiService.checkAndIncrementAIUsage(orgId);
        return this.aiService.query(orgId, userId, body.query);
    }

    @Post('query/stream')
    @Sse()
    async streamQuery(@Req() req: Request, @Body() body: { query: string; image?: string }) {
        const orgId = (req.user as any).orgId;
        const userId = (req.user as any).id;
        await this.aiService.checkAndIncrementAIUsage(orgId);
        return this.aiService.queryStream(orgId, userId, body.query, body.image);
    }

    @Post('voice-query')
    @UseInterceptors(FileInterceptor('audio'))
    async handleVoiceQuery(@Req() req: Request, @UploadedFile() file: any) {
        if (!file) throw new Error("Audio file required");
        const orgId = (req.user as any).orgId;
        const userId = (req.user as any).id;
        await this.aiService.checkAndIncrementAIUsage(orgId);
        return this.aiService.voiceQuery(orgId, userId, file.buffer, file.mimetype);
    }

    @Get('insights/customer/:id')
    async getCustomerInsights(@Req() req: Request, @Param('id') customerId: string) {
        const orgId = (req.user as any).orgId;
        return this.aiService.getCustomerInsights(orgId, customerId);
    }

    @Get('insights/sales')
    async getSalesInsights(@Req() req: Request) {
        const orgId = (req.user as any).orgId;
        return this.aiService.getSalesInsights(orgId);
    }

    @Get('insights/schemes')
    async getSchemeRecommendations(@Req() req: Request) {
        const orgId = (req.user as any).orgId;
        return this.aiService.getSchemeRecommendations(orgId);
    }

    @Get('products/search')
    async searchProducts(@Req() req: Request, @Query('q') q: string) {
        const orgId = (req.user as any).orgId;
        if (!q) throw new BadRequestException("Query parameter 'q' is required");
        return this.aiService.semanticProductSearch(orgId, q);
    }

    @Post('products/backfill-embeddings')
    async backfillEmbeddings(@Req() req: Request) {
        const orgId = (req.user as any).orgId;
        return this.aiService.backfillEmbeddings(orgId);
    }
}
