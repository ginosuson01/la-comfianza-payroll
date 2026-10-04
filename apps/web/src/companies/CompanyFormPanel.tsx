import {
  useEffect,
  useState,
} from 'react'
import type { FormEvent } from 'react'

import { ApiError } from '../api/client'
import {
  createCompany,
  updateCompany,
  type CompanyView,
} from '../api/companies'

interface CompanyFormPanelProps {
  accessToken: string
  company: CompanyView | null
  mode: 'CREATE' | 'EDIT'
  onCancel: () => void
  onSaved: (company: CompanyView) => void
}

interface CompanyFormState {
  code: string
  name: string
  addressLine1: string
  addressLine2: string
  barangay: string
  city: string
  province: string
  postalCode: string
  country: string
  contactName: string
  contactEmail: string
  contactPhone: string
}

const emptyForm: CompanyFormState = {
  code: '',
  name: '',
  addressLine1: '',
  addressLine2: '',
  barangay: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Philippines',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
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

  return 'Unable to save company.'
}

function nullableValue(
  value: string,
): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

export function CompanyFormPanel({
  accessToken,
  company,
  mode,
  onCancel,
  onSaved,
}: CompanyFormPanelProps) {
  const [
    form,
    setForm,
  ] = useState<CompanyFormState>(
    emptyForm,
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
      company
    ) {
      setForm({
        code: company.code,
        name: company.name,
        addressLine1:
          company.addressLine1 ?? '',
        addressLine2:
          company.addressLine2 ?? '',
        barangay:
          company.barangay ?? '',
        city:
          company.city ?? '',
        province:
          company.province ?? '',
        postalCode:
          company.postalCode ?? '',
        country:
          company.country,
        contactName:
          company.contactName ?? '',
        contactEmail:
          company.contactEmail ?? '',
        contactPhone:
          company.contactPhone ?? '',
      })

      return
    }

    setForm(emptyForm)
  }, [
    company,
    mode,
  ])

  function updateField(
    field: keyof CompanyFormState,
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
      !form.name.trim()
    ) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      let savedCompany:
        CompanyView

      if (mode === 'CREATE') {
        if (!form.code.trim()) {
          setError(
            'Company code is required.',
          )
          return
        }

        savedCompany =
          await createCompany(
            accessToken,
            {
              code:
                form.code
                  .trim()
                  .toUpperCase(),

              name:
                form.name.trim(),

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

              contactName:
                form.contactName.trim() ||
                undefined,

              contactEmail:
                form.contactEmail.trim() ||
                undefined,

              contactPhone:
                form.contactPhone.trim() ||
                undefined,
            },
          )
      } else {
        if (!company) {
          setError(
            'Select a company before editing.',
          )
          return
        }

        savedCompany =
          await updateCompany(
            accessToken,
            company.id,
            {
              name:
                form.name.trim(),

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

              contactName:
                nullableValue(
                  form.contactName,
                ),

              contactEmail:
                nullableValue(
                  form.contactEmail,
                ),

              contactPhone:
                nullableValue(
                  form.contactPhone,
                ),
            },
          )
      }

      onSaved(savedCompany)
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
    <form
      className="company-form"
      onSubmit={
        handleSubmit
      }
    >
      <div className="company-form-header">
        <div>
          <p className="eyebrow">
            {mode === 'CREATE'
              ? 'New Company'
              : 'Edit Company'}
          </p>

          <h2>
            {mode === 'CREATE'
              ? 'Create Company'
              : company?.name ??
                'Edit Company'}
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

      <div className="company-form-section">
        <h3>
          Company Information
        </h3>

        <div className="company-form-grid">
          <label>
            <span>
              Company Code
            </span>

            <input
              value={form.code}
              disabled={
                mode === 'EDIT' ||
                saving
              }
              required={
                mode === 'CREATE'
              }
              maxLength={30}
              placeholder="Example: YAKINIKU-QC"
              onChange={(event) =>
                updateField(
                  'code',
                  event.target.value
                    .toUpperCase(),
                )
              }
            />

            {mode === 'EDIT' && (
              <small>
                Company code is stable
                and cannot be changed.
              </small>
            )}
          </label>

          <label>
            <span>
              Company / Branch Name
            </span>

            <input
              value={form.name}
              disabled={saving}
              required
              maxLength={150}
              onChange={(event) =>
                updateField(
                  'name',
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </div>

      <div className="company-form-section">
        <h3>
          Address
        </h3>

        <div className="company-form-grid">
          <label>
            <span>
              Address Line 1
            </span>

            <input
              value={
                form.addressLine1
              }
              disabled={saving}
              maxLength={250}
              onChange={(event) =>
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
              maxLength={250}
              onChange={(event) =>
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
              value={form.barangay}
              disabled={saving}
              maxLength={100}
              onChange={(event) =>
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
              onChange={(event) =>
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
              onChange={(event) =>
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
              onChange={(event) =>
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
              value={form.country}
              disabled={saving}
              required
              maxLength={100}
              onChange={(event) =>
                updateField(
                  'country',
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </div>

      <div className="company-form-section">
        <h3>
          Contact Information
        </h3>

        <div className="company-form-grid">
          <label>
            <span>
              Contact Name
            </span>

            <input
              value={
                form.contactName
              }
              disabled={saving}
              maxLength={150}
              onChange={(event) =>
                updateField(
                  'contactName',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Contact Email
            </span>

            <input
              type="email"
              value={
                form.contactEmail
              }
              disabled={saving}
              maxLength={254}
              onChange={(event) =>
                updateField(
                  'contactEmail',
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Contact Phone
            </span>

            <input
              value={
                form.contactPhone
              }
              disabled={saving}
              maxLength={30}
              onChange={(event) =>
                updateField(
                  'contactPhone',
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </div>

      <div className="company-form-actions">
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
            : mode === 'CREATE'
              ? 'Create Company'
              : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
