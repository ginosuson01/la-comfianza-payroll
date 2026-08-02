import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompanyStatus } from '@payroll/database';

import { UpdateCompanyStatusDto } from './update-company-status.dto';

describe('UpdateCompanyStatusDto', () => {
  it('accepts ACTIVE', async () => {
    const dto = plainToInstance(UpdateCompanyStatusDto, {
      status: CompanyStatus.ACTIVE,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts INACTIVE', async () => {
    const dto = plainToInstance(UpdateCompanyStatusDto, {
      status: CompanyStatus.INACTIVE,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an unsupported status', async () => {
    const dto = plainToInstance(UpdateCompanyStatusDto, {
      status: 'DELETED',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing status', async () => {
    const dto = plainToInstance(UpdateCompanyStatusDto, {});

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
