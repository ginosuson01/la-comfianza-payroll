import {
  useEffect,
  useState,
} from 'react'
import type {
  FormEvent,
} from 'react'

import { ApiError } from '../api/client'
import {
  createCompanyCompensation,
  createCompanyCompensationVersion,
  getCompanyCompensation,
  listCompanyCompensationHistory,
  type CompanyCompensationView,
  type CompanyPayBasis,
} from '../api/companies'

interface CompanyCompensationPanelProps {
  accessToken: string
  companyId: string
}

interface CompanyCompensationFormState {
  payBasis: CompanyPayBasis
  rate: string
  effectiveFrom: string
}

const emptyCompensationForm:
  CompanyCompensationFormState = {
    payBasis: 'DAILY',
    rate: '',
    effectiveFrom: '',
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

  return 'Unable to process company standard compensation.'
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
      timeZone: 'UTC',
    },
  ).format(new Date(value))
}

function formatRate(
  compensation: CompanyCompensationView,
): string {
  const unit =
    compensation.payBasis === 'DAILY'
      ? 'day'
      : 'month'

  return `${formatMoney(compensation.rate)} / ${unit}`
}

export function CompanyCompensationPanel({
  accessToken,
  companyId,
}: CompanyCompensationPanelProps) {
  const [
    compensation,
    setCompensation,
  ] =
    useState<CompanyCompensationView | null>(
      null,
    )

  const [
    history,
    setHistory,
  ] =
    useState<CompanyCompensationView[]>([])

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    loadError,
    setLoadError,
  ] =
    useState<string | null>(null)

  const [
    configuring,
    setConfiguring,
  ] = useState(false)

  const [
    form,
    setForm,
  ] =
    useState<CompanyCompensationFormState>(
      emptyCompensationForm,
    )

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    formError,
    setFormError,
  ] =
    useState<string | null>(null)

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    setConfiguring(false)
    setForm(emptyCompensationForm)
    setFormError(null)
    setSuccessMessage(null)

    async function loadCompensation() {
      setLoading(true)
      setLoadError(null)

      try {
        const [
          currentResponse,
          historyResponse,
        ] = await Promise.all([
          getCompanyCompensation(
            accessToken,
            companyId,
          ),
          listCompanyCompensationHistory(
            accessToken,
            companyId,
          ),
        ])

        if (cancelled) {
          return
        }

        setCompensation(
          currentResponse,
        )

        setHistory(
          historyResponse,
        )
      } catch (
        loadFailure: unknown
      ) {
        if (cancelled) {
          return
        }

        setCompensation(null)
        setHistory([])

        setLoadError(
          getErrorMessage(
            loadFailure,
          ),
        )
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
    companyId,
  ])

  function updateFormField(
    field: keyof CompanyCompensationFormState,
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    )

    setFormError(null)
    setSuccessMessage(null)
  }

  function startConfiguration() {
    setForm(
      emptyCompensationForm,
    )

    setFormError(null)
    setSuccessMessage(null)
    setConfiguring(true)
  }

  function startChange() {
    if (!compensation) {
      return
    }

    setForm({
      payBasis:
        compensation.payBasis,

      rate:
        compensation.rate,

      effectiveFrom: '',
    })

    setFormError(null)
    setSuccessMessage(null)
    setConfiguring(true)
  }

  function cancelConfiguration() {
    if (saving) {
      return
    }

    setForm(
      emptyCompensationForm,
    )

    setFormError(null)
    setConfiguring(false)
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    const rate =
      Number(
        form.rate,
      )

    if (
      !Number.isFinite(rate) ||
      rate <= 0 ||
      rate > 99999999999999
    ) {
      setFormError(
        'Standard rate must be a positive number.',
      )

      return
    }

    if (
      !compensation &&
      !form.effectiveFrom
    ) {
      setFormError(
        'Effective From is required for the initial company standard compensation.',
      )

      return
    }

    setSaving(true)
    setFormError(null)
    setSuccessMessage(null)

    try {
      const savedCompensation =
        compensation
          ? await createCompanyCompensationVersion(
              accessToken,
              companyId,
              {
                payBasis:
                  form.payBasis,

                rate,
              },
            )
          : await createCompanyCompensation(
              accessToken,
              companyId,
              {
                payBasis:
                  form.payBasis,

                rate,

                effectiveFrom:
                  form.effectiveFrom,
              },
            )

      const createdVersion =
        compensation !== null

      const [
        currentResponse,
        historyResponse,
      ] = await Promise.all([
        getCompanyCompensation(
          accessToken,
          companyId,
        ),
        listCompanyCompensationHistory(
          accessToken,
          companyId,
        ),
      ])

      setCompensation(
        currentResponse,
      )

      setHistory(
        historyResponse,
      )

      setForm(
        emptyCompensationForm,
      )

      setConfiguring(false)

      setSuccessMessage(
        createdVersion
          ? `Company standard compensation change scheduled effective ${formatDate(
              savedCompensation.effectiveFrom,
            )}.`
          : 'Company standard compensation configured successfully.',
      )
    } catch (
      saveError: unknown
    ) {
      setFormError(
        getErrorMessage(
          saveError,
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="company-profile-section">
        <div className="company-profile-section-heading">
          <h3>
            Standard Compensation
          </h3>
        </div>

        <div className="empty-state">
          Loading company standard compensation...
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="company-profile-section">
        <div className="company-profile-section-heading">
          <h3>
            Standard Compensation
          </h3>
        </div>

        <div className="company-action-feedback company-action-feedback-error">
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="company-profile-section">
        <div className="company-profile-section-heading">
          <h3>
            Standard Compensation
          </h3>

          {!configuring && (
            <button
              type="button"
              className="secondary-button"
              onClick={
                compensation
                  ? startChange
                  : startConfiguration
              }
            >
              {compensation
                ? 'Change Standard Compensation'
                : 'Configure Standard Compensation'}
            </button>
          )}
        </div>

        {successMessage && (
          <div className="form-feedback">
            {successMessage}
          </div>
        )}

        {configuring ? (
          <form
            className="company-form"
            onSubmit={
              handleSubmit
            }
          >
            <div className="company-form-section">
              <h3>
                {compensation
                  ? 'Schedule Standard Compensation Change'
                  : 'Initial Standard Compensation'}
              </h3>

              <div className="company-form-grid">
                <label>
                  <span>
                    Pay Basis
                  </span>

                  <select
                    value={
                      form.payBasis
                    }
                    onChange={
                      (event) =>
                        updateFormField(
                          'payBasis',
                          event.target.value as CompanyPayBasis,
                        )
                    }
                    disabled={
                      saving
                    }
                    required
                  >
                    <option value="DAILY">
                      Daily
                    </option>

                    <option value="MONTHLY">
                      Monthly
                    </option>
                  </select>

                  <small>
                    Select whether the company standard rate is daily-paid or monthly-paid.
                  </small>
                </label>

                <label>
                  <span>
                    {compensation
                      ? 'New Standard Rate'
                      : 'Standard Rate'}
                  </span>

                  <input
                    type="number"
                    min="0.0001"
                    max="99999999999999"
                    step="0.0001"
                    value={
                      form.rate
                    }
                    onChange={
                      (event) =>
                        updateFormField(
                          'rate',
                          event.target.value,
                        )
                    }
                    disabled={
                      saving
                    }
                    required
                  />

                  <small>
                    Enter the company standard compensation rate.
                  </small>
                </label>

                {!compensation && (
                  <label>
                    <span>
                      Effective From
                    </span>

                    <input
                      type="date"
                      value={
                        form.effectiveFrom
                      }
                      onChange={
                        (event) =>
                          updateFormField(
                            'effectiveFrom',
                            event.target.value,
                          )
                      }
                      disabled={
                        saving
                      }
                      required
                    />

                    <small>
                      Required start date for the initial company standard compensation.
                    </small>
                  </label>
                )}
              </div>

              {compensation && (
                <p className="company-cutoff-help">
                  The effective date is automatically assigned by the backend to the next eligible payroll cutoff. It cannot be selected manually.
                </p>
              )}
            </div>

            {formError && (
              <div className="form-feedback form-feedback-error">
                {formError}
              </div>
            )}

            <div className="company-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={
                  cancelConfiguration
                }
                disabled={
                  saving
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  saving
                }
              >
                {saving
                  ? 'Saving...'
                  : compensation
                    ? 'Schedule Rate Change'
                    : 'Save Standard Compensation'}
              </button>
            </div>
          </form>
        ) : compensation ? (
          <div className="company-profile-grid">
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
                Standard Rate
              </span>

              <strong>
                {formatRate(
                  compensation,
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

            <div>
              <span>
                Effective To
              </span>

              <strong>
                {compensation.effectiveTo
                  ? formatDate(
                      compensation.effectiveTo,
                    )
                  : 'Open-ended'}
              </strong>
            </div>

            <div className="company-profile-wide">
              <span>
                Record ID
              </span>

              <strong>
                {compensation.id}
              </strong>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            No company standard compensation has
            been configured.
          </div>
        )}
      </div>

      <div className="company-profile-section">
        <div className="company-profile-section-heading">
          <h3>
            Compensation History
          </h3>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">
            No company compensation history exists.
          </div>
        ) : (
          <div className="company-profile-grid">
            {history.map(
              (record) => (
                <div
                  key={record.id}
                  className="company-profile-wide"
                >
                  <span>
                    Effective{' '}
                    {formatDate(
                      record.effectiveFrom,
                    )}
                  </span>

                  <strong>
                    {record.payBasis}
                    {' · '}
                    {formatRate(
                      record,
                    )}
                    {' · '}
                    {record.effectiveTo
                      ? `through ${formatDate(
                          record.effectiveTo,
                        )}`
                      : 'Open-ended'}
                  </strong>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </>
  )
}
