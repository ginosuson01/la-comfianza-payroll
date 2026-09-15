import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RecurringPayrollItemKind } from '@payroll/database';

function trimRequiredString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeCode({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class CreateRecurringPayrollItemDto {
  @IsEnum(RecurringPayrollItemKind)
  kind!: RecurringPayrollItemKind;

  @Transform(normalizeCode)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @Transform(trimRequiredString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @IsNumber(
    {
      maxDecimalPlaces: 2,
    },
    {
      message: 'Amount must be a valid number with up to 2 decimal places.',
    },
  )
  @IsPositive()
  @Max(999999999999.99)
  amount!: number;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @IsDateString()
  effectiveFrom!: string;
}
