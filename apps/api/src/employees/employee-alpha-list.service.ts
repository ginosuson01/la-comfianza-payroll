import { Injectable } from '@nestjs/common';
import { type Prisma } from '@payroll/database';

import { PrismaService } from '../database/prisma.service';
import type { EmployeeAlphaListQueryDto } from './dto/employee-alpha-list-query.dto';
import {
  DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS,
  EmployeeAlphaListColumn,
} from './employee-alpha-list.constants';

const EMPLOYEE_ALPHA_LIST_SELECT = {
  id: true,
  employeeNumber: true,

  firstName: true,
  middleName: true,
  lastName: true,
  suffix: true,

  email: true,
  mobile: true,

  addressLine1: true,
  addressLine2: true,
  barangay: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,

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
      id: true,

      companyEmployeeNumber: true,
      startDate: true,

      company: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

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

      payrollProfile: {
        select: {
          payoutMethod: true,
        },
      },
    },
  },
} satisfies Prisma.EmployeeSelect;

type EmployeeAlphaListRecord = Prisma.EmployeeGetPayload<{
  select: typeof EMPLOYEE_ALPHA_LIST_SELECT;
}>;

type AlphaListValue = string | null;

export interface EmployeeAlphaListRow {
  employeeId: string;

  values: Partial<Record<EmployeeAlphaListColumn, AlphaListValue>>;
}

export interface EmployeeAlphaListResponse {
  columns: EmployeeAlphaListColumn[];

  items: EmployeeAlphaListRow[];

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class EmployeeAlphaListService {
  constructor(private readonly prisma: PrismaService) {}

  async getAlphaList(
    query: EmployeeAlphaListQueryDto,
  ): Promise<EmployeeAlphaListResponse> {
    const page = query.page;
    const pageSize = query.pageSize;

    const columns = [
      ...new Set(
        query.columns?.length
          ? query.columns
          : DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS,
      ),
    ];

    const where = this.buildWhere(query);

    const [total, employees] = await this.prisma.$transaction([
      this.prisma.employee.count({
        where,
      }),

      this.prisma.employee.findMany({
        where,

        select: EMPLOYEE_ALPHA_LIST_SELECT,

        orderBy: [
          {
            lastName: 'asc',
          },
          {
            firstName: 'asc',
          },
        ],

        skip: (page - 1) * pageSize,

        take: pageSize,
      }),
    ]);

    return {
      columns,

      items: employees.map((employee) => ({
        employeeId: employee.id,

        values: this.toAlphaListValues(employee, columns),
      })),

      pagination: {
        page,
        pageSize,
        total,

        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private buildWhere(
    query: EmployeeAlphaListQueryDto,
  ): Prisma.EmployeeWhereInput {
    const where: Prisma.EmployeeWhereInput = {};

    const employmentFilter: Prisma.EmploymentRecordWhereInput = {
      endDate: null,
    };

    if (query.companyId) {
      employmentFilter.companyId = query.companyId;
    }

    if (query.departmentId) {
      employmentFilter.departmentId = query.departmentId;
    }

    if (query.positionId) {
      employmentFilter.positionId = query.positionId;
    }

    if (query.payoutMethod) {
      employmentFilter.payrollProfile = {
        is: {
          payoutMethod: query.payoutMethod,
        },
      };
    }

    if (query.status) {
      where.currentStatus = query.status;
    }

    if (
      query.companyId ||
      query.departmentId ||
      query.positionId ||
      query.payoutMethod
    ) {
      where.employmentRecords = {
        some: employmentFilter,
      };
    }

    const search = query.search?.trim();

    if (search) {
      where.OR = [
        {
          employeeNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          middleName: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          mobile: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          employmentRecords: {
            some: {
              endDate: null,

              companyEmployeeNumber: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    return where;
  }

  private toAlphaListValues(
    employee: EmployeeAlphaListRecord,
    columns: EmployeeAlphaListColumn[],
  ): Partial<Record<EmployeeAlphaListColumn, AlphaListValue>> {
    const values: Partial<Record<EmployeeAlphaListColumn, AlphaListValue>> = {};

    const employment = employee.employmentRecords[0] ?? null;

    const fullName = [
      employee.firstName,
      employee.middleName,
      employee.lastName,
      employee.suffix,
    ]
      .filter(Boolean)
      .join(' ');

    for (const column of columns) {
      switch (column) {
        case EmployeeAlphaListColumn.EMPLOYEE_NUMBER:
          values[column] = employee.employeeNumber;
          break;

        case EmployeeAlphaListColumn.FULL_NAME:
          values[column] = fullName;
          break;

        case EmployeeAlphaListColumn.EMAIL:
          values[column] = employee.email;
          break;

        case EmployeeAlphaListColumn.MOBILE:
          values[column] = employee.mobile;
          break;

        case EmployeeAlphaListColumn.STATUS:
          values[column] = employee.currentStatus;
          break;

        case EmployeeAlphaListColumn.COMPANY_CODE:
          values[column] = employment?.company.code ?? null;
          break;

        case EmployeeAlphaListColumn.COMPANY_NAME:
          values[column] = employment?.company.name ?? null;
          break;

        case EmployeeAlphaListColumn.COMPANY_EMPLOYEE_NUMBER:
          values[column] = employment?.companyEmployeeNumber ?? null;
          break;

        case EmployeeAlphaListColumn.DEPARTMENT_CODE:
          values[column] = employment?.department?.code ?? null;
          break;

        case EmployeeAlphaListColumn.DEPARTMENT_NAME:
          values[column] = employment?.department?.name ?? null;
          break;

        case EmployeeAlphaListColumn.POSITION_CODE:
          values[column] = employment?.position?.code ?? null;
          break;

        case EmployeeAlphaListColumn.POSITION_NAME:
          values[column] = employment?.position?.name ?? null;
          break;

        case EmployeeAlphaListColumn.EMPLOYMENT_START_DATE:
          values[column] =
            employment?.startDate.toISOString().slice(0, 10) ?? null;
          break;

        case EmployeeAlphaListColumn.PAYOUT_METHOD:
          values[column] = employment?.payrollProfile?.payoutMethod ?? null;
          break;

        case EmployeeAlphaListColumn.ADDRESS_LINE_1:
          values[column] = employee.addressLine1;
          break;

        case EmployeeAlphaListColumn.ADDRESS_LINE_2:
          values[column] = employee.addressLine2;
          break;

        case EmployeeAlphaListColumn.BARANGAY:
          values[column] = employee.barangay;
          break;

        case EmployeeAlphaListColumn.CITY:
          values[column] = employee.city;
          break;

        case EmployeeAlphaListColumn.PROVINCE:
          values[column] = employee.province;
          break;

        case EmployeeAlphaListColumn.POSTAL_CODE:
          values[column] = employee.postalCode;
          break;

        case EmployeeAlphaListColumn.COUNTRY:
          values[column] = employee.country;
          break;
      }
    }

    return values;
  }
}
