import { Injectable, NotFoundException } from '@nestjs/common';

import {
  DtrStatus,
  PayrollCutoffStatus,
  type EmployeePayrollStatus,
} from '@payroll/database';

import { PrismaService } from '../database/prisma.service';
import {
  PayrollInputService,
  type PayrollEmployeeInputAssembly,
} from './payroll-input.service';

export type PayrollCutoffReadinessIssueCode =
  | 'CUTOFF_NOT_GENERATABLE'
  | 'NO_ELIGIBLE_EMPLOYEES'
  | 'MULTIPLE_EMPLOYMENT_RECORDS'
  | 'MISSING_DTR'
  | 'DTR_EMPLOYMENT_MISMATCH'
  | 'DTR_NOT_PAYROLL_READY'
  | 'DTR_WITHOUT_ELIGIBLE_EMPLOYMENT'
  | 'INPUT_ASSEMBLY_FAILED'
  | 'CONFIG_VERSION_MISMATCH';

export interface PayrollCutoffReadinessIssue {
  code: PayrollCutoffReadinessIssueCode;

  employeeId?: string;
  employeeNumber?: string;

  message: string;
}

export interface PayrollCutoffCollectionSnapshot {
  id: string;

  startDate: string;
  endDate: string;
  payDate: string;

  status: PayrollCutoffStatus;
}

export interface PayrollCutoffInputCollection {
  companyId: string;

  payrollCutoffId: string;

  cutoff: PayrollCutoffCollectionSnapshot;

  ready: boolean;

  eligibleEmployeeCount: number;

  assembledEmployeeCount: number;

  issues: PayrollCutoffReadinessIssue[];

  employees: PayrollEmployeeInputAssembly[];
}

interface EligibleEmployment {
  id: string;

  employeeId: string;

  employee: {
    id: string;

    employeeNumber: string;

    firstName: string;
    lastName: string;

    currentStatus: EmployeePayrollStatus;
  };
}

@Injectable()
export class PayrollCutoffInputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollInput: PayrollInputService,
  ) {}

  async collectCutoffInputs(
    companyId: string,
    payrollCutoffId: string,
  ): Promise<PayrollCutoffInputCollection> {
    const cutoff = await this.prisma.payrollCutoff.findFirst({
      where: {
        id: payrollCutoffId,
        companyId,
      },

      select: {
        id: true,

        companyId: true,

        startDate: true,
        endDate: true,
        payDate: true,

        status: true,
      },
    });

    if (!cutoff) {
      throw new NotFoundException(
        'Payroll cutoff was not found for the company.',
      );
    }

    const issues: PayrollCutoffReadinessIssue[] = [];

    if (
      cutoff.status !== PayrollCutoffStatus.OPEN &&
      cutoff.status !== PayrollCutoffStatus.REOPENED
    ) {
      issues.push({
        code: 'CUTOFF_NOT_GENERATABLE',
        message: `Payroll cannot be generated while the cutoff status is ${cutoff.status}.`,
      });
    }

    const employmentRecords = await this.prisma.employmentRecord.findMany({
      where: {
        companyId,

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

        employeeId: true,

        employee: {
          select: {
            id: true,

            employeeNumber: true,

            firstName: true,
            lastName: true,

            currentStatus: true,
          },
        },
      },

      orderBy: [
        {
          employee: {
            employeeNumber: 'asc',
          },
        },
        {
          startDate: 'desc',
        },
      ],
    });

    const employmentByEmployee = new Map<string, EligibleEmployment[]>();

    for (const employment of employmentRecords) {
      const existing = employmentByEmployee.get(employment.employeeId) ?? [];

      existing.push(employment);

      employmentByEmployee.set(employment.employeeId, existing);
    }

    if (employmentByEmployee.size === 0) {
      issues.push({
        code: 'NO_ELIGIBLE_EMPLOYEES',
        message:
          'No employees are assigned to the company during this payroll cutoff.',
      });
    }

    const dtrs = await this.prisma.dtr.findMany({
      where: {
        companyId,
        payrollCutoffId,
      },

      select: {
        id: true,

        employeeId: true,

        employmentRecordId: true,

        status: true,

        employee: {
          select: {
            employeeNumber: true,
          },
        },
      },

      orderBy: {
        employee: {
          employeeNumber: 'asc',
        },
      },
    });

    const dtrByEmployee = new Map(dtrs.map((dtr) => [dtr.employeeId, dtr]));

    const employees: PayrollEmployeeInputAssembly[] = [];

    for (const [employeeId, employments] of employmentByEmployee.entries()) {
      const employee = employments[0]?.employee;

      if (!employee) {
        continue;
      }

      if (employments.length !== 1) {
        issues.push({
          code: 'MULTIPLE_EMPLOYMENT_RECORDS',

          employeeId,
          employeeNumber: employee.employeeNumber,

          message:
            `Employee ${employee.employeeNumber} has ${employments.length} ` +
            'employment records overlapping the payroll cutoff.',
        });

        continue;
      }

      const employment = employments[0];

      if (!employment) {
        continue;
      }

      const dtr = dtrByEmployee.get(employeeId);

      if (!dtr) {
        issues.push({
          code: 'MISSING_DTR',

          employeeId,
          employeeNumber: employee.employeeNumber,

          message: `Employee ${employee.employeeNumber} does not have a DTR for this payroll cutoff.`,
        });

        continue;
      }

      if (dtr.employmentRecordId !== employment.id) {
        issues.push({
          code: 'DTR_EMPLOYMENT_MISMATCH',

          employeeId,
          employeeNumber: employee.employeeNumber,

          message:
            `Employee ${employee.employeeNumber} DTR is linked to an employment ` +
            'record different from the eligible company assignment.',
        });

        continue;
      }

      if (dtr.status !== DtrStatus.VALIDATED) {
        issues.push({
          code: 'DTR_NOT_PAYROLL_READY',

          employeeId,
          employeeNumber: employee.employeeNumber,

          message:
            `Employee ${employee.employeeNumber} DTR status is ${dtr.status}. ` +
            'The DTR must be VALIDATED before normal payroll generation.',
        });

        continue;
      }

      try {
        const assembled = await this.payrollInput.assembleEmployeeInput(
          companyId,
          payrollCutoffId,
          employeeId,
        );

        employees.push(assembled);
      } catch (error: unknown) {
        issues.push({
          code: 'INPUT_ASSEMBLY_FAILED',

          employeeId,
          employeeNumber: employee.employeeNumber,

          message:
            `Unable to assemble payroll input for employee ` +
            `${employee.employeeNumber}: ${this.getErrorMessage(error)}`,
        });
      }
    }

    for (const dtr of dtrs) {
      if (!employmentByEmployee.has(dtr.employeeId)) {
        issues.push({
          code: 'DTR_WITHOUT_ELIGIBLE_EMPLOYMENT',

          employeeId: dtr.employeeId,
          employeeNumber: dtr.employee.employeeNumber,

          message:
            `Employee ${dtr.employee.employeeNumber} has a DTR for the cutoff ` +
            'but no eligible employment assignment covering the payroll period.',
        });
      }
    }

    const setupVersionIds = new Set(
      employees.map(
        (employee) => employee.input.config.companyPayrollSetupVersionId,
      ),
    );

    if (setupVersionIds.size > 1) {
      issues.push({
        code: 'CONFIG_VERSION_MISMATCH',

        message:
          'Payroll inputs for the cutoff resolved to more than one company payroll configuration version.',
      });
    }

    employees.sort((left, right) =>
      left.input.employeeNumber.localeCompare(right.input.employeeNumber),
    );

    const eligibleEmployeeCount = employmentByEmployee.size;

    const ready =
      issues.length === 0 && employees.length === eligibleEmployeeCount;

    return {
      companyId,

      payrollCutoffId,

      cutoff: {
        id: cutoff.id,

        startDate: this.toDateString(cutoff.startDate),
        endDate: this.toDateString(cutoff.endDate),
        payDate: this.toDateString(cutoff.payDate),

        status: cutoff.status,
      },

      ready,

      eligibleEmployeeCount,

      assembledEmployeeCount: employees.length,

      issues,

      employees,
    };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown payroll input assembly error.';
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
