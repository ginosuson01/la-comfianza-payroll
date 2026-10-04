import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CutoffFrequency, type Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import type { GeneratePayrollCutoffsDto } from './dto/generate-payroll-cutoffs.dto';
import {
  PAYROLL_CUTOFF_AUDIT_MODULE,
  PAYROLL_CUTOFF_ENTITY_TYPE,
  PayrollCutoffAuditAction,
} from './payroll-cutoff-audit.constants';

const GENERATED_PAYROLL_CUTOFF_SELECT = {
  id: true,
  companyId: true,
  cutoffTemplateId: true,

  startDate: true,
  endDate: true,
  payDate: true,

  status: true,

  lockedAt: true,
  reopenedAt: true,
  lastReopenReason: true,

  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PayrollCutoffSelect;

export type GeneratedPayrollCutoffRecord = Prisma.PayrollCutoffGetPayload<{
  select: typeof GENERATED_PAYROLL_CUTOFF_SELECT;
}>;

interface StoredDateRule {
  mode: 'DAY' | 'LAST_DAY';
  day?: number;
  monthOffset: number;
}

interface StoredCutoffPeriod {
  code: string;
  name: string;

  start: StoredDateRule;
  end: StoredDateRule;
  pay: StoredDateRule;
}

interface ResolvedCutoffPeriod {
  code: string;
  name: string;

  startDate: Date;
  endDate: Date;
  payDate: Date;
}

export interface GeneratedPayrollCutoffResultItem {
  periodCode: string;
  periodName: string;

  created: boolean;

  cutoff: GeneratedPayrollCutoffRecord;
}

export interface GeneratePayrollCutoffsResult {
  companyId: string;
  cutoffTemplateId: string;
  referenceMonth: string;

  createdCount: number;
  existingCount: number;

  cutoffs: GeneratedPayrollCutoffResultItem[];
}

@Injectable()
export class PayrollCutoffGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async generateForMonth(
    input: GeneratePayrollCutoffsDto,
    actorUserId: string,
  ): Promise<GeneratePayrollCutoffsResult> {
    const referenceMonth = this.parseReferenceMonth(input.referenceMonth);

    const template = await this.prisma.cutoffTemplate.findFirst({
      where: {
        id: input.cutoffTemplateId,

        companyId: input.companyId,

        active: true,
      },

      select: {
        id: true,
        companyId: true,
        code: true,
        name: true,
        frequency: true,
        configuration: true,
      },
    });

    if (!template) {
      throw new NotFoundException(
        'An active cutoff template was not found for this company.',
      );
    }

    if (template.frequency !== CutoffFrequency.SEMI_MONTHLY) {
      throw new BadRequestException(
        'Only SEMI_MONTHLY cutoff generation is currently supported.',
      );
    }

    const periods = this.parseSemiMonthlyConfiguration(template.configuration);

    const resolvedPeriods = periods.map((period) =>
      this.resolvePeriod(
        period,
        referenceMonth.year,
        referenceMonth.monthIndex,
      ),
    );

    this.validateResolvedPeriods(resolvedPeriods);

    const generated = await this.prisma.$transaction(async (transaction) => {
      const results: GeneratedPayrollCutoffResultItem[] = [];

      for (const period of resolvedPeriods) {
        const existing = await transaction.payrollCutoff.findUnique({
          where: {
            companyId_startDate_endDate: {
              companyId: input.companyId,

              startDate: period.startDate,

              endDate: period.endDate,
            },
          },

          select: GENERATED_PAYROLL_CUTOFF_SELECT,
        });

        if (existing) {
          this.assertExistingCutoffMatches(existing, template.id, period);

          results.push({
            periodCode: period.code,

            periodName: period.name,

            created: false,

            cutoff: existing,
          });

          continue;
        }

        const created = await transaction.payrollCutoff.create({
          data: {
            companyId: input.companyId,

            cutoffTemplateId: template.id,

            startDate: period.startDate,

            endDate: period.endDate,

            payDate: period.payDate,
          },

          select: GENERATED_PAYROLL_CUTOFF_SELECT,
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId: input.companyId,

          action: PayrollCutoffAuditAction.GENERATED,

          module: PAYROLL_CUTOFF_AUDIT_MODULE,

          entityType: PAYROLL_CUTOFF_ENTITY_TYPE,

          entityId: created.id,

          reference: this.getCutoffReference(created),

          details:
            `Generated payroll cutoff ` +
            `${this.getCutoffReference(created)} from template ` +
            `${template.name} (${template.code}) ` +
            `for reference month ` +
            `${input.referenceMonth}.`,

          metadata: {
            cutoffTemplateId: template.id,

            cutoffTemplateCode: template.code,

            referenceMonth: input.referenceMonth,

            periodCode: period.code,

            periodName: period.name,

            startDate: this.toDateString(period.startDate),

            endDate: this.toDateString(period.endDate),

            payDate: this.toDateString(period.payDate),
          },
        });

        results.push({
          periodCode: period.code,

          periodName: period.name,

          created: true,

          cutoff: created,
        });
      }

      return results;
    });

    return {
      companyId: input.companyId,

      cutoffTemplateId: template.id,

      referenceMonth: input.referenceMonth,

      createdCount: generated.filter((item) => item.created).length,

      existingCount: generated.filter((item) => !item.created).length,

      cutoffs: generated,
    };
  }

  private parseReferenceMonth(value: string): {
    year: number;
    monthIndex: number;
  } {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);

    if (!match) {
      throw new BadRequestException('referenceMonth must use YYYY-MM format.');
    }

    return {
      year: Number(match[1]),

      monthIndex: Number(match[2]) - 1,
    };
  }

  private parseSemiMonthlyConfiguration(
    configuration: Prisma.JsonValue,
  ): StoredCutoffPeriod[] {
    if (!this.isObject(configuration)) {
      throw new BadRequestException(
        'Cutoff template configuration is invalid.',
      );
    }

    const periods = configuration.periods;

    if (!Array.isArray(periods) || periods.length !== 2) {
      throw new BadRequestException(
        'SEMI_MONTHLY cutoff configuration must define exactly two periods.',
      );
    }

    return periods.map((value, index) => this.parseStoredPeriod(value, index));
  }

  private parseStoredPeriod(value: unknown, index: number): StoredCutoffPeriod {
    if (!this.isObject(value)) {
      throw new BadRequestException(`Cutoff period ${index + 1} is invalid.`);
    }

    if (typeof value.code !== 'string' || !value.code) {
      throw new BadRequestException(
        `Cutoff period ${index + 1} code is invalid.`,
      );
    }

    if (typeof value.name !== 'string' || !value.name) {
      throw new BadRequestException(
        `Cutoff period ${index + 1} name is invalid.`,
      );
    }

    return {
      code: value.code,

      name: value.name,

      start: this.parseStoredDateRule(value.start, `${value.code}.start`),

      end: this.parseStoredDateRule(value.end, `${value.code}.end`),

      pay: this.parseStoredDateRule(value.pay, `${value.code}.pay`),
    };
  }

  private parseStoredDateRule(
    value: unknown,
    fieldName: string,
  ): StoredDateRule {
    if (!this.isObject(value)) {
      throw new BadRequestException(`${fieldName} is invalid.`);
    }

    const mode = value.mode;

    const monthOffset = value.monthOffset;

    if (mode !== 'DAY' && mode !== 'LAST_DAY') {
      throw new BadRequestException(`${fieldName}.mode is invalid.`);
    }

    if (
      !Number.isInteger(monthOffset) ||
      (monthOffset !== -1 && monthOffset !== 0 && monthOffset !== 1)
    ) {
      throw new BadRequestException(`${fieldName}.monthOffset is invalid.`);
    }

    if (mode === 'LAST_DAY') {
      return {
        mode,
        monthOffset,
      };
    }

    const day = value.day;

    if (
      !Number.isInteger(day) ||
      typeof day !== 'number' ||
      day < 1 ||
      day > 31
    ) {
      throw new BadRequestException(`${fieldName}.day is invalid.`);
    }

    return {
      mode,
      day,
      monthOffset,
    };
  }

  private resolvePeriod(
    period: StoredCutoffPeriod,
    referenceYear: number,
    referenceMonthIndex: number,
  ): ResolvedCutoffPeriod {
    return {
      code: period.code,

      name: period.name,

      startDate: this.resolveDateRule(
        period.start,
        referenceYear,
        referenceMonthIndex,
        `${period.code}.start`,
      ),

      endDate: this.resolveDateRule(
        period.end,
        referenceYear,
        referenceMonthIndex,
        `${period.code}.end`,
      ),

      payDate: this.resolveDateRule(
        period.pay,
        referenceYear,
        referenceMonthIndex,
        `${period.code}.pay`,
      ),
    };
  }

  private resolveDateRule(
    rule: StoredDateRule,
    referenceYear: number,
    referenceMonthIndex: number,
    fieldName: string,
  ): Date {
    const monthAnchor = new Date(
      Date.UTC(referenceYear, referenceMonthIndex + rule.monthOffset, 1),
    );

    const year = monthAnchor.getUTCFullYear();

    const monthIndex = monthAnchor.getUTCMonth();

    if (rule.mode === 'LAST_DAY') {
      return new Date(Date.UTC(year, monthIndex + 1, 0));
    }

    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

    if (rule.day === undefined || rule.day > lastDay) {
      throw new BadRequestException(
        `${fieldName} resolves to a day that does not exist in ${year}-${String(
          monthIndex + 1,
        ).padStart(2, '0')}.`,
      );
    }

    return new Date(Date.UTC(year, monthIndex, rule.day));
  }

  private validateResolvedPeriods(periods: ResolvedCutoffPeriod[]): void {
    for (const period of periods) {
      if (period.startDate.getTime() > period.endDate.getTime()) {
        throw new BadRequestException(
          `Cutoff period ${period.code} starts after it ends.`,
        );
      }

      if (period.endDate.getTime() > period.payDate.getTime()) {
        throw new BadRequestException(
          `Pay date for cutoff period ${period.code} cannot be before the cutoff end date.`,
        );
      }
    }

    const ordered = [...periods].sort(
      (left, right) => left.startDate.getTime() - right.startDate.getTime(),
    );

    if (ordered[0].endDate.getTime() >= ordered[1].startDate.getTime()) {
      throw new BadRequestException(
        'Generated SEMI_MONTHLY cutoff periods cannot overlap.',
      );
    }
  }

  private assertExistingCutoffMatches(
    existing: GeneratedPayrollCutoffRecord,
    cutoffTemplateId: string,
    period: ResolvedCutoffPeriod,
  ): void {
    if (
      existing.cutoffTemplateId !== cutoffTemplateId ||
      existing.payDate.getTime() !== period.payDate.getTime()
    ) {
      throw new ConflictException(
        `A payroll cutoff already exists for ` +
          `${this.getCutoffReference(
            existing,
          )}, but it does not match the selected cutoff template.`,
      );
    }
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getCutoffReference(cutoff: {
    startDate: Date;
    endDate: Date;
  }): string {
    return (
      `${this.toDateString(cutoff.startDate)} to ` +
      `${this.toDateString(cutoff.endDate)}`
    );
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
