import {
  useState,
} from 'react'
import type {
  FormEvent,
} from 'react'

import { ApiError } from '../api/client'
import {
  createCompanyCutoffTemplate,
  type CompanyCutoffTemplateView,
  type CutoffDateRule,
  type CutoffDayMode,
  type CutoffMonthOffset,
  type SemiMonthlyCutoffPeriod,
} from '../api/companies'

import { CompanyPayrollCutoffGenerationPanel } from './CompanyPayrollCutoffGenerationPanel'

interface CompanyCutoffTemplateSectionProps {
  accessToken: string
  companyId: string
  templates: CompanyCutoffTemplateView[]
  onCreated: (
    template: CompanyCutoffTemplateView,
  ) => void
}

interface DateRuleFormState {
  mode: CutoffDayMode
  day: string
  monthOffset: '-1' | '0' | '1'
}

interface CutoffPeriodFormState {
  code: string
  name: string

  start: DateRuleFormState
  end: DateRuleFormState
  pay: DateRuleFormState
}

interface CutoffTemplateFormState {
  code: string
  name: string

  period1: CutoffPeriodFormState
  period2: CutoffPeriodFormState
}

type PeriodKey =
  | 'period1'
  | 'period2'

type RuleKey =
  | 'start'
  | 'end'
  | 'pay'

function emptyRule(): DateRuleFormState {
  return {
    mode: 'DAY',
    day: '',
    monthOffset: '0',
  }
}

function emptyPeriod(): CutoffPeriodFormState {
  return {
    code: '',
    name: '',

    start: emptyRule(),
    end: emptyRule(),
    pay: emptyRule(),
  }
}

function emptyForm(): CutoffTemplateFormState {
  return {
    code: '',
    name: '',

    period1: emptyPeriod(),
    period2: emptyPeriod(),
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

  return 'Unable to save cutoff configuration.'
}

function normalizeCode(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase()
}

function parseMonthOffset(
  value: DateRuleFormState['monthOffset'],
): CutoffMonthOffset {
  return Number(
    value,
  ) as CutoffMonthOffset
}

function parseRule(
  rule: DateRuleFormState,
  label: string,
): CutoffDateRule {
  const monthOffset =
    parseMonthOffset(
      rule.monthOffset,
    )

  if (rule.mode === 'LAST_DAY') {
    return {
      mode: 'LAST_DAY',
      monthOffset,
    }
  }

  const day =
    Number(rule.day)

  if (
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(
      `${label} day must be a whole number from 1 to 31.`,
    )
  }

  return {
    mode: 'DAY',
    day,
    monthOffset,
  }
}

function ruleOrder(
  rule: CutoffDateRule,
): number {
  const dayOrder =
    rule.mode === 'LAST_DAY'
      ? 32
      : rule.day ?? 0

  return (
    rule.monthOffset * 40 +
    dayOrder
  )
}

function validatePeriod(
  period: SemiMonthlyCutoffPeriod,
): void {
  if (
    ruleOrder(period.start) >
    ruleOrder(period.end)
  ) {
    throw new Error(
      `${period.name} starts after it ends.`,
    )
  }

  if (
    ruleOrder(period.end) >
    ruleOrder(period.pay)
  ) {
    throw new Error(
      `${period.name} pay date cannot be before its cutoff end date.`,
    )
  }
}

function formatMonthOffset(
  value: number,
): string {
  if (value === -1) {
    return 'Previous month'
  }

  if (value === 1) {
    return 'Next month'
  }

  return 'Reference month'
}

function formatRule(
  rule: CutoffDateRule,
): string {
  const datePart =
    rule.mode === 'LAST_DAY'
      ? 'Last day'
      : `Day ${rule.day}`

  return `${datePart} · ${formatMonthOffset(
    rule.monthOffset,
  )}`
}

interface DateRuleEditorProps {
  title: string
  value: DateRuleFormState
  disabled: boolean
  onModeChange: (
    value: CutoffDayMode,
  ) => void
  onDayChange: (
    value: string,
  ) => void
  onMonthOffsetChange: (
    value: DateRuleFormState['monthOffset'],
  ) => void
}

function DateRuleEditor({
  title,
  value,
  disabled,
  onModeChange,
  onDayChange,
  onMonthOffsetChange,
}: DateRuleEditorProps) {
  return (
    <div className="company-cutoff-rule">
      <strong>
        {title}
      </strong>

      <label>
        <span>
          Date Type
        </span>

        <select
          value={value.mode}
          disabled={disabled}
          onChange={
            (event) =>
              onModeChange(
                event.target
                  .value as CutoffDayMode,
              )
          }
        >
          <option value="DAY">
            Day Number
          </option>

          <option value="LAST_DAY">
            Last Day of Month
          </option>
        </select>
      </label>

      <label>
        <span>
          Day
        </span>

        <input
          type="number"
          min="1"
          max="31"
          step="1"
          value={
            value.mode === 'DAY'
              ? value.day
              : ''
          }
          disabled={
            disabled ||
            value.mode === 'LAST_DAY'
          }
          placeholder={
            value.mode === 'DAY'
              ? '1-31'
              : 'Not applicable'
          }
          onChange={
            (event) =>
              onDayChange(
                event.target.value,
              )
          }
        />
      </label>

      <label>
        <span>
          Month
        </span>

        <select
          value={
            value.monthOffset
          }
          disabled={disabled}
          onChange={
            (event) =>
              onMonthOffsetChange(
                event.target.value as
                  DateRuleFormState['monthOffset'],
              )
          }
        >
          <option value="-1">
            Previous Month
          </option>

          <option value="0">
            Reference Month
          </option>

          <option value="1">
            Next Month
          </option>
        </select>
      </label>
    </div>
  )
}

export function CompanyCutoffTemplateSection({
  accessToken,
  companyId,
  templates,
  onCreated,
}: CompanyCutoffTemplateSectionProps) {
  const [
    configuring,
    setConfiguring,
  ] = useState(false)

  const [
    form,
    setForm,
  ] =
    useState<CutoffTemplateFormState>(
      emptyForm,
    )

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    error,
    setError,
  ] =
    useState<string | null>(null)

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<string | null>(null)

  function resetForm() {
    setForm(
      emptyForm(),
    )
    setError(null)
  }

  function startConfiguration() {
    resetForm()
    setSuccessMessage(null)
    setConfiguring(true)
  }

  function cancelConfiguration() {
    if (saving) {
      return
    }

    resetForm()
    setConfiguring(false)
  }

  function updateTemplateField(
    field: 'code' | 'name',
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    )

    setError(null)
  }

  function updatePeriodField(
    periodKey: PeriodKey,
    field: 'code' | 'name',
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,

        [periodKey]: {
          ...current[
            periodKey
          ],

          [field]: value,
        },
      }),
    )

    setError(null)
  }

  function updateRuleMode(
    periodKey: PeriodKey,
    ruleKey: RuleKey,
    mode: CutoffDayMode,
  ) {
    setForm(
      (current) => ({
        ...current,

        [periodKey]: {
          ...current[
            periodKey
          ],

          [ruleKey]: {
            ...current[
              periodKey
            ][ruleKey],

            mode,

            day:
              mode === 'LAST_DAY'
                ? ''
                : current[
                    periodKey
                  ][ruleKey].day,
          },
        },
      }),
    )

    setError(null)
  }

  function updateRuleDay(
    periodKey: PeriodKey,
    ruleKey: RuleKey,
    day: string,
  ) {
    setForm(
      (current) => ({
        ...current,

        [periodKey]: {
          ...current[
            periodKey
          ],

          [ruleKey]: {
            ...current[
              periodKey
            ][ruleKey],

            day,
          },
        },
      }),
    )

    setError(null)
  }

  function updateRuleMonthOffset(
    periodKey: PeriodKey,
    ruleKey: RuleKey,
    monthOffset:
      DateRuleFormState['monthOffset'],
  ) {
    setForm(
      (current) => ({
        ...current,

        [periodKey]: {
          ...current[
            periodKey
          ],

          [ruleKey]: {
            ...current[
              periodKey
            ][ruleKey],

            monthOffset,
          },
        },
      }),
    )

    setError(null)
  }

  function buildPeriod(
    source: CutoffPeriodFormState,
    label: string,
  ): SemiMonthlyCutoffPeriod {
    const code =
      normalizeCode(
        source.code,
      )

    const name =
      source.name.trim()

    if (!code) {
      throw new Error(
        `${label} code is required.`,
      )
    }

    if (!name) {
      throw new Error(
        `${label} name is required.`,
      )
    }

    const period:
      SemiMonthlyCutoffPeriod = {
        code,
        name,

        start:
          parseRule(
            source.start,
            `${name} start`,
          ),

        end:
          parseRule(
            source.end,
            `${name} end`,
          ),

        pay:
          parseRule(
            source.pay,
            `${name} pay`,
          ),
      }

    validatePeriod(
      period,
    )

    return period
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    const templateCode =
      normalizeCode(
        form.code,
      )

    const templateName =
      form.name.trim()

    if (!templateCode) {
      setError(
        'Cutoff template code is required.',
      )

      return
    }

    if (!templateName) {
      setError(
        'Cutoff template name is required.',
      )

      return
    }

    try {
      const period1 =
        buildPeriod(
          form.period1,
          'Period 1',
        )

      const period2 =
        buildPeriod(
          form.period2,
          'Period 2',
        )

      if (
        period1.code ===
        period2.code
      ) {
        throw new Error(
          'Cutoff period codes must be unique.',
        )
      }

      const ordered =
        [
          period1,
          period2,
        ].sort(
          (left, right) =>
            ruleOrder(
              left.start,
            ) -
            ruleOrder(
              right.start,
            ),
        )

      if (
        ruleOrder(
          ordered[0].end,
        ) >=
        ruleOrder(
          ordered[1].start,
        )
      ) {
        throw new Error(
          'The two cutoff periods cannot overlap.',
        )
      }

      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      const created =
        await createCompanyCutoffTemplate(
          accessToken,
          companyId,
          {
            code:
              templateCode,

            name:
              templateName,

            frequency:
              'SEMI_MONTHLY',

            configuration: {
              periods: [
                period1,
                period2,
              ],
            },
          },
        )

      onCreated(
        created,
      )

      setForm(
        emptyForm(),
      )

      setConfiguring(false)

      setSuccessMessage(
        'Payroll cutoff configuration created successfully.',
      )
    } catch (
      saveError: unknown
    ) {
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
    <div className="company-profile-section">
      <div className="company-profile-section-heading">
        <h3>
          Payroll Cutoff Configuration
        </h3>

        {templates.length === 0 &&
          !configuring && (
            <button
              type="button"
              className="secondary-button"
              onClick={
                startConfiguration
              }
            >
              Configure Cutoff Template
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
              Semi-Monthly Cutoff Template
            </h3>

            <div className="company-form-grid">
              <label>
                <span>
                  Template Code
                </span>

                <input
                  type="text"
                  value={
                    form.code
                  }
                  placeholder="e.g. SEMI-MONTHLY"
                  disabled={
                    saving
                  }
                  onChange={
                    (event) =>
                      updateTemplateField(
                        'code',
                        event.target.value,
                      )
                  }
                  required
                />
              </label>

              <label>
                <span>
                  Template Name
                </span>

                <input
                  type="text"
                  value={
                    form.name
                  }
                  placeholder="e.g. Standard Semi-Monthly"
                  disabled={
                    saving
                  }
                  onChange={
                    (event) =>
                      updateTemplateField(
                        'name',
                        event.target.value,
                      )
                  }
                  required
                />
              </label>
            </div>

            <p className="company-cutoff-help">
              Configure two payroll periods. Dates are relative to a reference month and are not pre-filled.
            </p>

            {(
              [
                [
                  'period1',
                  'Period 1',
                ],
                [
                  'period2',
                  'Period 2',
                ],
              ] as const
            ).map(
              ([
                periodKey,
                title,
              ]) => {
                const period =
                  form[
                    periodKey
                  ]

                return (
                  <div
                    key={
                      periodKey
                    }
                    className="company-cutoff-period"
                  >
                    <h4>
                      {title}
                    </h4>

                    <div className="company-form-grid">
                      <label>
                        <span>
                          Period Code
                        </span>

                        <input
                          type="text"
                          value={
                            period.code
                          }
                          placeholder={
                            periodKey ===
                            'period1'
                              ? 'e.g. FIRST'
                              : 'e.g. SECOND'
                          }
                          disabled={
                            saving
                          }
                          onChange={
                            (event) =>
                              updatePeriodField(
                                periodKey,
                                'code',
                                event.target
                                  .value,
                              )
                          }
                          required
                        />
                      </label>

                      <label>
                        <span>
                          Period Name
                        </span>

                        <input
                          type="text"
                          value={
                            period.name
                          }
                          placeholder={
                            periodKey ===
                            'period1'
                              ? 'e.g. First Cutoff'
                              : 'e.g. Second Cutoff'
                          }
                          disabled={
                            saving
                          }
                          onChange={
                            (event) =>
                              updatePeriodField(
                                periodKey,
                                'name',
                                event.target
                                  .value,
                              )
                          }
                          required
                        />
                      </label>
                    </div>

                    <div className="company-cutoff-rule-grid">
                      {(
                        [
                          [
                            'start',
                            'Cutoff Start',
                          ],
                          [
                            'end',
                            'Cutoff End',
                          ],
                          [
                            'pay',
                            'Pay Date',
                          ],
                        ] as const
                      ).map(
                        ([
                          ruleKey,
                          ruleTitle,
                        ]) => (
                          <DateRuleEditor
                            key={
                              ruleKey
                            }
                            title={
                              ruleTitle
                            }
                            value={
                              period[
                                ruleKey
                              ]
                            }
                            disabled={
                              saving
                            }
                            onModeChange={
                              (
                                value,
                              ) =>
                                updateRuleMode(
                                  periodKey,
                                  ruleKey,
                                  value,
                                )
                            }
                            onDayChange={
                              (
                                value,
                              ) =>
                                updateRuleDay(
                                  periodKey,
                                  ruleKey,
                                  value,
                                )
                            }
                            onMonthOffsetChange={
                              (
                                value,
                              ) =>
                                updateRuleMonthOffset(
                                  periodKey,
                                  ruleKey,
                                  value,
                                )
                            }
                          />
                        ),
                      )}
                    </div>
                  </div>
                )
              },
            )}
          </div>

          {error && (
            <div className="form-feedback form-feedback-error">
              {error}
            </div>
          )}

          <div className="company-form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={
                saving
              }
              onClick={
                cancelConfiguration
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
                : 'Save Cutoff Template'}
            </button>
          </div>
        </form>
      ) : templates.length > 0 ? (
        <div className="company-cutoff-template-list">
          {templates.map(
            (template) => (
              <div
                key={
                  template.id
                }
                className="company-cutoff-template-card"
              >
                <div className="company-cutoff-template-heading">
                  <div>
                    <span>
                      {template.code}
                    </span>

                    <strong>
                      {template.name}
                    </strong>
                  </div>

                  <span>
                    {template.active
                      ? 'Active'
                      : 'Inactive'}
                  </span>
                </div>

                <div className="company-cutoff-template-frequency">
                  Semi-Monthly
                </div>

                {template.active && (
                  <CompanyPayrollCutoffGenerationPanel
                    accessToken={accessToken}
                    companyId={companyId}
                    cutoffTemplateId={template.id}
                  />
                )}

                <div className="company-cutoff-period-summary-grid">
                  {template.configuration.periods.map(
                    (period) => (
                      <div
                        key={
                          period.code
                        }
                        className="company-cutoff-period-summary"
                      >
                        <strong>
                          {period.name}
                        </strong>

                        <span>
                          {period.code}
                        </span>

                        <div>
                          Start: {formatRule(
                            period.start,
                          )}
                        </div>

                        <div>
                          End: {formatRule(
                            period.end,
                          )}
                        </div>

                        <div>
                          Pay: {formatRule(
                            period.pay,
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="empty-state">
          No payroll cutoff configuration exists for this company.
        </div>
      )}
    </div>
  )
}
