import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const EMPLOYEE_LEAVE_CODES = ['VL', 'SL'] as const;

export type EmployeeLeaveCode = (typeof EMPLOYEE_LEAVE_CODES)[number];

function normalizeLeaveCode({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function trimOptionalString({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

export class AdjustEmployeeLeaveCreditDto {
  @Transform(normalizeLeaveCode)
  @IsIn(EMPLOYEE_LEAVE_CODES)
  leaveCode!: EmployeeLeaveCode;

  @IsNumber(
    {
      maxDecimalPlaces: 4,
    },
    {
      message: 'Quantity must be a valid number with up to 4 decimal places.',
    },
  )
  @Min(-99999)
  @Max(99999)
  quantity!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  notes?: string;
}
