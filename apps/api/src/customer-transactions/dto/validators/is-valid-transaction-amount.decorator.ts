import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { CustomerTransactionType } from '../../customer-transactions.calculation';

export function IsValidTransactionAmount(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidTransactionAmount',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
            return false;
          }

          const obj = args.object as any;
          const type = obj?.type;

          // Max capacity for PostgreSQL Decimal(12, 2)
          const MAX_DECIMAL_12_2 = 9999999999.99;
          if (Math.abs(value) > MAX_DECIMAL_12_2) {
            return false;
          }

          // Case A: ADJUSTMENT type allows positive, negative, and zero
          if (type === CustomerTransactionType.ADJUSTMENT) {
            return true;
          }

          // Case B: Explicit non-ADJUSTMENT types (SALE, RETURN, PAYMENT) require strictly positive (>= 0.01)
          if (type !== undefined) {
            return value >= 0.01;
          }

          // Case C: When type is unspecified (e.g., partial PATCH without type field in UpdateTransactionDto),
          // allow the amount (positive, negative, or zero) at the DTO layer within Decimal(12,2) bounds.
          // CustomerTransactionsService.update() already retrieves the existing database record and verifies
          // `const targetType = dto.type ?? existing.type`, throwing BadRequestException if a non-ADJUSTMENT is negative.
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as any;
          const type = obj?.type;
          const val = (args.object as any)[args.property];

          if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
            return `${args.property} must be a valid number`;
          }

          const MAX_DECIMAL_12_2 = 9999999999.99;
          if (Math.abs(val) > MAX_DECIMAL_12_2) {
            return `${args.property} exceeds maximum allowable decimal precision`;
          }

          if (type && type !== CustomerTransactionType.ADJUSTMENT && val < 0) {
            return 'Amount must be non-negative';
          }

          if (
            type === CustomerTransactionType.SALE ||
            type === CustomerTransactionType.RETURN ||
            type === CustomerTransactionType.PAYMENT
          ) {
            return `${type} amount must be greater than or equal to 0.01`;
          }

          return 'Amount must be a valid number';
        },
      },
    });
  };
}
