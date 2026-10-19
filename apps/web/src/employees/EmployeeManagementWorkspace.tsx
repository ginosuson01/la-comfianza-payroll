import {
  useEffect,
  useState,
} from 'react'
import type { FormEvent } from 'react'

import { ApiError } from '../api/client'
import {
  listCompanies,
  type CompanyView,
} from '../api/companies'
import {
  listEmployees,
  type EmployeeDirectoryView,
  type EmployeePayoutMethod,
} from '../api/employees'
import type {
  EmployeePayrollStatus,
} from '../api/types'
import { EmployeeCompensationPanel } from './EmployeeCompensationPanel'
import { EmployeeEmploymentPanel } from './EmployeeEmploymentPanel'
import { EmployeeFormPanel } from './EmployeeFormPanel'
import { EmployeePayrollProfilePanel } from './EmployeePayrollProfilePanel'
import { EmployeeRecurringPayrollPanel } from './EmployeeRecurringPayrollPanel'
import { EmployeeStartDateCorrectionPanel } from './EmployeeStartDateCorrectionPanel'
import { EmployeeStatusPanel } from './EmployeeStatusPanel'

import './EmployeeManagementWorkspace.css'

interface EmployeeManagementWorkspaceProps {
  accessToken: string
}

type EmployeeStatusFilter =
  | 'ALL'
  | EmployeePayrollStatus

type EmployeePayoutFilter =
  | 'ALL'
  | EmployeePayoutMethod

const PAGE_SIZE = 25

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to load employees.'
}

function formatStatus(
  status: EmployeePayrollStatus,
): string {
  return status
    .split('_')
    .map(
      (part) =>
        part.charAt(0) +
        part.slice(1).toLowerCase(),
    )
    .join(' ')
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'en-PH',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  ).format(new Date(value))
}

function formatDateTime(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'en-PH',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
  ).format(new Date(value))
}

function displayValue(
  value: string | null | undefined,
): string {
  if (!value?.trim()) {
    return '—'
  }

  return value
}

function formatAddress(
  employee: EmployeeDirectoryView,
): string {
  const parts = [
    employee.addressLine1,
    employee.addressLine2,
    employee.barangay,
    employee.city,
    employee.province,
    employee.postalCode,
    employee.country,
  ].filter(
    (
      value,
    ): value is string =>
      Boolean(value?.trim()),
  )

  return parts.length > 0
    ? parts.join(', ')
    : '—'
}

export function EmployeeManagementWorkspace({
  accessToken,
}: EmployeeManagementWorkspaceProps) {
  const [
    employees,
    setEmployees,
  ] = useState<EmployeeDirectoryView[]>([])

  const [
    companies,
    setCompanies,
  ] = useState<CompanyView[]>([])

  const [
    selectedEmployeeId,
    setSelectedEmployeeId,
  ] = useState('')

  const [
    searchDraft,
    setSearchDraft,
  ] = useState('')

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    companyId,
    setCompanyId,
  ] = useState('')

  const [
    status,
    setStatus,
  ] = useState<EmployeeStatusFilter>('ALL')

  const [
    payoutMethod,
    setPayoutMethod,
  ] = useState<EmployeePayoutFilter>('ALL')

  const [
    page,
    setPage,
  ] = useState(1)

  const [
    total,
    setTotal,
  ] = useState(0)

  const [
    totalPages,
    setTotalPages,
  ] = useState(0)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const [
    companiesError,
    setCompaniesError,
  ] = useState<string | null>(null)

  const [
    formMode,
    setFormMode,
  ] = useState<'CREATE' | 'EDIT' | null>(null)

  const [
    statusMode,
    setStatusMode,
  ] = useState(false)

  const [
    employmentMode,
    setEmploymentMode,
  ] = useState(false)

  const [
    correctionMode,
    setCorrectionMode,
  ] = useState(false)

  const [
    compensationMode,
    setCompensationMode,
  ] = useState(false)

  const [
    payrollProfileMode,
    setPayrollProfileMode,
  ] = useState(false)

  const [
    recurringPayrollMode,
    setRecurringPayrollMode,
  ] = useState(false)

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0)

  const [
    actionMessage,
    setActionMessage,
  ] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCompanies() {
      try {
        const result =
          await listCompanies(
            accessToken,
            {
              page: 1,
              pageSize: 100,
            },
          )

        if (!cancelled) {
          setCompanies(
            result.items,
          )
          setCompaniesError(null)
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          setCompanies([])
          setCompaniesError(
            getErrorMessage(
              loadError,
            ),
          )
        }
      }
    }

    void loadCompanies()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
  ])

  useEffect(() => {
    let cancelled = false

    async function loadEmployees() {
      setLoading(true)
      setError(null)

      try {
        const result =
          await listEmployees(
            accessToken,
            {
              search:
                search ||
                undefined,

              companyId:
                companyId ||
                undefined,

              status:
                status === 'ALL'
                  ? undefined
                  : status,

              payoutMethod:
                payoutMethod === 'ALL'
                  ? undefined
                  : payoutMethod,

              page,
              pageSize:
                PAGE_SIZE,
            },
          )

        if (cancelled) {
          return
        }

        setEmployees(
          result.items,
        )

        setTotal(
          result.pagination.total,
        )

        setTotalPages(
          result.pagination.totalPages,
        )

        setSelectedEmployeeId(
          (current) => {
            if (
              current &&
              result.items.some(
                (employee) =>
                  employee.id ===
                  current,
              )
            ) {
              return current
            }

            return (
              result.items[0]?.id ??
              ''
            )
          },
        )
      } catch (loadError: unknown) {
        if (!cancelled) {
          setEmployees([])
          setTotal(0)
          setTotalPages(0)

          setError(
            getErrorMessage(
              loadError,
            ),
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadEmployees()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    companyId,
    page,
    payoutMethod,
    refreshKey,
    search,
    status,
  ])

  const selectedEmployee =
    employees.find(
      (employee) =>
        employee.id ===
        selectedEmployeeId,
    ) ?? null

  function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setPage(1)
    setSearch(
      searchDraft.trim(),
    )
  }

  function handleClearSearch() {
    setSearchDraft('')
    setSearch('')
    setPage(1)
  }

  function handleEmployeeSaved(
    savedEmployee: EmployeeDirectoryView,
  ) {
    setSearchDraft('')
    setSearch('')
    setCompanyId('')
    setStatus('ALL')
    setPayoutMethod('ALL')
    setPage(1)

    setSelectedEmployeeId(
      savedEmployee.id,
    )

    setFormMode(null)

    setActionMessage(
      `Employee ${savedEmployee.fullName} saved successfully.`,
    )

    setRefreshKey(
      (current) =>
        current + 1,
    )
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            Phase 1 · Payroll Manager
          </p>

          <h1>
            Employee Management
          </h1>

          <p className="page-description">
            Review employee records,
            employment assignments,
            payroll status, and payout
            information.
          </p>
        </div>

        <div className="topbar-actions">
          <span className="environment-badge">
            Development
          </span>
        </div>
      </header>

      <section className="filter-card">
        <div className="filter-heading employee-directory-heading">
          <div>
            <h2>
              Employee Directory
            </h2>

            <p>
              Search employees and filter
              by company, payroll status,
              or payout method.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setActionMessage(null)
              setStatusMode(false)
              setEmploymentMode(false)
              setCorrectionMode(false)
              setCompensationMode(false)
              setPayrollProfileMode(false)
              setRecurringPayrollMode(false)
              setFormMode('CREATE')
            }}
          >
            New Employee
          </button>
        </div>

        <div className="employee-management-filters">
          <form
            className="employee-search-form"
            onSubmit={
              handleSearch
            }
          >
            <label>
              <span>
                Search
              </span>

              <input
                value={
                  searchDraft
                }
                placeholder="Employee number, name, email, mobile..."
                onChange={(
                  event,
                ) =>
                  setSearchDraft(
                    event.target.value,
                  )
                }
              />
            </label>

            <div className="employee-search-actions">
              <button
                type="submit"
                className="primary-button"
              >
                Search
              </button>

              <button
                type="button"
                className="secondary-button"
                disabled={
                  !search &&
                  !searchDraft
                }
                onClick={
                  handleClearSearch
                }
              >
                Clear
              </button>
            </div>
          </form>

          <label>
            <span>
              Company
            </span>

            <select
              value={companyId}
              onChange={(
                event,
              ) => {
                setCompanyId(
                  event.target.value,
                )
                setPage(1)
              }}
            >
              <option value="">
                All Companies
              </option>

              {companies.map(
                (company) => (
                  <option
                    key={company.id}
                    value={company.id}
                  >
                    {company.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>
              Payroll Status
            </span>

            <select
              value={status}
              onChange={(
                event,
              ) => {
                setStatus(
                  event.target
                    .value as EmployeeStatusFilter,
                )
                setPage(1)
              }}
            >
              <option value="ALL">
                All Statuses
              </option>

              <option value="ACTIVE">
                Active
              </option>

              <option value="ACTIVE_HOLD">
                Active Hold
              </option>

              <option value="RESIGNED">
                Resigned
              </option>
            </select>
          </label>

          <label>
            <span>
              Payout Method
            </span>

            <select
              value={payoutMethod}
              onChange={(
                event,
              ) => {
                setPayoutMethod(
                  event.target
                    .value as EmployeePayoutFilter,
                )
                setPage(1)
              }}
            >
              <option value="ALL">
                All Payout Methods
              </option>

              <option value="CASH">
                Cash
              </option>

              <option value="ATM">
                ATM
              </option>
            </select>
          </label>
        </div>

        {companiesError && (
          <div
            className="employee-filter-warning"
            role="status"
          >
            Company filter could not be
            loaded: {companiesError}
          </div>
        )}
      </section>

      {actionMessage && (
        <div
          className="employee-action-feedback"
          role="status"
        >
          {actionMessage}
        </div>
      )}

      <div className="workspace employee-management-workspace">
        <section className="employee-directory-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">
                Employees
              </p>

              <h2>
                Directory
              </h2>
            </div>

            <span className="record-count">
              {total} records
            </span>
          </div>

          <div className="employee-directory-list">
            {loading && (
              <div className="empty-state">
                Loading employees...
              </div>
            )}

            {!loading &&
              error && (
                <div className="empty-state">
                  {error}
                </div>
              )}

            {!loading &&
              !error &&
              employees.length === 0 && (
                <div className="empty-state">
                  No employees found.
                </div>
              )}

            {!loading &&
              !error &&
              employees.map(
                (employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    className={`employee-directory-row ${
                      selectedEmployeeId ===
                      employee.id
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() =>
                      setSelectedEmployeeId(
                        employee.id,
                      )
                    }
                  >
                    <div className="employee-avatar">
                      {employee.firstName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="employee-directory-summary">
                      <strong>
                        {employee.fullName}
                      </strong>

                      <span>
                        {
                          employee.employeeNumber
                        }
                      </span>

                      <small>
                        {employee
                          .currentEmployment
                          ?.company.name ??
                          'No current employment'}
                      </small>
                    </div>

                    <span
                      className={`status-badge employee-status-${employee.currentStatus.toLowerCase()}`}
                    >
                      {formatStatus(
                        employee.currentStatus,
                      )}
                    </span>
                  </button>
                ),
              )}
          </div>

          <div className="employee-pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={
                loading ||
                page <= 1
              }
              onClick={() =>
                setPage(
                  (current) =>
                    Math.max(
                      1,
                      current - 1,
                    ),
                )
              }
            >
              Previous
            </button>

            <span>
              Page {page}
              {totalPages > 0
                ? ` of ${totalPages}`
                : ''}
            </span>

            <button
              type="button"
              className="secondary-button"
              disabled={
                loading ||
                totalPages === 0 ||
                page >= totalPages
              }
              onClick={() =>
                setPage(
                  (current) =>
                    current + 1,
                )
              }
            >
              Next
            </button>
          </div>
        </section>

        <section className="attendance-card employee-profile-card">
          {recurringPayrollMode && selectedEmployee ? (
            <EmployeeRecurringPayrollPanel
              accessToken={accessToken}
              employee={selectedEmployee}
              onCancel={() =>
                setRecurringPayrollMode(false)
              }
            />
          ) : payrollProfileMode && selectedEmployee ? (
            <EmployeePayrollProfilePanel
              accessToken={accessToken}
              employee={selectedEmployee}
              onCancel={() => {
                setPayrollProfileMode(false)
                setRecurringPayrollMode(false)
              }}
              onSaved={(savedProfile) => {
                setPayrollProfileMode(false)
                setRecurringPayrollMode(false)
                setCompensationMode(false)
                setCorrectionMode(false)
                setEmploymentMode(false)
                setStatusMode(false)
                setFormMode(null)

                setActionMessage(
                  `Payroll profile for ${selectedEmployee.fullName} saved successfully as ${savedProfile.payoutMethod}.`,
                )

                setRefreshKey(
                  (current) =>
                    current + 1,
                )
              }}
            />
          ) : compensationMode && selectedEmployee ? (
            <EmployeeCompensationPanel
              accessToken={accessToken}
              employee={selectedEmployee}
              onCancel={() =>
                setCompensationMode(false)
              }
              onSaved={() => {
                setCompensationMode(false)
                setCorrectionMode(false)
                setEmploymentMode(false)
                setStatusMode(false)
                setCompensationMode(false)
                setPayrollProfileMode(false)
                setRecurringPayrollMode(false)
                setFormMode(null)

                setActionMessage(
                  `Compensation for ${selectedEmployee.fullName} saved successfully.`,
                )
              }}
            />
          ) : correctionMode && selectedEmployee ? (
            <EmployeeStartDateCorrectionPanel
              accessToken={accessToken}
              employee={selectedEmployee}
              onCancel={() =>
                setCorrectionMode(false)
              }
              onCorrected={(updatedEmployee) => {
                setCorrectionMode(false)
                setEmploymentMode(false)
                setStatusMode(false)
                setFormMode(null)

                setSelectedEmployeeId(
                  updatedEmployee.id,
                )

                setActionMessage(
                  `Employment start date for ${updatedEmployee.fullName} corrected successfully.`,
                )

                setRefreshKey(
                  (current) =>
                    current + 1,
                )
              }}
            />
          ) : employmentMode && selectedEmployee ? (
            <EmployeeEmploymentPanel
              accessToken={accessToken}
              employee={selectedEmployee}
              companies={companies}
              onCancel={() =>
                setEmploymentMode(false)
              }
              onChanged={(updatedEmployee) => {
                setEmploymentMode(false)
                setStatusMode(false)
                setCorrectionMode(false)
                setCompensationMode(false)
                setPayrollProfileMode(false)
                setRecurringPayrollMode(false)
                setFormMode(null)

                setSelectedEmployeeId(
                  updatedEmployee.id,
                )

                setCompanyId('')
                setPayoutMethod('ALL')
                setPage(1)

                setActionMessage(
                  `Employment assignment for ${updatedEmployee.fullName} changed successfully.`,
                )

                setRefreshKey(
                  (current) =>
                    current + 1,
                )
              }}
            />
          ) : statusMode && selectedEmployee ? (
            <EmployeeStatusPanel
              accessToken={accessToken}
              employee={selectedEmployee}
              onCancel={() =>
                setStatusMode(false)
              }
              onChanged={() => {
                setStatusMode(false)
                setEmploymentMode(false)
                setCorrectionMode(false)
                setCompensationMode(false)
                setPayrollProfileMode(false)
                setRecurringPayrollMode(false)
                setFormMode(null)

                setActionMessage(
                  `Payroll status for ${selectedEmployee.fullName} changed successfully.`,
                )

                setRefreshKey(
                  (current) =>
                    current + 1,
                )
              }}
            />
          ) : formMode ? (
            <EmployeeFormPanel
              accessToken={accessToken}
              employee={
                formMode === 'EDIT'
                  ? selectedEmployee
                  : null
              }
              companies={companies}
              mode={formMode}
              onCancel={() =>
                setFormMode(null)
              }
              onSaved={
                handleEmployeeSaved
              }
            />
          ) : selectedEmployee ? (
            <>
              <div className="employee-profile-header">
                <div>
                  <p className="eyebrow">
                    Employee Profile
                  </p>

                  <h2>
                    {
                      selectedEmployee.fullName
                    }
                  </h2>

                  <p className="employee-profile-number">
                    {
                      selectedEmployee.employeeNumber
                    }
                  </p>
                </div>

                <div className="employee-profile-actions">
                  <span
                    className={`status-badge employee-status-${selectedEmployee.currentStatus.toLowerCase()}`}
                  >
                    {formatStatus(
                      selectedEmployee.currentStatus,
                    )}
                  </span>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActionMessage(null)
                      setStatusMode(false)
                      setEmploymentMode(false)
                      setCorrectionMode(false)
                      setCompensationMode(false)
                      setPayrollProfileMode(false)
                      setRecurringPayrollMode(false)
                      setFormMode('EDIT')
                    }}
                  >
                    Edit Employee
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActionMessage(null)
                      setFormMode(null)
                      setEmploymentMode(false)
                      setCorrectionMode(false)
                      setCompensationMode(false)
                      setPayrollProfileMode(false)
                      setRecurringPayrollMode(false)
                      setStatusMode(true)
                    }}
                  >
                    Change Status
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActionMessage(null)
                      setFormMode(null)
                      setStatusMode(false)
                      setCorrectionMode(false)
                      setCompensationMode(false)
                      setPayrollProfileMode(false)
                      setRecurringPayrollMode(false)
                      setEmploymentMode(true)
                    }}
                  >
                    Change Employment
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActionMessage(null)
                      setFormMode(null)
                      setStatusMode(false)
                      setEmploymentMode(false)
                      setCompensationMode(false)
                      setPayrollProfileMode(false)
                      setRecurringPayrollMode(false)
                      setCorrectionMode(true)
                    }}
                  >
                    Correct Start Date
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActionMessage(null)
                      setFormMode(null)
                      setStatusMode(false)
                      setEmploymentMode(false)
                      setCorrectionMode(false)
                      setPayrollProfileMode(false)
                      setRecurringPayrollMode(false)
                      setCompensationMode(true)
                    }}
                  >
                    Compensation
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActionMessage(null)
                      setFormMode(null)
                      setStatusMode(false)
                      setEmploymentMode(false)
                      setCorrectionMode(false)
                      setCompensationMode(false)
                      setRecurringPayrollMode(false)
                      setPayrollProfileMode(true)
                    }}
                  >
                    Payroll Profile
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActionMessage(null)
                      setFormMode(null)
                      setStatusMode(false)
                      setEmploymentMode(false)
                      setCorrectionMode(false)
                      setCompensationMode(false)
                      setPayrollProfileMode(false)
                      setRecurringPayrollMode(true)
                    }}
                  >
                    Recurring Payroll
                  </button>
                </div>
              </div>

              <div className="employee-profile-section">
                <h3>
                  Personal &amp; Contact
                </h3>

                <div className="employee-profile-grid">
                  <div>
                    <span>
                      First Name
                    </span>
                    <strong>
                      {
                        selectedEmployee.firstName
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Middle Name
                    </span>
                    <strong>
                      {displayValue(
                        selectedEmployee.middleName,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Last Name
                    </span>
                    <strong>
                      {
                        selectedEmployee.lastName
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Suffix
                    </span>
                    <strong>
                      {displayValue(
                        selectedEmployee.suffix,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Email
                    </span>
                    <strong>
                      {displayValue(
                        selectedEmployee.email,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Mobile
                    </span>
                    <strong>
                      {displayValue(
                        selectedEmployee.mobile,
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="employee-profile-section">
                <h3>
                  Address
                </h3>

                <p className="employee-address">
                  {formatAddress(
                    selectedEmployee,
                  )}
                </p>
              </div>

              <div className="employee-profile-section">
                <h3>
                  Current Employment
                </h3>

                {selectedEmployee.currentEmployment ? (
                  <div className="employee-profile-grid">
                    <div>
                      <span>
                        Company
                      </span>
                      <strong>
                        {
                          selectedEmployee
                            .currentEmployment
                            .company.name
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Employee Type
                      </span>
                      <strong>
                        {selectedEmployee
                          .currentEmployment
                          .employeeType ===
                        'LACOM_INTERNAL'
                          ? 'La Comfianza Internal'
                          : selectedEmployee
                              .currentEmployment
                              .employeeType ===
                            'CLIENT_EMPLOYEE'
                            ? 'Client Employee'
                            : 'Classification Required'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Company Employee No.
                      </span>
                      <strong>
                        {displayValue(
                          selectedEmployee
                            .currentEmployment
                            .companyEmployeeNumber,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Department
                      </span>
                      <strong>
                        {selectedEmployee
                          .currentEmployment
                          .department
                          ?.name ??
                          '—'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Position
                      </span>
                      <strong>
                        {selectedEmployee
                          .currentEmployment
                          .position
                          ?.name ??
                          '—'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Employment Start
                      </span>
                      <strong>
                        {formatDate(
                          selectedEmployee
                            .currentEmployment
                            .startDate,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Payout Method
                      </span>
                      <strong>
                        {selectedEmployee
                          .currentEmployment
                          .payoutMethod ??
                          'Not configured'}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    No current employment
                    assignment.
                  </div>
                )}
              </div>

              <div className="employee-profile-section">
                <h3>
                  Record Information
                </h3>

                <div className="employee-profile-grid">
                  <div>
                    <span>
                      Created
                    </span>
                    <strong>
                      {formatDateTime(
                        selectedEmployee.createdAt,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Last Updated
                    </span>
                    <strong>
                      {formatDateTime(
                        selectedEmployee.updatedAt,
                      )}
                    </strong>
                  </div>
                </div>
              </div>

            </>
          ) : (
            <div className="empty-state">
              Select an employee to view
              the profile.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
