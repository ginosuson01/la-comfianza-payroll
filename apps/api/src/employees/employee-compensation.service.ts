import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PayBasis } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
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

@Injectable()
export class EmployeeCompensationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

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
}
