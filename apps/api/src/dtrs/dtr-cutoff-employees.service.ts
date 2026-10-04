import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import type { ListCutoffEmployeesQueryDto } from './dto/list-cutoff-employees-query.dto';

export interface CutoffEmployeeDtrSummary {
  id: string;
  status: string;
  entryCount: number;
}

export interface CutoffEmployeeView {
  employeeId: string;
  employeeNumber: string;

  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;

  currentStatus: string;

  employmentRecordId: string;
  companyEmployeeNumber: string | null;

  employmentStartDate: Date;
  employmentEndDate: Date | null;

  dtr: CutoffEmployeeDtrSummary | null;
}

@Injectable()
export class DtrCutoffEmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCutoffEmployees(
    query: ListCutoffEmployeesQueryDto,
  ): Promise<CutoffEmployeeView[]> {
    const cutoff = await this.prisma.payrollCutoff.findFirst({
      where: {
        id: query.payrollCutoffId,
        companyId: query.companyId,
      },

      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!cutoff) {
      throw new NotFoundException(
        'Payroll cutoff was not found for the selected company.',
      );
    }

    const employmentRecords = await this.prisma.employmentRecord.findMany({
      where: {
        companyId: query.companyId,

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

      select: {
        id: true,
        companyEmployeeNumber: true,
        startDate: true,
        endDate: true,

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
      },

      orderBy: [
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
    });

    if (employmentRecords.length === 0) {
      return [];
    }

    const dtrs = await this.prisma.dtr.findMany({
      where: {
        companyId: query.companyId,
        payrollCutoffId: query.payrollCutoffId,

        employmentRecordId: {
          in: employmentRecords.map((record) => record.id),
        },
      },

      select: {
        id: true,
        employmentRecordId: true,
        status: true,

        _count: {
          select: {
            entries: true,
          },
        },
      },
    });

    const dtrByEmploymentRecord = new Map(
      dtrs.map((dtr) => [dtr.employmentRecordId, dtr]),
    );

    const search = query.search?.trim().toLowerCase() ?? '';

    return employmentRecords
      .map((employment) => {
        const dtr = dtrByEmploymentRecord.get(employment.id);

        return {
          employeeId: employment.employee.id,

          employeeNumber: employment.employee.employeeNumber,

          firstName: employment.employee.firstName,

          middleName: employment.employee.middleName,

          lastName: employment.employee.lastName,

          suffix: employment.employee.suffix,

          currentStatus: employment.employee.currentStatus,

          employmentRecordId: employment.id,

          companyEmployeeNumber: employment.companyEmployeeNumber,

          employmentStartDate: employment.startDate,

          employmentEndDate: employment.endDate,

          dtr: dtr
            ? {
                id: dtr.id,
                status: dtr.status,
                entryCount: dtr._count.entries,
              }
            : null,
        } satisfies CutoffEmployeeView;
      })
      .filter((item) => {
        if (!search) {
          return true;
        }

        const searchableValues = [
          item.employeeNumber,
          item.companyEmployeeNumber,
          item.firstName,
          item.middleName,
          item.lastName,
          item.suffix,
        ];

        return searchableValues.some((value) =>
          value?.toLowerCase().includes(search),
        );
      });
  }
}
