import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollCutoffStatus, Prisma, type PayBasis } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import {
  COMPANY_COMPENSATION_AUDIT_MODULE,
  COMPANY_COMPENSATION_ENTITY_TYPE,
  CompanyCompensationAuditAction,
} from './company-compensation-audit.constants';
import type { ChangeCompanyCompensationDto } from './dto/change-company-compensation.dto';
import type { CreateCompanyCompensationDto } from './dto/create-company-compensation.dto';

const COMPANY_COMPENSATION_SELECT = {
  id: true,
  companyId: true,
  payBasis: true,
  rate: true,
  effectiveFrom: true,
  effectiveTo: true,
  createdAt: true,
} satisfies Prisma.CompanyCompensationRecordSelect;

type CompanyCompensationRecord = Prisma.CompanyCompensationRecordGetPayload<{
  select: typeof COMPANY_COMPENSATION_SELECT;
}>;

export interface CompanyCompensationView {
  id: string;
  companyId: string;

  payBasis: PayBasis;
  rate: string;

  effectiveFrom: Date;
  effectiveTo: Date | null;

  createdAt: Date;
}

@Injectable()
export class CompanyCompensationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getLatestCompanyCompensation(
    companyId: string,
  ): Promise<CompanyCompensationView | null> {
    await this.getCompanyOrThrow(companyId);

    const compensation = await this.prisma.companyCompensationRecord.findFirst({
      where: {
        companyId,
        effectiveTo: null,
      },

      orderBy: {
        effectiveFrom: 'desc',
      },

      select: COMPANY_COMPENSATION_SELECT,
    });

    return compensation ? this.toView(compensation) : null;
  }

  async listCompanyCompensationHistory(
    companyId: string,
  ): Promise<CompanyCompensationView[]> {
    await this.getCompanyOrThrow(companyId);

    const history = await this.prisma.companyCompensationRecord.findMany({
      where: {
        companyId,
      },

      select: COMPANY_COMPENSATION_SELECT,

      orderBy: [
        {
          effectiveFrom: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    return history.map((compensation) => this.toView(compensation));
  }

  async createInitialCompanyCompensation(
    companyId: string,
    input: CreateCompanyCompensationDto,
    actorUserId: string,
  ): Promise<CompanyCompensationView> {
    const company = await this.getCompanyOrThrow(companyId);

    const existing = await this.prisma.companyCompensationRecord.findFirst({
      where: {
        companyId,
      },

      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Company standard compensation is already configured.',
      );
    }

    const effectiveFrom = this.parseDate(input.effectiveFrom, 'effectiveFrom');

    const rate = new Prisma.Decimal(input.rate);

    const compensation = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.companyCompensationRecord.create({
        data: {
          companyId,

          payBasis: input.payBasis,
          rate,

          effectiveFrom,
        },

        select: COMPANY_COMPENSATION_SELECT,
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId,

        action: CompanyCompensationAuditAction.CREATED,

        module: COMPANY_COMPENSATION_AUDIT_MODULE,

        entityType: COMPANY_COMPENSATION_ENTITY_TYPE,

        entityId: created.id,

        reference: company.code,

        details:
          `Created company standard compensation for ` +
          `${company.name} (${company.code}).`,

        metadata: {
          payBasis: created.payBasis,
          rate: created.rate.toString(),
          effectiveFrom: created.effectiveFrom.toISOString().slice(0, 10),
        },
      });

      return created;
    });

    return this.toView(compensation);
  }

  async createNextCompanyCompensationVersion(
    companyId: string,
    input: ChangeCompanyCompensationDto,
    actorUserId: string,
  ): Promise<CompanyCompensationView> {
    const company = await this.getCompanyOrThrow(companyId);

    const current = await this.prisma.companyCompensationRecord.findFirst({
      where: {
        companyId,
        effectiveTo: null,
      },

      orderBy: {
        effectiveFrom: 'desc',
      },

      select: COMPANY_COMPENSATION_SELECT,
    });

    if (!current) {
      throw new BadRequestException(
        'Company standard compensation must be configured before creating a new version.',
      );
    }

    const rate = new Prisma.Decimal(input.rate);

    if (current.payBasis === input.payBasis && current.rate.equals(rate)) {
      throw new BadRequestException(
        'New company compensation must change the pay basis or rate.',
      );
    }

    const today = this.getPhilippineBusinessDate();

    const nextCutoff = await this.prisma.payrollCutoff.findFirst({
      where: {
        companyId,

        status: PayrollCutoffStatus.OPEN,

        startDate: {
          gt: today,
        },
      },

      orderBy: {
        startDate: 'asc',
      },

      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!nextCutoff) {
      throw new BadRequestException(
        'The next OPEN payroll cutoff must be generated before changing the company standard compensation.',
      );
    }

    if (nextCutoff.startDate <= current.effectiveFrom) {
      throw new ConflictException(
        'The current company compensation is already effective on or after the next payroll cutoff start date.',
      );
    }

    const compensation = await this.prisma.$transaction(async (transaction) => {
      const currentUpdate =
        await transaction.companyCompensationRecord.updateMany({
          where: {
            id: current.id,
            effectiveTo: null,
          },

          data: {
            effectiveTo: nextCutoff.startDate,
          },
        });

      if (currentUpdate.count !== 1) {
        throw new ConflictException(
          'Company standard compensation changed concurrently. Refresh and try again.',
        );
      }

      const created = await transaction.companyCompensationRecord.create({
        data: {
          companyId,

          payBasis: input.payBasis,
          rate,

          effectiveFrom: nextCutoff.startDate,
        },

        select: COMPANY_COMPENSATION_SELECT,
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId,

        action: CompanyCompensationAuditAction.VERSION_CREATED,

        module: COMPANY_COMPENSATION_AUDIT_MODULE,

        entityType: COMPANY_COMPENSATION_ENTITY_TYPE,

        entityId: created.id,

        reference: company.code,

        details:
          `Changed company standard compensation for ` +
          `${company.name} (${company.code}) effective ` +
          `${this.toDateString(nextCutoff.startDate)}.`,

        metadata: {
          previousCompensationId: current.id,
          newCompensationId: created.id,

          previousPayBasis: current.payBasis,
          previousRate: current.rate.toString(),

          payBasis: created.payBasis,
          rate: created.rate.toString(),

          effectiveFrom: this.toDateString(created.effectiveFrom),

          payrollCutoffId: nextCutoff.id,
          payrollCutoffStartDate: this.toDateString(nextCutoff.startDate),
          payrollCutoffEndDate: this.toDateString(nextCutoff.endDate),
        },
      });

      return created;
    });

    return this.toView(compensation);
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

  private parseDate(value: string, fieldName: string): Date {
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

  private toView(
    compensation: CompanyCompensationRecord,
  ): CompanyCompensationView {
    return {
      id: compensation.id,
      companyId: compensation.companyId,

      payBasis: compensation.payBasis,
      rate: compensation.rate.toString(),

      effectiveFrom: compensation.effectiveFrom,
      effectiveTo: compensation.effectiveTo,

      createdAt: compensation.createdAt,
    };
  }
}
