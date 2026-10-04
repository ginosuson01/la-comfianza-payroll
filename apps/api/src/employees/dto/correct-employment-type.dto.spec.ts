import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmployeeType } from '@payroll/database';

import { CorrectEmploymentTypeDto } from './correct-employment-type.dto';

describe('CorrectEmploymentTypeDto', () => {
  it('accepts a valid employee type correction and trims the reason', async () => {
    const dto = plainToInstance(CorrectEmploymentTypeDto, {
      employeeType: EmployeeType.CLIENT_EMPLOYEE,
      reason: ' Initial classification of existing employee. ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.reason).toBe('Initial classification of existing employee.');
  });

  it('rejects an invalid employee type', async () => {
    const dto = plainToInstance(CorrectEmploymentTypeDto, {
      employeeType: 'INVALID_TYPE',
      reason: 'Correction.',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a blank reason', async () => {
    const dto = plainToInstance(CorrectEmploymentTypeDto, {
      employeeType: EmployeeType.LACOM_INTERNAL,
      reason: '   ',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
