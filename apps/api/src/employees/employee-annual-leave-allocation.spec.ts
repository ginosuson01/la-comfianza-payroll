import { EmployeeType, LeaveBalanceKind } from '@payroll/database';
import { calculateLeaveEntitlement } from '@payroll/payroll-engine';

import {
  planAnnualLeaveAccountAllocations,
  resolveAnnualLeaveBalanceKind,
} from './employee-annual-leave-allocation';

describe('Annual leave account allocation', () => {
  it('maps internal VL and SL to separate annual balances', () => {
    expect(
      resolveAnnualLeaveBalanceKind(EmployeeType.LACOM_INTERNAL, 'VL'),
    ).toBe(LeaveBalanceKind.VL);

    expect(
      resolveAnnualLeaveBalanceKind(EmployeeType.LACOM_INTERNAL, 'SL'),
    ).toBe(LeaveBalanceKind.SL);
  });

  it('maps client VL and SL to the same shared annual balance', () => {
    expect(
      resolveAnnualLeaveBalanceKind(EmployeeType.CLIENT_EMPLOYEE, 'VL'),
    ).toBe(LeaveBalanceKind.SHARED_VL_SL_POOL);

    expect(
      resolveAnnualLeaveBalanceKind(EmployeeType.CLIENT_EMPLOYEE, 'SL'),
    ).toBe(LeaveBalanceKind.SHARED_VL_SL_POOL);
  });

  it('does not track unrelated leave types in the VL/SL annual pool', () => {
    expect(
      resolveAnnualLeaveBalanceKind(EmployeeType.LACOM_INTERNAL, 'OTHER'),
    ).toBeNull();

    expect(
      resolveAnnualLeaveBalanceKind(EmployeeType.CLIENT_EMPLOYEE, 'OTHER'),
    ).toBeNull();
  });

  it('creates separate VL and SL allocations for eligible internal employees', () => {
    const entitlement = calculateLeaveEntitlement({
      employmentGroup: 'INTERNAL',
      hireDate: '2026-01-01',
      asOfDate: '2026-07-01',
    });

    expect(planAnnualLeaveAccountAllocations(entitlement)).toEqual([
      {
        balanceKind: LeaveBalanceKind.VL,
        initialDays: 5,
      },
      {
        balanceKind: LeaveBalanceKind.SL,
        initialDays: 5,
      },
    ]);
  });

  it('creates one shared allocation for eligible client employees', () => {
    const entitlement = calculateLeaveEntitlement({
      employmentGroup: 'CLIENT',
      hireDate: '2025-01-01',
      asOfDate: '2026-01-01',
    });

    expect(planAnnualLeaveAccountAllocations(entitlement)).toEqual([
      {
        balanceKind: LeaveBalanceKind.SHARED_VL_SL_POOL,
        initialDays: 5,
      },
    ]);
  });

  it('does not plan allocations before eligibility', () => {
    const entitlement = calculateLeaveEntitlement({
      employmentGroup: 'INTERNAL',
      hireDate: '2026-01-01',
      asOfDate: '2026-06-30',
    });

    expect(planAnnualLeaveAccountAllocations(entitlement)).toEqual([]);
  });

  it('rejects inconsistent annual entitlement totals', () => {
    const entitlement = calculateLeaveEntitlement({
      employmentGroup: 'CLIENT',
      hireDate: '2025-01-01',
      asOfDate: '2026-01-01',
    });

    expect(() =>
      planAnnualLeaveAccountAllocations({
        ...entitlement,
        annualPaidLeaveDays: 10,
      }),
    ).toThrow('Annual leave allocation total does not match entitlement.');
  });
});
