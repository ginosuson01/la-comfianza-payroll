import {
  useEffect,
  useState,
} from 'react'

import { ApiError } from '../api/client'
import {
  createEmployeeRecurringPayrollItem,
  listEmployeeRecurringPayrollItems,
  updateEmployeeRecurringPayrollItemPagIbigTreatment,
  type EmployeeDirectoryView,
  type EmployeePayrollStatutoryBasisTreatment,
  type EmployeeRecurringPayrollItemKind,
  type EmployeeRecurringPayrollItemView,
} from '../api/employees'

interface EmployeeRecurringPayrollPanelProps {
  accessToken: string
  employee: EmployeeDirectoryView

  onCancel: () => void
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

  return 'Unable to manage recurring payroll items.'
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
      maximumFractionDigits: 2,
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
  ).format(new Date(value))
}

function formatKind(
  kind: EmployeeRecurringPayrollItemKind,
): string {
  return kind === 'ALLOWANCE'
    ? 'Allowance'
    : 'Fixed Deduction'
}

export function EmployeeRecurringPayrollPanel({
  accessToken,
  employee,
  onCancel,
}: EmployeeRecurringPayrollPanelProps) {
  const [
    items,
    setItems,
  ] = useState<EmployeeRecurringPayrollItemView[]>([])

  const [
    kind,
    setKind,
  ] =
    useState<EmployeeRecurringPayrollItemKind>(
      'ALLOWANCE',
    )

  const [
    code,
    setCode,
  ] = useState('')

  const [
    description,
    setDescription,
  ] = useState('')

  const [
    amount,
    setAmount,
  ] = useState('')

  const [
    taxable,
    setTaxable,
  ] = useState(false)

  const [
    treatment,
    setTreatment,
  ] =
    useState<EmployeePayrollStatutoryBasisTreatment | ''>(
      '',
    )

  const [
    effectiveFrom,
    setEffectiveFrom,
  ] = useState(
    employee.currentEmployment?.startDate.slice(
      0,
      10,
    ) ?? '',
  )

  const [
    correctionDrafts,
    setCorrectionDrafts,
  ] = useState<
    Record<
      string,
      EmployeePayrollStatutoryBasisTreatment | ''
    >
  >({})

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    correctingId,
    setCorrectingId,
  ] = useState<string | null>(null)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const [
    message,
    setMessage,
  ] = useState<string | null>(null)

  const currentEmployment =
    employee.currentEmployment

  async function loadItems() {
    if (!currentEmployment) {
      setItems([])
      setLoading(false)

      return
    }

    try {
      setLoading(true)
      setError(null)

      const result =
        await listEmployeeRecurringPayrollItems(
          accessToken,
          employee.id,
        )

      setItems(result)

      setCorrectionDrafts(
        Object.fromEntries(
          result
            .filter(
              (item) =>
                item.kind === 'ALLOWANCE',
            )
            .map(
              (item) => [
                item.id,
                item.pagIbigFundSalaryTreatment ??
                  '',
              ],
            ),
        ),
      )
    } catch (loadError: unknown) {
      setItems([])
      setError(
        getErrorMessage(loadError),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!currentEmployment) {
        if (!cancelled) {
          setItems([])
          setLoading(false)
        }

        return
      }

      try {
        setLoading(true)
        setError(null)

        const result =
          await listEmployeeRecurringPayrollItems(
            accessToken,
            employee.id,
          )

        if (cancelled) {
          return
        }

        setItems(result)

        setCorrectionDrafts(
          Object.fromEntries(
            result
              .filter(
                (item) =>
                  item.kind === 'ALLOWANCE',
              )
              .map(
                (item) => [
                  item.id,
                  item.pagIbigFundSalaryTreatment ??
                    '',
                ],
              ),
          ),
        )
      } catch (loadError: unknown) {
        if (!cancelled) {
          setItems([])
          setError(
            getErrorMessage(loadError),
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

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
      <div className="employee-recurring-payroll-panel">
        <div className="employee-form-header">
          <div>
            <p className="eyebrow">
              Payroll Configuration
            </p>

            <h2>
              Recurring Payroll Items
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
          required before recurring payroll
          items can be configured.
        </div>
      </div>
    )
  }

  const parsedAmount =
    Number(amount)

  const validAmount =
    amount.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    /^\d+(\.\d{1,2})?$/.test(
      amount.trim(),
    )

  const formValid =
    code.trim().length > 0 &&
    description.trim().length > 0 &&
    validAmount &&
    effectiveFrom.length > 0 &&
    (
      kind === 'FIXED_DEDUCTION' ||
      treatment !== ''
    )

  function resetForm() {
    setKind('ALLOWANCE')
    setCode('')
    setDescription('')
    setAmount('')
    setTaxable(false)
    setTreatment('')
    setEffectiveFrom(
      currentEmployment.startDate.slice(
        0,
        10,
      ),
    )
  }

  async function handleCreate() {
    setError(null)
    setMessage(null)

    if (!formValid) {
      setError(
        'Complete all required recurring payroll item fields.',
      )

      return
    }

    try {
      setSaving(true)

      await createEmployeeRecurringPayrollItem(
        accessToken,
        employee.id,
        {
          kind,

          code: code.trim().toUpperCase(),
          description:
            description.trim(),

          amount: parsedAmount,

          ...(kind === 'ALLOWANCE'
            ? {
                taxable,

                pagIbigFundSalaryTreatment:
                  treatment as EmployeePayrollStatutoryBasisTreatment,
              }
            : {}),

          effectiveFrom,
        },
      )

      resetForm()

      await loadItems()

      setMessage(
        'Recurring payroll item created successfully.',
      )
    } catch (saveError: unknown) {
      setError(
        getErrorMessage(saveError),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleTreatmentCorrection(
    item: EmployeeRecurringPayrollItemView,
  ) {
    const nextTreatment =
      correctionDrafts[item.id]

    setError(null)
    setMessage(null)

    if (
      item.kind !== 'ALLOWANCE' ||
      !nextTreatment
    ) {
      setError(
        'Select INCLUDE or EXCLUDE for the recurring allowance.',
      )

      return
    }

    if (
      nextTreatment ===
      item.pagIbigFundSalaryTreatment
    ) {
      setError(
        'Select a different Pag-IBIG Fund Salary treatment before saving.',
      )

      return
    }

    try {
      setCorrectingId(item.id)

      await updateEmployeeRecurringPayrollItemPagIbigTreatment(
        accessToken,
        employee.id,
        item.id,
        {
          pagIbigFundSalaryTreatment:
            nextTreatment,
        },
      )

      await loadItems()

      setMessage(
        `Pag-IBIG treatment for ${item.code} updated successfully.`,
      )
    } catch (saveError: unknown) {
      setError(
        getErrorMessage(saveError),
      )
    } finally {
      setCorrectingId(null)
    }
  }

  return (
    <div className="employee-recurring-payroll-panel">
      <div className="employee-form-header">
        <div>
          <p className="eyebrow">
            Payroll Configuration
          </p>

          <h2>
            Recurring Payroll Items
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
          disabled={
            saving ||
            correctingId !== null
          }
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      <div className="employee-profile-section">
        <h3>
          Active Recurring Items
        </h3>

        {loading ? (
          <div className="employee-recurring-payroll-empty">
            Loading recurring payroll items...
          </div>
        ) : items.length === 0 ? (
          <div className="employee-recurring-payroll-empty">
            No active recurring payroll items
            are configured for this employee.
          </div>
        ) : (
          <div className="employee-recurring-payroll-list">
            {items.map((item) => (
              <div
                key={item.id}
                className="employee-recurring-payroll-item"
              >
                <div className="employee-recurring-payroll-item-summary">
                  <strong>
                    {item.code}
                    {' · '}
                    {item.description}
                  </strong>

                  <span>
                    {formatKind(item.kind)}
                    {' · '}
                    {formatMoney(item.amount)}
                    {' · Effective '}
                    {formatDate(
                      item.effectiveFrom,
                    )}
                  </span>

                  {item.kind ===
                    'ALLOWANCE' && (
                    <small>
                      Pag-IBIG Fund Salary:
                      {' '}
                      {item.pagIbigFundSalaryTreatment ??
                        'Classification required'}
                    </small>
                  )}
                </div>

                {item.kind ===
                  'ALLOWANCE' && (
                  <div className="employee-recurring-payroll-correction">
                    <select
                      aria-label={`Pag-IBIG treatment for ${item.code}`}
                      value={
                        correctionDrafts[
                          item.id
                        ] ?? ''
                      }
                      disabled={
                        correctingId !== null
                      }
                      onChange={(event) =>
                        setCorrectionDrafts(
                          (current) => ({
                            ...current,
                            [item.id]:
                              event.target
                                .value as
                                | EmployeePayrollStatutoryBasisTreatment
                                | '',
                          }),
                        )
                      }
                    >
                      <option value="">
                        Select treatment
                      </option>

                      <option value="INCLUDE">
                        INCLUDE
                      </option>

                      <option value="EXCLUDE">
                        EXCLUDE
                      </option>
                    </select>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        correctingId !==
                          null ||
                        !correctionDrafts[
                          item.id
                        ] ||
                        correctionDrafts[
                          item.id
                        ] ===
                          item.pagIbigFundSalaryTreatment
                      }
                      onClick={() =>
                        void handleTreatmentCorrection(
                          item,
                        )
                      }
                    >
                      {correctingId ===
                      item.id
                        ? 'Saving...'
                        : item
                              .pagIbigFundSalaryTreatment
                          ? 'Correct Treatment'
                          : 'Set Treatment'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="employee-profile-section">
        <h3>
          Add Recurring Payroll Item
        </h3>

        <div className="employee-recurring-payroll-form-grid">
          <label>
            <span>
              Type
            </span>

            <select
              value={kind}
              disabled={saving}
              onChange={(event) => {
                const nextKind =
                  event.target
                    .value as EmployeeRecurringPayrollItemKind

                setKind(nextKind)

                if (
                  nextKind ===
                  'FIXED_DEDUCTION'
                ) {
                  setTreatment('')
                  setTaxable(false)
                }
              }}
            >
              <option value="ALLOWANCE">
                Allowance
              </option>

              <option value="FIXED_DEDUCTION">
                Fixed Deduction
              </option>
            </select>
          </label>

          <label>
            <span>
              Code
            </span>

            <input
              value={code}
              maxLength={50}
              disabled={saving}
              placeholder="e.g. RICE"
              onChange={(event) =>
                setCode(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Description
            </span>

            <input
              value={description}
              maxLength={200}
              disabled={saving}
              placeholder="e.g. Rice Allowance"
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Amount
            </span>

            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              disabled={saving}
              placeholder="0.00"
              onChange={(event) =>
                setAmount(
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
              min={currentEmployment.startDate.slice(
                0,
                10,
              )}
              disabled={saving}
              onChange={(event) =>
                setEffectiveFrom(
                  event.target.value,
                )
              }
            />
          </label>

          {kind === 'ALLOWANCE' && (
            <label>
              <span>
                Pag-IBIG Fund Salary
              </span>

              <select
                value={treatment}
                disabled={saving}
                onChange={(event) =>
                  setTreatment(
                    event.target
                      .value as
                      | EmployeePayrollStatutoryBasisTreatment
                      | '',
                  )
                }
              >
                <option value="">
                  Select treatment
                </option>

                <option value="INCLUDE">
                  INCLUDE
                </option>

                <option value="EXCLUDE">
                  EXCLUDE
                </option>
              </select>
            </label>
          )}
        </div>

        {kind === 'ALLOWANCE' && (
          <label className="employee-recurring-payroll-checkbox">
            <input
              type="checkbox"
              checked={taxable}
              disabled={saving}
              onChange={(event) =>
                setTaxable(
                  event.target.checked,
                )
              }
            />

            <span>
              Taxable allowance
            </span>
          </label>
        )}

        <div className="employee-employment-note">
          Recurring allowances require an
          explicit Pag-IBIG Fund Salary
          classification. Existing legacy
          allowances with no classification
          remain unresolved until a Payroll
          Manager sets INCLUDE or EXCLUDE.
          Fixed deductions do not participate
          in this classification.
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

      {message && (
        <div
          className="employee-action-feedback"
          role="status"
        >
          {message}
        </div>
      )}

      <div className="employee-form-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={
            saving ||
            correctingId !== null
          }
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          type="button"
          className="primary-button"
          disabled={
            saving ||
            correctingId !== null ||
            !formValid
          }
          onClick={() =>
            void handleCreate()
          }
        >
          {saving
            ? 'Saving...'
            : 'Add Recurring Item'}
        </button>
      </div>
    </div>
  )
}
