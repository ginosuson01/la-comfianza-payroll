import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeePayrollStatus, type Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import type { ChangeEmployeeStatusDto } from './dto/change-employee-status.dto';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';

export interface EmployeeStatusChangeView {
  employeeId: string;
  employeeNumber: string;

  previousStatus: EmployeePayrollStatus;
  currentStatus: EmployeePayrollStatus;

  effectiveDate: Date;

  statusHistoryId: string;
  changedAt: Date;
}

@Injectable()
export class EmployeeStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async changeStatus(
    employeeId: string,
    input: ChangeEmployeeStatusDto,
    actorUserId: string,
  ): Promise<EmployeeStatusChangeView> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,
        employeeNumber: true,

        firstName: true,
        lastName: true,

        currentStatus: true,

        employmentRecords: {
          where: {
            endDate: null,
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
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

    if (employee.currentStatus === input.status) {
      throw new BadRequestException(`Employee is already ${input.status}.`);
    }

    const effectiveDate = new Date(input.effectiveDate);

    const latestStatusHistory =
      await this.prisma.employeeStatusHistory.findFirst({
        where: {
          employeeId,
        },

        orderBy: [
          {
            effectiveDate: 'desc',
          },
          {
            changedAt: 'desc',
          },
        ],

        select: {
          effectiveDate: true,
          newStatus: true,
        },
      });

    if (
      latestStatusHistory &&
      effectiveDate < latestStatusHistory.effectiveDate
    ) {
      throw new BadRequestException(
        'Status effective date cannot be before the latest employee status effective date.',
      );
    }

    const previousStatus = employee.currentStatus;

    const currentEmployment = employee.employmentRecords[0];

    const result = await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        await transaction.employee.update({
          where: {
            id: employeeId,
          },

          data: {
            currentStatus: input.status,
          },
        });

        const statusHistory = await transaction.employeeStatusHistory.create({
          data: {
            employeeId,

            previousStatus,

            newStatus: input.status,

            effectiveDate,

            changedByUserId: actorUserId,
          },

          select: {
            id: true,
            effectiveDate: true,
            changedAt: true,
          },
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          ...(currentEmployment
            ? {
                companyId: currentEmployment.company.id,
              }
            : {}),

          action: EmployeeManagementAuditAction.STATUS_CHANGED,

          module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

          entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

          entityId: employee.id,

          reference: employee.employeeNumber,

          details: `Changed employee status for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) from ${previousStatus} to ${input.status}.`,

          metadata: {
            previousStatus,

            newStatus: input.status,

            effectiveDate: input.effectiveDate,

            ...(input.reason
              ? {
                  reason: input.reason,
                }
              : {}),
          },
        });

        return statusHistory;
      },
    );

    return {
      employeeId: employee.id,

      employeeNumber: employee.employeeNumber,

      previousStatus,

      currentStatus: input.status,

      effectiveDate: result.effectiveDate,

      statusHistoryId: result.id,

      changedAt: result.changedAt,
    };
  }
}
