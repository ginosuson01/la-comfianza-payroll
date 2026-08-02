import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompanyStatus } from '@payroll/database';

import { ListCompaniesQueryDto } from './list-companies-query.dto';

describe('ListCompaniesQueryDto', () => {
  it('accepts valid query values', async () => {
    const dto = plainToInstance(ListCompaniesQueryDto, {
      search: 'Yakiniku',
      status: CompanyStatus.ACTIVE,
      page: '2',
      pageSize: '10',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.page).toBe(2);

    expect(dto.pageSize).toBe(10);
  });

  it('rejects an invalid status', async () => {
    const dto = plainToInstance(ListCompaniesQueryDto, {
      status: 'DELETED',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects page size above 100', async () => {
    const dto = plainToInstance(ListCompaniesQueryDto, {
      pageSize: '101',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
