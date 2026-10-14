import {
  EmployeePayrollStatus,
  PayBasis,
  PayoutMethod,
  PayrollCompensationSource,
  PayrollLineCategory,
  PayrollRunStatus,
  Prisma,
} from '@payroll/database';

import type { PrismaService } from '../database/prisma.service';

import { PayslipDataService } from './payslip-data.service';

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function createPayrollRecord(
  status: PayrollRunStatus = PayrollRunStatus.CURRENT_LOCKED,
) {
  return {
    id: 'payroll-run-employee-1',

    employeeId: 'employee-1',
    employmentRecordId: 'employment-1',

    employeeNumberSnapshot: 'EMP-001',
    employeeNameSnapshot: 'Juan Dela Cruz',

    positionSnapshot: 'Crew',
    departmentSnapshot: 'Operations',

    payrollStatusSnapshot: EmployeePayrollStatus.ACTIVE,

    payoutMethodSnapshot: PayoutMethod.ATM,
    payoutAccountLast4Snapshot: '1234',

    payBasisSnapshot: PayBasis.DAILY,
    baseRateSnapshot: decimal('537.5000'),
    compensationSourceSnapshot:
      PayrollCompensationSource.EMPLOYEE_OVERRIDE,

    basicPay: decimal('5000.00'),
    allowancesTotal: decimal('500.00'),
    premiumPayTotal: decimal('250.00'),

    grossPay: decimal('5750.00'),

    governmentContributionsTotal: decimal('350.00'),
    taxTotal: decimal('125.00'),
    otherDeductionsTotal: decimal('75.00'),
    totalDeductions: decimal('550.00'),

    netPay: decimal('5200.00'),

    cashPayout: decimal('0.00'),
    atmPayout: decimal('5200.00'),
    heldAmount: decimal('0.00'),

    clientPayableGross: null,

    taxableCompensation: decimal('5500.00'),
    withholdingTax: decimal('125.00'),

    thirteenthMonthPay: decimal('0.00'),
    lastPayAmount: decimal('0.00'),
    isLastPay: false,

    employee: {
      email: 'juan@example.com',
    },

    payrollRun: {
      id: 'payroll-run-1',
      companyId: 'company-1',

      version: 1,
      status,

      generatedAt: new Date('2026-09-16T08:00:00.000Z'),

      companySnapshot: {
        id: 'company-1',
        code: 'COMPANY-1',
        name: 'Test Company',

        addressLine1: '123 Test Street',
        addressLine2: null,
        barangay: 'Test Barangay',
        city: 'Quezon City',
        province: 'Metro Manila',
        postalCode: '1100',
        country: 'Philippines',

        contactName: 'Test Contact',
        contactEmail: 'payroll@testcompany.example',
        contactPhone: '+639171234567',
      },

      payrollCutoff: {
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-09-15T00:00:00.000Z'),
        payDate: new Date('2026-09-25T00:00:00.000Z'),
      },
    },

    lineItems: [
      {
        id: 'line-1',

        category: PayrollLineCategory.EARNING,

        code: 'BASIC_PAY',
        description: 'Basic Pay',

        quantity: decimal('10.0000'),
        rate: decimal('537.5000'),

        amount: decimal('5375.00'),

        sequence: 1,

        metadata: null,
      },

      {
        id: 'line-2',

        category: PayrollLineCategory.ADJUSTMENT,

        code: 'ROUNDING_TEST',
        description: 'Rounding Test',

        quantity: null,
        rate: null,

        // Explicit Lacom rule verification:
        // 24.65748 -> 24.66 for business-facing money.
        amount: decimal('24.65748'),

        sequence: 2,

        metadata: {
          test: true,
        },
      },
    ],
  };
}

function createFixture() {
  const prisma = {
    payrollRunEmployee: {
      findFirst: jest.fn(),
    },
  };

  const service = new PayslipDataService(
    prisma as unknown as PrismaService,
  );

  return {
    prisma,
    service,
  };
}

describe('PayslipDataService', () => {
  it('assembles payslip data from a finalized locked payroll result', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findFirst.mockResolvedValue(
      createPayrollRecord(),
    );

    const result = await service.assemblePayslipData(
      'company-1',
      'payroll-run-1',
      'payroll-run-employee-1',
    );

    expect(prisma.payrollRunEmployee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'payroll-run-employee-1',

          payrollRunId: 'payroll-run-1',

          payrollRun: {
            companyId: 'company-1',
          },
        },
      }),
    );

    expect(result.company).toEqual({
      id: 'company-1',
      code: 'COMPANY-1',
      name: 'Test Company',

      addressLine1: '123 Test Street',
      addressLine2: null,
      barangay: 'Test Barangay',
      city: 'Quezon City',
      province: 'Metro Manila',
      postalCode: '1100',
      country: 'Philippines',

      contactName: 'Test Contact',
      contactEmail: 'payroll@testcompany.example',
      contactPhone: '+639171234567',
    });

    expect(result.payroll.version).toBe(1);
    expect(result.payroll.status).toBe(
      PayrollRunStatus.CURRENT_LOCKED,
    );

    expect(result.employee.employeeNumber).toBe('EMP-001');
    expect(result.employee.employeeName).toBe('Juan Dela Cruz');

    // Frozen source precision remains available internally.
    expect(result.employee.baseRate).toBe('537.5000');

    expect(result.totals.grossPay).toBe('5750.00');
    expect(result.totals.totalDeductions).toBe('550.00');
    expect(result.totals.netPay).toBe('5200.00');

    expect(result.lineItems).toHaveLength(2);

    expect(result.lineItems[0]).toEqual(
      expect.objectContaining({
        code: 'BASIC_PAY',
        quantity: '10.0000',
        rate: '537.5000',
        amount: '5375.00',
        sequence: 1,
      }),
    );

    // Lacom monetary rounding standard.
    expect(result.lineItems[1]?.amount).toBe('24.66');

    expect(result.suggestedRecipientEmail).toBe(
      'juan@example.com',
    );
  });

  it('allows historical SUPERSEDED payroll runs', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findFirst.mockResolvedValue(
      createPayrollRecord(PayrollRunStatus.SUPERSEDED),
    );

    const result = await service.assemblePayslipData(
      'company-1',
      'payroll-run-1',
      'payroll-run-employee-1',
    );

    expect(result.payroll.status).toBe(
      PayrollRunStatus.SUPERSEDED,
    );
  });

  it('rejects payroll that is reopened and pending regeneration', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findFirst.mockResolvedValue(
      createPayrollRecord(
        PayrollRunStatus.REOPENED_PENDING_REGENERATION,
      ),
    );

    await expect(
      service.assemblePayslipData(
        'company-1',
        'payroll-run-1',
        'payroll-run-employee-1',
      ),
    ).rejects.toThrow(
      'Payslip data can only be assembled from finalized payroll information.',
    );
  });

  it('rejects payroll without a valid historical company snapshot', async () => {
    const { prisma, service } = createFixture();

    const record = createPayrollRecord();

    record.payrollRun.companySnapshot = null as never;

    prisma.payrollRunEmployee.findFirst.mockResolvedValue(record);

    await expect(
      service.assemblePayslipData(
        'company-1',
        'payroll-run-1',
        'payroll-run-employee-1',
      ),
    ).rejects.toThrow(
      'Payroll run does not contain a valid historical company snapshot.',
    );
  });

  it('reports a missing payroll employee result', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findFirst.mockResolvedValue(null);

    await expect(
      service.assemblePayslipData(
        'company-1',
        'payroll-run-1',
        'payroll-run-employee-1',
      ),
    ).rejects.toThrow(
      'Payroll employee result was not found for the company and payroll run.',
    );
  });
});
