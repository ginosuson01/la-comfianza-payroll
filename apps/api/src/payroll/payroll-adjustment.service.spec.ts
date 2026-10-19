import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PayrollAdjustmentType,
  PayrollCutoffStatus,
  PayrollStatutoryBasisTreatment,
  Prisma,
} from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import { PayrollAdjustmentService } from './payroll-adjustment.service';

describe('PayrollAdjustmentService', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const payrollCutoffId = '22222222-2222-4222-8222-222222222222';

  const employeeId = '33333333-3333-4333-8333-333333333333';

  const adjustmentId = '44444444-4444-4444-8444-444444444444';

  const cutoff: {
    id: string;
    companyId: string;
    startDate: Date;
    endDate: Date;
    status: PayrollCutoffStatus;
  } = {
    id: payrollCutoffId,

    companyId,

    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: new Date('2026-09-15T00:00:00.000Z'),

    status: PayrollCutoffStatus.OPEN,
  };

  const createdAt = new Date('2026-09-10T00:00:00.000Z');

  function createCreatedAdjustment(overrides: Record<string, unknown> = {}) {
    return {
      id: adjustmentId,

      companyId,
      payrollCutoffId,
      employeeId,

      type: PayrollAdjustmentType.EARNING,

      code: 'BONUS',
      description: 'Performance Bonus',

      amount: new Prisma.Decimal(1500),

      reason: 'Approved payroll adjustment',

      taxable: true,

      pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

      createdByUserId: actorUserId,
      createdAt,

      ...overrides,
    };
  }

  function createFixture(options?: {
    cutoffRows?: (typeof cutoff)[];
    employment?: { id: string } | null;
    existingAdjustment?: ReturnType<typeof createCreatedAdjustment> | null;
  }) {
    const cutoffRows = options?.cutoffRows ?? [cutoff];

    const employment =
      options?.employment === undefined
        ? {
            id: '55555555-5555-4555-8555-555555555555',
          }
        : options.employment;

    const existingAdjustment =
      options?.existingAdjustment === undefined
        ? createCreatedAdjustment()
        : options.existingAdjustment;

    const createdAdjustment = createCreatedAdjustment();

    const updatedAdjustment = createCreatedAdjustment();

    const payrollAdjustmentCreate = jest
      .fn()
      .mockResolvedValue(createdAdjustment);

    const payrollAdjustmentFindFirst = jest
      .fn()
      .mockResolvedValue(existingAdjustment);

    const payrollAdjustmentUpdate = jest
      .fn()
      .mockResolvedValue(updatedAdjustment);

    const payrollAdjustmentDelete = jest
      .fn()
      .mockResolvedValue(existingAdjustment);

    const employmentRecordFindFirst = jest.fn().mockResolvedValue(employment);

    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue(cutoffRows),

      employmentRecord: {
        findFirst: employmentRecordFindFirst,
      },

      payrollAdjustment: {
        create: payrollAdjustmentCreate,

        findFirst: payrollAdjustmentFindFirst,

        update: payrollAdjustmentUpdate,

        delete: payrollAdjustmentDelete,
      },
    } as unknown as Prisma.TransactionClient;

    const prismaTransaction = jest
      .fn()
      .mockImplementation(
        (
          callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        ) => callback(transaction),
      );

    const prisma = {
      $transaction: prismaTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new PayrollAdjustmentService(prisma, auditLog);

    return {
      service,

      prisma,

      transaction,

      employmentRecordFindFirst,
      prismaTransaction,

      payrollAdjustmentCreate,
      payrollAdjustmentFindFirst,
      payrollAdjustmentUpdate,
      payrollAdjustmentDelete,

      recordSuccessInTransaction,
    };
  }

  it('creates an earning adjustment with explicit Pag-IBIG treatment and audit', async () => {
    const {
      service,

      transaction,

      employmentRecordFindFirst,

      payrollAdjustmentCreate,

      recordSuccessInTransaction,
    } = createFixture();

    const result = await service.createAdjustment(
      companyId,
      payrollCutoffId,
      employeeId,
      {
        type: PayrollAdjustmentType.EARNING,

        code: 'BONUS',
        description: 'Performance Bonus',

        amount: 1500,

        reason: 'Approved payroll adjustment',

        taxable: true,

        pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
      },
      actorUserId,
    );

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);

    expect(employmentRecordFindFirst).toHaveBeenCalledWith({
      where: {
        companyId,
        employeeId,

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

      select: {
        id: true,
      },
    });

    expect(payrollAdjustmentCreate).toHaveBeenCalledWith({
      data: {
        companyId,
        payrollCutoffId,
        employeeId,

        type: PayrollAdjustmentType.EARNING,

        code: 'BONUS',
        description: 'Performance Bonus',

        amount: new Prisma.Decimal(1500),

        reason: 'Approved payroll adjustment',

        taxable: true,

        pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

        createdByUserId: actorUserId,
      },

      select: {
        id: true,

        companyId: true,
        payrollCutoffId: true,
        employeeId: true,

        type: true,

        code: true,
        description: true,

        amount: true,

        reason: true,

        taxable: true,

        pagIbigFundSalaryTreatment: true,

        createdByUserId: true,
        createdAt: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        actorUserId,

        companyId,

        action: 'PAYROLL_ADJUSTMENT_CREATED',

        module: 'PAYROLL',

        entityType: 'PAYROLL_ADJUSTMENT',

        entityId: adjustmentId,

        reference: 'BONUS',

        metadata: {
          payrollCutoffId,
          employeeId,

          type: PayrollAdjustmentType.EARNING,

          code: 'BONUS',

          amount: '1500',

          taxable: true,

          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
        },
      }),
    );

    expect(result).toEqual({
      id: adjustmentId,

      companyId,
      payrollCutoffId,
      employeeId,

      type: PayrollAdjustmentType.EARNING,

      code: 'BONUS',
      description: 'Performance Bonus',

      amount: '1500',

      reason: 'Approved payroll adjustment',

      taxable: true,

      pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

      createdByUserId: actorUserId,
      createdAt,
    });
  });

  it('rejects Pag-IBIG treatment on a deduction before starting a transaction', async () => {
    const { service, prismaTransaction } = createFixture();

    await expect(
      service.createAdjustment(
        companyId,
        payrollCutoffId,
        employeeId,
        {
          type: PayrollAdjustmentType.DEDUCTION,

          code: 'MEDICAL',
          description: 'Medical Deduction',

          amount: 500,

          reason: 'Approved deduction',

          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.EXCLUDE,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaTransaction).not.toHaveBeenCalled();
  });

  it('rejects an earning adjustment without explicit Pag-IBIG treatment', async () => {
    const { service, prismaTransaction } = createFixture();

    await expect(
      service.createAdjustment(
        companyId,
        payrollCutoffId,
        employeeId,
        {
          type: PayrollAdjustmentType.EARNING,

          code: 'BONUS',
          description: 'Performance Bonus',

          amount: 1500,

          reason: 'Approved payroll adjustment',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaTransaction).not.toHaveBeenCalled();
  });

  it('rejects mutation while the payroll cutoff is LOCKED', async () => {
    const { service, payrollAdjustmentCreate } = createFixture({
      cutoffRows: [
        {
          ...cutoff,

          status: PayrollCutoffStatus.LOCKED,
        },
      ],
    });

    await expect(
      service.createAdjustment(
        companyId,
        payrollCutoffId,
        employeeId,
        {
          type: PayrollAdjustmentType.EARNING,

          code: 'BONUS',
          description: 'Performance Bonus',

          amount: 1500,

          reason: 'Approved payroll adjustment',

          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(payrollAdjustmentCreate).not.toHaveBeenCalled();
  });

  it('rejects mutation when employee has no assignment covering the cutoff', async () => {
    const {
      service,

      payrollAdjustmentCreate,

      recordSuccessInTransaction,
    } = createFixture({
      employment: null,
    });

    await expect(
      service.createAdjustment(
        companyId,
        payrollCutoffId,
        employeeId,
        {
          type: PayrollAdjustmentType.EARNING,

          code: 'BONUS',
          description: 'Performance Bonus',

          amount: 1500,

          reason: 'Approved payroll adjustment',

          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(payrollAdjustmentCreate).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('clears Pag-IBIG treatment when an earning adjustment becomes a deduction', async () => {
    const {
      service,

      payrollAdjustmentUpdate,

      recordSuccessInTransaction,
    } = createFixture();

    payrollAdjustmentUpdate.mockResolvedValueOnce(
      createCreatedAdjustment({
        type: PayrollAdjustmentType.DEDUCTION,

        code: 'CORRECTION',

        pagIbigFundSalaryTreatment: null,
      }),
    );

    const result = await service.updateAdjustment(
      companyId,
      payrollCutoffId,
      employeeId,
      adjustmentId,
      {
        type: PayrollAdjustmentType.DEDUCTION,

        code: 'CORRECTION',
      },
      actorUserId,
    );

    expect(payrollAdjustmentUpdate).toHaveBeenCalledWith({
      where: {
        id: adjustmentId,
      },

      data: {
        type: PayrollAdjustmentType.DEDUCTION,

        code: 'CORRECTION',

        pagIbigFundSalaryTreatment: null,
      },

      select: {
        id: true,

        companyId: true,
        payrollCutoffId: true,
        employeeId: true,

        type: true,

        code: true,
        description: true,

        amount: true,

        reason: true,

        taxable: true,

        pagIbigFundSalaryTreatment: true,

        createdByUserId: true,
        createdAt: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'PAYROLL_ADJUSTMENT_UPDATED',

        entityType: 'PAYROLL_ADJUSTMENT',

        entityId: adjustmentId,
      }),
    );

    expect(result.type).toBe(PayrollAdjustmentType.DEDUCTION);

    expect(result.pagIbigFundSalaryTreatment).toBeNull();
  });

  it('deletes an adjustment and records the deleted values in the audit', async () => {
    const {
      service,

      transaction,

      payrollAdjustmentDelete,

      recordSuccessInTransaction,
    } = createFixture();

    const result = await service.deleteAdjustment(
      companyId,
      payrollCutoffId,
      employeeId,
      adjustmentId,
      actorUserId,
    );

    expect(payrollAdjustmentDelete).toHaveBeenCalledWith({
      where: {
        id: adjustmentId,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        actorUserId,

        companyId,

        action: 'PAYROLL_ADJUSTMENT_DELETED',

        module: 'PAYROLL',

        entityType: 'PAYROLL_ADJUSTMENT',

        entityId: adjustmentId,

        reference: 'BONUS',

        metadata: {
          payrollCutoffId,
          employeeId,

          type: PayrollAdjustmentType.EARNING,

          code: 'BONUS',
          description: 'Performance Bonus',

          amount: '1500',

          reason: 'Approved payroll adjustment',

          taxable: true,

          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
        },
      }),
    );

    expect(result).toEqual({
      id: adjustmentId,

      deleted: true,
    });
  });

  it('lists adjustments for a cutoff and optional employee', async () => {
    const adjustment = createCreatedAdjustment();

    const payrollCutoffFindFirst = jest.fn().mockResolvedValue({
      id: payrollCutoffId,
    });

    const payrollAdjustmentFindMany = jest.fn().mockResolvedValue([adjustment]);

    const prisma = {
      payrollCutoff: {
        findFirst: payrollCutoffFindFirst,
      },

      payrollAdjustment: {
        findMany: payrollAdjustmentFindMany,
      },
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new PayrollAdjustmentService(prisma, auditLog);

    const result = await service.listAdjustments(
      companyId,
      payrollCutoffId,
      employeeId,
    );

    expect(payrollCutoffFindFirst).toHaveBeenCalledWith({
      where: {
        id: payrollCutoffId,
        companyId,
      },

      select: {
        id: true,
      },
    });

    expect(payrollAdjustmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId,
          payrollCutoffId,
          employeeId,
        },
      }),
    );

    expect(result).toEqual([
      {
        id: adjustmentId,

        companyId,
        payrollCutoffId,
        employeeId,

        type: PayrollAdjustmentType.EARNING,

        code: 'BONUS',
        description: 'Performance Bonus',

        amount: '1500',

        reason: 'Approved payroll adjustment',

        taxable: true,

        pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

        createdByUserId: actorUserId,
        createdAt,
      },
    ]);
  });

  it('allows adjustment mutation while the payroll cutoff is REOPENED', async () => {
    const {
      service,

      payrollAdjustmentCreate,

      recordSuccessInTransaction,
    } = createFixture({
      cutoffRows: [
        {
          ...cutoff,

          status: PayrollCutoffStatus.REOPENED,
        },
      ],
    });

    const result = await service.createAdjustment(
      companyId,
      payrollCutoffId,
      employeeId,
      {
        type: PayrollAdjustmentType.EARNING,

        code: 'BONUS',
        description: 'Performance Bonus',

        amount: 1500,

        reason: 'Approved payroll correction after reopen',

        taxable: true,

        pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
      },
      actorUserId,
    );

    expect(payrollAdjustmentCreate).toHaveBeenCalledTimes(1);

    expect(recordSuccessInTransaction).toHaveBeenCalledTimes(1);

    expect(result.id).toBe(adjustmentId);
  });
});
