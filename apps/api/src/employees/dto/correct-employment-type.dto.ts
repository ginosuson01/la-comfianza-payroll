import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { EmployeeType } from '@payroll/database';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CorrectEmploymentTypeDto {
  @IsEnum(EmployeeType)
  employeeType!: EmployeeType;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
