import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAYROLL_BUSINESS_POLICIES,
  PHILIPPINE_DAILY_PREMIUM_OPTIONS,
  calculateBirWithholdingTax,
  calculateDailyMinuteValue,
  calculateLeaveEntitlement,
  calculatePagIbigContribution,
  calculatePhilHealthContribution,
  calculatePhilippineNightDifferential,
  calculateSssContribution,
  calculateSssMaternityBenefit,
  calculateThirteenthMonthPay,
  createGovernmentLoanSchedule,
  getSemiMonthlyGovernmentContributionCodes,
} from '../src/index.ts';

const SSS_TEST_RULE = {
  minimumMsc: '5000.00',
  maximumMsc: '35000.00',
  mscStep: '500.00',
  mscMidpoint: '250.00',
  regularSocialSecurityMaximumMsc: '20000.00',
  employeeRate: '0.0500',
  employerRate: '0.1000',
  mandatoryProvidentFund: {
    startsAboveMsc: '20000.00',
    employeeRate: '0.0500',
    employerRate: '0.1000',
  },
  employeesCompensation: {
    thresholdMsc: '14500.00',
    atOrBelowThresholdAmount: '10.00',
    aboveThresholdAmount: '30.00',
  },
} as const;

const PHILHEALTH_TEST_RULE = {
  salaryFloor: '10000.00',
  salaryCeiling: '100000.00',
  premiumRate: '0.0500',
  employeeShareRate: '0.5000',
  employerShareRate: '0.5000',
  oddCentavoRecipient: 'EMPLOYER',
} as const;

const PAGIBIG_TEST_RULE = {
  maximumFundSalary: '10000.00',
  employeeRateThreshold: '1500.00',
  lowerEmployeeRate: '0.0100',
  upperEmployeeRate: '0.0200',
  employerRate: '0.0200',
} as const;

test(
  'defines the approved client payroll business policies',
  () => {
    assert.deepEqual(
      getSemiMonthlyGovernmentContributionCodes(
        'FIRST',
      ),

      [
        'PHILHEALTH',
        'PAGIBIG',
      ],
    );

    assert.deepEqual(
      getSemiMonthlyGovernmentContributionCodes(
        'SECOND',
      ),

      [
        'SSS',
      ],
    );

    assert.equal(
      PAYROLL_BUSINESS_POLICIES
        .leaveCalendar
        .carryOver,

      false,
    );

    assert.equal(
      PAYROLL_BUSINESS_POLICIES
        .leaveCalendar
        .unusedBalanceTreatment,

      'EXPIRE',
    );

    assert.equal(
      PAYROLL_BUSINESS_POLICIES
        .resignationActiveHold
        .holdCutoffs,

      1,
    );

    assert.equal(
      PAYROLL_BUSINESS_POLICIES
        .resignationActiveHold
        .releaseCondition,

      'EXIT_CLEARANCE_APPROVED',
    );
  },
);

test(
  'values late and undertime minutes from daily rate',
  () => {
    assert.equal(
      calculateDailyMinuteValue({
        dailyRate: '800.0000',

        minutes: 30,

        standardWorkMinutesPerDay:
          480,
      }),

      '50.00',
    );
  },
);

test(
  'defines Philippine rest day and holiday premium rules',
  () => {
    assert.equal(
      PHILIPPINE_DAILY_PREMIUM_OPTIONS
        .regularWorkRules?.[
          'REST_DAY|NO_HOLIDAY'
        ]?.multiplier,

      '1.3000',
    );

    assert.equal(
      PHILIPPINE_DAILY_PREMIUM_OPTIONS
        .regularWorkRules?.[
          'WORKDAY|REGULAR'
        ]?.multiplier,

      '2.0000',
    );

    assert.equal(
      PHILIPPINE_DAILY_PREMIUM_OPTIONS
        .regularWorkRules?.[
          'REST_DAY|REGULAR'
        ]?.multiplier,

      '2.6000',
    );

    assert.equal(
      PHILIPPINE_DAILY_PREMIUM_OPTIONS
        .overtimeRules?.[
          'REGULAR'
        ]?.multiplier,

      '1.2500',
    );

    assert.equal(
      PHILIPPINE_DAILY_PREMIUM_OPTIONS
        .overtimeRules?.[
          'REST_DAY_REGULAR_HOLIDAY'
        ]?.multiplier,

      '3.3800',
    );
  },
);

test(
  'calculates ordinary-day night differential at 10 percent',
  () => {
    assert.equal(
      calculatePhilippineNightDifferential({
        dailyRate: '800.0000',

        nightDifferentialMinutes:
          480,

        standardWorkMinutesPerDay:
          480,

        applicableBaseMultiplier:
          '1.0000',
      }),

      '80.00',
    );
  },
);

test(
  'calculates rest-day night differential on the applicable 130 percent base',
  () => {
    assert.equal(
      calculatePhilippineNightDifferential({
        dailyRate: '800.0000',

        nightDifferentialMinutes:
          480,

        standardWorkMinutesPerDay:
          480,

        applicableBaseMultiplier:
          '1.3000',
      }),

      '104.00',
    );
  },
);

test(
  'calculates SSS contribution using the 2025 15 percent schedule',
  () => {
    const result =
      calculateSssContribution(
        '10000.00',
        SSS_TEST_RULE,
      );

    assert.equal(
      result.monthlySalaryCredit,
      '10000.00',
    );

    assert.equal(
      result.employeeShare,
      '500.00',
    );

    assert.equal(
      result.employerSocialSecurityShare,
      '1000.00',
    );

    assert.equal(
      result.employerEmployeesCompensationShare,
      '10.00',
    );

    assert.equal(
      result.employerTotal,
      '1010.00',
    );

    assert.equal(
      result.totalContribution,
      '1510.00',
    );
  },
);

test(
  'rounds SSS compensation to the correct 500-peso MSC band',
  () => {
    assert.equal(
      calculateSssContribution(
        '5250.00',
        SSS_TEST_RULE,
      ).monthlySalaryCredit,

      '5500.00',
    );

    assert.equal(
      calculateSssContribution(
        '34750.00',
        SSS_TEST_RULE,
      ).monthlySalaryCredit,

      '35000.00',
    );
  },
);

test(
  'calculates PhilHealth at 5 percent and splits it equally',
  () => {
    const result =
      calculatePhilHealthContribution(
        '20000.00',
        PHILHEALTH_TEST_RULE,
      );

    assert.equal(
      result.totalPremium,
      '1000.00',
    );

    assert.equal(
      result.employeeShare,
      '500.00',
    );

    assert.equal(
      result.employerShare,
      '500.00',
    );
  },
);

test(
  'applies PhilHealth floor and ceiling',
  () => {
    assert.equal(
      calculatePhilHealthContribution(
        '5000.00',
        PHILHEALTH_TEST_RULE,
      ).contributionBasis,

      '10000.00',
    );

    assert.equal(
      calculatePhilHealthContribution(
        '150000.00',
        PHILHEALTH_TEST_RULE,
      ).contributionBasis,

      '100000.00',
    );
  },
);

test(
  'calculates Pag-IBIG using the current 10000 maximum fund salary',
  () => {
    const result =
      calculatePagIbigContribution(
        '15000.00',
        PAGIBIG_TEST_RULE,
      );

    assert.equal(
      result.monthlyFundSalary,
      '10000.00',
    );

    assert.equal(
      result.employeeShare,
      '200.00',
    );

    assert.equal(
      result.employerShare,
      '200.00',
    );
  },
);

test(
  'applies the lower Pag-IBIG employee rate at 1500 and below',
  () => {
    const result =
      calculatePagIbigContribution(
        '1500.00',
        PAGIBIG_TEST_RULE,
      );

    assert.equal(
      result.employeeRate,
      '0.0100',
    );

    assert.equal(
      result.employeeShare,
      '15.00',
    );

    assert.equal(
      result.employerShare,
      '30.00',
    );
  },
);

test(
  'calculates BIR semi-monthly withholding using Annex E',
  () => {
    assert.equal(
      calculateBirWithholdingTax(
        'SEMI_MONTHLY',
        '10417.00',
      ).withholdingTax,

      '0.00',
    );

    assert.equal(
      calculateBirWithholdingTax(
        'SEMI_MONTHLY',
        '20000.00',
      ).withholdingTax,

      '1604.10',
    );
  },
);

test(
  'calculates BIR monthly withholding using Annex E',
  () => {
    assert.equal(
      calculateBirWithholdingTax(
        'MONTHLY',
        '20833.00',
      ).withholdingTax,

      '0.00',
    );

    assert.equal(
      calculateBirWithholdingTax(
        'MONTHLY',
        '40000.00',
      ).withholdingTax,

      '3208.40',
    );
  },
);

test(
  'calculates statutory thirteenth month pay as annual basic salary divided by twelve',
  () => {
    const result =
      calculateThirteenthMonthPay({
        totalBasicSalaryEarned:
          '120000.00',

        monthsWithServiceInCalendarYear:
          12,
      });

    assert.equal(
      result.eligible,
      true,
    );

    assert.equal(
      result.thirteenthMonthPay,
      '10000.00',
    );
  },
);

test(
  'requires at least one month of service for thirteenth month eligibility',
  () => {
    const result =
      calculateThirteenthMonthPay({
        totalBasicSalaryEarned:
          '0.00',

        monthsWithServiceInCalendarYear:
          0,
      });

    assert.equal(
      result.eligible,
      false,
    );

    assert.equal(
      result.thirteenthMonthPay,
      '0.00',
    );
  },
);

test(
  'grants internal leave eligibility after six months',
  () => {
    const result =
      calculateLeaveEntitlement({
        employmentGroup:
          'INTERNAL',

        hireDate:
          '2026-01-01',

        asOfDate:
          '2026-07-01',
      });

    assert.equal(
      result.eligible,
      true,
    );

    assert.equal(
      result.annualPaidLeaveDays,
      10,
    );

    assert.equal(
      result.calendarAllocationPolicy,
      'FULL_ON_ELIGIBILITY_RESET_JANUARY_1_NO_CARRYOVER',
    );
  },
);

test(
  'grants client leave eligibility after twelve months',
  () => {
    const result =
      calculateLeaveEntitlement({
        employmentGroup:
          'CLIENT',

        hireDate:
          '2025-09-19',

        asOfDate:
          '2026-09-19',
      });

    assert.equal(
      result.eligible,
      true,
    );

    assert.equal(
      result.annualPaidLeaveDays,
      5,
    );
  },
);

test(
  'calculates SSS maternity using the six highest MSCs in the statutory lookback period',
  () => {
    const months = [
      '2025-04',
      '2025-05',
      '2025-06',
      '2025-07',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ];

    const result =
      calculateSssMaternityBenefit({
        /*
         * July 2026 contingency:
         * semester = Apr-Sep 2026
         * lookback = Apr 2025-Mar 2026
         */
        contingencyDate:
          '2026-07-01',

        contingencyType:
          'LIVE_BIRTH',

        monthlySalaryCredits:
          months.map(
            (yearMonth) => ({
              yearMonth,

              monthlySalaryCredit:
                '16000.00',

              contributionPaid:
                true,
            }),
          ),
      });

    assert.equal(
      result.qualified,
      true,
    );

    assert.equal(
      result.qualifyingContributionMonths,
      12,
    );

    assert.equal(
      result.lookbackStartMonth,
      '2025-04',
    );

    assert.equal(
      result.lookbackEndMonth,
      '2026-03',
    );

    assert.equal(
      result.totalSelectedMonthlySalaryCredits,
      '96000.00',
    );

    assert.equal(
      result.compensableDays,
      105,
    );

    assert.equal(
      result.maternityBenefit,
      '56000.00',
    );
  },
);

test(
  'caps maternity benefit MSC at the regular SSS 20000 benefit ceiling',
  () => {
    const months = [
      '2025-04',
      '2025-05',
      '2025-06',
      '2025-07',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ];

    const result =
      calculateSssMaternityBenefit({
        contingencyDate:
          '2026-07-01',

        contingencyType:
          'LIVE_BIRTH_SOLO_PARENT',

        monthlySalaryCredits:
          months.map(
            (yearMonth) => ({
              yearMonth,

              monthlySalaryCredit:
                '35000.00',

              contributionPaid:
                true,
            }),
          ),
      });

    assert.equal(
      result.totalSelectedMonthlySalaryCredits,
      '120000.00',
    );

    assert.equal(
      result.compensableDays,
      120,
    );

    assert.equal(
      result.maternityBenefit,
      '80000.00',
    );
  },
);

test(
  'does not qualify maternity benefit with fewer than three contribution months',
  () => {
    const result =
      calculateSssMaternityBenefit({
        contingencyDate:
          '2026-07-01',

        contingencyType:
          'MISCARRIAGE_OR_ETP',

        monthlySalaryCredits: [
          {
            yearMonth:
              '2026-01',

            monthlySalaryCredit:
              '10000.00',

            contributionPaid:
              true,
          },
          {
            yearMonth:
              '2026-02',

            monthlySalaryCredit:
              '10000.00',

            contributionPaid:
              true,
          },
        ],
      });

    assert.equal(
      result.qualified,
      false,
    );

    assert.equal(
      result.maternityBenefit,
      null,
    );
  },
);

test(
  'splits odd-centavo monthly loan amortization without changing the monthly total',
  () => {
    const schedule =
      createGovernmentLoanSchedule({
        provider:
          'PAGIBIG',

        monthlyAmortization:
          '1000.01',

        startMonth:
          '2026-10',

        numberOfMonthlyAmortizations:
          12,
      });

    assert.equal(
      schedule.firstCutoffDeduction,
      '500.01',
    );

    assert.equal(
      schedule.secondCutoffDeduction,
      '500.00',
    );
  },
);

test(
  'creates a government loan schedule without guessing payroll cutoff allocation',
  () => {
    const schedule =
      createGovernmentLoanSchedule({
        provider:
          'SSS',

        monthlyAmortization:
          '1250.00',

        startMonth:
          '2026-11',

        numberOfMonthlyAmortizations:
          24,
      });

    assert.equal(
      schedule.startMonth,
      '2026-11',
    );

    assert.equal(
      schedule.endMonth,
      '2028-10',
    );

    assert.equal(
      schedule.deductionMode,
      'SPLIT_BETWEEN_SEMI_MONTHLY_CUTOFFS',
    );

    assert.equal(
      schedule.firstCutoffDeduction,
      '625.00',
    );

    assert.equal(
      schedule.secondCutoffDeduction,
      '625.00',
    );
  },
);


test(
  'uses supplied SSS rule values instead of hidden statutory constants',
  () => {
    const result =
      calculateSssContribution(
        '10000.00',
        {
          ...SSS_TEST_RULE,
          employeeRate: '0.0400',
          employerRate: '0.0900',
          employeesCompensation: {
            ...SSS_TEST_RULE.employeesCompensation,
            atOrBelowThresholdAmount: '12.00',
          },
        },
      );

    assert.equal(
      result.employeeShare,
      '400.00',
    );

    assert.equal(
      result.employerSocialSecurityShare,
      '900.00',
    );

    assert.equal(
      result.employerEmployeesCompensationShare,
      '12.00',
    );
  },
);

test(
  'uses supplied PhilHealth rule values instead of hidden statutory constants',
  () => {
    const result =
      calculatePhilHealthContribution(
        '20000.00',
        {
          ...PHILHEALTH_TEST_RULE,
          premiumRate: '0.0400',
        },
      );

    assert.equal(
      result.premiumRate,
      '0.0400',
    );

    assert.equal(
      result.totalPremium,
      '800.00',
    );

    assert.equal(
      result.employeeShare,
      '400.00',
    );

    assert.equal(
      result.employerShare,
      '400.00',
    );
  },
);

test(
  'uses supplied Pag-IBIG rule values instead of hidden statutory constants',
  () => {
    const result =
      calculatePagIbigContribution(
        '15000.00',
        {
          ...PAGIBIG_TEST_RULE,
          maximumFundSalary: '8000.00',
          upperEmployeeRate: '0.0150',
          employerRate: '0.0250',
        },
      );

    assert.equal(
      result.monthlyFundSalary,
      '8000.00',
    );

    assert.equal(
      result.employeeRate,
      '0.0150',
    );

    assert.equal(
      result.employeeShare,
      '120.00',
    );

    assert.equal(
      result.employerShare,
      '200.00',
    );
  },
);
