import {
  useMemo,
  useState,
} from 'react'

import type {
  CompanyView,
} from '../api/companies'
import {
  changeEmployeeEmployment,
  correctEmploymentType,
  type EmployeeDirectoryView,
  type EmployeeType,
} from '../api/employees'

interface EmployeeEmploymentPanelProps {
  accessToken: string
  employee: EmployeeDirectoryView
  companies: CompanyView[]
  onCancel: () => void
  onChanged: (
    employee: EmployeeDirectoryView,
  ) => void
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

  return 'Unable to change employment assignment.'
}

export function EmployeeEmploymentPanel({
  accessToken,
  employee,
  companies,
  onCancel,
  onChanged,
}: EmployeeEmploymentPanelProps) {
  const currentEmployment =
    employee.currentEmployment

  const availableCompanies =
    useMemo(
      () =>
        companies.filter(
          (company) =>
            company.status === 'ACTIVE' ||
            company.id ===
              currentEmployment?.company.id,
        ),
      [
        companies,
        currentEmployment?.company.id,
      ],
    )

  const [
    companyId,
    setCompanyId,
  ] = useState(
    currentEmployment?.company.id ??
      '',
  )

  const [
    employeeType,
    setEmployeeType,
  ] = useState<EmployeeType | ''>(
    currentEmployment?.employeeType ?? '',
  )

  const [
    classificationEmployeeType,
    setClassificationEmployeeType,
  ] = useState<EmployeeType | ''>(
    currentEmployment?.employeeType ?? '',
  )

  const [
    classificationReason,
    setClassificationReason,
  ] = useState('')

  const [
    companyEmployeeNumber,
    setCompanyEmployeeNumber,
  ] = useState(
    currentEmployment
      ?.companyEmployeeNumber ??
      '',
  )

  const [
    effectiveDate,
    setEffectiveDate,
  ] = useState(getToday())

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  if (!currentEmployment) {
    return (
      <div className="employee-employment-panel">
        <div className="employee-form-header">
          <div>
            <p className="eyebrow">
              Employment Assignment
            </p>

            <h2>
              Change Employment
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

  async function handleClassificationSubmit() {
    setError(null)

    if (!classificationEmployeeType) {
      setError(
        'Employee Type is required.',
      )
      return
    }

    if (
      classificationEmployeeType ===
      currentEmployment.employeeType
    ) {
      setError(
        'Select a different Employee Type.',
      )
      return
    }

    const reason =
      classificationReason.trim()

    if (!reason) {
      setError(
        'Reason is required.',
      )
      return
    }

    try {
      setSaving(true)

      const updatedEmployee =
        await correctEmploymentType(
          accessToken,
          employee.id,
          {
            employeeType:
              classificationEmployeeType,
            reason,
          },
        )

      const correctedEmployeeType =
        updatedEmployee.currentEmployment
          ?.employeeType ?? ''

      setClassificationEmployeeType(
        correctedEmployeeType,
      )

      setEmployeeType(
        correctedEmployeeType,
      )

      setClassificationReason('')

      onChanged(
        updatedEmployee,
      )
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to correct Employee Type.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    setError(null)

    if (!companyId) {
      setError(
        'Company is required.',
      )
      return
    }

    if (!employeeType) {
      setError(
        'Employee Type is required.',
      )
      return
    }

    if (!effectiveDate) {
      setError(
        'Effective Date is required.',
      )
      return
    }

    try {
      setSaving(true)

      const updatedEmployee =
        await changeEmployeeEmployment(
          accessToken,
          employee.id,
          {
            companyId,
            employeeType,

            companyEmployeeNumber:
              companyEmployeeNumber.trim() ||
              null,

            effectiveDate,
          },
        )

      onChanged(
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
    <div className="employee-employment-panel">
      <div className="employee-form-header">
        <div>
          <p className="eyebrow">
            Employment Assignment
          </p>

          <h2>
            Change Employment
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
          Current Assignment
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
              Employee Type
            </span>

            <strong>
              {currentEmployment
                .employeeType ===
              'LACOM_INTERNAL'
                ? 'La Comfianza Internal'
                : currentEmployment
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
              {
                currentEmployment
                  .companyEmployeeNumber ||
                '—'
              }
            </strong>
          </div>

          <div>
            <span>
              Employment Start
            </span>

            <strong>
              {
                currentEmployment
                  .startDate
                  .slice(0, 10)
              }
            </strong>
          </div>

          <div>
            <span>
              Department / Position
            </span>

            <strong>
              {[
                currentEmployment
                  .department?.name,
                currentEmployment
                  .position?.name,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </strong>
          </div>
        </div>
      </div>

      <div className="employee-profile-section">
        <h3>
          {currentEmployment.employeeType
            ? 'Correct Employee Type'
            : 'Classify Existing Employment'}
        </h3>

        <div className="employee-employment-form-grid">
          <label>
            <span>
              Employee Type
            </span>

            <select
              value={classificationEmployeeType}
              required
              disabled={saving}
              onChange={(event) =>
                setClassificationEmployeeType(
                  event.target.value as
                    | EmployeeType
                    | '',
                )
              }
            >
              <option value="">
                Select Employee Type
              </option>

              <option value="LACOM_INTERNAL">
                La Comfianza Internal
              </option>

              <option value="CLIENT_EMPLOYEE">
                Client Employee
              </option>
            </select>
          </label>

          <label>
            <span>
              Reason
            </span>

            <input
              value={classificationReason}
              required
              disabled={saving}
              maxLength={500}
              placeholder="Required for audit history"
              onChange={(event) =>
                setClassificationReason(
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <div className="employee-employment-note">
          This updates the current employment
          classification only. It does not create
          a new employment assignment or change
          the original employment start date.
        </div>

        <div className="employee-form-actions">
          <button
            type="button"
            className="primary-button"
            disabled={saving}
            onClick={() =>
              void handleClassificationSubmit()
            }
          >
            {saving
              ? 'Saving...'
              : currentEmployment.employeeType
                ? 'Correct Employee Type'
                : 'Classify Employee'}
          </button>
        </div>
      </div>

      <div className="employee-profile-section">
        <h3>
          New Assignment
        </h3>

        <div className="employee-employment-form-grid">
          <label>
            <span>
              Company
            </span>

            <select
              value={companyId}
              disabled={saving}
              onChange={(event) =>
                setCompanyId(
                  event.target.value,
                )
              }
            >
              {availableCompanies.map(
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
              Employee Type
            </span>

            <select
              value={employeeType}
              required
              disabled={saving}
              onChange={(event) =>
                setEmployeeType(
                  event.target.value as
                    | EmployeeType
                    | '',
                )
              }
            >
              <option value="">
                Select Employee Type
              </option>

              <option value="LACOM_INTERNAL">
                La Comfianza Internal
              </option>

              <option value="CLIENT_EMPLOYEE">
                Client Employee
              </option>
            </select>
          </label>

          <label>
            <span>
              Company Employee Number
            </span>

            <input
              value={
                companyEmployeeNumber
              }
              disabled={saving}
              maxLength={100}
              placeholder="Optional"
              onChange={(event) =>
                setCompanyEmployeeNumber(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Effective Date
            </span>

            <input
              type="date"
              value={effectiveDate}
              disabled={saving}
              required
              onChange={(event) =>
                setEffectiveDate(
                  event.target.value,
                )
              }
            />

            <small>
              Must be after the current
              employment start date.
            </small>
          </label>
        </div>

        <div className="employee-employment-note">
          Changing company creates a new
          effective-dated employment
          assignment. It does not rewrite
          the previous assignment.
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
          disabled={saving}
          onClick={() =>
            void handleSubmit()
          }
        >
          {saving
            ? 'Saving...'
            : 'Change Employment'}
        </button>
      </div>
    </div>
  )
}
