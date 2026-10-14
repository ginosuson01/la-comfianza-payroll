import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayrollRunStatus,
  type Prisma,
} from '@payroll/database';

import { PrismaService } from '../database/prisma.service';
import type {
  PayslipCompanySnapshot,
  PayslipData,
} from './payslip-data.types';

const PAYSLIP_DATA_SELECT = {
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

  employee: {
    select: {
      email: true,
    },
  },

  payrollRun: {
    select: {
      id: true,
      companyId: true,

      version: true,
      status: true,

      generatedAt: true,

      companySnapshot: true,

      payrollCutoff: {
        select: {
          startDate: true,
          endDate: true,
          payDate: true,
        },
      },
    },
  },

  lineItems: {
    orderBy: [
      {
        sequence: 'asc',
      },
      {
        createdAt: 'asc',
      },
    ],

    select: {
      id: true,

      category: true,

      code: true,
      description: true,

      quantity: true,
      rate: true,
      amount: true,

      sequence: true,

      metadata: true,
    },
  },
} satisfies Prisma.PayrollRunEmployeeSelect;

type PayslipDataRecord = Prisma.PayrollRunEmployeeGetPayload<{
  select: typeof PAYSLIP_DATA_SELECT;
}>;

@Injectable()
export class PayslipDataService {
  constructor(private readonly prisma: PrismaService) {}

  async assemblePayslipData(
    companyId: string,
    payrollRunId: string,
    payrollRunEmployeeId: string,
  ): Promise<PayslipData> {
    const record = await this.prisma.payrollRunEmployee.findFirst({
      where: {
        id: payrollRunEmployeeId,

        payrollRunId,

        payrollRun: {
          companyId,
        },
      },

      select: PAYSLIP_DATA_SELECT,
    });

    if (!record) {
      throw new NotFoundException(
        'Payroll employee result was not found for the company and payroll run.',
      );
    }

    this.assertFinalizedPayrollRun(record);

    const company = this.parseCompanySnapshot(
      record.payrollRun.companySnapshot,
    );

    return {
      company,

      payroll: {
        payrollRunId: record.payrollRun.id,
        payrollRunEmployeeId: record.id,

        version: record.payrollRun.version,
        status: record.payrollRun.status,

        generatedAt: record.payrollRun.generatedAt,

        cutoff: {
          startDate: record.payrollRun.payrollCutoff.startDate,
          endDate: record.payrollRun.payrollCutoff.endDate,
          payDate: record.payrollRun.payrollCutoff.payDate,
        },
      },

      employee: {
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

        // Preserve the frozen source precision here.
        // Payslip presentation applies Lacom's two-decimal monetary display rule.
        baseRate: record.baseRateSnapshot.toFixed(4),

        compensationSource: record.compensationSourceSnapshot,
      },

      totals: {
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
      },

      lineItems: record.lineItems.map((lineItem) => ({
        id: lineItem.id,

        category: lineItem.category,

        code: lineItem.code,
        description: lineItem.description,

        quantity:
          lineItem.quantity === null
            ? null
            : lineItem.quantity.toFixed(4),

        rate:
          lineItem.rate === null
            ? null
            : lineItem.rate.toFixed(4),

        amount: lineItem.amount.toFixed(2),

        sequence: lineItem.sequence,

        metadata: lineItem.metadata,
      })),

      suggestedRecipientEmail: record.employee.email,
    };
  }

  private assertFinalizedPayrollRun(record: PayslipDataRecord): void {
    if (
      record.payrollRun.status !== PayrollRunStatus.CURRENT_LOCKED &&
      record.payrollRun.status !== PayrollRunStatus.SUPERSEDED
    ) {
      throw new ConflictException(
        'Payslip data can only be assembled from finalized payroll information.',
      );
    }
  }

  private parseCompanySnapshot(
    value: Prisma.JsonValue | null,
  ): PayslipCompanySnapshot {
    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      throw new ConflictException(
        'Payroll run does not contain a valid historical company snapshot.',
      );
    }

    return {
      id: this.requireString(value, 'id'),
      code: this.requireString(value, 'code'),
      name: this.requireString(value, 'name'),

      addressLine1: this.optionalString(value, 'addressLine1'),
      addressLine2: this.optionalString(value, 'addressLine2'),
      barangay: this.optionalString(value, 'barangay'),
      city: this.optionalString(value, 'city'),
      province: this.optionalString(value, 'province'),
      postalCode: this.optionalString(value, 'postalCode'),
      country: this.requireString(value, 'country'),

      contactName: this.optionalString(value, 'contactName'),
      contactEmail: this.optionalString(value, 'contactEmail'),
      contactPhone: this.optionalString(value, 'contactPhone'),
    };
  }

  private requireString(
    value: Readonly<Record<string, unknown>>,
    field: string,
  ): string {
    const fieldValue = value[field];

    if (typeof fieldValue !== 'string' || !fieldValue.trim()) {
      throw new ConflictException(
        `Payroll company snapshot is missing ${field}.`,
      );
    }

    return fieldValue;
  }

  private optionalString(
    value: Readonly<Record<string, unknown>>,
    field: string,
  ): string | null {
    const fieldValue = value[field];

    if (fieldValue === null || fieldValue === undefined) {
      return null;
    }

    if (typeof fieldValue !== 'string') {
      throw new ConflictException(
        `Payroll company snapshot contains an invalid ${field}.`,
      );
    }

    return fieldValue;
  }
}
