import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  listCutoffEmployees,
  type CutoffEmployeeView,
} from '../api/cutoff-employees'
import { ApiError } from '../api/client'
import {
  createPayrollAdjustment,
  deletePayrollAdjustment,
  listPayrollAdjustments,
  updatePayrollAdjustment,
  type PayrollAdjustment,
  type PayrollAdjustmentType,
  type PayrollStatutoryBasisTreatment,
} from '../api/payroll'
import type { PayrollCutoffStatus } from '../api/types'

import './PayrollAdjustmentPanel.css'

interface PayrollAdjustmentPanelProps {
  accessToken: string
  companyId: string
  payrollCutoffId: string
  cutoffStatus: PayrollCutoffStatus
  onChanged: () => void
}

type TaxableSelection =
  | 'UNSPECIFIED'
  | 'TAXABLE'
  | 'NON_TAXABLE'

interface AdjustmentFormState {
  type: PayrollAdjustmentType
  code: string
  description: string
  amount: string
  reason: string
  taxable: TaxableSelection
  pagIbigFundSalaryTreatment:
    | PayrollStatutoryBasisTreatment
    | ''
}

const emptyForm: AdjustmentFormState = {
  type: 'EARNING',
  code: '',
  description: '',
  amount: '',
  reason: '',
  taxable: 'UNSPECIFIED',
  pagIbigFundSalaryTreatment: '',
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

  return 'Unable to update payroll adjustments.'
}

function formatEmployeeName(
  employee: CutoffEmployeeView,
): string {
  return [
    employee.firstName,
    employee.middleName,
    employee.lastName,
    employee.suffix,
  ]
    .filter(
      (value): value is string =>
        Boolean(value?.trim()),
    )
    .join(' ')
}

function formatMoney(
  value: string,
): string {
  const amount =
    Number(value)

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

function taxableLabel(
  value: boolean | null,
): string {
  if (value === true) {
    return 'Taxable'
  }

  if (value === false) {
    return 'Non-taxable'
  }

  return 'Not specified'
}

function basisTreatmentLabel(
  value:
    | PayrollStatutoryBasisTreatment
    | null,
): string {
  if (value === 'INCLUDE') {
    return 'Include in Pag-IBIG Fund Salary'
  }

  if (value === 'EXCLUDE') {
    return 'Exclude from Pag-IBIG Fund Salary'
  }

  return 'Not applicable'
}

export function PayrollAdjustmentPanel({
  accessToken,
  companyId,
  payrollCutoffId,
  cutoffStatus,
  onChanged,
}: PayrollAdjustmentPanelProps) {
  const mutable =
    cutoffStatus === 'OPEN' ||
    cutoffStatus === 'REOPENED'

  const [
    employees,
    setEmployees,
  ] = useState<CutoffEmployeeView[]>([])

  const [
    selectedEmployeeId,
    setSelectedEmployeeId,
  ] = useState('')

  const [
    employeesLoading,
    setEmployeesLoading,
  ] = useState(false)

  const [
    adjustments,
    setAdjustments,
  ] = useState<PayrollAdjustment[]>([])

  const [
    adjustmentsLoading,
    setAdjustmentsLoading,
  ] = useState(false)

  const [
    form,
    setForm,
  ] =
    useState<AdjustmentFormState>(emptyForm)

  const [
    editingAdjustmentId,
    setEditingAdjustmentId,
  ] = useState<string | null>(null)

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    deletingAdjustmentId,
    setDeletingAdjustmentId,
  ] = useState<string | null>(null)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const [
    message,
    setMessage,
  ] = useState<string | null>(null)

  const selectedEmployee =
    useMemo(
      () =>
        employees.find(
          (employee) =>
            employee.employeeId ===
            selectedEmployeeId,
        ) ?? null,
      [
        employees,
        selectedEmployeeId,
      ],
    )

  useEffect(() => {
    let cancelled = false

    async function loadEmployees() {
      setEmployeesLoading(true)
      setError(null)

      try {
        const response =
          await listCutoffEmployees(
            accessToken,
            {
              companyId,
              payrollCutoffId,
            },
          )

        if (cancelled) {
          return
        }

        setEmployees(response)

        setSelectedEmployeeId(
          (currentEmployeeId) => {
            if (
              currentEmployeeId &&
              response.some(
                (employee) =>
                  employee.employeeId ===
                  currentEmployeeId,
              )
            ) {
              return currentEmployeeId
            }

            return (
              response[0]?.employeeId ??
              ''
            )
          },
        )
      } catch (loadError: unknown) {
        if (cancelled) {
          return
        }

        setEmployees([])
        setSelectedEmployeeId('')

        setError(
          getErrorMessage(loadError),
        )
      } finally {
        if (!cancelled) {
          setEmployeesLoading(false)
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
    payrollCutoffId,
  ])

  useEffect(() => {
    let cancelled = false

    if (!selectedEmployeeId) {
      setAdjustments([])
      setAdjustmentsLoading(false)

      return () => {
        cancelled = true
      }
    }

    async function loadAdjustments() {
      setAdjustmentsLoading(true)
      setError(null)

      try {
        const response =
          await listPayrollAdjustments(
            accessToken,
            companyId,
            payrollCutoffId,
            selectedEmployeeId,
          )

        if (cancelled) {
          return
        }

        setAdjustments(response)
      } catch (loadError: unknown) {
        if (cancelled) {
          return
        }

        setAdjustments([])

        setError(
          getErrorMessage(loadError),
        )
      } finally {
        if (!cancelled) {
          setAdjustmentsLoading(false)
        }
      }
    }

    void loadAdjustments()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    companyId,
    payrollCutoffId,
    selectedEmployeeId,
  ])

  function resetForm() {
    setForm(emptyForm)
    setEditingAdjustmentId(null)
  }

  function handleEmployeeChange(
    employeeId: string,
  ) {
    setSelectedEmployeeId(employeeId)
    setAdjustments([])
    setMessage(null)
    setError(null)
    resetForm()
  }

  function handleTypeChange(
    type: PayrollAdjustmentType,
  ) {
    setForm(
      (current) => ({
        ...current,
        type,
        pagIbigFundSalaryTreatment:
          type === 'EARNING'
            ? current.pagIbigFundSalaryTreatment
            : '',
      }),
    )
  }

  function beginEdit(
    adjustment: PayrollAdjustment,
  ) {
    if (!mutable) {
      return
    }

    setEditingAdjustmentId(
      adjustment.id,
    )

    setForm({
      type: adjustment.type,
      code: adjustment.code,
      description:
        adjustment.description,
      amount: adjustment.amount,
      reason: adjustment.reason,
      taxable:
        adjustment.taxable === true
          ? 'TAXABLE'
          : adjustment.taxable === false
            ? 'NON_TAXABLE'
            : 'UNSPECIFIED',
      pagIbigFundSalaryTreatment:
        adjustment.pagIbigFundSalaryTreatment ??
        '',
    })

    setError(null)
    setMessage(null)
  }

  function validateForm():
    | string
    | null {
    if (!selectedEmployeeId) {
      return 'Select an employee first.'
    }

    if (!form.code.trim()) {
      return 'Adjustment code is required.'
    }

    if (!form.description.trim()) {
      return 'Description is required.'
    }

    const amount =
      Number(form.amount)

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return 'Amount must be greater than zero.'
    }

    if (
      !/^\d+(?:\.\d{1,2})?$/.test(
        form.amount.trim(),
      )
    ) {
      return 'Amount must use no more than 2 decimal places.'
    }

    if (
      amount >
      999999999999.99
    ) {
      return 'Amount exceeds the maximum allowed value.'
    }

    if (!form.reason.trim()) {
      return 'Reason is required.'
    }

    if (
      form.type === 'EARNING' &&
      !form.pagIbigFundSalaryTreatment
    ) {
      return 'Pag-IBIG Fund Salary treatment is required for earnings.'
    }

    return null
  }

  async function reloadAdjustments() {
    if (!selectedEmployeeId) {
      return
    }

    const response =
      await listPayrollAdjustments(
        accessToken,
        companyId,
        payrollCutoffId,
        selectedEmployeeId,
      )

    setAdjustments(response)
  }

  async function handleSubmit() {
    if (
      !mutable ||
      submitting
    ) {
      return
    }

    const validationError =
      validateForm()

    if (validationError) {
      setMessage(null)
      setError(validationError)

      return
    }

    const amount =
      Number(form.amount)

    const taxable =
      form.taxable === 'UNSPECIFIED'
        ? undefined
        : form.taxable === 'TAXABLE'

    const commonInput = {
      type: form.type,

      code:
        form.code
          .trim()
          .toUpperCase(),

      description:
        form.description.trim(),

      amount,

      reason:
        form.reason.trim(),

      ...(taxable === undefined
        ? {}
        : {
            taxable,
          }),

      ...(form.type === 'EARNING'
        ? {
            pagIbigFundSalaryTreatment:
              form.pagIbigFundSalaryTreatment as PayrollStatutoryBasisTreatment,
          }
        : {}),
    }

    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      if (editingAdjustmentId) {
        await updatePayrollAdjustment(
          accessToken,
          companyId,
          payrollCutoffId,
          selectedEmployeeId,
          editingAdjustmentId,
          commonInput,
        )

        setMessage(
          'Payroll adjustment updated successfully.',
        )
      } else {
        await createPayrollAdjustment(
          accessToken,
          companyId,
          payrollCutoffId,
          selectedEmployeeId,
          commonInput,
        )

        setMessage(
          'Payroll adjustment added successfully.',
        )
      }

      resetForm()

      await reloadAdjustments()

      onChanged()
    } catch (submitError: unknown) {
      setError(
        getErrorMessage(submitError),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(
    adjustment: PayrollAdjustment,
  ) {
    if (
      !mutable ||
      deletingAdjustmentId
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Delete payroll adjustment ${adjustment.code}? This source adjustment will be removed before payroll generation or regeneration.`,
      )

    if (!confirmed) {
      return
    }

    setDeletingAdjustmentId(
      adjustment.id,
    )

    setError(null)
    setMessage(null)

    try {
      await deletePayrollAdjustment(
        accessToken,
        companyId,
        payrollCutoffId,
        adjustment.employeeId,
        adjustment.id,
      )

      if (
        editingAdjustmentId ===
        adjustment.id
      ) {
        resetForm()
      }

      await reloadAdjustments()

      setMessage(
        'Payroll adjustment deleted successfully.',
      )

      onChanged()
    } catch (deleteError: unknown) {
      setError(
        getErrorMessage(deleteError),
      )
    } finally {
      setDeletingAdjustmentId(null)
    }
  }

  return (
    <div className="payroll-adjustment-panel">
      <div className="payroll-adjustment-heading">
        <div>
          <strong>
            Structured Payroll Adjustments
          </strong>

          <span>
            Add approved earnings or deductions before payroll is finalized.
          </span>
        </div>

        {!mutable && (
          <span className="payroll-adjustment-readonly">
            Read only · Reopen payroll to make corrections
          </span>
        )}
      </div>

      <label className="payroll-adjustment-employee">
        <span>
          Employee
        </span>

        <select
          value={selectedEmployeeId}
          disabled={
            employeesLoading ||
            employees.length === 0 ||
            submitting
          }
          onChange={(event) =>
            handleEmployeeChange(
              event.target.value,
            )
          }
        >
          {employeesLoading && (
            <option value="">
              Loading employees...
            </option>
          )}

          {!employeesLoading &&
            employees.length === 0 && (
              <option value="">
                No eligible employees
              </option>
            )}

          {employees.map(
            (employee) => (
              <option
                key={employee.employeeId}
                value={employee.employeeId}
              >
                {employee.employeeNumber}
                {' · '}
                {formatEmployeeName(
                  employee,
                )}
              </option>
            ),
          )}
        </select>
      </label>

      {selectedEmployee && (
        <div className="payroll-adjustment-employee-summary">
          <strong>
            {selectedEmployee.employeeNumber}
            {' · '}
            {formatEmployeeName(
              selectedEmployee,
            )}
          </strong>

          <span>
            {selectedEmployee.currentStatus}
          </span>
        </div>
      )}

      <div className="payroll-adjustment-list">
        {adjustmentsLoading && (
          <div className="payroll-adjustment-empty">
            Loading adjustments...
          </div>
        )}

        {!adjustmentsLoading &&
          adjustments.length === 0 && (
            <div className="payroll-adjustment-empty">
              No structured payroll adjustments for this employee.
            </div>
          )}

        {!adjustmentsLoading &&
          adjustments.map(
            (adjustment) => (
              <div
                key={adjustment.id}
                className="payroll-adjustment-row"
              >
                <div className="payroll-adjustment-row-main">
                  <div className="payroll-adjustment-row-title">
                    <strong>
                      {adjustment.code}
                    </strong>

                    <span
                      className={`payroll-adjustment-type payroll-adjustment-type-${adjustment.type.toLowerCase()}`}
                    >
                      {adjustment.type}
                    </span>
                  </div>

                  <span>
                    {adjustment.description}
                  </span>

                  <small>
                    {taxableLabel(
                      adjustment.taxable,
                    )}
                    {' · '}
                    {basisTreatmentLabel(
                      adjustment.pagIbigFundSalaryTreatment,
                    )}
                  </small>

                  <small>
                    Reason: {adjustment.reason}
                  </small>
                </div>

                <div className="payroll-adjustment-row-side">
                  <strong>
                    {formatMoney(
                      adjustment.amount,
                    )}
                  </strong>

                  {mutable && (
                    <div className="payroll-adjustment-row-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={
                          submitting ||
                          Boolean(
                            deletingAdjustmentId,
                          )
                        }
                        onClick={() =>
                          beginEdit(
                            adjustment,
                          )
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        disabled={
                          submitting ||
                          Boolean(
                            deletingAdjustmentId,
                          )
                        }
                        onClick={() =>
                          void handleDelete(
                            adjustment,
                          )
                        }
                      >
                        {deletingAdjustmentId ===
                        adjustment.id
                          ? 'Deleting...'
                          : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
      </div>

      {mutable &&
        selectedEmployeeId && (
          <div className="payroll-adjustment-form">
            <div className="payroll-adjustment-form-heading">
              <strong>
                {editingAdjustmentId
                  ? 'Edit Adjustment'
                  : 'Add Adjustment'}
              </strong>

              {editingAdjustmentId && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={submitting}
                  onClick={resetForm}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="payroll-adjustment-form-grid">
              <label>
                <span>
                  Type
                </span>

                <select
                  value={form.type}
                  disabled={submitting}
                  onChange={(event) =>
                    handleTypeChange(
                      event.target
                        .value as PayrollAdjustmentType,
                    )
                  }
                >
                  <option value="EARNING">
                    Earning
                  </option>

                  <option value="DEDUCTION">
                    Deduction
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Code
                </span>

                <input
                  type="text"
                  maxLength={50}
                  value={form.code}
                  disabled={submitting}
                  placeholder="BONUS"
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        code:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label className="payroll-adjustment-description-field">
                <span>
                  Description
                </span>

                <input
                  type="text"
                  maxLength={200}
                  value={form.description}
                  disabled={submitting}
                  placeholder="Performance Bonus"
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      }),
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
                  max="999999999999.99"
                  step="0.01"
                  value={form.amount}
                  disabled={submitting}
                  placeholder="0.00"
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        amount:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Tax Treatment
                </span>

                <select
                  value={form.taxable}
                  disabled={submitting}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        taxable:
                          event.target
                            .value as TaxableSelection,
                      }),
                    )
                  }
                >
                  <option value="UNSPECIFIED">
                    Not specified
                  </option>

                  <option value="TAXABLE">
                    Taxable
                  </option>

                  <option value="NON_TAXABLE">
                    Non-taxable
                  </option>
                </select>
              </label>

              {form.type ===
                'EARNING' && (
                <label>
                  <span>
                    Pag-IBIG Fund Salary
                  </span>

                  <select
                    value={
                      form.pagIbigFundSalaryTreatment
                    }
                    disabled={submitting}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          pagIbigFundSalaryTreatment:
                            event.target
                              .value as
                              | PayrollStatutoryBasisTreatment
                              | '',
                        }),
                      )
                    }
                  >
                    <option value="">
                      Select treatment
                    </option>

                    <option value="INCLUDE">
                      Include
                    </option>

                    <option value="EXCLUDE">
                      Exclude
                    </option>
                  </select>
                </label>
              )}

              <label className="payroll-adjustment-reason-field">
                <span>
                  Reason
                </span>

                <textarea
                  rows={3}
                  maxLength={500}
                  value={form.reason}
                  disabled={submitting}
                  placeholder="Document the approved reason for this adjustment."
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        reason:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>
            </div>

            <div className="payroll-adjustment-form-actions">
              <button
                type="button"
                className="primary-button"
                disabled={
                  submitting ||
                  !selectedEmployeeId
                }
                onClick={() =>
                  void handleSubmit()
                }
              >
                {submitting
                  ? 'Saving...'
                  : editingAdjustmentId
                    ? 'Save Adjustment'
                    : 'Add Adjustment'}
              </button>
            </div>
          </div>
        )}

      {error && (
        <div
          className="form-feedback form-feedback-error payroll-adjustment-feedback"
          role="alert"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="form-feedback form-feedback-success payroll-adjustment-feedback"
          role="status"
        >
          {message}
        </div>
      )}
    </div>
  )
}
