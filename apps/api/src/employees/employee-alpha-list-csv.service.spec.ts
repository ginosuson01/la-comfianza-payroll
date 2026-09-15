import type { EmployeeAlphaListQueryDto } from './dto/employee-alpha-list-query.dto';
import { EmployeeAlphaListCsvService } from './employee-alpha-list-csv.service';
import { EmployeeAlphaListColumn } from './employee-alpha-list.constants';
import type {
  EmployeeAlphaListResponse,
  EmployeeAlphaListService,
} from './employee-alpha-list.service';

describe('EmployeeAlphaListCsvService', () => {
  function createAlphaListService(
    getAlphaList: jest.MockedFunction<EmployeeAlphaListService['getAlphaList']>,
  ): EmployeeAlphaListService {
    return {
      getAlphaList,
    } as unknown as EmployeeAlphaListService;
  }

  it('generates CSV using only the selected columns', async () => {
    const response: EmployeeAlphaListResponse = {
      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
        EmployeeAlphaListColumn.COMPANY_NAME,
      ],

      items: [
        {
          employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          values: {
            employeeNumber: 'EMP-0001',
            fullName: 'Gino Suson',
            companyName: 'Yakiniku Like Quezon City',
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

    const service = new EmployeeAlphaListCsvService(
      createAlphaListService(getAlphaList),
    );

    const query: EmployeeAlphaListQueryDto = {
      page: 1,
      pageSize: 25,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
        EmployeeAlphaListColumn.COMPANY_NAME,
      ],
    };

    const result = await service.generateCsv(query);

    expect(getAlphaList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
        EmployeeAlphaListColumn.COMPANY_NAME,
      ],
    });

    expect(result.fileName).toBe('employee-alpha-list.csv');

    expect(result.contentType).toBe('text/csv; charset=utf-8');

    expect(result.totalRecords).toBe(1);

    expect(result.content).toBe(
      '\uFEFF' +
        '"Employee Number","Employee Name","Company"\r\n' +
        '"EMP-0001","Gino Suson","Yakiniku Like Quezon City"\r\n',
    );
  });

  it('escapes quotes and commas in CSV values', async () => {
    const response: EmployeeAlphaListResponse = {
      columns: [
        EmployeeAlphaListColumn.FULL_NAME,
        EmployeeAlphaListColumn.ADDRESS_LINE_1,
      ],

      items: [
        {
          employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          values: {
            fullName: 'Suson, "Gino"',

            addressLine1: '123 Sample Street, Quezon City',
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

    const service = new EmployeeAlphaListCsvService(
      createAlphaListService(getAlphaList),
    );

    const result = await service.generateCsv({
      page: 1,
      pageSize: 25,

      columns: [
        EmployeeAlphaListColumn.FULL_NAME,
        EmployeeAlphaListColumn.ADDRESS_LINE_1,
      ],
    });

    expect(result.content).toContain('"Suson, ""Gino"""');

    expect(result.content).toContain('"123 Sample Street, Quezon City"');
  });

  it('protects spreadsheet applications from formula-injection values', async () => {
    const response: EmployeeAlphaListResponse = {
      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
        EmployeeAlphaListColumn.EMAIL,
        EmployeeAlphaListColumn.MOBILE,
      ],

      items: [
        {
          employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          values: {
            employeeNumber: '=1+1',

            fullName: '+SUM(1,1)',

            email: '-malicious@example.com',

            mobile: '@malicious',
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

    const service = new EmployeeAlphaListCsvService(
      createAlphaListService(getAlphaList),
    );

    const result = await service.generateCsv({
      page: 1,
      pageSize: 25,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
        EmployeeAlphaListColumn.EMAIL,
        EmployeeAlphaListColumn.MOBILE,
      ],
    });

    expect(result.content).toContain('"\'=1+1"');

    expect(result.content).toContain('"\'+SUM(1,1)"');

    expect(result.content).toContain('"\'-malicious@example.com"');

    expect(result.content).toContain('"\'@malicious"');
  });

  it('exports every page of matching Alpha List records', async () => {
    const firstResponse: EmployeeAlphaListResponse = {
      columns: [EmployeeAlphaListColumn.EMPLOYEE_NUMBER],

      items: [
        {
          employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          values: {
            employeeNumber: 'EMP-0001',
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
      columns: [EmployeeAlphaListColumn.EMPLOYEE_NUMBER],

      items: [
        {
          employeeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

          values: {
            employeeNumber: 'EMP-0101',
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

    const service = new EmployeeAlphaListCsvService(
      createAlphaListService(getAlphaList),
    );

    const query: EmployeeAlphaListQueryDto = {
      search: 'EMP',

      page: 3,
      pageSize: 25,

      columns: [EmployeeAlphaListColumn.EMPLOYEE_NUMBER],
    };

    const result = await service.generateCsv(query);

    expect(getAlphaList).toHaveBeenCalledTimes(2);

    expect(getAlphaList).toHaveBeenNthCalledWith(1, {
      search: 'EMP',

      page: 1,
      pageSize: 100,

      columns: [EmployeeAlphaListColumn.EMPLOYEE_NUMBER],
    });

    expect(getAlphaList).toHaveBeenNthCalledWith(2, {
      search: 'EMP',

      page: 2,
      pageSize: 100,

      columns: [EmployeeAlphaListColumn.EMPLOYEE_NUMBER],
    });

    expect(result.totalRecords).toBe(101);

    expect(result.content).toContain('"EMP-0001"');

    expect(result.content).toContain('"EMP-0101"');
  });

  it('generates a valid header-only CSV when no employees match', async () => {
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

    const service = new EmployeeAlphaListCsvService(
      createAlphaListService(getAlphaList),
    );

    const result = await service.generateCsv({
      page: 1,
      pageSize: 25,

      columns: [
        EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
        EmployeeAlphaListColumn.FULL_NAME,
      ],
    });

    expect(result.totalRecords).toBe(0);

    expect(result.content).toBe(
      '\uFEFF' + '"Employee Number","Employee Name"\r\n',
    );
  });
});
