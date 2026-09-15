import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateEmployeeDto } from './update-employee.dto';

describe('UpdateEmployeeDto', () => {
  it('accepts and trims profile updates', async () => {
    const dto = plainToInstance(UpdateEmployeeDto, {
      firstName: ' Gino ',
      lastName: ' Suson ',
      email: ' gino@example.com ',
      mobile: ' +639171234567 ',
      city: ' Quezon City ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.firstName).toBe('Gino');
    expect(dto.lastName).toBe('Suson');
    expect(dto.email).toBe('gino@example.com');
    expect(dto.mobile).toBe('+639171234567');
    expect(dto.city).toBe('Quezon City');
  });

  it('converts blank optional values to null', async () => {
    const dto = plainToInstance(UpdateEmployeeDto, {
      middleName: '   ',
      suffix: '',
      mobile: '   ',
      addressLine2: ' ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.middleName).toBeNull();
    expect(dto.suffix).toBeNull();
    expect(dto.mobile).toBeNull();
    expect(dto.addressLine2).toBeNull();
  });

  it('rejects clearing a required name', async () => {
    const dto = plainToInstance(UpdateEmployeeDto, {
      firstName: '   ',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(UpdateEmployeeDto, {
      email: 'not-an-email',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
