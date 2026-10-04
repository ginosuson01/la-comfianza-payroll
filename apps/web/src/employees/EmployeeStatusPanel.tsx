import {
  useMemo,
  useState,
} from 'react'

import {
  changeEmployeeStatus,
  type EmployeeDirectoryView,
} from '../api/employees'
import type {
  EmployeePayrollStatus,
} from '../api/types'

interface EmployeeStatusPanelProps {
  accessToken: string
  employee: EmployeeDirectoryView
  onCancel: () => void
  onChanged: (
    status: EmployeePayrollStatus,
  ) => void
}

const statuses: EmployeePayrollStatus[] = [
  'ACTIVE',
  'ACTIVE_HOLD',
  'RESIGNED',
]

function formatStatus(
  status: EmployeePayrollStatus,
): string {
  switch (status) {
    case 'ACTIVE':
      return 'Active'

    case 'ACTIVE_HOLD':
      return 'Active Hold'

    case 'RESIGNED':
      return 'Resigned'
  }
}

function getToday(): string {
  return new Date()
    .toISOString()
    .slice(0, 10)
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to change employee status.'
}

export function EmployeeStatusPanel({
  accessToken,
  employee,
  onCancel,
  onChanged,
}: EmployeeStatusPanelProps) {
  const availableStatuses =
    useMemo(
      () =>
        statuses.filter(
          (status) =>
            status !==
            employee.currentStatus,
        ),
      [employee.currentStatus],
    )

  const [newStatus, setNewStatus] =
    useState<EmployeePayrollStatus>(
      availableStatuses[0] ??
        employee.currentStatus,
    )

  const [
    effectiveDate,
    setEffectiveDate,
  ] = useState(getToday())

  const [reason, setReason] =
    useState('')

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  async function handleSubmit() {
    setError(null)

    if (
      newStatus ===
      employee.currentStatus
    ) {
      setError(
        'Select a different payroll status.',
      )
      return
    }

    if (!effectiveDate) {
      setError(
        'Effective Date is required.',
      )
      return
    }

    if (reason.length > 500) {
      setError(
        'Reason must not exceed 500 characters.',
      )
      return
    }

    try {
      setSaving(true)

      const result =
        await changeEmployeeStatus(
          accessToken,
          employee.id,
          {
            status: newStatus,
            effectiveDate,
            reason:
              reason.trim() || null,
          },
        )

      onChanged(
        result.currentStatus,
      )
    } catch (caughtError: unknown) {
      setError(
        getErrorMessage(
          caughtError,
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-status-panel">
      <div className="employee-form-header">
        <div>
          <p className="eyebrow">
            Employee Status
          </p>

          <h2>
            Change Payroll Status
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

      <div className="employee-profile-section">
        <div className="employee-status-current">
          <span>
            Current Status
          </span>

          <strong>
            {formatStatus(
              employee.currentStatus,
            )}
          </strong>
        </div>
      </div>

      <div className="employee-profile-section">
        <div className="employee-status-form-grid">
          <label>
            <span>
              New Status
            </span>

            <select
              value={newStatus}
              disabled={saving}
              onChange={(event) =>
                setNewStatus(
                  event.target
                    .value as
                    EmployeePayrollStatus,
                )
              }
            >
              {availableStatuses.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {formatStatus(
                      status,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>
              Effective Date
            </span>

            <input
              type="date"
              value={effectiveDate}
              required
              disabled={saving}
              onChange={(event) =>
                setEffectiveDate(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="employee-status-reason">
            <span>
              Reason
            </span>

            <textarea
              rows={4}
              maxLength={500}
              value={reason}
              disabled={saving}
              placeholder="Optional reason for this status change"
              onChange={(event) =>
                setReason(
                  event.target.value,
                )
              }
            />

            <small>
              {reason.length}/500
            </small>
          </label>
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
            newStatus ===
              employee.currentStatus
          }
          onClick={() =>
            void handleSubmit()
          }
        >
          {saving
            ? 'Changing...'
            : 'Change Status'}
        </button>
      </div>
    </div>
  )
}
