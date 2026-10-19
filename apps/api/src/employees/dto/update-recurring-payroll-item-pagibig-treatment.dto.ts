import { IsEnum } from 'class-validator';
import { PayrollStatutoryBasisTreatment } from '@payroll/database';

export class UpdateRecurringPayrollItemPagIbigTreatmentDto {
  @IsEnum(PayrollStatutoryBasisTreatment)
  pagIbigFundSalaryTreatment!: PayrollStatutoryBasisTreatment;
}
