import { ConflictException, NotFoundException } from '@nestjs/common';
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

describe('EmployeesService', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const companyId = '11111111-1111-4111-8111-111111111111';
  const departmentId = '22222222-2222-4222-8222-222222222222';
  const positionId = '33333333-3333-4333-8333-333333333333';
  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const createdAt = new Date('2026-09-15T00:00:00.000Z');
  const updatedAt = new Date('2026-09-15T00:00:00.000Z');

  const employeeRecord = {
    id: employeeId,
    employeeNumber: 'EMP-0001',

    firstName: 'Gino',
    middleName: 'Dela Cruz',
    lastName: 'Suson',
    suffix: null,

    email: 'gino@example.com',
    mobile: '+639171234567',

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

  describe('listEmployees', () => {
    it('lists employees with pagination and current employment summary', async () => {
      const prisma = {
        employee: {
          count: jest.fn(),
          findMany: jest.fn(),
        },

        $transaction: jest.fn().mockResolvedValue([1, [employeeRecord]]),
      } as unknown as PrismaService;

      const auditLog = {
        recordSuccessInTransaction: jest.fn(),
      } as unknown as AuditLogService;

      const service = new EmployeesService(prisma, auditLog);

      const result = await service.listEmployees({
        page: 1,
        pageSize: 25,
      });

      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      });

      expect(result.items).toHaveLength(1);

      expect(result.items[0]).toEqual({
        id: employeeId,
        employeeNumber: 'EMP-0001',

        firstName: 'Gino',
        middleName: 'Dela Cruz',
        lastName: 'Suson',
        suffix: null,

        fullName: 'Gino Dela Cruz Suson',

        email: 'gino@example.com',
        mobile: '+639171234567',

        currentStatus: EmployeePayrollStatus.ACTIVE,

        currentEmployment: {
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

          payoutMethod: PayoutMethod.ATM,
        },

        createdAt,
        updatedAt,
      });
    });

    it('applies employee and employment filters', async () => {
      const count = jest.fn().mockResolvedValue(0);
      const findMany = jest.fn().mockResolvedValue([]);

      const prisma = {
        employee: {
          count,
          findMany,
        },

        $transaction: jest.fn().mockResolvedValue([0, []]),
      } as unknown as PrismaService;

      const auditLog = {
        recordSuccessInTransaction: jest.fn(),
      } as unknown as AuditLogService;

      const service = new EmployeesService(prisma, auditLog);

      await service.listEmployees({
        search: 'Gino',
        companyId,
        departmentId,
        positionId,

        status: EmployeePayrollStatus.ACTIVE,
        payoutMethod: PayoutMethod.ATM,

        page: 2,
        pageSize: 10,
      });

      expect(count).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledTimes(1);

      expect(count).toHaveBeenCalledWith({
        where: {
          currentStatus: EmployeePayrollStatus.ACTIVE,

          employmentRecords: {
            some: {
              companyId,
              departmentId,
              positionId,

              payrollProfile: {
                is: {
                  payoutMethod: PayoutMethod.ATM,
                },
              },
            },
          },

          OR: [
            {
              employeeNumber: {
                contains: 'Gino',
                mode: 'insensitive',
              },
            },
            {
              firstName: {
                contains: 'Gino',
                mode: 'insensitive',
              },
            },
            {
              middleName: {
                contains: 'Gino',
                mode: 'insensitive',
              },
            },
            {
              lastName: {
                contains: 'Gino',
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: 'Gino',
                mode: 'insensitive',
              },
            },
            {
              mobile: {
                contains: 'Gino',
                mode: 'insensitive',
              },
            },
            {
              employmentRecords: {
                some: {
                  companyEmployeeNumber: {
                    contains: 'Gino',
                    mode: 'insensitive',
                  },
                },
              },
            },
          ],
        },
      });
    });

    it('returns zero total pages when no employees exist', async () => {
      const prisma = {
        employee: {
          count: jest.fn(),
          findMany: jest.fn(),
        },

        $transaction: jest.fn().mockResolvedValue([0, []]),
      } as unknown as PrismaService;

      const auditLog = {
        recordSuccessInTransaction: jest.fn(),
      } as unknown as AuditLogService;

      const service = new EmployeesService(prisma, auditLog);

      const result = await service.listEmployees({
        page: 1,
        pageSize: 25,
      });

      expect(result.items).toEqual([]);

      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe('createEmployee', () => {
    it('creates employee, employment, status history and audit atomically', async () => {
      const employeeCreate = jest.fn().mockResolvedValue({
        id: employeeId,
        employeeNumber: 'EMP-0001',

        firstName: 'Gino',
        middleName: 'Dela Cruz',
        lastName: 'Suson',
        suffix: null,
      });

      const employmentRecordCreate = jest.fn().mockResolvedValue({
        id: employmentRecordId,
      });

      const employeeStatusHistoryCreate = jest.fn().mockResolvedValue({
        id: '55555555-5555-4555-8555-555555555555',
      });

      const findUniqueOrThrow = jest.fn().mockResolvedValue(employeeRecord);

      const transaction = {
        employee: {
          create: employeeCreate,
          findUniqueOrThrow,
        },

        employmentRecord: {
          create: employmentRecordCreate,
        },

        employeeStatusHistory: {
          create: employeeStatusHistoryCreate,
        },
      } as unknown as Prisma.TransactionClient;

      const executeTransaction = jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        );

      const prisma = {
        employee: {
          findUnique: jest.fn().mockResolvedValue(null),
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
          findFirst: jest.fn().mockResolvedValue(null),
        },

        $transaction: executeTransaction,
      } as unknown as PrismaService;

      const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

      const auditLog = {
        recordSuccessInTransaction,
      } as unknown as AuditLogService;

      const service = new EmployeesService(prisma, auditLog);

      const result = await service.createEmployee(
        {
          employeeNumber: 'EMP-0001',

          firstName: 'Gino',
          middleName: 'Dela Cruz',
          lastName: 'Suson',

          email: 'gino@example.com',
          mobile: '+639171234567',

          companyId,
          departmentId,
          positionId,

          companyEmployeeNumber: 'YAK-001',

          employmentDate: '2026-09-01',

          status: EmployeePayrollStatus.ACTIVE,
        },

        actorUserId,
      );

      expect(employeeCreate).toHaveBeenCalledWith({
        data: {
          employeeNumber: 'EMP-0001',

          firstName: 'Gino',
          middleName: 'Dela Cruz',
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
        },

        select: {
          id: true,
          employeeNumber: true,

          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
        },
      });

      expect(employmentRecordCreate).toHaveBeenCalledWith({
        data: {
          employeeId,

          companyId,
          departmentId,
          positionId,

          companyEmployeeNumber: 'YAK-001',

          startDate: new Date('2026-09-01'),
        },
      });

      expect(employeeStatusHistoryCreate).toHaveBeenCalledWith({
        data: {
          employeeId,

          previousStatus: null,
          newStatus: EmployeePayrollStatus.ACTIVE,

          effectiveDate: new Date('2026-09-01'),

          changedByUserId: actorUserId,
        },
      });

      expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
        actorUserId,

        companyId,

        action: EmployeeManagementAuditAction.CREATED,

        module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

        entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

        entityId: employeeId,

        reference: 'EMP-0001',

        details: 'Created employee Gino Dela Cruz Suson (EMP-0001).',

        metadata: {
          employeeNumber: 'EMP-0001',

          status: EmployeePayrollStatus.ACTIVE,

          companyId,

          employmentDate: '2026-09-01',

          companyEmployeeNumber: 'YAK-001',

          departmentId,

          positionId,
        },
      });

      expect(result.id).toBe(employeeId);
      expect(result.fullName).toBe('Gino Dela Cruz Suson');
      expect(result.currentStatus).toBe(EmployeePayrollStatus.ACTIVE);
    });

    it('rejects an existing employee number before starting transaction', async () => {
      const executeTransaction = jest.fn();

      const prisma = {
        employee: {
          findUnique: jest.fn().mockResolvedValue({
            id: employeeId,
          }),
        },

        $transaction: executeTransaction,
      } as unknown as PrismaService;

      const recordSuccessInTransaction = jest.fn();

      const auditLog = {
        recordSuccessInTransaction,
      } as unknown as AuditLogService;

      const service = new EmployeesService(prisma, auditLog);

      await expect(
        service.createEmployee(
          {
            employeeNumber: 'EMP-0001',

            firstName: 'Gino',
            lastName: 'Suson',

            companyId,

            employmentDate: '2026-09-01',
          },

          actorUserId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(executeTransaction).not.toHaveBeenCalled();
      expect(recordSuccessInTransaction).not.toHaveBeenCalled();
    });

    it('rejects a department outside the selected company', async () => {
      const executeTransaction = jest.fn();

      const prisma = {
        employee: {
          findUnique: jest.fn().mockResolvedValue(null),
        },

        company: {
          findUnique: jest.fn().mockResolvedValue({
            id: companyId,
          }),
        },

        department: {
          findFirst: jest.fn().mockResolvedValue(null),
        },

        $transaction: executeTransaction,
      } as unknown as PrismaService;

      const auditLog = {
        recordSuccessInTransaction: jest.fn(),
      } as unknown as AuditLogService;

      const service = new EmployeesService(prisma, auditLog);

      await expect(
        service.createEmployee(
          {
            employeeNumber: 'EMP-0001',

            firstName: 'Gino',
            lastName: 'Suson',

            companyId,
            departmentId,

            employmentDate: '2026-09-01',
          },

          actorUserId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(executeTransaction).not.toHaveBeenCalled();
    });
  });
});
