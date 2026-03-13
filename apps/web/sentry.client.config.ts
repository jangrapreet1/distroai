import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.01, // 1% session replay
    replaysOnErrorSampleRate: 1.0,  // 100% replay on error
});
