import { Injectable, NotFoundException } from '@nestjs/common';
import {
  EmployeePayrollStatus,
  type PayBasis,
  type PayoutMethod,
  type PayrollCompensationSource,
  type PayrollCutoffStatus,
  type PayrollRunStatus,
  type Prisma,
} from '@payroll/database';

import { PrismaService } from '../database/prisma.service';
import type { ListPayrollRunsQueryDto } from './dto/list-payroll-runs-query.dto';

const PAYROLL_RUN_HISTORY_SELECT = {
  id: true,

  companyId: true,

  payrollCutoffId: true,

  companyPayrollSetupVersionId: true,

  version: true,

  status: true,

  generatedAt: true,

  totalGross: true,

  totalNet: true,

  clientPayableGross: true,

  cashPayoutTotal: true,

  atmPayoutTotal: true,

  activeHoldTotal: true,

  generatedBy: {
    select: {
      id: true,

      username: true,

      firstName: true,

      lastName: true,
    },
  },

  payrollCutoff: {
    select: {
      startDate: true,

      endDate: true,

      payDate: true,

      status: true,
    },
  },

  _count: {
    select: {
      employeeResults: true,
    },
  },
} satisfies Prisma.PayrollRunSelect;

const PAYROLL_RUN_DETAIL_SELECT = {
  ...PAYROLL_RUN_HISTORY_SELECT,

  configSnapshot: true,

  employeeResults: {
    orderBy: [
      {
        employeeNumberSnapshot: 'asc',
      },
    ],

    select: {
      id: true,

      employeeId: true,

      employmentRecordId: true,

      employeeNumberSnapshot: true,

      employeeNameSnapshot: true,

      positionSnapshot: true,

      departmentSnapshot: true,

      payrollStatusSnapshot: true,

      payoutMethodSnapshot: true,

      payoutAccountLast4Snapshot: true,

      payBasisSnapshot: true,

      baseRateSnapshot: true,

      compensationSourceSnapshot: true,

      basicPay: true,

      allowancesTotal: true,

      premiumPayTotal: true,

      grossPay: true,

      governmentContributionsTotal: true,

      taxTotal: true,

      otherDeductionsTotal: true,

      totalDeductions: true,

      netPay: true,

      cashPayout: true,

      atmPayout: true,

      heldAmount: true,

      clientPayableGross: true,

      taxableCompensation: true,

      withholdingTax: true,

      thirteenthMonthPay: true,

      lastPayAmount: true,

      isLastPay: true,

      createdAt: true,
    },
  },
} satisfies Prisma.PayrollRunSelect;

type PayrollRunHistoryRecord = Prisma.PayrollRunGetPayload<{
  select: typeof PAYROLL_RUN_HISTORY_SELECT;
}>;

type PayrollRunDetailRecord = Prisma.PayrollRunGetPayload<{
  select: typeof PAYROLL_RUN_DETAIL_SELECT;
}>;

export interface PayrollRunHistoryItem {
  id: string;

  companyId: string;

  payrollCutoffId: string;

  companyPayrollSetupVersionId: string;

  version: number;

  status: PayrollRunStatus;

  generatedAt: Date;

  generatedBy: {
    id: string;

    username: string;

    firstName: string;

    lastName: string;
  };

  cutoff: {
    startDate: Date;

    endDate: Date;

    payDate: Date;

    status: PayrollCutoffStatus;
  };

  employeeCount: number;

  totalGross: string;

  totalNet: string;

  clientPayableGross: string | null;

  cashPayoutTotal: string;

  atmPayoutTotal: string;

  activeHoldTotal: string;
}

export interface PayrollRunHistoryResponse {
  items: PayrollRunHistoryItem[];

  pagination: {
    page: number;

    pageSize: number;

    total: number;

    totalPages: number;
  };
}

export interface PayrollRunEmployeeDetail {
  id: string;

  employeeId: string;

  employmentRecordId: string;

  employeeNumber: string;

  employeeName: string;

  position: string | null;

  department: string | null;

  payrollStatus: EmployeePayrollStatus;

  payoutMethod: PayoutMethod;

  payoutAccountLast4: string | null;

  payBasis: PayBasis;

  baseRate: string;

  compensationSource: PayrollCompensationSource | null;

  basicPay: string;

  allowancesTotal: string;

  premiumPayTotal: string;

  grossPay: string;

  governmentContributionsTotal: string;

  taxTotal: string;

  otherDeductionsTotal: string;

  totalDeductions: string;

  netPay: string;

  cashPayout: string;

  atmPayout: string;

  heldAmount: string;

  clientPayableGross: string | null;

  taxableCompensation: string;

  withholdingTax: string;

  thirteenthMonthPay: string;

  lastPayAmount: string;

  isLastPay: boolean;

  createdAt: Date;
}

export interface PayrollRunStatusBreakdown {
  totalEmployees: number;

  active: number;

  activeHold: number;

  resigned: number;
}

export interface PayrollRunDetail extends PayrollRunHistoryItem {
  configSnapshot: unknown;

  statusBreakdown: PayrollRunStatusBreakdown;

  employees: PayrollRunEmployeeDetail[];
}

@Injectable()
export class PayrollHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listPayrollRuns(
    companyId: string,
    query: ListPayrollRunsQueryDto,
  ): Promise<PayrollRunHistoryResponse> {
    const page = query.page;

    const pageSize = query.pageSize;

    const where: Prisma.PayrollRunWhereInput = {
      companyId,
    };

    if (query.payrollCutoffId) {
      where.payrollCutoffId = query.payrollCutoffId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [total, payrollRuns] = await this.prisma.$transaction([
      this.prisma.payrollRun.count({
        where,
      }),

      this.prisma.payrollRun.findMany({
        where,

        select: PAYROLL_RUN_HISTORY_SELECT,

        orderBy: [
          {
            generatedAt: 'desc',
          },
          {
            version: 'desc',
          },
        ],

        skip: (page - 1) * pageSize,

        take: pageSize,
      }),
    ]);

    return {
      items: payrollRuns.map((payrollRun) => this.toHistoryItem(payrollRun)),

      pagination: {
        page,

        pageSize,

        total,

        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getPayrollRunDetail(
    companyId: string,
    payrollRunId: string,
  ): Promise<PayrollRunDetail> {
    const payrollRun = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,

        companyId,
      },

      select: PAYROLL_RUN_DETAIL_SELECT,
    });

    if (!payrollRun) {
      throw new NotFoundException('Payroll run was not found.');
    }

    const historyItem = this.toHistoryItem(payrollRun);

    const statusBreakdown = this.buildStatusBreakdown(
      payrollRun.employeeResults,
    );

    return {
      ...historyItem,

      configSnapshot: payrollRun.configSnapshot,

      statusBreakdown,

      employees: payrollRun.employeeResults.map((employee) =>
        this.toEmployeeDetail(employee),
      ),
    };
  }

  private toHistoryItem(
    payrollRun: PayrollRunHistoryRecord,
  ): PayrollRunHistoryItem {
    return {
      id: payrollRun.id,

      companyId: payrollRun.companyId,

      payrollCutoffId: payrollRun.payrollCutoffId,

      companyPayrollSetupVersionId: payrollRun.companyPayrollSetupVersionId,

      version: payrollRun.version,

      status: payrollRun.status,

      generatedAt: payrollRun.generatedAt,

      generatedBy: {
        id: payrollRun.generatedBy.id,

        username: payrollRun.generatedBy.username,

        firstName: payrollRun.generatedBy.firstName,

        lastName: payrollRun.generatedBy.lastName,
      },

      cutoff: {
        startDate: payrollRun.payrollCutoff.startDate,

        endDate: payrollRun.payrollCutoff.endDate,

        payDate: payrollRun.payrollCutoff.payDate,

        status: payrollRun.payrollCutoff.status,
      },

      employeeCount: payrollRun._count.employeeResults,

      totalGross: payrollRun.totalGross.toFixed(2),

      totalNet: payrollRun.totalNet.toFixed(2),

      clientPayableGross:
        payrollRun.clientPayableGross === null
          ? null
          : payrollRun.clientPayableGross.toFixed(2),

      cashPayoutTotal: payrollRun.cashPayoutTotal.toFixed(2),

      atmPayoutTotal: payrollRun.atmPayoutTotal.toFixed(2),

      activeHoldTotal: payrollRun.activeHoldTotal.toFixed(2),
    };
  }

  private toEmployeeDetail(
    employee: PayrollRunDetailRecord['employeeResults'][number],
  ): PayrollRunEmployeeDetail {
    return {
      id: employee.id,

      employeeId: employee.employeeId,

      employmentRecordId: employee.employmentRecordId,

      employeeNumber: employee.employeeNumberSnapshot,

      employeeName: employee.employeeNameSnapshot,

      position: employee.positionSnapshot,

      department: employee.departmentSnapshot,

      payrollStatus: employee.payrollStatusSnapshot,

      payoutMethod: employee.payoutMethodSnapshot,

      payoutAccountLast4: employee.payoutAccountLast4Snapshot,

      payBasis: employee.payBasisSnapshot,

      baseRate: employee.baseRateSnapshot.toFixed(4),

      compensationSource: employee.compensationSourceSnapshot,

      basicPay: employee.basicPay.toFixed(2),

      allowancesTotal: employee.allowancesTotal.toFixed(2),

      premiumPayTotal: employee.premiumPayTotal.toFixed(2),

      grossPay: employee.grossPay.toFixed(2),

      governmentContributionsTotal:
        employee.governmentContributionsTotal.toFixed(2),

      taxTotal: employee.taxTotal.toFixed(2),

      otherDeductionsTotal: employee.otherDeductionsTotal.toFixed(2),

      totalDeductions: employee.totalDeductions.toFixed(2),

      netPay: employee.netPay.toFixed(2),

      cashPayout: employee.cashPayout.toFixed(2),

      atmPayout: employee.atmPayout.toFixed(2),

      heldAmount: employee.heldAmount.toFixed(2),

      clientPayableGross:
        employee.clientPayableGross === null
          ? null
          : employee.clientPayableGross.toFixed(2),

      taxableCompensation: employee.taxableCompensation.toFixed(2),

      withholdingTax: employee.withholdingTax.toFixed(2),

      thirteenthMonthPay: employee.thirteenthMonthPay.toFixed(2),

      lastPayAmount: employee.lastPayAmount.toFixed(2),

      isLastPay: employee.isLastPay,

      createdAt: employee.createdAt,
    };
  }

  private buildStatusBreakdown(
    employees: PayrollRunDetailRecord['employeeResults'],
  ): PayrollRunStatusBreakdown {
    const breakdown: PayrollRunStatusBreakdown = {
      totalEmployees: employees.length,

      active: 0,

      activeHold: 0,

      resigned: 0,
    };

    for (const employee of employees) {
      switch (employee.payrollStatusSnapshot) {
        case EmployeePayrollStatus.ACTIVE:
          breakdown.active += 1;
          break;

        case EmployeePayrollStatus.ACTIVE_HOLD:
          breakdown.activeHold += 1;
          break;

        case EmployeePayrollStatus.RESIGNED:
          breakdown.resigned += 1;
          break;
      }
    }

    return breakdown;
  }
}
