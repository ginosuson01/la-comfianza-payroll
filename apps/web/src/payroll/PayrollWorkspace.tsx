import {
  useEffect,
  useState,
} from 'react'

import { ApiError } from '../api/client'
import { listActiveCompanies } from '../api/companies'
import {
  listPayrollRuns,
  type PayrollRunHistoryItem,
  type PayrollRunStatus,
} from '../api/payroll'
import { listPayrollCutoffs } from '../api/payroll-cutoffs'
import type {
  CompanyListItem,
  PayrollCutoffSummary,
} from '../api/types'

import { PayrollLifecycleActions } from './PayrollLifecycleActions'
import { PayrollRunDetailPanel } from './PayrollRunDetailPanel'

import './PayrollWorkspace.css'

interface PayrollWorkspaceProps {
  accessToken: string
}

type PayrollRunStatusFilter =
  | 'ALL'
  | PayrollRunStatus

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to load payroll data.'
}

function formatDate(
  value: string,
): string {
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

function formatStatus(
  value: string,
): string {
  return value
    .split('_')
    .map(
      (part) =>
        part.charAt(0) +
        part.slice(1).toLowerCase(),
    )
    .join(' ')
}

function formatMoney(
  value: string,
): string {
  const [
    rawWhole,
    rawFraction = '00',
  ] = value.split('.')

  const negative =
    rawWhole.startsWith('-')

  const whole =
    negative
      ? rawWhole.slice(1)
      : rawWhole

  const formattedWhole =
    whole.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ',',
    )

  const fraction =
    rawFraction
      .padEnd(2, '0')
      .slice(0, 2)

  return `₱${negative ? '-' : ''}${formattedWhole}.${fraction}`
}

export function PayrollWorkspace({
  accessToken,
}: PayrollWorkspaceProps) {
  const [
    companies,
    setCompanies,
  ] = useState<CompanyListItem[]>([])

  const [
    companyId,
    setCompanyId,
  ] = useState('')

  const [
    companiesLoading,
    setCompaniesLoading,
  ] = useState(true)

  const [
    companyError,
    setCompanyError,
  ] = useState<string | null>(null)

  const [
    cutoffs,
    setCutoffs,
  ] = useState<PayrollCutoffSummary[]>([])

  const [
    payrollCutoffId,
    setPayrollCutoffId,
  ] = useState('')

  const [
    cutoffsLoading,
    setCutoffsLoading,
  ] = useState(false)

  const [
    cutoffError,
    setCutoffError,
  ] = useState<string | null>(null)

  const [
    runStatus,
    setRunStatus,
  ] =
    useState<PayrollRunStatusFilter>('ALL')

  const [
    payrollRuns,
    setPayrollRuns,
  ] =
    useState<PayrollRunHistoryItem[]>([])

  const [
    payrollRunTotal,
    setPayrollRunTotal,
  ] = useState(0)

  const [
    payrollRunsLoading,
    setPayrollRunsLoading,
  ] = useState(false)

  const [
    payrollRunsError,
    setPayrollRunsError,
  ] = useState<string | null>(null)

  const [
    selectedPayrollRunId,
    setSelectedPayrollRunId,
  ] = useState('')

  const [
    cutoffRefreshKey,
    setCutoffRefreshKey,
  ] = useState(0)

  const [
    payrollRefreshKey,
    setPayrollRefreshKey,
  ] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadCompanies() {
      setCompaniesLoading(true)
      setCompanyError(null)

      try {
        const response =
          await listActiveCompanies(
            accessToken,
          )

        if (cancelled) {
          return
        }

        setCompanies(
          response.items,
        )

        setCompanyId(
          (currentCompanyId) => {
            if (
              currentCompanyId &&
              response.items.some(
                (company) =>
                  company.id ===
                  currentCompanyId,
              )
            ) {
              return currentCompanyId
            }

            return (
              response.items[0]?.id ??
              ''
            )
          },
        )
      } catch (error: unknown) {
        if (cancelled) {
          return
        }

        setCompanies([])
        setCompanyId('')

        setCompanyError(
          getErrorMessage(error),
        )
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

    if (!companyId) {
      setCutoffs([])
      setPayrollCutoffId('')
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
        const response =
          await listPayrollCutoffs(
            accessToken,
            companyId,
          )

        if (cancelled) {
          return
        }

        setCutoffs(response)

        setPayrollCutoffId(
          (currentCutoffId) => {
            if (
              currentCutoffId &&
              response.some(
                (cutoff) =>
                  cutoff.id ===
                  currentCutoffId,
              )
            ) {
              return currentCutoffId
            }

            return (
              response[0]?.id ??
              ''
            )
          },
        )
      } catch (error: unknown) {
        if (cancelled) {
          return
        }

        setCutoffs([])
        setPayrollCutoffId('')

        setCutoffError(
          getErrorMessage(error),
        )
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
  }, [
    accessToken,
    companyId,
    cutoffRefreshKey,
  ])

  useEffect(() => {
    let cancelled = false

    if (
      !companyId ||
      !payrollCutoffId
    ) {
      setPayrollRuns([])
      setPayrollRunTotal(0)
      setSelectedPayrollRunId('')
      setPayrollRunsError(null)
      setPayrollRunsLoading(false)

      return () => {
        cancelled = true
      }
    }

    async function loadPayrollRuns() {
      setPayrollRunsLoading(true)
      setPayrollRunsError(null)

      try {
        const response =
          await listPayrollRuns(
            accessToken,
            companyId,
            {
              payrollCutoffId,

              status:
                runStatus === 'ALL'
                  ? undefined
                  : runStatus,

              page: 1,

              pageSize: 100,
            },
          )

        if (cancelled) {
          return
        }

        setPayrollRuns(
          response.items,
        )

        setPayrollRunTotal(
          response.pagination.total,
        )

        setSelectedPayrollRunId(
          (currentPayrollRunId) => {
            if (
              currentPayrollRunId &&
              response.items.some(
                (run) =>
                  run.id ===
                  currentPayrollRunId,
              )
            ) {
              return currentPayrollRunId
            }

            return (
              response.items[0]?.id ??
              ''
            )
          },
        )
      } catch (error: unknown) {
        if (cancelled) {
          return
        }

        setPayrollRuns([])
        setPayrollRunTotal(0)
        setSelectedPayrollRunId('')

        setPayrollRunsError(
          getErrorMessage(error),
        )
      } finally {
        if (!cancelled) {
          setPayrollRunsLoading(false)
        }
      }
    }

    void loadPayrollRuns()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    companyId,
    payrollCutoffId,
    runStatus,
    payrollRefreshKey,
  ])

  const selectedCutoff =
    cutoffs.find(
      (cutoff) =>
        cutoff.id ===
        payrollCutoffId,
    ) ?? null

  const selectedPayrollRun =
    payrollRuns.find(
      (run) =>
        run.id ===
        selectedPayrollRunId,
    ) ?? null

  function handleCompanyChange(
    nextCompanyId: string,
  ) {
    setCompanyId(nextCompanyId)

    setCutoffs([])
    setPayrollCutoffId('')

    setPayrollRuns([])
    setPayrollRunTotal(0)
    setSelectedPayrollRunId('')

    setCutoffError(null)
    setPayrollRunsError(null)

    setRunStatus('ALL')
  }

  function handleCutoffChange(
    nextCutoffId: string,
  ) {
    setPayrollCutoffId(
      nextCutoffId,
    )

    setPayrollRuns([])
    setPayrollRunTotal(0)
    setSelectedPayrollRunId('')

    setPayrollRunsError(null)
    setRunStatus('ALL')
  }

  function handlePayrollLifecycleChanged() {
    setRunStatus('ALL')
    setSelectedPayrollRunId('')

    setCutoffRefreshKey(
      (current) => current + 1,
    )

    setPayrollRefreshKey(
      (current) => current + 1,
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
            Payroll Management
          </h1>

          <p className="page-description">
            Generate, review, reopen,
            regenerate, and inspect
            payroll history by company
            and cutoff.
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
            <h2>
              Payroll Workspace
            </h2>

            <p>
              Select a company and cutoff,
              then review payroll run
              versions.
            </p>
          </div>
        </div>

        <div className="filters payroll-filters">
          <label>
            <span>Company</span>

            <select
              value={companyId}
              disabled={
                companiesLoading ||
                companies.length === 0
              }
              onChange={(event) =>
                handleCompanyChange(
                  event.target.value,
                )
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
              Payroll Cutoff
            </span>

            <select
              value={payrollCutoffId}
              disabled={
                !companyId ||
                cutoffsLoading ||
                cutoffs.length === 0
              }
              onChange={(event) =>
                handleCutoffChange(
                  event.target.value,
                )
              }
            >
              {!companyId && (
                <option value="">
                  Select a company first
                </option>
              )}

              {companyId &&
                cutoffsLoading && (
                  <option value="">
                    Loading cutoffs...
                  </option>
                )}

              {companyId &&
                !cutoffsLoading &&
                cutoffError && (
                  <option value="">
                    Unable to load cutoffs
                  </option>
                )}

              {companyId &&
                !cutoffsLoading &&
                !cutoffError &&
                cutoffs.length === 0 && (
                  <option value="">
                    No payroll cutoffs
                  </option>
                )}

              {cutoffs.map(
                (cutoff) => (
                  <option
                    key={cutoff.id}
                    value={cutoff.id}
                  >
                    {formatDate(
                      cutoff.startDate,
                    )}{' '}
                    –{' '}
                    {formatDate(
                      cutoff.endDate,
                    )}{' '}
                    ·{' '}
                    {formatStatus(
                      cutoff.status,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>
              Run Status
            </span>

            <select
              value={runStatus}
              disabled={
                !companyId ||
                !payrollCutoffId
              }
              onChange={(event) =>
                setRunStatus(
                  event.target
                    .value as PayrollRunStatusFilter,
                )
              }
            >
              <option value="ALL">
                All Versions
              </option>

              <option value="CURRENT_LOCKED">
                Current Locked
              </option>

              <option value="REOPENED_PENDING_REGENERATION">
                Reopened Pending Regeneration
              </option>

              <option value="SUPERSEDED">
                Superseded
              </option>
            </select>
          </label>
        </div>

        {companyError && (
          <div
            className="form-feedback form-feedback-error"
            role="alert"
          >
            {companyError}
          </div>
        )}

        {cutoffError && (
          <div
            className="form-feedback form-feedback-error"
            role="alert"
          >
            {cutoffError}
          </div>
        )}

        {payrollRunsError && (
          <div
            className="form-feedback form-feedback-error"
            role="alert"
          >
            {payrollRunsError}
          </div>
        )}
      </section>

      {selectedCutoff && (
        <PayrollLifecycleActions
          accessToken={accessToken}
          companyId={companyId}
          cutoff={selectedCutoff}
          onChanged={
            handlePayrollLifecycleChanged
          }
        />
      )}

      <div className="workspace">
        <section className="dtr-list-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">
                Payroll Runs
              </p>

              <h2>
                Version History
              </h2>

              <p>
                Each regeneration preserves
                the previous payroll version.
              </p>
            </div>

            <span className="record-count">
              {payrollRunTotal}{' '}
              {payrollRunTotal === 1
                ? 'run'
                : 'runs'}
            </span>
          </div>

          <div className="payroll-run-list">
            {payrollRunsLoading && (
              <div className="empty-state">
                Loading payroll runs...
              </div>
            )}

            {!payrollRunsLoading &&
              payrollRunsError && (
                <div className="empty-state">
                  Unable to load payroll
                  run history.
                </div>
              )}

            {!payrollRunsLoading &&
              !payrollRunsError &&
              payrollRuns.map(
                (run) => (
                  <button
                    key={run.id}
                    type="button"
                    className={`payroll-run-row ${
                      selectedPayrollRunId ===
                      run.id
                        ? 'selected'
                        : ''
                    }`}
                    aria-pressed={
                      selectedPayrollRunId ===
                      run.id
                    }
                    onClick={() =>
                      setSelectedPayrollRunId(
                        run.id,
                      )
                    }
                  >
                    <div className="payroll-run-row-header">
                      <strong>
                        Version {run.version}
                      </strong>

                      <span
                        className={`status-badge payroll-run-status-${run.status.toLowerCase()}`}
                      >
                        {formatStatus(
                          run.status,
                        )}
                      </span>
                    </div>

                    <div className="payroll-run-meta">
                      <span>
                        Generated{' '}
                        {formatDateTime(
                          run.generatedAt,
                        )}
                      </span>

                      <span>
                        {run.employeeCount}{' '}
                        {run.employeeCount === 1
                          ? 'employee'
                          : 'employees'}
                      </span>
                    </div>

                    <div className="payroll-run-totals">
                      <span>
                        Gross
                        <strong>
                          {formatMoney(
                            run.totalGross,
                          )}
                        </strong>
                      </span>

                      <span>
                        Net
                        <strong>
                          {formatMoney(
                            run.totalNet,
                          )}
                        </strong>
                      </span>
                    </div>
                  </button>
                ),
              )}

            {!payrollRunsLoading &&
              !payrollRunsError &&
              payrollRuns.length === 0 && (
                <div className="empty-state">
                  No payroll runs exist for
                  the selected cutoff and
                  status.
                </div>
              )}
          </div>
        </section>

        {selectedPayrollRun ? (
          <PayrollRunDetailPanel
            key={`${selectedPayrollRun.id}-${payrollRefreshKey}`}
            accessToken={accessToken}
            companyId={companyId}
            payrollRunId={
              selectedPayrollRun.id
            }
          />
        ) : (
          <section className="attendance-card">
            <div className="empty-state">
              {payrollRunsLoading
                ? 'Loading payroll history...'
                : 'Select a payroll run to review its details.'}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
