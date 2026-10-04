import { BadRequestException } from '@nestjs/common';
import {
  EmployeeType,
  LeaveBalanceKind,
  LeaveTransactionType,
  LeaveUnit,
  Prisma,
} from '@payroll/database';

import { DtrLeaveBalanceService } from './dtr-leave-balance.service';
import { DTR_LEAVE_TRANSACTION_REFERENCE_TYPE } from './dtr-leave.constants';
import { DtrPayrollConfigService } from './dtr-payroll-config.service';

describe('DtrLeaveBalanceService', () => {
  const employeeId = '11111111-1111-4111-8111-111111111111';
  const companyId = '22222222-2222-4222-8222-222222222222';
  const leaveTypeId = '33333333-3333-4333-8333-333333333333';
  const leaveAccountId = '44444444-4444-4444-8444-444444444444';
  const entitlementCycleId = '88888888-8888-4888-8888-888888888888';
  const entryId = '55555555-5555-4555-8555-555555555555';
  const actorUserId = '66666666-6666-4666-8666-666666666666';

  const workDate = new Date('2026-09-05T00:00:00.000Z');

  const payrollConfigServiceMock = {
    convertLeaveMinutesToDays: jest.fn(),
  };

  const transactionMock = {
    leaveType: {
      findUnique: jest.fn(),
    },

    employeeLeaveEntitlementCycle: {
      findUnique: jest.fn(),
    },

    employeeLeaveAccount: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },

    leaveTransaction: {
      aggregate: jest.fn(),
      create: jest.fn(),
    },
  };

  const usageInput = {
    employeeId,
    companyId,
    leaveTypeId,
    leaveMinutes: 480,
    workDate,
    entryId,
    actorUserId,
  };

  let service: DtrLeaveBalanceService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new DtrLeaveBalanceService(
      payrollConfigServiceMock as unknown as DtrPayrollConfigService,
    );

    transactionMock.leaveType.findUnique.mockResolvedValue({
      id: leaveTypeId,
      companyId,
      code: 'VL',
      unit: LeaveUnit.DAY,
      active: true,
    });

    transactionMock.employeeLeaveEntitlementCycle.findUnique.mockResolvedValue({
      id: entitlementCycleId,
      employeeType: EmployeeType.LACOM_INTERNAL,
      initializationReviewRequired: false,
    });

    transactionMock.employeeLeaveAccount.findUnique.mockResolvedValue({
      id: leaveAccountId,
    });

    payrollConfigServiceMock.convertLeaveMinutesToDays.mockResolvedValue(
      new Prisma.Decimal('1.0000'),
    );

    transactionMock.employeeLeaveAccount.updateMany.mockResolvedValue({
      count: 1,
    });

    transactionMock.employeeLeaveAccount.update.mockResolvedValue({
      id: leaveAccountId,
    });

    transactionMock.leaveTransaction.aggregate.mockResolvedValue({
      _sum: {
        quantity: null,
      },
    });

    transactionMock.leaveTransaction.create.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
    });
  });

  it('does nothing when no leave type is selected', async () => {
    await service.applyUsageInTransaction(
      transactionMock as unknown as Prisma.TransactionClient,
      {
        ...usageInput,
        leaveTypeId: null,
      },
    );

    expect(transactionMock.leaveType.findUnique).not.toHaveBeenCalled();
    expect(
      payrollConfigServiceMock.convertLeaveMinutesToDays,
    ).not.toHaveBeenCalled();
  });

  it('does nothing when leave minutes are zero', async () => {
    await service.applyUsageInTransaction(
      transactionMock as unknown as Prisma.TransactionClient,
      {
        ...usageInput,
        leaveMinutes: 0,
      },
    );

    expect(transactionMock.leaveType.findUnique).not.toHaveBeenCalled();
  });

  it('does not create leave usage for non-VL and non-SL leave types', async () => {
    transactionMock.leaveType.findUnique.mockResolvedValue({
      id: leaveTypeId,
      companyId,
      code: 'OTHER',
      unit: LeaveUnit.DAY,
      active: true,
    });

    await service.applyUsageInTransaction(
      transactionMock as unknown as Prisma.TransactionClient,
      usageInput,
    );

    expect(
      transactionMock.employeeLeaveAccount.findUnique,
    ).not.toHaveBeenCalled();

    expect(
      transactionMock.employeeLeaveAccount.updateMany,
    ).not.toHaveBeenCalled();

    expect(transactionMock.leaveTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects usage when the VL or SL leave type is inactive', async () => {
    transactionMock.leaveType.findUnique.mockResolvedValue({
      id: leaveTypeId,
      companyId,
      code: 'VL',
      unit: LeaveUnit.DAY,
      active: false,
    });

    await expect(
      service.applyUsageInTransaction(
        transactionMock as unknown as Prisma.TransactionClient,
        usageInput,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      transactionMock.employeeLeaveAccount.updateMany,
    ).not.toHaveBeenCalled();
  });

  it('rejects usage when the employee has no VL or SL leave account', async () => {
    transactionMock.employeeLeaveAccount.findUnique.mockResolvedValue(null);

    await expect(
      service.applyUsageInTransaction(
        transactionMock as unknown as Prisma.TransactionClient,
        usageInput,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      transactionMock.employeeLeaveAccount.updateMany,
    ).not.toHaveBeenCalled();
  });

  it('resolves an internal VL account from the work-date annual cycle', async () => {
    await service.applyUsageInTransaction(
      transactionMock as unknown as Prisma.TransactionClient,
      usageInput,
    );

    expect(
      transactionMock.employeeLeaveEntitlementCycle.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        employeeId_calendarYear: {
          employeeId,
          calendarYear: 2026,
        },
      },

      select: {
        id: true,
        employeeType: true,
        initializationReviewRequired: true,
      },
    });

    expect(
      transactionMock.employeeLeaveAccount.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        entitlementCycleId_balanceKind: {
          entitlementCycleId,
          balanceKind: LeaveBalanceKind.VL,
        },
      },

      select: {
        id: true,
      },
    });
  });

  it('does not fall back to a prior-year leave cycle for new-year usage', async () => {
    const newYearWorkDate = new Date('2027-01-05T00:00:00.000Z');

    transactionMock.employeeLeaveEntitlementCycle.findUnique.mockResolvedValue(
      null,
    );

    await expect(
      service.applyUsageInTransaction(
        transactionMock as unknown as Prisma.TransactionClient,
        {
          ...usageInput,
          workDate: newYearWorkDate,
        },
      ),
    ).rejects.toThrow(
      'Employee does not have an initialized 2027 leave entitlement.',
    );

    expect(
      transactionMock.employeeLeaveEntitlementCycle.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        employeeId_calendarYear: {
          employeeId,
          calendarYear: 2027,
        },
      },

      select: {
        id: true,
        employeeType: true,
        initializationReviewRequired: true,
      },
    });

    expect(
      transactionMock.employeeLeaveAccount.findUnique,
    ).not.toHaveBeenCalled();

    expect(
      transactionMock.employeeLeaveAccount.updateMany,
    ).not.toHaveBeenCalled();

    expect(transactionMock.leaveTransaction.create).not.toHaveBeenCalled();
  });

  it('maps client VL and SL usage to the shared annual balance', async () => {
    transactionMock.leaveType.findUnique.mockResolvedValue({
      id: leaveTypeId,
      companyId,
      code: 'SL',
      unit: LeaveUnit.DAY,
      active: true,
    });

    transactionMock.employeeLeaveEntitlementCycle.findUnique.mockResolvedValue({
      id: entitlementCycleId,
      employeeType: EmployeeType.CLIENT_EMPLOYEE,
      initializationReviewRequired: false,
    });

    await service.applyUsageInTransaction(
      transactionMock as unknown as Prisma.TransactionClient,
      usageInput,
    );

    expect(
      transactionMock.employeeLeaveAccount.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        entitlementCycleId_balanceKind: {
          entitlementCycleId,
          balanceKind: LeaveBalanceKind.SHARED_VL_SL_POOL,
        },
      },

      select: {
        id: true,
      },
    });
  });

  it('blocks new leave usage while the annual balance requires review', async () => {
    transactionMock.employeeLeaveEntitlementCycle.findUnique.mockResolvedValue({
      id: entitlementCycleId,
      employeeType: EmployeeType.LACOM_INTERNAL,
      initializationReviewRequired: true,
    });

    await expect(
      service.applyUsageInTransaction(
        transactionMock as unknown as Prisma.TransactionClient,
        usageInput,
      ),
    ).rejects.toThrow(
      '2026 leave balances require Payroll Manager review before use.',
    );

    expect(
      transactionMock.employeeLeaveAccount.findUnique,
    ).not.toHaveBeenCalled();

    expect(
      transactionMock.employeeLeaveAccount.updateMany,
    ).not.toHaveBeenCalled();
  });

  it('deducts balance and records a negative USAGE transaction', async () => {
    await service.applyUsageInTransaction(
      transactionMock as unknown as Prisma.TransactionClient,
      usageInput,
    );

    expect(
      payrollConfigServiceMock.convertLeaveMinutesToDays,
    ).toHaveBeenCalledWith(companyId, workDate, 480);

    expect(
      transactionMock.employeeLeaveAccount.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: leaveAccountId,
        currentBalance: {
          gte: new Prisma.Decimal('1.0000'),
        },
      },

      data: {
        currentBalance: {
          decrement: new Prisma.Decimal('1.0000'),
        },
      },
    });

    expect(transactionMock.leaveTransaction.create).toHaveBeenCalledWith({
      data: {
        leaveAccountId,
        type: LeaveTransactionType.USAGE,
        quantity: new Prisma.Decimal('-1.0000'),
        effectiveDate: workDate,
        referenceType: DTR_LEAVE_TRANSACTION_REFERENCE_TYPE,
        referenceId: entryId,
        notes: 'DTR VL usage for 2026-09-05.',
        createdByUserId: actorUserId,
      },
    });
  });

  it('rejects usage when the balance is no longer sufficient', async () => {
    transactionMock.employeeLeaveAccount.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.applyUsageInTransaction(
        transactionMock as unknown as Prisma.TransactionClient,
        usageInput,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transactionMock.leaveTransaction.create).not.toHaveBeenCalled();
  });

  it('does nothing when an entry has no posted usage to reverse', async () => {
    transactionMock.leaveTransaction.aggregate.mockResolvedValue({
      _sum: {
        quantity: null,
      },
    });

    await service.reverseUsageInTransaction(
      transactionMock as unknown as Prisma.TransactionClient,
      usageInput,
    );

    expect(transactionMock.employeeLeaveAccount.update).not.toHaveBeenCalled();

    expect(transactionMock.leaveTransaction.create).not.toHaveBeenCalled();
  });

  it('restores balance and records a positive REVERSAL transaction', async () => {
    transactionMock.leaveTransaction.aggregate.mockResolvedValue({
      _sum: {
        quantity: new Prisma.Decimal('-1.0000'),
      },
    });

    await service.reverseUsageInTransaction(
      transactionMock as unknown as Prisma.TransactionClient,
      usageInput,
    );

    expect(transactionMock.leaveTransaction.aggregate).toHaveBeenCalledWith({
      where: {
        leaveAccountId,
        referenceType: DTR_LEAVE_TRANSACTION_REFERENCE_TYPE,
        referenceId: entryId,

        type: {
          in: [LeaveTransactionType.USAGE, LeaveTransactionType.REVERSAL],
        },
      },

      _sum: {
        quantity: true,
      },
    });

    expect(transactionMock.employeeLeaveAccount.update).toHaveBeenCalledWith({
      where: {
        id: leaveAccountId,
      },

      data: {
        currentBalance: {
          increment: new Prisma.Decimal('1.0000'),
        },
      },
    });

    expect(transactionMock.leaveTransaction.create).toHaveBeenCalledWith({
      data: {
        leaveAccountId,
        type: LeaveTransactionType.REVERSAL,
        quantity: new Prisma.Decimal('1.0000'),
        effectiveDate: workDate,
        referenceType: DTR_LEAVE_TRANSACTION_REFERENCE_TYPE,
        referenceId: entryId,
        notes: 'Reversed DTR VL usage for 2026-09-05.',
        createdByUserId: actorUserId,
      },
    });
  });

  it('only reverses the remaining net posted usage', async () => {
    transactionMock.leaveTransaction.aggregate.mockResolvedValue({
      _sum: {
        quantity: new Prisma.Decimal('-0.5000'),
      },
    });

    await service.reverseUsageInTransaction(
      transactionMock as unknown as Prisma.TransactionClient,
      usageInput,
    );

    expect(transactionMock.employeeLeaveAccount.update).toHaveBeenCalledWith({
      where: {
        id: leaveAccountId,
      },

      data: {
        currentBalance: {
          increment: new Prisma.Decimal('0.5000'),
        },
      },
    });

    expect(transactionMock.leaveTransaction.create).toHaveBeenCalledWith({
      data: {
        leaveAccountId,
        type: LeaveTransactionType.REVERSAL,
        quantity: new Prisma.Decimal('0.5000'),
        effectiveDate: workDate,
        referenceType: DTR_LEAVE_TRANSACTION_REFERENCE_TYPE,
        referenceId: entryId,
        notes: 'Reversed DTR VL usage for 2026-09-05.',
        createdByUserId: actorUserId,
      },
    });
  });

  it('does not reverse an already fully reversed entry', async () => {
    transactionMock.leaveTransaction.aggregate.mockResolvedValue({
      _sum: {
        quantity: new Prisma.Decimal('0.0000'),
      },
    });

    await service.reverseUsageInTransaction(
      transactionMock as unknown as Prisma.TransactionClient,
      usageInput,
    );

    expect(transactionMock.employeeLeaveAccount.update).not.toHaveBeenCalled();

    expect(transactionMock.leaveTransaction.create).not.toHaveBeenCalled();
  });

  it('can reverse historical usage when the leave type is now inactive', async () => {
    transactionMock.leaveType.findUnique.mockResolvedValue({
      id: leaveTypeId,
      companyId,
      code: 'VL',
      unit: LeaveUnit.DAY,
      active: false,
    });

    transactionMock.leaveTransaction.aggregate.mockResolvedValue({
      _sum: {
        quantity: new Prisma.Decimal('-1.0000'),
      },
    });

    await expect(
      service.reverseUsageInTransaction(
        transactionMock as unknown as Prisma.TransactionClient,
        usageInput,
      ),
    ).resolves.toBeUndefined();

    expect(transactionMock.employeeLeaveAccount.update).toHaveBeenCalledWith({
      where: {
        id: leaveAccountId,
      },

      data: {
        currentBalance: {
          increment: new Prisma.Decimal('1.0000'),
        },
      },
    });
  });
});
