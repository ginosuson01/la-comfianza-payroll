import { BadRequestException } from '@nestjs/common';
import { EmployeeType, type Prisma } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import { EmployeeManagementAuditAction } from './employee-management-audit.constants';
import { EmployeesService } from './employees.service';

describe('EmployeesService correctEmploymentType', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const startDate = new Date('2020-01-15T00:00:00.000Z');

  function createEmployee(employeeType: EmployeeType | null) {
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
          employeeType,

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

  function createFixture(
    currentType: EmployeeType | null = null,
    leaveCycleCount = 0,
  ) {
    const currentEmployee = createEmployee(currentType);

    const updatedEmployee = createEmployee(EmployeeType.CLIENT_EMPLOYEE);

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

    const executeTransaction = jest
      .fn()
      .mockImplementation(
        (
          callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        ) => callback(transactionClient),
      );

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(currentEmployee),
      },

      employeeLeaveEntitlementCycle: {
        count: jest.fn().mockResolvedValue(leaveCycleCount),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeesService(prisma, auditLog);

    return {
      service,
      employmentUpdate,
      executeTransaction,
      recordSuccessInTransaction,
    };
  }

  it('classifies the current employment in place without changing its start date', async () => {
    const { service, employmentUpdate, recordSuccessInTransaction } =
      createFixture();

    const result = await service.correctEmploymentType(
      employeeId,
      {
        employeeType: EmployeeType.CLIENT_EMPLOYEE,

        reason: 'Initial classification of existing employee.',
      },
      actorUserId,
    );

    expect(employmentUpdate).toHaveBeenCalledWith({
      where: {
        id: employmentRecordId,
      },

      data: {
        employeeType: EmployeeType.CLIENT_EMPLOYEE,
      },
    });

    expect(result.currentEmployment?.employeeType).toBe(
      EmployeeType.CLIENT_EMPLOYEE,
    );

    expect(result.currentEmployment?.startDate).toEqual(startDate);

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId,

        companyId,

        action: EmployeeManagementAuditAction.EMPLOYMENT_TYPE_CORRECTED,

        entityId: employeeId,

        reference: 'EMP-000001',

        metadata: {
          employmentRecordId,

          previousEmployeeType: null,

          newEmployeeType: EmployeeType.CLIENT_EMPLOYEE,

          reason: 'Initial classification of existing employee.',
        },
      }),
    );
  });

  it('rejects employee type correction when annual leave entitlement history exists', async () => {
    const { service, executeTransaction } = createFixture(
      EmployeeType.LACOM_INTERNAL,
      1,
    );

    await expect(
      service.correctEmploymentType(
        employeeId,
        {
          employeeType: EmployeeType.CLIENT_EMPLOYEE,

          reason: 'Correction after leave initialization.',
        },
        actorUserId,
      ),
    ).rejects.toThrow(
      'Employee type cannot be corrected because annual leave entitlement history already exists for this employment assignment.',
    );

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects a no-op employee type correction', async () => {
    const { service, executeTransaction } = createFixture(
      EmployeeType.CLIENT_EMPLOYEE,
    );

    await expect(
      service.correctEmploymentType(
        employeeId,
        {
          employeeType: EmployeeType.CLIENT_EMPLOYEE,

          reason: 'No actual classification change.',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });
});
