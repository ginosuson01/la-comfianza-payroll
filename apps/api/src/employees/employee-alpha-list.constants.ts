export enum EmployeeAlphaListColumn {
  EMPLOYEE_NUMBER = 'employeeNumber',
  FULL_NAME = 'fullName',

  EMAIL = 'email',
  MOBILE = 'mobile',

  STATUS = 'status',

  COMPANY_CODE = 'companyCode',
  COMPANY_NAME = 'companyName',
  COMPANY_EMPLOYEE_NUMBER = 'companyEmployeeNumber',

  DEPARTMENT_CODE = 'departmentCode',
  DEPARTMENT_NAME = 'departmentName',

  POSITION_CODE = 'positionCode',
  POSITION_NAME = 'positionName',

  EMPLOYMENT_START_DATE = 'employmentStartDate',

  PAYOUT_METHOD = 'payoutMethod',

  ADDRESS_LINE_1 = 'addressLine1',
  ADDRESS_LINE_2 = 'addressLine2',
  BARANGAY = 'barangay',
  CITY = 'city',
  PROVINCE = 'province',
  POSTAL_CODE = 'postalCode',
  COUNTRY = 'country',
}

export const DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS: readonly EmployeeAlphaListColumn[] =
  [
    EmployeeAlphaListColumn.EMPLOYEE_NUMBER,
    EmployeeAlphaListColumn.FULL_NAME,
    EmployeeAlphaListColumn.COMPANY_NAME,
    EmployeeAlphaListColumn.DEPARTMENT_NAME,
    EmployeeAlphaListColumn.POSITION_NAME,
    EmployeeAlphaListColumn.STATUS,
    EmployeeAlphaListColumn.PAYOUT_METHOD,
  ];
