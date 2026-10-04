import {
  useEffect,
  useState,
} from 'react'

import { ApiError } from '../api/client'
import {
  listEmployeePayrollHistory,
  type EmployeePayrollHistoryItem,
  type PayrollRunStatus,
} from '../api/payroll'

import './EmployeePayrollHistoryPanel.css'

interface EmployeePayrollHistoryPanelProps {
  accessToken: string
  companyId: string
  employeeId: string
  employeeName: string
  onClose: () => void
}

type PayrollHistoryStatusFilter =
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

  return 'Unable to load employee payroll history.'
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

function hasSpecialAmounts(
  item: EmployeePayrollHistoryItem,
): boolean {
  return (
    item.heldAmount !== '0.00' ||
    item.thirteenthMonthPay !== '0.00' ||
    item.lastPayAmount !== '0.00' ||
    item.isLastPay
  )
}

export function EmployeePayrollHistoryPanel({
  accessToken,
  companyId,
  employeeId,
  employeeName,
  onClose,
}: EmployeePayrollHistoryPanelProps) {
  const [
    items,
    setItems,
  ] =
    useState<EmployeePayrollHistoryItem[]>([])

  const [
    runStatus,
    setRunStatus,
  ] =
    useState<PayrollHistoryStatusFilter>('ALL')

  const [
    page,
    setPage,
  ] = useState(1)

  const [
    totalPages,
    setTotalPages,
  ] = useState(0)

  const [
    total,
    setTotal,
  ] = useState(0)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] =
    useState<string | null>(null)

  useEffect(() => {
    setPage(1)
  }, [
    employeeId,
    runStatus,
  ])

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      setLoading(true)
      setError(null)

      try {
        const response =
          await listEmployeePayrollHistory(
            accessToken,
            companyId,
            employeeId,
            {
              runStatus:
                runStatus === 'ALL'
                  ? undefined
                  : runStatus,

              page,

              pageSize: 10,
            },
          )

        if (cancelled) {
          return
        }

        setItems(response.items)

        setTotal(
          response.pagination.total,
        )

        setTotalPages(
          response.pagination.totalPages,
        )
      } catch (loadError: unknown) {
        if (cancelled) {
          return
        }

        setItems([])
        setTotal(0)
        setTotalPages(0)

        setError(
          getErrorMessage(loadError),
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    companyId,
    employeeId,
    page,
    runStatus,
  ])

  return (
    <div className="employee-payroll-history">
      <div className="employee-payroll-history-header">
        <div>
          <p className="eyebrow">
            Employee Payroll History
          </p>

          <h3>
            {employeeName}
          </h3>

          <p>
            Immutable payroll results across
            generated payroll versions.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
        >
          Close History
        </button>
      </div>

      <div className="employee-payroll-history-toolbar">
        <label>
          <span>
            Payroll Run Status
          </span>

          <select
            value={runStatus}
            disabled={loading}
            onChange={(event) =>
              setRunStatus(
                event.target
                  .value as PayrollHistoryStatusFilter,
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

        <span className="record-count">
          {total}{' '}
          {total === 1
            ? 'record'
            : 'records'}
        </span>
      </div>

      {error && (
        <div
          className="form-feedback form-feedback-error employee-payroll-history-feedback"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="empty-state">
          Loading employee payroll history...
        </div>
      )}

      {!loading &&
        !error &&
        items.map((item) => (
          <article
            key={item.payrollRunEmployeeId}
            className="employee-payroll-history-item"
          >
            <div className="employee-payroll-history-item-header">
              <div>
                <strong>
                  Payroll Version{' '}
                  {item.payrollRun.version}
                </strong>

                <span>
                  {formatDate(
                    item.cutoff.startDate,
                  )}{' '}
                  –{' '}
                  {formatDate(
                    item.cutoff.endDate,
                  )}
                  {' · '}
                  Pay{' '}
                  {formatDate(
                    item.cutoff.payDate,
                  )}
                </span>

                <span>
                  Generated{' '}
                  {formatDateTime(
                    item.payrollRun
                      .generatedAt,
                  )}
                </span>
              </div>

              <span
                className={`status-badge payroll-run-status-${item.payrollRun.status.toLowerCase()}`}
              >
                {formatStatus(
                  item.payrollRun.status,
                )}
              </span>
            </div>

            <div className="employee-payroll-history-status">
              <span>
                Employee Status

                <strong>
                  {formatStatus(
                    item.payrollStatus,
                  )}
                </strong>
              </span>

              <span>
                Pay Basis

                <strong>
                  {formatStatus(
                    item.payBasis,
                  )}
                </strong>
              </span>

              <span>
                Payout

                <strong>
                  {item.payoutMethod}
                </strong>
              </span>

              <span>
                Base Rate

                <strong>
                  {formatMoney(
                    item.baseRate,
                  )}
                </strong>
              </span>
            </div>

            <div className="employee-payroll-history-values">
              <span>
                Basic Pay

                <strong>
                  {formatMoney(
                    item.basicPay,
                  )}
                </strong>
              </span>

              <span>
                Allowances

                <strong>
                  {formatMoney(
                    item.allowancesTotal,
                  )}
                </strong>
              </span>

              <span>
                Premium Pay

                <strong>
                  {formatMoney(
                    item.premiumPayTotal,
                  )}
                </strong>
              </span>

              <span>
                Gross Pay

                <strong>
                  {formatMoney(
                    item.grossPay,
                  )}
                </strong>
              </span>

              <span>
                Contributions

                <strong>
                  {formatMoney(
                    item.governmentContributionsTotal,
                  )}
                </strong>
              </span>

              <span>
                Tax

                <strong>
                  {formatMoney(
                    item.taxTotal,
                  )}
                </strong>
              </span>

              <span>
                Other Deductions

                <strong>
                  {formatMoney(
                    item.otherDeductionsTotal,
                  )}
                </strong>
              </span>

              <span>
                Total Deductions

                <strong>
                  {formatMoney(
                    item.totalDeductions,
                  )}
                </strong>
              </span>

              <span>
                Net Pay

                <strong>
                  {formatMoney(
                    item.netPay,
                  )}
                </strong>
              </span>

              <span>
                Cash

                <strong>
                  {formatMoney(
                    item.cashPayout,
                  )}
                </strong>
              </span>

              <span>
                ATM

                <strong>
                  {formatMoney(
                    item.atmPayout,
                  )}
                </strong>
              </span>

              <span>
                Withholding Tax

                <strong>
                  {formatMoney(
                    item.withholdingTax,
                  )}
                </strong>
              </span>
            </div>

            {hasSpecialAmounts(item) && (
              <div className="employee-payroll-history-special">
                {item.heldAmount !==
                  '0.00' && (
                  <span>
                    Held Amount:{' '}
                    <strong>
                      {formatMoney(
                        item.heldAmount,
                      )}
                    </strong>
                  </span>
                )}

                {item.thirteenthMonthPay !==
                  '0.00' && (
                  <span>
                    13th Month:{' '}
                    <strong>
                      {formatMoney(
                        item.thirteenthMonthPay,
                      )}
                    </strong>
                  </span>
                )}

                {(item.isLastPay ||
                  item.lastPayAmount !==
                    '0.00') && (
                  <span>
                    Last Pay:{' '}
                    <strong>
                      {formatMoney(
                        item.lastPayAmount,
                      )}
                    </strong>
                  </span>
                )}
              </div>
            )}
          </article>
        ))}

      {!loading &&
        !error &&
        items.length === 0 && (
          <div className="empty-state">
            No payroll history matches the
            selected status.
          </div>
        )}

      {!loading &&
        !error &&
        totalPages > 1 && (
          <div className="employee-payroll-history-pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={page <= 1}
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
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              className="secondary-button"
              disabled={
                page >= totalPages
              }
              onClick={() =>
                setPage(
                  (current) =>
                    Math.min(
                      totalPages,
                      current + 1,
                    ),
                )
              }
            >
              Next
            </button>
          </div>
        )}
    </div>
  )
}
