import { BadRequestException } from '@nestjs/common';
import {
  EmployeePayrollStatus,
  PayoutMethod,
  type Prisma,
} from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';
import { EmployeesService } from './employees.service';

describe('EmployeesService changeEmploymentAssignment', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const newCompanyId = '66666666-6666-4666-8666-666666666666';

  const departmentId = '22222222-2222-4222-8222-222222222222';

  const newDepartmentId = '77777777-7777-4777-8777-777777777777';

  const positionId = '33333333-3333-4333-8333-333333333333';

  const newPositionId = '88888888-8888-4888-8888-888888888888';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const newEmploymentRecordId = '55555555-5555-4555-8555-555555555555';

  const createdAt = new Date('2026-09-01T00:00:00.000Z');

  const updatedAt = new Date('2026-09-15T00:00:00.000Z');

  const currentEmployee = {
    id: employeeId,
    employeeNumber: 'EMP-0001',

    firstName: 'Gino',
    middleName: null,
    lastName: 'Suson',
    suffix: null,

    email: 'gino@example.com',
    mobile: '+639171234567',

    addressLine1: null,
    addressLine2: null,
    barangay: null,
    city: null,
    province: null,
    postalCode: null,
    country: 'Philippines',

    currentStatus: EmployeePayrollStatus.ACTIVE,

    createdAt,
    updatedAt,

    employmentRecords: [
      {
        id: employmentRecordId,
        companyEmployeeNumber: 'YAK-001',

        startDate: new Date('2026-09-01T00:00:00.000Z'),

        endDate: null,

        company: {
          id: companyId,
          code: 'YAK-QC',
          name: 'Yakiniku – Quezon City',
        },

        department: {
          id: departmentId,
          code: 'OPS',
          name: 'Operations',
        },

        position: {
          id: positionId,
          code: 'CREW',
          name: 'Service Crew',
        },

        payrollProfile: {
          payoutMethod: PayoutMethod.ATM,
        },
      },
    ],
  };

  it('preserves history when changing department and position within the same company', async () => {
    const effectiveDate = new Date('2026-09-20T00:00:00.000Z');

    const updatedEmployee = {
      ...currentEmployee,

      employmentRecords: [
        {
          id: newEmploymentRecordId,
          companyEmployeeNumber: 'YAK-001',

          startDate: effectiveDate,
          endDate: null,

          company: {
            id: companyId,
            code: 'YAK-QC',
            name: 'Yakiniku – Quezon City',
          },

          department: {
            id: newDepartmentId,
            code: 'ADMIN',
            name: 'Administration',
          },

          position: {
            id: newPositionId,
            code: 'SUP',
            name: 'Supervisor',
          },

          payrollProfile: null,
        },

        {
          ...currentEmployee.employmentRecords[0],
          endDate: effectiveDate,
        },
      ],
    };

    const employmentUpdate = jest.fn().mockResolvedValue({
      id: employmentRecordId,
    });

    const employmentCreate = jest.fn().mockResolvedValue({
      id: newEmploymentRecordId,
    });

    const transaction = {
      employmentRecord: {
        update: employmentUpdate,
        create: employmentCreate,
      },

      employee: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedEmployee),
      },
    } as unknown as Prisma.TransactionClient;

    const executeTransaction = jest
      .fn()
      .mockImplementation(
        (
          callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        ) => callback(transaction),
      );

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(currentEmployee),
      },

      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: companyId,
        }),
      },

      department: {
        findFirst: jest.fn().mockResolvedValue({
          id: newDepartmentId,
        }),
      },

      position: {
        findFirst: jest.fn().mockResolvedValue({
          id: newPositionId,
        }),
      },

      employmentRecord: {
        findFirst: jest.fn(),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeesService(prisma, auditLog);

    const result = await service.changeEmploymentAssignment(
      employeeId,
      {
        companyId,
        departmentId: newDepartmentId,
        positionId: newPositionId,
        effectiveDate: '2026-09-20',
      },
      actorUserId,
    );

    expect(employmentUpdate).toHaveBeenCalledWith({
      where: {
        id: employmentRecordId,
      },

      data: {
        endDate: effectiveDate,
      },
    });

    expect(employmentCreate).toHaveBeenCalledWith({
      data: {
        employeeId,

        companyId,

        departmentId: newDepartmentId,
        positionId: newPositionId,

        companyEmployeeNumber: 'YAK-001',

        startDate: effectiveDate,
      },

      select: {
        id: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: EmployeeManagementAuditAction.EMPLOYMENT_CHANGED,

      module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

      entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

      entityId: employeeId,

      reference: 'EMP-0001',

      details: 'Changed employment assignment for Gino Suson (EMP-0001).',

      metadata: {
        previousEmploymentRecordId: employmentRecordId,

        newEmploymentRecordId,

        effectiveDate: '2026-09-20',

        previousCompanyId: companyId,
        newCompanyId: companyId,

        previousDepartmentId: departmentId,
        newDepartmentId,

        previousPositionId: positionId,
        newPositionId,

        previousCompanyEmployeeNumber: 'YAK-001',

        newCompanyEmployeeNumber: 'YAK-001',
      },
    });

    expect(result.currentEmployment?.id).toBe(newEmploymentRecordId);

    expect(result.currentEmployment?.department?.id).toBe(newDepartmentId);

    expect(result.currentEmployment?.position?.id).toBe(newPositionId);
  });

  it('resets company-specific assignment fields when transferring company unless new values are supplied', async () => {
    const effectiveDate = new Date('2026-09-25T00:00:00.000Z');

    const transferredEmployee = {
      ...currentEmployee,

      employmentRecords: [
        {
          id: newEmploymentRecordId,
          companyEmployeeNumber: null,

          startDate: effectiveDate,
          endDate: null,

          company: {
            id: newCompanyId,
            code: 'SHAB-MNL',
            name: 'Shaburo – Manila',
          },

          department: null,
          position: null,
          payrollProfile: null,
        },

        {
          ...currentEmployee.employmentRecords[0],
          endDate: effectiveDate,
        },
      ],
    };

    const employmentCreate = jest.fn().mockResolvedValue({
      id: newEmploymentRecordId,
    });

    const transaction = {
      employmentRecord: {
        update: jest.fn().mockResolvedValue({
          id: employmentRecordId,
        }),

        create: employmentCreate,
      },

      employee: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(transferredEmployee),
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(currentEmployee),
      },

      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: newCompanyId,
        }),
      },

      department: {
        findFirst: jest.fn(),
      },

      position: {
        findFirst: jest.fn(),
      },

      employmentRecord: {
        findFirst: jest.fn(),
      },

      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditLogService;

    const service = new EmployeesService(prisma, auditLog);

    const result = await service.changeEmploymentAssignment(
      employeeId,
      {
        companyId: newCompanyId,
        effectiveDate: '2026-09-25',
      },
      actorUserId,
    );

    expect(employmentCreate).toHaveBeenCalledWith({
      data: {
        employeeId,

        companyId: newCompanyId,

        departmentId: null,
        positionId: null,

        companyEmployeeNumber: null,

        startDate: effectiveDate,
      },

      select: {
        id: true,
      },
    });

    expect(result.currentEmployment?.company.id).toBe(newCompanyId);

    expect(result.currentEmployment?.department).toBeNull();

    expect(result.currentEmployment?.position).toBeNull();

    expect(result.currentEmployment?.companyEmployeeNumber).toBeNull();
  });

  it('does not create a new employment record when the assignment is unchanged', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(currentEmployee),
      },

      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: companyId,
        }),
      },

      department: {
        findFirst: jest.fn().mockResolvedValue({
          id: departmentId,
        }),
      },

      position: {
        findFirst: jest.fn().mockResolvedValue({
          id: positionId,
        }),
      },

      employmentRecord: {
        findFirst: jest.fn(),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeesService(prisma, auditLog);

    const result = await service.changeEmploymentAssignment(
      employeeId,
      {
        companyId,
        departmentId,
        positionId,
        companyEmployeeNumber: 'YAK-001',
        effectiveDate: '2026-09-20',
      },
      actorUserId,
    );

    expect(executeTransaction).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();

    expect(result.currentEmployment?.id).toBe(employmentRecordId);
  });

  it('rejects an effective date that is not after the current employment start date', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(currentEmployee),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeesService(prisma, auditLog);

    await expect(
      service.changeEmploymentAssignment(
        employeeId,
        {
          companyId,
          effectiveDate: '2026-09-01',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });
});
