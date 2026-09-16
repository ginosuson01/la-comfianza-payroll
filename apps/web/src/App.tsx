import { useEffect, useState } from 'react'

import { getAttendanceReferenceData } from './api/attendance-reference'
import { listActiveCompanies } from './api/companies'
import { ApiError } from './api/client'
import {
  createDtrEntriesBulk,
  deleteDtrEntry,
  listDtrs,
  updateDtrEntry,
  updateDtrStatus,
} from './api/dtrs'
import { listPayrollCutoffs } from './api/payroll-cutoffs'
import type {
  AttendanceHolidayReference,
  AttendanceLeaveTypeReference,
  CompanyListItem,
  DtrEntry,
  DtrListItem,
  DtrStatus,
  OvertimeType,
  PayrollCutoffSummary,
} from './api/types'
import { useAuth } from './auth/use-auth'
import { MultiWorkDateSelector } from './attendance/MultiWorkDateSelector'
import { SelectedDtrDetail } from './attendance/SelectedDtrDetail'

import './App.css'

type AttendanceDraft = {
  workDate: string
  regularMinutes: string
  lateMinutes: string
  undertimeMinutes: string
  absenceMinutes: string
  leaveType: string
  leaveMinutes: string
  overtimeType: string
  overtimeMinutes: string
  nightDifferentialMinutes: string
  restDay: boolean
  holiday: string
  notes: string
}

const emptyAttendanceDraft: AttendanceDraft = {
  workDate: '',
  regularMinutes: '0',
  lateMinutes: '0',
  undertimeMinutes: '0',
  absenceMinutes: '0',
  leaveType: '',
  leaveMinutes: '0',
  overtimeType: '',
  overtimeMinutes: '0',
  nightDifferentialMinutes: '0',
  restDay: false,
  holiday: '',
  notes: '',
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function formatStatus(status: DtrStatus) {
  return status
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

function formatCutoffStatus(status: PayrollCutoffSummary['status']) {
  return status
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

function getDateParts(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)

  return {
    year,
    month,
    day,
  }
}

function formatCutoff(cutoff: PayrollCutoffSummary) {
  const start = getDateParts(cutoff.startDate)
  const end = getDateParts(cutoff.endDate)

  if (
    start.year === end.year &&
    start.month === end.month
  ) {
    return `${monthNames[start.month - 1]} ${start.day}–${end.day}, ${
      start.year
    }`
  }

  return `${monthNames[start.month - 1]} ${start.day}, ${
    start.year
  } – ${monthNames[end.month - 1]} ${end.day}, ${end.year}`
}

function formatEmployeeName(employee: DtrListItem['employee']) {
  return [
    employee.firstName,
    employee.middleName,
    employee.lastName,
    employee.suffix,
  ]
    .filter(Boolean)
    .join(' ')
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to load data.'
}

function getAllowedOvertimeTypes(
  restDay: boolean,
  holidayType: string | null,
): OvertimeType[] {
  if (!holidayType) {
    return [restDay ? 'REST_DAY' : 'REGULAR']
  }

  if (holidayType === 'REGULAR') {
    return [
      restDay
        ? 'REST_DAY_REGULAR_HOLIDAY'
        : 'REGULAR_HOLIDAY',
    ]
  }

  if (holidayType === 'SPECIAL_NON_WORKING') {
    return [
      restDay
        ? 'REST_DAY_SPECIAL_HOLIDAY'
        : 'SPECIAL_HOLIDAY',
    ]
  }

  if (holidayType === 'SPECIAL_WORKING') {
    return [restDay ? 'REST_DAY' : 'REGULAR']
  }

  return restDay
    ? ['REST_DAY', 'REST_DAY_SPECIAL_HOLIDAY']
    : ['REGULAR', 'SPECIAL_HOLIDAY']
}

function App() {
  const { accessToken } = useAuth()

  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [company, setCompany] = useState('')
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [companyError, setCompanyError] = useState<string | null>(null)

  const [cutoffs, setCutoffs] = useState<PayrollCutoffSummary[]>([])
  const [cutoff, setCutoff] = useState('')
  const [cutoffsLoading, setCutoffsLoading] = useState(false)
  const [cutoffError, setCutoffError] = useState<string | null>(null)

  const [dtrs, setDtrs] = useState<DtrListItem[]>([])
  const [dtrTotal, setDtrTotal] = useState(0)
  const [dtrsLoading, setDtrsLoading] = useState(false)
  const [dtrError, setDtrError] = useState<string | null>(null)

  const [leaveTypes, setLeaveTypes] =
    useState<AttendanceLeaveTypeReference[]>([])

  const [holidays, setHolidays] =
    useState<AttendanceHolidayReference[]>([])

  const [referenceLoading, setReferenceLoading] = useState(false)
  const [referenceError, setReferenceError] =
    useState<string | null>(null)

  const [
    standardWorkMinutesPerDay,
    setStandardWorkMinutesPerDay,
  ] = useState(0)

  const [
    regularMinutesManualOverride,
    setRegularMinutesManualOverride,
  ] = useState(false)

  const [status, setStatus] = useState<'ALL' | DtrStatus>('ALL')
  const [search, setSearch] = useState('')
  const [selectedDtrId, setSelectedDtrId] = useState('')

  const [attendanceDraft, setAttendanceDraft] =
    useState<AttendanceDraft>(emptyAttendanceDraft)

  const [selectedWorkDates, setSelectedWorkDates] =
    useState<string[]>([])

  const [recordedEntries, setRecordedEntries] =
    useState<DtrEntry[]>([])

  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingDtrId, setEditingDtrId] = useState<string | null>(null)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [entrySaving, setEntrySaving] = useState(false)
  const [entryMessage, setEntryMessage] = useState<string | null>(null)
  const [entryError, setEntryError] = useState<string | null>(null)

  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewMessage, setReviewMessage] =
    useState<string | null>(null)
  const [reviewError, setReviewError] =
    useState<string | null>(null)

  const [dtrRefreshKey, setDtrRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadCompanies() {
      setCompaniesLoading(true)
      setCompanyError(null)

      try {
        const response = await listActiveCompanies(accessToken)

        if (cancelled) {
          return
        }

        setCompanies(response.items)

        setCompany((currentCompany) => {
          if (
            currentCompany &&
            response.items.some(
              (item) => item.id === currentCompany,
            )
          ) {
            return currentCompany
          }

          return response.items[0]?.id ?? ''
        })
      } catch (error: unknown) {
        if (cancelled) {
          return
        }

        setCompanies([])
        setCompany('')
        setCompanyError(getErrorMessage(error))
      } finally {
        if (!cancelled) {
          setCompaniesLoading(false)
        }
      }
    }

    void loadCompanies()

    return () => {
      cancelled = true
    }
  }, [accessToken])

  useEffect(() => {
    let cancelled = false

    if (!company) {
      setCutoffs([])
      setCutoff('')
      setCutoffError(null)
      setCutoffsLoading(false)

      return () => {
        cancelled = true
      }
    }

    async function loadCutoffs() {
      setCutoffsLoading(true)
      setCutoffError(null)

      try {
        const response = await listPayrollCutoffs(
          accessToken,
          company,
        )

        if (cancelled) {
          return
        }

        setCutoffs(response)

        setCutoff((currentCutoff) => {
          if (
            currentCutoff &&
            response.some(
              (item) => item.id === currentCutoff,
            )
          ) {
            return currentCutoff
          }

          return response[0]?.id ?? ''
        })
      } catch (error: unknown) {
        if (cancelled) {
          return
        }

        setCutoffs([])
        setCutoff('')
        setCutoffError(getErrorMessage(error))
      } finally {
        if (!cancelled) {
          setCutoffsLoading(false)
        }
      }
    }

    void loadCutoffs()

    return () => {
      cancelled = true
    }
  }, [accessToken, company])

  useEffect(() => {
    let cancelled = false

    const selectedCutoff =
      cutoffs.find((item) => item.id === cutoff)

    if (!company || !selectedCutoff) {
      setStandardWorkMinutesPerDay(0)
      setLeaveTypes([])
      setHolidays([])
      setReferenceError(null)
      setReferenceLoading(false)

      return () => {
        cancelled = true
      }
    }

    async function loadAttendanceReferenceData() {
      setReferenceLoading(true)
      setReferenceError(null)

      try {
        const response =
          await getAttendanceReferenceData(accessToken, {
            companyId: company,
            startDate: selectedCutoff.startDate.slice(0, 10),
            endDate: selectedCutoff.endDate.slice(0, 10),
          })

        if (cancelled) {
          return
        }

        setStandardWorkMinutesPerDay(
          response.standardWorkMinutesPerDay,
        )

        setLeaveTypes(response.leaveTypes)
        setHolidays(response.holidays)
      } catch (error: unknown) {
        if (cancelled) {
          return
        }

        setStandardWorkMinutesPerDay(0)
        setLeaveTypes([])
        setHolidays([])
        setReferenceError(getErrorMessage(error))
      } finally {
        if (!cancelled) {
          setReferenceLoading(false)
        }
      }
    }

    void loadAttendanceReferenceData()

    return () => {
      cancelled = true
    }
  }, [accessToken, company, cutoff, cutoffs])

  useEffect(() => {
    let cancelled = false

    if (!company || !cutoff) {
      setDtrs([])
      setDtrTotal(0)
      setSelectedDtrId('')
      setDtrError(null)
      setDtrsLoading(false)

      return () => {
        cancelled = true
      }
    }

    const timeoutId = window.setTimeout(() => {
      async function loadFilteredDtrs() {
        setDtrsLoading(true)
        setDtrError(null)

        try {
          const normalizedSearch = search.trim()

          const response = await listDtrs(accessToken, {
            companyId: company,
            payrollCutoffId: cutoff,
            status: status === 'ALL' ? undefined : status,
            search:
              normalizedSearch.length > 0
                ? normalizedSearch
                : undefined,
            page: 1,
            pageSize: 100,
          })

          if (cancelled) {
            return
          }

          setDtrs(response.items)
          setDtrTotal(response.pagination.total)

          setSelectedDtrId((currentDtrId) => {
            if (
              currentDtrId &&
              response.items.some(
                (item) => item.id === currentDtrId,
              )
            ) {
              return currentDtrId
            }

            return response.items[0]?.id ?? ''
          })
        } catch (error: unknown) {
          if (cancelled) {
            return
          }

          setDtrs([])
          setDtrTotal(0)
          setSelectedDtrId('')
          setDtrError(getErrorMessage(error))
        } finally {
          if (!cancelled) {
            setDtrsLoading(false)
          }
        }
      }

      void loadFilteredDtrs()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [
    accessToken,
    company,
    cutoff,
    search,
    status,
    dtrRefreshKey,
  ])

  const selectedDtr =
    dtrs.find((dtr) => dtr.id === selectedDtrId) ?? dtrs[0]

  const cutoffIsLocked =
    selectedDtr?.payrollCutoff.status === 'LOCKED'

  const dtrIsValidated =
    selectedDtr?.status === 'VALIDATED'

  const isReadOnly =
    !selectedDtr ||
    dtrIsValidated ||
    cutoffIsLocked

  const workDateHolidays =
    attendanceDraft.workDate
      ? holidays.filter(
          (holiday) =>
            holiday.date.slice(0, 10) ===
            attendanceDraft.workDate,
        )
      : []

  function draftMinutes(value: string) {
    const parsed = Number(value)

    if (
      !Number.isInteger(parsed) ||
      parsed < 0
    ) {
      return 0
    }

    return parsed
  }

  const selectedHoliday =
    workDateHolidays.find(
      (holiday) =>
        holiday.id === attendanceDraft.holiday,
    ) ?? null

  const allowedOvertimeTypes =
    getAllowedOvertimeTypes(
      attendanceDraft.restDay,
      selectedHoliday?.type ?? null,
    )

  const suggestedRegularMinutes =
    attendanceDraft.restDay
      ? 0
      : Math.max(
          0,
          standardWorkMinutesPerDay -
            draftMinutes(attendanceDraft.lateMinutes) -
            draftMinutes(attendanceDraft.undertimeMinutes) -
            draftMinutes(attendanceDraft.absenceMinutes) -
            draftMinutes(attendanceDraft.leaveMinutes),
        )

  const accountedScheduledMinutes =
    draftMinutes(attendanceDraft.regularMinutes) +
    draftMinutes(attendanceDraft.lateMinutes) +
    draftMinutes(attendanceDraft.undertimeMinutes) +
    draftMinutes(attendanceDraft.absenceMinutes) +
    draftMinutes(attendanceDraft.leaveMinutes)

  const accountedMinutesMismatch =
    !attendanceDraft.restDay &&
    standardWorkMinutesPerDay > 0 &&
    accountedScheduledMinutes !==
      standardWorkMinutesPerDay

  useEffect(() => {
    setEditingEntryId(null)
    setEditingDtrId(null)
    setEntryMessage(null)
    setEntryError(null)

    setReviewMessage(null)
    setReviewError(null)

    setRegularMinutesManualOverride(false)
    setSelectedWorkDates([])
    setRecordedEntries([])

    setAttendanceDraft({
      ...emptyAttendanceDraft,
      regularMinutes:
        String(standardWorkMinutesPerDay),
    })
  }, [
    selectedDtrId,
    standardWorkMinutesPerDay,
  ])

  function updateAttendanceDraft(
    field: keyof AttendanceDraft,
    value: string | boolean,
  ) {
    if (field === 'regularMinutes') {
      setRegularMinutesManualOverride(true)
    }

    setAttendanceDraft((current) => {
      if (field === 'workDate') {
        return {
          ...current,
          workDate: value as string,
          holiday: '',
          overtimeType: '',
          overtimeMinutes: '0',
        }
      }

      if (field === 'holiday') {
        return {
          ...current,
          holiday: value as string,
          overtimeType: '',
          overtimeMinutes: '0',
        }
      }

      if (field === 'restDay') {
        const restDay = value as boolean

        return {
          ...current,
          restDay,

          lateMinutes:
            restDay ? '0' : current.lateMinutes,

          undertimeMinutes:
            restDay ? '0' : current.undertimeMinutes,

          absenceMinutes:
            restDay ? '0' : current.absenceMinutes,

          leaveType:
            restDay ? '' : current.leaveType,

          leaveMinutes:
            restDay ? '0' : current.leaveMinutes,

          overtimeType: '',
          overtimeMinutes: '0',

          ...(!regularMinutesManualOverride
            ? {
                regularMinutes: restDay
                  ? '0'
                  : String(standardWorkMinutesPerDay),
              }
            : {}),
        }
      }

      const updated = {
        ...current,
        [field]: value,
      }

      const affectsSuggestedRegular =
        field === 'lateMinutes' ||
        field === 'undertimeMinutes' ||
        field === 'absenceMinutes' ||
        field === 'leaveMinutes'

      if (
        affectsSuggestedRegular &&
        !regularMinutesManualOverride &&
        standardWorkMinutesPerDay > 0
      ) {
        const lateMinutes =
          field === 'lateMinutes'
            ? draftMinutes(value as string)
            : draftMinutes(updated.lateMinutes)

        const undertimeMinutes =
          field === 'undertimeMinutes'
            ? draftMinutes(value as string)
            : draftMinutes(updated.undertimeMinutes)

        const absenceMinutes =
          field === 'absenceMinutes'
            ? draftMinutes(value as string)
            : draftMinutes(updated.absenceMinutes)

        const leaveMinutes =
          field === 'leaveMinutes'
            ? draftMinutes(value as string)
            : draftMinutes(updated.leaveMinutes)

        return {
          ...updated,
          regularMinutes: String(
            Math.max(
              0,
              standardWorkMinutesPerDay -
                lateMinutes -
                undertimeMinutes -
                absenceMinutes -
                leaveMinutes,
            ),
          ),
        }
      }

      return updated
    })
  }

  const recordedWorkDates =
    recordedEntries.map(
      (entry) =>
        entry.workDate.slice(0, 10),
    )

  function handleWorkDatesChange(
    workDates: string[],
  ) {
    setSelectedWorkDates(
      workDates,
    )

    setAttendanceDraft(
      (current) => ({
        ...current,

        workDate:
          workDates.length === 1
            ? workDates[0]
            : '',

        holiday: '',
      }),
    )

    setEntryMessage(null)
    setEntryError(null)
  }

  function useSuggestedRegularMinutes() {
    setRegularMinutesManualOverride(false)

    setAttendanceDraft((current) => ({
      ...current,
      regularMinutes:
        String(suggestedRegularMinutes),
    }))
  }

  function resetAttendanceDraft() {
    setRegularMinutesManualOverride(false)
    setSelectedWorkDates([])

    setAttendanceDraft({
      ...emptyAttendanceDraft,
      regularMinutes:
        String(standardWorkMinutesPerDay),
    })

    setEntryMessage(null)
    setEntryError(null)
  }

  function handleEditEntry(entry: DtrEntry) {
    if (
      !selectedDtr ||
      isReadOnly
    ) {
      return
    }

    const overtime = entry.overtimeEntries[0]

    setEditingEntryId(entry.id)
    setEditingDtrId(selectedDtr.id)
    setEntryMessage(null)
    setEntryError(null)
    setRegularMinutesManualOverride(true)
    setSelectedWorkDates([])

    setAttendanceDraft({
      workDate: entry.workDate.slice(0, 10),

      regularMinutes:
        String(entry.regularMinutes),

      lateMinutes:
        String(entry.lateMinutes),

      undertimeMinutes:
        String(entry.undertimeMinutes),

      absenceMinutes:
        String(entry.absenceMinutes),

      leaveType:
        entry.leaveTypeId ?? '',

      leaveMinutes:
        String(entry.leaveMinutes),

      overtimeType:
        overtime?.type ?? '',

      overtimeMinutes:
        String(
          entry.overtimeEntries.reduce(
            (total, item) => total + item.minutes,
            0,
          ),
        ),

      nightDifferentialMinutes:
        String(entry.nightDifferentialMinutes),

      restDay:
        entry.restDay,

      holiday:
        entry.holidayId ?? '',

      notes:
        entry.notes ?? '',
    })
  }

  function handleCancelEdit() {
    setEditingEntryId(null)
    setEditingDtrId(null)
    setEntryMessage(null)
    setEntryError(null)
    resetAttendanceDraft()
  }

  async function handleDeleteEntry(entry: DtrEntry) {
    if (
      !selectedDtr ||
      isReadOnly ||
      deletingEntryId
    ) {
      return
    }

    const confirmed = window.confirm(
      `Delete the attendance entry for ${entry.workDate.slice(0, 10)}?`,
    )

    if (!confirmed) {
      return
    }

    setDeletingEntryId(entry.id)
    setEntryMessage(null)
    setEntryError(null)

    try {
      await deleteDtrEntry(
        accessToken,
        selectedDtr.id,
        entry.id,
      )

      setDtrs((current) =>
        current.map((dtr) =>
          dtr.id === selectedDtr.id
            ? {
                ...dtr,
                _count: {
                  entries: Math.max(
                    0,
                    dtr._count.entries - 1,
                  ),
                },
              }
            : dtr,
        ),
      )

      if (editingEntryId === entry.id) {
        setEditingEntryId(null)
        setEditingDtrId(null)
        resetAttendanceDraft()
      }

      setDetailRefreshKey(
        (current) => current + 1,
      )

      setEntryMessage(
        'Daily attendance entry deleted successfully.',
      )
    } catch (error: unknown) {
      setEntryError(
        getErrorMessage(error),
      )
    } finally {
      setDeletingEntryId(null)
    }
  }

  function handleCompanyChange(companyId: string) {
    setCompany(companyId)

    setCutoffs([])
    setCutoff('')

    setDtrs([])
    setDtrTotal(0)
    setSelectedDtrId('')

    setCutoffError(null)
    setDtrError(null)
  }

  function handleCutoffChange(cutoffId: string) {
    setCutoff(cutoffId)

    setDtrs([])
    setDtrTotal(0)
    setSelectedDtrId('')
    setDtrError(null)
  }

  function toNonNegativeInteger(
    value: string,
    fieldName: string,
  ) {
    const parsed = Number(value)

    if (
      !Number.isInteger(parsed) ||
      parsed < 0
    ) {
      throw new Error(
        `${fieldName} must be a non-negative whole number.`,
      )
    }

    return parsed
  }

  async function handleSaveDailyEntry() {
    if (
      !selectedDtr ||
      isReadOnly ||
      entrySaving
    ) {
      return
    }

    setEntryMessage(null)
    setEntryError(null)

    const workDates =
      editingEntryId
        ? attendanceDraft.workDate
          ? [attendanceDraft.workDate]
          : []
        : selectedWorkDates

    if (workDates.length === 0) {
      setEntryError(
        editingEntryId
          ? 'Work date is required.'
          : 'Select at least one work date.',
      )
      return
    }

    const cutoffStartDate =
      selectedDtr.payrollCutoff.startDate.slice(0, 10)

    const cutoffEndDate =
      selectedDtr.payrollCutoff.endDate.slice(0, 10)

    if (
      workDates.some(
        (workDate) =>
          workDate < cutoffStartDate ||
          workDate > cutoffEndDate,
      )
    ) {
      setEntryError(
        'DTR work date must be within the payroll cutoff period.',
      )
      return
    }

    if (attendanceDraft.notes.length > 500) {
      setEntryError(
        'Notes must not exceed 500 characters.',
      )
      return
    }

    try {
      const regularMinutes =
        toNonNegativeInteger(
          attendanceDraft.regularMinutes,
          'Regular Minutes',
        )

      const lateMinutes =
        toNonNegativeInteger(
          attendanceDraft.lateMinutes,
          'Late Minutes',
        )

      const undertimeMinutes =
        toNonNegativeInteger(
          attendanceDraft.undertimeMinutes,
          'Undertime Minutes',
        )

      const absenceMinutes =
        toNonNegativeInteger(
          attendanceDraft.absenceMinutes,
          'Absence Minutes',
        )

      const leaveMinutes =
        toNonNegativeInteger(
          attendanceDraft.leaveMinutes,
          'Leave Minutes',
        )

      const nightDifferentialMinutes =
        toNonNegativeInteger(
          attendanceDraft.nightDifferentialMinutes,
          'Night Differential',
        )

      if (
        attendanceDraft.restDay &&
        (
          lateMinutes > 0 ||
          undertimeMinutes > 0 ||
          absenceMinutes > 0 ||
          leaveMinutes > 0
        )
      ) {
        throw new Error(
          'Late, undertime, absence, and leave minutes must be zero on a rest day.',
        )
      }

      const unavailableScheduledMinutes =
        lateMinutes +
        undertimeMinutes +
        absenceMinutes +
        leaveMinutes

      if (
        !attendanceDraft.restDay &&
        standardWorkMinutesPerDay > 0 &&
        unavailableScheduledMinutes >
          standardWorkMinutesPerDay
      ) {
        throw new Error(
          `Late, undertime, absence, and leave minutes cannot exceed the configured ${standardWorkMinutesPerDay}-minute workday.`,
        )
      }

      if (
        leaveMinutes > 0 &&
        !attendanceDraft.leaveType
      ) {
        throw new Error(
          'Select a leave type when Leave Minutes is greater than 0.',
        )
      }

      if (
        attendanceDraft.leaveType &&
        leaveMinutes === 0
      ) {
        throw new Error(
          'Leave Minutes must be greater than 0 when a leave type is selected.',
        )
      }

      const overtimeMinutes =
        toNonNegativeInteger(
          attendanceDraft.overtimeMinutes,
          'Overtime Minutes',
        )

      if (
        overtimeMinutes > 0 &&
        !attendanceDraft.overtimeType
      ) {
        throw new Error(
          'Select an overtime type when Overtime Minutes is greater than 0.',
        )
      }

      if (
        attendanceDraft.overtimeType &&
        overtimeMinutes === 0
      ) {
        throw new Error(
          'Overtime Minutes must be greater than 0 when an overtime type is selected.',
        )
      }

      const overtimeEntries =
        attendanceDraft.overtimeType &&
        overtimeMinutes > 0
          ? [
              {
                type:
                  attendanceDraft.overtimeType as OvertimeType,
                minutes: overtimeMinutes,
              },
            ]
          : []

      if (
        attendanceDraft.overtimeType &&
        !allowedOvertimeTypes.includes(
          attendanceDraft.overtimeType as OvertimeType,
        )
      ) {
        throw new Error(
          'The selected overtime type does not match the Rest Day / Holiday classification.',
        )
      }

      if (
        nightDifferentialMinutes >
        regularMinutes + overtimeMinutes
      ) {
        throw new Error(
          'Night Differential minutes cannot exceed total worked Regular + Overtime minutes.',
        )
      }

      setEntrySaving(true)

      const entryValues = {
        regularMinutes,
        lateMinutes,
        undertimeMinutes,
        absenceMinutes,
        leaveMinutes,
        nightDifferentialMinutes,

        restDay:
          attendanceDraft.restDay,

        leaveTypeId:
          attendanceDraft.leaveType ||
          null,

        holidayId:
          attendanceDraft.holiday ||
          null,

        notes:
          attendanceDraft.notes.trim() ||
          null,

        overtimeEntries,
      }

      if (editingEntryId) {
        if (
          !editingDtrId ||
          editingDtrId !== selectedDtr.id
        ) {
          throw new Error(
            'The selected employee changed while editing. Reopen the attendance entry before saving.',
          )
        }

        await updateDtrEntry(
          accessToken,
          editingDtrId,
          editingEntryId,
          {
            workDate:
              attendanceDraft.workDate,

            ...entryValues,
          },
        )

        setEntryMessage(
          'Daily attendance entry updated successfully.',
        )

        setEditingEntryId(null)
        setEditingDtrId(null)
        setRegularMinutesManualOverride(false)
        setAttendanceDraft({
          ...emptyAttendanceDraft,
          regularMinutes:
            String(standardWorkMinutesPerDay),
        })
      } else {
        const bulkResult =
          await createDtrEntriesBulk(
            accessToken,
            selectedDtr.id,
            {
              workDates:
                selectedWorkDates,

              ...entryValues,
            },
          )

        setDtrs((current) =>
          current.map((dtr) =>
            dtr.id === selectedDtr.id
              ? {
                  ...dtr,
                  _count: {
                    entries:
                      dtr._count.entries +
                        bulkResult.createdCount,
                  },
                }
              : dtr,
          ),
        )

        setEntryMessage(
          bulkResult.createdCount === 1
            ? 'Daily attendance entry created successfully.'
            : `${bulkResult.createdCount} daily attendance entries created successfully.`,
        )

        setSelectedWorkDates([])

        setRegularMinutesManualOverride(false)
        setAttendanceDraft({
          ...emptyAttendanceDraft,
          regularMinutes:
            String(standardWorkMinutesPerDay),
        })
      }

      setDetailRefreshKey(
        (current) => current + 1,
      )
    } catch (error: unknown) {
      setEntryError(
        getErrorMessage(error),
      )
    } finally {
      setEntrySaving(false)
    }
  }

  async function handleDtrStatusChange(
    nextStatus: DtrStatus,
    successMessage: string,
  ) {
    if (
      !selectedDtr ||
      reviewSaving ||
      cutoffIsLocked
    ) {
      return
    }

    if (
      nextStatus === 'VALIDATED' &&
      !window.confirm(
        'Validate this DTR? Attendance will become read-only until the DTR is returned to review.',
      )
    ) {
      return
    }

    setReviewSaving(true)
    setReviewMessage(null)
    setReviewError(null)

    try {
      const updatedDtr =
        await updateDtrStatus(
          accessToken,
          selectedDtr.id,
          {
            status: nextStatus,
          },
        )

      setDtrs((current) =>
        current.map((dtr) =>
          dtr.id === updatedDtr.id
            ? {
                ...dtr,
                status: updatedDtr.status,
                validatedAt:
                  updatedDtr.validatedAt,
                updatedAt:
                  updatedDtr.updatedAt,
              }
            : dtr,
        ),
      )

      setReviewMessage(successMessage)

      /*
       * Refresh from the API as the authoritative source.
       * This also handles an active status filter correctly:
       * for example, a DRAFT record disappears from a
       * DRAFT-only list after it becomes FOR_REVIEW.
       */
      setDtrRefreshKey(
        (current) => current + 1,
      )

      setDetailRefreshKey(
        (current) => current + 1,
      )
    } catch (error: unknown) {
      setReviewError(
        getErrorMessage(error),
      )
    } finally {
      setReviewSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">LC</div>

          <div>
            <strong>La Comfianza</strong>
            <span>Payroll System</span>
          </div>
        </div>

        <nav
          className="navigation"
          aria-label="Main navigation"
        >
          <button type="button">Dashboard</button>
          <button type="button">Companies</button>
          <button type="button">Employees</button>

          <button
            type="button"
            className="active"
          >
            Attendance / DTR
          </button>

          <button type="button">Payroll</button>
          <button type="button">Reports</button>
          <button type="button">Activity Log</button>
        </nav>

        <div className="sidebar-footer">
          <span>Signed in as</span>
          <strong>Payroll Manager</strong>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Phase 1 · Payroll Manager
            </p>

            <h1>
              Attendance &amp; Daily Time Record
            </h1>

            <p className="page-description">
              Encode, review, and validate employee attendance before
              payroll generation.
            </p>
          </div>

          <div className="topbar-actions">
            <span className="environment-badge">
              Development
            </span>
          </div>
        </header>

        <section className="filter-card">
          <div className="filter-heading">
            <div>
              <h2>Attendance Review</h2>

              <p>
                Select a company and payroll cutoff, then review
                employee DTRs.
              </p>
            </div>
          </div>

          <div className="filters">
            <label>
              <span>Company</span>

              <select
                value={company}
                disabled={
                  companiesLoading ||
                  companies.length === 0
                }
                onChange={(event) =>
                  handleCompanyChange(event.target.value)
                }
              >
                {companiesLoading && (
                  <option value="">
                    Loading companies...
                  </option>
                )}

                {!companiesLoading &&
                  companyError && (
                    <option value="">
                      Unable to load companies
                    </option>
                  )}

                {!companiesLoading &&
                  !companyError &&
                  companies.length === 0 && (
                    <option value="">
                      No active companies
                    </option>
                  )}

                {companies.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Payroll Cutoff</span>

              <select
                value={cutoff}
                disabled={
                  !company ||
                  cutoffsLoading ||
                  cutoffs.length === 0
                }
                onChange={(event) =>
                  handleCutoffChange(event.target.value)
                }
              >
                {!company && (
                  <option value="">
                    Select a company first
                  </option>
                )}

                {company &&
                  cutoffsLoading && (
                    <option value="">
                      Loading cutoffs...
                    </option>
                  )}

                {company &&
                  !cutoffsLoading &&
                  cutoffError && (
                    <option value="">
                      Unable to load cutoffs
                    </option>
                  )}

                {company &&
                  !cutoffsLoading &&
                  !cutoffError &&
                  cutoffs.length === 0 && (
                    <option value="">
                      No payroll cutoffs
                    </option>
                  )}

                {cutoffs.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {formatCutoff(item)} ·{' '}
                    {formatCutoffStatus(item.status)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>DTR Status</span>

              <select
                value={status}
                disabled={!company || !cutoff}
                onChange={(event) =>
                  setStatus(
                    event.target.value as
                      | 'ALL'
                      | DtrStatus,
                  )
                }
              >
                <option value="ALL">
                  All Statuses
                </option>

                <option value="DRAFT">
                  Draft
                </option>

                <option value="FOR_REVIEW">
                  For Review
                </option>

                <option value="VALIDATED">
                  Validated
                </option>

                <option value="LAST_PAY_REVIEW">
                  Last Pay Review
                </option>
              </select>
            </label>

            <label>
              <span>Search Employee</span>

              <input
                type="search"
                placeholder="Name or employee number"
                value={search}
                disabled={!company || !cutoff}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>
          </div>
        </section>

        <div className="workspace">
          <section className="dtr-list-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">
                  Cutoff Employees
                </p>

                <h2>Employee DTRs</h2>
              </div>

              <span className="record-count">
                {dtrTotal} records
              </span>
            </div>

            <div className="dtr-list">
              {dtrsLoading && (
                <div className="empty-state">
                  Loading employee DTRs...
                </div>
              )}

              {!dtrsLoading &&
                dtrError && (
                  <div className="empty-state">
                    {dtrError}
                  </div>
                )}

              {!dtrsLoading &&
                !dtrError &&
                dtrs.map((dtr) => {
                  const employeeName =
                    formatEmployeeName(dtr.employee)

                  return (
                    <button
                      key={dtr.id}
                      type="button"
                      className={`dtr-row ${
                        selectedDtrId === dtr.id
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() =>
                        setSelectedDtrId(dtr.id)
                      }
                    >
                      <div className="employee-avatar">
                        {dtr.employee.firstName.charAt(0)}
                      </div>

                      <div className="employee-summary">
                        <strong>
                          {employeeName}
                        </strong>

                        <span>
                          {dtr.employee.employeeNumber} ·{' '}
                          {dtr._count.entries} daily entries
                        </span>
                      </div>

                      <span
                        className={`status-badge status-${dtr.status.toLowerCase()}`}
                      >
                        {formatStatus(dtr.status)}
                      </span>
                    </button>
                  )
                })}

              {!dtrsLoading &&
                !dtrError &&
                dtrs.length === 0 && (
                  <div className="empty-state">
                    No DTRs match the selected filters.
                  </div>
                )}
            </div>
          </section>

          <section className="attendance-card">
            {selectedDtr ? (
              <>
                <div className="card-header attendance-header">
                  <div>
                    <p className="eyebrow">
                      Selected DTR
                    </p>

                    <h2>
                      {formatEmployeeName(
                        selectedDtr.employee,
                      )}
                    </h2>

                    <p>
                      {selectedDtr.employee.employeeNumber} ·{' '}
                      {formatCutoff(
                        selectedDtr.payrollCutoff,
                      )}
                    </p>
                  </div>

                  <span
                    className={`status-badge status-${selectedDtr.status.toLowerCase()}`}
                  >
                    {formatStatus(selectedDtr.status)}
                  </span>
                </div>

                {isReadOnly && (
                  <div className="locked-notice">
                    <strong>
                      {cutoffIsLocked
                        ? 'Payroll Cutoff Locked'
                        : 'Validated DTR'}
                    </strong>

                    <span>
                      {cutoffIsLocked
                        ? 'Attendance and DTR review actions are read-only because this payroll cutoff is locked. The Payroll Manager must reopen or unlock the cutoff before making changes.'
                        : 'Attendance is currently read-only. Return the DTR to review before making corrections.'}
                    </span>
                  </div>
                )}

                <SelectedDtrDetail
                  accessToken={accessToken}
                  dtrId={selectedDtr.id}
                  refreshKey={detailRefreshKey}
                  canEdit={!isReadOnly}
                  deletingEntryId={deletingEntryId}
                  onEntriesChange={setRecordedEntries}
                  onEditEntry={handleEditEntry}
                  onDeleteEntry={(entry) =>
                    void handleDeleteEntry(entry)
                  }
                />

                <div className="section-title">
                  <div>
                    <h3>
                      {editingEntryId
                        ? 'Edit Daily Attendance Entry'
                        : 'New Daily Attendance Entry'}
                    </h3>

                    <p>
                      {editingEntryId
                        ? `Editing the saved attendance entry for ${formatEmployeeName(
                            selectedDtr.employee,
                          )} only.`
                        : `Create a new attendance entry for ${formatEmployeeName(
                            selectedDtr.employee,
                          )}.`}
                    </p>
                  </div>
                </div>

                <div className="attendance-form">
                  {editingEntryId ? (
                    <label>
                      <span>Work Date</span>

                      <input
                        type="date"
                        min={selectedDtr.payrollCutoff.startDate.slice(0, 10)}
                        max={selectedDtr.payrollCutoff.endDate.slice(0, 10)}
                        value={attendanceDraft.workDate}
                        disabled={isReadOnly}
                        onChange={(event) =>
                          updateAttendanceDraft(
                            'workDate',
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  ) : (
                    <div className="attendance-work-dates-field">
                      <MultiWorkDateSelector
                        startDate={
                          selectedDtr.payrollCutoff.startDate
                        }
                        endDate={
                          selectedDtr.payrollCutoff.endDate
                        }
                        selectedDates={
                          selectedWorkDates
                        }
                        disabledDates={
                          recordedWorkDates
                        }
                        holidays={
                          holidays.map(
                            (holiday) => ({
                              date: holiday.date,
                              name: holiday.name,
                            }),
                          )
                        }
                        disabled={
                          isReadOnly ||
                          entrySaving
                        }
                        onChange={
                          handleWorkDatesChange
                        }
                      />
                    </div>
                  )}

                  <label>
                    <span>Regular Minutes</span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={attendanceDraft.regularMinutes}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'regularMinutes',
                          event.target.value,
                        )
                      }
                    />

                    <small className="attendance-field-help">
                      {regularMinutesManualOverride
                        ? `Manual override · Suggested: ${suggestedRegularMinutes} minutes`
                        : `Auto calculated from ${standardWorkMinutesPerDay} scheduled minutes`}
                    </small>

                    {regularMinutesManualOverride && (
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={isReadOnly}
                        onClick={useSuggestedRegularMinutes}
                      >
                        Use Suggested
                      </button>
                    )}
                  </label>

                  <label>
                    <span>Late Minutes</span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={attendanceDraft.lateMinutes}
                      disabled={isReadOnly || attendanceDraft.restDay}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'lateMinutes',
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Undertime Minutes</span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={attendanceDraft.undertimeMinutes}
                      disabled={isReadOnly || attendanceDraft.restDay}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'undertimeMinutes',
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Absence Minutes</span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={attendanceDraft.absenceMinutes}
                      disabled={isReadOnly || attendanceDraft.restDay}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'absenceMinutes',
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Leave Type</span>

                    <select
                      value={attendanceDraft.leaveType}
                      disabled={isReadOnly || attendanceDraft.restDay}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'leaveType',
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        No Leave
                      </option>

                      {referenceLoading && (
                        <option
                          value=""
                          disabled
                        >
                          Loading leave types...
                        </option>
                      )}

                      {leaveTypes.map((leaveType) => (
                        <option
                          key={leaveType.id}
                          value={leaveType.id}
                        >
                          {leaveType.code} · {leaveType.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Leave Minutes</span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={attendanceDraft.leaveMinutes}
                      disabled={isReadOnly || attendanceDraft.restDay}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'leaveMinutes',
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Night Differential
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        attendanceDraft.nightDifferentialMinutes
                      }
                      disabled={isReadOnly}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'nightDifferentialMinutes',
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Overtime Type</span>

                    <select
                      value={attendanceDraft.overtimeType}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'overtimeType',
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        No Overtime
                      </option>

                      <option
                        value="REGULAR"
                        disabled={!allowedOvertimeTypes.includes('REGULAR')}
                      >
                        Regular OT
                      </option>

                      <option
                        value="REST_DAY"
                        disabled={!allowedOvertimeTypes.includes('REST_DAY')}
                      >
                        Rest Day OT
                      </option>

                      <option
                        value="SPECIAL_HOLIDAY"
                        disabled={!allowedOvertimeTypes.includes('SPECIAL_HOLIDAY')}
                      >
                        Special Holiday OT
                      </option>

                      <option
                        value="REGULAR_HOLIDAY"
                        disabled={!allowedOvertimeTypes.includes('REGULAR_HOLIDAY')}
                      >
                        Regular Holiday OT
                      </option>

                      <option
                        value="REST_DAY_SPECIAL_HOLIDAY"
                        disabled={!allowedOvertimeTypes.includes('REST_DAY_SPECIAL_HOLIDAY')}
                      >
                        Rest Day + Special Holiday
                      </option>

                      <option
                        value="REST_DAY_REGULAR_HOLIDAY"
                        disabled={!allowedOvertimeTypes.includes('REST_DAY_REGULAR_HOLIDAY')}
                      >
                        Rest Day + Regular Holiday
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>Overtime Minutes</span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={attendanceDraft.overtimeMinutes}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'overtimeMinutes',
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Holiday</span>

                    <select
                      value={attendanceDraft.holiday}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'holiday',
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        No Holiday
                      </option>

                      {referenceLoading && (
                        <option
                          value=""
                          disabled
                        >
                          Loading holidays...
                        </option>
                      )}

                      {workDateHolidays.map((holiday) => (
                        <option
                          key={holiday.id}
                          value={holiday.id}
                        >
                          {holiday.name} · {holiday.type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={attendanceDraft.restDay}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'restDay',
                          event.target.checked,
                        )
                      }
                    />

                    <span>Rest Day</span>

                    <small className="attendance-field-help">
                      Rest Day removes scheduled late, undertime,
                      absence, and leave. Enter Regular Minutes only
                      when the employee actually worked.
                    </small>
                  </label>

                  <label className="notes-field">
                    <span>Notes</span>

                    <textarea
                      rows={3}
                      maxLength={500}
                      placeholder="Optional attendance note"
                      value={attendanceDraft.notes}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        updateAttendanceDraft(
                          'notes',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>

                {standardWorkMinutesPerDay > 0 && (
                  <div
                    className={
                      accountedMinutesMismatch
                        ? 'attendance-accounting attendance-accounting-warning'
                        : 'attendance-accounting attendance-accounting-ok'
                    }
                  >
                    <strong>
                      {attendanceDraft.restDay
                        ? 'Rest Day · No scheduled attendance minutes'
                        : `Scheduled Minutes: ${standardWorkMinutesPerDay}`}
                    </strong>

                    <span>
                      {attendanceDraft.restDay
                        ? `Worked Minutes: ${
                            draftMinutes(
                              attendanceDraft.regularMinutes,
                            ) +
                            draftMinutes(
                              attendanceDraft.overtimeMinutes,
                            )
                          }`
                        : `Accounted Minutes: ${accountedScheduledMinutes}`}
                    </span>

                    {accountedMinutesMismatch && (
                      <span>
                        The entered scheduled-time components do not equal
                        the employee&apos;s configured workday.
                      </span>
                    )}
                  </div>
                )}

                {referenceError && (
                  <div
                    className="form-feedback form-feedback-error"
                    role="alert"
                  >
                    Unable to load attendance reference data: {referenceError}
                  </div>
                )}

                {entryError && (
                  <div
                    className="form-feedback form-feedback-error"
                    role="alert"
                  >
                    {entryError}
                  </div>
                )}

                {entryMessage && (
                  <div
                    className="form-feedback form-feedback-success"
                    role="status"
                  >
                    {entryMessage}
                  </div>
                )}

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isReadOnly}
                    onClick={
                      editingEntryId
                        ? handleCancelEdit
                        : resetAttendanceDraft
                    }
                  >
                    {editingEntryId
                      ? 'New Daily Entry'
                      : 'Clear'}
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      isReadOnly ||
                      entrySaving ||
                      (!editingEntryId &&
                        selectedWorkDates.length === 0)
                    }
                    onClick={() =>
                      void handleSaveDailyEntry()
                    }
                  >
                    {entrySaving
                      ? 'Saving...'
                      : editingEntryId
                        ? 'Update Daily Entry'
                        : selectedWorkDates.length > 1
                          ? `Create ${selectedWorkDates.length} Daily Entries`
                          : 'Create Daily Entry'}
                  </button>
                </div>

                <div className="review-actions">
                  <div>
                    <strong>DTR Review</strong>

                    <span>
                      Current status:{' '}
                      {formatStatus(
                        selectedDtr.status,
                      )}
                    </span>
                  </div>

                  <div className="review-buttons">
                    {selectedDtr.status ===
                      'DRAFT' && (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={reviewSaving || cutoffIsLocked}
                        onClick={() =>
                          void handleDtrStatusChange(
                            'FOR_REVIEW',
                            'DTR sent for review successfully.',
                          )
                        }
                      >
                        {reviewSaving
                          ? 'Updating...'
                          : 'Send for Review'}
                      </button>
                    )}

                    {selectedDtr.status ===
                      'FOR_REVIEW' && (
                      <>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={reviewSaving || cutoffIsLocked}
                          onClick={() =>
                            void handleDtrStatusChange(
                              'DRAFT',
                              'DTR returned to draft successfully.',
                            )
                          }
                        >
                          Return to Draft
                        </button>

                        <button
                          type="button"
                          className="primary-button"
                          disabled={reviewSaving || cutoffIsLocked}
                          onClick={() =>
                            void handleDtrStatusChange(
                              'VALIDATED',
                              'DTR validated successfully.',
                            )
                          }
                        >
                          {reviewSaving
                            ? 'Updating...'
                            : 'Validate DTR'}
                        </button>
                      </>
                    )}

                    {selectedDtr.status ===
                      'VALIDATED' && (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={reviewSaving || cutoffIsLocked}
                        onClick={() =>
                          void handleDtrStatusChange(
                            'FOR_REVIEW',
                            'DTR returned to review successfully.',
                          )
                        }
                      >
                        {reviewSaving
                          ? 'Updating...'
                          : 'Return to Review'}
                      </button>
                    )}
                  </div>

                  {reviewError && (
                    <div
                      className="form-feedback form-feedback-error"
                      role="alert"
                    >
                      {reviewError}
                    </div>
                  )}

                  {reviewMessage && (
                    <div
                      className="form-feedback form-feedback-success"
                      role="status"
                    >
                      {reviewMessage}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                {dtrsLoading
                  ? 'Loading selected DTR...'
                  : 'Select a DTR to review attendance.'}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
