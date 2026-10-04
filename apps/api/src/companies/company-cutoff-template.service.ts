import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CutoffFrequency, type Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import {
  CUTOFF_TEMPLATE_AUDIT_MODULE,
  CUTOFF_TEMPLATE_ENTITY_TYPE,
  CutoffTemplateAuditAction,
} from './cutoff-template-audit.constants';
import type {
  CreateCutoffTemplateDto,
  CutoffDateRuleDto,
} from './dto/create-cutoff-template.dto';

const CUTOFF_TEMPLATE_SELECT = {
  id: true,
  companyId: true,

  code: true,
  name: true,

  frequency: true,
  configuration: true,

  active: true,

  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CutoffTemplateSelect;

export type CompanyCutoffTemplateView = Prisma.CutoffTemplateGetPayload<{
  select: typeof CUTOFF_TEMPLATE_SELECT;
}>;

interface ComparableDateRule {
  monthOffset: number;
  dayOrder: number;
}

interface PeriodInterval {
  code: string;

  start: ComparableDateRule;
  end: ComparableDateRule;
}

@Injectable()
export class CompanyCutoffTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listCompanyCutoffTemplates(
    companyId: string,
  ): Promise<CompanyCutoffTemplateView[]> {
    await this.getCompanyOrThrow(companyId);

    return this.prisma.cutoffTemplate.findMany({
      where: {
        companyId,
      },

      select: CUTOFF_TEMPLATE_SELECT,

      orderBy: [
        {
          active: 'desc',
        },
        {
          name: 'asc',
        },
      ],
    });
  }

  async createCompanyCutoffTemplate(
    companyId: string,
    input: CreateCutoffTemplateDto,
    actorUserId: string,
  ): Promise<CompanyCutoffTemplateView> {
    const company = await this.getCompanyOrThrow(companyId);

    this.validateConfiguration(input);

    const existing = await this.prisma.cutoffTemplate.findUnique({
      where: {
        companyId_code: {
          companyId,
          code: input.code,
        },
      },

      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Cutoff template code already exists for this company.',
      );
    }

    const configuration = this.toConfigurationJson(input);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const template = await transaction.cutoffTemplate.create({
          data: {
            companyId,

            code: input.code,

            name: input.name,

            frequency: input.frequency,

            configuration,

            active: true,
          },

          select: CUTOFF_TEMPLATE_SELECT,
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId,

          action: CutoffTemplateAuditAction.CREATED,

          module: CUTOFF_TEMPLATE_AUDIT_MODULE,

          entityType: CUTOFF_TEMPLATE_ENTITY_TYPE,

          entityId: template.id,

          reference: `${company.code}:${template.code}`,

          details:
            `Created cutoff template ${template.name} ` +
            `(${template.code}) for ` +
            `${company.name} (${company.code}).`,

          metadata: {
            code: template.code,

            name: template.name,

            frequency: template.frequency,

            active: template.active,
          },
        });

        return template;
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Cutoff template code already exists for this company.',
        );
      }

      throw error;
    }
  }

  private validateConfiguration(input: CreateCutoffTemplateDto): void {
    if (input.frequency !== CutoffFrequency.SEMI_MONTHLY) {
      throw new BadRequestException(
        'Only SEMI_MONTHLY cutoff templates are currently supported.',
      );
    }

    const periods = input.configuration?.periods;

    if (!Array.isArray(periods) || periods.length !== 2) {
      throw new BadRequestException(
        'A SEMI_MONTHLY cutoff template must define exactly two periods.',
      );
    }

    const codes = new Set<string>();

    const intervals: PeriodInterval[] = [];

    for (const period of periods) {
      if (codes.has(period.code)) {
        throw new BadRequestException(
          'Cutoff period codes must be unique within the template.',
        );
      }

      codes.add(period.code);

      const start = this.validateDateRule(period.start, `${period.code}.start`);

      const end = this.validateDateRule(period.end, `${period.code}.end`);

      const pay = this.validateDateRule(period.pay, `${period.code}.pay`);

      if (this.compareDateRules(start, end) > 0) {
        throw new BadRequestException(
          `Cutoff period ${period.code} starts after it ends.`,
        );
      }

      if (this.compareDateRules(end, pay) > 0) {
        throw new BadRequestException(
          `Pay date for cutoff period ${period.code} cannot be before the cutoff end date.`,
        );
      }

      intervals.push({
        code: period.code,

        start,
        end,
      });
    }

    const sorted = [...intervals].sort((left, right) =>
      this.compareDateRules(left.start, right.start),
    );

    if (this.compareDateRules(sorted[0].end, sorted[1].start) >= 0) {
      throw new BadRequestException(
        'SEMI_MONTHLY cutoff periods cannot overlap.',
      );
    }
  }

  private validateDateRule(
    rule: CutoffDateRuleDto | undefined,
    fieldName: string,
  ): ComparableDateRule {
    if (!rule) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    if (
      !Number.isInteger(rule.monthOffset) ||
      rule.monthOffset < -1 ||
      rule.monthOffset > 1
    ) {
      throw new BadRequestException(
        `${fieldName}.monthOffset must be -1, 0, or 1.`,
      );
    }

    if (rule.mode === 'DAY') {
      if (
        !Number.isInteger(rule.day) ||
        rule.day === undefined ||
        rule.day < 1 ||
        rule.day > 31
      ) {
        throw new BadRequestException(
          `${fieldName}.day must be an integer from 1 to 31 when mode is DAY.`,
        );
      }

      return {
        monthOffset: rule.monthOffset,

        dayOrder: rule.day,
      };
    }

    if (rule.mode === 'LAST_DAY') {
      if (rule.day !== undefined) {
        throw new BadRequestException(
          `${fieldName}.day must not be provided when mode is LAST_DAY.`,
        );
      }

      return {
        monthOffset: rule.monthOffset,

        dayOrder: 32,
      };
    }

    throw new BadRequestException(`${fieldName}.mode must be DAY or LAST_DAY.`);
  }

  private compareDateRules(
    left: ComparableDateRule,
    right: ComparableDateRule,
  ): number {
    if (left.monthOffset !== right.monthOffset) {
      return left.monthOffset - right.monthOffset;
    }

    return left.dayOrder - right.dayOrder;
  }

  private toConfigurationJson(
    input: CreateCutoffTemplateDto,
  ): Prisma.InputJsonObject {
    return {
      periods: input.configuration.periods.map((period) => ({
        code: period.code,

        name: period.name,

        start: this.toDateRuleJson(period.start),

        end: this.toDateRuleJson(period.end),

        pay: this.toDateRuleJson(period.pay),
      })),
    };
  }

  private toDateRuleJson(rule: CutoffDateRuleDto): Prisma.InputJsonObject {
    if (rule.mode === 'DAY') {
      return {
        mode: rule.mode,

        monthOffset: rule.monthOffset,

        day: rule.day,
      };
    }

    return {
      mode: rule.mode,

      monthOffset: rule.monthOffset,
    };
  }

  private async getCompanyOrThrow(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: {
        id: companyId,
      },

      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company was not found.');
    }

    return company;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (
      (
        error as {
          code?: unknown;
        }
      ).code === 'P2002'
    );
  }
}
