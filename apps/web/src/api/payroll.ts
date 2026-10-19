import { apiRequest } from './client'
import type {
  EmployeePayrollStatus,
  Pagination,
  PayrollCutoffStatus,
} from './types'

export type PayrollRunStatus =
  | 'CURRENT_LOCKED'
  | 'REOPENED_PENDING_REGENERATION'
  | 'SUPERSEDED'

export type PayoutMethod =
  | 'CASH'
  | 'ATM'

export type PayBasis =
  | 'DAILY'
  | 'MONTHLY'

export interface PayrollGeneratedBy {
  id: string
  username: string
  firstName: string
  lastName: string
}

export interface PayrollRunCutoff {
  startDate: string
  endDate: string
  payDate: string
  status: PayrollCutoffStatus
}

export interface PayrollRunHistoryItem {
  id: string
  companyId: string
  payrollCutoffId: string
  companyPayrollSetupVersionId: string

  version: number
  status: PayrollRunStatus
  generatedAt: string

  generatedBy: PayrollGeneratedBy
  cutoff: PayrollRunCutoff

  employeeCount: number

  totalGross: string
  totalNet: string
  clientPayableGross: string | null

  cashPayoutTotal: string
  atmPayoutTotal: string
  activeHoldTotal: string
}

export interface PayrollRunHistoryResponse {
  items: PayrollRunHistoryItem[]
  pagination: Pagination
}

export interface ListPayrollRunsQuery {
  payrollCutoffId?: string
  status?: PayrollRunStatus
  page?: number
  pageSize?: number
}

export interface PayrollRunStatusBreakdown {
  totalEmployees: number
  active: number
  activeHold: number
  resigned: number
}

export interface PayrollRunEmployeeDetail {
  id: string

  employeeId: string
  employmentRecordId: string

  employeeNumber: string
  employeeName: string

  position: string | null
  department: string | null

  payrollStatus: EmployeePayrollStatus

  payoutMethod: PayoutMethod
  payoutAccountLast4: string | null

  payBasis: PayBasis
  baseRate: string

  basicPay: string
  allowancesTotal: string
  premiumPayTotal: string
  grossPay: string

  governmentContributionsTotal: string
  taxTotal: string
  otherDeductionsTotal: string
  totalDeductions: string

  netPay: string

  cashPayout: string
  atmPayout: string

  heldAmount: string
  clientPayableGross: string | null

  taxableCompensation: string
  withholdingTax: string

  thirteenthMonthPay: string
  lastPayAmount: string

  isLastPay: boolean

  createdAt: string
}

export interface PayrollRunDetail
  extends PayrollRunHistoryItem {
  configSnapshot: unknown
  statusBreakdown: PayrollRunStatusBreakdown
  employees: PayrollRunEmployeeDetail[]
}

export interface EmployeePayrollHistoryItem {
  payrollRunEmployeeId: string

  payrollRun: {
    id: string
    version: number
    status: PayrollRunStatus
    generatedAt: string
  }

  cutoff: {
    id: string
    startDate: string
    endDate: string
    payDate: string
  }

  employeeId: string
  employmentRecordId: string

  employeeNumber: string
  employeeName: string

  position: string | null
  department: string | null

  payrollStatus: EmployeePayrollStatus

  payoutMethod: PayoutMethod
  payoutAccountLast4: string | null

  payBasis: PayBasis
  baseRate: string

  basicPay: string
  allowancesTotal: string
  premiumPayTotal: string
  grossPay: string

  governmentContributionsTotal: string
  taxTotal: string
  otherDeductionsTotal: string
  totalDeductions: string

  netPay: string

  cashPayout: string
  atmPayout: string

  heldAmount: string
  clientPayableGross: string | null

  taxableCompensation: string
  withholdingTax: string

  thirteenthMonthPay: string
  lastPayAmount: string

  isLastPay: boolean
}

export interface EmployeePayrollHistoryResponse {
  items: EmployeePayrollHistoryItem[]
  pagination: Pagination
}

export interface ListEmployeePayrollHistoryQuery {
  runStatus?: PayrollRunStatus
  page?: number
  pageSize?: number
}

export type PayrollReadinessIssueSource =
  | 'INPUT'
  | 'CALCULATION'

export interface PayrollReadinessIssue {
  source: PayrollReadinessIssueSource

  code: string

  employeeId?: string
  employeeNumber?: string

  message: string
}

export interface PayrollReadinessResponse {
  companyId: string
  payrollCutoffId: string

  ready: boolean

  eligibleEmployeeCount: number
  calculatedEmployeeCount: number

  issues: PayrollReadinessIssue[]
}

export interface GeneratedPayrollRunResult {
  id: string

  companyId: string
  payrollCutoffId: string

  version: number
  status: PayrollRunStatus

  employeeCount: number

  totalGross: string
  totalNet: string

  cashPayoutTotal: string
  atmPayoutTotal: string
  activeHoldTotal: string

  clientPayableGross: string | null
}


export type PayrollAdjustmentType =
  | 'EARNING'
  | 'DEDUCTION'

export type PayrollStatutoryBasisTreatment =
  | 'INCLUDE'
  | 'EXCLUDE'

export interface PayrollAdjustment {
  id: string

  companyId: string
  payrollCutoffId: string
  employeeId: string

  type: PayrollAdjustmentType

  code: string
  description: string

  amount: string

  reason: string

  taxable: boolean | null

  pagIbigFundSalaryTreatment:
    | PayrollStatutoryBasisTreatment
    | null

  createdByUserId: string
  createdAt: string
}

export interface CreatePayrollAdjustmentInput {
  type: PayrollAdjustmentType

  code: string
  description: string

  amount: number

  reason: string

  taxable?: boolean

  pagIbigFundSalaryTreatment?:
    PayrollStatutoryBasisTreatment
}

export interface UpdatePayrollAdjustmentInput {
  type?: PayrollAdjustmentType

  code?: string
  description?: string

  amount?: number

  reason?: string

  taxable?: boolean

  pagIbigFundSalaryTreatment?:
    PayrollStatutoryBasisTreatment
}

export interface DeletedPayrollAdjustmentResult {
  id: string
  deleted: true
}

function toPayrollRunQueryString(
  query: ListPayrollRunsQuery,
): string {
  const params =
    new URLSearchParams()

  if (query.payrollCutoffId) {
    params.set(
      'payrollCutoffId',
      query.payrollCutoffId,
    )
  }

  if (query.status) {
    params.set(
      'status',
      query.status,
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

function toEmployeeHistoryQueryString(
  query: ListEmployeePayrollHistoryQuery,
): string {
  const params =
    new URLSearchParams()

  if (query.runStatus) {
    params.set(
      'runStatus',
      query.runStatus,
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

export function listPayrollRuns(
  accessToken: string,
  companyId: string,
  query: ListPayrollRunsQuery = {},
): Promise<PayrollRunHistoryResponse> {
  return apiRequest<PayrollRunHistoryResponse>(
    `/payroll/companies/${companyId}/runs${toPayrollRunQueryString(query)}`,
    accessToken,
  )
}

export function getPayrollRunDetail(
  accessToken: string,
  companyId: string,
  payrollRunId: string,
): Promise<PayrollRunDetail> {
  return apiRequest<PayrollRunDetail>(
    `/payroll/companies/${companyId}/runs/${payrollRunId}`,
    accessToken,
  )
}

export function listEmployeePayrollHistory(
  accessToken: string,
  companyId: string,
  employeeId: string,
  query: ListEmployeePayrollHistoryQuery = {},
): Promise<EmployeePayrollHistoryResponse> {
  return apiRequest<EmployeePayrollHistoryResponse>(
    `/payroll/companies/${companyId}/employees/${employeeId}/history${toEmployeeHistoryQueryString(query)}`,
    accessToken,
  )
}

export function getPayrollReadiness(
  accessToken: string,
  companyId: string,
  payrollCutoffId: string,
): Promise<PayrollReadinessResponse> {
  return apiRequest<PayrollReadinessResponse>(
    `/payroll/companies/${companyId}/cutoffs/${payrollCutoffId}/readiness`,
    accessToken,
  )
}

export function generatePayroll(
  accessToken: string,
  companyId: string,
  payrollCutoffId: string,
): Promise<GeneratedPayrollRunResult> {
  return apiRequest<GeneratedPayrollRunResult>(
    `/payroll/companies/${companyId}/cutoffs/${payrollCutoffId}/generate`,
    accessToken,
    {
      method: 'POST',
    },
  )
}

export function regeneratePayroll(
  accessToken: string,
  companyId: string,
  payrollCutoffId: string,
): Promise<GeneratedPayrollRunResult> {
  return apiRequest<GeneratedPayrollRunResult>(
    `/payroll/companies/${companyId}/cutoffs/${payrollCutoffId}/regenerate`,
    accessToken,
    {
      method: 'POST',
    },
  )
}


export function listPayrollAdjustments(
  accessToken: string,
  companyId: string,
  payrollCutoffId: string,
  employeeId?: string,
): Promise<PayrollAdjustment[]> {
  const params =
    new URLSearchParams()

  if (employeeId) {
    params.set(
      'employeeId',
      employeeId,
    )
  }

  const query =
    params.toString()

  return apiRequest<PayrollAdjustment[]>(
    `/payroll/companies/${companyId}/cutoffs/${payrollCutoffId}/adjustments${
      query ? `?${query}` : ''
    }`,
    accessToken,
  )
}

export function createPayrollAdjustment(
  accessToken: string,
  companyId: string,
  payrollCutoffId: string,
  employeeId: string,
  input: CreatePayrollAdjustmentInput,
): Promise<PayrollAdjustment> {
  return apiRequest<PayrollAdjustment>(
    `/payroll/companies/${companyId}/cutoffs/${payrollCutoffId}/employees/${employeeId}/adjustments`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function updatePayrollAdjustment(
  accessToken: string,
  companyId: string,
  payrollCutoffId: string,
  employeeId: string,
  adjustmentId: string,
  input: UpdatePayrollAdjustmentInput,
): Promise<PayrollAdjustment> {
  return apiRequest<PayrollAdjustment>(
    `/payroll/companies/${companyId}/cutoffs/${payrollCutoffId}/employees/${employeeId}/adjustments/${adjustmentId}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export function deletePayrollAdjustment(
  accessToken: string,
  companyId: string,
  payrollCutoffId: string,
  employeeId: string,
  adjustmentId: string,
): Promise<DeletedPayrollAdjustmentResult> {
  return apiRequest<DeletedPayrollAdjustmentResult>(
    `/payroll/companies/${companyId}/cutoffs/${payrollCutoffId}/employees/${employeeId}/adjustments/${adjustmentId}`,
    accessToken,
    {
      method: 'DELETE',
    },
  )
}
