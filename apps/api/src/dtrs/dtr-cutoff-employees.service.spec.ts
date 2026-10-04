import { NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../database/prisma.service';
import { DtrCutoffEmployeesService } from './dtr-cutoff-employees.service';

describe('DtrCutoffEmployeesService', () => {
  function createFixture() {
    const payrollCutoffFindFirst = jest.fn();

    const employmentRecordFindMany = jest.fn();

    const dtrFindMany = jest.fn();

    const prisma = {
      payrollCutoff: {
        findFirst: payrollCutoffFindFirst,
      },

      employmentRecord: {
        findMany: employmentRecordFindMany,
      },

      dtr: {
        findMany: dtrFindMany,
      },
    } as unknown as PrismaService;

    const service = new DtrCutoffEmployeesService(prisma);

    return {
      service,
      payrollCutoffFindFirst,
      employmentRecordFindMany,
      dtrFindMany,
    };
  }

  const cutoff = {
    id: 'cutoff-1',

    startDate: new Date('2026-09-16T00:00:00.000Z'),

    endDate: new Date('2026-09-30T00:00:00.000Z'),
  };

  const kaiEmployment = {
    id: 'employment-kai',

    companyEmployeeNumber: 'GINO-001',

    startDate: new Date('2026-09-18T00:00:00.000Z'),

    endDate: null,

    employee: {
      id: 'employee-kai',

      employeeNumber: 'EMP-000001',

      firstName: 'Kai',
      middleName: null,
      lastName: 'Suson',
      suffix: null,

      currentStatus: 'ACTIVE',
    },
  };

  it('rejects a cutoff that does not belong to the selected company', async () => {
    const {
      service,
      payrollCutoffFindFirst,
      employmentRecordFindMany,
      dtrFindMany,
    } = createFixture();

    payrollCutoffFindFirst.mockResolvedValue(null);

    await expect(
      service.listCutoffEmployees({
        companyId: '11111111-1111-4111-8111-111111111111',

        payrollCutoffId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(employmentRecordFindMany).not.toHaveBeenCalled();

    expect(dtrFindMany).not.toHaveBeenCalled();
  });

  it('uses employment overlap rules for the selected cutoff', async () => {
    const {
      service,
      payrollCutoffFindFirst,
      employmentRecordFindMany,
      dtrFindMany,
    } = createFixture();

    payrollCutoffFindFirst.mockResolvedValue(cutoff);

    employmentRecordFindMany.mockResolvedValue([kaiEmployment]);

    dtrFindMany.mockResolvedValue([]);

    const result = await service.listCutoffEmployees({
      companyId: '11111111-1111-4111-8111-111111111111',

      payrollCutoffId: '22222222-2222-4222-8222-222222222222',
    });

    expect(employmentRecordFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: '11111111-1111-4111-8111-111111111111',

          startDate: {
            lte: cutoff.endDate,
          },

          OR: [
            {
              endDate: null,
            },
            {
              endDate: {
                gte: cutoff.startDate,
              },
            },
          ],
        },
      }),
    );

    expect(result).toEqual([
      expect.objectContaining({
        employeeId: 'employee-kai',

        employeeNumber: 'EMP-000001',

        employmentRecordId: 'employment-kai',

        dtr: null,
      }),
    ]);
  });

  it('returns an eligible employee with No-DTR state when no DTR exists', async () => {
    const {
      service,
      payrollCutoffFindFirst,
      employmentRecordFindMany,
      dtrFindMany,
    } = createFixture();

    payrollCutoffFindFirst.mockResolvedValue(cutoff);

    employmentRecordFindMany.mockResolvedValue([kaiEmployment]);

    dtrFindMany.mockResolvedValue([]);

    const result = await service.listCutoffEmployees({
      companyId: '11111111-1111-4111-8111-111111111111',

      payrollCutoffId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual({
      employeeId: 'employee-kai',

      employeeNumber: 'EMP-000001',

      firstName: 'Kai',

      middleName: null,

      lastName: 'Suson',

      suffix: null,

      currentStatus: 'ACTIVE',

      employmentRecordId: 'employment-kai',

      companyEmployeeNumber: 'GINO-001',

      employmentStartDate: kaiEmployment.startDate,

      employmentEndDate: null,

      dtr: null,
    });
  });

  it('attaches the existing DTR and entry count for an eligible employee', async () => {
    const {
      service,
      payrollCutoffFindFirst,
      employmentRecordFindMany,
      dtrFindMany,
    } = createFixture();

    payrollCutoffFindFirst.mockResolvedValue(cutoff);

    employmentRecordFindMany.mockResolvedValue([kaiEmployment]);

    dtrFindMany.mockResolvedValue([
      {
        id: 'dtr-kai',

        employmentRecordId: 'employment-kai',

        status: 'DRAFT',

        _count: {
          entries: 4,
        },
      },
    ]);

    const result = await service.listCutoffEmployees({
      companyId: '11111111-1111-4111-8111-111111111111',

      payrollCutoffId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result[0]?.dtr).toEqual({
      id: 'dtr-kai',

      status: 'DRAFT',

      entryCount: 4,
    });
  });

  it('does not query DTR records when no employment is eligible', async () => {
    const {
      service,
      payrollCutoffFindFirst,
      employmentRecordFindMany,
      dtrFindMany,
    } = createFixture();

    payrollCutoffFindFirst.mockResolvedValue(cutoff);

    employmentRecordFindMany.mockResolvedValue([]);

    const result = await service.listCutoffEmployees({
      companyId: '11111111-1111-4111-8111-111111111111',

      payrollCutoffId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result).toEqual([]);

    expect(dtrFindMany).not.toHaveBeenCalled();
  });

  it('filters eligible employees by employee or company employee number', async () => {
    const {
      service,
      payrollCutoffFindFirst,
      employmentRecordFindMany,
      dtrFindMany,
    } = createFixture();

    payrollCutoffFindFirst.mockResolvedValue(cutoff);

    employmentRecordFindMany.mockResolvedValue([
      kaiEmployment,

      {
        ...kaiEmployment,

        id: 'employment-other',

        companyEmployeeNumber: 'OTHER-001',

        employee: {
          ...kaiEmployment.employee,

          id: 'employee-other',

          employeeNumber: 'EMP-000002',

          firstName: 'Other',

          lastName: 'Employee',
        },
      },
    ]);

    dtrFindMany.mockResolvedValue([]);

    const result = await service.listCutoffEmployees({
      companyId: '11111111-1111-4111-8111-111111111111',

      payrollCutoffId: '22222222-2222-4222-8222-222222222222',

      search: 'GINO-001',
    });

    expect(result).toHaveLength(1);

    expect(result[0]?.employeeNumber).toBe('EMP-000001');
  });
});
