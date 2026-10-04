import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConfigStatus,
  PayrollCompensationSource,
  Prisma,
  type PayBasis,
} from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import {
  resolvePhilippineMinimumWageClassificationAtDate,
  type PhilippineMinimumWageClassification,
  type PhilippineMinimumWageReference,
} from '../payroll/philippine-minimum-wage-policy';
import type { SetCompensationDto } from './dto/set-compensation.dto';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';

export interface EmployeeCompensationView {
  id: string;
  employmentRecordId: string;

  payBasis: PayBasis;

  rate: string;

  effectiveFrom: Date;
  effectiveTo: Date | null;

  createdAt: Date;
}

export interface EmployeeEffectiveCompensationView {
  asOfDate: string;

  employmentRecordId: string;
  companyId: string;

  source: PayrollCompensationSource | null;

  payBasis: PayBasis | null;
  rate: string | null;

  effectiveFrom: Date | null;
  effectiveTo: Date | null;

  classification: PhilippineMinimumWageClassification;

  minimumWage: PhilippineMinimumWageReference | null;

  classificationReason: string | null;
}

@Injectable()
export class EmployeeCompensationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getCurrentCompensation(
    employeeId: string,
  ): Promise<EmployeeCompensationView | null> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        employmentRecords: {
          where: {
            endDate: null,
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentEmployment = employee.employmentRecords[0];

    if (!currentEmployment) {
      throw new NotFoundException('Current employment assignment not found.');
    }

    const compensation = await this.prisma.compensationRecord.findFirst({
      where: {
        employmentRecordId: currentEmployment.id,

        effectiveTo: null,
      },

      orderBy: {
        effectiveFrom: 'desc',
      },

      select: {
        id: true,
        employmentRecordId: true,

        payBasis: true,
        rate: true,

        effectiveFrom: true,
        effectiveTo: true,

        createdAt: true,
      },
    });

    if (!compensation) {
      return null;
    }

    return {
      id: compensation.id,

      employmentRecordId: compensation.employmentRecordId,

      payBasis: compensation.payBasis,

      rate: compensation.rate.toString(),

      effectiveFrom: compensation.effectiveFrom,

      effectiveTo: compensation.effectiveTo,

      createdAt: compensation.createdAt,
    };
  }

  async getEffectiveCompensation(
    employeeId: string,
  ): Promise<EmployeeEffectiveCompensationView> {
    const asOfDate = this.getPhilippineBusinessDate();
    const asOfDateString = this.toDateString(asOfDate);

    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,

        employmentRecords: {
          where: {
            startDate: {
              lte: asOfDate,
            },

            OR: [
              {
                endDate: null,
              },
              {
                endDate: {
                  gt: asOfDate,
                },
              },
            ],
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,

            company: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const employment = employee.employmentRecords[0];

    if (!employment) {
      throw new NotFoundException(
        'No employment assignment is effective on the current business date.',
      );
    }

    const employeeCompensation = await this.prisma.compensationRecord.findFirst(
      {
        where: {
          employmentRecordId: employment.id,

          effectiveFrom: {
            lte: asOfDate,
          },

          OR: [
            {
              effectiveTo: null,
            },
            {
              effectiveTo: {
                gt: asOfDate,
              },
            },
          ],
        },

        orderBy: {
          effectiveFrom: 'desc',
        },

        select: {
          id: true,

          payBasis: true,
          rate: true,

          effectiveFrom: true,
          effectiveTo: true,
        },
      },
    );

    const companyCompensation = employeeCompensation
      ? null
      : await this.prisma.companyCompensationRecord.findFirst({
          where: {
            companyId: employment.company.id,

            effectiveFrom: {
              lte: asOfDate,
            },

            OR: [
              {
                effectiveTo: null,
              },
              {
                effectiveTo: {
                  gt: asOfDate,
                },
              },
            ],
          },

          orderBy: {
            effectiveFrom: 'desc',
          },

          select: {
            id: true,

            payBasis: true,
            rate: true,

            effectiveFrom: true,
            effectiveTo: true,
          },
        });

    const compensation = employeeCompensation ?? companyCompensation;

    if (!compensation) {
      return {
        asOfDate: asOfDateString,

        employmentRecordId: employment.id,
        companyId: employment.company.id,

        source: null,

        payBasis: null,
        rate: null,

        effectiveFrom: null,
        effectiveTo: null,

        classification: 'UNRESOLVED',

        minimumWage: null,

        classificationReason:
          'No employee compensation override or company standard compensation is effective on the current business date.',
      };
    }

    const source = employeeCompensation
      ? PayrollCompensationSource.EMPLOYEE_OVERRIDE
      : PayrollCompensationSource.COMPANY_STANDARD;

    const setup = await this.prisma.companyPayrollSetup.findUnique({
      where: {
        companyId: employment.company.id,
      },

      select: {
        id: true,
      },
    });

    const setupVersion = setup
      ? await this.prisma.companyPayrollSetupVersion.findFirst({
          where: {
            companyPayrollSetupId: setup.id,

            status: ConfigStatus.ACTIVE,

            AND: [
              {
                OR: [
                  {
                    effectiveFrom: null,
                  },
                  {
                    effectiveFrom: {
                      lte: asOfDate,
                    },
                  },
                ],
              },
              {
                OR: [
                  {
                    effectiveTo: null,
                  },
                  {
                    effectiveTo: {
                      gte: asOfDate,
                    },
                  },
                ],
              },
            ],
          },

          orderBy: {
            version: 'desc',
          },

          select: {
            config: true,
          },
        })
      : null;

    const configSnapshot =
      setupVersion &&
      setupVersion.config !== null &&
      !Array.isArray(setupVersion.config) &&
      typeof setupVersion.config === 'object'
        ? (setupVersion.config as Readonly<Record<string, unknown>>)
        : {};

    const classification = resolvePhilippineMinimumWageClassificationAtDate({
      payBasis: compensation.payBasis,

      baseRate: compensation.rate.toString(),

      asOfDate: asOfDateString,

      configSnapshot,
    });

    return {
      asOfDate: asOfDateString,

      employmentRecordId: employment.id,
      companyId: employment.company.id,

      source,

      payBasis: compensation.payBasis,
      rate: compensation.rate.toString(),

      effectiveFrom: compensation.effectiveFrom,
      effectiveTo: compensation.effectiveTo,

      classification: classification.classification,

      minimumWage: classification.minimumWage,

      classificationReason: classification.reason,
    };
  }

  async setCompensation(
    employeeId: string,
    input: SetCompensationDto,
    actorUserId: string,
  ): Promise<EmployeeCompensationView> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,

        employmentRecords: {
          where: {
            endDate: null,
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,
            startDate: true,

            company: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentEmployment = employee.employmentRecords[0];

    if (!currentEmployment) {
      throw new NotFoundException('Current employment assignment not found.');
    }

    const effectiveFrom = new Date(input.effectiveFrom);

    if (effectiveFrom < currentEmployment.startDate) {
      throw new BadRequestException(
        'Compensation effective date cannot be before the current employment start date.',
      );
    }

    const currentCompensation = await this.prisma.compensationRecord.findFirst({
      where: {
        employmentRecordId: currentEmployment.id,

        effectiveTo: null,
      },

      orderBy: {
        effectiveFrom: 'desc',
      },

      select: {
        id: true,
        payBasis: true,
        rate: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
      },
    });

    if (
      currentCompensation &&
      effectiveFrom <= currentCompensation.effectiveFrom
    ) {
      throw new BadRequestException(
        'New compensation effective date must be after the current compensation effective date.',
      );
    }

    const rate = new Prisma.Decimal(input.rate);

    if (
      currentCompensation &&
      currentCompensation.payBasis === input.payBasis &&
      currentCompensation.rate.equals(rate)
    ) {
      throw new BadRequestException(
        'New compensation must change the pay basis or rate.',
      );
    }

    const compensation = await this.prisma.$transaction(async (transaction) => {
      if (currentCompensation) {
        await transaction.compensationRecord.update({
          where: {
            id: currentCompensation.id,
          },

          data: {
            effectiveTo: effectiveFrom,
          },
        });
      }

      const createdCompensation = await transaction.compensationRecord.create({
        data: {
          employmentRecordId: currentEmployment.id,

          payBasis: input.payBasis,

          rate,

          effectiveFrom,
        },

        select: {
          id: true,
          employmentRecordId: true,

          payBasis: true,
          rate: true,

          effectiveFrom: true,
          effectiveTo: true,

          createdAt: true,
        },
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId: currentEmployment.company.id,

        action: EmployeeManagementAuditAction.COMPENSATION_CHANGED,

        module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

        entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

        entityId: employee.id,

        reference: employee.employeeNumber,

        details: `Updated compensation for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}).`,

        metadata: {
          employmentRecordId: currentEmployment.id,

          previousCompensationId: currentCompensation?.id ?? null,

          newCompensationId: createdCompensation.id,

          payBasis: createdCompensation.payBasis,

          rate: createdCompensation.rate.toString(),

          effectiveFrom: input.effectiveFrom,
        },
      });

      return createdCompensation;
    });

    return {
      id: compensation.id,

      employmentRecordId: compensation.employmentRecordId,

      payBasis: compensation.payBasis,

      rate: compensation.rate.toString(),

      effectiveFrom: compensation.effectiveFrom,

      effectiveTo: compensation.effectiveTo,

      createdAt: compensation.createdAt,
    };
  }

  private getPhilippineBusinessDate(): Date {
    const dateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = Number(dateParts.find((part) => part.type === 'year')?.value);

    const month = Number(
      dateParts.find((part) => part.type === 'month')?.value,
    );

    const day = Number(dateParts.find((part) => part.type === 'day')?.value);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day)
    ) {
      throw new Error(
        'Unable to resolve the Philippine payroll business date.',
      );
    }

    return new Date(Date.UTC(year, month - 1, day));
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
