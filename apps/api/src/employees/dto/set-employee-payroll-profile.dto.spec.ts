import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PayoutMethod } from '@payroll/database';

import { SetEmployeePayrollProfileDto } from './set-employee-payroll-profile.dto';

describe('SetEmployeePayrollProfileDto', () => {
  it('accepts CASH without banking details', async () => {
    const dto = plainToInstance(SetEmployeePayrollProfileDto, {
      payoutMethod: PayoutMethod.CASH,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts ATM banking details', async () => {
    const dto = plainToInstance(SetEmployeePayrollProfileDto, {
      payoutMethod: PayoutMethod.ATM,
      bankName: ' BDO ',
      accountNumber: '1234-5678-9012',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.bankName).toBe('BDO');
    expect(dto.accountNumber).toBe('123456789012');
  });

  it('normalizes spaces in account numbers', async () => {
    const dto = plainToInstance(SetEmployeePayrollProfileDto, {
      payoutMethod: PayoutMethod.ATM,
      bankName: 'BPI',
      accountNumber: '1234 5678 9012',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.accountNumber).toBe('123456789012');
  });

  it('rejects an invalid payout method', async () => {
    const dto = plainToInstance(SetEmployeePayrollProfileDto, {
      payoutMethod: 'CHECK',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects account numbers containing letters', async () => {
    const dto = plainToInstance(SetEmployeePayrollProfileDto, {
      payoutMethod: PayoutMethod.ATM,
      bankName: 'BDO',
      accountNumber: '1234ABC5678',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an account number shorter than four digits', async () => {
    const dto = plainToInstance(SetEmployeePayrollProfileDto, {
      payoutMethod: PayoutMethod.ATM,
      bankName: 'BDO',
      accountNumber: '123',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
