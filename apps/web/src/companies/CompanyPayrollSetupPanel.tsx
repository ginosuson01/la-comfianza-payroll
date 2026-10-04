import {
  useEffect,
  useState,
} from 'react'
import type {
  FormEvent,
} from 'react'

import { ApiError } from '../api/client'
import {
  createCompanyPayrollSetup,
  createCompanyPayrollSetupVersion,
  getCompanyPayrollSetup,
  listCompanyCutoffTemplates,
  type CompanyCutoffTemplateView,
  type CompanyMinimumWageConfig,
  type CompanyPayrollSetupView,
} from '../api/companies'

import { CompanyCutoffTemplateSection } from './CompanyCutoffTemplateSection'

interface CompanyPayrollSetupPanelProps {
  accessToken: string
  companyId: string
}

interface PayrollSetupFormState {
  standardWorkMinutesPerDay: string
  philHealthDailyWorkerScheduleDaysPerWeek: string

  minimumWageRegionCode: string
  minimumWageOrderCode: string
  minimumWageAreaClassification: string
  minimumWageSector: string
  minimumWageDailyRate: string
  minimumWageRateEffectiveFrom: string

  effectiveFrom: string
  effectiveTo: string
}

const emptyPayrollSetupForm: PayrollSetupFormState = {
  standardWorkMinutesPerDay: '',
  philHealthDailyWorkerScheduleDaysPerWeek: '',

  minimumWageRegionCode: '',
  minimumWageOrderCode: '',
  minimumWageAreaClassification: '',
  minimumWageSector: '',
  minimumWageDailyRate: '',
  minimumWageRateEffectiveFrom: '',

  effectiveFrom: '',
  effectiveTo: '',
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

  return 'Unable to process payroll setup.'
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'Not limited'
  }

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

function getStandardWorkMinutes(
  setup: CompanyPayrollSetupView,
): number | null {
  const value =
    setup.activeVersion?.config
      .attendance
      ?.standardWorkMinutesPerDay

  return typeof value === 'number'
    ? value
    : null
}

function getPhilHealthScheduleDays(
  setup: CompanyPayrollSetupView,
): number | null {
  const value =
    setup.activeVersion?.config
      .statutory
      ?.philHealth
      ?.dailyWorkerScheduleDaysPerWeek

  return value === 5 ||
    value === 6
    ? value
    : null
}

function getMinimumWageConfig(
  setup: CompanyPayrollSetupView,
): CompanyMinimumWageConfig | null {
  return (
    setup.activeVersion?.config
      .statutory
      ?.minimumWage ??
    null
  )
}

export function CompanyPayrollSetupPanel({
  accessToken,
  companyId,
}: CompanyPayrollSetupPanelProps) {
  const [
    payrollSetup,
    setPayrollSetup,
  ] =
    useState<CompanyPayrollSetupView | null>(
      null,
    )

  const [
    cutoffTemplates,
    setCutoffTemplates,
  ] =
    useState<CompanyCutoffTemplateView[]>([])

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
    useState<PayrollSetupFormState>(
      emptyPayrollSetupForm,
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
    setForm(emptyPayrollSetupForm)
    setFormError(null)
    setSuccessMessage(null)

    async function loadPayrollSetup() {
      setLoading(true)
      setLoadError(null)

      try {
        const [
          setupResponse,
          cutoffTemplateResponse,
        ] = await Promise.all([
          getCompanyPayrollSetup(
            accessToken,
            companyId,
          ),

          listCompanyCutoffTemplates(
            accessToken,
            companyId,
          ),
        ])

        if (cancelled) {
          return
        }

        setPayrollSetup(
          setupResponse,
        )

        setCutoffTemplates(
          cutoffTemplateResponse,
        )
      } catch (
        loadFailure: unknown
      ) {
        if (cancelled) {
          return
        }

        setPayrollSetup(null)
        setCutoffTemplates([])

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

    void loadPayrollSetup()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    companyId,
  ])

  function updateFormField(
    field: keyof PayrollSetupFormState,
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
    setForm(emptyPayrollSetupForm)
    setFormError(null)
    setSuccessMessage(null)
    setConfiguring(true)
  }

  function startEditing() {
    if (!payrollSetup) {
      return
    }

    const standardWorkMinutes =
      getStandardWorkMinutes(
        payrollSetup,
      )

    const philHealthScheduleDays =
      getPhilHealthScheduleDays(
        payrollSetup,
      )

    const minimumWage =
      getMinimumWageConfig(
        payrollSetup,
      )

    setForm({
      standardWorkMinutesPerDay:
        standardWorkMinutes === null
          ? ''
          : String(
              standardWorkMinutes,
            ),

      philHealthDailyWorkerScheduleDaysPerWeek:
        philHealthScheduleDays === null
          ? ''
          : String(
              philHealthScheduleDays,
            ),

      minimumWageRegionCode:
        minimumWage?.regionCode ?? '',

      minimumWageOrderCode:
        minimumWage?.wageOrderCode ?? '',

      minimumWageAreaClassification:
        minimumWage?.areaClassification ?? '',

      minimumWageSector:
        minimumWage?.sector ?? '',

      minimumWageDailyRate:
        minimumWage?.dailyRate ?? '',

      minimumWageRateEffectiveFrom:
        minimumWage?.rateEffectiveFrom ?? '',

      effectiveFrom: '',
      effectiveTo: '',
    })

    setFormError(null)
    setSuccessMessage(null)
    setConfiguring(true)
  }

  function cancelConfiguration() {
    if (saving) {
      return
    }

    setForm(emptyPayrollSetupForm)
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

    const standardWorkMinutes =
      Number(
        form.standardWorkMinutesPerDay,
      )

    if (
      !Number.isInteger(
        standardWorkMinutes,
      ) ||
      standardWorkMinutes < 1 ||
      standardWorkMinutes > 1440
    ) {
      setFormError(
        'Standard work minutes per day must be a whole number from 1 to 1440.',
      )

      return
    }

    const philHealthScheduleDays =
      Number(
        form
          .philHealthDailyWorkerScheduleDaysPerWeek,
      )

    if (
      philHealthScheduleDays !== 5 &&
      philHealthScheduleDays !== 6
    ) {
      setFormError(
        'PhilHealth daily-worker schedule must be either 5 or 6 days per week.',
      )

      return
    }

    const minimumWageRegionCode =
      form.minimumWageRegionCode.trim()

    const minimumWageOrderCode =
      form.minimumWageOrderCode.trim()

    const minimumWageAreaClassification =
      form.minimumWageAreaClassification.trim()

    const minimumWageSector =
      form.minimumWageSector.trim()

    const minimumWageDailyRate =
      form.minimumWageDailyRate.trim()

    const minimumWageRateEffectiveFrom =
      form.minimumWageRateEffectiveFrom.trim()

    const hasMinimumWageDailyRate =
      minimumWageDailyRate.length > 0

    const hasMinimumWageEffectiveDate =
      minimumWageRateEffectiveFrom.length > 0

    const hasMinimumWageCore =
      hasMinimumWageDailyRate &&
      hasMinimumWageEffectiveDate

    const hasAnyMinimumWageReference = [
      minimumWageRegionCode,
      minimumWageOrderCode,
      minimumWageAreaClassification,
      minimumWageSector,
    ].some(
      (value) =>
        value.length > 0,
    )

    if (
      hasMinimumWageDailyRate !==
      hasMinimumWageEffectiveDate
    ) {
      setFormError(
        'Minimum-wage configuration requires both daily minimum wage and legal effective date.',
      )

      return
    }

    if (
      hasAnyMinimumWageReference &&
      !hasMinimumWageCore
    ) {
      setFormError(
        'Daily minimum wage and legal effective date are required when optional minimum-wage reference information is supplied.',
      )

      return
    }

    if (
      hasMinimumWageCore &&
      (
        !/^\d+(?:\.\d{1,2})?$/.test(
          minimumWageDailyRate,
        ) ||
        Number(
          minimumWageDailyRate,
        ) <= 0
      )
    ) {
      setFormError(
        'Minimum-wage daily rate must be a positive amount with at most 2 decimal places.',
      )

      return
    }

    const minimumWageInput =
      hasMinimumWageCore
        ? {
            ...(minimumWageRegionCode
              ? {
                  minimumWageRegionCode,
                }
              : {}),

            ...(minimumWageOrderCode
              ? {
                  minimumWageOrderCode,
                }
              : {}),

            ...(minimumWageAreaClassification
              ? {
                  minimumWageAreaClassification,
                }
              : {}),

            ...(minimumWageSector
              ? {
                  minimumWageSector,
                }
              : {}),

            minimumWageDailyRate,

            minimumWageRateEffectiveFrom,
          }
        : {}

    if (
      payrollSetup &&
      !form.effectiveFrom
    ) {
      setFormError(
        'Effective From is required when creating a new payroll setup version.',
      )

      return
    }

    if (
      form.effectiveFrom &&
      form.effectiveTo &&
      form.effectiveTo <
        form.effectiveFrom
    ) {
      setFormError(
        'Effective To cannot be earlier than Effective From.',
      )

      return
    }

    setSaving(true)
    setFormError(null)
    setSuccessMessage(null)

    try {
      const savedSetup =
        payrollSetup
          ? await createCompanyPayrollSetupVersion(
              accessToken,
              companyId,
              {
                standardWorkMinutesPerDay:
                  standardWorkMinutes,

                philHealthDailyWorkerScheduleDaysPerWeek:
                  philHealthScheduleDays,

                ...minimumWageInput,

                effectiveFrom:
                  form.effectiveFrom,

                effectiveTo:
                  form.effectiveTo ||
                  undefined,
              },
            )
          : await createCompanyPayrollSetup(
              accessToken,
              companyId,
              {
                standardWorkMinutesPerDay:
                  standardWorkMinutes,

                philHealthDailyWorkerScheduleDaysPerWeek:
                  philHealthScheduleDays,

                ...minimumWageInput,

                effectiveFrom:
                  form.effectiveFrom ||
                  undefined,

                effectiveTo:
                  form.effectiveTo ||
                  undefined,
              },
            )

      const createdVersion =
        payrollSetup !== null

      setPayrollSetup(
        savedSetup,
      )

      setForm(
        emptyPayrollSetupForm,
      )

      setConfiguring(false)

      setSuccessMessage(
        createdVersion
          ? `Payroll setup version ${savedSetup.activeVersion?.version ?? ''} created successfully.`
          : 'Payroll setup created successfully.',
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
            Payroll Setup
          </h3>
        </div>

        <div className="empty-state">
          Loading payroll setup...
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="company-profile-section">
        <div className="company-profile-section-heading">
          <h3>
            Payroll Setup
          </h3>
        </div>

        <div className="empty-state">
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
            Payroll Setup
          </h3>

          {!configuring && (
            <button
              type="button"
              className="secondary-button"
              onClick={
                payrollSetup
                  ? startEditing
                  : startConfiguration
              }
            >
              {payrollSetup
                ? 'Edit Payroll Setup'
                : 'Configure Payroll Setup'}
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
                {payrollSetup
                  ? 'Create New Payroll Setup Version'
                  : 'Initial Payroll Setup'}
              </h3>

              <div className="company-form-grid">
                <label>
                  <span>
                    Standard Work Minutes Per Day
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="1440"
                    step="1"
                    value={
                      form.standardWorkMinutesPerDay
                    }
                    onChange={
                      (event) =>
                        updateFormField(
                          'standardWorkMinutesPerDay',
                          event.target.value,
                        )
                    }
                    disabled={
                      saving
                    }
                    required
                  />

                  <small>
                    Enter the company&apos;s configured standard workday in minutes.
                  </small>
                </label>

                <label>
                  <span>
                    PhilHealth Daily-Worker Schedule
                  </span>

                  <select
                    value={
                      form
                        .philHealthDailyWorkerScheduleDaysPerWeek
                    }
                    onChange={
                      (event) =>
                        updateFormField(
                          'philHealthDailyWorkerScheduleDaysPerWeek',
                          event.target.value,
                        )
                    }
                    disabled={
                      saving
                    }
                    required
                  >
                    <option value="">
                      Select schedule
                    </option>

                    <option value="5">
                      5 days per week
                    </option>

                    <option value="6">
                      6 days per week
                    </option>
                  </select>

                  <small>
                    Used to determine the PhilHealth equivalent monthly rate for daily-paid employees.
                  </small>
                </label>

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
                    required={
                      payrollSetup !== null
                    }
                  />

                  <small>
                    {payrollSetup
                      ? 'Required start date for the new payroll setup version.'
                      : 'Optional start date for this payroll setup version.'}
                  </small>
                </label>

                <label>
                  <span>
                    Effective To
                  </span>

                  <input
                    type="date"
                    value={
                      form.effectiveTo
                    }
                    onChange={
                      (event) =>
                        updateFormField(
                          'effectiveTo',
                          event.target.value,
                        )
                    }
                    disabled={
                      saving
                    }
                  />

                  <small>
                    Optional end date. Leave blank when the setup has no planned end date.
                  </small>
                </label>
              </div>
            </div>

            <div className="company-form-section">
              <h3>
                Philippine Minimum Wage Reference
              </h3>

              <div className="company-form-grid">
                <label>
                  <span>
                    Region Code
                  </span>

                  <input
                    value={
                      form.minimumWageRegionCode
                    }
                    maxLength={20}
                    placeholder="Example: IVA"
                    onChange={
                      (event) =>
                        updateFormField(
                          'minimumWageRegionCode',
                          event.target.value,
                        )
                    }
                    disabled={saving}
                  />
                </label>

                <label>
                  <span>
                    Wage Order
                  </span>

                  <input
                    value={
                      form.minimumWageOrderCode
                    }
                    maxLength={40}
                    placeholder="Example: IVA-22"
                    onChange={
                      (event) =>
                        updateFormField(
                          'minimumWageOrderCode',
                          event.target.value,
                        )
                    }
                    disabled={saving}
                  />
                </label>

                <label>
                  <span>
                    Area Classification
                  </span>

                  <input
                    value={
                      form.minimumWageAreaClassification
                    }
                    maxLength={120}
                    onChange={
                      (event) =>
                        updateFormField(
                          'minimumWageAreaClassification',
                          event.target.value,
                        )
                    }
                    disabled={saving}
                  />
                </label>

                <label>
                  <span>
                    Sector
                  </span>

                  <input
                    value={
                      form.minimumWageSector
                    }
                    maxLength={120}
                    placeholder="Example: NON_AGRICULTURE"
                    onChange={
                      (event) =>
                        updateFormField(
                          'minimumWageSector',
                          event.target.value,
                        )
                    }
                    disabled={saving}
                  />
                </label>

                <label>
                  <span>
                    Daily Minimum Wage
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      form.minimumWageDailyRate
                    }
                    onChange={
                      (event) =>
                        updateFormField(
                          'minimumWageDailyRate',
                          event.target.value,
                        )
                    }
                    disabled={saving}
                  />
                </label>

                <label>
                  <span>
                    Legal Effective Date
                  </span>

                  <input
                    type="date"
                    value={
                      form.minimumWageRateEffectiveFrom
                    }
                    onChange={
                      (event) =>
                        updateFormField(
                          'minimumWageRateEffectiveFrom',
                          event.target.value,
                        )
                    }
                    disabled={saving}
                  />
                </label>
              </div>

              <p className="company-cutoff-help">
                Daily Minimum Wage and Legal Effective Date must be provided together to configure the statutory wage. Region Code, Wage Order, Area Classification, and Sector are optional reference fields. Leave all fields blank when no statutory wage is configured. The legal wage effective date is separate from the payroll setup version effective date.
              </p>
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
                  : 'Save Payroll Setup'}
              </button>
            </div>
          </form>
        ) : payrollSetup ? (
          <div className="company-profile-grid">
            <div>
              <span>
                Setup Name
              </span>

              <strong>
                {payrollSetup.name}
              </strong>
            </div>

            <div>
              <span>
                Setup Status
              </span>

              <strong>
                {formatStatus(
                  payrollSetup.status,
                )}
              </strong>
            </div>

            <div>
              <span>
                Active Version
              </span>

              <strong>
                {payrollSetup.activeVersion
                  ? `Version ${payrollSetup.activeVersion.version}`
                  : 'No active version'}
              </strong>
            </div>

            <div>
              <span>
                Standard Work Day
              </span>

              <strong>
                {getStandardWorkMinutes(
                  payrollSetup,
                ) !== null
                  ? `${getStandardWorkMinutes(
                      payrollSetup,
                    )} minutes`
                  : 'Not configured'}
              </strong>
            </div>

            <div>
              <span>
                PhilHealth Daily-Worker Schedule
              </span>

              <strong>
                {getPhilHealthScheduleDays(
                  payrollSetup,
                ) !== null
                  ? `${getPhilHealthScheduleDays(
                      payrollSetup,
                    )} days per week`
                  : 'Not configured'}
              </strong>
            </div>

            <div>
              <span>
                Minimum Wage Region
              </span>

              <strong>
                {getMinimumWageConfig(
                  payrollSetup,
                )?.regionCode ??
                  'Not configured'}
              </strong>
            </div>

            <div>
              <span>
                Wage Order
              </span>

              <strong>
                {getMinimumWageConfig(
                  payrollSetup,
                )?.wageOrderCode ??
                  'Not configured'}
              </strong>
            </div>

            <div>
              <span>
                Area Classification
              </span>

              <strong>
                {getMinimumWageConfig(
                  payrollSetup,
                )?.areaClassification ??
                  'Not configured'}
              </strong>
            </div>

            <div>
              <span>
                Minimum Wage Sector
              </span>

              <strong>
                {getMinimumWageConfig(
                  payrollSetup,
                )?.sector ??
                  'Not configured'}
              </strong>
            </div>

            <div>
              <span>
                Daily Minimum Wage
              </span>

              <strong>
                {getMinimumWageConfig(
                  payrollSetup,
                )?.dailyRate
                  ? `${formatMoney(
                      getMinimumWageConfig(
                        payrollSetup,
                      )?.dailyRate ?? '',
                    )} / day`
                  : 'Not configured'}
              </strong>
            </div>

            <div>
              <span>
                Minimum Wage Legal Effective Date
              </span>

              <strong>
                {getMinimumWageConfig(
                  payrollSetup,
                )?.rateEffectiveFrom
                  ? formatDate(
                      getMinimumWageConfig(
                        payrollSetup,
                      )?.rateEffectiveFrom ??
                        null,
                    )
                  : 'Not configured'}
              </strong>
            </div>

            <div>
              <span>
                Effective From
              </span>

              <strong>
                {formatDate(
                  payrollSetup.activeVersion
                    ?.effectiveFrom ??
                    null,
                )}
              </strong>
            </div>

            <div>
              <span>
                Effective To
              </span>

              <strong>
                {formatDate(
                  payrollSetup.activeVersion
                    ?.effectiveTo ??
                    null,
                )}
              </strong>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            Payroll setup is not configured for this company.
          </div>
        )}
      </div>

      <CompanyCutoffTemplateSection
        accessToken={accessToken}
        companyId={companyId}
        templates={cutoffTemplates}
        onCreated={(template) =>
          setCutoffTemplates(
            (current) => [
              ...current,
              template,
            ],
          )
        }
      />
    </>
  )
}
