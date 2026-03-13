import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let code = 'INTERNAL_SERVER_ERROR';
        let message = 'An unexpected error occurred';
        let details: unknown = undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const resp = exceptionResponse as Record<string, unknown>;
                code = (resp['code'] as string) ?? this.statusToCode(status);
                message = (resp['message'] as string) ?? message;
                details = resp['details'];
            } else {
                message = String(exceptionResponse);
                code = this.statusToCode(status);
            }
        } else if (exception instanceof Error) {
            this.logger.error(exception.message, exception.stack);
        }

        // Never leak stack traces in production
        const isDev = process.env['NODE_ENV'] !== 'production';
        if (isDev && exception instanceof Error && status === HttpStatus.INTERNAL_SERVER_ERROR) {
            details = exception.stack;
        }

        response.status(status).json({
            success: false,
            error: {
                code,
                message,
                ...(details !== undefined && { details }),
            },
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }

    private statusToCode(status: number): string {
        const map: Record<number, string> = {
            400: 'VALIDATION_ERROR',
            401: 'UNAUTHORIZED',
            402: 'PLAN_LIMIT_REACHED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'UNPROCESSABLE',
            429: 'RATE_LIMIT_EXCEEDED',
            500: 'INTERNAL_SERVER_ERROR',
        };
        return map[status] ?? 'ERROR';
    }
}
