import { Injectable, NotFoundException } from '@nestjs/common';

import {
  DtrStatus,
  type PayrollCutoffStatus,
  type Prisma,
} from '@payroll/database';

import {
  summarizeAttendance,
  type AttendanceAggregate,
  type AttendanceSummaryEntryInput,
} from '@payroll/payroll-engine';

import { PrismaService } from '../database/prisma.service';

const DTR_ATTENDANCE_SUMMARY_SELECT = {
  id: true,

  companyId: true,
  employeeId: true,
  employmentRecordId: true,
  payrollCutoffId: true,

  status: true,
  validatedAt: true,

  payrollCutoff: {
    select: {
      id: true,
      startDate: true,
      endDate: true,
      payDate: true,
      status: true,
    },
  },

  entries: {
    orderBy: {
      workDate: 'asc' as const,
    },

    select: {
      workDate: true,

      regularMinutes: true,
      lateMinutes: true,
      undertimeMinutes: true,
      absenceMinutes: true,
      leaveMinutes: true,
      nightDifferentialMinutes: true,

      restDay: true,

      leaveType: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      holiday: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },

      overtimeEntries: {
        select: {
          type: true,
          minutes: true,
        },
      },
    },
  },
} satisfies Prisma.DtrSelect;

type DtrAttendanceSummarySource = Prisma.DtrGetPayload<{
  select: typeof DTR_ATTENDANCE_SUMMARY_SELECT;
}>;

export interface DtrAttendanceSummaryCutoff {
  id: string;
  startDate: string;
  endDate: string;
  payDate: string;
  status: PayrollCutoffStatus;
}

export interface DtrAttendanceSummaryRecord {
  dtrId: string;

  companyId: string;
  employeeId: string;
  employmentRecordId: string;
  payrollCutoffId: string;

  status: DtrStatus;
  validatedAt: string | null;

  payrollCutoff: DtrAttendanceSummaryCutoff;

  payrollReady: boolean;
  readinessIssues: string[];

  attendance: AttendanceAggregate;
}

@Injectable()
export class DtrAttendanceSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(dtrId: string): Promise<DtrAttendanceSummaryRecord> {
    const dtr = await this.prisma.dtr.findUnique({
      where: {
        id: dtrId,
      },

      select: DTR_ATTENDANCE_SUMMARY_SELECT,
    });

    if (!dtr) {
      throw new NotFoundException('DTR not found.');
    }

    return this.buildSummary(dtr);
  }

  private buildSummary(
    dtr: DtrAttendanceSummarySource,
  ): DtrAttendanceSummaryRecord {
    const entries: AttendanceSummaryEntryInput[] = dtr.entries.map((entry) => ({
      workDate: this.toDateString(entry.workDate),

      regularMinutes: entry.regularMinutes,

      lateMinutes: entry.lateMinutes,

      undertimeMinutes: entry.undertimeMinutes,

      absenceMinutes: entry.absenceMinutes,

      leaveMinutes: entry.leaveMinutes,

      nightDifferentialMinutes: entry.nightDifferentialMinutes,

      restDay: entry.restDay,

      leaveType: entry.leaveType
        ? {
            id: entry.leaveType.id,
            code: entry.leaveType.code,
            name: entry.leaveType.name,
          }
        : null,

      holiday: entry.holiday
        ? {
            id: entry.holiday.id,
            name: entry.holiday.name,
            type: entry.holiday.type,
          }
        : null,

      overtimeEntries: entry.overtimeEntries.map((overtime) => ({
        type: overtime.type,
        minutes: overtime.minutes,
      })),
    }));

    const payrollReady = dtr.status === DtrStatus.VALIDATED;

    const readinessIssues = payrollReady
      ? []
      : ['DTR must be validated before payroll generation.'];

    return {
      dtrId: dtr.id,

      companyId: dtr.companyId,

      employeeId: dtr.employeeId,

      employmentRecordId: dtr.employmentRecordId,

      payrollCutoffId: dtr.payrollCutoffId,

      status: dtr.status,

      validatedAt: dtr.validatedAt?.toISOString() ?? null,

      payrollCutoff: {
        id: dtr.payrollCutoff.id,

        startDate: this.toDateString(dtr.payrollCutoff.startDate),

        endDate: this.toDateString(dtr.payrollCutoff.endDate),

        payDate: this.toDateString(dtr.payrollCutoff.payDate),

        status: dtr.payrollCutoff.status,
      },

      payrollReady,
      readinessIssues,

      attendance: summarizeAttendance(entries),
    };
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
