import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmployeePayrollStatus, PayoutMethod } from '@payroll/database';

import {
  DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS,
  EmployeeAlphaListColumn,
} from '../employee-alpha-list.constants';
import { EmployeeAlphaListQueryDto } from './employee-alpha-list-query.dto';

describe('EmployeeAlphaListQueryDto', () => {
  it('uses the essential default columns', async () => {
    const dto = plainToInstance(EmployeeAlphaListQueryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.columns).toEqual(DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS);

    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(25);
  });

  it('normalizes comma-separated custom columns', async () => {
    const dto = plainToInstance(EmployeeAlphaListQueryDto, {
      columns: 'employeeNumber, fullName, email, payoutMethod',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.columns).toEqual([
      EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
      EmployeeAlphaListColumn.FULL_NAME,
      EmployeeAlphaListColumn.EMAIL,
      EmployeeAlphaListColumn.PAYOUT_METHOD,
    ]);
  });

  it('accepts array-based custom columns', async () => {
    const dto = plainToInstance(EmployeeAlphaListQueryDto, {
      columns: ['employeeNumber', 'companyName', 'status'],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.columns).toEqual([
      EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
      EmployeeAlphaListColumn.COMPANY_NAME,
      EmployeeAlphaListColumn.STATUS,
    ]);
  });

  it('rejects an unsupported Alpha List column', async () => {
    const dto = plainToInstance(EmployeeAlphaListQueryDto, {
      columns: 'employeeNumber,fullName,password',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('inherits employee directory filters', async () => {
    const dto = plainToInstance(EmployeeAlphaListQueryDto, {
      search: ' Gino ',

      companyId: '11111111-1111-4111-8111-111111111111',

      departmentId: '22222222-2222-4222-8222-222222222222',

      positionId: '33333333-3333-4333-8333-333333333333',

      status: EmployeePayrollStatus.ACTIVE,

      payoutMethod: PayoutMethod.ATM,

      page: '2',
      pageSize: '50',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.search).toBe('Gino');

    expect(dto.status).toBe(EmployeePayrollStatus.ACTIVE);

    expect(dto.payoutMethod).toBe(PayoutMethod.ATM);

    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(50);
  });
});
