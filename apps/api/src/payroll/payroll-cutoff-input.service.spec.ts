import {
  DtrStatus,
  EmployeePayrollStatus,
  PayrollCutoffStatus,
} from '@payroll/database';

import type { PrismaService } from '../database/prisma.service';
import { PayrollCutoffInputService } from './payroll-cutoff-input.service';
import type {
  PayrollEmployeeInputAssembly,
  PayrollInputService,
} from './payroll-input.service';

function createAssembledInput(): PayrollEmployeeInputAssembly {
  return {
    companyId: 'company-1',

    payrollCutoffId: 'cutoff-1',

    dtrId: 'dtr-1',

    employmentStartDate: '2026-08-01',

    cutoff: {
      id: 'cutoff-1',
      startDate: '2026-09-01',
      endDate: '2026-09-15',
      payDate: '2026-09-25',
    },

    positionSnapshot: 'Crew',

    departmentSnapshot: 'Operations',

    compensationSource: 'EMPLOYEE_OVERRIDE',

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

      attendance: {
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
      },

      recurringItems: [],

      adjustments: [],

      contributionConfig: null,

      taxConfig: null,

      config: {
        companyPayrollSetupVersionId: 'setup-version-1',

        version: 1,

        standardWorkMinutesPerDay: 480,

        configSnapshot: {},
      },
    },
  };
}

function createFixture() {
  const prisma = {
    payrollCutoff: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cutoff-1',

        companyId: 'company-1',

        startDate: new Date('2026-09-01T00:00:00.000Z'),

        endDate: new Date('2026-09-15T00:00:00.000Z'),

        payDate: new Date('2026-09-25T00:00:00.000Z'),

        status: PayrollCutoffStatus.OPEN,

        company: {
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
      }),
    },

    employmentRecord: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'employment-1',

          employeeId: 'employee-1',

          employee: {
            id: 'employee-1',

            employeeNumber: 'EMP-001',

            firstName: 'Juan',
            lastName: 'Dela Cruz',

            currentStatus: EmployeePayrollStatus.ACTIVE,
          },
        },
      ]),
    },

    dtr: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'dtr-1',

          employeeId: 'employee-1',

          employmentRecordId: 'employment-1',

          status: DtrStatus.VALIDATED,

          employee: {
            employeeNumber: 'EMP-001',
          },
        },
      ]),
    },
  };

  const payrollInput = {
    assembleEmployeeInput: jest.fn().mockResolvedValue(createAssembledInput()),
  };

  const service = new PayrollCutoffInputService(
    prisma as unknown as PrismaService,
    payrollInput as unknown as PayrollInputService,
  );

  return {
    prisma,
    payrollInput,
    service,
  };
}

describe('PayrollCutoffInputService', () => {
  it('collects a payroll-ready company cutoff', async () => {
    const { service } = createFixture();

    const result = await service.collectCutoffInputs('company-1', 'cutoff-1');

    expect(result.ready).toBe(true);

    expect(result.eligibleEmployeeCount).toBe(1);

    expect(result.assembledEmployeeCount).toBe(1);

    expect(result.issues).toEqual([]);

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

    expect(result.employees).toHaveLength(1);

    expect(result.employees[0]?.input.employeeNumber).toBe('EMP-001');
  });

  it('reports multiple employment records overlapping the payroll cutoff', async () => {
    const { prisma, payrollInput, service } = createFixture();

    prisma.employmentRecord.findMany.mockResolvedValueOnce([
      {
        id: 'employment-1',

        employeeId: 'employee-1',

        employee: {
          id: 'employee-1',

          employeeNumber: 'EMP-001',

          firstName: 'Juan',
          lastName: 'Dela Cruz',

          currentStatus: EmployeePayrollStatus.ACTIVE,
        },
      },
      {
        id: 'employment-2',

        employeeId: 'employee-1',

        employee: {
          id: 'employee-1',

          employeeNumber: 'EMP-001',

          firstName: 'Juan',
          lastName: 'Dela Cruz',

          currentStatus: EmployeePayrollStatus.ACTIVE,
        },
      },
    ]);

    const result = await service.collectCutoffInputs('company-1', 'cutoff-1');

    expect(result.ready).toBe(false);

    expect(result.assembledEmployeeCount).toBe(0);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MULTIPLE_EMPLOYMENT_RECORDS',

          employeeId: 'employee-1',

          employeeNumber: 'EMP-001',
        }),
      ]),
    );

    expect(payrollInput.assembleEmployeeInput).not.toHaveBeenCalled();
  });

  it('reports an employee that is missing a DTR', async () => {
    const { prisma, payrollInput, service } = createFixture();

    prisma.dtr.findMany.mockResolvedValueOnce([]);

    const result = await service.collectCutoffInputs('company-1', 'cutoff-1');

    expect(result.ready).toBe(false);

    expect(result.assembledEmployeeCount).toBe(0);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_DTR',

          employeeId: 'employee-1',

          employeeNumber: 'EMP-001',
        }),
      ]),
    );

    expect(payrollInput.assembleEmployeeInput).not.toHaveBeenCalled();
  });

  it('reports a locked cutoff as not generatable', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollCutoff.findFirst.mockResolvedValueOnce({
      id: 'cutoff-1',

      companyId: 'company-1',

      startDate: new Date('2026-09-01T00:00:00.000Z'),

      endDate: new Date('2026-09-15T00:00:00.000Z'),

      payDate: new Date('2026-09-25T00:00:00.000Z'),

      status: PayrollCutoffStatus.LOCKED,
    });

    const result = await service.collectCutoffInputs('company-1', 'cutoff-1');

    expect(result.ready).toBe(false);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CUTOFF_NOT_GENERATABLE',
        }),
      ]),
    );
  });

  it('keeps LAST_PAY_REVIEW blocked until Last Pay payroll treatment is implemented', async () => {
    const { prisma, payrollInput, service } = createFixture();

    prisma.dtr.findMany.mockResolvedValueOnce([
      {
        id: 'dtr-1',

        employeeId: 'employee-1',

        employmentRecordId: 'employment-1',

        status: DtrStatus.LAST_PAY_REVIEW,

        employee: {
          employeeNumber: 'EMP-001',
        },
      },
    ]);

    const result = await service.collectCutoffInputs('company-1', 'cutoff-1');

    expect(result.ready).toBe(false);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DTR_NOT_PAYROLL_READY',

          employeeId: 'employee-1',
        }),
      ]),
    );

    expect(payrollInput.assembleEmployeeInput).not.toHaveBeenCalled();
  });
});
