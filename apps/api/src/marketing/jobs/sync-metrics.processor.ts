import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { decrypt } from '../../common/utils/crypto.util';

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

/**
 * BullMQ processor: syncs Meta Insights every 6 hours.
 * RULE 5: Only processes ACTIVE campaigns or those updated within 30 days.
 *         Handles Meta error codes 190 (token expired) and 1487390 (spend limit).
 */
@Processor('marketing')
export class MetricsSyncProcessor extends WorkerHost {
    private readonly logger = new Logger(MetricsSyncProcessor.name);

    constructor(
        private prisma: PrismaService,
        private wa: WhatsAppService,
    ) {
        super();
    }

    async process(job: Job) {
        if (job.name !== 'sync-metrics') return;

        this.logger.log('Starting marketing metrics sync...');

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const campaigns = await (this.prisma as any).marketingCampaign.findMany({
            where: {
                OR: [
                    { status: 'ACTIVE' },
                    { updatedAt: { gte: thirtyDaysAgo } },
                ],
            },
            include: {
                organization: {
                    include: { settings: true },
                },
            },
        });

        this.logger.log(`Processing ${campaigns.length} campaigns for metrics sync`);

        for (const campaign of campaigns) {
            try {
                await this.syncCampaignMetrics(campaign);
            } catch (err: any) {
                const metaCode = err.metaCode || err.code;

                if (metaCode === 190 || metaCode === 1487390) {
                    const errorReason = metaCode === 190
                        ? 'Meta access token expired. Reconnect your Facebook account.'
                        : 'Aapka ad ruk gaya — Meta account mein balance khatam hua. Funds add karein.';

                    await (this.prisma as any).marketingCampaign.update({
                        where: { id: campaign.id },
                        data: { status: 'ERROR', errorReason },
                    });

                    // Send WhatsApp alert to the distributor
                    await this.sendWhatsAppAlert(campaign.orgId, errorReason);
                }

                this.logger.error(`Metrics sync failed for campaign ${campaign.id}`, err.message || err);
                // Continue — don't let one failure stop the whole batch
            }
        }

        this.logger.log('Marketing metrics sync completed');
    }

    private async syncCampaignMetrics(campaign: any) {
        const settings = campaign.organization?.settings;
        if (!settings?.metaAccessToken) {
            this.logger.warn(`No Meta token for org ${campaign.orgId} — skipping campaign ${campaign.id}`);
            return;
        }

        let token: string;
        try {
            token = decrypt(settings.metaAccessToken);
        } catch {
            throw Object.assign(new Error('Meta access token expired. Reconnect your Facebook account.'), { metaCode: 190 });
        }

        const today = new Date().toISOString().split('T')[0];

        // Fetch campaign insights from Meta
        const insightsRes = await fetch(
            `${META_GRAPH_BASE}/${campaign.metaCampaignId}/insights?` +
            `fields=impressions,clicks,spend,actions&` +
            `date_preset=today&` +
            `access_token=${token}`,
        );

        const insightsData: any = await insightsRes.json();

        if (insightsData.error) {
            throw Object.assign(new Error(insightsData.error.message), {
                metaCode: insightsData.error.code,
            });
        }

        const row = insightsData.data?.[0];
        if (!row) return; // No data yet for today

        // Extract messaging_conversation_started actions
        const messagesStarted = (row.actions || [])
            .filter((a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')
            .reduce((sum: number, a: any) => sum + parseInt(a.value || '0', 10), 0);

        // Count orders generated via UTM tracking
        const ordersToday = await this.prisma.order.count({
            where: {
                orgId: campaign.orgId,
                utmCampaignId: campaign.utmCampaignId,
                createdAt: { gte: new Date(today) },
            } as any,
        });

        // Sum revenue from UTM-attributed orders
        const revenueAgg = await this.prisma.order.aggregate({
            where: {
                orgId: campaign.orgId,
                utmCampaignId: campaign.utmCampaignId,
                createdAt: { gte: new Date(today) },
            } as any,
            _sum: { netAmount: true },
        });

        // Upsert daily metrics row
        await (this.prisma as any).campaignMetrics.upsert({
            where: {
                campaignId_date: {
                    campaignId: campaign.id,
                    date: new Date(today),
                },
            },
            update: {
                impressions: parseInt(row.impressions || '0', 10),
                clicks: parseInt(row.clicks || '0', 10),
                messagesStarted,
                spend: parseFloat(row.spend || '0') / 100, // paisa → rupees
                ordersGenerated: ordersToday,
                revenueGenerated: revenueAgg._sum?.netAmount ?? 0,
            },
            create: {
                campaignId: campaign.id,
                date: new Date(today),
                impressions: parseInt(row.impressions || '0', 10),
                clicks: parseInt(row.clicks || '0', 10),
                messagesStarted,
                spend: parseFloat(row.spend || '0') / 100,
                ordersGenerated: ordersToday,
                revenueGenerated: revenueAgg._sum?.netAmount ?? 0,
            },
        });

        // Update totalSpend on the campaign
        const allMetrics = await (this.prisma as any).campaignMetrics.findMany({
            where: { campaignId: campaign.id },
            select: { spend: true },
        });
        const totalSpend = allMetrics.reduce((sum, m) => sum + Number(m.spend), 0);
        await (this.prisma as any).marketingCampaign.update({
            where: { id: campaign.id },
            data: { totalSpend },
        });
    }

    private async sendWhatsAppAlert(orgId: string, message: string) {
        try {
            // Find the org owner's phone to send the alert
            const owner = await this.prisma.user.findFirst({
                where: { orgId, role: 'OWNER' },
                select: { phone: true },
            });
            if (owner?.phone) {
                const phone = owner.phone.startsWith('91') ? owner.phone : `91${owner.phone}`;
                await this.wa.sendText(orgId, phone, `⚠️ DistroAI Ad Alert: ${message}`);
            }
        } catch (err) {
            this.logger.error(`Failed to send WA alert for org ${orgId}`, (err as Error).message);
        }
    }
}
