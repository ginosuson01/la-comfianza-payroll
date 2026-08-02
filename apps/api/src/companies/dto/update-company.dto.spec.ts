import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateCompanyDto } from './update-company.dto';

describe('UpdateCompanyDto', () => {
  it('trims editable company fields', async () => {
    const dto = plainToInstance(UpdateCompanyDto, {
      name: ' Yakiniku – Manila ',

      city: ' Manila ',

      contactEmail: 'payroll@example.com',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.name).toBe('Yakiniku – Manila');

    expect(dto.city).toBe('Manila');
  });

  it('converts empty optional profile fields to null', async () => {
    const dto = plainToInstance(UpdateCompanyDto, {
      addressLine1: '   ',

      contactName: '',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.addressLine1).toBeNull();

    expect(dto.contactName).toBeNull();
  });

  it('rejects an empty company name', async () => {
    const dto = plainToInstance(UpdateCompanyDto, {
      name: '   ',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid contact email', async () => {
    const dto = plainToInstance(UpdateCompanyDto, {
      contactEmail: 'invalid-email',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
