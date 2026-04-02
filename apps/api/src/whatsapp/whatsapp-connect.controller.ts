import {
    Controller, Post, Get, Body, UseGuards, Logger,
    BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt } from '../common/utils/crypto.util';

const GRAPH_API = 'https://graph.facebook.com/v19.0';

class ConnectWhatsAppDto {
    @IsString() @IsNotEmpty() code!: string;
}

@ApiTags('whatsapp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('whatsapp')
export class WhatsAppConnectController {
    private readonly logger = new Logger(WhatsAppConnectController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) { }

    /* ───────────────────────── CONNECT ───────────────────────── */

    @Roles('OWNER')
    @Post('connect')
    async connect(@CurrentUser() user: JwtPayload, @Body() dto: ConnectWhatsAppDto) {
        const appId = this.config.get<string>('META_APP_ID');
        const appSecret = this.config.get<string>('META_APP_SECRET');
        const systemUserToken = this.config.get<string>('META_SYSTEM_USER_TOKEN');

        if (!appId || !appSecret) {
            throw new InternalServerErrorException({
                code: 'CONFIG_ERROR',
                message: 'Meta App credentials are not configured on the server.',
            });
        }

        try {
            // Step 1: Exchange code for access_token
            this.logger.log(`Exchanging code for access_token for org ${user.orgId}`);
            const tokenRes = await axios.get(`${GRAPH_API}/oauth/access_token`, {
                params: {
                    client_id: appId,
                    client_secret: appSecret,
                    code: dto.code,
                },
            });
            const accessToken: string = tokenRes.data.access_token;
            if (!accessToken) {
                throw new BadRequestException({
                    code: 'TOKEN_EXCHANGE_FAILED',
                    message: 'Failed to exchange code for access token.',
                });
            }

            // Step 2: Debug token to get WABA ID
            let wabaId: string | undefined;
            if (systemUserToken) {
                try {
                    const debugRes = await axios.get(`${GRAPH_API}/debug_token`, {
                        params: { input_token: accessToken, access_token: systemUserToken },
                    });
                    const granularScopes = debugRes.data?.data?.granular_scopes ?? [];
                    const waScope = granularScopes.find(
                        (s: Record<string, unknown>) => s.scope === 'whatsapp_business_management',
                    );
                    wabaId = waScope?.target_ids?.[0];
                } catch (err) {
                    this.logger.warn('Failed to debug token for WABA ID — continuing without it', (err as Error).message);
                }
            }

            // Step 3: Fetch phone numbers from WABA
            let phoneNumberId: string | undefined;
            let phoneNumber: string | undefined;
            let businessName: string | undefined;

            if (wabaId) {
                try {
                    const phonesRes = await axios.get(`${GRAPH_API}/${wabaId}/phone_numbers`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    const phones = phonesRes.data?.data ?? [];
                    if (phones.length > 0) {
                        phoneNumberId = phones[0].id;
                        phoneNumber = phones[0].display_phone_number;
                    }
                    // Also try WABA name
                    const wabaRes = await axios.get(`${GRAPH_API}/${wabaId}`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                        params: { fields: 'name' },
                    });
                    businessName = wabaRes.data?.name;
                } catch (err) {
                    this.logger.warn('Failed to fetch phone numbers from WABA', (err as Error).message);
                }
            }

            if (!phoneNumberId) {
                throw new BadRequestException({
                    code: 'NO_PHONE_NUMBER',
                    message: 'Could not find a WhatsApp phone number associated with this account. Please try again.',
                });
            }

            // Step 4: Encrypt and save
            const encryptedToken = encrypt(accessToken);

            await this.prisma.whatsAppConfig.upsert({
                where: { orgId: user.orgId },
                update: {
                    accessToken: encryptedToken,
                    phoneNumberId,
                    wabaId: wabaId ?? null,
                    phoneNumber: phoneNumber ?? null,
                    businessName: businessName ?? null,
                    webhookSecret: null,
                    isActive: true,
                },
                create: {
                    orgId: user.orgId,
                    accessToken: encryptedToken,
                    phoneNumberId,
                    wabaId: wabaId ?? null,
                    phoneNumber: phoneNumber ?? null,
                    businessName: businessName ?? null,
                    webhookSecret: null,
                    isActive: true,
                },
            });

            this.logger.log(`WhatsApp connected for org ${user.orgId} — phone: ${phoneNumber}`);

            return {
                success: true,
                data: {
                    connected: true,
                    phoneNumber: phoneNumber ?? null,
                    wabaId: wabaId ?? null,
                    businessName: businessName ?? null,
                },
            };
        } catch (err) {
            if (err instanceof BadRequestException || err instanceof InternalServerErrorException) {
                throw err;
            }
            this.logger.error('WhatsApp connect failed', (err as Error).message);
            throw new InternalServerErrorException({
                code: 'CONNECT_FAILED',
                message: 'Failed to connect WhatsApp. Please try again.',
            });
        }
    }

    /* ──────────────────────── DISCONNECT ──────────────────────── */

    @Roles('OWNER')
    @Post('disconnect')
    async disconnect(@CurrentUser() user: JwtPayload) {
        await this.prisma.whatsAppConfig.deleteMany({
            where: { orgId: user.orgId },
        });

        this.logger.log(`WhatsApp disconnected for org ${user.orgId}`);

        return {
            success: true,
            data: { connected: false },
        };
    }

    /* ─────────────────────── STATUS ─────────────────────────── */

    @Get('status')
    async status(@CurrentUser() user: JwtPayload) {
        const config = await this.prisma.whatsAppConfig.findUnique({
            where: { orgId: user.orgId },
            select: {
                phoneNumber: true,
                wabaId: true,
                businessName: true,
                isActive: true,
                phoneNumberId: true,
                updatedAt: true,
            },
        });

        if (!config || !config.isActive) {
            return {
                success: true,
                data: { connected: false },
            };
        }

        return {
            success: true,
            data: {
                connected: true,
                phoneNumber: config.phoneNumber,
                phoneNumberId: config.phoneNumberId,
                wabaId: config.wabaId,
                businessName: config.businessName,
                connectedAt: config.updatedAt,
            },
        };
    }
}
