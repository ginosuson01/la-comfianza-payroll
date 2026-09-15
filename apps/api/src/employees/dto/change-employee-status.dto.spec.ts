import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmployeePayrollStatus } from '@payroll/database';

import { ChangeEmployeeStatusDto } from './change-employee-status.dto';

describe('ChangeEmployeeStatusDto', () => {
  it('accepts ACTIVE_HOLD with an optional reason', async () => {
    const dto = plainToInstance(ChangeEmployeeStatusDto, {
      status: EmployeePayrollStatus.ACTIVE_HOLD,
      effectiveDate: '2026-09-15',
      reason: ' Pending payroll release ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.reason).toBe('Pending payroll release');
  });

  it('accepts RESIGNED', async () => {
    const dto = plainToInstance(ChangeEmployeeStatusDto, {
      status: EmployeePayrollStatus.RESIGNED,
      effectiveDate: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('converts a blank reason to null', async () => {
    const dto = plainToInstance(ChangeEmployeeStatusDto, {
      status: EmployeePayrollStatus.ACTIVE,
      effectiveDate: '2026-09-15',
      reason: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.reason).toBeNull();
  });

  it('rejects an invalid employee status', async () => {
    const dto = plainToInstance(ChangeEmployeeStatusDto, {
      status: 'TERMINATED',
      effectiveDate: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid effective date', async () => {
    const dto = plainToInstance(ChangeEmployeeStatusDto, {
      status: EmployeePayrollStatus.ACTIVE_HOLD,
      effectiveDate: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
