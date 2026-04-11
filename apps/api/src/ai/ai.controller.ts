import { Controller, Post, Get, Body, Param, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';
import { Request } from 'express';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('query')
    async handleQuery(@Req() req: Request, @Body() body: { query: string; sessionId?: string }) {
        const orgId = (req.user as any).orgId;
        const userId = (req.user as any).sub;
        await this.aiService.checkAndIncrementAIUsage(orgId);
        return this.aiService.query(orgId, userId, body.query, body.sessionId);
    }

    @Get('history')
    async getHistory(@Req() req: Request) {
        const orgId = (req.user as any).orgId;
        const userId = (req.user as any).sub;
        return this.aiService.getHistory(orgId, userId);
    }

    @Get('usage')
    async getUsage(@Req() req: Request) {
        const orgId = (req.user as any).orgId;
        return this.aiService.getUsage(orgId);
    }

    @Post('query/stream')
    async streamQuery(@Req() req: Request, @Res() res: any, @Body() body: { query: string; image?: string; sessionId?: string }) {
        const orgId = (req.user as any).orgId;
        const userId = (req.user as any).sub;

        // Check quota BEFORE setting SSE headers so we can return a proper error
        try {
            await this.aiService.checkAndIncrementAIUsage(orgId);
        } catch (err: any) {
            // Send quota error as SSE so the frontend can display it gracefully
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
            const msg = err?.response?.message || 'Monthly AI query limit reached. Upgrade your plan for more.';
            res.write(`data: ${JSON.stringify({ token: `⚠️ ${msg}`, done: true, error: 'AI_QUOTA_EXCEEDED' })}\n\n`);
            res.end();
            return;
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        try {
            for await (const chunk of this.aiService.queryStream(orgId, userId, body.query, body.image, body.sessionId)) {
                res.write(`data: ${chunk.data}\n\n`);
            }
        } catch (err: any) {
            res.write(`data: ${JSON.stringify({ token: '\n[Error processing query]', done: true })}\n\n`);
        } finally {
            res.end();
        }
    }

    @Post('voice-query')
    @UseInterceptors(FileInterceptor('audio'))
    async handleVoiceQuery(@Req() req: Request, @Body('sessionId') sessionId: string, @UploadedFile() file: any) {
        if (!file) throw new Error("Audio file required");
        const orgId = (req.user as any).orgId;
        const userId = (req.user as any).sub;
        await this.aiService.checkAndIncrementAIUsage(orgId);
        return this.aiService.voiceQuery(orgId, userId, file.buffer, file.mimetype, sessionId || undefined);
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
