import { apiRequest } from './client'
import type { AttendanceReferenceData } from './types'

export interface AttendanceReferenceQuery {
  companyId: string
  startDate: string
  endDate: string
}

export function getAttendanceReferenceData(
  accessToken: string,
  query: AttendanceReferenceQuery,
): Promise<AttendanceReferenceData> {
  const params = new URLSearchParams({
    companyId: query.companyId,
    startDate: query.startDate,
    endDate: query.endDate,
  })

  return apiRequest<AttendanceReferenceData>(
    `/attendance-reference?${params.toString()}`,
    accessToken,
  )
}
