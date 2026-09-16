import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { DtrPayrollConfigService } from './dtr-payroll-config.service';
import type { AttendanceReferenceQueryDto } from './dto/attendance-reference-query.dto';

export interface AttendanceLeaveTypeReference {
  id: string;
  code: string;
  name: string;
  unit: string;
}

export interface AttendanceHolidayReference {
  id: string;
  date: Date;
  name: string;
  type: string;
}

export interface AttendanceReferenceData {
  standardWorkMinutesPerDay: number;
  leaveTypes: AttendanceLeaveTypeReference[];
  holidays: AttendanceHolidayReference[];
}

@Injectable()
export class AttendanceReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollConfigService: DtrPayrollConfigService,
  ) {}

  async getReferenceData(
    query: AttendanceReferenceQueryDto,
  ): Promise<AttendanceReferenceData> {
    const startDate = new Date(`${query.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${query.endDate}T00:00:00.000Z`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException(
        'Attendance reference date range is invalid.',
      );
    }

    if (startDate > endDate) {
      throw new BadRequestException(
        'Attendance reference start date must not be after the end date.',
      );
    }

    const [attendanceConfig, leaveTypes, holidays] = await Promise.all([
      this.payrollConfigService.getAttendanceConfig(query.companyId, startDate),

      this.prisma.leaveType.findMany({
        where: {
          companyId: query.companyId,
          active: true,
        },

        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
        },

        orderBy: [
          {
            code: 'asc',
          },
          {
            name: 'asc',
          },
        ],
      }),

      this.prisma.holiday.findMany({
        where: {
          companyId: query.companyId,
          active: true,

          date: {
            gte: startDate,
            lte: endDate,
          },
        },

        select: {
          id: true,
          date: true,
          name: true,
          type: true,
        },

        orderBy: [
          {
            date: 'asc',
          },
          {
            name: 'asc',
          },
        ],
      }),
    ]);

    return {
      standardWorkMinutesPerDay: attendanceConfig.standardWorkMinutesPerDay,

      leaveTypes,
      holidays,
    };
  }
}
