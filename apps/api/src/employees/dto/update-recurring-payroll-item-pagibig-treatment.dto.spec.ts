import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PayrollStatutoryBasisTreatment } from '@payroll/database';

import { UpdateRecurringPayrollItemPagIbigTreatmentDto } from './update-recurring-payroll-item-pagibig-treatment.dto';

describe('UpdateRecurringPayrollItemPagIbigTreatmentDto', () => {
  it.each([
    PayrollStatutoryBasisTreatment.INCLUDE,
    PayrollStatutoryBasisTreatment.EXCLUDE,
  ])('accepts %s', async (pagIbigFundSalaryTreatment) => {
    const dto = plainToInstance(
      UpdateRecurringPayrollItemPagIbigTreatmentDto,
      {
        pagIbigFundSalaryTreatment,
      },
    );

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid treatment', async () => {
    const dto = plainToInstance(
      UpdateRecurringPayrollItemPagIbigTreatmentDto,
      {
        pagIbigFundSalaryTreatment: 'MAYBE',
      },
    );

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing treatment', async () => {
    const dto = plainToInstance(
      UpdateRecurringPayrollItemPagIbigTreatmentDto,
      {},
    );

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
