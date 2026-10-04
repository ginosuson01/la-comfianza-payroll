import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CutoffFrequency, type Prisma } from '@payroll/database';

import { PrismaService } from '../database/prisma.service';

export type SemiMonthlyCutoffPosition = 'FIRST' | 'SECOND';

interface CutoffDateRule {
  mode: 'DAY' | 'LAST_DAY';

  day: number | null;

  monthOffset: number;
}

interface SemiMonthlyPeriodRule {
  code: SemiMonthlyCutoffPosition;

  start: CutoffDateRule;

  end: CutoffDateRule;

  pay: CutoffDateRule;
}

export interface PayrollCutoffPeriodResolution {
  payrollCutoffId: string;

  cutoffTemplateId: string;

  position: SemiMonthlyCutoffPosition;

  cutoff: {
    startDate: string;
    endDate: string;
    payDate: string;
  };
}

@Injectable()
export class PayrollCutoffPeriodService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    companyId: string,
    payrollCutoffId: string,
  ): Promise<PayrollCutoffPeriodResolution> {
    const cutoff = await this.prisma.payrollCutoff.findFirst({
      where: {
        id: payrollCutoffId,

        companyId,
      },

      select: {
        id: true,

        cutoffTemplateId: true,

        startDate: true,
        endDate: true,
        payDate: true,

        cutoffTemplate: {
          select: {
            id: true,

            frequency: true,

            configuration: true,
          },
        },
      },
    });

    if (!cutoff) {
      throw new NotFoundException('Payroll cutoff was not found.');
    }

    if (!cutoff.cutoffTemplateId || !cutoff.cutoffTemplate) {
      throw new BadRequestException(
        'Payroll cutoff is not linked to a cutoff template, so the semi-monthly period cannot be resolved.',
      );
    }

    if (cutoff.cutoffTemplate.frequency !== CutoffFrequency.SEMI_MONTHLY) {
      throw new BadRequestException(
        'Only SEMI_MONTHLY payroll cutoffs currently support Philippine contribution cutoff allocation.',
      );
    }

    const periods = this.parseConfiguration(
      cutoff.cutoffTemplate.configuration,
    );

    const actual = {
      startDate: this.toDateOnly(cutoff.startDate),

      endDate: this.toDateOnly(cutoff.endDate),

      payDate: this.toDateOnly(cutoff.payDate),
    };

    const matches: SemiMonthlyCutoffPosition[] = [];

    /*
     * A period may cross a calendar month boundary.
     *
     * Example:
     *
     * FIRST
     *   Aug 26 - Sep 10
     *
     * The template's logical reference month is September,
     * while another valid company configuration may use
     * Sep 1 - Sep 15.
     *
     * Search a narrow reference-month window around the
     * actual cutoff end month and compare the generated dates.
     */
    const endDate = cutoff.endDate;

    for (let anchorOffset = -2; anchorOffset <= 2; anchorOffset += 1) {
      const anchor = new Date(
        Date.UTC(
          endDate.getUTCFullYear(),
          endDate.getUTCMonth() + anchorOffset,
          1,
        ),
      );

      for (const period of periods) {
        const generated = {
          startDate: this.resolveRule(anchor, period.start),

          endDate: this.resolveRule(anchor, period.end),

          payDate: this.resolveRule(anchor, period.pay),
        };

        if (
          this.toDateOnly(generated.startDate) === actual.startDate &&
          this.toDateOnly(generated.endDate) === actual.endDate &&
          this.toDateOnly(generated.payDate) === actual.payDate
        ) {
          matches.push(period.code);
        }
      }
    }

    const uniqueMatches = [...new Set(matches)];

    if (uniqueMatches.length === 0) {
      throw new BadRequestException(
        `Payroll cutoff ${actual.startDate} to ${actual.endDate} with pay date ${actual.payDate} does not match FIRST or SECOND in its cutoff template.`,
      );
    }

    if (uniqueMatches.length > 1) {
      throw new BadRequestException(
        'Payroll cutoff matches more than one semi-monthly template period.',
      );
    }

    return {
      payrollCutoffId: cutoff.id,

      cutoffTemplateId: cutoff.cutoffTemplate.id,

      position: uniqueMatches[0],

      cutoff: actual,
    };
  }

  private parseConfiguration(
    configuration: Prisma.JsonValue,
  ): SemiMonthlyPeriodRule[] {
    const root = this.requireObject(
      configuration,
      'Cutoff template configuration',
    );

    const periodValues = root['periods'];

    if (!Array.isArray(periodValues) || periodValues.length !== 2) {
      throw new BadRequestException(
        'SEMI_MONTHLY cutoff template must define exactly two periods.',
      );
    }

    const periods = periodValues.map((value, index): SemiMonthlyPeriodRule => {
      const period = this.requireObject(
        value,

        `Cutoff template period ${index + 1}`,
      );

      const code = period['code'];

      if (code !== 'FIRST' && code !== 'SECOND') {
        throw new BadRequestException(
          `Cutoff template period ${index + 1} code must be FIRST or SECOND.`,
        );
      }

      return {
        code,

        start: this.parseRule(
          period['start'],

          `${code}.start`,
        ),

        end: this.parseRule(
          period['end'],

          `${code}.end`,
        ),

        pay: this.parseRule(
          period['pay'],

          `${code}.pay`,
        ),
      };
    });

    if (periods[0]?.code === periods[1]?.code) {
      throw new BadRequestException(
        'SEMI_MONTHLY cutoff template must contain one FIRST and one SECOND period.',
      );
    }

    return periods;
  }

  private parseRule(value: unknown, fieldName: string): CutoffDateRule {
    const rule = this.requireObject(value, fieldName);

    const mode = rule['mode'];

    if (mode !== 'DAY' && mode !== 'LAST_DAY') {
      throw new BadRequestException(
        `${fieldName}.mode must be DAY or LAST_DAY.`,
      );
    }

    const monthOffset = rule['monthOffset'];

    if (typeof monthOffset !== 'number' || !Number.isInteger(monthOffset)) {
      throw new BadRequestException(
        `${fieldName}.monthOffset must be an integer.`,
      );
    }

    if (mode === 'LAST_DAY') {
      return {
        mode,

        day: null,

        monthOffset,
      };
    }

    const day = rule['day'];

    if (
      typeof day !== 'number' ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31
    ) {
      throw new BadRequestException(
        `${fieldName}.day must be an integer from 1 to 31.`,
      );
    }

    return {
      mode,

      day,

      monthOffset,
    };
  }

  private resolveRule(anchorMonth: Date, rule: CutoffDateRule): Date {
    const monthStart = new Date(
      Date.UTC(
        anchorMonth.getUTCFullYear(),
        anchorMonth.getUTCMonth() + rule.monthOffset,
        1,
      ),
    );

    const year = monthStart.getUTCFullYear();

    const month = monthStart.getUTCMonth();

    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    if (rule.mode === 'LAST_DAY') {
      return new Date(Date.UTC(year, month, lastDay));
    }

    if (rule.day === null || rule.day > lastDay) {
      throw new BadRequestException(
        'Configured cutoff DAY rule is invalid for the resolved calendar month.',
      );
    }

    return new Date(Date.UTC(year, month, rule.day));
  }

  private requireObject(
    value: unknown,
    fieldName: string,
  ): Readonly<Record<string, unknown>> {
    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      throw new BadRequestException(`${fieldName} must be a JSON object.`);
    }

    return value as Readonly<Record<string, unknown>>;
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
