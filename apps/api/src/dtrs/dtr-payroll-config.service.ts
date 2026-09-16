import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigStatus, Prisma } from '@payroll/database';

import { PrismaService } from '../database/prisma.service';

export interface DtrAttendancePayrollConfig {
  companyPayrollSetupVersionId: string;
  version: number;
  standardWorkMinutesPerDay: number;
}

@Injectable()
export class DtrPayrollConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getAttendanceConfig(
    companyId: string,
    effectiveDate: Date,
  ): Promise<DtrAttendancePayrollConfig> {
    const setupVersion = await this.prisma.companyPayrollSetupVersion.findFirst(
      {
        where: {
          status: ConfigStatus.ACTIVE,

          companyPayrollSetup: {
            is: {
              companyId,
            },
          },

          AND: [
            {
              OR: [
                {
                  effectiveFrom: null,
                },
                {
                  effectiveFrom: {
                    lte: effectiveDate,
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
                    gte: effectiveDate,
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
          id: true,
          version: true,
          config: true,
        },
      },
    );

    if (!setupVersion) {
      throw new BadRequestException(
        'No active payroll setup is configured for the company and DTR work date.',
      );
    }

    const standardWorkMinutesPerDay = this.getStandardWorkMinutesPerDay(
      setupVersion.config,
    );

    return {
      companyPayrollSetupVersionId: setupVersion.id,

      version: setupVersion.version,

      standardWorkMinutesPerDay,
    };
  }

  async convertLeaveMinutesToDays(
    companyId: string,
    effectiveDate: Date,
    leaveMinutes: number,
  ): Promise<Prisma.Decimal> {
    if (!Number.isInteger(leaveMinutes) || leaveMinutes < 0) {
      throw new BadRequestException(
        'Leave minutes must be a non-negative integer.',
      );
    }

    if (leaveMinutes === 0) {
      return new Prisma.Decimal(0);
    }

    const attendanceConfig = await this.getAttendanceConfig(
      companyId,
      effectiveDate,
    );

    return new Prisma.Decimal(leaveMinutes)
      .div(attendanceConfig.standardWorkMinutesPerDay)
      .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  }

  private getStandardWorkMinutesPerDay(config: Prisma.JsonValue): number {
    const configObject = this.toJsonObject(config);

    if (!configObject) {
      throw new BadRequestException(
        'Active payroll setup configuration is invalid.',
      );
    }

    const attendanceObject = this.toJsonObject(configObject.attendance);

    if (!attendanceObject) {
      throw new BadRequestException(
        'Active payroll setup is missing attendance configuration.',
      );
    }

    const standardWorkMinutesPerDay =
      attendanceObject.standardWorkMinutesPerDay;

    if (
      typeof standardWorkMinutesPerDay !== 'number' ||
      !Number.isInteger(standardWorkMinutesPerDay) ||
      standardWorkMinutesPerDay <= 0
    ) {
      throw new BadRequestException(
        'Active payroll setup must define a positive integer attendance.standardWorkMinutesPerDay.',
      );
    }

    return standardWorkMinutesPerDay;
  }

  private toJsonObject(
    value: Prisma.JsonValue | undefined,
  ): Prisma.JsonObject | null {
    if (
      value === null ||
      value === undefined ||
      Array.isArray(value) ||
      typeof value !== 'object'
    ) {
      return null;
    }

    return value;
  }
}
