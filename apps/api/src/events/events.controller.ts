import { Controller, Sse, UseGuards, Req, MessageEvent } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Controller('events')
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @UseGuards(JwtAuthGuard)
    @Sse('stream')
    stream(@Req() req: any): Observable<MessageEvent> {
        const orgId = req.user.orgId;
        return this.eventsService.subscribe(orgId).pipe(
            map((event) => ({
                data: event,
            }) as MessageEvent)
        );
    }
}
