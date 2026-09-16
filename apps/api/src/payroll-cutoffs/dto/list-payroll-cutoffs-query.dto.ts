import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PayrollCutoffStatus } from '@payroll/database';

export class ListPayrollCutoffsQueryDto {
  @IsUUID()
  companyId!: string;

  @IsOptional()
  @IsEnum(PayrollCutoffStatus)
  status?: PayrollCutoffStatus;
}
