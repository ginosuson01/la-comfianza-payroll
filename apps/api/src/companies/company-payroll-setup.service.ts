import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigStatus, type Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import {
  COMPANY_PAYROLL_SETUP_AUDIT_MODULE,
  COMPANY_PAYROLL_SETUP_ENTITY_TYPE,
  CompanyPayrollSetupAuditAction,
} from './company-payroll-setup-audit.constants';
import type { CreateCompanyPayrollSetupDto } from './dto/create-company-payroll-setup.dto';
import type { CreateCompanyPayrollSetupVersionDto } from './dto/create-company-payroll-setup-version.dto';

export interface CompanyPayrollSetupVersionView {
  id: string;
  version: number;

  status: ConfigStatus;

  effectiveFrom: Date | null;
  effectiveTo: Date | null;

  config: Prisma.JsonValue;

  createdAt: Date;
}

export interface CompanyPayrollSetupView {
  id: string;
  companyId: string;

  name: string;
  status: ConfigStatus;

  createdAt: Date;
  updatedAt: Date;

  activeVersion: CompanyPayrollSetupVersionView | null;
}

@Injectable()
export class CompanyPayrollSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getCompanyPayrollSetup(
    companyId: string,
  ): Promise<CompanyPayrollSetupView | null> {
    await this.getCompanyOrThrow(companyId);

    const setup = await this.prisma.companyPayrollSetup.findUnique({
      where: {
        companyId,
      },

      select: {
        id: true,
        companyId: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!setup) {
      return null;
    }

    const activeVersion =
      await this.prisma.companyPayrollSetupVersion.findFirst({
        where: {
          companyPayrollSetupId: setup.id,
          status: ConfigStatus.ACTIVE,
        },

        orderBy: {
          version: 'desc',
        },

        select: {
          id: true,
          version: true,
          status: true,
          effectiveFrom: true,
          effectiveTo: true,
          config: true,
          createdAt: true,
        },
      });

    return {
      ...setup,
      activeVersion,
    };
  }

  async createCompanyPayrollSetup(
    companyId: string,
    input: CreateCompanyPayrollSetupDto,
    actorUserId: string,
  ): Promise<CompanyPayrollSetupView> {
    const company = await this.getCompanyOrThrow(companyId);

    const existingSetup = await this.prisma.companyPayrollSetup.findUnique({
      where: {
        companyId,
      },

      select: {
        id: true,
      },
    });

    if (existingSetup) {
      throw new ConflictException(
        'Payroll setup is already configured for this company.',
      );
    }

    const effectiveFrom = this.parseDate(input.effectiveFrom, 'effectiveFrom');

    const effectiveTo = this.parseDate(input.effectiveTo, 'effectiveTo');

    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'effectiveTo cannot be earlier than effectiveFrom.',
      );
    }

    /*
     * Build and validate the complete immutable configuration
     * before opening the database transaction.
     *
     * Invalid payroll configuration must never start
     * persistence work.
     */
    const config = this.buildPayrollSetupConfig(
      input.standardWorkMinutesPerDay,
      input.philHealthDailyWorkerScheduleDaysPerWeek,
      {
        regionCode: input.minimumWageRegionCode,
        wageOrderCode: input.minimumWageOrderCode,
        areaClassification: input.minimumWageAreaClassification,
        sector: input.minimumWageSector,
        dailyRate: input.minimumWageDailyRate,
        rateEffectiveFrom: input.minimumWageRateEffectiveFrom,
      },
    );

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const setup = await transaction.companyPayrollSetup.create({
          data: {
            companyId,

            name: `${company.name} Payroll Setup`,

            status: ConfigStatus.ACTIVE,
          },

          select: {
            id: true,
            companyId: true,
            name: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const version = await transaction.companyPayrollSetupVersion.create({
          data: {
            companyPayrollSetupId: setup.id,

            sourceTemplateVersionId: null,

            version: 1,

            config,

            status: ConfigStatus.ACTIVE,

            effectiveFrom,
            effectiveTo,
          },

          select: {
            id: true,
            version: true,
            status: true,
            effectiveFrom: true,
            effectiveTo: true,
            config: true,
            createdAt: true,
          },
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId,

          action: CompanyPayrollSetupAuditAction.CREATED,

          module: COMPANY_PAYROLL_SETUP_AUDIT_MODULE,

          entityType: COMPANY_PAYROLL_SETUP_ENTITY_TYPE,

          entityId: setup.id,

          reference: company.code,

          details:
            `Created payroll setup version 1 for ` +
            `${company.name} (${company.code}).`,

          metadata: {
            version: version.version,

            status: version.status,

            effectiveFrom:
              version.effectiveFrom?.toISOString().slice(0, 10) ?? null,

            effectiveTo:
              version.effectiveTo?.toISOString().slice(0, 10) ?? null,

            standardWorkMinutesPerDay: input.standardWorkMinutesPerDay,

            ...(input.philHealthDailyWorkerScheduleDaysPerWeek !== undefined
              ? {
                  philHealthDailyWorkerScheduleDaysPerWeek:
                    input.philHealthDailyWorkerScheduleDaysPerWeek,
                }
              : {}),
          },
        });

        return {
          ...setup,
          activeVersion: version,
        };
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Payroll setup is already configured for this company.',
        );
      }

      throw error;
    }
  }

  async createCompanyPayrollSetupVersion(
    companyId: string,
    input: CreateCompanyPayrollSetupVersionDto,
    actorUserId: string,
  ): Promise<CompanyPayrollSetupView> {
    const company = await this.getCompanyOrThrow(companyId);

    const setup = await this.prisma.companyPayrollSetup.findUnique({
      where: {
        companyId,
      },

      select: {
        id: true,
        companyId: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!setup) {
      throw new NotFoundException(
        'Payroll setup is not configured for this company.',
      );
    }

    const currentVersion =
      await this.prisma.companyPayrollSetupVersion.findFirst({
        where: {
          companyPayrollSetupId: setup.id,

          status: ConfigStatus.ACTIVE,
        },

        orderBy: {
          version: 'desc',
        },

        select: {
          id: true,
          version: true,

          sourceTemplateVersionId: true,

          effectiveFrom: true,

          effectiveTo: true,
        },
      });

    if (!currentVersion) {
      throw new ConflictException(
        'Payroll setup has no active version to supersede.',
      );
    }

    const effectiveFrom = this.parseDate(input.effectiveFrom, 'effectiveFrom');

    if (!effectiveFrom) {
      throw new BadRequestException(
        'effectiveFrom is required when creating a payroll setup version.',
      );
    }

    const effectiveTo = this.parseDate(input.effectiveTo, 'effectiveTo');

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'effectiveTo cannot be earlier than effectiveFrom.',
      );
    }

    if (
      currentVersion.effectiveFrom &&
      effectiveFrom <= currentVersion.effectiveFrom
    ) {
      throw new BadRequestException(
        'The new payroll setup version effectiveFrom must be later than the current version effectiveFrom.',
      );
    }

    const dayBeforeEffectiveFrom = new Date(effectiveFrom);

    dayBeforeEffectiveFrom.setUTCDate(dayBeforeEffectiveFrom.getUTCDate() - 1);

    const previousEffectiveTo =
      currentVersion.effectiveTo &&
      currentVersion.effectiveTo < dayBeforeEffectiveFrom
        ? currentVersion.effectiveTo
        : dayBeforeEffectiveFrom;

    const config = this.buildPayrollSetupConfig(
      input.standardWorkMinutesPerDay,
      input.philHealthDailyWorkerScheduleDaysPerWeek,
      {
        regionCode: input.minimumWageRegionCode,
        wageOrderCode: input.minimumWageOrderCode,
        areaClassification: input.minimumWageAreaClassification,
        sector: input.minimumWageSector,
        dailyRate: input.minimumWageDailyRate,
        rateEffectiveFrom: input.minimumWageRateEffectiveFrom,
      },
    );

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await transaction.companyPayrollSetupVersion.update({
          where: {
            id: currentVersion.id,
          },

          data: {
            effectiveTo: previousEffectiveTo,
          },
        });

        const version = await transaction.companyPayrollSetupVersion.create({
          data: {
            companyPayrollSetupId: setup.id,

            sourceTemplateVersionId: currentVersion.sourceTemplateVersionId,

            version: currentVersion.version + 1,

            config,

            status: ConfigStatus.ACTIVE,

            effectiveFrom,
            effectiveTo,
          },

          select: {
            id: true,
            version: true,
            status: true,
            effectiveFrom: true,
            effectiveTo: true,
            config: true,
            createdAt: true,
          },
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId,

          action: CompanyPayrollSetupAuditAction.VERSION_CREATED,

          module: COMPANY_PAYROLL_SETUP_AUDIT_MODULE,

          entityType: COMPANY_PAYROLL_SETUP_ENTITY_TYPE,

          entityId: setup.id,

          reference: company.code,

          details:
            `Created payroll setup version ${version.version} for ` +
            `${company.name} (${company.code}).`,

          metadata: {
            previousVersion: currentVersion.version,

            version: version.version,

            status: version.status,

            previousEffectiveTo: previousEffectiveTo.toISOString().slice(0, 10),

            effectiveFrom:
              version.effectiveFrom?.toISOString().slice(0, 10) ?? null,

            effectiveTo:
              version.effectiveTo?.toISOString().slice(0, 10) ?? null,

            standardWorkMinutesPerDay: input.standardWorkMinutesPerDay,

            philHealthDailyWorkerScheduleDaysPerWeek:
              input.philHealthDailyWorkerScheduleDaysPerWeek,
          },
        });

        return {
          ...setup,

          activeVersion: version,
        };
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A newer payroll setup version was created concurrently. Refresh the payroll setup and try again.',
        );
      }

      throw error;
    }
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

  private buildPayrollSetupConfig(
    standardWorkMinutesPerDay: number,
    philHealthDailyWorkerScheduleDaysPerWeek: number | undefined,

    minimumWage: {
      regionCode: string | undefined;
      wageOrderCode: string | undefined;
      areaClassification: string | undefined;
      sector: string | undefined;
      dailyRate: string | undefined;
      rateEffectiveFrom: string | undefined;
    },
  ): Prisma.InputJsonValue {
    if (
      !Number.isInteger(standardWorkMinutesPerDay) ||
      standardWorkMinutesPerDay < 1 ||
      standardWorkMinutesPerDay > 1440
    ) {
      throw new BadRequestException(
        'standardWorkMinutesPerDay must be an integer from 1 to 1440.',
      );
    }

    if (
      philHealthDailyWorkerScheduleDaysPerWeek !== undefined &&
      philHealthDailyWorkerScheduleDaysPerWeek !== 5 &&
      philHealthDailyWorkerScheduleDaysPerWeek !== 6
    ) {
      throw new BadRequestException(
        'PhilHealth daily-worker schedule must be either 5 or 6 days per week.',
      );
    }

    const minimumWageReferenceValues = [
      minimumWage.regionCode,
      minimumWage.wageOrderCode,
      minimumWage.areaClassification,
      minimumWage.sector,
    ];

    const hasMinimumWageDailyRate = minimumWage.dailyRate !== undefined;

    const hasMinimumWageEffectiveDate =
      minimumWage.rateEffectiveFrom !== undefined;

    const hasMinimumWageCore =
      hasMinimumWageDailyRate && hasMinimumWageEffectiveDate;

    const hasAnyMinimumWageReference = minimumWageReferenceValues.some(
      (value) => value !== undefined,
    );

    if (hasMinimumWageDailyRate !== hasMinimumWageEffectiveDate) {
      throw new BadRequestException(
        'Minimum-wage configuration must include both daily rate and rate effective date.',
      );
    }

    if (hasAnyMinimumWageReference && !hasMinimumWageCore) {
      throw new BadRequestException(
        'Minimum-wage daily rate and rate effective date are required when reference information is supplied.',
      );
    }

    if (hasMinimumWageCore) {
      if (
        minimumWageReferenceValues.some(
          (value) => value !== undefined && value.trim().length === 0,
        )
      ) {
        throw new BadRequestException(
          'Minimum-wage reference fields must not be blank when supplied.',
        );
      }

      if (
        !/^\d+(?:\.\d{1,2})?$/.test(minimumWage.dailyRate!) ||
        Number(minimumWage.dailyRate) <= 0
      ) {
        throw new BadRequestException(
          'Minimum-wage daily rate must be a positive monetary amount with at most 2 decimal places.',
        );
      }

      /*
       * Reuse the normal calendar-date parser so direct service
       * calls receive the same protection as HTTP DTO validation.
       */
      this.parseDate(
        minimumWage.rateEffectiveFrom,
        'minimumWageRateEffectiveFrom',
      );
    }

    const statutory = {
      ...(philHealthDailyWorkerScheduleDaysPerWeek !== undefined
        ? {
            philHealth: {
              dailyWorkerScheduleDaysPerWeek:
                philHealthDailyWorkerScheduleDaysPerWeek,
            },
          }
        : {}),

      ...(hasMinimumWageCore
        ? {
            minimumWage: {
              ...(minimumWage.regionCode !== undefined
                ? {
                    regionCode: minimumWage.regionCode.trim(),
                  }
                : {}),

              ...(minimumWage.wageOrderCode !== undefined
                ? {
                    wageOrderCode: minimumWage.wageOrderCode.trim(),
                  }
                : {}),

              ...(minimumWage.areaClassification !== undefined
                ? {
                    areaClassification: minimumWage.areaClassification.trim(),
                  }
                : {}),

              ...(minimumWage.sector !== undefined
                ? {
                    sector: minimumWage.sector.trim(),
                  }
                : {}),

              dailyRate: minimumWage.dailyRate!,
              rateEffectiveFrom: minimumWage.rateEffectiveFrom!,
            },
          }
        : {}),
    };

    return {
      attendance: {
        standardWorkMinutesPerDay,
      },

      ...(Object.keys(statutory).length > 0
        ? {
            statutory,
          }
        : {}),
    };
  }

  private parseDate(value: string | undefined, fieldName: string): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        `${fieldName} must be a valid calendar date.`,
      );
    }

    return parsed;
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
