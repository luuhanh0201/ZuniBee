import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export function MaxByteLength(
  maxBytes: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'maxByteLength',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      constraints: [maxBytes],
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' &&
            Buffer.byteLength(value, 'utf8') <= maxBytes
          );
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} không được vượt quá ${maxBytes} byte`;
        },
      },
    });
  };
}
