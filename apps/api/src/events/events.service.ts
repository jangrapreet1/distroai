import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export interface AppEvent {
    orgId: string;
    type: string;
    payload: any;
}

@Injectable()
export class EventsService {
    private readonly logger = new Logger(EventsService.name);
    private eventStream = new Subject<AppEvent>();

    emit(orgId: string, type: string, payload: any) {
        this.logger.debug(`Emitting event: ${type} for org: ${orgId}`);
        this.eventStream.next({ orgId, type, payload });
    }

    subscribe(orgId: string): Observable<AppEvent> {
        return this.eventStream.asObservable().pipe(
            filter(event => event.orgId === orgId)
        );
    }
}
