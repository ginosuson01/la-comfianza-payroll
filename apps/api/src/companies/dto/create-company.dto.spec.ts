import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCompanyDto } from './create-company.dto';

describe('CreateCompanyDto', () => {
  it('normalizes and accepts a valid company', async () => {
    const dto = plainToInstance(CreateCompanyDto, {
      code: ' yak-qc ',

      name: ' Yakiniku – Quezon City ',

      addressLine1: ' Quezon Avenue ',

      city: ' Quezon City ',

      contactEmail: 'payroll@example.com',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.code).toBe('YAK-QC');

    expect(dto.name).toBe('Yakiniku – Quezon City');

    expect(dto.addressLine1).toBe('Quezon Avenue');
  });

  it('converts empty optional fields to undefined', async () => {
    const dto = plainToInstance(CreateCompanyDto, {
      code: 'TEST-01',

      name: 'Test Company',

      addressLine1: '   ',

      contactName: '',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.addressLine1).toBeUndefined();

    expect(dto.contactName).toBeUndefined();
  });

  it('rejects an invalid company code', async () => {
    const dto = plainToInstance(CreateCompanyDto, {
      code: 'YAK QC',

      name: 'Yakiniku Quezon City',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(CreateCompanyDto, {
      code: 'YAK-QC',

      name: 'Yakiniku Quezon City',

      contactEmail: 'invalid-email',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
