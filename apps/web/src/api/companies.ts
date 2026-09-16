import { apiRequest } from './client'
import type {
  CompanyListResponse,
} from './types'

export function listActiveCompanies(
  accessToken: string,
): Promise<CompanyListResponse> {
  const params =
    new URLSearchParams({
      status: 'ACTIVE',
      page: '1',
      pageSize: '100',
    })

  return apiRequest<CompanyListResponse>(
    `/companies?${params.toString()}`,
    accessToken,
  )
}
