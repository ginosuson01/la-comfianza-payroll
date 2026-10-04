import { Injectable } from '@nestjs/common';

import { PayrollLineCategory, PayrollRunStatus } from '@payroll/database';

import { formatMoney, parseMoney } from '@payroll/payroll-engine';

import { PrismaService } from '../database/prisma.service';

export type PhilippineContributionCode = 'SSS' | 'PHILHEALTH' | 'PAGIBIG';

export interface PayrollMonthlyContributionAmounts {
  SSS: string;
  PHILHEALTH: string;
  PAGIBIG: string;
}

export interface PayrollMonthlyStatutoryOpeningValues {
  /*
   * Optional manual opening values are used only when an
   * earlier payroll belonging to this statutory month was
   * processed outside this system.
   *
   * They are never inferred.
   */
  basicPay?: string;
  grossPay?: string;

  contributionAmounts?: Partial<Record<PhilippineContributionCode, string>>;
}

export interface PayrollMonthlyStatutoryBasisInput {
  companyId: string;

  employeeId: string;

  /*
   * The cutoff currently being calculated must not be included
   * as historical payroll, especially during regeneration.
   */
  payrollCutoffId: string;

  /*
   * YYYY-MM-DD.
   *
   * We will initially pass the current cutoff end date.
   * The statutory month is the calendar month containing this
   * reference date.
   */
  monthReferenceDate: string;

  current: {
    basicPay: string;
    grossPay: string;
  };

  opening?: PayrollMonthlyStatutoryOpeningValues;
}

export interface PayrollMonthlyStatutoryPriorRun {
  payrollRunId: string;
  payrollCutoffId: string;

  version: number;

  cutoff: {
    startDate: string;
    endDate: string;
    payDate: string;
  };

  basicPay: string;
  grossPay: string;

  contributionAmounts: PayrollMonthlyContributionAmounts;
}

export interface PayrollMonthlyStatutoryBasis {
  referenceMonth: string;

  monthStart: string;
  nextMonthStart: string;

  /*
   * Distinguishes an explicitly supplied opening, including
   * an intentional 0.00 opening, from no opening at all.
   */
  openingProvided: boolean;

  /*
   * SSS monthly-remuneration completeness specifically needs
   * to know whether prior gross remuneration was supplied.
   *
   * An opening containing only contribution amounts must not
   * be mistaken for an earnings opening.
   */
  openingGrossPayProvided: boolean;

  opening: {
    basicPay: string;
    grossPay: string;

    contributionAmounts: PayrollMonthlyContributionAmounts;
  };

  priorLockedRuns: readonly PayrollMonthlyStatutoryPriorRun[];

  prior: {
    basicPay: string;
    grossPay: string;

    contributionAmounts: PayrollMonthlyContributionAmounts;
  };

  current: {
    basicPay: string;
    grossPay: string;
  };

  /*
   * Monthly earnings basis before this cutoff's statutory
   * deductions are applied.
   */
  monthly: {
    basicPay: string;
    grossPay: string;

    /*
     * Amounts already collected earlier in this statutory month.
     * B2.3 will use this to prevent duplicate contribution
     * collection.
     */
    contributionAmountsAlreadyCollected: PayrollMonthlyContributionAmounts;
  };
}

interface MoneyAccumulator {
  basicPay: bigint;
  grossPay: bigint;

  contributions: Record<PhilippineContributionCode, bigint>;
}

const CONTRIBUTION_CODES: readonly PhilippineContributionCode[] = [
  'SSS',
  'PHILHEALTH',
  'PAGIBIG',
];

@Injectable()
export class PayrollMonthlyStatutoryBasisService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    input: PayrollMonthlyStatutoryBasisInput,
  ): Promise<PayrollMonthlyStatutoryBasis> {
    const referenceDate = this.parseDateOnly(
      input.monthReferenceDate,
      'Month reference date',
    );

    const monthStart = new Date(
      Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1),
    );

    const nextMonthStart = new Date(
      Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth() + 1,
        1,
      ),
    );

    const priorRows = await this.prisma.payrollRunEmployee.findMany({
      where: {
        employeeId: input.employeeId,

        payrollRun: {
          is: {
            companyId: input.companyId,

            status: PayrollRunStatus.CURRENT_LOCKED,

            payrollCutoffId: {
              not: input.payrollCutoffId,
            },

            payrollCutoff: {
              is: {
                endDate: {
                  gte: monthStart,

                  lt: nextMonthStart,
                },
              },
            },
          },
        },
      },

      select: {
        basicPay: true,
        grossPay: true,

        lineItems: {
          where: {
            category: PayrollLineCategory.CONTRIBUTION,
          },

          select: {
            code: true,
            amount: true,
          },
        },

        payrollRun: {
          select: {
            id: true,

            payrollCutoffId: true,

            version: true,

            payrollCutoff: {
              select: {
                startDate: true,
                endDate: true,
                payDate: true,
              },
            },
          },
        },
      },
    });

    const priorLockedRuns = priorRows
      .map((row): PayrollMonthlyStatutoryPriorRun => {
        const contributions = this.emptyContributionAccumulator();

        for (const lineItem of row.lineItems) {
          if (!this.isContributionCode(lineItem.code)) {
            continue;
          }

          contributions[lineItem.code] += parseMoney(
            lineItem.amount.toFixed(2),
          );
        }

        return {
          payrollRunId: row.payrollRun.id,

          payrollCutoffId: row.payrollRun.payrollCutoffId,

          version: row.payrollRun.version,

          cutoff: {
            startDate: this.toDateOnly(row.payrollRun.payrollCutoff.startDate),

            endDate: this.toDateOnly(row.payrollRun.payrollCutoff.endDate),

            payDate: this.toDateOnly(row.payrollRun.payrollCutoff.payDate),
          },

          basicPay: row.basicPay.toFixed(2),

          grossPay: row.grossPay.toFixed(2),

          contributionAmounts: this.formatContributions(contributions),
        };
      })
      .sort((left, right) =>
        left.cutoff.endDate.localeCompare(right.cutoff.endDate),
      );

    const opening = this.resolveOpening(input.opening);

    const priorAccumulator = this.emptyAccumulator();

    for (const prior of priorLockedRuns) {
      priorAccumulator.basicPay += parseMoney(prior.basicPay);

      priorAccumulator.grossPay += parseMoney(prior.grossPay);

      for (const code of CONTRIBUTION_CODES) {
        priorAccumulator.contributions[code] += parseMoney(
          prior.contributionAmounts[code],
        );
      }
    }

    const openingBasicPay = parseMoney(opening.basicPay);

    const openingGrossPay = parseMoney(opening.grossPay);

    const currentBasicPay = this.requireNonNegativeMoney(
      input.current.basicPay,
      'Current basic pay',
    );

    const currentGrossPay = this.requireNonNegativeMoney(
      input.current.grossPay,
      'Current gross pay',
    );

    const collectedContributions = this.emptyContributionAccumulator();

    for (const code of CONTRIBUTION_CODES) {
      collectedContributions[code] =
        parseMoney(opening.contributionAmounts[code]) +
        priorAccumulator.contributions[code];
    }

    return {
      referenceMonth: this.toYearMonth(referenceDate),

      monthStart: this.toDateOnly(monthStart),

      nextMonthStart: this.toDateOnly(nextMonthStart),

      openingProvided: input.opening !== undefined,

      openingGrossPayProvided: input.opening?.grossPay !== undefined,

      opening,

      priorLockedRuns,

      prior: {
        basicPay: formatMoney(priorAccumulator.basicPay),

        grossPay: formatMoney(priorAccumulator.grossPay),

        contributionAmounts: this.formatContributions(
          priorAccumulator.contributions,
        ),
      },

      current: {
        basicPay: formatMoney(currentBasicPay),

        grossPay: formatMoney(currentGrossPay),
      },

      monthly: {
        basicPay: formatMoney(
          openingBasicPay + priorAccumulator.basicPay + currentBasicPay,
        ),

        grossPay: formatMoney(
          openingGrossPay + priorAccumulator.grossPay + currentGrossPay,
        ),

        contributionAmountsAlreadyCollected: this.formatContributions(
          collectedContributions,
        ),
      },
    };
  }

  private resolveOpening(
    opening: PayrollMonthlyStatutoryOpeningValues | undefined,
  ): PayrollMonthlyStatutoryBasis['opening'] {
    const basicPay = this.requireNonNegativeMoney(
      opening?.basicPay ?? '0.00',

      'Opening basic pay',
    );

    const grossPay = this.requireNonNegativeMoney(
      opening?.grossPay ?? '0.00',

      'Opening gross pay',
    );

    const contributions = this.emptyContributionAccumulator();

    for (const code of CONTRIBUTION_CODES) {
      contributions[code] = this.requireNonNegativeMoney(
        opening?.contributionAmounts?.[code] ?? '0.00',

        `Opening ${code} contribution`,
      );
    }

    return {
      basicPay: formatMoney(basicPay),

      grossPay: formatMoney(grossPay),

      contributionAmounts: this.formatContributions(contributions),
    };
  }

  private emptyAccumulator(): MoneyAccumulator {
    return {
      basicPay: 0n,
      grossPay: 0n,

      contributions: this.emptyContributionAccumulator(),
    };
  }

  private emptyContributionAccumulator(): Record<
    PhilippineContributionCode,
    bigint
  > {
    return {
      SSS: 0n,

      PHILHEALTH: 0n,

      PAGIBIG: 0n,
    };
  }

  private formatContributions(
    contributions: Readonly<Record<PhilippineContributionCode, bigint>>,
  ): PayrollMonthlyContributionAmounts {
    return {
      SSS: formatMoney(contributions.SSS),

      PHILHEALTH: formatMoney(contributions.PHILHEALTH),

      PAGIBIG: formatMoney(contributions.PAGIBIG),
    };
  }

  private isContributionCode(
    value: string,
  ): value is PhilippineContributionCode {
    return value === 'SSS' || value === 'PHILHEALTH' || value === 'PAGIBIG';
  }

  private requireNonNegativeMoney(value: string, fieldName: string): bigint {
    const amount = parseMoney(value);

    if (amount < 0n) {
      throw new Error(`${fieldName} must not be negative.`);
    }

    return amount;
  }

  private parseDateOnly(value: string, fieldName: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`${fieldName} must use YYYY-MM-DD.`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime()) || this.toDateOnly(date) !== value) {
      throw new Error(`${fieldName} is not a valid calendar date.`);
    }

    return date;
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toYearMonth(value: Date): string {
    return value.toISOString().slice(0, 7);
  }
}
