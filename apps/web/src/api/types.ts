export type DtrStatus =
  | 'DRAFT'
  | 'FOR_REVIEW'
  | 'VALIDATED'
  | 'LAST_PAY_REVIEW'

export type PayrollCutoffStatus =
  | 'OPEN'
  | 'LOCKED'
  | 'REOPENED'

export type EmployeePayrollStatus =
  | 'ACTIVE'
  | 'ACTIVE_HOLD'
  | 'RESIGNED'

export type OvertimeType =
  | 'REGULAR'
  | 'REST_DAY'
  | 'SPECIAL_HOLIDAY'
  | 'REGULAR_HOLIDAY'
  | 'REST_DAY_SPECIAL_HOLIDAY'
  | 'REST_DAY_REGULAR_HOLIDAY'

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CompanySummary {
  id: string
  code: string
  name: string
}

export interface CompanyListItem extends CompanySummary {
  status: string
  formattedAddress: string
}

export interface CompanyListResponse {
  items: CompanyListItem[]
  pagination: Pagination
}

export interface DtrEmployeeSummary {
  id: string
  employeeNumber: string
  firstName: string
  middleName: string | null
  lastName: string
  suffix: string | null
  currentStatus: EmployeePayrollStatus
}

export interface DtrEmploymentSummary {
  id: string
  companyEmployeeNumber: string | null
  startDate: string
  endDate: string | null

  department: {
    id: string
    code: string
    name: string
  } | null

  position: {
    id: string
    code: string
    name: string
  } | null
}

export interface PayrollCutoffSummary {
  id: string
  startDate: string
  endDate: string
  payDate: string
  status: PayrollCutoffStatus
}

export interface DtrListItem {
  id: string

  companyId: string
  employeeId: string
  employmentRecordId: string
  payrollCutoffId: string

  status: DtrStatus
  validatedAt: string | null

  createdAt: string
  updatedAt: string

  company: CompanySummary
  employee: DtrEmployeeSummary
  employmentRecord: DtrEmploymentSummary
  payrollCutoff: PayrollCutoffSummary

  _count: {
    entries: number
  }
}

export interface DtrListResponse {
  items: DtrListItem[]
  pagination: Pagination
}

export interface DtrEntry {
  id: string
  workDate: string

  regularMinutes: number
  lateMinutes: number
  undertimeMinutes: number
  absenceMinutes: number
  leaveMinutes: number
  nightDifferentialMinutes: number

  restDay: boolean

  leaveTypeId: string | null
  holidayId: string | null

  notes: string | null

  createdAt: string
  updatedAt: string

  leaveType: {
    id: string
    code: string
    name: string
    unit: string
  } | null

  holiday: {
    id: string
    name: string
    date: string
    type: string
  } | null

  overtimeEntries: Array<{
    id: string
    type: OvertimeType
    minutes: number
    createdAt: string
  }>
}

export interface DtrDetail extends DtrListItem {
  entries: DtrEntry[]
}

export interface ListDtrsQuery {
  companyId?: string
  employeeId?: string
  payrollCutoffId?: string
  status?: DtrStatus
  search?: string
  page?: number
  pageSize?: number
}

export interface CreateDtrInput {
  companyId: string
  employeeId: string
  payrollCutoffId: string
}

export interface CreateDtrEntryInput {
  workDate: string

  regularMinutes: number
  lateMinutes: number
  undertimeMinutes: number
  absenceMinutes: number
  leaveMinutes: number
  nightDifferentialMinutes: number

  restDay: boolean

  leaveTypeId?: string | null
  holidayId?: string | null

  notes?: string | null

  overtimeEntries?: Array<{
    type: OvertimeType
    minutes: number
  }>
}

export type UpdateDtrEntryInput =
  Partial<CreateDtrEntryInput>

export interface UpdateDtrStatusInput {
  status: DtrStatus
}

export interface DeleteDtrEntryResponse {
  deleted: true
  entryId: string
}

export interface AttendanceLeaveTypeReference {
  id: string
  code: string
  name: string
  unit: string
}

export interface AttendanceHolidayReference {
  id: string
  date: string
  name: string
  type: string
}

export interface AttendanceReferenceData {
  standardWorkMinutesPerDay: number
  leaveTypes: AttendanceLeaveTypeReference[]
  holidays: AttendanceHolidayReference[]
}
