import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Body,
    Param,
    Req,
    UseGuards,
    Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanLimitGuard } from '../common/guards/plan-limit.guard';
import { RequiresFeature } from '../common/decorators/plan.decorator';
import { MarketingService } from './marketing.service';
import { CreativeService } from './creative.service';
import { AudienceService } from './audience.service';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/utils/crypto.util';

@Controller('marketing')
@UseGuards(JwtAuthGuard, PlanLimitGuard)
@RequiresFeature('metaAds')
export class MarketingController {
    private readonly logger = new Logger(MarketingController.name);

    constructor(
        private marketing: MarketingService,
        private creative: CreativeService,
        private audience: AudienceService,
        private prisma: PrismaService,
    ) { }

    // ─── OAuth ──────────────────────────────────────────────────
    @Post('connect')
    async connect(@Req() req: any, @Body() body: { code: string; redirectUri: string }) {
        return this.marketing.connectMeta(req.user.orgId, body.code, body.redirectUri);
    }

    @Get('status')
    async status(@Req() req: any) {
        return this.marketing.getConnectionStatus(req.user.orgId);
    }

    @Delete('disconnect')
    async disconnect(@Req() req: any) {
        return this.marketing.disconnectMeta(req.user.orgId);
    }

    // ─── Campaigns ──────────────────────────────────────────────
    @Post('campaigns')
    async createCampaign(@Req() req: any, @Body() body: any) {
        return this.marketing.createCampaign(req.user.orgId, body);
    }

    @Get('campaigns')
    async listCampaigns(@Req() req: any) {
        return this.marketing.listCampaigns(req.user.orgId);
    }

    @Get('campaigns/:id')
    async getCampaign(@Req() req: any, @Param('id') id: string) {
        return this.marketing.getCampaign(req.user.orgId, id);
    }

    @Patch('campaigns/:id')
    async updateCampaign(@Req() req: any, @Param('id') id: string, @Body() body: { action: 'pause' | 'resume' | 'delete' }) {
        return this.marketing.updateCampaignStatus(req.user.orgId, id, body.action);
    }

    @Delete('campaigns/:id')
    async deleteCampaign(@Req() req: any, @Param('id') id: string) {
        return this.marketing.deleteCampaign(req.user.orgId, id);
    }

    // ─── Creative Studio ────────────────────────────────────────
    @Post('creatives/generate')
    async generateCreatives(@Req() req: any, @Body() body: { productId: string; userType: 'B2B' | 'B2C' }) {
        const product = await this.prisma.product.findFirst({
            where: { id: body.productId, orgId: req.user.orgId },
        });
        if (!product) {
            return { error: 'Product not found' };
        }

        const org = await this.prisma.organization.findUnique({ where: { id: req.user.orgId } });
        return this.creative.generateAdCreatives(
            {
                name: product.name,
                mrp: product.mrp ? Number(product.mrp) : null,
                category: product.category,
                brand: product.brand,
                description: product.description,
            },
            {
                city: org?.city || 'India',
                userType: body.userType,
            },
        );
    }

    // ─── Custom Audiences ───────────────────────────────────────
    @Post('audiences/upload')
    async uploadAudience(@Req() req: any) {
        const settings: any = await this.prisma.orgSettings.findUnique({
            where: { orgId: req.user.orgId },
        });
        if (!settings?.metaAccessToken || !settings?.metaAdAccountId) {
            return { error: 'Meta account not connected. Go to Settings → Connect Facebook.' };
        }

        const token = decrypt(settings.metaAccessToken);
        return this.audience.uploadCustomAudience(req.user.orgId, token, settings.metaAdAccountId);
    }
}
