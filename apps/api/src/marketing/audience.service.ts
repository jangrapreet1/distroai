import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

/**
 * SHA-256 hash a value for Meta Custom Audience upload.
 * Meta requires all PII to be hashed before transmission.
 */
function hashForMeta(value: string): string {
    return createHash('sha256')
        .update(value.trim().toLowerCase())
        .digest('hex');
}

/**
 * Normalize Indian phone numbers to E.164 format: +91XXXXXXXXXX
 */
function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) return digits;
    if (digits.length === 10) return `91${digits}`;
    return digits;
}

@Injectable()
export class AudienceService {
    private readonly logger = new Logger(AudienceService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Upload a distributor's CRM customer list to Meta as a Custom Audience.
     * Requires consent — checks `consentGivenAt` before proceeding.
     */
    async uploadCustomAudience(orgId: string, metaToken: string, adAccountId: string) {
        // Consent check — RULE 4
        const settings: any = await this.prisma.orgSettings.findUnique({ where: { orgId } });
        if (!settings?.consentGivenAt) {
            throw new BadRequestException(
                'You must agree to the data sharing consent before uploading customer audiences. ' +
                'Go to Settings → Marketing → enable "Share customer data with Meta for targeted ads".'
            );
        }

        // Fetch all customers with phone or email
        const customers = await this.prisma.customer.findMany({
            where: { orgId },
            select: { phone: true, email: true, name: true },
        });

        if (customers.length === 0) {
            throw new BadRequestException('No customers found in your CRM. Add customers first.');
        }

        // Hash all PII before upload — RULE 4
        const hashedData = customers
            .filter(c => c.phone || c.email)
            .map(c => {
                const entry: string[] = [];
                if (c.phone) {
                    entry.push(hashForMeta(normalizePhone(c.phone)));
                }
                if (c.email) {
                    entry.push(hashForMeta(c.email));
                }
                return entry;
            });

        // Create Custom Audience on Meta
        const createRes = await fetch(`${META_GRAPH_BASE}/${adAccountId}/customaudiences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: metaToken,
                name: `DistroAI CRM - ${orgId.slice(0, 8)}`,
                subtype: 'CUSTOM',
                description: 'Customer list uploaded from DistroAI CRM',
                customer_file_source: 'USER_PROVIDED_ONLY',
            }),
        });

        const createData: any = await createRes.json();
        if (createData.error) {
            this.logger.error('Failed to create Custom Audience', createData.error);
            throw new BadRequestException(createData.error.message || 'Failed to create audience on Meta');
        }

        const audienceId = createData.id;

        // Upload hashed users to the audience
        // Meta accepts batches of up to 10,000 entries
        const schema = ['PHONE', 'EMAIL'];
        const uploadRes = await fetch(`${META_GRAPH_BASE}/${audienceId}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: metaToken,
                payload: {
                    schema,
                    data: hashedData,
                },
            }),
        });

        const uploadData: any = await uploadRes.json();
        if (uploadData.error) {
            this.logger.error('Failed to upload audience users', uploadData.error);
            throw new BadRequestException(uploadData.error.message || 'Failed to upload contacts to Meta');
        }

        this.logger.log(`Uploaded ${hashedData.length} hashed contacts to audience ${audienceId} for org ${orgId}`);

        return {
            audienceId,
            contactsUploaded: hashedData.length,
            totalCustomers: customers.length,
        };
    }
}
