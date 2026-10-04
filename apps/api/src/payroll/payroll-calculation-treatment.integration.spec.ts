import {
  summarizeAttendance,
  type PayrollCalculationInput,
} from '@payroll/payroll-engine';

import { PayrollCalculationService } from './payroll-calculation.service';
import type { PayrollEmployeeInputAssembly } from './payroll-input.service';
import { PayrollStatutoryConfigService } from './payroll-statutory-config.service';

function createAssembly(
  overrides: Partial<PayrollCalculationInput> = {},
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

      attendance: summarizeAttendance([
        {
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
        },
      ]),

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

describe('PayrollCalculationService employee treatment integration', () => {
  const statutoryConfig = new PayrollStatutoryConfigService();

  const service = new PayrollCalculationService(statutoryConfig);

  it('returns an ACTIVE CASH employee as payroll-ready with cash payout', () => {
    const result = service.calculateEmployee(createAssembly());

    expect(result.ready).toBe(true);

    expect(result.calculation?.netPayBeforeStatusTreatment).toBe('600.00');

    expect(result.treatment?.status).toBe('COMPLETE');

    expect(result.treatment?.payableAmount).toBe('600.00');

    expect(result.treatment?.cashPayout).toBe('600.00');

    expect(result.treatment?.atmPayout).toBe('0.00');

    expect(result.treatment?.heldAmount).toBe('0.00');
  });

  it('holds the complete ACTIVE_HOLD cutoff while exit clearance is pending', () => {
    const result = service.calculateEmployee(
      createAssembly({
        payrollStatus: 'ACTIVE_HOLD',
      }),
    );

    expect(result.calculation?.status).toBe('COMPLETE');

    expect(result.calculation?.netPayBeforeStatusTreatment).toBe('600.00');

    expect(result.treatment?.status).toBe('COMPLETE');

    expect(result.treatment?.payableAmount).toBe('0.00');

    expect(result.treatment?.heldAmount).toBe('600.00');

    expect(result.treatment?.cashPayout).toBe('0.00');

    expect(result.treatment?.atmPayout).toBe('0.00');

    expect(result.ready).toBe(true);
  });

  it('keeps RESIGNED payroll incomplete until Final Pay inputs are assembled', () => {
    const result = service.calculateEmployee(
      createAssembly({
        payrollStatus: 'RESIGNED',
      }),
    );

    expect(result.calculation?.status).toBe('COMPLETE');

    expect(result.treatment?.status).toBe('INCOMPLETE');

    expect(result.treatment?.issues[0]?.code).toBe('LAST_PAY_RULE_REQUIRED');

    expect(result.treatment?.payableAmount).toBeNull();

    expect(result.treatment?.lastPayAmount).toBeNull();

    expect(result.treatment?.isLastPay).toBeNull();

    expect(result.ready).toBe(false);
  });
});
