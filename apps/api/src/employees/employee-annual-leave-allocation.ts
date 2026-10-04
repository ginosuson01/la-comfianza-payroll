import { EmployeeType, LeaveBalanceKind } from '@payroll/database';
import type { LeaveEntitlementResult } from '@payroll/payroll-engine';

export interface AnnualLeaveAccountAllocation {
  balanceKind: LeaveBalanceKind;
  initialDays: number;
}

export function resolveAnnualLeaveBalanceKind(
  employeeType: EmployeeType,
  leaveCode: string,
): LeaveBalanceKind | null {
  if (leaveCode !== 'VL' && leaveCode !== 'SL') {
    return null;
  }

  if (employeeType === EmployeeType.LACOM_INTERNAL) {
    return leaveCode === 'VL' ? LeaveBalanceKind.VL : LeaveBalanceKind.SL;
  }

  if (employeeType === EmployeeType.CLIENT_EMPLOYEE) {
    return LeaveBalanceKind.SHARED_VL_SL_POOL;
  }

  throw new Error(`Unsupported employee type: ${String(employeeType)}`);
}

/**
 * Produces an allocation plan without creating accounts
 * or posting leave transactions.
 */
export function planAnnualLeaveAccountAllocations(
  entitlement: LeaveEntitlementResult,
): AnnualLeaveAccountAllocation[] {
  if (!entitlement.eligible) {
    return [];
  }

  const { employmentGroup, balanceAllocation } = entitlement;

  let allocations: AnnualLeaveAccountAllocation[];

  if (employmentGroup === 'INTERNAL') {
    if (
      balanceAllocation.mode !== 'SEPARATE_VL_SL' ||
      balanceAllocation.sharedVlSlPoolDays !== 0
    ) {
      throw new Error('Invalid internal employee leave allocation.');
    }

    allocations = [
      {
        balanceKind: LeaveBalanceKind.VL,
        initialDays: balanceAllocation.vacationLeaveDays,
      },
      {
        balanceKind: LeaveBalanceKind.SL,
        initialDays: balanceAllocation.sickLeaveDays,
      },
    ];
  } else if (employmentGroup === 'CLIENT') {
    if (
      balanceAllocation.mode !== 'SHARED_VL_SL_POOL' ||
      balanceAllocation.vacationLeaveDays !== 0 ||
      balanceAllocation.sickLeaveDays !== 0
    ) {
      throw new Error('Invalid client employee leave allocation.');
    }

    allocations = [
      {
        balanceKind: LeaveBalanceKind.SHARED_VL_SL_POOL,
        initialDays: balanceAllocation.sharedVlSlPoolDays,
      },
    ];
  } else {
    throw new Error('Unsupported employee leave classification.');
  }

  if (
    allocations.some(
      (allocation) =>
        !Number.isFinite(allocation.initialDays) || allocation.initialDays <= 0,
    )
  ) {
    throw new Error('Annual leave allocations must contain positive days.');
  }

  const allocatedDays = allocations.reduce(
    (total, allocation) => total + allocation.initialDays,
    0,
  );

  if (Math.abs(allocatedDays - entitlement.annualPaidLeaveDays) > 0.000001) {
    throw new Error(
      'Annual leave allocation total does not match entitlement.',
    );
  }

  return allocations;
}
