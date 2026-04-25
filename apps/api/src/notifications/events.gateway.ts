import { Controller, Get, Sse, UseGuards, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Observable, Subject, filter, map } from 'rxjs';

interface OrgEvent {
    orgId: string;
    type: string;
    data: Record<string, unknown>;
}

@ApiTags('events')
@Controller('events')
export class EventsGateway {
    // Shared subject for broadcasting events across the application
    private readonly events$ = new Subject<OrgEvent>();

    /**
     * Emit an event to all connected SSE clients for a given org.
     * Called from NotificationsService or other services.
     */
    emit(orgId: string, type: string, data: Record<string, unknown>): void {
        this.events$.next({ orgId, type, data });
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Sse('stream')
    stream(@CurrentUser() user: JwtPayload): Observable<MessageEvent> {
        // Filter events to only show those belonging to the user's org
        return this.events$.pipe(
            filter((event) => event.orgId === user.orgId),
            map((event) => ({
                data: JSON.stringify({ type: event.type, ...event.data }),
                type: event.type,
            } as MessageEvent)),
        );
    }
}
