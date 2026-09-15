import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmployeePayrollStatus } from '@payroll/database';

import { CreateEmployeeDto } from './create-employee.dto';

describe('CreateEmployeeDto', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';

  it('accepts valid employee creation data', async () => {
    const dto = plainToInstance(CreateEmployeeDto, {
      employeeNumber: ' EMP-0001 ',

      firstName: ' Gino ',
      middleName: ' Dela Cruz ',
      lastName: ' Suson ',

      email: 'gino@example.com',
      mobile: '+639171234567',

      companyId,

      employmentDate: '2026-09-01',

      status: EmployeePayrollStatus.ACTIVE,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.employeeNumber).toBe('EMP-0001');
    expect(dto.firstName).toBe('Gino');
    expect(dto.middleName).toBe('Dela Cruz');
    expect(dto.lastName).toBe('Suson');
  });

  it('rejects an invalid company id', async () => {
    const dto = plainToInstance(CreateEmployeeDto, {
      employeeNumber: 'EMP-0001',

      firstName: 'Gino',
      lastName: 'Suson',

      companyId: 'invalid-company-id',

      employmentDate: '2026-09-01',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid employment date', async () => {
    const dto = plainToInstance(CreateEmployeeDto, {
      employeeNumber: 'EMP-0001',

      firstName: 'Gino',
      lastName: 'Suson',

      companyId,

      employmentDate: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid payroll status', async () => {
    const dto = plainToInstance(CreateEmployeeDto, {
      employeeNumber: 'EMP-0001',

      firstName: 'Gino',
      lastName: 'Suson',

      companyId,

      employmentDate: '2026-09-01',

      status: 'INVALID',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid email address', async () => {
    const dto = plainToInstance(CreateEmployeeDto, {
      employeeNumber: 'EMP-0001',

      firstName: 'Gino',
      lastName: 'Suson',

      email: 'not-an-email',

      companyId,

      employmentDate: '2026-09-01',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
