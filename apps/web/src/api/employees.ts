import { apiRequest } from './client'
import type {
  EmployeePayrollStatus,
  Pagination,
} from './types'

export type EmployeePayoutMethod =
  | 'CASH'
  | 'ATM'

export type EmployeeType =
  | 'LACOM_INTERNAL'
  | 'CLIENT_EMPLOYEE'

export interface EmployeeReference {
  id: string
  code: string
  name: string
}

export interface EmployeeEmploymentSummary {
  id: string

  companyEmployeeNumber: string | null
  employeeType: EmployeeType | null

  startDate: string
  endDate: string | null

  company: EmployeeReference

  department: EmployeeReference | null
  position: EmployeeReference | null

  payoutMethod: EmployeePayoutMethod | null
}

export interface EmployeeDirectoryView {
  id: string
  employeeNumber: string

  firstName: string
  middleName: string | null
  lastName: string
  suffix: string | null

  fullName: string

  email: string | null
  mobile: string | null

  addressLine1: string | null
  addressLine2: string | null
  barangay: string | null
  city: string | null
  province: string | null
  postalCode: string | null
  country: string

  currentStatus: EmployeePayrollStatus

  currentEmployment:
    EmployeeEmploymentSummary | null

  createdAt: string
  updatedAt: string
}

export interface EmployeeListResponse {
  items: EmployeeDirectoryView[]
  pagination: Pagination
}

export interface ListEmployeesQuery {
  search?: string

  companyId?: string
  departmentId?: string
  positionId?: string

  status?: EmployeePayrollStatus
  payoutMethod?: EmployeePayoutMethod

  page?: number
  pageSize?: number
}

export interface CreateEmployeeInput {
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string

  email?: string
  mobile?: string

  addressLine1?: string
  addressLine2?: string
  barangay?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string

  companyId: string
  employeeType: EmployeeType

  departmentId?: string
  positionId?: string

  companyEmployeeNumber?: string

  employmentDate: string

  status?: EmployeePayrollStatus
}

export interface UpdateEmployeeInput {
  firstName?: string
  middleName?: string | null
  lastName?: string
  suffix?: string | null

  email?: string | null
  mobile?: string | null

  addressLine1?: string | null
  addressLine2?: string | null
  barangay?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null

  country?: string
}

export interface ChangeEmploymentAssignmentInput {
  companyId: string
  employeeType: EmployeeType

  departmentId?: string | null
  positionId?: string | null

  companyEmployeeNumber?: string | null

  effectiveDate: string
}

function toQueryString(
  query: ListEmployeesQuery,
): string {
  const params =
    new URLSearchParams()

  if (query.search?.trim()) {
    params.set(
      'search',
      query.search.trim(),
    )
  }

  if (query.companyId) {
    params.set(
      'companyId',
      query.companyId,
    )
  }

  if (query.departmentId) {
    params.set(
      'departmentId',
      query.departmentId,
    )
  }

  if (query.positionId) {
    params.set(
      'positionId',
      query.positionId,
    )
  }

  if (query.status) {
    params.set(
      'status',
      query.status,
    )
  }

  if (query.payoutMethod) {
    params.set(
      'payoutMethod',
      query.payoutMethod,
    )
  }

  if (query.page !== undefined) {
    params.set(
      'page',
      String(query.page),
    )
  }

  if (query.pageSize !== undefined) {
    params.set(
      'pageSize',
      String(query.pageSize),
    )
  }

  const value =
    params.toString()

  return value
    ? `?${value}`
    : ''
}

export function listEmployees(
  accessToken: string,
  query: ListEmployeesQuery = {},
): Promise<EmployeeListResponse> {
  return apiRequest<EmployeeListResponse>(
    `/employees${toQueryString(query)}`,
    accessToken,
  )
}

export function createEmployee(
  accessToken: string,
  input: CreateEmployeeInput,
): Promise<EmployeeDirectoryView> {
  return apiRequest<EmployeeDirectoryView>(
    '/employees',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function updateEmployee(
  accessToken: string,
  employeeId: string,
  input: UpdateEmployeeInput,
): Promise<EmployeeDirectoryView> {
  return apiRequest<EmployeeDirectoryView>(
    `/employees/${employeeId}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export function changeEmployeeEmployment(
  accessToken: string,
  employeeId: string,
  input: ChangeEmploymentAssignmentInput,
): Promise<EmployeeDirectoryView> {
  return apiRequest<EmployeeDirectoryView>(
    `/employees/${employeeId}/employment`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export interface ChangeEmployeeStatusInput {
  status: EmployeePayrollStatus
  effectiveDate: string
  reason?: string | null
}

export interface EmployeeStatusChangeView {
  employeeId: string
  employeeNumber: string

  previousStatus: EmployeePayrollStatus
  currentStatus: EmployeePayrollStatus

  effectiveDate: string

  statusHistoryId: string
  changedAt: string
}

export function changeEmployeeStatus(
  accessToken: string,
  employeeId: string,
  input: ChangeEmployeeStatusInput,
): Promise<EmployeeStatusChangeView> {
  return apiRequest<EmployeeStatusChangeView>(
    `/employees/${employeeId}/status`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export type EmployeePayBasis =
  | 'DAILY'
  | 'MONTHLY'

export type EmployeeCompensationSource =
  | 'EMPLOYEE_OVERRIDE'
  | 'COMPANY_STANDARD'

export type MinimumWageClassification =
  | 'MWE'
  | 'NON_MWE'
  | 'UNRESOLVED'

export interface EmployeeMinimumWageReference {
  regionCode: string
  wageOrderCode: string
  areaClassification: string
  sector: string
  dailyRate: string
  rateEffectiveFrom: string
}

export interface EmployeeEffectiveCompensationView {
  asOfDate: string

  employmentRecordId: string
  companyId: string

  source: EmployeeCompensationSource | null

  payBasis: EmployeePayBasis | null
  rate: string | null

  effectiveFrom: string | null
  effectiveTo: string | null

  classification: MinimumWageClassification

  minimumWage: EmployeeMinimumWageReference | null

  classificationReason: string | null
}

export interface EmployeeCompensationView {
  id: string
  employmentRecordId: string

  payBasis: EmployeePayBasis
  rate: string

  effectiveFrom: string
  effectiveTo: string | null

  createdAt: string
}

export interface SetEmployeeCompensationInput {
  payBasis: EmployeePayBasis
  rate: number
  effectiveFrom: string
}

export type EmployeeRecurringPayrollItemKind =
  | 'ALLOWANCE'
  | 'FIXED_DEDUCTION'

export type EmployeePayrollStatutoryBasisTreatment =
  | 'INCLUDE'
  | 'EXCLUDE'

export interface EmployeeRecurringPayrollItemView {
  id: string
  employmentRecordId: string

  kind: EmployeeRecurringPayrollItemKind

  code: string
  description: string

  amount: string

  taxable: boolean

  pagIbigFundSalaryTreatment:
    EmployeePayrollStatutoryBasisTreatment | null

  active: boolean

  effectiveFrom: string
  effectiveTo: string | null

  createdAt: string
  updatedAt: string
}

export interface CreateEmployeeRecurringPayrollItemInput {
  kind: EmployeeRecurringPayrollItemKind

  code: string
  description: string

  amount: number

  taxable?: boolean

  pagIbigFundSalaryTreatment?:
    EmployeePayrollStatutoryBasisTreatment

  effectiveFrom: string
}

export interface UpdateEmployeeRecurringPayrollItemPagIbigTreatmentInput {
  pagIbigFundSalaryTreatment:
    EmployeePayrollStatutoryBasisTreatment
}

export interface EmployeePayrollProfileView {
  id: string
  employmentRecordId: string

  payoutMethod: EmployeePayoutMethod

  bankName: string | null
  accountNumberLast4: string | null

  createdAt: string
  updatedAt: string
}

export interface SetEmployeePayrollProfileInput {
  payoutMethod: EmployeePayoutMethod
  bankName?: string
  accountNumber?: string
}

export function getCurrentEmployeeCompensation(
  accessToken: string,
  employeeId: string,
): Promise<EmployeeCompensationView | null> {
  return apiRequest<EmployeeCompensationView | null>(
    `/employees/${employeeId}/compensation`,
    accessToken,
  )
}

export function getEffectiveEmployeeCompensation(
  accessToken: string,
  employeeId: string,
): Promise<EmployeeEffectiveCompensationView> {
  return apiRequest<EmployeeEffectiveCompensationView>(
    `/employees/${employeeId}/compensation/effective`,
    accessToken,
  )
}

export function setEmployeeCompensation(
  accessToken: string,
  employeeId: string,
  input: SetEmployeeCompensationInput,
): Promise<EmployeeCompensationView> {
  return apiRequest<EmployeeCompensationView>(
    `/employees/${employeeId}/compensation`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function listEmployeeRecurringPayrollItems(
  accessToken: string,
  employeeId: string,
): Promise<EmployeeRecurringPayrollItemView[]> {
  return apiRequest<EmployeeRecurringPayrollItemView[]>(
    `/employees/${employeeId}/recurring-payroll-items`,
    accessToken,
  )
}

export function createEmployeeRecurringPayrollItem(
  accessToken: string,
  employeeId: string,
  input: CreateEmployeeRecurringPayrollItemInput,
): Promise<EmployeeRecurringPayrollItemView> {
  return apiRequest<EmployeeRecurringPayrollItemView>(
    `/employees/${employeeId}/recurring-payroll-items`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function updateEmployeeRecurringPayrollItemPagIbigTreatment(
  accessToken: string,
  employeeId: string,
  recurringPayrollItemId: string,
  input: UpdateEmployeeRecurringPayrollItemPagIbigTreatmentInput,
): Promise<EmployeeRecurringPayrollItemView> {
  return apiRequest<EmployeeRecurringPayrollItemView>(
    `/employees/${employeeId}/recurring-payroll-items/${recurringPayrollItemId}/pagibig-treatment`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export function getEmployeePayrollProfile(
  accessToken: string,
  employeeId: string,
): Promise<EmployeePayrollProfileView | null> {
  return apiRequest<EmployeePayrollProfileView | null>(
    `/employees/${employeeId}/payroll-profile`,
    accessToken,
  )
}

export function setEmployeePayrollProfile(
  accessToken: string,
  employeeId: string,
  input: SetEmployeePayrollProfileInput,
): Promise<EmployeePayrollProfileView> {
  return apiRequest<EmployeePayrollProfileView>(
    `/employees/${employeeId}/payroll-profile`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export interface CorrectEmploymentTypeInput {
  employeeType: EmployeeType
  reason: string
}

export function correctEmploymentType(
  accessToken: string,
  employeeId: string,
  input: CorrectEmploymentTypeInput,
): Promise<EmployeeDirectoryView> {
  return apiRequest<EmployeeDirectoryView>(
    `/employees/${employeeId}/employment/type`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export interface CorrectEmploymentStartDateInput {
  correctedStartDate: string
  reason: string
}

export function correctEmploymentStartDate(
  accessToken: string,
  employeeId: string,
  input: CorrectEmploymentStartDateInput,
): Promise<EmployeeDirectoryView> {
  return apiRequest<EmployeeDirectoryView>(
    `/employees/${employeeId}/employment/start-date`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export interface EmployeePayrollAccountRevealView {
  accountNumber: string
  accountNumberLast4: string
}

export function revealEmployeePayrollAccount(
  accessToken: string,
  employeeId: string,
): Promise<EmployeePayrollAccountRevealView> {
  return apiRequest<EmployeePayrollAccountRevealView>(
    `/employees/${employeeId}/payroll-profile/reveal-account`,
    accessToken,
    {
      method: 'POST',
    },
  )
}
