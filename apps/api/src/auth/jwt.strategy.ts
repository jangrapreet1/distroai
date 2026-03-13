import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
    sub: string;
    orgId: string;
    role: string;
    email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.get<string>('JWT_ACCESS_SECRET', 'dev-secret'),
        });
    }

    async validate(payload: JwtPayload): Promise<JwtPayload> {
        const user = await this.prisma.user.findFirst({
            where: { id: payload.sub, orgId: payload.orgId, isActive: true },
        });

        if (!user) {
            throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'User not found or inactive' });
        }

        return payload;
    }
}
