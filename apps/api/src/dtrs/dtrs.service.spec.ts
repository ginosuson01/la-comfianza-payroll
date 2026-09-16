import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DtrStatus, PayrollCutoffStatus } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import {
  DTR_AUDIT_MODULE,
  DTR_ENTITY_TYPE,
  DtrAuditAction,
} from './dtr-audit.constants';
import type { CreateDtrDto } from './dto/create-dtr.dto';
import type { ListDtrsQueryDto } from './dto/list-dtrs-query.dto';
import { DtrsService } from './dtrs.service';

describe('DtrsService', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const employeeId = '22222222-2222-4222-8222-222222222222';

  const payrollCutoffId = '33333333-3333-4333-8333-333333333333';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const dtrId = '55555555-5555-4555-8555-555555555555';

  const input: CreateDtrDto = {
    companyId,
    employeeId,
    payrollCutoffId,
  };

  const cutoff = {
    id: payrollCutoffId,
    companyId,
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: new Date('2026-09-15T00:00:00.000Z'),
    payDate: new Date('2026-09-25T00:00:00.000Z'),
    status: PayrollCutoffStatus.OPEN,
  };

  const listDtr = {
    id: dtrId,

    companyId,
    employeeId,
    employmentRecordId,
    payrollCutoffId,

    status: DtrStatus.FOR_REVIEW,
    validatedAt: null,

    createdAt: new Date('2026-09-15T00:00:00.000Z'),
    updatedAt: new Date('2026-09-15T00:00:00.000Z'),

    company: {
      id: companyId,
      code: 'TEST',
      name: 'Test Company',
    },

    employee: {
      id: employeeId,
      employeeNumber: 'EMP-001',
      firstName: 'Juan',
      middleName: null,
      lastName: 'Dela Cruz',
      suffix: null,
      currentStatus: 'ACTIVE',
    },

    employmentRecord: {
      id: employmentRecordId,
      companyEmployeeNumber: 'COMP-EMP-001',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: null,
      department: null,
      position: null,
    },

    payrollCutoff: {
      id: payrollCutoffId,
      startDate: cutoff.startDate,
      endDate: cutoff.endDate,
      payDate: cutoff.payDate,
      status: PayrollCutoffStatus.OPEN,
    },

    _count: {
      entries: 10,
    },
  };

  const detailedDtr = {
    ...listDtr,

    entries: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        workDate: new Date('2026-09-05T00:00:00.000Z'),

        regularMinutes: 480,
        lateMinutes: 0,
        undertimeMinutes: 0,
        absenceMinutes: 0,
        leaveMinutes: 0,
        nightDifferentialMinutes: 60,

        restDay: false,

        leaveTypeId: null,
        holidayId: null,

        notes: null,

        createdAt: new Date('2026-09-05T00:00:00.000Z'),
        updatedAt: new Date('2026-09-05T00:00:00.000Z'),

        leaveType: null,
        holiday: null,

        overtimeEntries: [],
      },
    ],
  };

  const prismaMock = {
    payrollCutoff: {
      findUnique: jest.fn(),
    },

    employee: {
      findUnique: jest.fn(),
    },

    employmentRecord: {
      findFirst: jest.fn(),
    },

    dtr: {
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  const auditLogMock = {
    recordSuccessInTransaction: jest.fn(),
  };

  let service: DtrsService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new DtrsService(
      prismaMock as unknown as PrismaService,
      auditLogMock as unknown as AuditLogService,
    );
  });

  describe('listDtrs', () => {
    it('filters DTRs by company', async () => {
      prismaMock.$transaction.mockResolvedValue([1, [listDtr]]);

      const query: ListDtrsQueryDto = {
        companyId,
        page: 1,
        pageSize: 25,
      };

      const result = await service.listDtrs(query);

      expect(prismaMock.dtr.count).toHaveBeenCalledWith({
        where: {
          companyId,
        },
      });

      expect(prismaMock.dtr.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId,
          },

          skip: 0,
          take: 25,
        }),
      );

      expect(result.items).toEqual([listDtr]);

      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      });
    });

    it('filters DTRs by employee', async () => {
      prismaMock.$transaction.mockResolvedValue([1, [listDtr]]);

      const query: ListDtrsQueryDto = {
        employeeId,
        page: 1,
        pageSize: 25,
      };

      await service.listDtrs(query);

      expect(prismaMock.dtr.count).toHaveBeenCalledWith({
        where: {
          employeeId,
        },
      });

      expect(prismaMock.dtr.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employeeId,
          },
        }),
      );
    });

    it('filters DTRs by payroll cutoff', async () => {
      prismaMock.$transaction.mockResolvedValue([1, [listDtr]]);

      const query: ListDtrsQueryDto = {
        payrollCutoffId,
        page: 1,
        pageSize: 25,
      };

      await service.listDtrs(query);

      expect(prismaMock.dtr.count).toHaveBeenCalledWith({
        where: {
          payrollCutoffId,
        },
      });

      expect(prismaMock.dtr.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            payrollCutoffId,
          },
        }),
      );
    });

    it('filters DTRs by review status', async () => {
      prismaMock.$transaction.mockResolvedValue([1, [listDtr]]);

      const query: ListDtrsQueryDto = {
        status: DtrStatus.FOR_REVIEW,
        page: 1,
        pageSize: 25,
      };

      await service.listDtrs(query);

      expect(prismaMock.dtr.count).toHaveBeenCalledWith({
        where: {
          status: DtrStatus.FOR_REVIEW,
        },
      });

      expect(prismaMock.dtr.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: DtrStatus.FOR_REVIEW,
          },
        }),
      );
    });

    it('combines company, cutoff, and status filters for cutoff review', async () => {
      prismaMock.$transaction.mockResolvedValue([1, [listDtr]]);

      const query: ListDtrsQueryDto = {
        companyId,
        payrollCutoffId,
        status: DtrStatus.FOR_REVIEW,
        page: 1,
        pageSize: 100,
      };

      const result = await service.listDtrs(query);

      const expectedWhere = {
        companyId,
        payrollCutoffId,
        status: DtrStatus.FOR_REVIEW,
      };

      expect(prismaMock.dtr.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });

      expect(prismaMock.dtr.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          skip: 0,
          take: 100,
        }),
      );

      expect(result.items).toEqual([listDtr]);
    });

    it('combines company, employee, cutoff, and status filters', async () => {
      prismaMock.$transaction.mockResolvedValue([1, [listDtr]]);

      const query: ListDtrsQueryDto = {
        companyId,
        employeeId,
        payrollCutoffId,
        status: DtrStatus.VALIDATED,
        page: 1,
        pageSize: 25,
      };

      await service.listDtrs(query);

      const expectedWhere = {
        companyId,
        employeeId,
        payrollCutoffId,
        status: DtrStatus.VALIDATED,
      };

      expect(prismaMock.dtr.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });

      expect(prismaMock.dtr.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        }),
      );
    });

    it('searches employee and company employee identifiers and names', async () => {
      prismaMock.$transaction.mockResolvedValue([1, [listDtr]]);

      const query: ListDtrsQueryDto = {
        search: '  Cruz  ',
        page: 1,
        pageSize: 25,
      };

      await service.listDtrs(query);

      expect(prismaMock.dtr.count).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              employee: {
                is: {
                  employeeNumber: {
                    contains: 'Cruz',
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              employee: {
                is: {
                  firstName: {
                    contains: 'Cruz',
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              employee: {
                is: {
                  middleName: {
                    contains: 'Cruz',
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              employee: {
                is: {
                  lastName: {
                    contains: 'Cruz',
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              employmentRecord: {
                is: {
                  companyEmployeeNumber: {
                    contains: 'Cruz',
                    mode: 'insensitive',
                  },
                },
              },
            },
          ],
        },
      });
    });

    it('applies pagination and deterministic cutoff and employee ordering', async () => {
      prismaMock.$transaction.mockResolvedValue([26, [listDtr]]);

      const query: ListDtrsQueryDto = {
        page: 2,
        pageSize: 10,
      };

      const result = await service.listDtrs(query);

      expect(prismaMock.dtr.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},

          orderBy: [
            {
              payrollCutoff: {
                startDate: 'desc',
              },
            },
            {
              employee: {
                lastName: 'asc',
              },
            },
            {
              employee: {
                firstName: 'asc',
              },
            },
          ],

          skip: 10,
          take: 10,
        }),
      );

      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 10,
        total: 26,
        totalPages: 3,
      });
    });
  });

  describe('getDtrById', () => {
    it('returns DTR detail including attendance entries for review', async () => {
      prismaMock.dtr.findUnique.mockResolvedValue(detailedDtr);

      const result = await service.getDtrById(dtrId);

      expect(prismaMock.dtr.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: dtrId,
          },
        }),
      );

      expect(result).toEqual(detailedDtr);

      expect(result.entries).toHaveLength(1);

      expect(result.entries[0]).toEqual(
        expect.objectContaining({
          workDate: new Date('2026-09-05T00:00:00.000Z'),
          regularMinutes: 480,
          nightDifferentialMinutes: 60,
        }),
      );
    });

    it('throws when the requested DTR detail does not exist', async () => {
      prismaMock.dtr.findUnique.mockResolvedValue(null);

      await expect(service.getDtrById(dtrId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createDtr', () => {
    it('throws when the payroll cutoff does not exist', async () => {
      prismaMock.payrollCutoff.findUnique.mockResolvedValue(null);

      await expect(
        service.createDtr(input, actorUserId),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.employee.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a cutoff that belongs to another company', async () => {
      prismaMock.payrollCutoff.findUnique.mockResolvedValue({
        ...cutoff,
        companyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      });

      await expect(
        service.createDtr(input, actorUserId),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.employee.findUnique).not.toHaveBeenCalled();
    });

    it('rejects creation when the payroll cutoff is locked', async () => {
      prismaMock.payrollCutoff.findUnique.mockResolvedValue({
        ...cutoff,
        status: PayrollCutoffStatus.LOCKED,
      });

      await expect(
        service.createDtr(input, actorUserId),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.employee.findUnique).not.toHaveBeenCalled();
    });

    it('throws when the employee does not exist', async () => {
      prismaMock.payrollCutoff.findUnique.mockResolvedValue(cutoff);
      prismaMock.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.createDtr(input, actorUserId),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.employmentRecord.findFirst).not.toHaveBeenCalled();
    });

    it('rejects an employee without an applicable company assignment', async () => {
      prismaMock.payrollCutoff.findUnique.mockResolvedValue(cutoff);

      prismaMock.employee.findUnique.mockResolvedValue({
        id: employeeId,
        employeeNumber: 'EMP-001',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
      });

      prismaMock.employmentRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.createDtr(input, actorUserId),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.dtr.findUnique).not.toHaveBeenCalled();
    });

    it('rejects duplicate DTR creation for the employee and cutoff', async () => {
      prismaMock.payrollCutoff.findUnique.mockResolvedValue(cutoff);

      prismaMock.employee.findUnique.mockResolvedValue({
        id: employeeId,
        employeeNumber: 'EMP-001',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
      });

      prismaMock.employmentRecord.findFirst.mockResolvedValue({
        id: employmentRecordId,
        employeeId,
        companyId,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: null,
      });

      prismaMock.dtr.findUnique.mockResolvedValue({
        id: dtrId,
      });

      await expect(
        service.createDtr(input, actorUserId),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('creates a DTR and records a success audit log', async () => {
      prismaMock.payrollCutoff.findUnique.mockResolvedValue(cutoff);

      prismaMock.employee.findUnique.mockResolvedValue({
        id: employeeId,
        employeeNumber: 'EMP-001',
        firstName: 'Juan',
        middleName: null,
        lastName: 'Dela Cruz',
        suffix: null,
        currentStatus: 'ACTIVE',
      });

      prismaMock.employmentRecord.findFirst.mockResolvedValue({
        id: employmentRecordId,
        employeeId,
        companyId,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: null,
      });

      const createdDtr = {
        id: dtrId,
        companyId,
        employeeId,
        employmentRecordId,
        payrollCutoffId,
        status: DtrStatus.DRAFT,
        validatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.dtr.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(detailedDtr);

      const transaction = {
        dtr: {
          create: jest.fn().mockResolvedValue(createdDtr),
        },
      };

      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      );

      auditLogMock.recordSuccessInTransaction.mockResolvedValue(undefined);

      const result = await service.createDtr(input, actorUserId);

      expect(transaction.dtr.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            companyId,
            employeeId,
            employmentRecordId,
            payrollCutoffId,
          },
        }),
      );

      expect(auditLogMock.recordSuccessInTransaction).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          actorUserId,
          companyId,
          action: DtrAuditAction.CREATED,
          module: DTR_AUDIT_MODULE,
          entityType: DTR_ENTITY_TYPE,
          entityId: dtrId,
        }),
      );

      expect(result).toEqual(detailedDtr);
    });
  });

  describe('updateDtrStatus', () => {
    it('throws when changing the status of a DTR that does not exist', async () => {
      prismaMock.dtr.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDtrStatus(
          dtrId,
          {
            status: DtrStatus.FOR_REVIEW,
          },
          actorUserId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a DTR status change when the payroll cutoff is locked', async () => {
      prismaMock.dtr.findUnique.mockResolvedValue({
        id: dtrId,
        companyId,
        employeeId,
        status: DtrStatus.DRAFT,

        employee: {
          employeeNumber: 'EMP-001',
        },

        payrollCutoff: {
          id: payrollCutoffId,
          status: PayrollCutoffStatus.LOCKED,
        },
      });

      await expect(
        service.updateDtrStatus(
          dtrId,
          {
            status: DtrStatus.FOR_REVIEW,
          },
          actorUserId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an invalid DTR status transition', async () => {
      prismaMock.dtr.findUnique.mockResolvedValue({
        id: dtrId,
        companyId,
        employeeId,
        status: DtrStatus.DRAFT,

        employee: {
          employeeNumber: 'EMP-001',
        },

        payrollCutoff: {
          id: payrollCutoffId,
          status: PayrollCutoffStatus.OPEN,
        },
      });

      await expect(
        service.updateDtrStatus(
          dtrId,
          {
            status: DtrStatus.VALIDATED,
          },
          actorUserId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('moves a DTR from DRAFT to FOR_REVIEW and records a status-change audit log', async () => {
      const currentDtr = {
        id: dtrId,
        companyId,
        employeeId,
        status: DtrStatus.DRAFT,

        employee: {
          employeeNumber: 'EMP-001',
        },

        payrollCutoff: {
          id: payrollCutoffId,
          status: PayrollCutoffStatus.OPEN,
        },
      };

      const reviewedDtr = {
        id: dtrId,
        status: DtrStatus.FOR_REVIEW,
      };

      prismaMock.dtr.findUnique
        .mockResolvedValueOnce(currentDtr)
        .mockResolvedValueOnce(reviewedDtr);

      const transaction = {
        dtr: {
          update: jest.fn().mockResolvedValue({
            id: dtrId,
          }),
        },
      };

      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      );

      auditLogMock.recordSuccessInTransaction.mockResolvedValue(undefined);

      const result = await service.updateDtrStatus(
        dtrId,
        {
          status: DtrStatus.FOR_REVIEW,
        },
        actorUserId,
      );

      expect(transaction.dtr.update).toHaveBeenCalledWith({
        where: {
          id: dtrId,
        },

        data: {
          status: DtrStatus.FOR_REVIEW,
          validatedAt: null,
        },
      });

      expect(auditLogMock.recordSuccessInTransaction).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          actorUserId,
          companyId,
          action: DtrAuditAction.STATUS_CHANGED,
          module: DTR_AUDIT_MODULE,
          entityType: DTR_ENTITY_TYPE,
          entityId: dtrId,
          reference: 'EMP-001',
        }),
      );

      expect(result).toEqual(reviewedDtr);
    });

    it('moves a DTR from FOR_REVIEW to VALIDATED and sets validatedAt', async () => {
      const currentDtr = {
        id: dtrId,
        companyId,
        employeeId,
        status: DtrStatus.FOR_REVIEW,

        employee: {
          employeeNumber: 'EMP-001',
        },

        payrollCutoff: {
          id: payrollCutoffId,
          status: PayrollCutoffStatus.OPEN,
        },
      };

      const validatedDtr = {
        id: dtrId,
        status: DtrStatus.VALIDATED,
      };

      prismaMock.dtr.findUnique
        .mockResolvedValueOnce(currentDtr)
        .mockResolvedValueOnce(validatedDtr);

      const transaction = {
        dtr: {
          update: jest.fn().mockResolvedValue({
            id: dtrId,
          }),
        },
      };

      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      );

      auditLogMock.recordSuccessInTransaction.mockResolvedValue(undefined);

      const result = await service.updateDtrStatus(
        dtrId,
        {
          status: DtrStatus.VALIDATED,
        },
        actorUserId,
      );

      expect(transaction.dtr.update).toHaveBeenCalledWith({
        where: {
          id: dtrId,
        },

        data: {
          status: DtrStatus.VALIDATED,
          validatedAt: expect.any(Date) as Date,
        },
      });

      expect(auditLogMock.recordSuccessInTransaction).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          actorUserId,
          companyId,
          action: DtrAuditAction.VALIDATED,
          module: DTR_AUDIT_MODULE,
          entityType: DTR_ENTITY_TYPE,
          entityId: dtrId,
        }),
      );

      expect(result).toEqual(validatedDtr);
    });

    it('clears validatedAt when a validated DTR returns to review', async () => {
      const currentDtr = {
        id: dtrId,
        companyId,
        employeeId,
        status: DtrStatus.VALIDATED,

        employee: {
          employeeNumber: 'EMP-001',
        },

        payrollCutoff: {
          id: payrollCutoffId,
          status: PayrollCutoffStatus.REOPENED,
        },
      };

      const reviewedDtr = {
        id: dtrId,
        status: DtrStatus.FOR_REVIEW,
      };

      prismaMock.dtr.findUnique
        .mockResolvedValueOnce(currentDtr)
        .mockResolvedValueOnce(reviewedDtr);

      const transaction = {
        dtr: {
          update: jest.fn().mockResolvedValue({
            id: dtrId,
          }),
        },
      };

      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      );

      auditLogMock.recordSuccessInTransaction.mockResolvedValue(undefined);

      const result = await service.updateDtrStatus(
        dtrId,
        {
          status: DtrStatus.FOR_REVIEW,
        },
        actorUserId,
      );

      expect(transaction.dtr.update).toHaveBeenCalledWith({
        where: {
          id: dtrId,
        },

        data: {
          status: DtrStatus.FOR_REVIEW,
          validatedAt: null,
        },
      });

      expect(auditLogMock.recordSuccessInTransaction).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          action: DtrAuditAction.STATUS_CHANGED,
        }),
      );

      expect(result).toEqual(reviewedDtr);
    });
  });
});
