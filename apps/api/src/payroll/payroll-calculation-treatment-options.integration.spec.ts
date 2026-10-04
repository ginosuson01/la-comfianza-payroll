import { summarizeAttendance } from '@payroll/payroll-engine';

import { PayrollCalculationService } from './payroll-calculation.service';
import type { PayrollEmployeeInputAssembly } from './payroll-input.service';
import { PayrollStatutoryConfigService } from './payroll-statutory-config.service';

function createAssembly(
  payrollStatus: 'ACTIVE_HOLD' | 'RESIGNED',
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

      payrollStatus,

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
    },
  };
}

describe('PayrollCalculationService treatment options integration', () => {
  const statutoryConfig = new PayrollStatutoryConfigService();

  const service = new PayrollCalculationService(statutoryConfig);

  it('overrides a caller partial ACTIVE_HOLD with the approved full-hold policy', () => {
    const result = service.calculateEmployee(createAssembly('ACTIVE_HOLD'), {
      activeHold: {
        payableAmount: '200.00',

        heldAmount: '400.00',

        reason: 'Synthetic caller-provided partial hold.',
      },
    });

    expect(result.ready).toBe(true);

    expect(result.calculation?.status).toBe('COMPLETE');

    expect(result.calculation?.netPayBeforeStatusTreatment).toBe('600.00');

    expect(result.treatment?.status).toBe('COMPLETE');

    expect(result.treatment?.payableAmount).toBe('0.00');

    expect(result.treatment?.heldAmount).toBe('600.00');

    expect(result.treatment?.cashPayout).toBe('0.00');
  });

  it('accepts explicitly resolved Last Pay treatment through the API calculation layer', () => {
    const result = service.calculateEmployee(createAssembly('RESIGNED'), {
      resignedLastPay: {
        lastPayAmount: '950.00',

        thirteenthMonthPay: '350.00',

        reason: 'Synthetic approved Last Pay integration test.',
      },
    });

    expect(result.ready).toBe(true);

    expect(result.calculation?.status).toBe('COMPLETE');

    expect(result.calculation?.netPayBeforeStatusTreatment).toBe('600.00');

    expect(result.treatment?.status).toBe('COMPLETE');

    expect(result.treatment?.isLastPay).toBe(true);

    expect(result.treatment?.lastPayAmount).toBe('950.00');

    expect(result.treatment?.thirteenthMonthPay).toBe('350.00');

    expect(result.treatment?.payableAmount).toBe('950.00');

    expect(result.treatment?.cashPayout).toBe('950.00');
  });
});
