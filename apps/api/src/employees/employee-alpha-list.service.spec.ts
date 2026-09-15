import { EmployeePayrollStatus, PayoutMethod } from '@payroll/database';

import type { PrismaService } from '../database/prisma.service';
import {
  DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS,
  EmployeeAlphaListColumn,
} from './employee-alpha-list.constants';
import { EmployeeAlphaListService } from './employee-alpha-list.service';

describe('EmployeeAlphaListService', () => {
  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const departmentId = '22222222-2222-4222-8222-222222222222';

  const positionId = '33333333-3333-4333-8333-333333333333';

  const employeeRecord = {
    id: employeeId,

    employeeNumber: 'EMP-0001',

    firstName: 'Gino',
    middleName: 'Test',
    lastName: 'Suson',
    suffix: null,

    email: 'gino@example.com',
    mobile: '+639171234567',

    addressLine1: '123 Sample Street',
    addressLine2: null,
    barangay: 'Sample Barangay',
    city: 'Quezon City',
    province: 'Metro Manila',
    postalCode: '1100',
    country: 'Philippines',

    currentStatus: EmployeePayrollStatus.ACTIVE,

    employmentRecords: [
      {
        id: '44444444-4444-4444-8444-444444444444',

        companyEmployeeNumber: 'LC-0001',

        startDate: new Date('2026-01-01T00:00:00.000Z'),

        company: {
          id: companyId,
          code: 'YAK-QC',
          name: 'Yakiniku Like Quezon City',
        },

        department: {
          id: departmentId,
          code: 'OPS',
          name: 'Operations',
        },

        position: {
          id: positionId,
          code: 'CREW',
          name: 'Crew',
        },

        payrollProfile: {
          payoutMethod: PayoutMethod.ATM,
        },
      },
    ],
  };

  it('returns the essential default Alpha List columns', async () => {
    const employeeCount = jest.fn().mockResolvedValue(1);

    const employeeFindMany = jest.fn().mockResolvedValue([employeeRecord]);

    const prisma = {
      employee: {
        count: employeeCount,
        findMany: employeeFindMany,
      },

      $transaction: jest.fn().mockResolvedValue([1, [employeeRecord]]),
    } as unknown as PrismaService;

    const service = new EmployeeAlphaListService(prisma);

    const result = await service.getAlphaList({
      page: 1,
      pageSize: 25,

      columns: [...DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS],
    });

    expect(result.columns).toEqual(DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS);

    expect(result.items).toEqual([
      {
        employeeId,

        values: {
          employeeNumber: 'EMP-0001',

          fullName: 'Gino Test Suson',

          companyName: 'Yakiniku Like Quezon City',

          departmentName: 'Operations',

          positionName: 'Crew',

          status: EmployeePayrollStatus.ACTIVE,

          payoutMethod: PayoutMethod.ATM,
        },
      },
    ]);

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    });
  });

  it('returns only explicitly requested columns', async () => {
    const prisma = {
      employee: {
        count: jest.fn().mockResolvedValue(1),

        findMany: jest.fn().mockResolvedValue([employeeRecord]),
      },

      $transaction: jest.fn().mockResolvedValue([1, [employeeRecord]]),
    } as unknown as PrismaService;

    const service = new EmployeeAlphaListService(prisma);

    const result = await service.getAlphaList({
      page: 1,
      pageSize: 25,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.EMAIL,
        EmployeeAlphaListColumn.MOBILE,
        EmployeeAlphaListColumn.CITY,
      ],
    });

    expect(result.columns).toEqual([
      EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
      EmployeeAlphaListColumn.EMAIL,
      EmployeeAlphaListColumn.MOBILE,
      EmployeeAlphaListColumn.CITY,
    ]);

    expect(result.items[0]).toEqual({
      employeeId,

      values: {
        employeeNumber: 'EMP-0001',

        email: 'gino@example.com',

        mobile: '+639171234567',

        city: 'Quezon City',
      },
    });
  });

  it('applies company, department, position, status and payout filters to current employment', async () => {
    const employeeCount = jest.fn().mockResolvedValue(1);

    const employeeFindMany = jest.fn().mockResolvedValue([employeeRecord]);

    const prisma = {
      employee: {
        count: employeeCount,
        findMany: employeeFindMany,
      },

      $transaction: jest.fn().mockResolvedValue([1, [employeeRecord]]),
    } as unknown as PrismaService;

    const service = new EmployeeAlphaListService(prisma);

    await service.getAlphaList({
      page: 1,
      pageSize: 25,

      companyId,
      departmentId,
      positionId,

      status: EmployeePayrollStatus.ACTIVE,

      payoutMethod: PayoutMethod.ATM,

      columns: [EmployeeAlphaListColumn.EMPLOYEE_NUMBER],
    });

    expect(employeeCount).toHaveBeenCalledWith({
      where: {
        currentStatus: EmployeePayrollStatus.ACTIVE,

        employmentRecords: {
          some: {
            endDate: null,

            companyId,
            departmentId,
            positionId,

            payrollProfile: {
              is: {
                payoutMethod: PayoutMethod.ATM,
              },
            },
          },
        },
      },
    });

    expect(employeeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          currentStatus: EmployeePayrollStatus.ACTIVE,

          employmentRecords: {
            some: {
              endDate: null,

              companyId,
              departmentId,
              positionId,

              payrollProfile: {
                is: {
                  payoutMethod: PayoutMethod.ATM,
                },
              },
            },
          },
        },
      }),
    );
  });

  it('applies employee search using supported employee fields', async () => {
    const employeeCount = jest.fn().mockResolvedValue(0);

    const employeeFindMany = jest.fn().mockResolvedValue([]);

    const prisma = {
      employee: {
        count: employeeCount,
        findMany: employeeFindMany,
      },

      $transaction: jest.fn().mockResolvedValue([0, []]),
    } as unknown as PrismaService;

    const service = new EmployeeAlphaListService(prisma);

    await service.getAlphaList({
      search: 'Gino',

      page: 1,
      pageSize: 25,

      columns: [EmployeeAlphaListColumn.EMPLOYEE_NUMBER],
    });

    expect(employeeCount).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            employeeNumber: {
              contains: 'Gino',
              mode: 'insensitive',
            },
          },

          {
            firstName: {
              contains: 'Gino',
              mode: 'insensitive',
            },
          },

          {
            middleName: {
              contains: 'Gino',
              mode: 'insensitive',
            },
          },

          {
            lastName: {
              contains: 'Gino',
              mode: 'insensitive',
            },
          },

          {
            email: {
              contains: 'Gino',
              mode: 'insensitive',
            },
          },

          {
            mobile: {
              contains: 'Gino',
              mode: 'insensitive',
            },
          },

          {
            employmentRecords: {
              some: {
                endDate: null,

                companyEmployeeNumber: {
                  contains: 'Gino',
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      },
    });
  });

  it('uses pagination and alphabetical ordering', async () => {
    const employeeFindMany = jest.fn().mockResolvedValue([]);

    const prisma = {
      employee: {
        count: jest.fn().mockResolvedValue(101),

        findMany: employeeFindMany,
      },

      $transaction: jest.fn().mockResolvedValue([101, []]),
    } as unknown as PrismaService;

    const service = new EmployeeAlphaListService(prisma);

    const result = await service.getAlphaList({
      page: 3,
      pageSize: 25,

      columns: [EmployeeAlphaListColumn.EMPLOYEE_NUMBER],
    });

    expect(employeeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            lastName: 'asc',
          },
          {
            firstName: 'asc',
          },
        ],

        skip: 50,
        take: 25,
      }),
    );

    expect(result.pagination).toEqual({
      page: 3,
      pageSize: 25,
      total: 101,
      totalPages: 5,
    });
  });
});
