import { NotFoundException } from '@nestjs/common';
import { EmployeeType } from '@payroll/database';

import type { PrismaService } from '../database/prisma.service';
import { EmployeeLeaveEntitlementService } from './employee-leave-entitlement.service';

describe('EmployeeLeaveEntitlementService', () => {
  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  function createPrisma(
    employeeType: EmployeeType | null,
    startDate: string,
  ): PrismaService {
    return {
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: employeeId,

          employeeNumber: 'EMP-000001',

          employmentRecords: [
            {
              id: employmentRecordId,

              employeeType,

              startDate: new Date(`${startDate}T00:00:00.000Z`),
            },
          ],
        }),
      },
    } as unknown as PrismaService;
  }

  it('returns full 10-day entitlement for eligible La Comfianza internal employee', async () => {
    const service = new EmployeeLeaveEntitlementService(
      createPrisma(EmployeeType.LACOM_INTERNAL, '2026-01-01'),
    );

    const result = await service.getLeaveEntitlement(employeeId, '2026-07-01');

    expect(result).toEqual({
      employeeId,

      employeeNumber: 'EMP-000001',

      employmentRecordId,

      employeeType: EmployeeType.LACOM_INTERNAL,

      employmentStartDate: '2026-01-01',

      asOfDate: '2026-07-01',

      eligibilityStatus: 'ELIGIBLE',

      eligibilityDate: '2026-07-01',

      eligible: true,

      annualPaidLeaveDays: 10,

      balanceAllocation: {
        mode: 'SEPARATE_VL_SL',
        vacationLeaveDays: 5,
        sickLeaveDays: 5,
        sharedVlSlPoolDays: 0,
      },

      calendarAllocationPolicy:
        'FULL_ON_ELIGIBILITY_RESET_JANUARY_1_NO_CARRYOVER',
    });
  });

  it('returns 5-day entitlement but not yet eligible before one year for client employee', async () => {
    const service = new EmployeeLeaveEntitlementService(
      createPrisma(EmployeeType.CLIENT_EMPLOYEE, '2026-01-15'),
    );

    const result = await service.getLeaveEntitlement(employeeId, '2027-01-14');

    expect(result.eligibilityStatus).toBe('NOT_YET_ELIGIBLE');

    expect(result.eligibilityDate).toBe('2027-01-15');

    expect(result.eligible).toBe(false);

    expect(result.annualPaidLeaveDays).toBe(5);
  });

  it('returns classification required when current employment has no Employee Type', async () => {
    const service = new EmployeeLeaveEntitlementService(
      createPrisma(null, '2026-01-01'),
    );

    const result = await service.getLeaveEntitlement(employeeId, '2026-12-31');

    expect(result.eligibilityStatus).toBe('CLASSIFICATION_REQUIRED');

    expect(result.employeeType).toBeNull();

    expect(result.eligibilityDate).toBeNull();

    expect(result.eligible).toBeNull();

    expect(result.annualPaidLeaveDays).toBeNull();

    expect(result.balanceAllocation).toBeNull();

    expect(result.calendarAllocationPolicy).toBeNull();
  });

  it('throws when employee has no current employment assignment', async () => {
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: employeeId,

          employeeNumber: 'EMP-000001',

          employmentRecords: [],
        }),
      },
    } as unknown as PrismaService;

    const service = new EmployeeLeaveEntitlementService(prisma);

    await expect(
      service.getLeaveEntitlement(employeeId, '2026-09-28'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when employee does not exist', async () => {
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    const service = new EmployeeLeaveEntitlementService(prisma);

    await expect(
      service.getLeaveEntitlement(employeeId, '2026-09-28'),
    ).rejects.toThrow('Employee not found.');
  });
});
