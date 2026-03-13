import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    success: boolean;
    data: T;
    meta?: unknown;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
    intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<Response<T>> {
        return next.handle().pipe(
            map((data) => {
                // If already wrapped (e.g., from health check), return as-is
                if (data && typeof data === 'object' && 'success' in (data as object)) {
                    return data as unknown as Response<T>;
                }
                return { success: true, data };
            }),
        );
    }
}
