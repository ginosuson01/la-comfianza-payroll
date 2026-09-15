import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PayoutMethod } from '@payroll/database';

function trimOptionalString({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  return typeof value === 'string' ? value.trim() : value;
}

function normalizeAccountNumber({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().replace(/[\s-]/g, '');
}

export class SetEmployeePayrollProfileDto {
  @IsEnum(PayoutMethod)
  payoutMethod!: PayoutMethod;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @Transform(normalizeAccountNumber)
  @IsString()
  @Matches(/^\d{4,30}$/, {
    message: 'Account number must contain between 4 and 30 digits.',
  })
  accountNumber?: string;
}
