import { apiRequest } from './client'
import type { PayrollCutoffSummary } from './types'

export function listPayrollCutoffs(
  accessToken: string,
  companyId: string,
): Promise<PayrollCutoffSummary[]> {
  const params = new URLSearchParams({
    companyId,
  })

  return apiRequest<PayrollCutoffSummary[]>(
    `/payroll-cutoffs?${params.toString()}`,
    accessToken,
  )
}
