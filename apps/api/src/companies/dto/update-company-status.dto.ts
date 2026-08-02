import { IsEnum } from 'class-validator';
import { CompanyStatus } from '@payroll/database';

export class UpdateCompanyStatusDto {
  @IsEnum(CompanyStatus)
  status!: CompanyStatus;
}
