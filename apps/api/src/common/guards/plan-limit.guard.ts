import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../services/redis.service';
import { JwtPayload } from '../decorators/current-user.decorator';
import { PLAN_LIMITS, PlanName, FeatureName } from '../config/plan-limits.config';

export const REQUIRES_PLAN_KEY = 'requiresPlan';
export const REQUIRES_FEATURE_KEY = 'requiresFeature';

@Injectable()
export class PlanLimitGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<{ user: JwtPayload; org?: unknown }>();
        const user = request.user;
        if (!user) return true;

        // Fetch org (with Redis cache)
        const cacheKey = `org:${user.orgId}`;
        let org = await this.redis.getJson<{ plan: PlanName; isActive: boolean }>(cacheKey);

        if (!org) {
            const dbOrg = await this.prisma.organization.findUnique({
                where: { id: user.orgId },
                select: { plan: true, isActive: true },
            });
            if (!dbOrg) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Organization not found' });
            org = { plan: dbOrg.plan as PlanName, isActive: dbOrg.isActive };
            await this.redis.setJson(cacheKey, org, 60);
        }

        if (!org.isActive) {
            throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'Your account is suspended' });
        }

        // Attach org to request
        request.org = org;

        const requiredPlan = this.reflector.getAllAndOverride<PlanName>(REQUIRES_PLAN_KEY, [
            context.getHandler(), context.getClass(),
        ]);
        const requiredFeature = this.reflector.getAllAndOverride<FeatureName>(REQUIRES_FEATURE_KEY, [
            context.getHandler(), context.getClass(),
        ]);

        if (requiredPlan) {
            const planOrder: PlanName[] = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'];
            if (planOrder.indexOf(org.plan) < planOrder.indexOf(requiredPlan)) {
                throw new HttpException(
                    {
                        code: 'PLAN_LIMIT_REACHED',
                        feature: requiredPlan,
                        currentPlan: org.plan,
                        requiredPlan,
                        upgradeUrl: '/settings/billing',
                    },
                    HttpStatus.PAYMENT_REQUIRED,
                );
            }
        }

        if (requiredFeature) {
            const planLimits = PLAN_LIMITS[org.plan];
            if (!planLimits.features[requiredFeature]) {
                throw new HttpException(
                    {
                        code: 'PLAN_LIMIT_REACHED',
                        feature: requiredFeature,
                        currentPlan: org.plan,
                        upgradeUrl: '/settings/billing',
                    },
                    HttpStatus.PAYMENT_REQUIRED,
                );
            }
        }

        return true;
    }
}
