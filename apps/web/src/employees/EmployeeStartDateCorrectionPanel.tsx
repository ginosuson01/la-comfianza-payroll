import {
  useMemo,
  useState,
} from 'react'

import {
  correctEmploymentStartDate,
  type EmployeeDirectoryView,
} from '../api/employees'

interface EmployeeStartDateCorrectionPanelProps {
  accessToken: string
  employee: EmployeeDirectoryView

  onCancel: () => void

  onCorrected: (
    employee: EmployeeDirectoryView,
  ) => void
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to correct employment start date.'
}

export function EmployeeStartDateCorrectionPanel({
  accessToken,
  employee,
  onCancel,
  onCorrected,
}: EmployeeStartDateCorrectionPanelProps) {
  const currentEmployment =
    employee.currentEmployment

  const currentStartDate =
    useMemo(
      () =>
        currentEmployment
          ?.startDate
          .slice(0, 10) ?? '',
      [currentEmployment],
    )

  const [
    correctedStartDate,
    setCorrectedStartDate,
  ] = useState(currentStartDate)

  const [
    reason,
    setReason,
  ] = useState('')

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  if (!currentEmployment) {
    return (
      <div className="employee-start-date-panel">
        <div className="employee-form-header">
          <div>
            <p className="eyebrow">
              Employment Correction
            </p>

            <h2>
              Correct Employment Start Date
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
          Current employment assignment
          is not available.
        </div>
      </div>
    )
  }

  const hasDateChanged =
    correctedStartDate.length > 0 &&
    correctedStartDate !==
      currentStartDate

  const hasReason =
    reason.trim().length > 0

  async function handleSubmit() {
    setError(null)

    if (!hasDateChanged) {
      setError(
        'Corrected Employment Start Date must be different from the current date.',
      )

      return
    }

    if (!hasReason) {
      setError(
        'Correction Reason is required.',
      )

      return
    }

    try {
      setSaving(true)

      const updatedEmployee =
        await correctEmploymentStartDate(
          accessToken,
          employee.id,
          {
            correctedStartDate,
            reason: reason.trim(),
          },
        )

      onCorrected(
        updatedEmployee,
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
    <div className="employee-start-date-panel">
      <div className="employee-form-header">
        <div>
          <p className="eyebrow">
            Employment Correction
          </p>

          <h2>
            Correct Employment Start Date
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
        <h3>
          Current Employment
        </h3>

        <div className="employee-profile-grid">
          <div>
            <span>
              Company
            </span>

            <strong>
              {
                currentEmployment
                  .company.name
              }
            </strong>
          </div>

          <div>
            <span>
              Current Start Date
            </span>

            <strong>
              {currentStartDate}
            </strong>
          </div>
        </div>
      </div>

      <div className="employee-profile-section">
        <h3>
          Correction
        </h3>

        <div className="employee-start-date-form-grid">
          <label>
            <span>
              Corrected Employment Start Date
            </span>

            <input
              type="date"
              value={correctedStartDate}
              disabled={saving}
              required
              onChange={(event) =>
                setCorrectedStartDate(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="employee-start-date-reason">
            <span>
              Correction Reason
            </span>

            <textarea
              rows={4}
              value={reason}
              disabled={saving}
              required
              maxLength={500}
              placeholder="Explain why the employment start date must be corrected."
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

        <div className="employee-employment-note">
          This action corrects the current
          employment record. It does not
          create a new employment assignment.
          The correction is audited and may
          be blocked when historical DTR,
          payroll, or effective-dated payroll
          data would be affected.
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
            !hasDateChanged ||
            !hasReason
          }
          onClick={() =>
            void handleSubmit()
          }
        >
          {saving
            ? 'Correcting...'
            : 'Apply Correction'}
        </button>
      </div>
    </div>
  )
}
