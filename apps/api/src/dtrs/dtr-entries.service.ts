import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DtrStatus, PayrollCutoffStatus, type Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import {
  DTR_AUDIT_MODULE,
  DTR_ENTRY_ENTITY_TYPE,
  DtrAuditAction,
} from './dtr-audit.constants';
import { DtrEntryValidationService } from './dtr-entry-validation.service';
import { DtrLeaveBalanceService } from './dtr-leave-balance.service';
import type { CreateDtrEntriesBulkDto } from './dto/create-dtr-entries-bulk.dto';
import type { CreateDtrEntryDto } from './dto/create-dtr-entry.dto';
import type { UpdateDtrEntryDto } from './dto/update-dtr-entry.dto';

const DTR_ENTRY_DETAIL_SELECT = {
  id: true,
  dtrId: true,
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

  overtimeEntries: {
    orderBy: {
      type: 'asc',
    },

    select: {
      id: true,
      type: true,
      minutes: true,
      createdAt: true,
    },
  },
} satisfies Prisma.DtrEntrySelect;

export type DtrEntryDetailRecord = Prisma.DtrEntryGetPayload<{
  select: typeof DTR_ENTRY_DETAIL_SELECT;
}>;

export interface DeleteDtrEntryResult {
  deleted: true;
  entryId: string;
}

export interface CreateDtrEntriesBulkResult {
  createdCount: number;
  entries: DtrEntryDetailRecord[];
}

@Injectable()
export class DtrEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly validationService: DtrEntryValidationService,
    private readonly leaveBalanceService: DtrLeaveBalanceService,
  ) {}

  async createEntry(
    dtrId: string,
    input: CreateDtrEntryDto,
    actorUserId: string,
  ): Promise<DtrEntryDetailRecord> {
    const dtr = await this.getDtrContext(dtrId);

    this.assertCutoffEditable(dtr.payrollCutoff.status);
    this.assertDtrAttendanceEditable(dtr.status);

    const workDate = new Date(input.workDate);

    this.assertWorkDateInsideCutoff(
      workDate,
      dtr.payrollCutoff.startDate,
      dtr.payrollCutoff.endDate,
    );

    const existingEntry = await this.prisma.dtrEntry.findFirst({
      where: {
        dtrId,
        workDate,
      },

      select: {
        id: true,
      },
    });

    if (existingEntry) {
      throw new ConflictException(
        'A DTR entry already exists for this work date.',
      );
    }

    await this.validationService.validateEntry({
      dtrId: dtr.id,
      employeeId: dtr.employeeId,
      companyId: dtr.companyId,

      entryId: null,

      workDate,

      regularMinutes: input.regularMinutes,
      lateMinutes: input.lateMinutes,
      undertimeMinutes: input.undertimeMinutes,
      absenceMinutes: input.absenceMinutes,
      leaveMinutes: input.leaveMinutes,
      nightDifferentialMinutes: input.nightDifferentialMinutes,

      restDay: input.restDay,

      leaveTypeId: input.leaveTypeId ?? null,

      holidayId: input.holidayId ?? null,

      overtimeEntries: input.overtimeEntries ?? [],
    });

    const entry = await this.prisma.$transaction(async (transaction) => {
      const createdEntry = await transaction.dtrEntry.create({
        data: {
          dtrId,

          workDate,

          regularMinutes: input.regularMinutes,

          lateMinutes: input.lateMinutes,

          undertimeMinutes: input.undertimeMinutes,

          absenceMinutes: input.absenceMinutes,

          leaveMinutes: input.leaveMinutes,

          nightDifferentialMinutes: input.nightDifferentialMinutes,

          restDay: input.restDay,

          leaveTypeId: input.leaveTypeId ?? null,

          holidayId: input.holidayId ?? null,

          notes: input.notes ?? null,

          overtimeEntries: {
            create: (input.overtimeEntries ?? []).map((overtime) => ({
              type: overtime.type,

              minutes: overtime.minutes,
            })),
          },
        },

        select: DTR_ENTRY_DETAIL_SELECT,
      });

      if (createdEntry.leaveTypeId && createdEntry.leaveMinutes > 0) {
        await this.leaveBalanceService.applyUsageInTransaction(transaction, {
          employeeId: dtr.employeeId,

          companyId: dtr.companyId,

          leaveTypeId: createdEntry.leaveTypeId,

          leaveMinutes: createdEntry.leaveMinutes,

          workDate: createdEntry.workDate,

          entryId: createdEntry.id,

          actorUserId,
        });
      }

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,
        companyId: dtr.companyId,

        action: DtrAuditAction.ENTRY_CREATED,

        module: DTR_AUDIT_MODULE,

        entityType: DTR_ENTRY_ENTITY_TYPE,

        entityId: createdEntry.id,

        reference: this.toDateString(createdEntry.workDate),

        details: `Created DTR entry for ${this.toDateString(
          createdEntry.workDate,
        )}.`,

        metadata: {
          dtrId,

          employeeId: dtr.employeeId,

          payrollCutoffId: dtr.payrollCutoff.id,

          workDate: this.toDateString(createdEntry.workDate),
        },
      });

      return createdEntry;
    });

    return entry;
  }

  async createEntriesBulk(
    dtrId: string,
    input: CreateDtrEntriesBulkDto,
    actorUserId: string,
  ): Promise<CreateDtrEntriesBulkResult> {
    const dtr = await this.getDtrContext(dtrId);

    this.assertCutoffEditable(dtr.payrollCutoff.status);
    this.assertDtrAttendanceEditable(dtr.status);

    if (input.workDates.length === 0) {
      throw new BadRequestException('At least one work date is required.');
    }

    const workDates = input.workDates.map((workDate) => new Date(workDate));

    const normalizedWorkDates = workDates.map((workDate) =>
      this.toDateString(workDate),
    );

    if (new Set(normalizedWorkDates).size !== normalizedWorkDates.length) {
      throw new BadRequestException(
        'Duplicate work dates are not allowed in a bulk attendance request.',
      );
    }

    for (const workDate of workDates) {
      this.assertWorkDateInsideCutoff(
        workDate,
        dtr.payrollCutoff.startDate,
        dtr.payrollCutoff.endDate,
      );
    }

    const existingEntries = await this.prisma.dtrEntry.findMany({
      where: {
        dtrId,

        workDate: {
          in: workDates,
        },
      },

      select: {
        workDate: true,
      },

      orderBy: {
        workDate: 'asc',
      },
    });

    if (existingEntries.length > 0) {
      const duplicateDates = existingEntries
        .map((entry) => this.toDateString(entry.workDate))
        .join(', ');

      throw new ConflictException(
        `DTR entries already exist for these work dates: ${duplicateDates}.`,
      );
    }

    for (const workDate of workDates) {
      await this.validationService.validateEntry({
        dtrId: dtr.id,
        employeeId: dtr.employeeId,
        companyId: dtr.companyId,

        entryId: null,

        workDate,

        regularMinutes: input.regularMinutes,
        lateMinutes: input.lateMinutes,
        undertimeMinutes: input.undertimeMinutes,
        absenceMinutes: input.absenceMinutes,
        leaveMinutes: input.leaveMinutes,
        nightDifferentialMinutes: input.nightDifferentialMinutes,

        restDay: input.restDay,

        leaveTypeId: input.leaveTypeId ?? null,

        holidayId: input.holidayId ?? null,

        overtimeEntries: input.overtimeEntries ?? [],
      });
    }

    const entries = await this.prisma.$transaction(async (transaction) => {
      const createdEntries: DtrEntryDetailRecord[] = [];

      for (const workDate of workDates) {
        const createdEntry = await transaction.dtrEntry.create({
          data: {
            dtrId,

            workDate,

            regularMinutes: input.regularMinutes,

            lateMinutes: input.lateMinutes,

            undertimeMinutes: input.undertimeMinutes,

            absenceMinutes: input.absenceMinutes,

            leaveMinutes: input.leaveMinutes,

            nightDifferentialMinutes: input.nightDifferentialMinutes,

            restDay: input.restDay,

            leaveTypeId: input.leaveTypeId ?? null,

            holidayId: input.holidayId ?? null,

            notes: input.notes ?? null,

            overtimeEntries: {
              create: (input.overtimeEntries ?? []).map((overtime) => ({
                type: overtime.type,

                minutes: overtime.minutes,
              })),
            },
          },

          select: DTR_ENTRY_DETAIL_SELECT,
        });

        if (createdEntry.leaveTypeId && createdEntry.leaveMinutes > 0) {
          await this.leaveBalanceService.applyUsageInTransaction(transaction, {
            employeeId: dtr.employeeId,

            companyId: dtr.companyId,

            leaveTypeId: createdEntry.leaveTypeId,

            leaveMinutes: createdEntry.leaveMinutes,

            workDate: createdEntry.workDate,

            entryId: createdEntry.id,

            actorUserId,
          });
        }

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,
          companyId: dtr.companyId,

          action: DtrAuditAction.ENTRY_CREATED,

          module: DTR_AUDIT_MODULE,

          entityType: DTR_ENTRY_ENTITY_TYPE,

          entityId: createdEntry.id,

          reference: this.toDateString(createdEntry.workDate),

          details: `Created DTR entry for ${this.toDateString(
            createdEntry.workDate,
          )}.`,

          metadata: {
            dtrId,

            employeeId: dtr.employeeId,

            payrollCutoffId: dtr.payrollCutoff.id,

            workDate: this.toDateString(createdEntry.workDate),

            bulkCreate: true,
            bulkSize: workDates.length,
          },
        });

        createdEntries.push(createdEntry);
      }

      return createdEntries;
    });

    return {
      createdCount: entries.length,

      entries,
    };
  }

  async updateEntry(
    dtrId: string,
    entryId: string,
    input: UpdateDtrEntryDto,
    actorUserId: string,
  ): Promise<DtrEntryDetailRecord> {
    const entryContext = await this.getEntryContext(dtrId, entryId);

    this.assertCutoffEditable(entryContext.dtr.payrollCutoff.status);
    this.assertDtrAttendanceEditable(entryContext.dtr.status);

    let workDate: Date | undefined;

    if (input.workDate !== undefined) {
      workDate = new Date(input.workDate);

      this.assertWorkDateInsideCutoff(
        workDate,
        entryContext.dtr.payrollCutoff.startDate,
        entryContext.dtr.payrollCutoff.endDate,
      );

      const conflictingEntry = await this.prisma.dtrEntry.findFirst({
        where: {
          dtrId,
          workDate,

          id: {
            not: entryId,
          },
        },

        select: {
          id: true,
        },
      });

      if (conflictingEntry) {
        throw new ConflictException(
          'A DTR entry already exists for this work date.',
        );
      }
    }

    const finalWorkDate = workDate ?? entryContext.workDate;

    const finalRegularMinutes =
      input.regularMinutes ?? entryContext.regularMinutes;

    const finalLateMinutes = input.lateMinutes ?? entryContext.lateMinutes;

    const finalUndertimeMinutes =
      input.undertimeMinutes ?? entryContext.undertimeMinutes;

    const finalAbsenceMinutes =
      input.absenceMinutes ?? entryContext.absenceMinutes;

    const finalLeaveMinutes = input.leaveMinutes ?? entryContext.leaveMinutes;

    const finalNightDifferentialMinutes =
      input.nightDifferentialMinutes ?? entryContext.nightDifferentialMinutes;

    const finalRestDay = input.restDay ?? entryContext.restDay;

    const finalLeaveTypeId =
      input.leaveTypeId !== undefined
        ? input.leaveTypeId
        : entryContext.leaveTypeId;

    const finalHolidayId =
      input.holidayId !== undefined ? input.holidayId : entryContext.holidayId;

    const finalOvertimeEntries =
      input.overtimeEntries !== undefined
        ? input.overtimeEntries
        : entryContext.overtimeEntries.map((overtime) => ({
            type: overtime.type,

            minutes: overtime.minutes,
          }));

    await this.validationService.validateEntry({
      dtrId: entryContext.dtr.id,

      employeeId: entryContext.dtr.employeeId,

      companyId: entryContext.dtr.companyId,

      entryId: entryContext.id,

      workDate: finalWorkDate,

      regularMinutes: finalRegularMinutes,
      lateMinutes: finalLateMinutes,
      undertimeMinutes: finalUndertimeMinutes,
      absenceMinutes: finalAbsenceMinutes,
      leaveMinutes: finalLeaveMinutes,
      nightDifferentialMinutes: finalNightDifferentialMinutes,

      restDay: finalRestDay,

      leaveTypeId: finalLeaveTypeId,

      holidayId: finalHolidayId,

      overtimeEntries: finalOvertimeEntries,
    });

    const leaveLedgerChanged =
      finalWorkDate.getTime() !== entryContext.workDate.getTime() ||
      finalLeaveMinutes !== entryContext.leaveMinutes ||
      finalLeaveTypeId !== entryContext.leaveTypeId;

    const updatedEntry = await this.prisma.$transaction(async (transaction) => {
      if (
        leaveLedgerChanged &&
        entryContext.leaveTypeId &&
        entryContext.leaveMinutes > 0
      ) {
        await this.leaveBalanceService.reverseUsageInTransaction(transaction, {
          employeeId: entryContext.dtr.employeeId,

          companyId: entryContext.dtr.companyId,

          leaveTypeId: entryContext.leaveTypeId,

          leaveMinutes: entryContext.leaveMinutes,

          workDate: entryContext.workDate,

          entryId: entryContext.id,

          actorUserId,
        });
      }

      if (input.overtimeEntries !== undefined) {
        await transaction.overtimeEntry.deleteMany({
          where: {
            dtrEntryId: entryId,
          },
        });
      }

      await transaction.dtrEntry.update({
        where: {
          id: entryId,
        },

        data: {
          ...(workDate !== undefined
            ? {
                workDate,
              }
            : {}),

          ...(input.regularMinutes !== undefined
            ? {
                regularMinutes: input.regularMinutes,
              }
            : {}),

          ...(input.lateMinutes !== undefined
            ? {
                lateMinutes: input.lateMinutes,
              }
            : {}),

          ...(input.undertimeMinutes !== undefined
            ? {
                undertimeMinutes: input.undertimeMinutes,
              }
            : {}),

          ...(input.absenceMinutes !== undefined
            ? {
                absenceMinutes: input.absenceMinutes,
              }
            : {}),

          ...(input.leaveMinutes !== undefined
            ? {
                leaveMinutes: input.leaveMinutes,
              }
            : {}),

          ...(input.nightDifferentialMinutes !== undefined
            ? {
                nightDifferentialMinutes: input.nightDifferentialMinutes,
              }
            : {}),

          ...(input.restDay !== undefined
            ? {
                restDay: input.restDay,
              }
            : {}),

          ...(input.leaveTypeId !== undefined
            ? {
                leaveTypeId: input.leaveTypeId,
              }
            : {}),

          ...(input.holidayId !== undefined
            ? {
                holidayId: input.holidayId,
              }
            : {}),

          ...(input.notes !== undefined
            ? {
                notes: input.notes,
              }
            : {}),
        },
      });

      if (
        input.overtimeEntries !== undefined &&
        input.overtimeEntries.length > 0
      ) {
        await transaction.overtimeEntry.createMany({
          data: input.overtimeEntries.map((overtime) => ({
            dtrEntryId: entryId,

            type: overtime.type,

            minutes: overtime.minutes,
          })),
        });
      }

      if (leaveLedgerChanged && finalLeaveTypeId && finalLeaveMinutes > 0) {
        await this.leaveBalanceService.applyUsageInTransaction(transaction, {
          employeeId: entryContext.dtr.employeeId,

          companyId: entryContext.dtr.companyId,

          leaveTypeId: finalLeaveTypeId,

          leaveMinutes: finalLeaveMinutes,

          workDate: finalWorkDate,

          entryId: entryContext.id,

          actorUserId,
        });
      }

      const refreshedEntry = await transaction.dtrEntry.findUnique({
        where: {
          id: entryId,
        },

        select: DTR_ENTRY_DETAIL_SELECT,
      });

      if (!refreshedEntry) {
        throw new NotFoundException('DTR entry not found.');
      }

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId: entryContext.dtr.companyId,

        action: DtrAuditAction.ENTRY_UPDATED,

        module: DTR_AUDIT_MODULE,

        entityType: DTR_ENTRY_ENTITY_TYPE,

        entityId: refreshedEntry.id,

        reference: this.toDateString(refreshedEntry.workDate),

        details: `Updated DTR entry for ${this.toDateString(
          refreshedEntry.workDate,
        )}.`,

        metadata: {
          dtrId,

          employeeId: entryContext.dtr.employeeId,

          payrollCutoffId: entryContext.dtr.payrollCutoff.id,

          workDate: this.toDateString(refreshedEntry.workDate),
        },
      });

      return refreshedEntry;
    });

    return updatedEntry;
  }

  async deleteEntry(
    dtrId: string,
    entryId: string,
    actorUserId: string,
  ): Promise<DeleteDtrEntryResult> {
    const entryContext = await this.getEntryContext(dtrId, entryId);

    this.assertCutoffEditable(entryContext.dtr.payrollCutoff.status);
    this.assertDtrAttendanceEditable(entryContext.dtr.status);

    await this.prisma.$transaction(async (transaction) => {
      if (entryContext.leaveTypeId && entryContext.leaveMinutes > 0) {
        await this.leaveBalanceService.reverseUsageInTransaction(transaction, {
          employeeId: entryContext.dtr.employeeId,

          companyId: entryContext.dtr.companyId,

          leaveTypeId: entryContext.leaveTypeId,

          leaveMinutes: entryContext.leaveMinutes,

          workDate: entryContext.workDate,

          entryId: entryContext.id,

          actorUserId,
        });
      }

      await transaction.overtimeEntry.deleteMany({
        where: {
          dtrEntryId: entryId,
        },
      });

      await transaction.dtrEntry.delete({
        where: {
          id: entryId,
        },
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId: entryContext.dtr.companyId,

        action: DtrAuditAction.ENTRY_DELETED,

        module: DTR_AUDIT_MODULE,

        entityType: DTR_ENTRY_ENTITY_TYPE,

        entityId: entryId,

        reference: this.toDateString(entryContext.workDate),

        details: `Deleted DTR entry for ${this.toDateString(
          entryContext.workDate,
        )}.`,

        metadata: {
          dtrId,

          employeeId: entryContext.dtr.employeeId,

          payrollCutoffId: entryContext.dtr.payrollCutoff.id,

          workDate: this.toDateString(entryContext.workDate),
        },
      });
    });

    return {
      deleted: true,
      entryId,
    };
  }

  private async getDtrContext(dtrId: string) {
    const dtr = await this.prisma.dtr.findUnique({
      where: {
        id: dtrId,
      },

      select: {
        id: true,
        companyId: true,
        employeeId: true,
        status: true,

        payrollCutoff: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
    });

    if (!dtr) {
      throw new NotFoundException('DTR not found.');
    }

    return dtr;
  }

  private async getEntryContext(dtrId: string, entryId: string) {
    const entry = await this.prisma.dtrEntry.findFirst({
      where: {
        id: entryId,
        dtrId,
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

        overtimeEntries: {
          select: {
            type: true,
            minutes: true,
          },
        },

        dtr: {
          select: {
            id: true,
            companyId: true,
            employeeId: true,
            status: true,

            payrollCutoff: {
              select: {
                id: true,
                startDate: true,
                endDate: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('DTR entry not found.');
    }

    return entry;
  }

  private assertCutoffEditable(status: PayrollCutoffStatus): void {
    if (status === PayrollCutoffStatus.LOCKED) {
      throw new ConflictException(
        'Attendance cannot be modified because the payroll cutoff is locked.',
      );
    }
  }

  private assertDtrAttendanceEditable(status: DtrStatus): void {
    if (status === DtrStatus.VALIDATED) {
      throw new ConflictException(
        'Attendance cannot be modified because the DTR is validated. Return the DTR to review before editing attendance.',
      );
    }
  }

  private assertWorkDateInsideCutoff(
    workDate: Date,
    cutoffStartDate: Date,
    cutoffEndDate: Date,
  ): void {
    if (
      Number.isNaN(workDate.getTime()) ||
      workDate < cutoffStartDate ||
      workDate > cutoffEndDate
    ) {
      throw new BadRequestException(
        'DTR work date must be within the payroll cutoff period.',
      );
    }
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
