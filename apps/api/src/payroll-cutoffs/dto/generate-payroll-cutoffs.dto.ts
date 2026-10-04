import { IsUUID, Matches } from 'class-validator';

export class GeneratePayrollCutoffsDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  cutoffTemplateId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'referenceMonth must use YYYY-MM format.',
  })
  referenceMonth!: string;
}
