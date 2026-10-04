import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PayrollRunStatus } from '@payroll/database';

export class ListEmployeePayrollHistoryQueryDto {
  @IsOptional()
  @IsEnum(PayrollRunStatus)
  runStatus?: PayrollRunStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
