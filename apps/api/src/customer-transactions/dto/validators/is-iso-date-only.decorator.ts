import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsIsoDateOnly(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isIsoDateOnly',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: 'Date must be in YYYY-MM-DD format',
        ...validationOptions,
      },
      validator: {
        validate(value: any, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          // 1. Strict regex check for YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

          // 2. Calendar boundary validation
          const [yearStr, monthStr, dayStr] = value.split('-');
          const y = parseInt(yearStr, 10);
          const m = parseInt(monthStr, 10);
          const d = parseInt(dayStr, 10);

          if (m < 1 || m > 12 || d < 1 || d > 31) return false;

          const date = new Date(Date.UTC(y, m - 1, d));
          return (
            date.getUTCFullYear() === y &&
            date.getUTCMonth() === m - 1 &&
            date.getUTCDate() === d
          );
        },
      },
    });
  };
}
