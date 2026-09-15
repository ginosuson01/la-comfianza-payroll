import type { EmployeeAlphaListQueryDto } from './dto/employee-alpha-list-query.dto';
import { EmployeeAlphaListPdfService } from './employee-alpha-list-pdf.service';
import { EmployeeAlphaListColumn } from './employee-alpha-list.constants';
import type {
  EmployeeAlphaListResponse,
  EmployeeAlphaListService,
} from './employee-alpha-list.service';

describe('EmployeeAlphaListPdfService', () => {
  function createAlphaListService(
    getAlphaList: jest.MockedFunction<EmployeeAlphaListService['getAlphaList']>,
  ): EmployeeAlphaListService {
    return {
      getAlphaList,
    } as unknown as EmployeeAlphaListService;
  }

  it('generates a valid PDF buffer for selected Alpha List columns', async () => {
    const response: EmployeeAlphaListResponse = {
      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
        EmployeeAlphaListColumn.COMPANY_NAME,
        EmployeeAlphaListColumn.STATUS,
      ],

      items: [
        {
          employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          values: {
            employeeNumber: 'EMP-0001',
            fullName: 'Gino Suson',
            companyName: 'Yakiniku Like Quezon City',
            status: 'ACTIVE',
          },
        },
      ],

      pagination: {
        page: 1,
        pageSize: 100,
        total: 1,
        totalPages: 1,
      },
    };

    const getAlphaList: jest.MockedFunction<
      EmployeeAlphaListService['getAlphaList']
    > = jest.fn().mockResolvedValue(response);

    const service = new EmployeeAlphaListPdfService(
      createAlphaListService(getAlphaList),
    );

    const query: EmployeeAlphaListQueryDto = {
      page: 1,
      pageSize: 25,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
        EmployeeAlphaListColumn.COMPANY_NAME,
        EmployeeAlphaListColumn.STATUS,
      ],
    };

    const result = await service.generatePdf(query);

    expect(getAlphaList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
        EmployeeAlphaListColumn.COMPANY_NAME,
        EmployeeAlphaListColumn.STATUS,
      ],
    });

    expect(result.fileName).toBe('employee-alpha-list.pdf');

    expect(result.contentType).toBe('application/pdf');

    expect(result.totalRecords).toBe(1);

    expect(Buffer.isBuffer(result.content)).toBe(true);

    expect(result.content.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    expect(result.content.length).toBeGreaterThan(100);
  });

  it('exports all matching Alpha List pages instead of only the current UI page', async () => {
    const firstResponse: EmployeeAlphaListResponse = {
      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
      ],

      items: [
        {
          employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          values: {
            employeeNumber: 'EMP-0001',
            fullName: 'Employee One',
          },
        },
      ],

      pagination: {
        page: 1,
        pageSize: 100,
        total: 101,
        totalPages: 2,
      },
    };

    const secondResponse: EmployeeAlphaListResponse = {
      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
      ],

      items: [
        {
          employeeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

          values: {
            employeeNumber: 'EMP-0101',
            fullName: 'Employee One Hundred One',
          },
        },
      ],

      pagination: {
        page: 2,
        pageSize: 100,
        total: 101,
        totalPages: 2,
      },
    };

    const getAlphaList: jest.MockedFunction<
      EmployeeAlphaListService['getAlphaList']
    > = jest
      .fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse);

    const service = new EmployeeAlphaListPdfService(
      createAlphaListService(getAlphaList),
    );

    const query: EmployeeAlphaListQueryDto = {
      search: 'EMP',

      page: 3,
      pageSize: 25,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
      ],
    };

    const result = await service.generatePdf(query);

    expect(getAlphaList).toHaveBeenCalledTimes(2);

    expect(getAlphaList).toHaveBeenNthCalledWith(1, {
      search: 'EMP',

      page: 1,
      pageSize: 100,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
      ],
    });

    expect(getAlphaList).toHaveBeenNthCalledWith(2, {
      search: 'EMP',

      page: 2,
      pageSize: 100,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
      ],
    });

    expect(result.totalRecords).toBe(101);

    expect(result.content.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('generates a valid print-ready PDF when no employees match', async () => {
    const response: EmployeeAlphaListResponse = {
      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
      ],

      items: [],

      pagination: {
        page: 1,
        pageSize: 100,
        total: 0,
        totalPages: 0,
      },
    };

    const getAlphaList: jest.MockedFunction<
      EmployeeAlphaListService['getAlphaList']
    > = jest.fn().mockResolvedValue(response);

    const service = new EmployeeAlphaListPdfService(
      createAlphaListService(getAlphaList),
    );

    const result = await service.generatePdf({
      page: 1,
      pageSize: 25,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
      ],
    });

    expect(result.totalRecords).toBe(0);

    expect(result.content.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    expect(result.content.length).toBeGreaterThan(100);
  });

  it('supports more than seven selected columns for multi-section print output', async () => {
    const columns = [
      EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
      EmployeeAlphaListColumn.FULL_NAME,
      EmployeeAlphaListColumn.EMAIL,
      EmployeeAlphaListColumn.MOBILE,
      EmployeeAlphaListColumn.STATUS,
      EmployeeAlphaListColumn.COMPANY_NAME,
      EmployeeAlphaListColumn.DEPARTMENT_NAME,
      EmployeeAlphaListColumn.POSITION_NAME,
      EmployeeAlphaListColumn.PAYOUT_METHOD,
      EmployeeAlphaListColumn.CITY,
    ];

    const response: EmployeeAlphaListResponse = {
      columns,

      items: [
        {
          employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          values: {
            employeeNumber: 'EMP-0001',
            fullName: 'Gino Suson',
            email: 'gino@example.com',
            mobile: '+639171234567',
            status: 'ACTIVE',
            companyName: 'Yakiniku Like Quezon City',
            departmentName: 'Operations',
            positionName: 'Crew',
            payoutMethod: 'ATM',
            city: 'Quezon City',
          },
        },
      ],

      pagination: {
        page: 1,
        pageSize: 100,
        total: 1,
        totalPages: 1,
      },
    };

    const getAlphaList: jest.MockedFunction<
      EmployeeAlphaListService['getAlphaList']
    > = jest.fn().mockResolvedValue(response);

    const service = new EmployeeAlphaListPdfService(
      createAlphaListService(getAlphaList),
    );

    const result = await service.generatePdf({
      page: 1,
      pageSize: 25,
      columns,
    });

    expect(result.totalRecords).toBe(1);

    expect(result.content.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    expect(result.content.length).toBeGreaterThan(100);
  });
});
