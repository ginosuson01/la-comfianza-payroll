import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  EmployeePayrollStatus,
  PayBasis,
  PayrollAdjustmentType,
  PayoutMethod,
  RecurringPayrollItemKind,
} from '@payroll/database';

import type { AttendanceAggregate } from '@payroll/payroll-engine';

import type { PrismaService } from '../database/prisma.service';
import type { DtrAttendanceSummaryService } from '../dtrs/dtr-attendance-summary.service';
import type { DtrPayrollConfigService } from '../dtrs/dtr-payroll-config.service';
import { PayrollInputService } from './payroll-input.service';

function decimal(value: string) {
  return {
    toFixed: () => value,
  };
}

function attendance(): AttendanceAggregate {
  return {
    entryCount: 1,

    restDayEntryCount: 0,
    holidayEntryCount: 0,

    regularMinutes: 480,
    lateMinutes: 0,
    undertimeMinutes: 0,
    absenceMinutes: 0,
    leaveMinutes: 0,
    overtimeMinutes: 0,
    nightDifferentialMinutes: 0,

    workedMinutes: 480,
    restDayWorkedMinutes: 0,

    leaveBreakdown: [],
    overtimeBreakdown: [],
    holidayBreakdown: [],

    premiumWorkBreakdown: [],
  };
}

function createFixture() {
  const startDate = new Date('2026-09-01T00:00:00.000Z');

  const employmentStartDate = new Date('2026-08-01T00:00:00.000Z');

  const endDate = new Date('2026-09-15T00:00:00.000Z');

  const payDate = new Date('2026-09-25T00:00:00.000Z');

  const prisma = {
    dtr: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'dtr-1',

        companyId: 'company-1',

        employeeId: 'employee-1',

        employmentRecordId: 'employment-1',

        employee: {
          id: 'employee-1',

          employeeNumber: 'EMP-001',

          firstName: 'Juan',
          middleName: null,
          lastName: 'Dela Cruz',
          suffix: null,

          currentStatus: EmployeePayrollStatus.ACTIVE,
        },

        employmentRecord: {
          id: 'employment-1',

          companyId: 'company-1',

          startDate: employmentStartDate,

          position: {
            name: 'Crew',
          },

          department: {
            name: 'Operations',
          },

          payrollProfile: {
            payoutMethod: PayoutMethod.ATM,

            bankName: 'Test Bank',

            accountNumberLast4: '1234',

            contributionConfig: null,

            taxConfig: null,
          },
        },

        payrollCutoff: {
          id: 'cutoff-1',

          companyId: 'company-1',

          startDate,
          endDate,
          payDate,

          status: 'OPEN',
        },
      }),
    },

    compensationRecord: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'compensation-1',

        payBasis: PayBasis.DAILY,

        rate: decimal('537.5000'),

        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),

        effectiveTo: null,
      }),
    },

    employeeStatusHistory: {
      findFirst: jest.fn().mockResolvedValue({
        newStatus: EmployeePayrollStatus.ACTIVE,
      }),
    },

    companyCompensationRecord: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'company-compensation-1',

        payBasis: PayBasis.DAILY,

        rate: decimal('600.0000'),

        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),

        effectiveTo: null,
      }),
    },

    recurringPayrollItem: {
      findMany: jest.fn().mockResolvedValue([
        {
          kind: RecurringPayrollItemKind.ALLOWANCE,

          code: 'MEAL',

          description: 'Meal Allowance',

          amount: decimal('500.00'),

          taxable: false,
        },
      ]),
    },

    payrollAdjustment: {
      findMany: jest.fn().mockResolvedValue([
        {
          type: PayrollAdjustmentType.EARNING,

          code: 'ADJ-001',

          description: 'Approved adjustment',

          amount: decimal('100.00'),

          taxable: true,

          reason: 'Test adjustment',
        },
      ]),
    },

    companyPayrollSetupVersion: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'setup-version-3',

        version: 3,

        config: {
          attendance: {
            standardWorkMinutesPerDay: 480,
          },
        },

        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),

        effectiveTo: null,

        companyPayrollSetup: {
          companyId: 'company-1',
        },
      }),
    },
  };

  const attendanceSummary = {
    getSummary: jest.fn().mockResolvedValue({
      dtrId: 'dtr-1',

      companyId: 'company-1',

      employeeId: 'employee-1',

      employmentRecordId: 'employment-1',

      payrollCutoffId: 'cutoff-1',

      status: 'VALIDATED',

      validatedAt: '2026-09-16T00:00:00.000Z',

      payrollCutoff: {
        id: 'cutoff-1',

        startDate: '2026-09-01',

        endDate: '2026-09-15',

        payDate: '2026-09-25',

        status: 'OPEN',
      },

      payrollReady: true,

      readinessIssues: [],

      attendance: attendance(),
    }),
  };

  const payrollConfig = {
    getAttendanceConfig: jest.fn().mockResolvedValue({
      companyPayrollSetupVersionId: 'setup-version-3',

      version: 3,

      standardWorkMinutesPerDay: 480,
    }),
  };

  const service = new PayrollInputService(
    prisma as unknown as PrismaService,

    attendanceSummary as unknown as DtrAttendanceSummaryService,

    payrollConfig as unknown as DtrPayrollConfigService,
  );

  return {
    prisma,
    attendanceSummary,
    payrollConfig,
    service,
  };
}

describe('PayrollInputService', () => {
  it('assembles a payroll engine input from validated payroll source data', async () => {
    const { service } = createFixture();

    const result = await service.assembleEmployeeInput(
      'company-1',
      'cutoff-1',
      'employee-1',
    );

    expect(result).toMatchObject({
      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      dtrId: 'dtr-1',

      employmentStartDate: '2026-08-01',

      positionSnapshot: 'Crew',

      departmentSnapshot: 'Operations',

      cutoff: {
        id: 'cutoff-1',

        startDate: '2026-09-01',

        endDate: '2026-09-15',

        payDate: '2026-09-25',
      },

      input: {
        employeeId: 'employee-1',

        employmentRecordId: 'employment-1',

        employeeNumber: 'EMP-001',

        employeeName: 'Juan Dela Cruz',

        payrollStatus: 'ACTIVE',

        payoutMethod: 'ATM',

        payoutAccountLast4: '1234',

        payBasis: 'DAILY',

        baseRate: '537.5000',

        recurringItems: [
          {
            code: 'MEAL',

            description: 'Meal Allowance',

            kind: 'ALLOWANCE',

            amount: '500.00',

            taxable: false,
          },
        ],

        adjustments: [
          {
            code: 'ADJ-001',

            description: 'Approved adjustment',

            type: 'EARNING',

            amount: '100.00',

            reason: 'Test adjustment',
          },
        ],

        config: {
          companyPayrollSetupVersionId: 'setup-version-3',

          version: 3,

          standardWorkMinutesPerDay: 480,
        },
      },
    });
  });

  it('uses the employee status effective at the payroll cutoff end date', async () => {
    const { prisma, service } = createFixture();

    prisma.employeeStatusHistory.findFirst.mockResolvedValueOnce({
      newStatus: EmployeePayrollStatus.ACTIVE_HOLD,
    });

    const result = await service.assembleEmployeeInput(
      'company-1',
      'cutoff-1',
      'employee-1',
    );

    expect(prisma.employeeStatusHistory.findFirst).toHaveBeenCalledWith({
      where: {
        employeeId: 'employee-1',
        effectiveDate: {
          lte: new Date('2026-09-15T00:00:00.000Z'),
        },
      },
      orderBy: [
        {
          effectiveDate: 'desc',
        },
        {
          changedAt: 'desc',
        },
      ],
      select: {
        newStatus: true,
      },
    });

    expect(result.input.payrollStatus).toBe('ACTIVE_HOLD');
  });

  it('prefers an effective employee compensation override over the company standard', async () => {
    const { prisma, service } = createFixture();

    const result = await service.assembleEmployeeInput(
      'company-1',
      'cutoff-1',
      'employee-1',
    );

    expect(prisma.compensationRecord.findFirst).toHaveBeenCalledWith({
      where: {
        employmentRecordId: 'employment-1',

        effectiveFrom: {
          lte: new Date('2026-09-15T00:00:00.000Z'),
        },

        OR: [
          {
            effectiveTo: null,
          },
          {
            effectiveTo: {
              gt: new Date('2026-09-15T00:00:00.000Z'),
            },
          },
        ],
      },

      orderBy: {
        effectiveFrom: 'desc',
      },

      select: {
        id: true,
        payBasis: true,
        rate: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    expect(prisma.companyCompensationRecord.findFirst).not.toHaveBeenCalled();

    expect(result.compensationSource).toBe('EMPLOYEE_OVERRIDE');

    expect(result.input.payBasis).toBe('DAILY');
    expect(result.input.baseRate).toBe('537.5000');
  });

  it('rejects an employee compensation change that becomes effective inside the cutoff', async () => {
    const { prisma, service } = createFixture();

    prisma.compensationRecord.findFirst.mockResolvedValueOnce({
      id: 'compensation-2',
      payBasis: PayBasis.DAILY,
      rate: decimal('750.0000'),
      effectiveFrom: new Date('2026-09-10T00:00:00.000Z'),
      effectiveTo: null,
    });

    await expect(
      service.assembleEmployeeInput('company-1', 'cutoff-1', 'employee-1'),
    ).rejects.toThrow(
      'Compensation changes within a payroll cutoff are not supported.',
    );
  });

  it('inherits the effective company standard when no employee compensation override exists', async () => {
    const { prisma, service } = createFixture();

    prisma.compensationRecord.findFirst.mockResolvedValueOnce(null);

    const result = await service.assembleEmployeeInput(
      'company-1',
      'cutoff-1',
      'employee-1',
    );

    expect(prisma.companyCompensationRecord.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',

        effectiveFrom: {
          lte: new Date('2026-09-15T00:00:00.000Z'),
        },

        OR: [
          {
            effectiveTo: null,
          },
          {
            effectiveTo: {
              gt: new Date('2026-09-15T00:00:00.000Z'),
            },
          },
        ],
      },

      orderBy: {
        effectiveFrom: 'desc',
      },

      select: {
        id: true,
        payBasis: true,
        rate: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    expect(result.compensationSource).toBe('COMPANY_STANDARD');

    expect(result.input.payBasis).toBe('DAILY');
    expect(result.input.baseRate).toBe('600.0000');
  });

  it('rejects a recurring payroll item that becomes effective inside the cutoff', async () => {
    const { prisma, service } = createFixture();

    prisma.recurringPayrollItem.findMany.mockResolvedValueOnce([
      {
        kind: RecurringPayrollItemKind.ALLOWANCE,
        code: 'MEAL',
        description: 'Meal Allowance',
        amount: decimal('500.00'),
        taxable: false,
        effectiveFrom: new Date('2026-09-10T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.assembleEmployeeInput('company-1', 'cutoff-1', 'employee-1'),
    ).rejects.toThrow(
      'Recurring payroll items that become effective within a payroll cutoff are not supported.',
    );
  });

  it('rejects payroll input when neither employee nor company compensation is effective', async () => {
    const { prisma, service } = createFixture();

    prisma.compensationRecord.findFirst.mockResolvedValueOnce(null);

    prisma.companyCompensationRecord.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.assembleEmployeeInput('company-1', 'cutoff-1', 'employee-1'),
    ).rejects.toThrow(
      'No effective employee compensation override or company standard compensation exists at the payroll cutoff end date.',
    );
  });

  it('rejects an employee without a DTR for the selected cutoff', async () => {
    const { prisma, service } = createFixture();

    prisma.dtr.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.assembleEmployeeInput('company-1', 'cutoff-1', 'employee-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a DTR that is not payroll-ready', async () => {
    const { attendanceSummary, service } = createFixture();

    attendanceSummary.getSummary.mockResolvedValueOnce({
      payrollReady: false,

      readinessIssues: ['DTR must be validated before payroll generation.'],
    });

    await expect(
      service.assembleEmployeeInput('company-1', 'cutoff-1', 'employee-1'),
    ).rejects.toThrow('DTR must be validated before payroll generation.');
  });

  it('rejects a payroll configuration that does not cover the complete cutoff', async () => {
    const { prisma, service } = createFixture();

    prisma.companyPayrollSetupVersion.findUnique.mockResolvedValueOnce({
      id: 'setup-version-3',

      version: 3,

      config: {
        attendance: {
          standardWorkMinutesPerDay: 480,
        },
      },

      effectiveFrom: new Date('2026-09-10T00:00:00.000Z'),

      effectiveTo: null,

      companyPayrollSetup: {
        companyId: 'company-1',
      },
    });

    await expect(
      service.assembleEmployeeInput('company-1', 'cutoff-1', 'employee-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
