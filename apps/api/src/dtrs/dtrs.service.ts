import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DtrStatus, PayrollCutoffStatus, type Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import type { CreateDtrDto } from './dto/create-dtr.dto';
import type { ListDtrsQueryDto } from './dto/list-dtrs-query.dto';
import type { UpdateDtrStatusDto } from './dto/update-dtr-status.dto';

import {
  DTR_AUDIT_MODULE,
  DTR_ENTITY_TYPE,
  DtrAuditAction,
} from './dtr-audit.constants';

const DTR_LIST_SELECT = {
  id: true,

  companyId: true,
  employeeId: true,
  employmentRecordId: true,
  payrollCutoffId: true,

  status: true,
  validatedAt: true,

  createdAt: true,
  updatedAt: true,

  company: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },

  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
      currentStatus: true,
    },
  },

  employmentRecord: {
    select: {
      id: true,
      companyEmployeeNumber: true,
      startDate: true,
      endDate: true,

      department: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      position: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },

  payrollCutoff: {
    select: {
      id: true,
      startDate: true,
      endDate: true,
      payDate: true,
      status: true,
    },
  },

  _count: {
    select: {
      entries: true,
    },
  },
} satisfies Prisma.DtrSelect;

const DTR_DETAIL_SELECT = {
  ...DTR_LIST_SELECT,

  entries: {
    orderBy: {
      workDate: 'asc' as const,
    },

    select: {
      id: true,
      workDate: true,

      regularMinutes: true,
      lateMinutes: true,
      undertimeMinutes: true,
      absenceMinutes: true,
      leaveMinutes: true,
      nightDifferentialMinutes: true,

      restDay: true,

      leaveTypeId: true,
      holidayId: true,

      notes: true,

      createdAt: true,
      updatedAt: true,

      leaveType: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
        },
      },

      holiday: {
        select: {
          id: true,
          name: true,
          date: true,
          type: true,
        },
      },

      overtimeEntries: {
        orderBy: {
          createdAt: 'asc' as const,
        },

        select: {
          id: true,
          type: true,
          minutes: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.DtrSelect;

type DtrListRecord = Prisma.DtrGetPayload<{
  select: typeof DTR_LIST_SELECT;
}>;

export type DtrDetailRecord = Prisma.DtrGetPayload<{
  select: typeof DTR_DETAIL_SELECT;
}>;

export interface DtrListResponse {
  items: DtrListRecord[];

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class DtrsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listDtrs(query: ListDtrsQueryDto): Promise<DtrListResponse> {
    const page = query.page;
    const pageSize = query.pageSize;
    const search = query.search?.trim();

    const where: Prisma.DtrWhereInput = {};

    if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.payrollCutoffId) {
      where.payrollCutoffId = query.payrollCutoffId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (search) {
      where.OR = [
        {
          employee: {
            is: {
              employeeNumber: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          employee: {
            is: {
              firstName: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          employee: {
            is: {
              middleName: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          employee: {
            is: {
              lastName: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          employmentRecord: {
            is: {
              companyEmployeeNumber: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    const [total, dtrs] = await this.prisma.$transaction([
      this.prisma.dtr.count({
        where,
      }),

      this.prisma.dtr.findMany({
        where,

        select: DTR_LIST_SELECT,

        orderBy: [
          {
            payrollCutoff: {
              startDate: 'desc',
            },
          },
          {
            employee: {
              lastName: 'asc',
            },
          },
          {
            employee: {
              firstName: 'asc',
            },
          },
        ],

        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: dtrs,

      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getDtrById(dtrId: string): Promise<DtrDetailRecord> {
    const dtr = await this.prisma.dtr.findUnique({
      where: {
        id: dtrId,
      },

      select: DTR_DETAIL_SELECT,
    });

    if (!dtr) {
      throw new NotFoundException('DTR not found.');
    }

    return dtr;
  }

  async createDtr(
    input: CreateDtrDto,
    actorUserId: string,
  ): Promise<DtrDetailRecord> {
    const cutoff = await this.prisma.payrollCutoff.findUnique({
      where: {
        id: input.payrollCutoffId,
      },

      select: {
        id: true,
        companyId: true,
        startDate: true,
        endDate: true,
        payDate: true,
        status: true,
      },
    });

    if (!cutoff) {
      throw new NotFoundException('Payroll cutoff not found.');
    }

    if (cutoff.companyId !== input.companyId) {
      throw new BadRequestException(
        'Payroll cutoff does not belong to the selected company.',
      );
    }

    if (cutoff.status === PayrollCutoffStatus.LOCKED) {
      throw new ConflictException(
        'DTR cannot be created for a locked payroll cutoff.',
      );
    }

    const employee = await this.prisma.employee.findUnique({
      where: {
        id: input.employeeId,
      },

      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        currentStatus: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const employmentRecord = await this.prisma.employmentRecord.findFirst({
      where: {
        employeeId: input.employeeId,
        companyId: input.companyId,

        startDate: {
          lte: cutoff.endDate,
        },

        OR: [
          {
            endDate: null,
          },
          {
            endDate: {
              gte: cutoff.startDate,
            },
          },
        ],
      },

      orderBy: {
        startDate: 'desc',
      },

      select: {
        id: true,
        companyEmployeeNumber: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!employmentRecord) {
      throw new BadRequestException(
        'Employee has no applicable employment assignment for this company and payroll cutoff.',
      );
    }

    const existingDtr = await this.prisma.dtr.findUnique({
      where: {
        employeeId_payrollCutoffId: {
          employeeId: input.employeeId,
          payrollCutoffId: input.payrollCutoffId,
        },
      },

      select: {
        id: true,
      },
    });

    if (existingDtr) {
      throw new ConflictException(
        'A DTR already exists for this employee and payroll cutoff.',
      );
    }

    const fullName = [
      employee.firstName,
      employee.middleName,
      employee.lastName,
      employee.suffix,
    ]
      .filter(Boolean)
      .join(' ');

    const createdDtr = await this.prisma.$transaction(async (transaction) => {
      const dtr = await transaction.dtr.create({
        data: {
          companyId: input.companyId,
          employeeId: input.employeeId,
          employmentRecordId: employmentRecord.id,
          payrollCutoffId: input.payrollCutoffId,
        },

        select: {
          id: true,
        },
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId: input.companyId,

        action: DtrAuditAction.CREATED,

        module: DTR_AUDIT_MODULE,

        entityType: DTR_ENTITY_TYPE,

        entityId: dtr.id,

        reference: employee.employeeNumber,

        details:
          `Created DTR for ${fullName} (${employee.employeeNumber}) ` +
          `for payroll cutoff ${this.toDateString(cutoff.startDate)} ` +
          `to ${this.toDateString(cutoff.endDate)}.`,

        metadata: {
          employeeId: employee.id,
          employeeNumber: employee.employeeNumber,
          employmentRecordId: employmentRecord.id,
          payrollCutoffId: cutoff.id,
          cutoffStartDate: this.toDateString(cutoff.startDate),
          cutoffEndDate: this.toDateString(cutoff.endDate),
          payDate: this.toDateString(cutoff.payDate),
        },
      });

      return dtr;
    });

    return this.getDtrById(createdDtr.id);
  }

  async updateDtrStatus(
    dtrId: string,
    input: UpdateDtrStatusDto,
    actorUserId: string,
  ): Promise<DtrDetailRecord> {
    const currentDtr = await this.prisma.dtr.findUnique({
      where: {
        id: dtrId,
      },

      select: {
        id: true,
        companyId: true,
        employeeId: true,
        status: true,

        employee: {
          select: {
            employeeNumber: true,
          },
        },

        payrollCutoff: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!currentDtr) {
      throw new NotFoundException('DTR not found.');
    }

    if (currentDtr.payrollCutoff.status === PayrollCutoffStatus.LOCKED) {
      throw new ConflictException(
        'DTR status cannot be changed because the payroll cutoff is locked.',
      );
    }

    this.assertValidStatusTransition(currentDtr.status, input.status);

    const validatedAt =
      input.status === DtrStatus.VALIDATED ? new Date() : null;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.dtr.update({
        where: {
          id: dtrId,
        },

        data: {
          status: input.status,
          validatedAt,
        },
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,
        companyId: currentDtr.companyId,

        action:
          input.status === DtrStatus.VALIDATED
            ? DtrAuditAction.VALIDATED
            : DtrAuditAction.STATUS_CHANGED,

        module: DTR_AUDIT_MODULE,
        entityType: DTR_ENTITY_TYPE,
        entityId: currentDtr.id,

        reference: currentDtr.employee.employeeNumber,

        details:
          `Changed DTR status from ${currentDtr.status} ` +
          `to ${input.status}.`,

        metadata: {
          employeeId: currentDtr.employeeId,
          payrollCutoffId: currentDtr.payrollCutoff.id,
          previousStatus: currentDtr.status,
          newStatus: input.status,
          validatedAt: validatedAt?.toISOString() ?? null,
        },
      });
    });

    return this.getDtrById(dtrId);
  }

  private assertValidStatusTransition(
    currentStatus: DtrStatus,
    nextStatus: DtrStatus,
  ): void {
    const allowedTransitions: Record<DtrStatus, readonly DtrStatus[]> = {
      [DtrStatus.DRAFT]: [DtrStatus.FOR_REVIEW],

      [DtrStatus.FOR_REVIEW]: [
        DtrStatus.DRAFT,
        DtrStatus.VALIDATED,
        DtrStatus.LAST_PAY_REVIEW,
      ],

      [DtrStatus.LAST_PAY_REVIEW]: [DtrStatus.DRAFT, DtrStatus.VALIDATED],

      [DtrStatus.VALIDATED]: [DtrStatus.FOR_REVIEW],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid DTR status transition from ${currentStatus} to ${nextStatus}.`,
      );
    }
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
