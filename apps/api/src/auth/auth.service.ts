import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    Logger,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';
import { EmailService } from '../notifications/email.service';
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

    private static readonly MAX_LOGIN_ATTEMPTS = 5;
    private static readonly LOCKOUT_TTL_SECONDS = 900; // 15 minutes

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly redis: RedisService,
        private readonly emailService: EmailService,
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
                    plan: 'FREE',
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
                    plan: 'FREE',
                    status: 'ACTIVE',
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
        // --- Account lockout check ---
        const lockoutKey = `login_attempts:${dto.email}`;
        const attemptsStr = await this.redis.get(lockoutKey);
        const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

        if (attempts >= AuthService.MAX_LOGIN_ATTEMPTS) {
            this.logger.warn(`Account locked out for ${dto.email} — ${attempts} failed attempts`);
            throw new HttpException(
                { code: 'AUTH_ACCOUNT_LOCKED', message: 'Too many failed login attempts. Please try again after 15 minutes.' },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        const users = await this.prisma.user.findMany({
            where: { email: dto.email, isActive: true },
            include: { organization: { include: { subscription: true } } },
        });

        if (users.length === 0) {
            await this.incrementLoginAttempts(lockoutKey);
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
            await this.incrementLoginAttempts(lockoutKey);
            throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }

        if (!user.passwordHash) {
            throw new UnauthorizedException({ code: 'AUTH_GOOGLE_ACCOUNT', message: 'This account uses Google Sign-In. Please log in with Google.' });
        }
        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid) {
            await this.incrementLoginAttempts(lockoutKey);
            throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }

        // --- Success: clear lockout counter ---
        await this.redis.del(lockoutKey);

        await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        const tokens = await this.generateTokens(user.id, user.orgId, user.role, user.email);
        return {
            ...tokens,
            user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role },
            org: { id: user.orgId, name: user.organization.name, plan: user.organization.plan },
        };
    }

    private async incrementLoginAttempts(key: string): Promise<void> {
        const count = await this.redis.incr(key);
        if (count === 1) {
            // First failure — set TTL
            await this.redis.expire(key, AuthService.LOCKOUT_TTL_SECONDS);
        }
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

        // Send OTP via email if email was provided
        if (dto.email) {
            await this.emailService.sendOTP(dto.email, otp);
            this.logger.log(`OTP sent to email for ${dto.email.slice(0, 3)}***`);
        } else {
            // SMS delivery via MSG91 — log for now
            this.logger.log(`[SMS STUB] OTP for ${dto.phone!.slice(-4)}: ${otp}`);
        }

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

    async validateGoogleUser(profile: any) {
        let user: any = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { googleId: profile.googleId },
                    { email: profile.email }
                ]
            },
            include: { organization: true }
        });

        if (!user) {
            // Auto-create user and generic organization for Google Sign-ups
            const now = new Date();
            const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

            const result = await this.prisma.$transaction(async (tx: any) => {
                const org = await tx.organization.create({
                    data: {
                        name: `${profile.firstName}'s Workspace`,
                        email: profile.email,
                        plan: 'FREE',
                        businessType: 'RETAIL',
                    },
                });

                const newUser = await tx.user.create({
                    data: {
                        orgId: org.id,
                        email: profile.email,
                        firstName: profile.firstName,
                        lastName: profile.lastName,
                        avatarUrl: profile.avatarUrl,
                        authProvider: 'google',
                        googleId: profile.googleId,
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
                        plan: 'FREE',
                        status: 'ACTIVE',
                        currentPeriodStart: now,
                        currentPeriodEnd: trialEnd,
                    },
                });

                return { org, user: newUser };
            });

            user = { ...result.user, organization: result.org } as any;
        } else {
            // Ensure googleId is linked if signing in via Google for an existing account
            if (!user.googleId) {
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: { googleId: profile.googleId, authProvider: 'google', avatarUrl: user.avatarUrl || profile.avatarUrl },
                    include: { organization: true }
                });
            }
        }

        await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        const tokens = await this.generateTokens(user.id, user.orgId, user.role, user.email);
        return {
            ...tokens,
            user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role, avatarUrl: user.avatarUrl },
            org: { id: user.orgId, name: user.organization?.name || '', plan: user.organization?.plan || '' },
        };
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
