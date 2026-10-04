import { apiRequest } from './client'
import type { Pagination } from './types'

export type CompanyStatus =
  | 'ACTIVE'
  | 'INACTIVE'

export interface CompanyView {
  id: string
  code: string
  name: string

  addressLine1: string | null
  addressLine2: string | null
  barangay: string | null
  city: string | null
  province: string | null
  postalCode: string | null
  country: string

  formattedAddress: string

  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null

  status: CompanyStatus

  createdAt: string
  updatedAt: string
}

export interface CompanyListResponse {
  items: CompanyView[]
  pagination: Pagination
}

export interface ListCompaniesQuery {
  search?: string
  status?: CompanyStatus
  page?: number
  pageSize?: number
}

export interface CreateCompanyInput {
  code: string
  name: string

  addressLine1?: string
  addressLine2?: string
  barangay?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string

  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

export interface UpdateCompanyInput {
  name?: string

  addressLine1?: string | null
  addressLine2?: string | null
  barangay?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null
  country?: string

  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
}

function buildCompanyQuery(
  query: ListCompaniesQuery,
): string {
  const params =
    new URLSearchParams()

  if (query.search?.trim()) {
    params.set(
      'search',
      query.search.trim(),
    )
  }

  if (query.status) {
    params.set(
      'status',
      query.status,
    )
  }

  if (query.page) {
    params.set(
      'page',
      String(query.page),
    )
  }

  if (query.pageSize) {
    params.set(
      'pageSize',
      String(query.pageSize),
    )
  }

  return params.toString()
}

export function listCompanies(
  accessToken: string,
  query: ListCompaniesQuery = {},
): Promise<CompanyListResponse> {
  const queryString =
    buildCompanyQuery(query)

  return apiRequest<CompanyListResponse>(
    `/companies${
      queryString
        ? `?${queryString}`
        : ''
    }`,
    accessToken,
  )
}

export function listActiveCompanies(
  accessToken: string,
): Promise<CompanyListResponse> {
  return listCompanies(
    accessToken,
    {
      status: 'ACTIVE',
      page: 1,
      pageSize: 100,
    },
  )
}

export function getCompany(
  accessToken: string,
  companyId: string,
): Promise<CompanyView> {
  return apiRequest<CompanyView>(
    `/companies/${companyId}`,
    accessToken,
  )
}

export function createCompany(
  accessToken: string,
  input: CreateCompanyInput,
): Promise<CompanyView> {
  return apiRequest<CompanyView>(
    '/companies',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function updateCompany(
  accessToken: string,
  companyId: string,
  input: UpdateCompanyInput,
): Promise<CompanyView> {
  return apiRequest<CompanyView>(
    `/companies/${companyId}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export function updateCompanyStatus(
  accessToken: string,
  companyId: string,
  status: CompanyStatus,
): Promise<CompanyView> {
  return apiRequest<CompanyView>(
    `/companies/${companyId}/status`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
      }),
    },
  )
}

export async function getCompanyCompensation(
  accessToken: string,
  companyId: string,
): Promise<CompanyCompensationView | null> {
  const result =
    await apiRequest<
      CompanyCompensationView | null | undefined
    >(
      `/companies/${companyId}/compensation`,
      accessToken,
    )

  return result ?? null
}

export function listCompanyCompensationHistory(
  accessToken: string,
  companyId: string,
): Promise<CompanyCompensationView[]> {
  return apiRequest<CompanyCompensationView[]>(
    `/companies/${companyId}/compensation/history`,
    accessToken,
  )
}

export function createCompanyCompensation(
  accessToken: string,
  companyId: string,
  input: CreateCompanyCompensationInput,
): Promise<CompanyCompensationView> {
  return apiRequest<CompanyCompensationView>(
    `/companies/${companyId}/compensation`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function createCompanyCompensationVersion(
  accessToken: string,
  companyId: string,
  input: ChangeCompanyCompensationInput,
): Promise<CompanyCompensationView> {
  return apiRequest<CompanyCompensationView>(
    `/companies/${companyId}/compensation/versions`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export type CompanyPayBasis =
  | 'DAILY'
  | 'MONTHLY'

export interface CompanyCompensationView {
  id: string
  companyId: string

  payBasis: CompanyPayBasis
  rate: string

  effectiveFrom: string
  effectiveTo: string | null

  createdAt: string
}

export interface CreateCompanyCompensationInput {
  payBasis: CompanyPayBasis
  rate: number
  effectiveFrom: string
}

export interface ChangeCompanyCompensationInput {
  payBasis: CompanyPayBasis
  rate: number
}

export type ConfigStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'RETIRED'

export interface CompanyMinimumWageConfig {
  regionCode?: string
  wageOrderCode?: string
  areaClassification?: string
  sector?: string
  dailyRate: string
  rateEffectiveFrom: string
}

export interface CompanyPayrollSetupConfig {
  attendance?: {
    standardWorkMinutesPerDay?: number
  }

  statutory?: {
    philHealth?: {
      dailyWorkerScheduleDaysPerWeek?: number
    }

    minimumWage?: CompanyMinimumWageConfig
  }

  [key: string]: unknown
}

export interface CompanyPayrollSetupVersionView {
  id: string
  version: number

  status: ConfigStatus

  effectiveFrom: string | null
  effectiveTo: string | null

  config: CompanyPayrollSetupConfig

  createdAt: string
}

export interface CompanyPayrollSetupView {
  id: string
  companyId: string

  name: string
  status: ConfigStatus

  createdAt: string
  updatedAt: string

  activeVersion:
    | CompanyPayrollSetupVersionView
    | null
}

export interface CreateCompanyPayrollSetupInput {
  standardWorkMinutesPerDay: number
  philHealthDailyWorkerScheduleDaysPerWeek: number

  minimumWageRegionCode?: string
  minimumWageOrderCode?: string
  minimumWageAreaClassification?: string
  minimumWageSector?: string
  minimumWageDailyRate?: string
  minimumWageRateEffectiveFrom?: string

  effectiveFrom?: string
  effectiveTo?: string
}

export interface CreateCompanyPayrollSetupVersionInput {
  standardWorkMinutesPerDay: number
  philHealthDailyWorkerScheduleDaysPerWeek: number

  minimumWageRegionCode?: string
  minimumWageOrderCode?: string
  minimumWageAreaClassification?: string
  minimumWageSector?: string
  minimumWageDailyRate?: string
  minimumWageRateEffectiveFrom?: string

  effectiveFrom: string
  effectiveTo?: string
}

export type CutoffFrequency =
  | 'WEEKLY'
  | 'SEMI_MONTHLY'
  | 'MONTHLY'
  | 'CUSTOM'

export type CutoffDayMode =
  | 'DAY'
  | 'LAST_DAY'

export type CutoffMonthOffset =
  | -1
  | 0
  | 1

export interface CutoffDateRule {
  mode: CutoffDayMode
  day?: number
  monthOffset: CutoffMonthOffset
}

export interface SemiMonthlyCutoffPeriod {
  code: string
  name: string

  start: CutoffDateRule
  end: CutoffDateRule
  pay: CutoffDateRule
}

export interface SemiMonthlyCutoffConfiguration {
  periods: [
    SemiMonthlyCutoffPeriod,
    SemiMonthlyCutoffPeriod,
  ]
}

export interface CompanyCutoffTemplateView {
  id: string
  companyId: string

  code: string
  name: string

  frequency: CutoffFrequency

  configuration:
    SemiMonthlyCutoffConfiguration

  active: boolean

  createdAt: string
  updatedAt: string
}

export interface CreateCompanyCutoffTemplateInput {
  code: string
  name: string

  frequency: 'SEMI_MONTHLY'

  configuration:
    SemiMonthlyCutoffConfiguration
}

export function getCompanyPayrollSetup(
  accessToken: string,
  companyId: string,
): Promise<CompanyPayrollSetupView | null> {
  return apiRequest<CompanyPayrollSetupView | null>(
    `/companies/${companyId}/payroll-setup`,
    accessToken,
  )
}

export function createCompanyPayrollSetup(
  accessToken: string,
  companyId: string,
  input: CreateCompanyPayrollSetupInput,
): Promise<CompanyPayrollSetupView> {
  return apiRequest<CompanyPayrollSetupView>(
    `/companies/${companyId}/payroll-setup`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function createCompanyPayrollSetupVersion(
  accessToken: string,
  companyId: string,
  input: CreateCompanyPayrollSetupVersionInput,
): Promise<CompanyPayrollSetupView> {
  return apiRequest<CompanyPayrollSetupView>(
    `/companies/${companyId}/payroll-setup/versions`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function listCompanyCutoffTemplates(
  accessToken: string,
  companyId: string,
): Promise<CompanyCutoffTemplateView[]> {
  return apiRequest<CompanyCutoffTemplateView[]>(
    `/companies/${companyId}/cutoff-templates`,
    accessToken,
  )
}

export function createCompanyCutoffTemplate(
  accessToken: string,
  companyId: string,
  input: CreateCompanyCutoffTemplateInput,
): Promise<CompanyCutoffTemplateView> {
  return apiRequest<CompanyCutoffTemplateView>(
    `/companies/${companyId}/cutoff-templates`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}
