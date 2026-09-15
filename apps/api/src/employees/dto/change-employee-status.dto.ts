import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EmployeePayrollStatus } from '@payroll/database';

function trimOptionalNullableString({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export class ChangeEmployeeStatusDto {
  @IsEnum(EmployeePayrollStatus)
  status!: EmployeePayrollStatus;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
