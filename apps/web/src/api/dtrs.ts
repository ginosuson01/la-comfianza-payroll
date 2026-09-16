import { apiRequest } from './client'
import type {
  CreateDtrEntryInput,
  CreateDtrInput,
  DeleteDtrEntryResponse,
  DtrDetail,
  DtrEntry,
  DtrListResponse,
  ListDtrsQuery,
  UpdateDtrEntryInput,
  UpdateDtrStatusInput,
} from './types'

export type CreateDtrEntriesBulkInput =
  Omit<CreateDtrEntryInput, 'workDate'> & {
    workDates: string[]
  }

export interface CreateDtrEntriesBulkResponse {
  createdCount: number
  entries: DtrEntry[]
}

function toQueryString(
  query: ListDtrsQuery,
): string {
  const params =
    new URLSearchParams()

  if (query.companyId) {
    params.set(
      'companyId',
      query.companyId,
    )
  }

  if (query.employeeId) {
    params.set(
      'employeeId',
      query.employeeId,
    )
  }

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

  if (query.search?.trim()) {
    params.set(
      'search',
      query.search.trim(),
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

export function listDtrs(
  accessToken: string,
  query: ListDtrsQuery = {},
): Promise<DtrListResponse> {
  return apiRequest<DtrListResponse>(
    `/dtrs${toQueryString(query)}`,
    accessToken,
  )
}

export function getDtr(
  accessToken: string,
  dtrId: string,
): Promise<DtrDetail> {
  return apiRequest<DtrDetail>(
    `/dtrs/${dtrId}`,
    accessToken,
  )
}

export function createDtr(
  accessToken: string,
  input: CreateDtrInput,
): Promise<DtrDetail> {
  return apiRequest<DtrDetail>(
    '/dtrs',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function updateDtrStatus(
  accessToken: string,
  dtrId: string,
  input: UpdateDtrStatusInput,
): Promise<DtrDetail> {
  return apiRequest<DtrDetail>(
    `/dtrs/${dtrId}/status`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export function createDtrEntry(
  accessToken: string,
  dtrId: string,
  input: CreateDtrEntryInput,
): Promise<DtrEntry> {
  return apiRequest<DtrEntry>(
    `/dtrs/${dtrId}/entries`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function createDtrEntriesBulk(
  accessToken: string,
  dtrId: string,
  input: CreateDtrEntriesBulkInput,
): Promise<CreateDtrEntriesBulkResponse> {
  return apiRequest<CreateDtrEntriesBulkResponse>(
    `/dtrs/${dtrId}/entries/bulk`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function updateDtrEntry(
  accessToken: string,
  dtrId: string,
  entryId: string,
  input: UpdateDtrEntryInput,
): Promise<DtrEntry> {
  return apiRequest<DtrEntry>(
    `/dtrs/${dtrId}/entries/${entryId}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export function deleteDtrEntry(
  accessToken: string,
  dtrId: string,
  entryId: string,
): Promise<DeleteDtrEntryResponse> {
  return apiRequest<DeleteDtrEntryResponse>(
    `/dtrs/${dtrId}/entries/${entryId}`,
    accessToken,
    {
      method: 'DELETE',
    },
  )
}
