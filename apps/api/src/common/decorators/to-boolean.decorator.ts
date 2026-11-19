import { Transform } from 'class-transformer';

/**
 * Transforms query parameters or body fields to a boolean.
 * Handles string values 'true'/'false', '1'/'0', and booleans correctly,
 * even when class-transformer has enableImplicitConversion: true enabled.
 */
export function ToBoolean() {
    return Transform(({ value, obj, key }) => {
        const raw = (obj && key) ? obj[key] : value;
        if (raw === 'true' || raw === true || raw === 1 || raw === '1') return true;
        if (raw === 'false' || raw === false || raw === 0 || raw === '0') return false;
        return undefined;
    });
}
