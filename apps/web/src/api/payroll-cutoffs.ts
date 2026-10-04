import { apiRequest } from './client'
import type { PayrollCutoffSummary } from './types'

export interface ReopenPayrollCutoffInput {
  reason: string
}

export interface GeneratePayrollCutoffsInput {
  companyId: string
  cutoffTemplateId: string
  referenceMonth: string
}

export interface GeneratedPayrollCutoffItem {
  periodCode: string
  periodName: string
  created: boolean
  cutoff: PayrollCutoffSummary
}

export interface GeneratePayrollCutoffsResult {
  companyId: string
  cutoffTemplateId: string
  referenceMonth: string

  createdCount: number
  existingCount: number

  cutoffs: GeneratedPayrollCutoffItem[]
}

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

export function generatePayrollCutoffs(
  accessToken: string,
  input: GeneratePayrollCutoffsInput,
): Promise<GeneratePayrollCutoffsResult> {
  return apiRequest<GeneratePayrollCutoffsResult>(
    '/payroll-cutoffs/generate',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function reopenPayrollCutoff(
  accessToken: string,
  payrollCutoffId: string,
  input: ReopenPayrollCutoffInput,
): Promise<PayrollCutoffSummary> {
  return apiRequest<PayrollCutoffSummary>(
    `/payroll-cutoffs/${payrollCutoffId}/reopen`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}
