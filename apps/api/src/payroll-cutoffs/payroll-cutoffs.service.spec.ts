import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PayrollCutoffStatus } from '@payroll/database';

import {
  AuditLogService,
  type RecordSuccessfulAuditInput,
} from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import {
  PAYROLL_CUTOFF_AUDIT_MODULE,
  PAYROLL_CUTOFF_ENTITY_TYPE,
  PayrollCutoffAuditAction,
} from './payroll-cutoff-audit.constants';
import {
  PayrollCutoffsService,
  type PayrollCutoffView,
} from './payroll-cutoffs.service';

interface PayrollCutoffUpdateArgs {
  where: {
    id: string;
  };

  data: {
    status: PayrollCutoffStatus;
    lockedAt?: Date;
    reopenedAt?: Date;
    lastReopenReason?: string;
  };

  select: Record<string, unknown>;
}

const updatePayrollCutoffMock: jest.MockedFunction<
  (input: PayrollCutoffUpdateArgs) => Promise<PayrollCutoffView>
> = jest.fn();

const findUniquePayrollCutoffMock: jest.MockedFunction<
  (input: unknown) => Promise<PayrollCutoffView | null>
> = jest.fn();

const findManyPayrollCutoffMock: jest.MockedFunction<
  (input: unknown) => Promise<PayrollCutoffView[]>
> = jest.fn();

const transaction = {
  payrollCutoff: {
    update: updatePayrollCutoffMock,
  },
};

type TransactionMock = typeof transaction;

const prismaTransactionMock: jest.MockedFunction<
  (
    callback: (transactionClient: TransactionMock) => Promise<unknown>,
  ) => Promise<unknown>
> = jest.fn();

const recordSuccessInTransactionMock: jest.MockedFunction<
  (
    transactionClient: TransactionMock,
    input: RecordSuccessfulAuditInput,
  ) => Promise<void>
> = jest.fn();

const prismaMock = {
  payrollCutoff: {
    findUnique: findUniquePayrollCutoffMock,
    findMany: findManyPayrollCutoffMock,
  },

  $transaction: prismaTransactionMock,
};

const auditLogMock = {
  recordSuccessInTransaction: recordSuccessInTransactionMock,
};

function getAuditMetadata(
  input: RecordSuccessfulAuditInput,
): Record<string, unknown> {
  const metadata = input.metadata;

  if (
    metadata === undefined ||
    metadata === null ||
    Array.isArray(metadata) ||
    typeof metadata !== 'object'
  ) {
    throw new Error('Expected audit metadata to be an object.');
  }

  return metadata as Record<string, unknown>;
}

describe('PayrollCutoffsService lifecycle', () => {
  const payrollCutoffId = 'b2222222-2222-4222-8222-222222222222';

  const companyId = 'a1111111-1111-4111-8111-111111111111';

  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const startDate = new Date('2026-09-01T00:00:00.000Z');

  const endDate = new Date('2026-09-15T00:00:00.000Z');

  const payDate = new Date('2026-09-25T00:00:00.000Z');

  function buildCutoff(status: PayrollCutoffStatus): PayrollCutoffView {
    return {
      id: payrollCutoffId,
      companyId,

      cutoffTemplateId: 'c9999999-9999-4999-8999-999999999999',

      startDate,
      endDate,
      payDate,

      status,

      lockedAt:
        status === PayrollCutoffStatus.OPEN
          ? null
          : new Date('2026-09-16T04:02:50.863Z'),

      reopenedAt:
        status === PayrollCutoffStatus.REOPENED
          ? new Date('2026-09-16T04:04:06.825Z')
          : null,

      lastReopenReason:
        status === PayrollCutoffStatus.REOPENED
          ? 'Previous reopen reason'
          : null,

      createdAt: new Date('2026-09-15T21:06:19.466Z'),

      updatedAt: new Date('2026-09-16T04:04:06.825Z'),
    };
  }

  let service: PayrollCutoffsService;

  beforeEach(() => {
    jest.resetAllMocks();

    prismaTransactionMock.mockImplementation(async (callback) =>
      callback(transaction),
    );

    recordSuccessInTransactionMock.mockResolvedValue(undefined);

    service = new PayrollCutoffsService(
      prismaMock as unknown as PrismaService,
      auditLogMock as unknown as AuditLogService,
    );
  });

  it.each([PayrollCutoffStatus.OPEN, PayrollCutoffStatus.REOPENED])(
    'locks a payroll cutoff from %s',
    async (currentStatus) => {
      const currentCutoff = buildCutoff(currentStatus);

      const updatedCutoff: PayrollCutoffView = {
        ...currentCutoff,

        status: PayrollCutoffStatus.LOCKED,

        lockedAt: new Date('2026-09-16T06:00:00.000Z'),
      };

      findUniquePayrollCutoffMock.mockResolvedValue(currentCutoff);

      updatePayrollCutoffMock.mockResolvedValue(updatedCutoff);

      const result = await service.lockPayrollCutoff(
        payrollCutoffId,
        actorUserId,
      );

      expect(updatePayrollCutoffMock).toHaveBeenCalledTimes(1);

      const updateCall = updatePayrollCutoffMock.mock.calls[0];

      if (!updateCall) {
        throw new Error('Expected payroll cutoff update call.');
      }

      const updateInput = updateCall[0];

      expect(updateInput.where).toEqual({
        id: payrollCutoffId,
      });

      expect(updateInput.data.status).toBe(PayrollCutoffStatus.LOCKED);

      expect(updateInput.data.lockedAt).toBeInstanceOf(Date);

      expect(recordSuccessInTransactionMock).toHaveBeenCalledTimes(1);

      const auditCall = recordSuccessInTransactionMock.mock.calls[0];

      if (!auditCall) {
        throw new Error('Expected payroll cutoff audit call.');
      }

      const [auditTransaction, auditInput] = auditCall;

      expect(auditTransaction).toBe(transaction);

      expect(auditInput.actorUserId).toBe(actorUserId);

      expect(auditInput.companyId).toBe(companyId);

      expect(auditInput.action).toBe(PayrollCutoffAuditAction.LOCKED);

      expect(auditInput.module).toBe(PAYROLL_CUTOFF_AUDIT_MODULE);

      expect(auditInput.entityType).toBe(PAYROLL_CUTOFF_ENTITY_TYPE);

      expect(auditInput.entityId).toBe(payrollCutoffId);

      expect(auditInput.reference).toBe('2026-09-01 to 2026-09-15');

      const metadata = getAuditMetadata(auditInput);

      expect(metadata.previousStatus).toBe(currentStatus);

      expect(metadata.newStatus).toBe(PayrollCutoffStatus.LOCKED);

      expect(typeof metadata.lockedAt).toBe('string');

      expect(result).toEqual(updatedCutoff);
    },
  );

  it('rejects locking an already locked payroll cutoff', async () => {
    findUniquePayrollCutoffMock.mockResolvedValue(
      buildCutoff(PayrollCutoffStatus.LOCKED),
    );

    await expect(
      service.lockPayrollCutoff(payrollCutoffId, actorUserId),
    ).rejects.toThrow(ConflictException);

    expect(prismaTransactionMock).not.toHaveBeenCalled();

    expect(recordSuccessInTransactionMock).not.toHaveBeenCalled();
  });

  it('reopens a locked payroll cutoff with a required reason', async () => {
    const currentCutoff = buildCutoff(PayrollCutoffStatus.LOCKED);

    const updatedCutoff: PayrollCutoffView = {
      ...currentCutoff,

      status: PayrollCutoffStatus.REOPENED,

      reopenedAt: new Date('2026-09-16T06:05:00.000Z'),

      lastReopenReason: 'Correction required before payroll generation.',
    };

    findUniquePayrollCutoffMock.mockResolvedValue(currentCutoff);

    updatePayrollCutoffMock.mockResolvedValue(updatedCutoff);

    const result = await service.reopenPayrollCutoff(
      payrollCutoffId,

      '  Correction required before payroll generation.  ',

      actorUserId,
    );

    expect(updatePayrollCutoffMock).toHaveBeenCalledTimes(1);

    const updateCall = updatePayrollCutoffMock.mock.calls[0];

    if (!updateCall) {
      throw new Error('Expected payroll cutoff update call.');
    }

    const updateInput = updateCall[0];

    expect(updateInput.where).toEqual({
      id: payrollCutoffId,
    });

    expect(updateInput.data.status).toBe(PayrollCutoffStatus.REOPENED);

    expect(updateInput.data.reopenedAt).toBeInstanceOf(Date);

    expect(updateInput.data.lastReopenReason).toBe(
      'Correction required before payroll generation.',
    );

    expect(updateInput.data).not.toHaveProperty('lockedAt');

    expect(recordSuccessInTransactionMock).toHaveBeenCalledTimes(1);

    const auditCall = recordSuccessInTransactionMock.mock.calls[0];

    if (!auditCall) {
      throw new Error('Expected payroll cutoff audit call.');
    }

    const [auditTransaction, auditInput] = auditCall;

    expect(auditTransaction).toBe(transaction);

    expect(auditInput.actorUserId).toBe(actorUserId);

    expect(auditInput.companyId).toBe(companyId);

    expect(auditInput.action).toBe(PayrollCutoffAuditAction.REOPENED);

    expect(auditInput.module).toBe(PAYROLL_CUTOFF_AUDIT_MODULE);

    expect(auditInput.entityType).toBe(PAYROLL_CUTOFF_ENTITY_TYPE);

    expect(auditInput.entityId).toBe(payrollCutoffId);

    expect(auditInput.reference).toBe('2026-09-01 to 2026-09-15');

    const metadata = getAuditMetadata(auditInput);

    expect(metadata.previousStatus).toBe(PayrollCutoffStatus.LOCKED);

    expect(metadata.newStatus).toBe(PayrollCutoffStatus.REOPENED);

    expect(typeof metadata.reopenedAt).toBe('string');

    expect(metadata.reason).toBe(
      'Correction required before payroll generation.',
    );

    expect(result).toEqual(updatedCutoff);
  });

  it.each([PayrollCutoffStatus.OPEN, PayrollCutoffStatus.REOPENED])(
    'rejects reopening a payroll cutoff from %s',
    async (currentStatus) => {
      findUniquePayrollCutoffMock.mockResolvedValue(buildCutoff(currentStatus));

      await expect(
        service.reopenPayrollCutoff(
          payrollCutoffId,
          'Test reopen reason',
          actorUserId,
        ),
      ).rejects.toThrow(ConflictException);

      expect(prismaTransactionMock).not.toHaveBeenCalled();

      expect(recordSuccessInTransactionMock).not.toHaveBeenCalled();
    },
  );

  it('rejects a blank reopen reason before changing the cutoff', async () => {
    await expect(
      service.reopenPayrollCutoff(payrollCutoffId, '   ', actorUserId),
    ).rejects.toThrow(BadRequestException);

    expect(findUniquePayrollCutoffMock).not.toHaveBeenCalled();

    expect(prismaTransactionMock).not.toHaveBeenCalled();

    expect(recordSuccessInTransactionMock).not.toHaveBeenCalled();
  });

  it('returns not found when the payroll cutoff does not exist', async () => {
    findUniquePayrollCutoffMock.mockResolvedValue(null);

    await expect(
      service.lockPayrollCutoff(payrollCutoffId, actorUserId),
    ).rejects.toThrow(NotFoundException);

    expect(prismaTransactionMock).not.toHaveBeenCalled();

    expect(recordSuccessInTransactionMock).not.toHaveBeenCalled();
  });
});
