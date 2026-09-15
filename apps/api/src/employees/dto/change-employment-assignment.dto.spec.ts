import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ChangeEmploymentAssignmentDto } from './change-employment-assignment.dto';

describe('ChangeEmploymentAssignmentDto', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';

  const departmentId = '22222222-2222-4222-8222-222222222222';

  const positionId = '33333333-3333-4333-8333-333333333333';

  it('accepts a valid employment assignment change', async () => {
    const dto = plainToInstance(ChangeEmploymentAssignmentDto, {
      companyId,
      departmentId,
      positionId,
      companyEmployeeNumber: ' YAK-002 ',
      effectiveDate: '2026-09-20',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.companyEmployeeNumber).toBe('YAK-002');
  });

  it('converts a blank company employee number to null', async () => {
    const dto = plainToInstance(ChangeEmploymentAssignmentDto, {
      companyId,
      companyEmployeeNumber: '   ',
      effectiveDate: '2026-09-20',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.companyEmployeeNumber).toBeNull();
  });

  it('rejects an invalid company id', async () => {
    const dto = plainToInstance(ChangeEmploymentAssignmentDto, {
      companyId: 'invalid-company-id',
      effectiveDate: '2026-09-20',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid effective date', async () => {
    const dto = plainToInstance(ChangeEmploymentAssignmentDto, {
      companyId,
      effectiveDate: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
