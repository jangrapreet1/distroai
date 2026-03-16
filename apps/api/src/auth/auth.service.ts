import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';
import {
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    ForgotPasswordDto,
    ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly redis: RedisService,
    ) { }

    async register(dto: RegisterDto) {
        const existing = await this.prisma.user.findFirst({
            where: { email: dto.email },
        });
        if (existing) {
            throw new ConflictException({ code: 'CONFLICT', message: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(dto.password, 12);
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const result = await this.prisma.$transaction(async (tx: any) => {
            const org = await tx.organization.create({
                data: {
                    name: dto.orgName,
                    gstNumber: dto.gstNumber,
                    phone: dto.phone,
                    email: dto.email,
                    plan: 'GROWTH',
                    businessType: dto.businessType,
                    sector: dto.sector,
                },
            });

            const user = await tx.user.create({
                data: {
                    orgId: org.id,
                    email: dto.email,
                    phone: dto.phone,
                    passwordHash,
                    firstName: dto.firstName,
                    lastName: dto.lastName || '',
                    role: 'OWNER',
                },
            });

            await tx.warehouse.create({
                data: { orgId: org.id, name: 'Main Godown', code: 'WH-MAIN', isDefault: true },
            });

            await tx.orgSettings.create({
                data: {
                    orgId: org.id,
                    invoicePrefix: 'INV',
                    orderPrefix: 'ORD',
                    poPrefix: 'PO',
                    financialYearStart: 4,
                    language: 'en',
                },
            });

            await tx.subscription.create({
                data: {
                    orgId: org.id,
                    plan: 'GROWTH',
                    status: 'TRIAL',
                    currentPeriodStart: now,
                    currentPeriodEnd: trialEnd,
                },
            });

            return { org, user };
        });

        const tokens = await this.generateTokens(result.user.id, result.org.id, 'OWNER', dto.email);
        return {
            ...tokens,
            user: { id: result.user.id, email: result.user.email, firstName: result.user.firstName, role: 'OWNER' },
            org: { id: result.org.id, name: result.org.name, plan: result.org.plan },
        };
    }

    async login(dto: LoginDto) {
        const users = await this.prisma.user.findMany({
            where: { email: dto.email, isActive: true },
            include: { organization: { include: { subscription: true } } },
        });

        if (users.length === 0) {
            throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }

        // Multiple orgs — require orgId
        if (users.length > 1 && !dto.orgId) {
            return {
                requireOrgSelection: true,
                orgs: users.map((u) => ({ orgId: u.orgId, orgName: u.organization.name })),
            };
        }

        const user = dto.orgId ? users.find((u) => u.orgId === dto.orgId) : users[0];
        if (!user) {
            throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid) {
            throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }

        await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        const tokens = await this.generateTokens(user.id, user.orgId, user.role, user.email);
        return {
            ...tokens,
            user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role },
            org: { id: user.orgId, name: user.organization.name, plan: user.organization.plan },
        };
    }

    async refresh(dto: RefreshTokenDto) {
        // Find all non-expired tokens and check hash
        const tokens = await this.prisma.refreshToken.findMany({
            where: { expiresAt: { gt: new Date() } },
            take: 50,
        });

        let matchedToken: (typeof tokens)[0] | undefined;
        for (const t of tokens) {
            const match = await bcrypt.compare(dto.refreshToken, t.token);
            if (match) { matchedToken = t; break; }
        }

        if (!matchedToken) {
            throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'Invalid or expired refresh token' });
        }

        // Rotate: delete old
        await this.prisma.refreshToken.delete({ where: { id: matchedToken.id } });

        const user = await this.prisma.user.findUnique({ where: { id: matchedToken.userId } });
        if (!user || !user.isActive) {
            throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'User not found or inactive' });
        }

        return this.generateTokens(user.id, user.orgId, user.role, user.email);
    }

    async logout(userId: string, refreshToken: string) {
        const tokens = await this.prisma.refreshToken.findMany({ where: { userId } });
        for (const t of tokens) {
            const match = await bcrypt.compare(refreshToken, t.token);
            if (match) {
                await this.prisma.refreshToken.delete({ where: { id: t.id } });
                break;
            }
        }
        return { success: true };
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        if (!dto.phone && !dto.email) {
            throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Phone or email required' });
        }
        const identifier = dto.phone ?? dto.email!;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redis.set(`otp:${identifier}`, otp, 600); // 10 minutes

        // TODO: send via MSG91 / Resend in Phase 4

        return { message: 'OTP sent' };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const stored = await this.redis.get(`otp:${dto.identifier}`);
        if (!stored || stored !== dto.otp) {
            throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'Invalid or expired OTP' });
        }

        await this.redis.del(`otp:${dto.identifier}`);

        const user = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: dto.identifier }, { phone: dto.identifier }],
                isActive: true,
            },
        });
        if (!user) {
            throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: 'User not found' });
        }

        const passwordHash = await bcrypt.hash(dto.newPassword, 12);
        await this.prisma.$transaction([
            this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
            this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
        ]);

        return { success: true };
    }

    async getMe(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, email: true, firstName: true, lastName: true, phone: true,
                role: true, avatarUrl: true, preferredLang: true, lastLoginAt: true,
                organization: {
                    select: {
                        id: true, name: true, plan: true, gstNumber: true, phone: true,
                        subscription: { select: { status: true, plan: true, currentPeriodEnd: true } },
                    },
                },
            },
        });
    }

    private async generateTokens(userId: string, orgId: string, role: string, email: string) {
        const payload = { sub: userId, orgId, role, email };

        const accessToken = this.jwtService.sign(payload, {
            secret: this.config.get('JWT_ACCESS_SECRET'),
            expiresIn: this.config.get('JWT_ACCESS_EXPIRY', '15m'),
        });

        const rawRefreshToken = crypto.randomBytes(64).toString('hex');
        const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 8);
        const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await this.prisma.refreshToken.create({
            data: { userId, token: hashedRefreshToken, expiresAt: refreshExpiry },
        });

        return { accessToken, refreshToken: rawRefreshToken };
    }
}
