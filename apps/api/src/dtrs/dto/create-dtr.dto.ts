import { IsUUID } from 'class-validator';

export class CreateDtrDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  employeeId!: string;

  @IsUUID()
  payrollCutoffId!: string;
}
