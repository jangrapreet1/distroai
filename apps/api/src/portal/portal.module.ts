import { Module } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrdersModule } from '../orders/orders.module';

@Module({
    imports: [
        PrismaModule,
        OrdersModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: '7d' }, // Portal sessions last 7 days
            }),
        }),
    ],
    controllers: [PortalController],
    providers: [PortalService],
})
export class PortalModule { }
