import { Transform } from 'class-transformer';
import { EmployeeType } from '@payroll/database';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

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

export class ChangeEmploymentAssignmentDto {
  @IsUUID()
  companyId!: string;

  @IsEnum(EmployeeType)
  employeeType!: EmployeeType;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  positionId?: string | null;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  @MaxLength(100)
  companyEmployeeNumber?: string | null;

  @IsDateString()
  effectiveDate!: string;
}
