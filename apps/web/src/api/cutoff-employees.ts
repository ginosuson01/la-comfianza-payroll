import { apiRequest } from './client'
import type {
  DtrStatus,
  EmployeePayrollStatus,
} from './types'

export interface CutoffEmployeeDtrSummary {
  id: string
  status: DtrStatus
  entryCount: number
}

export interface CutoffEmployeeView {
  employeeId: string
  employeeNumber: string

  firstName: string
  middleName: string | null
  lastName: string
  suffix: string | null

  currentStatus: EmployeePayrollStatus

  employmentRecordId: string
  companyEmployeeNumber: string | null

  employmentStartDate: string
  employmentEndDate: string | null

  dtr: CutoffEmployeeDtrSummary | null
}

export interface ListCutoffEmployeesQuery {
  companyId: string
  payrollCutoffId: string
  search?: string
}

export function listCutoffEmployees(
  accessToken: string,
  query: ListCutoffEmployeesQuery,
): Promise<CutoffEmployeeView[]> {
  const params = new URLSearchParams({
    companyId: query.companyId,
    payrollCutoffId: query.payrollCutoffId,
  })

  if (query.search?.trim()) {
    params.set(
      'search',
      query.search.trim(),
    )
  }

  return apiRequest<CutoffEmployeeView[]>(
    `/attendance/cutoff-employees?${params.toString()}`,
    accessToken,
  )
}
