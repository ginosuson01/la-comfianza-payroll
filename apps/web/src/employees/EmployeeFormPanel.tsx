import {
  useEffect,
  useState,
} from 'react'
import type { FormEvent } from 'react'

import { ApiError } from '../api/client'
import type {
  CompanyView,
} from '../api/companies'
import {
  createEmployee,
  updateEmployee,
  type EmployeeDirectoryView,
  type EmployeeType,
} from '../api/employees'
import type {
  EmployeePayrollStatus,
} from '../api/types'

interface EmployeeFormPanelProps {
  accessToken: string
  employee: EmployeeDirectoryView | null
  companies: CompanyView[]
  mode: 'CREATE' | 'EDIT'
  onCancel: () => void
  onSaved: (
    employee: EmployeeDirectoryView,
  ) => void
}

interface EmployeeFormState {
  firstName: string
  middleName: string
  lastName: string
  suffix: string

  email: string
  mobile: string

  addressLine1: string
  addressLine2: string
  barangay: string
  city: string
  province: string
  postalCode: string
  country: string

  companyId: string
  employeeType: EmployeeType | ''
  companyEmployeeNumber: string
  employmentDate: string

  status: EmployeePayrollStatus
}

function todayValue(): string {
  const now = new Date()

  const year =
    now.getFullYear()

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(2, '0')

  const day =
    String(
      now.getDate(),
    ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function createEmptyForm(
  companies: CompanyView[],
): EmployeeFormState {
  const today =
    todayValue()

  return {
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',

    email: '',
    mobile: '',

    addressLine1: '',
    addressLine2: '',
    barangay: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Philippines',

    companyId:
      companies[0]?.id ?? '',
      employeeType: '',

    companyEmployeeNumber: '',
    employmentDate: today,

    status: 'ACTIVE',
  }
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

  return 'Unable to save employee.'
}

function nullableValue(
  value: string,
): string | null {
  const trimmed =
    value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

export function EmployeeFormPanel({
  accessToken,
  employee,
  companies,
  mode,
  onCancel,
  onSaved,
}: EmployeeFormPanelProps) {
  const [
    form,
    setForm,
  ] = useState<EmployeeFormState>(
    () =>
      createEmptyForm(
        companies,
      ),
  )

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  useEffect(() => {
    setError(null)

    if (
      mode === 'EDIT' &&
      employee
    ) {
      setForm({
        firstName:
          employee.firstName,

        middleName:
          employee.middleName ?? '',

        lastName:
          employee.lastName,

        suffix:
          employee.suffix ?? '',

        email:
          employee.email ?? '',

        mobile:
          employee.mobile ?? '',

        addressLine1:
          employee.addressLine1 ?? '',

        addressLine2:
          employee.addressLine2 ?? '',

        barangay:
          employee.barangay ?? '',

        city:
          employee.city ?? '',

        province:
          employee.province ?? '',

        postalCode:
          employee.postalCode ?? '',

        country:
          employee.country,

        companyId:
          employee.currentEmployment
            ?.company.id ?? '',
        employeeType:
          employee.currentEmployment
            ?.employeeType ?? '',

        companyEmployeeNumber:
          employee.currentEmployment
            ?.companyEmployeeNumber ?? '',

        employmentDate:
          employee.currentEmployment
            ?.startDate.slice(
              0,
              10,
            ) ?? '',

        status:
          employee.currentStatus,
      })

      return
    }

    setForm(
      createEmptyForm(
        companies,
      ),
    )
  }, [
    companies,
    employee,
    mode,
  ])

  function updateField(
    field: keyof EmployeeFormState,
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    )
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      saving ||
      !form.firstName.trim() ||
      !form.lastName.trim()
    ) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      let savedEmployee:
        EmployeeDirectoryView

      if (mode === 'CREATE') {
        if (!form.companyId) {
          setError(
            'Company is required.',
          )
          return
        }

        if (!form.employeeType) {
          setError(
            'Employee Type is required.',
          )
          return
        }

        if (!form.employmentDate) {
          setError(
            'Employment date is required.',
          )
          return
        }

        savedEmployee =
          await createEmployee(
            accessToken,
            {
              firstName:
                form.firstName.trim(),

              middleName:
                form.middleName.trim() ||
                undefined,

              lastName:
                form.lastName.trim(),

              suffix:
                form.suffix.trim() ||
                undefined,

              email:
                form.email.trim() ||
                undefined,

              mobile:
                form.mobile.trim() ||
                undefined,

              addressLine1:
                form.addressLine1.trim() ||
                undefined,

              addressLine2:
                form.addressLine2.trim() ||
                undefined,

              barangay:
                form.barangay.trim() ||
                undefined,

              city:
                form.city.trim() ||
                undefined,

              province:
                form.province.trim() ||
                undefined,

              postalCode:
                form.postalCode.trim() ||
                undefined,

              country:
                form.country.trim() ||
                undefined,

              companyId:
                form.companyId,
              employeeType:
                form.employeeType,

              companyEmployeeNumber:
                form.companyEmployeeNumber
                  .trim() ||
                undefined,

              employmentDate:
                form.employmentDate,

              status:
                form.status,
            },
          )
      } else {
        if (!employee) {
          setError(
            'Select an employee before editing.',
          )
          return
        }

        savedEmployee =
          await updateEmployee(
            accessToken,
            employee.id,
            {
              firstName:
                form.firstName.trim(),

              middleName:
                nullableValue(
                  form.middleName,
                ),

              lastName:
                form.lastName.trim(),

              suffix:
                nullableValue(
                  form.suffix,
                ),

              email:
                nullableValue(
                  form.email,
                ),

              mobile:
                nullableValue(
                  form.mobile,
                ),

              addressLine1:
                nullableValue(
                  form.addressLine1,
                ),

              addressLine2:
                nullableValue(
                  form.addressLine2,
                ),

              barangay:
                nullableValue(
                  form.barangay,
                ),

              city:
                nullableValue(
                  form.city,
                ),

              province:
                nullableValue(
                  form.province,
                ),

              postalCode:
                nullableValue(
                  form.postalCode,
                ),

              country:
                form.country.trim(),
            },
          )
      }

      onSaved(
        savedEmployee,
      )
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

  const createMode =
    mode === 'CREATE'

  return (
    <form
      className="employee-form"
      onSubmit={
        handleSubmit
      }
    >
      <div className="employee-form-header">
        <div>
          <p className="eyebrow">
            {createMode
              ? 'New Employee'
              : 'Edit Employee'}
          </p>

          <h2>
            {createMode
              ? 'Create Employee'
              : employee?.fullName ??
                'Edit Employee'}
          </h2>
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

      {error && (
        <div
          className="form-feedback form-feedback-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="employee-form-section">
        <h3>
          Employee Information
        </h3>

        <div className="employee-form-grid">
          <label>
            <span>
              System Employee Number
            </span>

            {createMode ? (
              <>
                <div className="employee-generated-number">
                  Automatically generated
                </div>

                <small>
                  A permanent system employee number
                  will be assigned after creation.
                </small>
              </>
            ) : (
              <>
                <input
                  value={
                    employee?.employeeNumber ??
                    ''
                  }
                  disabled
                  readOnly
                />

                <small>
                  System employee number is permanent
                  and cannot be changed.
                </small>
              </>
            )}
          </label>

          <label>
            <span>
              First Name
            </span>

            <input
              value={
                form.firstName
              }
              required
              disabled={saving}
              maxLength={100}
              onChange={(
                event,
              ) =>
                updateField(
                  'firstName',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Middle Name
            </span>

            <input
              value={
                form.middleName
              }
              disabled={saving}
              maxLength={100}
              onChange={(
                event,
              ) =>
                updateField(
                  'middleName',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Last Name
            </span>

            <input
              value={
                form.lastName
              }
              required
              disabled={saving}
              maxLength={100}
              onChange={(
                event,
              ) =>
                updateField(
                  'lastName',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Suffix
            </span>

            <input
              value={form.suffix}
              disabled={saving}
              maxLength={30}
              onChange={(
                event,
              ) =>
                updateField(
                  'suffix',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Email
            </span>

            <input
              type="email"
              value={form.email}
              disabled={saving}
              maxLength={254}
              onChange={(
                event,
              ) =>
                updateField(
                  'email',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Mobile
            </span>

            <input
              value={form.mobile}
              disabled={saving}
              maxLength={30}
              onChange={(
                event,
              ) =>
                updateField(
                  'mobile',
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </div>

      <div className="employee-form-section">
        <h3>
          Address
        </h3>

        <div className="employee-form-grid">
          <label>
            <span>
              Address Line 1
            </span>

            <input
              value={
                form.addressLine1
              }
              disabled={saving}
              maxLength={200}
              onChange={(
                event,
              ) =>
                updateField(
                  'addressLine1',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Address Line 2
            </span>

            <input
              value={
                form.addressLine2
              }
              disabled={saving}
              maxLength={200}
              onChange={(
                event,
              ) =>
                updateField(
                  'addressLine2',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Barangay
            </span>

            <input
              value={
                form.barangay
              }
              disabled={saving}
              maxLength={100}
              onChange={(
                event,
              ) =>
                updateField(
                  'barangay',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              City
            </span>

            <input
              value={form.city}
              disabled={saving}
              maxLength={100}
              onChange={(
                event,
              ) =>
                updateField(
                  'city',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Province
            </span>

            <input
              value={
                form.province
              }
              disabled={saving}
              maxLength={100}
              onChange={(
                event,
              ) =>
                updateField(
                  'province',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Postal Code
            </span>

            <input
              value={
                form.postalCode
              }
              disabled={saving}
              maxLength={20}
              onChange={(
                event,
              ) =>
                updateField(
                  'postalCode',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Country
            </span>

            <input
              value={
                form.country
              }
              required
              disabled={saving}
              maxLength={100}
              onChange={(
                event,
              ) =>
                updateField(
                  'country',
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </div>

      {createMode && (
        <div className="employee-form-section">
          <h3>
            Initial Employment
          </h3>

          <div className="employee-form-grid">
            <label>
              <span>
                Company
              </span>

              <select
                value={
                  form.companyId
                }
                required
                disabled={saving}
                onChange={(
                  event,
                ) =>
                  updateField(
                    'companyId',
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select Company
                </option>

                {companies.map(
                  (company) => (
                    <option
                      key={
                        company.id
                      }
                      value={
                        company.id
                      }
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
                value={
                  form.employeeType
                }
                required
                disabled={saving}
                onChange={(
                  event,
                ) =>
                  updateField(
                    'employeeType',
                    event.target.value,
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
                  form.companyEmployeeNumber
                }
                disabled={saving}
                maxLength={100}
                onChange={(
                  event,
                ) =>
                  updateField(
                    'companyEmployeeNumber',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Employment Date
              </span>

              <input
                type="date"
                value={
                  form.employmentDate
                }
                required
                disabled={saving}
                onChange={(
                  event,
                ) =>
                  updateField(
                    'employmentDate',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Initial Payroll Status
              </span>

              <select
                value={
                  form.status
                }
                disabled={saving}
                onChange={(
                  event,
                ) =>
                  updateField(
                    'status',
                    event.target
                      .value,
                  )
                }
              >
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

          </div>
        </div>
      )}

      {!createMode && (
        <div className="employee-form-section employee-form-info">
          Employment assignment and payroll status are managed separately
          so their effective-dated history is preserved.
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
          type="submit"
          className="primary-button"
          disabled={saving}
        >
          {saving
            ? 'Saving...'
            : createMode
              ? 'Create Employee'
              : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
