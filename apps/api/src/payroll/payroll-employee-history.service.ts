import { Injectable } from '@nestjs/common';
import type {
  EmployeePayrollStatus,
  PayBasis,
  PayoutMethod,
  PayrollCompensationSource,
  PayrollRunStatus,
  Prisma,
} from '@payroll/database';

import { PrismaService } from '../database/prisma.service';
import type { ListEmployeePayrollHistoryQueryDto } from './dto/list-employee-payroll-history-query.dto';

const EMPLOYEE_PAYROLL_HISTORY_SELECT = {
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

  payrollRun: {
    select: {
      id: true,

      version: true,

      status: true,

      generatedAt: true,

      payrollCutoff: {
        select: {
          id: true,

          startDate: true,

          endDate: true,

          payDate: true,
        },
      },
    },
  },
} satisfies Prisma.PayrollRunEmployeeSelect;

type EmployeePayrollHistoryRecord = Prisma.PayrollRunEmployeeGetPayload<{
  select: typeof EMPLOYEE_PAYROLL_HISTORY_SELECT;
}>;

export interface EmployeePayrollHistoryItem {
  payrollRunEmployeeId: string;

  payrollRun: {
    id: string;

    version: number;

    status: PayrollRunStatus;

    generatedAt: Date;
  };

  cutoff: {
    id: string;

    startDate: Date;

    endDate: Date;

    payDate: Date;
  };

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
}

export interface EmployeePayrollHistoryResponse {
  items: EmployeePayrollHistoryItem[];

  pagination: {
    page: number;

    pageSize: number;

    total: number;

    totalPages: number;
  };
}

@Injectable()
export class PayrollEmployeeHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listEmployeePayrollHistory(
    companyId: string,
    employeeId: string,
    query: ListEmployeePayrollHistoryQueryDto,
  ): Promise<EmployeePayrollHistoryResponse> {
    const page = query.page;

    const pageSize = query.pageSize;

    const payrollRunWhere: Prisma.PayrollRunWhereInput = {
      companyId,
    };

    if (query.runStatus) {
      payrollRunWhere.status = query.runStatus;
    }

    const where: Prisma.PayrollRunEmployeeWhereInput = {
      employeeId,

      payrollRun: {
        is: payrollRunWhere,
      },
    };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.payrollRunEmployee.count({
        where,
      }),

      this.prisma.payrollRunEmployee.findMany({
        where,

        select: EMPLOYEE_PAYROLL_HISTORY_SELECT,

        orderBy: {
          createdAt: 'desc',
        },

        skip: (page - 1) * pageSize,

        take: pageSize,
      }),
    ]);

    return {
      items: records.map((record) => this.toHistoryItem(record)),

      pagination: {
        page,

        pageSize,

        total,

        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private toHistoryItem(
    record: EmployeePayrollHistoryRecord,
  ): EmployeePayrollHistoryItem {
    return {
      payrollRunEmployeeId: record.id,

      payrollRun: {
        id: record.payrollRun.id,

        version: record.payrollRun.version,

        status: record.payrollRun.status,

        generatedAt: record.payrollRun.generatedAt,
      },

      cutoff: {
        id: record.payrollRun.payrollCutoff.id,

        startDate: record.payrollRun.payrollCutoff.startDate,

        endDate: record.payrollRun.payrollCutoff.endDate,

        payDate: record.payrollRun.payrollCutoff.payDate,
      },

      employeeId: record.employeeId,

      employmentRecordId: record.employmentRecordId,

      employeeNumber: record.employeeNumberSnapshot,

      employeeName: record.employeeNameSnapshot,

      position: record.positionSnapshot,

      department: record.departmentSnapshot,

      payrollStatus: record.payrollStatusSnapshot,

      payoutMethod: record.payoutMethodSnapshot,

      payoutAccountLast4: record.payoutAccountLast4Snapshot,

      payBasis: record.payBasisSnapshot,

      baseRate: record.baseRateSnapshot.toFixed(4),

      compensationSource: record.compensationSourceSnapshot,

      basicPay: record.basicPay.toFixed(2),

      allowancesTotal: record.allowancesTotal.toFixed(2),

      premiumPayTotal: record.premiumPayTotal.toFixed(2),

      grossPay: record.grossPay.toFixed(2),

      governmentContributionsTotal:
        record.governmentContributionsTotal.toFixed(2),

      taxTotal: record.taxTotal.toFixed(2),

      otherDeductionsTotal: record.otherDeductionsTotal.toFixed(2),

      totalDeductions: record.totalDeductions.toFixed(2),

      netPay: record.netPay.toFixed(2),

      cashPayout: record.cashPayout.toFixed(2),

      atmPayout: record.atmPayout.toFixed(2),

      heldAmount: record.heldAmount.toFixed(2),

      clientPayableGross:
        record.clientPayableGross === null
          ? null
          : record.clientPayableGross.toFixed(2),

      taxableCompensation: record.taxableCompensation.toFixed(2),

      withholdingTax: record.withholdingTax.toFixed(2),

      thirteenthMonthPay: record.thirteenthMonthPay.toFixed(2),

      lastPayAmount: record.lastPayAmount.toFixed(2),

      isLastPay: record.isLastPay,
    };
  }
}
