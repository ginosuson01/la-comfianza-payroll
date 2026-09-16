import { PayrollCutoffStatus } from '@payroll/database';

import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';
import { PayrollCutoffsController } from './payroll-cutoffs.controller';
import {
  PayrollCutoffsService,
  type PayrollCutoffView,
} from './payroll-cutoffs.service';

describe('PayrollCutoffsController', () => {
  const payrollCutoffId = 'b2222222-2222-4222-8222-222222222222';

  const companyId = 'a1111111-1111-4111-8111-111111111111';

  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const identity = {
    user: {
      id: actorUserId,
    },
  } as unknown as ResolvedAuthenticatedIdentity;

  const cutoff: PayrollCutoffView = {
    id: payrollCutoffId,
    companyId,

    cutoffTemplateId: 'c9999999-9999-4999-8999-999999999999',

    startDate: new Date('2026-09-01T00:00:00.000Z'),

    endDate: new Date('2026-09-15T00:00:00.000Z'),

    payDate: new Date('2026-09-25T00:00:00.000Z'),

    status: PayrollCutoffStatus.REOPENED,

    lockedAt: new Date('2026-09-16T04:02:50.863Z'),

    reopenedAt: new Date('2026-09-16T04:04:06.825Z'),

    lastReopenReason: 'Test reopen reason',

    createdAt: new Date('2026-09-15T21:06:19.466Z'),

    updatedAt: new Date('2026-09-16T04:04:06.825Z'),
  };

  const listPayrollCutoffsMock: jest.MockedFunction<
    PayrollCutoffsService['listPayrollCutoffs']
  > = jest.fn();

  const lockPayrollCutoffMock: jest.MockedFunction<
    PayrollCutoffsService['lockPayrollCutoff']
  > = jest.fn();

  const reopenPayrollCutoffMock: jest.MockedFunction<
    PayrollCutoffsService['reopenPayrollCutoff']
  > = jest.fn();

  const serviceMock = {
    listPayrollCutoffs: listPayrollCutoffsMock,

    lockPayrollCutoff: lockPayrollCutoffMock,

    reopenPayrollCutoff: reopenPayrollCutoffMock,
  } as unknown as PayrollCutoffsService;

  let controller: PayrollCutoffsController;

  beforeEach(() => {
    jest.resetAllMocks();

    controller = new PayrollCutoffsController(serviceMock);
  });

  it('delegates payroll cutoff locking with the authenticated user', async () => {
    lockPayrollCutoffMock.mockResolvedValue(cutoff);

    const result = await controller.lockPayrollCutoff(
      payrollCutoffId,
      identity,
    );

    expect(lockPayrollCutoffMock).toHaveBeenCalledWith(
      payrollCutoffId,
      actorUserId,
    );

    expect(result).toEqual(cutoff);
  });

  it('delegates payroll cutoff reopening with the reason and authenticated user', async () => {
    reopenPayrollCutoffMock.mockResolvedValue(cutoff);

    const result = await controller.reopenPayrollCutoff(
      payrollCutoffId,
      {
        reason: 'Correction required before payroll generation.',
      },
      identity,
    );

    expect(reopenPayrollCutoffMock).toHaveBeenCalledWith(
      payrollCutoffId,
      'Correction required before payroll generation.',
      actorUserId,
    );

    expect(result).toEqual(cutoff);
  });
});
