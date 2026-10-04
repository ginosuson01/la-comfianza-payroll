import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeType } from '@payroll/database';
import {
  calculateLeaveEntitlement,
  type LeaveEntitlementResult,
  type PayrollEmploymentGroup,
} from '@payroll/payroll-engine';

import { PrismaService } from '../database/prisma.service';

export type EmployeeLeaveEligibilityStatus =
  'CLASSIFICATION_REQUIRED' | 'NOT_YET_ELIGIBLE' | 'ELIGIBLE';

export interface EmployeeLeaveEntitlementView {
  employeeId: string;
  employeeNumber: string;

  employmentRecordId: string;
  employeeType: EmployeeType | null;

  employmentStartDate: string;
  asOfDate: string;

  eligibilityStatus: EmployeeLeaveEligibilityStatus;

  eligibilityDate: string | null;
  eligible: boolean | null;

  annualPaidLeaveDays: number | null;

  balanceAllocation: LeaveEntitlementResult['balanceAllocation'] | null;

  calendarAllocationPolicy:
    LeaveEntitlementResult['calendarAllocationPolicy'] | null;
}

function resolveEmploymentGroup(
  employeeType: EmployeeType,
): PayrollEmploymentGroup {
  if (employeeType === EmployeeType.LACOM_INTERNAL) {
    return 'INTERNAL';
  }

  if (employeeType === EmployeeType.CLIENT_EMPLOYEE) {
    return 'CLIENT';
  }

  throw new Error(`Unsupported employee type: ${String(employeeType)}`);
}

@Injectable()
export class EmployeeLeaveEntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaveEntitlement(
    employeeId: string,
    asOfDate: string,
  ): Promise<EmployeeLeaveEntitlementView> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,
        employeeNumber: true,

        employmentRecords: {
          where: {
            endDate: null,
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,
            employeeType: true,
            startDate: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentEmployment = employee.employmentRecords[0];

    if (!currentEmployment) {
      throw new NotFoundException('Current employment assignment not found.');
    }

    const employmentStartDate = currentEmployment.startDate
      .toISOString()
      .slice(0, 10);

    if (!currentEmployment.employeeType) {
      return {
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber,

        employmentRecordId: currentEmployment.id,
        employeeType: null,

        employmentStartDate,
        asOfDate,

        eligibilityStatus: 'CLASSIFICATION_REQUIRED',

        eligibilityDate: null,
        eligible: null,

        annualPaidLeaveDays: null,

        balanceAllocation: null,

        calendarAllocationPolicy: null,
      };
    }

    const entitlement = calculateLeaveEntitlement({
      employmentGroup: resolveEmploymentGroup(currentEmployment.employeeType),

      hireDate: employmentStartDate,
      asOfDate,
    });

    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,

      employmentRecordId: currentEmployment.id,
      employeeType: currentEmployment.employeeType,

      employmentStartDate,
      asOfDate,

      eligibilityStatus: entitlement.eligible ? 'ELIGIBLE' : 'NOT_YET_ELIGIBLE',

      eligibilityDate: entitlement.eligibilityDate,

      eligible: entitlement.eligible,

      annualPaidLeaveDays: entitlement.annualPaidLeaveDays,

      balanceAllocation: entitlement.balanceAllocation,

      calendarAllocationPolicy: entitlement.calendarAllocationPolicy,
    };
  }
}
