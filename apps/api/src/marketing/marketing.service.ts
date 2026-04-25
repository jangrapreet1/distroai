import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../common/utils/crypto.util';
import { nanoid } from 'nanoid';

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

@Injectable()
export class MarketingService {
    private readonly logger = new Logger(MarketingService.name);

    constructor(private prisma: PrismaService) { }

    // ─── OAuth Connect ──────────────────────────────────────────
    async connectMeta(orgId: string, code: string, redirectUri: string) {
        // Exchange short-lived code for a long-lived token
        const tokenRes = await fetch(
            `${META_GRAPH_BASE}/oauth/access_token?` +
            `client_id=${process.env.META_APP_ID}` +
            `&client_secret=${process.env.META_APP_SECRET}` +
            `&grant_type=authorization_code` +
            `&code=${encodeURIComponent(code)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}`,
        );
        const tokenData: any = await tokenRes.json();

        if (tokenData.error) {
            this.logger.error('Meta OAuth token exchange failed', tokenData.error);
            throw new BadRequestException(tokenData.error.message || 'Failed to connect Meta account');
        }

        // Exchange for a long-lived token (60 days)
        const longLivedRes = await fetch(
            `${META_GRAPH_BASE}/oauth/access_token?` +
            `grant_type=fb_exchange_token` +
            `&client_id=${process.env.META_APP_ID}` +
            `&client_secret=${process.env.META_APP_SECRET}` +
            `&fb_exchange_token=${tokenData.access_token}`,
        );
        const longLivedData: any = await longLivedRes.json();
        const accessToken = longLivedData.access_token || tokenData.access_token;

        // Fetch the user's ad accounts
        const adAccountsRes = await fetch(
            `${META_GRAPH_BASE}/me/adaccounts?fields=id,name,currency&access_token=${accessToken}`,
        );
        const adAccountsData: any = await adAccountsRes.json();
        const adAccount = adAccountsData.data?.[0];

        if (!adAccount) {
            throw new BadRequestException('No ad account found on this Facebook account. Please create one in Meta Business Suite first.');
        }

        // Fetch connected Facebook Page ID
        const pagesRes = await fetch(
            `${META_GRAPH_BASE}/me/accounts?fields=id,name&access_token=${accessToken}`,
        );
        const pagesData: any = await pagesRes.json();
        const fbPage = pagesData.data?.[0];
        const fbPageId = fbPage?.id || null;

        // Fetch Instagram Business Account linked to the Page
        let igActorId: string | null = null;
        if (fbPageId) {
            const igRes = await fetch(
                `${META_GRAPH_BASE}/${fbPageId}?fields=instagram_business_account&access_token=${accessToken}`,
            );
            const igData: any = await igRes.json();
            igActorId = igData?.instagram_business_account?.id || null;
        }

        // Store encrypted token + Page/IG IDs in OrgSettings
        const encryptedToken = encrypt(accessToken);
        await this.prisma.orgSettings.upsert({
            where: { orgId },
            update: {
                metaAccessToken: encryptedToken,
                metaAdAccountId: adAccount.id,
                metaFbPageId: fbPageId,
                metaInstagramActorId: igActorId,
                metaTokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
            } as any,
            create: {
                orgId,
                metaAccessToken: encryptedToken,
                metaAdAccountId: adAccount.id,
                metaFbPageId: fbPageId,
                metaInstagramActorId: igActorId,
                metaTokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            } as any,
        });

        return {
            connected: true,
            adAccountId: adAccount.id,
            adAccountName: adAccount.name,
            fbPageId,
            igActorId,
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        };
    }

    // ─── OAuth Status ───────────────────────────────────────────
    async getConnectionStatus(orgId: string) {
        const settings: any = await this.prisma.orgSettings.findUnique({ where: { orgId } });
        if (!settings?.metaAccessToken) {
            return { connected: false };
        }

        const isExpired = settings.metaTokenExpiresAt && new Date(settings.metaTokenExpiresAt) < new Date();
        return {
            connected: !isExpired,
            adAccountId: settings.metaAdAccountId || null,
            expiresAt: settings.metaTokenExpiresAt || null,
            isExpired,
        };
    }

    // ─── OAuth Disconnect ───────────────────────────────────────
    async disconnectMeta(orgId: string) {
        // Pause all active campaigns first
        await (this.prisma as any).marketingCampaign.updateMany({
            where: { orgId, status: 'ACTIVE' },
            data: { status: 'PAUSED' },
        });

        await this.prisma.orgSettings.update({
            where: { orgId },
            data: {
                metaAccessToken: null,
                metaAdAccountId: null,
                metaFbPageId: null,
                metaInstagramActorId: null,
                metaTokenExpiresAt: null,
            } as any,
        });

        return { disconnected: true };
    }

    // ─── Resolve Meta Token ─────────────────────────────────────
    private async resolveMetaToken(orgId: string): Promise<{ token: string; adAccountId: string; fbPageId: string | null }> {
        const settings: any = await this.prisma.orgSettings.findUnique({ where: { orgId } });
        if (!settings?.metaAccessToken) {
            throw new BadRequestException('Meta account not connected. Go to Settings → Integrations → Connect Facebook.');
        }
        if (settings.metaTokenExpiresAt && new Date(settings.metaTokenExpiresAt) < new Date()) {
            throw new BadRequestException('Meta access token expired. Please reconnect your Facebook account.');
        }
        return {
            token: decrypt(settings.metaAccessToken),
            adAccountId: settings.metaAdAccountId,
            fbPageId: settings.metaFbPageId || null,
        };
    }

    // ─── Create Campaign ────────────────────────────────────────
    async createCampaign(orgId: string, input: {
        objective: string;
        platform: string[];
        userType: string;
        dailyBudget: number;
        startDate: string;
        endDate?: string;
        adCreative: { headline: string; body: string; cta: string };
        targetingRadius?: number;
        targetingLatitude?: number;
        targetingLongitude?: number;
        customAudienceId?: string;
        linkUrl?: string;
    }) {
        const { token, adAccountId, fbPageId } = await this.resolveMetaToken(orgId);

        if (!fbPageId) {
            throw new BadRequestException('No Facebook Page linked. Please reconnect your Facebook account and ensure you have a Page.');
        }

        const utmCampaignId = `distro_${nanoid(10)}`;

        // Budget in paisa → Meta expects cents (paisa for INR)
        const dailyBudgetPaisa = Math.round(input.dailyBudget * 100);

        // 1. Create Campaign on Meta
        const campaignRes = await fetch(`${META_GRAPH_BASE}/${adAccountId}/campaigns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: token,
                name: `DistroAI - ${utmCampaignId}`,
                objective: this.mapObjective(input.objective),
                status: 'PAUSED', // Start paused, activate after full setup
                special_ad_categories: [],
            }),
        });
        const campaignData: any = await campaignRes.json();
        if (campaignData.error) {
            this.logger.error('Meta campaign creation failed', campaignData.error);
            throw this.handleMetaError(campaignData.error);
        }
        const metaCampaignId = campaignData.id;

        // 2. Create AdSet with targeting
        const targeting: any = {};
        if (input.targetingLatitude && input.targetingLongitude && input.targetingRadius) {
            targeting.geo_locations = {
                custom_locations: [{
                    latitude: input.targetingLatitude,
                    longitude: input.targetingLongitude,
                    radius: input.targetingRadius,
                    distance_unit: 'kilometer',
                }],
            };
        }
        if (input.customAudienceId) {
            targeting.custom_audiences = [{ id: input.customAudienceId }];
        }

        const adSetRes = await fetch(`${META_GRAPH_BASE}/${adAccountId}/adsets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: token,
                campaign_id: metaCampaignId,
                name: `AdSet - ${utmCampaignId}`,
                daily_budget: dailyBudgetPaisa,
                billing_event: 'IMPRESSIONS',
                optimization_goal: input.objective === 'MESSAGES' ? 'CONVERSATIONS' : 'REACH',
                targeting,
                start_time: input.startDate,
                ...(input.endDate && { end_time: input.endDate }),
                status: 'PAUSED',
            }),
        });
        const adSetData: any = await adSetRes.json();
        if (adSetData.error) {
            this.logger.error('Meta adset creation failed', adSetData.error);
            throw this.handleMetaError(adSetData.error);
        }
        const metaAdsetId = adSetData.id;

        // 3. Build link URL with UTM tracking
        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        const baseUrl = input.linkUrl || `https://distroai.in/store/${org?.slug || orgId}`;
        const trackedUrl = `${baseUrl}?utm_campaign=${utmCampaignId}`;

        // 4. Create Ad Creative + Ad — using fbPageId from OrgSettings (not hardcoded)
        const adCreativeRes = await fetch(`${META_GRAPH_BASE}/${adAccountId}/adcreatives`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: token,
                name: `Creative - ${utmCampaignId}`,
                object_story_spec: {
                    page_id: fbPageId,
                    link_data: {
                        message: input.adCreative.body,
                        link: trackedUrl,
                        name: input.adCreative.headline,
                        call_to_action: {
                            type: this.mapCta(input.adCreative.cta),
                            value: { link: trackedUrl },
                        },
                    },
                },
            }),
        });
        const adCreativeData: any = await adCreativeRes.json();

        const adRes = await fetch(`${META_GRAPH_BASE}/${adAccountId}/ads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: token,
                adset_id: metaAdsetId,
                creative: { creative_id: adCreativeData.id },
                name: `Ad - ${utmCampaignId}`,
                status: 'ACTIVE',
            }),
        });
        const adData: any = await adRes.json();

        // Activate the campaign + adset
        await fetch(`${META_GRAPH_BASE}/${metaCampaignId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token, status: 'ACTIVE' }),
        });
        await fetch(`${META_GRAPH_BASE}/${metaAdsetId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token, status: 'ACTIVE' }),
        });

        // 5. Store in DB
        const campaign = await (this.prisma as any).marketingCampaign.create({
            data: {
                orgId,
                metaCampaignId,
                metaAdsetId,
                metaAdId: adData.id || null,
                objective: input.objective,
                platform: input.platform,
                userType: input.userType,
                dailyBudget: input.dailyBudget,
                status: 'ACTIVE',
                utmCampaignId,
                customAudienceId: input.customAudienceId || null,
                startDate: new Date(input.startDate),
                endDate: input.endDate ? new Date(input.endDate) : null,
            },
        });

        this.logger.log(`Campaign ${campaign.id} created for org ${orgId} — Meta ID: ${metaCampaignId}`);
        return campaign;
    }

    // ─── List Campaigns ─────────────────────────────────────────
    async listCampaigns(orgId: string) {
        return (this.prisma as any).marketingCampaign.findMany({
            where: { orgId },
            include: {
                metrics: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─── Get Campaign Detail ────────────────────────────────────
    async getCampaign(orgId: string, campaignId: string) {
        const campaign = await (this.prisma as any).marketingCampaign.findFirst({
            where: { id: campaignId, orgId },
            include: { metrics: { orderBy: { date: 'desc' } } },
        });
        if (!campaign) throw new NotFoundException('Campaign not found');
        return campaign;
    }

    // ─── Pause / Resume / Delete ────────────────────────────────
    async updateCampaignStatus(orgId: string, campaignId: string, action: 'pause' | 'resume' | 'delete') {
        const campaign = await (this.prisma as any).marketingCampaign.findFirst({
            where: { id: campaignId, orgId },
        });
        if (!campaign) throw new NotFoundException('Campaign not found');

        const { token } = await this.resolveMetaToken(orgId);
        const metaStatus = action === 'pause' ? 'PAUSED' : action === 'resume' ? 'ACTIVE' : 'DELETED';

        await fetch(`${META_GRAPH_BASE}/${campaign.metaCampaignId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token, status: metaStatus }),
        });

        const localStatus = action === 'delete' ? 'DELETED' : metaStatus;
        return (this.prisma as any).marketingCampaign.update({
            where: { id: campaignId },
            data: { status: localStatus },
        });
    }

    // ─── Delete Campaign ────────────────────────────────────────
    async deleteCampaign(orgId: string, campaignId: string) {
        return this.updateCampaignStatus(orgId, campaignId, 'delete');
    }

    // ─── Helpers ────────────────────────────────────────────────
    private mapObjective(obj: string): string {
        const map: Record<string, string> = {
            MESSAGES: 'OUTCOME_ENGAGEMENT',
            CATALOG_SALES: 'OUTCOME_SALES',
            REACH: 'OUTCOME_AWARENESS',
        };
        return map[obj] || 'OUTCOME_AWARENESS';
    }

    private mapCta(cta: string): string {
        const map: Record<string, string> = {
            'Buy Now': 'SHOP_NOW',
            'Send Message': 'SEND_WHATSAPP_MESSAGE',
            'Learn More': 'LEARN_MORE',
            'Order Now': 'SHOP_NOW',
        };
        return map[cta] || 'LEARN_MORE';
    }

    private handleMetaError(error: any): BadRequestException {
        const code = error.code;
        const msg = error.message || 'Unknown Meta API error';

        if (code === 190) {
            return new BadRequestException('Meta access token expired. Please reconnect your Facebook account.');
        }
        if (code === 1487390) {
            return new BadRequestException('Meta ad account spend limit reached. Please add funds to your Meta ad account.');
        }
        return new BadRequestException(`Meta API error: ${msg}`);
    }
}
