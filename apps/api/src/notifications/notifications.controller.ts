import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    UseGuards,
    Param,
    Patch,
    Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { PushService } from './push.service';
import { CreatePushSubscriptionDto, UnsubscribePushDto } from './dto/notifications.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly pushService: PushService,
        private readonly prisma: PrismaService,
    ) { }

    @ApiOperation({ summary: 'Get VAPID public key for Web Push subscription' })
    @Get('vapid-public-key')
    getVapidPublicKey() {
        return {
            publicKey: this.pushService.getVapidPublicKey(),
        };
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Register a Web Push subscription for current user' })
    @Post('push-subscription')
    async subscribe(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreatePushSubscriptionDto,
    ) {
        await this.pushService.subscribe(user.orgId, user.sub, dto);
        return { success: true };
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Unsubscribe Web Push for current device' })
    @Delete('push-subscription')
    async unsubscribe(
        @CurrentUser() user: JwtPayload,
        @Body() dto: UnsubscribePushDto,
    ) {
        await this.pushService.unsubscribe(user.sub, dto.endpoint);
        return { success: true };
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Send a test push notification to current user device' })
    @Post('test-push')
    async testPush(@CurrentUser() user: JwtPayload) {
        await this.pushService.sendToUser(
            user.sub,
            '🔔 DistroAI Order Alert Test',
            'Push notifications are working perfectly on your iPhone/device!',
            { url: '/dashboard', type: 'test' },
        );
        return { success: true, message: 'Test notification dispatched' };
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get recent notifications for current user' })
    @Get()
    async getNotifications(
        @CurrentUser() user: JwtPayload,
        @Query('limit') limit = 20,
    ) {
        return this.prisma.notification.findMany({
            where: { orgId: user.orgId },
            orderBy: { createdAt: 'desc' },
            take: Number(limit) || 20,
        });
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Mark notification as read' })
    @Patch(':id/read')
    async markAsRead(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
    ) {
        return this.prisma.notification.updateMany({
            where: { id, orgId: user.orgId },
            data: { isRead: true },
        });
    }
}
