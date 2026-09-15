import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EmployeePayrollStatus } from '@payroll/database';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateEmployeeDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  employeeNumber!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  suffix?: string;

  @IsOptional()
  @Transform(trimString)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  mobile?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  barangay?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsUUID()
  companyId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  companyEmployeeNumber?: string;

  @IsDateString()
  employmentDate!: string;

  @IsOptional()
  @IsEnum(EmployeePayrollStatus)
  status?: EmployeePayrollStatus;

  @IsOptional()
  @IsDateString()
  statusEffectiveDate?: string;
}
