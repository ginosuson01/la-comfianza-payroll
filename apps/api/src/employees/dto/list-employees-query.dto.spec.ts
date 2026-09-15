import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmployeePayrollStatus, PayoutMethod } from '@payroll/database';

import { ListEmployeesQueryDto } from './list-employees-query.dto';

describe('ListEmployeesQueryDto', () => {
  it('accepts valid query values', async () => {
    const dto = plainToInstance(ListEmployeesQueryDto, {
      search: 'Gino',
      companyId: '11111111-1111-4111-8111-111111111111',
      departmentId: '22222222-2222-4222-8222-222222222222',
      positionId: '33333333-3333-4333-8333-333333333333',
      status: EmployeePayrollStatus.ACTIVE,
      payoutMethod: PayoutMethod.ATM,
      page: '2',
      pageSize: '10',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(10);
  });

  it('rejects an invalid employee status', async () => {
    const dto = plainToInstance(ListEmployeesQueryDto, {
      status: 'DELETED',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid payout method', async () => {
    const dto = plainToInstance(ListEmployeesQueryDto, {
      payoutMethod: 'CHEQUE',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid UUID filters', async () => {
    const dto = plainToInstance(ListEmployeesQueryDto, {
      companyId: 'not-a-uuid',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects page size above 100', async () => {
    const dto = plainToInstance(ListEmployeesQueryDto, {
      pageSize: '101',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
