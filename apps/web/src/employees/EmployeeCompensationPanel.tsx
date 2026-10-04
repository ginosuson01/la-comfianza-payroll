import {
  useEffect,
  useState,
} from 'react'

import { ApiError } from '../api/client'
import {
  getCurrentEmployeeCompensation,
  getEffectiveEmployeeCompensation,
  setEmployeeCompensation,
  type EmployeeCompensationView,
  type EmployeeDirectoryView,
  type EmployeeEffectiveCompensationView,
  type EmployeePayBasis,
} from '../api/employees'

interface EmployeeCompensationPanelProps {
  accessToken: string
  employee: EmployeeDirectoryView

  onCancel: () => void

  onSaved: (
    compensation: EmployeeCompensationView,
  ) => void
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to manage employee compensation.'
}

function formatMoney(
  value: string,
): string {
  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return value
  }

  return new Intl.NumberFormat(
    'en-PH',
    {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    },
  ).format(amount)
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
  ).format(
    new Date(value),
  )
}

function formatCompensationSource(
  source: EmployeeEffectiveCompensationView['source'],
): string {
  if (source === 'EMPLOYEE_OVERRIDE') {
    return 'Employee Override'
  }

  if (source === 'COMPANY_STANDARD') {
    return 'Company Standard'
  }

  return '—'
}

function formatEffectiveRate(
  rate: string | null,
  payBasis: EmployeePayBasis | null,
): string {
  if (!rate) {
    return '—'
  }

  const unit =
    payBasis === 'DAILY'
      ? 'day'
      : payBasis === 'MONTHLY'
        ? 'month'
        : null

  return unit
    ? `${formatMoney(rate)} / ${unit}`
    : formatMoney(rate)
}

export function EmployeeCompensationPanel({
  accessToken,
  employee,
  onCancel,
  onSaved,
}: EmployeeCompensationPanelProps) {
  const [
    compensation,
    setCompensation,
  ] =
    useState<EmployeeCompensationView | null>(
      null,
    )

  const [
    effectiveCompensation,
    setEffectiveCompensation,
  ] =
    useState<EmployeeEffectiveCompensationView | null>(
      null,
    )

  const [
    payBasis,
    setPayBasis,
  ] =
    useState<EmployeePayBasis>('DAILY')

  const [
    rate,
    setRate,
  ] = useState('')

  const [
    effectiveFrom,
    setEffectiveFrom,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const currentEmployment =
    employee.currentEmployment

  useEffect(() => {
    let cancelled = false

    async function loadCompensation() {
      if (!currentEmployment) {
        setCompensation(null)
        setEffectiveCompensation(null)
        setLoading(false)

        return
      }

      try {
        setLoading(true)
        setError(null)

        const [
          result,
          effectiveResult,
        ] = await Promise.all([
          getCurrentEmployeeCompensation(
            accessToken,
            employee.id,
          ),
          getEffectiveEmployeeCompensation(
            accessToken,
            employee.id,
          ),
        ])

        if (cancelled) {
          return
        }

        setCompensation(result)
        setEffectiveCompensation(effectiveResult)

        if (result) {
          setPayBasis(
            result.payBasis,
          )

          setRate(
            result.rate,
          )

          setEffectiveFrom('')
        } else {
          setPayBasis('DAILY')
          setRate('')

          setEffectiveFrom(
            currentEmployment.startDate.slice(
              0,
              10,
            ),
          )
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
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

    void loadCompensation()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    employee.id,
    currentEmployment,
  ])

  if (!currentEmployment) {
    return (
      <div className="employee-compensation-panel">
        <div className="employee-form-header">
          <div>
            <p className="eyebrow">
              Payroll Configuration
            </p>

            <h2>
              Employee Compensation
            </h2>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>

        <div
          className="form-feedback form-feedback-error"
          role="alert"
        >
          Current employment assignment is
          required before compensation can be
          configured.
        </div>
      </div>
    )
  }

  const parsedRate =
    Number(rate)

  const validRate =
    rate.trim().length > 0 &&
    Number.isFinite(parsedRate) &&
    parsedRate > 0

  const validEffectiveDate =
    effectiveFrom.length > 0

  const formValid =
    validRate &&
    validEffectiveDate

  async function handleSave() {
    setError(null)

    if (!validRate) {
      setError(
        'Rate must be a positive number.',
      )

      return
    }

    if (!validEffectiveDate) {
      setError(
        'Effective From date is required.',
      )

      return
    }

    try {
      setSaving(true)

      const saved =
        await setEmployeeCompensation(
          accessToken,
          employee.id,
          {
            payBasis,
            rate: parsedRate,
            effectiveFrom,
          },
        )

      setCompensation(saved)

      onSaved(saved)
    } catch (saveError: unknown) {
      setError(
        getErrorMessage(
          saveError,
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-compensation-panel">
      <div className="employee-form-header">
        <div>
          <p className="eyebrow">
            Payroll Configuration
          </p>

          <h2>
            Employee Compensation
          </h2>

          <p>
            {employee.fullName}
            {' · '}
            {employee.employeeNumber}
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      {loading ? (
        <div className="employee-compensation-loading">
          Loading compensation...
        </div>
      ) : (
        <>
          <div className="employee-profile-section">
            <h3>
              Effective Compensation
            </h3>

            {effectiveCompensation ? (
              <>
                <div className="employee-profile-grid">
                  <div>
                    <span>
                      Classification
                    </span>

                    <strong>
                      {
                        effectiveCompensation.classification
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Compensation Source
                    </span>

                    <strong>
                      {formatCompensationSource(
                        effectiveCompensation.source,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Effective Rate
                    </span>

                    <strong>
                      {formatEffectiveRate(
                        effectiveCompensation.rate,
                        effectiveCompensation.payBasis,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      As Of
                    </span>

                    <strong>
                      {formatDate(
                        effectiveCompensation.asOfDate,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Minimum Wage
                    </span>

                    <strong>
                      {effectiveCompensation.minimumWage
                        ? `${formatMoney(
                            effectiveCompensation
                              .minimumWage.dailyRate,
                          )} / day`
                        : '—'}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Wage Order
                    </span>

                    <strong>
                      {
                        effectiveCompensation
                          .minimumWage
                          ?.wageOrderCode ?? '—'
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Area
                    </span>

                    <strong>
                      {
                        effectiveCompensation
                          .minimumWage
                          ?.areaClassification ?? '—'
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Sector
                    </span>

                    <strong>
                      {
                        effectiveCompensation
                          .minimumWage
                          ?.sector ?? '—'
                      }
                    </strong>
                  </div>
                </div>

                {effectiveCompensation
                  .classificationReason && (
                  <div className="employee-form-info">
                    {
                      effectiveCompensation
                        .classificationReason
                    }
                  </div>
                )}
              </>
            ) : (
              <div className="employee-compensation-empty">
                Effective compensation could not be
                resolved.
              </div>
            )}
          </div>

          <div className="employee-profile-section">
            <h3>
              Employee Override
            </h3>

            {compensation ? (
              <div className="employee-profile-grid">
                <div>
                  <span>
                    Pay Basis
                  </span>

                  <strong>
                    {
                      compensation.payBasis
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Rate
                  </span>

                  <strong>
                    {formatMoney(
                      compensation.rate,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Effective From
                  </span>

                  <strong>
                    {formatDate(
                      compensation.effectiveFrom,
                    )}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="employee-compensation-empty">
                No employee-specific compensation
                override is configured. The company
                standard applies when one is effective.
              </div>
            )}
          </div>

          <div className="employee-profile-section">
            <h3>
              {compensation
                ? 'Change Employee Override'
                : 'Set Employee Override'}
            </h3>

            <div className="employee-compensation-form-grid">
              <label>
                <span>
                  Pay Basis
                </span>

                <select
                  value={payBasis}
                  disabled={saving}
                  onChange={(event) =>
                    setPayBasis(
                      event.target
                        .value as EmployeePayBasis,
                    )
                  }
                >
                  <option value="DAILY">
                    DAILY
                  </option>

                  <option value="MONTHLY">
                    MONTHLY
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Rate
                </span>

                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={rate}
                  disabled={saving}
                  placeholder="0.00"
                  onChange={(event) =>
                    setRate(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Effective From
                </span>

                <input
                  type="date"
                  value={effectiveFrom}
                  disabled={saving}
                  min={currentEmployment.startDate.slice(
                    0,
                    10,
                  )}
                  onChange={(event) =>
                    setEffectiveFrom(
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>

            <div className="employee-employment-note">
              {compensation
                ? (
                    <>
                      Saving creates the next
                      effective-dated employee
                      compensation override. The effective date
                      must be after the current
                      compensation effective date.
                    </>
                  )
                : (
                    <>
                      The first employee override
                      effective date cannot be
                      before the current employment
                      start date.
                    </>
                  )}
              {' '}
              No payroll computation formula is
              changed by this screen.
            </div>
          </div>

          {error && (
            <div
              className="form-feedback form-feedback-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="employee-form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </button>

            <button
              type="button"
              className="primary-button"
              disabled={
                saving ||
                !formValid
              }
              onClick={() =>
                void handleSave()
              }
            >
              {saving
                ? 'Saving...'
                : compensation
                  ? 'Save New Employee Override'
                  : 'Set Employee Override'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
