import {
    Injectable, NotFoundException, ConflictException, BadRequestException,
    HttpException, HttpStatus,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS, PlanName } from '../common/config/plan-limits.config';
import { CreateUserDto, UpdateUserDto, UpdateRoleDto, ListUsersQueryDto } from './dto/users.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) { }

    async findAll(orgId: string, query: ListUsersQueryDto) {
        const { page = 1, limit = 20, role, isActive } = query;
        const where = { orgId, ...(role && { role }), ...(isActive !== undefined && { isActive }) };
        const [data, total] = await Promise.all([
            this.prisma.user.findMany({
                where, skip: (page - 1) * limit, take: limit,
                select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
        ]);
        return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }

    async create(orgId: string, dto: CreateUserDto) {
        const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
        const currentOrgPlan = (org?.plan as PlanName) || 'FREE';

        // Check plan user limit
        const userCount = await this.prisma.user.count({ where: { orgId, isActive: true } });
        const limit = PLAN_LIMITS[currentOrgPlan].maxUsers;
        if (userCount >= limit) {
            throw new HttpException(
                { code: 'PLAN_LIMIT_REACHED', feature: 'users', currentPlan: currentOrgPlan, upgradeUrl: '/settings/billing' },
                HttpStatus.PAYMENT_REQUIRED,
            );
        }

        const existing = await this.prisma.user.findFirst({ where: { email: dto.email, orgId } });
        if (existing) throw new ConflictException({ code: 'CONFLICT', message: 'Email already exists in this org' });

        const tempPassword = crypto.randomBytes(8).toString('base64').slice(0, 12);
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        const user = await this.prisma.user.create({
            data: { orgId, email: dto.email, firstName: dto.firstName, lastName: dto.lastName || '', phone: dto.phone, role: dto.role as any, passwordHash },
            select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, createdAt: true },
        });

        // Trigger WhatsApp/Email notification with credentials non-blockingly
        this.notifications.notify(orgId, {
            type: 'USER_INVITED',
            orgId,
            userId: user.id,
            tempPassword,
        }).catch(err => console.error('Failed to notify invited user: ' + err.message));

        return { ...user, tempPassword };
    }

    async toggleActive(orgId: string, id: string, currentUserId: string) {
        if (id === currentUserId) throw new BadRequestException({ code: 'CONFLICT', message: 'Cannot toggle your own status' });
        const user = await this.prisma.user.findFirst({ where: { id, orgId } });
        if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
        if (user.role === 'OWNER') throw new BadRequestException({ code: 'FORBIDDEN', message: 'Cannot deactivate the owner' });

        const newStatus = !user.isActive;

        await this.prisma.$transaction(async (tx: any) => {
            await tx.user.update({ where: { id }, data: { isActive: newStatus } });
            // If deactivating, kill all sessions instantly
            if (!newStatus) {
                await tx.refreshToken.deleteMany({ where: { userId: id } });
            }
        });

        return { id, isActive: newStatus };
    }

    async getTeamOverview(orgId: string) {
        const members = await this.prisma.user.findMany({
            where: { orgId },
            select: {
                id: true, email: true, firstName: true, lastName: true,
                phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true,
                salesmanProfile: {
                    select: {
                        id: true, employeeCode: true, territory: true,
                        routes: { select: { id: true, name: true, day: true }, where: { isActive: true } },
                    },
                },
            },
            orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        });

        const counts = {
            total: members.length,
            active: members.filter(m => m.isActive).length,
            inactive: members.filter(m => !m.isActive).length,
        };

        return { members, counts };
    }

    async findOne(orgId: string, id: string) {
        const user = await this.prisma.user.findFirst({
            where: { id, orgId },
            select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, avatarUrl: true, isActive: true, lastLoginAt: true, preferredLang: true, createdAt: true },
        });
        if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
        return user;
    }

    async update(orgId: string, id: string, dto: UpdateUserDto, currentUserId: string, currentRole: string) {
        const user = await this.prisma.user.findFirst({ where: { id, orgId } });
        if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });

        const isSelf = id === currentUserId;
        const isAdminOrOwner = ['OWNER', 'ADMIN'].includes(currentRole);
        if (!isSelf && !isAdminOrOwner) {
            throw new BadRequestException({ code: 'FORBIDDEN', message: 'Cannot update another user' });
        }

        return this.prisma.user.update({
            where: { id },
            data: dto,
            select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, avatarUrl: true },
        });
    }

    async remove(orgId: string, id: string, currentUserId: string) {
        if (id === currentUserId) throw new BadRequestException({ code: 'CONFLICT', message: 'Cannot deactivate yourself' });
        const user = await this.prisma.user.findFirst({ where: { id, orgId } });
        if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
        return this.prisma.user.update({ where: { id }, data: { isActive: false }, select: { id: true, isActive: true } });
    }

    async updateRole(orgId: string, id: string, dto: UpdateRoleDto, currentUserId: string) {
        if (id === currentUserId) throw new BadRequestException({ code: 'CONFLICT', message: 'Cannot change your own role' });
        const user = await this.prisma.user.findFirst({ where: { id, orgId } });
        if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
        return this.prisma.user.update({ where: { id }, data: { role: dto.role }, select: { id: true, email: true, role: true } });
    }
}
