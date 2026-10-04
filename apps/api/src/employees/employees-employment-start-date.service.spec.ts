import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import { EmployeesService } from './employees.service';

describe('EmployeesService correctEmploymentStartDate', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const companyId = '11111111-1111-4111-8111-111111111111';

  function createEmployee(startDate = new Date('2026-08-01T00:00:00.000Z')) {
    return {
      id: employeeId,
      employeeNumber: 'EMP-000001',

      firstName: 'Gino',
      middleName: null,
      lastName: 'Suson',
      suffix: null,

      email: null,
      mobile: null,

      addressLine1: null,
      addressLine2: null,
      barangay: null,
      city: null,
      province: null,
      postalCode: null,
      country: 'Philippines',

      currentStatus: 'ACTIVE' as const,

      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),

      employmentRecords: [
        {
          id: employmentRecordId,

          companyEmployeeNumber: null,

          startDate,
          endDate: null,

          company: {
            id: companyId,
            code: 'TEST',
            name: 'Test Company',
          },

          department: null,
          position: null,

          payrollProfile: null,
        },
      ],
    };
  }

  function createFixture(options?: {
    dtrCount?: number;
    payrollResultCount?: number;
    previousEmploymentEndDate?: Date | null;
    compensationEffectiveFrom?: Date | null;
    recurringItemEffectiveFrom?: Date | null;
  }) {
    const currentEmployee = createEmployee();

    const updatedEmployee = createEmployee(
      new Date('2026-09-18T00:00:00.000Z'),
    );

    const employmentUpdate = jest.fn().mockResolvedValue({
      id: employmentRecordId,
    });

    const employeeFindUniqueOrThrow = jest
      .fn()
      .mockResolvedValue(updatedEmployee);

    const transactionClient = {
      employmentRecord: {
        update: employmentUpdate,
      },

      employee: {
        findUniqueOrThrow: employeeFindUniqueOrThrow,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(currentEmployee),
      },

      employmentRecord: {
        findFirst: jest.fn().mockResolvedValue(
          options?.previousEmploymentEndDate
            ? {
                id: 'previous-employment',
                endDate: options.previousEmploymentEndDate,
              }
            : null,
        ),
      },

      dtr: {
        count: jest.fn().mockResolvedValue(options?.dtrCount ?? 0),
      },

      payrollRunEmployee: {
        count: jest.fn().mockResolvedValue(options?.payrollResultCount ?? 0),
      },

      compensationRecord: {
        findFirst: jest.fn().mockResolvedValue(
          options?.compensationEffectiveFrom
            ? {
                effectiveFrom: options.compensationEffectiveFrom,
              }
            : null,
        ),
      },

      recurringPayrollItem: {
        findFirst: jest.fn().mockResolvedValue(
          options?.recurringItemEffectiveFrom
            ? {
                effectiveFrom: options.recurringItemEffectiveFrom,
              }
            : null,
        ),
      },

      $transaction: jest
        .fn()
        .mockImplementation(
          (
            input:
              | Promise<unknown>[]
              | ((transaction: Prisma.TransactionClient) => Promise<unknown>),
          ) => {
            if (Array.isArray(input)) {
              return Promise.all(input);
            }

            return input(transactionClient);
          },
        ),
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeesService(prisma, auditLog);

    return {
      service,
      employmentUpdate,
      recordSuccessInTransaction,
    };
  }

  it('corrects the current employment start date and returns the corrected value', async () => {
    const { service, employmentUpdate, recordSuccessInTransaction } =
      createFixture();

    const result = await service.correctEmploymentStartDate(
      employeeId,
      {
        correctedStartDate: '2026-09-18',
        reason: 'Incorrect start date entered during setup.',
      },
      actorUserId,
    );

    expect(employmentUpdate).toHaveBeenCalledWith({
      where: {
        id: employmentRecordId,
      },

      data: {
        startDate: new Date('2026-09-18'),
      },
    });

    expect(result.currentEmployment?.startDate).toEqual(
      new Date('2026-09-18T00:00:00.000Z'),
    );

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId,

        companyId,

        action: 'EMPLOYMENT_START_DATE_CORRECTED',

        entityId: employeeId,

        reference: 'EMP-000001',

        metadata: {
          employmentRecordId,

          previousStartDate: '2026-08-01',

          correctedStartDate: '2026-09-18',

          reason: 'Incorrect start date entered during setup.',
        },
      }),
    );
  });

  it('rejects the same start date', async () => {
    const { service } = createFixture();

    await expect(
      service.correctEmploymentStartDate(
        employeeId,
        {
          correctedStartDate: '2026-08-01',

          reason: 'No actual change.',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects correction when DTR history exists', async () => {
    const { service } = createFixture({
      dtrCount: 1,
    });

    await expect(
      service.correctEmploymentStartDate(
        employeeId,
        {
          correctedStartDate: '2026-09-18',

          reason: 'Correction attempt.',
        },
        actorUserId,
      ),
    ).rejects.toThrow(
      'Employment start date cannot be corrected because DTR history already exists for this employment assignment.',
    );
  });

  it('rejects correction when payroll history exists', async () => {
    const { service } = createFixture({
      payrollResultCount: 1,
    });

    await expect(
      service.correctEmploymentStartDate(
        employeeId,
        {
          correctedStartDate: '2026-09-18',

          reason: 'Correction attempt.',
        },
        actorUserId,
      ),
    ).rejects.toThrow(
      'Employment start date cannot be corrected because payroll history already exists for this employment assignment.',
    );
  });

  it('rejects a date that overlaps a previous employment assignment', async () => {
    const { service } = createFixture({
      previousEmploymentEndDate: new Date('2026-08-15T00:00:00.000Z'),
    });

    await expect(
      service.correctEmploymentStartDate(
        employeeId,
        {
          correctedStartDate: '2026-08-10',

          reason: 'Correction attempt.',
        },
        actorUserId,
      ),
    ).rejects.toThrow(
      'Corrected employment start date cannot be before the previous employment assignment end date.',
    );
  });

  it('rejects a corrected date equal to the previous employment assignment end date', async () => {
    const { service } = createFixture({
      previousEmploymentEndDate: new Date('2026-08-15T00:00:00.000Z'),
    });

    await expect(
      service.correctEmploymentStartDate(
        employeeId,
        {
          correctedStartDate: '2026-08-15',

          reason: 'Correction attempt.',
        },
        actorUserId,
      ),
    ).rejects.toThrow(
      'Corrected employment start date cannot be before the previous employment assignment end date.',
    );
  });

  it('rejects a corrected date later than an existing compensation effective date', async () => {
    const { service } = createFixture({
      compensationEffectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    });

    await expect(
      service.correctEmploymentStartDate(
        employeeId,
        {
          correctedStartDate: '2026-09-18',

          reason: 'Correction attempt.',
        },
        actorUserId,
      ),
    ).rejects.toThrow(
      'Corrected employment start date cannot be after an existing compensation effective date.',
    );
  });
});
