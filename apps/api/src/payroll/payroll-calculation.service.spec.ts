import {
  summarizeAttendance,
  type AttendanceSummaryEntryInput,
} from '@payroll/payroll-engine';

import { PayrollCalculationService } from './payroll-calculation.service';
import type { PayrollEmployeeInputAssembly } from './payroll-input.service';
import { PayrollStatutoryConfigService } from './payroll-statutory-config.service';

function createEntry(
  overrides: Partial<AttendanceSummaryEntryInput> = {},
): AttendanceSummaryEntryInput {
  return {
    workDate: '2026-09-01',

    regularMinutes: 480,
    lateMinutes: 0,
    undertimeMinutes: 0,
    absenceMinutes: 0,
    leaveMinutes: 0,
    nightDifferentialMinutes: 0,

    restDay: false,

    leaveType: null,

    holiday: null,

    overtimeEntries: [],

    ...overrides,
  };
}

function createAssembly(
  overrides: Partial<PayrollEmployeeInputAssembly['input']> = {},
): PayrollEmployeeInputAssembly {
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

      payoutMethod: 'CASH',

      payoutAccountLast4: null,

      payBasis: 'DAILY',

      baseRate: '600.0000',

      attendance: summarizeAttendance([createEntry()]),

      recurringItems: [],

      adjustments: [],

      contributionConfig: {
        SSS: {
          treatment: 'NOT_APPLICABLE',
          reason: 'Synthetic test exemption.',
        },

        PHILHEALTH: {
          treatment: 'NOT_APPLICABLE',
          reason: 'Synthetic test exemption.',
        },

        PAGIBIG: {
          treatment: 'NOT_APPLICABLE',
          reason: 'Synthetic test exemption.',
        },
      },

      taxConfig: {
        treatment: 'NOT_APPLICABLE',
        reason: 'Synthetic test exemption.',
      },

      config: {
        companyPayrollSetupVersionId: 'setup-version-1',

        version: 1,

        standardWorkMinutesPerDay: 480,

        configSnapshot: {},
      },

      ...overrides,
    },
  };
}

describe('PayrollCalculationService', () => {
  it('calculates Philippine core payroll before statutory resolution', () => {
    const assembly = createAssembly({
      contributionConfig: null,
      taxConfig: null,
    });

    const result = service.calculateEmployeeCore(assembly);

    expect(result.status).toBe('COMPLETE');

    expect(result.basicPay).toBe('600.00');

    expect(result.grossPay).toBe('600.00');
  });

  const statutoryConfig = new PayrollStatutoryConfigService();

  const service = new PayrollCalculationService(statutoryConfig);

  it('calculates an assembled payroll input end to end through statutory payroll', () => {
    const result = service.calculateEmployee(createAssembly());

    expect(result.ready).toBe(true);

    expect(result.companyId).toBe('company-1');

    expect(result.payrollCutoffId).toBe('cutoff-1');

    expect(result.employeeNumber).toBe('EMP-001');

    expect(result.positionSnapshot).toBe('Crew');

    expect(result.departmentSnapshot).toBe('Operations');

    expect(result.statutoryConfig.ready).toBe(true);

    expect(result.calculation?.status).toBe('COMPLETE');

    expect(result.calculation?.corePayroll.basicPay).toBe('600.00');

    expect(result.calculation?.corePayroll.grossPay).toBe('600.00');

    expect(result.calculation?.governmentContributionsTotal).toBe('0.00');

    expect(result.calculation?.withholdingTax).toBe('0.00');

    expect(result.calculation?.netPayBeforeStatusTreatment).toBe('600.00');
  });

  it('does not calculate payroll when statutory configuration is unresolved', () => {
    const result = service.calculateEmployee(
      createAssembly({
        contributionConfig: null,
        taxConfig: null,
      }),
    );

    expect(result.ready).toBe(false);

    expect(result.statutoryConfig.ready).toBe(false);

    expect(result.statutoryConfig.issues).not.toHaveLength(0);

    expect(result.calculation).toBeNull();
  });

  it('applies the approved Philippine rest-day premium rule through the API calculation layer', () => {
    const assembly = createAssembly();

    assembly.input.attendance = summarizeAttendance([
      createEntry({
        restDay: true,
      }),
    ]);

    const result = service.calculateEmployee(assembly);

    expect(result.statutoryConfig.ready).toBe(true);

    expect(result.calculation).not.toBeNull();

    expect(result.calculation?.corePayroll.status).toBe('COMPLETE');

    expect(result.calculation?.status).toBe('COMPLETE');

    expect(result.ready).toBe(true);

    expect(result.calculation?.corePayroll.basicPay).toBe('600.00');

    expect(result.calculation?.corePayroll.premiumPayTotal).toBe('180.00');

    expect(result.calculation?.corePayroll.grossPay).toBe('780.00');

    expect(result.calculation?.netPayBeforeStatusTreatment).toBe('780.00');
  });
});
